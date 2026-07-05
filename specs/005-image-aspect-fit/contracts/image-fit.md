# Contract: Image-Fitted Node Dimensions in Canonical Diagram JSON

Extends `specs/001-export-suite/contracts/diagram-json.md`.

## Shape

```jsonc
{
  "nodes": [
    {
      "id": "logo",
      "type": "labelNode",
      "position": { "x": 100, "y": 40 },
      "data": {
        "label": "logo",
        "image": "data:image/png;base64,…",   // unchanged (001): embedded, self-contained
        "imageAspect": 1.0                      // NEW, optional: natural width/height, > 0, finite
      },
      "width": 160,                             // existing fields, now also written by the fit
      "height": 180
    }
  ]
}
```

## Guarantees

1. **Round-trip**: `imageAspect`, `width`, `height` survive export →
   import → export byte-identically.
2. **Legacy import**: image nodes without `imageAspect` (pre-005 files)
   import and render exactly as before — no auto-refit, no ratio lock.
   Import never fails on the missing field.
3. **Invalid values**: a non-numeric, non-finite, or ≤ 0 `imageAspect`
   — or one present without `data.image` — is dropped on parse; the rest
   of the node imports unchanged.
4. **Undistorted rendering**: every target renders the embedded image at
   its natural aspect ratio (canvas/component via `object-fit: contain`,
   SVG via `preserveAspectRatio="xMidYMid meet"` — both pre-existing). On
   a fitted node the image area matches the image ratio, so it fills edge
   to edge with no bars.
5. **Dimensions win**: persisted `width`/`height` are authoritative in all
   targets (established by 001); the fit writes them, it does not add a
   parallel sizing channel.

## Export-target obligations

| Target | Obligation |
|---|---|
| Diagram JSON | Serialize `imageAspect` verbatim when present; keep embedding images as data URIs. |
| React Flow component code | No new logic — persisted dimensions + `object-fit: contain` already reproduce the fitted node. |
| Animated SVG | No new logic — node box from persisted dimensions + `preserveAspectRatio` already reproduce it. |

## Non-goals

- No cropping, rotation, filters, or any image editing — images are used
  exactly as uploaded (product boundary).
- No stored natural pixel dimensions; the single `imageAspect` ratio is
  the only denormalized value.
- Exports never read `imageAspect`; it exists for the editor's ratio lock
  and survives round-trips for that purpose.
