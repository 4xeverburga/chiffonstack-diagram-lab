# Contract: React Flow Component Export (P1)

`exportComponentCode(nodes: Node[], edges: Edge[], tokens: DesignTokens): { tsx: string, css: string }`

Throws on `nodes.length === 0`.

## Output files

### `Diagram.tsx`

- Default-exports a single React component named `Diagram`.
- Embeds nodes/edges as typed constants (data URIs inline; labels escaped via
  `JSON.stringify`).
- Defines local `LabelNode` and `HeatEdge` renderers equivalent to the lab's
  (same class vocabulary, same gradient/variant behavior).
- Applies tokens as CSS custom properties (`--token-primary`, etc.) on the
  root wrapper — token values appear **only** there (constitution II).
- Renders `<ReactFlow>` display-locked: `fitView`, pan/zoom enabled;
  `nodesDraggable={false}`, `nodesConnectable={false}`,
  `elementsSelectable={false}`, `preventScrolling={false}`.
- Imports only from `react` and `@xyflow/react` (+ `@xyflow/react/dist/style.css`
  and `./diagram.css`). No other dependencies, no default parameter values.
- Root wrapper class: `chiffon-diagram`; consumer controls dimensions by
  sizing that element (documented in header comment + prompt.md).

### `diagram.css`

- All rules namespaced under `.chiffon-diagram`.
- Mirrors the canvas treatments: node kinds (default/active/dim), node image
  layout, edge variants, the `heat-flow` `stroke-dashoffset` keyframes, and a
  `prefers-reduced-motion: reduce` override disabling the animation.
- References colors/fonts only via the `--token-*` custom properties;
  font-family values carry generic fallbacks.

## Fidelity mapping (constitution I)

| Canvas capability | Representation |
|---|---|
| Node kinds default/active/dim | `className` vocabulary + namespaced CSS |
| Node image | inline data URI, image-above-label layout |
| Manual resize | explicit `width`/`height` in node constant |
| Edge variants heat-flow/heat-static/dashed/default | `HeatEdge` variant + CSS classes |
| Heat-flow animation | CSS keyframes (plays live) |
| Pan/zoom | React Flow interaction props |

## Clipboard form ("Export code" button)

Single string: `diagram.css` inside a `/* ─── diagram.css */` marker block
followed by `// ─── Diagram.tsx` and the component — splittable by eye or by
agent into two files.

## Determinism

Same `(nodes, edges, tokens)` → byte-identical output. No timestamps, no
random identifiers (gradient ids derive from edge ids).
