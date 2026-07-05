# Data Model: Node Connection Handles

## HandleSide (new vocabulary)

```
HandleSide = "top" | "bottom" | "left" | "right"
```

- Defined once in `src/lab/handleSides.ts` as a `const` array + derived type
  (same pattern as `HEAT_VARIANTS`).
- Doubles as the React Flow handle id on `LabelNode` and as the serialized
  value in the JSON — one vocabulary, no mapping layer.
- Legacy defaults exported as named constants:
  `LEGACY_SOURCE_SIDE = "right"`, `LEGACY_TARGET_SIDE = "left"`.

## Plain edge (canonical JSON) — extended

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | unchanged |
| `source` | string | yes | unchanged |
| `target` | string | yes | unchanged |
| `type` | string | no (defaults `heat`) | unchanged |
| `data.variant` | HeatVariant | no (defaults `default`) | unchanged |
| `sourceHandle` | HandleSide | no | **NEW** — side of the source node. Serialized always (explicit after any edit); on parse, missing/unknown → `"right"` |
| `targetHandle` | HandleSide | no | **NEW** — side of the target node. On parse, missing/unknown → `"left"` |

### Validation rules

- `parsePlainEdge` never throws on a bad handle value; it falls back to the
  legacy default for that endpoint only (FR-008).
- `toPlainDiagram` writes whatever the live edge carries; after import of a
  legacy file the in-memory edges hold explicit defaults, so re-export emits
  explicit sides (spec US4, scenario 2).

## Plain node — unchanged

Handles are implied by the node's existence (four fixed sides); nothing new
is persisted per node. Node `width`/`height` semantics are untouched; anchor
points are computed from the node's rendered box (existing
`computeNodeBoxes`), which already honors manual resizes and images (FR-009).

## State transitions

| Event | Effect on data |
|---|---|
| User drags a connection from handle `A` on node X to handle `B` on node Y | New edge with `sourceHandle: A`, `targetHandle: B` (captured in `onConnect`) |
| Legacy JSON imported | Each edge gains explicit `sourceHandle: "right"`, `targetHandle: "left"` in memory |
| JSON with unknown side imported | Offending endpoint falls back to its legacy default; other endpoint honored |
| Node moved/resized | No data change on edges; anchors recompute from node box |

## Derived (non-persisted) state

- `handlesVisibleNodeIds: Set<string>` — computed by `useHandleVisibility`
  from the current selection: ids of selected nodes' plus both endpoint ids
  of every selected edge. Never serialized, never exported.
- `connecting: boolean` — canvas-wrapper flag toggled by `onConnectStart` /
  `onConnectEnd`. Never serialized.
