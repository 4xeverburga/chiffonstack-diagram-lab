# Contract: Node Text Size in Canonical Diagram JSON

Extends `specs/001-export-suite/contracts/diagram-json.md`.

## Shape

```jsonc
{
  "nodes": [
    {
      "id": "router",
      "type": "labelNode",
      "position": { "x": 220, "y": 80 },
      "data": {
        "label": "router",
        "labelSize": "large"     // NEW, optional: "small" | "normal" | "large"
      },
      "className": "node node-active"
    }
  ]
}
```

## Guarantees

1. **Round-trip**: export → import → export preserves `labelSize`
   byte-identically for recognized values.
2. **Legacy import**: a node without `labelSize` imports as `"normal"` —
   visually identical to pre-004 rendering. Import never fails on a missing
   size.
3. **Unknown values**: an unrecognized string falls back to `"normal"` for
   that node only; the rest of the diagram imports unchanged.
4. **Normalization on re-export**: after any import, re-export emits an
   explicit `labelSize` on every node.
5. **Body font invariant**: every size step renders with the `bodyFont`
   design token. No export may map a size step to `headingFont` or any
   other family.
6. **Sizing semantics**: on auto-sized nodes, exports compute node
   dimensions from the same per-step metrics the canvas uses; persisted
   `width`/`height` always win over the heuristic.

## Export-target obligations

| Target | Obligation |
|---|---|
| Diagram JSON | Serialize `data.labelSize` verbatim from canvas state. |
| React Flow component code | Generated node component applies `node-label-<size>`; generated CSS defines the per-step `font-size` rules from the shared metric map. |
| Animated SVG | Each `<text>` carries the size class; the `<style>` block defines the same `font-size` rules; label band and auto-node dimensions use the same metric row as the canvas heuristic. |

## Non-goals

- No numeric font size anywhere (UI, JSON, exports).
- No heading/header text concept on nodes; no use of `headingFont`.
- No per-node font family, weight, or color options.
