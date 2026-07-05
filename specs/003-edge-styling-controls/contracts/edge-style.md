# Contract: Edge Thickness & Flow Direction in Canonical Diagram JSON

Extends `specs/001-export-suite/contracts/diagram-json.md` and
`specs/002-node-connection-handles/contracts/edge-attachments.md`.

## Shape

```jsonc
{
  "edges": [
    {
      "id": "user-router",
      "source": "user",
      "target": "router",
      "sourceHandle": "right",
      "targetHandle": "left",
      "type": "heat",
      "data": {
        "variant": "heat-flow",
        "thickness": "thick",     // NEW, optional: "thin" | "normal" | "thick"
        "direction": "reverse"    // NEW, optional: "forward" | "reverse"
      }
    }
  ]
}
```

## Guarantees

1. **Round-trip**: export → import → export preserves `thickness` and
   `direction` byte-identically for recognized values.
2. **Legacy import**: missing fields import as `thickness: "normal"`,
   `direction: "forward"` — visually identical to pre-003 rendering. Import
   never fails on missing style fields.
3. **Unknown values**: an unrecognized string falls back to that field's
   default only; the rest of the edge imports unchanged.
4. **Normalization on re-export**: after any import, re-export emits
   explicit values for both fields on every edge.
5. **Whitelisted data**: `data` in the canonical JSON contains exactly
   `variant`, `thickness`, `direction` — editor-runtime fields never leak.
6. **Direction semantics**: `direction` describes animation playback only.
   It never alters `source`, `target`, `sourceHandle`, or `targetHandle`.
   On variants without animation it is inert but preserved.

## Export-target obligations

| Target | Obligation |
|---|---|
| Diagram JSON | Serialize both fields verbatim from canvas state. |
| React Flow component code | Generated edge component applies `edge-w-<thickness>` and `edge-reverse` classes; generated CSS defines one `stroke-width` rule per step (from the shared map) and `animation-direction: reverse`. Visual result matches the canvas. |
| Animated SVG | Each `<path>` carries the same classes; the `<style>` block defines the same width rules and reverse rule, so thickness and flow direction render identically, including in `<img>` embeds. Reduced-motion fallback unchanged (animation off, static frame). |

## Non-goals

- No numeric thickness anywhere (UI, JSON, exports): the three steps are
  the entire vocabulary.
- No per-edge color/style overrides — color remains variant + token
  territory.
- No arrowheads/markers changes: direction is animation-only.
