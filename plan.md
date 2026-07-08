# Plan: Inspector denso y estado-consciente (+ Sidebar simplificado)

**Branch:** `agents/inspector-dense-reorg` · **Base:** `dev` @ `1f165db`
**Estado:** dirección confirmada por el usuario el 2026-07-07. Este plan es el deliverable de una sesión de research con `/impeccable` (registro Product) + medición en navegador. Ejecutar tal cual; las decisiones abiertas ya fueron cerradas con el usuario.

## Contexto

El usuario siente que la Sidebar izquierda ([src/lab/Sidebar.tsx](src/lab/Sidebar.tsx)) y el Inspector derecho ([src/lab/Inspector.tsx](src/lab/Inspector.tsx)) están "demasiado bloated". Esta reorganización **precede** al feature de presets de configuración y debe dejarle el terreno preparado.

Un intento anterior (branch `agents/sidebar-parameter-organization`, descartado) usó `<details>`/acordeones como organizador principal. **El usuario lo rechazó.** No repetir ese patrón — ver "Decisiones confirmadas".

Leer antes de codear: `PRODUCT.md` y `DESIGN.md` en la raíz (identidad "Instrument Panel": monospace-first, flat, hairlines, un solo acento naranja `--token-primary`, cero decoración). Y `CLAUDE.md` (convenciones: parámetros centralizados en config, imports relativos a la raíz, **prohibido default parameter values**).

## Diagnóstico (medido en navegador, 2026-07-07)

| Medición | Valor |
|---|---|
| Ancho de ambos paneles | 220px fijos (`.lab-sidebar, .lab-inspector { flex: 0 0 220px }` en App.css) |
| Contenido del Inspector (host transactional_api, idle) | 1969px ≈ 2.3 pantallas de scroll |
| Contenido del Inspector (mismo host, sim corriendo) | **4416px ≈ 5.2 pantallas** |
| Solo las 6 tarjetas de fórmulas corriendo | ~2340px (la mayor, "Proportional scaling policy", 656px) |
| Chips de "Simulation role" | 7 chips envueltos en 4 filas irregulares |

Problemas de raíz, por impacto:

1. **220px de ancho** fuerza una columna: 8+ inputs numéricos a uno por fila (~85px c/u), expresiones de fórmula quebradas en 5 líneas.
2. **Ceguera de estado:** corriendo, ~10 inputs de config se renderizan *deshabilitados* (no son editables por diseño — ver `canEdit = runStatus === 'idle'` en Inspector.tsx) y la telemetría queda a ~1100px de scroll. En idle, métricas vacías muestran rayas.
3. **Cero seccionado:** identidad, capability, autoscaling, telemetría y fórmulas corren juntas; los headers pesan igual que los labels.
4. **Fórmulas siempre 100% expandidas** (nombre + expresión + todos los inputs + fuentes).
5. **Prioridad invertida:** Style/Size/Image (set-once) arriba; config de simulación (el corazón del producto) debajo.

## Decisiones confirmadas por el usuario

1. **Denso + estado-consciente, sin acordeones** (opción elegida explícitamente sobre "acordeón en secundarias" y "acordeones mejorados"). Razones registradas: los acordeones esconden sin densificar; el workflow es iterativo (ajustar→correr→observar, click-tax en cada loop); config oculta que sigue actuando sobre el motor es peligrosa (p. ej. autoscaling colapsado con min=max=1); destruyen memoria posicional, anti-"instrument panel".
2. **Fórmulas: comprimir manteniendo todo visible.** Nunca disclosure sobre inputs/fuentes.
3. **Ancho: Inspector ~300px, Sidebar queda 220px.**
4. **Paleta "Add node" se simplifica a 2 items semánticos: Node y Queue.** Active/dim son estética, no semántica — siguen como chips de Style en el Inspector.

## Fases

Cada fase debe compilar, pasar lint/tests y verificarse visualmente antes de seguir.

### Fase 1 — Ancho + secciones + reorden

- Ensanchar el Inspector a 300px vía **variable CSS centralizada** (p. ej. `--panel-inspector-width` junto a los tokens en App.css; no números mágicos repartidos). Sidebar queda 220px: separar la regla compartida `.lab-sidebar, .lab-inspector { flex: 0 0 220px }` (App.css ~línea 273).
- Partir el render del Inspector (nodo host) en secciones fijas con el vocabulario existente (`.lab-panel-title` uppercase + hairline `border-top`, cf. `.lab-panel-title-spaced`), en este orden:
  `ROLE & CAPABILITY` → `SCALING` → `TELEMETRY` → `FORMULAS` → `APPEARANCE`.
- `APPEARANCE` agrupa Label… no: **Label queda arriba de todo** (es la identidad del nodo); Style/Size/Image bajan a `APPEARANCE` al fondo.
- El header de `ROLE & CAPABILITY` debe quedar estructurado como fila (título + espacio a la derecha) — ahí vivirá el picker de presets en el feature siguiente.
- Para edges el cambio es menor: mismo patrón de secciones (`STYLE` → `TRAFFIC` → `TELEMETRY` → `FORMULAS`).

### Fase 2 — Densidad

