# Contract: Edge Attachments in Canonical Diagram JSON

Extends `specs/001-export-suite/contracts/diagram-json.md`. The diagram JSON
remains the single canonical source consumed by every export target.

## Shape

```jsonc
{
  "edges": [
    {
      "id": "user-router",
      "source": "user",
      "target": "router",
      "type": "heat",
      "data": { "variant": "heat-flow" },
      "sourceHandle": "bottom",   // NEW, optional: "top" | "bottom" | "left" | "right"
      "targetHandle": "top"       // NEW, optional: "top" | "bottom" | "left" | "right"
    }
  ]
}
```

## Guarantees

1. **Round-trip**: export → import → export preserves `sourceHandle` and
   `targetHandle` byte-identically for all recognized values.
2. **Legacy import**: an edge missing either field imports with
   `sourceHandle: "right"` / `targetHandle: "left"` — the exact anchoring
   all pre-002 diagrams rendered with. Import never fails on missing sides.
3. **Unknown values**: an unrecognized string (hand-edited file) falls back
   to the legacy default for that endpoint only; the rest of the edge and
   diagram import unchanged.
4. **Normalization on re-export**: after any import, re-exporting emits
   explicit sides on every edge (legacy files are upgraded, not preserved
   as-implicit).

## Export-target obligations

| Target | Obligation |
|---|---|
| Diagram JSON | Serialize both fields verbatim from canvas state. |
| React Flow component code | Emit edges with `sourceHandle`/`targetHandle` and render nodes with four handles using the same ids, so React Flow anchors identically in the consumer app. Handles are visually hidden in the generated CSS — exports never show connection points. |
| Animated SVG | Anchor each edge path at the midpoint of the recorded side of each node's rendered box, using the same bezier function as the canvas. |

## Non-goals

- No per-handle data (labels, colors, offsets). A side is the entire
  vocabulary.
- No self-loop rendering: connections with `source === target` are rejected
  at creation; the JSON contract does not define their geometry.
