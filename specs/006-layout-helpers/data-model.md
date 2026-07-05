# Data Model: Layout Helpers

No new persisted entities. This feature reads and writes only the existing
`Node.position` field (canonical since 001) — nothing is added to the
diagram JSON, and no export target changes (FR-005). No undo mechanism is
introduced — see `research.md` R2 for why. No multi-selection or
align/distribute concept exists in this feature — see `research.md` R0.

## Runtime-only shapes (`src/lab/layout.ts`)

These exist only in memory during a drag; none are serialized.

```ts
interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface Guide {
  axis: 'x' | 'y'
  // Flow-space coordinate of the guide line itself
  at: number
  // The alignment kind that produced it, for potential styling (e.g.
  // center guides could differ visually from edge guides)
  kind: 'start' | 'center' | 'end'
}

interface SnapResult {
  guides: Guide[]
  // The dragged node's position after snapping (unchanged if no match)
  position: { x: number; y: number }
}
```

### Function contract (see also `contracts/layout-helpers.md`)

| Function | Signature | Notes |
|---|---|---|
| `computeGuides` | `(dragged: Rect, others: Rect[], thresholdFlow: number) → SnapResult` | Pure; `thresholdFlow` is the screen threshold already converted by the caller (R3) |

## Node field usage (existing, unchanged)

| Field | Type | Source this feature reads |
|---|---|---|
| `node.position` | `{x, y}` | Read for current position; written by drag-snap only |
| `node.measured.width` / `.height` | number (React Flow-populated) | Actual rendered bounds (FR-004) — same fields `imageFit`/resize already rely on; falls back to `node.width`/`node.height` if not yet measured (e.g. first render) |

No changes to `parsePlainNode`/`serializePlainNode` or any export module —
confirmed by FR-005 and the Constitution Check (Principle I).

