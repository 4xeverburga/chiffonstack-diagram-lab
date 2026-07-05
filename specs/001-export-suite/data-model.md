# Data Model: Export Suite

The canonical entity is the **Diagram** (serialized shape produced by
`serializeDiagram` in `src/lab/exportDiagram.ts`). All export targets are
pure projections of `Diagram + DesignTokens`; none introduce new persistent
state.

## Diagram (canonical JSON)

```
Diagram {
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

DiagramNode {
  id: string                     // unique within the diagram
  type: 'labelNode'
  position: { x: number, y: number }
  data: {
    label: string                // may contain any characters (escaped per target)
    image?: string               // base64 data URI (PNG, SVG, or JPEG) — never a URL/path
  }
  className: 'node' | 'node node-active' | 'node node-dim'   // node kind vocabulary
  width?: number                 // present only after manual resize (NodeResizer)
  height?: number                // paired with width; absent = auto-sizing
}

DiagramEdge {
  id: string
  source: string                 // DiagramNode.id
  target: string                 // DiagramNode.id
  type: 'heat'
  data: { variant: 'heat-flow' | 'heat-static' | 'dashed' | 'default' }
}
```

**Validation rules**

- `nodes` must be non-empty for any export (FR-009; generators throw on
  empty input, UI guards first).
- `data.image`, when present, must be a `data:` URI (constitution I
  self-containment). Import rejects/strips non-data-URI values.
- Edge `source`/`target` must reference existing node ids; dangling edges
  are dropped on import with a console warning (existing behavior preserved).
- Backward compatibility: `data.variant` absent → treated as `'default'`
  (matches current `edgeVariant` fallback); `width`/`height` absent →
  auto-size. Pre-feature JSON therefore imports unchanged (spec edge case).

**Invariant**: `import(export(diagram)) ≡ diagram` for the fields above
(constitution I round-trip).

## DesignTokens

```
DesignTokens {
  primaryColor: string     // any valid CSS color; drives heat edges, active-node accents
  secondaryColor: string   // default/dashed edge stroke, hairlines
  headingFont: string      // node labels
  bodyFont: string         // captions/secondary text in exports
}
```

Defined in `src/lab/designTokens.ts` (unchanged). Every generator takes the
full object explicitly — no defaults inside generators (CLAUDE.md rule);
`DEFAULT_DESIGN_TOKENS` is applied only at the editor state layer.

## Derived (non-persisted) values

```
NodeBox {                  // computed by exportGeometry.ts, shared by SVG + component exports
  id: string
  x, y: number             // = position
  width, height: number    // manual size if present, else label/image heuristic
}

EdgePath {
  id: string
  d: string                // bezier path via getBezierPath, right-center → left-center handles
  variant: HeatVariant
}
```

## Export Artifacts (outputs, not stored)

| Artifact | Producer | Form |
|---|---|---|
| Component export | `exportComponentCode.ts` | `{ tsx: string, css: string }` |
| Animated SVG | `exportSvg.ts` | `string` (single `<svg>` document) |
| Agent bundle | `exportBundle.ts` | `Uint8Array` (zip) |
| Bundle prompt | `promptTemplate.ts` | `string` (markdown) |

## Image upload result (P4)

```
ImageUploadResult {
  dataUri: string
  byteSize: number         // decoded size; warning when > IMAGE_SIZE_WARNING_BYTES (500 KB)
}
```

State transition: `Inspector` file input → `readImageFile` →
`node.data.image = dataUri` (+ transient warning flag in Inspector local
state; not persisted in the diagram).
