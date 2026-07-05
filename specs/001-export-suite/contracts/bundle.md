# Contract: Agent-Ready Bundle (P2)

`exportBundle(nodes: Node[], edges: Edge[], tokens: DesignTokens): Uint8Array`

Throws on `nodes.length === 0`. Delivered to the user as a
`diagram-bundle.zip` download (Blob + anchor; no clipboard involved).

## Zip layout

```
diagram-bundle.zip
├── Diagram.tsx        # component-export contract, tsx file
├── diagram.css        # component-export contract, css file
├── diagram.json       # diagram-json contract (round-trips into the editor)
├── prompt.md          # integration guide (below)
└── assets/            # present only if any node has an image
    └── node-<id>.<png|svg|jpg>   # decoded from that node's data URI
```

## Guarantees

- `Diagram.tsx`/`diagram.css`/`diagram.json` are byte-identical to what the
  individual exports produce for the same input (single generator, no forks).
- The component renders **without** `assets/` — images stay inline as data
  URIs; `assets/` is a convenience duplicate for asset-pipeline migration.
- Asset file extensions derive from each data URI's MIME type; ids are
  sanitized to filesystem-safe names, uniqueness preserved.
- Built fully client-side (constitution III).

## prompt.md contents (generated per diagram)

1. **What this is** — one paragraph: a self-contained animated architecture
   diagram exported from Diagram Lab.
2. **File inventory** — the table above with per-file roles.
3. **Design-token contract** — for each of the four tokens: current value,
   what it controls, and that it lives as a `--token-*` custom property on
   the `.chiffon-diagram` wrapper (change values there or pass new ones).
4. **Integration steps** — install `@xyflow/react`; copy `Diagram.tsx` +
   `diagram.css` into the project; import and render `<Diagram />`; size the
   `.chiffon-diagram` container.
5. **Optional** — migrating inline images to the project's asset pipeline
   using `assets/`.
6. **Verification checklist** — heat-flow animation plays; pan/zoom works;
   page scrolling not hijacked; colors/fonts match the host site's tokens.

Acceptance bar (SC-003): a coding agent given only the unzipped bundle and
"integrate this diagram" completes the task without asking questions.
