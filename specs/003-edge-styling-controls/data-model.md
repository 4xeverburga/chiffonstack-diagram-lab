# Data Model: Edge Styling Controls

## New vocabularies (in `src/lab/edgeStyle.ts`)

```
EdgeThickness = "thin" | "normal" | "thick"
EdgeDirection = "forward" | "reverse"
```

- Defined as `const` arrays + derived types (same pattern as
  `HEAT_VARIANTS` and `HANDLE_SIDES`).
- Defaults exported as named constants: `DEFAULT_THICKNESS = "normal"`,
  `DEFAULT_DIRECTION = "forward"`.
- Cycle order for the quick action: `thin → normal → thick → thin`
  (exported so UI and tests share it).
- `THICKNESS_STROKE_WIDTH: Record<Exclude<EdgeThickness, 'normal'>, number>`
  — the only place a pixel value exists ({ thin: 1.5, thick: 4 }); consumed
  by canvas CSS authoring, component-CSS generation, and SVG-CSS generation.
  `normal` is intentionally absent: it renders each variant's pre-003
  baseline width so legacy diagrams import pixel-identically (research R2).

## Plain edge (canonical JSON) — extended

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | unchanged |
| `source` / `target` | string | yes | unchanged |
| `sourceHandle` / `targetHandle` | HandleSide | no | unchanged (002) |
| `type` | string | no (defaults `heat`) | unchanged |
| `data.variant` | HeatVariant | no (defaults `default`) | unchanged |
| `data.thickness` | EdgeThickness | no | **NEW** — parse fallback `"normal"` |
| `data.direction` | EdgeDirection | no | **NEW** — parse fallback `"forward"`; render-effective only on `heat-flow` |

### Validation rules

- `parsePlainEdge` never throws on a bad thickness/direction; each field
  falls back to its default independently (FR-007).
- Parse whitelists `data` to exactly `{ variant, thickness, direction }` —
  runtime-injected fields (`primaryColor`, toolbar callbacks) can never
  reach the JSON.
- Re-export after import emits explicit values (legacy files upgraded, same
  normalization rule as 002 handles).

## Derived (non-persisted) state

- `renderedEdges` (App) additionally injects `onCycleThickness` /
  `onReverseDirection` callbacks next to the existing `primaryColor` —
  runtime-only, stripped by the parse whitelist and absent from
  `toPlainDiagram` state input.
- Toolbar visibility = edge `selected` flag (React Flow); nothing stored.

## State transitions

| Event | Effect on data |
|---|---|
| Thickness quick action / Inspector chip | `data.thickness` advances one step in cycle order (or sets chip value) |
| Reverse quick action / Inspector toggle | `data.direction` flips forward⇄reverse; `source`/`target`/handles untouched (FR-004) |
| Variant changed away from `heat-flow` | `data.direction` retained inertly; control hidden |
| Legacy JSON imported | Edge gains explicit `thickness: "normal"`, `direction: "forward"` in memory |
| JSON with unknown value imported | Offending field falls back to its default; other fields honored |

## Rendering contract (class names)

Every renderer derives, per edge:

```
edge edge-<variant> edge-w-<thickness>[ edge-reverse]
```

- `edge-w-*` rules own `stroke-width` (moved out of the variant rules).
- `edge-reverse` sets `animation-direction: reverse` (no-op for variants
  without animation).
- Canvas uses the `lab-edge*` prefix as today; exports use the `edge*`
  prefix as today — prefixes unchanged, only the class set grows.
