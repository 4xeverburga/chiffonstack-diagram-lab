# Contract: Layout Helpers (pure functions, no JSON change)

This feature does not extend the diagram JSON contract
(`specs/001-export-suite/contracts/diagram-json.md`) — `node.position` is
already canonical and already covered there. This document instead pins
the pure-function contracts other code (and tests) can rely on.

## `computeGuides`

```ts
computeGuides(dragged: Rect, others: Rect[], thresholdFlow: number): {
  guides: Guide[]
  position: { x: number; y: number }
}
```

**Guarantees**:
1. Deterministic: same inputs → same output, no hidden state.
2. Compares `left`/`centerX`/`right` and `top`/`centerY`/`bottom` of
   `dragged` against every rect in `others`, independently per axis.
3. Only the nearest match per axis is returned/snapped to — never more
   than one guide per axis at a time.
4. `thresholdFlow <= 0` or `others` empty → `guides: []` and
   `position` equal to `dragged`'s own position (no snap).
5. Never mutates `dragged` or `others`.

## Non-goals (explicit)

- No new field on the exported node/edge JSON.
- No align or distribute actions, and no multi-selection concept — see
  `research.md` R0. This feature is scoped to a single dragged node against
  its neighbors.
- No undo mechanism — see `research.md` R2. If a snap isn't wanted, drag
  the node again.
- No persistence of guides across reloads.