- **Grid 2 columnas para inputs numéricos** en [src/lab/hostConfigFields.tsx](src/lab/hostConfigFields.tsx) y [src/lab/edgeConfigFields.tsx](src/lab/edgeConfigFields.tsx): 8 campos → 4 filas. Nueva clase CSS (p. ej. `.lab-field-grid`), labels 11px arriba de cada input, unidades dentro del label (`Boot delay (ms)`).
- **Telemetría como tabla de lecturas:** reemplazar las líneas de prosa de `.sim-host-metrics` (`Status: healthy`) por filas label/valor: label en Slate (`--text`) a la izquierda, valor en Ink (`--text-h`) alineado a la derecha, `font-variant-numeric: tabular-nums`. Es el patrón `.sim-host-meter` que ya existe (App.css ~150) — generalizarlo, no inventar otro.
- **Selector de rol:** los 7 chips pasan a grid ordenado de 2 columnas (chips a ancho de celda). Mantener el patrón chip/chip-active (accesibilidad: borde + ring, nunca color solo — DESIGN.md §5).

### Fase 3 — Consciencia de estado (`runStatus` ya llega como prop)

- **Idle:** orden de Fase 1; la sección TELEMETRY no muestra rayas — solo una nota mínima ("start the simulation to read telemetry"); FORMULAS mantiene su empty-state actual.
- **Running/paused:** TELEMETRY y FORMULAS suben al tope (debajo de Label); la config deshabilitada se comprime a una **spec-line de solo lectura** dentro de `ROLE & CAPABILITY`, p. ej.:
  `manual · 600 sat / 650 max / 8ms · replicas 1–4 · collapse`
  (una línea monospace en Slate; el detalle campo-a-campo NO se renderiza mientras corre — hoy son ~10 inputs muertos). La nota "Reset the simulation to edit roles or config." se conserva.
- El reordenado es un cambio de orden de render por `runStatus`, no animado (sin motion decorativo — DESIGN.md §6).

### Fase 4 — Compresión de fórmulas

En [src/lab/FormulaPanel.tsx](src/lab/FormulaPanel.tsx), cada tarjeta pasa a:

```
Saturation ratio (ρ)              ← nombre, Ink, 600 (+ "(binding)" si aplica)
rho = incomingRPS / capacityRPS   ← expresión, Slate
in=135 · cap=600                  ← inputs inline en UNA línea (wrap si no caben)
↗ Kleinrock, Queueing Systems V.1 ← fuentes, links naranja (como hoy)
```

- Los inputs (`Object.entries(descriptor.inputs)`) se unen con ` · ` en una sola línea compacta en vez de `<ul>` vertical. Todo sigue visible — nada on-demand.
- Tarjeta binding conserva borde `--token-primary` + texto "(binding)" (regla border-style-not-color).
- Objetivo: la tarjeta de 656px baja a ~150px; las 6 tarjetas de ~2340px a <900px.

### Fase 5 — Sidebar

En [src/lab/Sidebar.tsx](src/lab/Sidebar.tsx):

- **Paleta = 2 items:** `Node` (kind default, sin sim) y `Queue` (nace con `sim: { kind: 'queue' }`). Requiere extender `onAddNode` y el drag payload (`DRAG_MIME_TYPE`) para transportar el rol de simulación, y el drop handler en App.tsx/useDiagramMutations. **Sin default parameter values** — call sites explícitos.
- Active/dim se eliminan de la paleta (siguen en Inspector como Style).
- "Design tokens" queda al fondo, comprimido: los dos campos de color ya comparten fila con su hex; los dos campos de fuente pueden compactarse. Sin acordeón (el usuario no lo pidió; si el espacio molesta, es candidato legítimo a disclosure pero **preguntar antes**).

## Verificación (cada fase)

1. `npx oxlint` limpio, `npm run build` sin errores, `npm test` (263 tests) verde.
2. **Visual con Playwright** contra `npm run dev`: seleccionar el nodo `api gateway` del diagrama inicial; capturar Inspector en idle Y corriendo (Start + ~6s); verificar sin regresiones en dark mode si aplica.
3. Métrica de éxito global: scrollHeight del Inspector corriendo baja de 4416px a ~1300-1500px con viewport 900px; la telemetría visible sin scroll durante la simulación.
4. Medir con: `document.querySelector('aside.lab-inspector').scrollHeight`.

## Coordinación / riesgos

- **Hay un merge en progreso en `dev`** (branch `agents/canvas-animation-improvements`, conflictos en `src/App.css` y `src/lab/ScalingGroupNode.tsx` al momento de escribir esto). Ese trabajo también toca App.css. Cuando aterrice en dev, **mergear dev a esta rama antes de abrir PR** y esperar conflictos en App.css — resolver preservando ambos: sus cambios de canvas/sparkline y estas secciones de panel.
- El intento anterior (`agents/sidebar-parameter-organization` + su worktree) NO se reutiliza; no copiar su patrón `<details>`.
- No tocar el motor (`src/engine/`, `src/sim/`) — esto es 100% capa de presentación.

## Fuera de alcance

- Los presets de configuración (feature siguiente; esta reorganización solo reserva su slot).
- Cambios a parámetros del modelo de simulación (set cerrado, requiere enmienda constitucional).
- Local mode, exports, o cualquier otra superficie.
