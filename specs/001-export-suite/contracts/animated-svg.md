# Contract: Animated SVG Export (P3)

`exportSvg(nodes: Node[], edges: Edge[], tokens: DesignTokens): string`

Throws on `nodes.length === 0`. Delivered as a `diagram.svg` download and/or
clipboard copy. **Replaces** the static HTML snippet export (`exportCode.ts`
is deleted; its geometry heuristics move to `exportGeometry.ts`) — one image-
track export action, per FR-006.

## Document shape

- Single `<svg>` element, `viewBox` fitted to content + margin, explicit
  `width`/`height` attributes for hosts that ignore CSS sizing.
- `<style>` block inside the SVG carrying: token values as custom properties
  on `:root`/`svg`, node/edge classes, the `heat-flow` `stroke-dashoffset`
  keyframes, and a `prefers-reduced-motion: reduce` override.
- Nodes as `<g>` with `<rect>` + `<text>` (+ `<image href="data:…">` when the
  node has an image); edges as bezier `<path>` elements using the shared
  `exportGeometry.ts` output — same curves as the canvas and the component
  export.
- Text: labels escaped; font-family from tokens with generic fallbacks.

## Guarantees (constitution I)

1. **Zero-JS, zero-network**: no `<script>`, no external `href`/`url()` —
   images inline as data URIs, fonts referenced by name only. Displaying the
   file performs no network requests and executes no scripts.
2. **Plays in `<img>`**: the CSS animation technique is chosen specifically
   to animate inside `<img>`-embedded SVG in evergreen browsers.
3. **Complete static frame**: at time zero (and wherever animation doesn't
   run — e.g. design-tool import), every node and edge is fully drawn; the
   heat-flow edge appears as its static dashed heat path. This is the
   documented degradation mapping.
4. **Deterministic**: same input → byte-identical output.

## Fidelity mapping

| Canvas capability | Representation |
|---|---|
| Node kinds | rect fill/stroke/dash treatments per kind |
| Node image | `<image>` with inline data URI, above-label layout |
| Manual resize | explicit rect dimensions |
| heat-flow edge | dashed path in `--token-primary` + dashoffset keyframes |
| heat-static edge | solid path in `--token-primary`, wider stroke |
| dashed / default edge | `--token-secondary` stroke, dashed/solid |
| Animation off (reduced motion / static host) | complete static frame |
