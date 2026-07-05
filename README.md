# Diagram Lab

[![CI](https://github.com/4xeverburga/chiffonstack-diagram-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/4xeverburga/chiffonstack-diagram-lab/actions/workflows/ci.yml)

**Diagram Lab** is an open-source architecture-diagram editor by
[ChiffonStack](https://chiffonstack.com). Lay out a system topology on a
[React Flow](https://reactflow.dev) canvas — nodes, edges, heat paths,
active/dim emphasis — style it with a handful of design tokens to match your
own brand, and export it as an artifact you can drop straight into your
codebase, blog post, or README. No account, no proprietary format, no
diagramming SaaS lock-in.

## Why

Most diagramming tools trap your diagram behind an account, a proprietary
file format, or an export paywall. Diagram Lab exists to turn "I need a clean
architecture diagram for this post" into a five-minute task: sketch a
topology, set four tokens to match your site, click export, and paste a
self-contained result that renders pixel-faithful to what you saw on the
canvas — with zero runtime dependencies required to view it. The diagram
source (JSON) stays round-trippable, so any exported diagram can be pasted
back in and edited later.

## Export formats

Export is the product — everything on the canvas is designed to survive the
trip out, across two audiences:

| Export | Audience | What you get |
| --- | --- | --- |
| **React component** | Developers | A copy-pasteable `Diagram.tsx` + `diagram.css` that reproduces the diagram live in your own React app — animated edges, pan/zoom, styled entirely through your design tokens. |
| **Agent-ready bundle** | Developers | `diagram-bundle.zip`: the component code, the canonical `diagram.json`, any image assets, and a `prompt.md` explaining the token contract — hand the zip to a coding agent and say "integrate this diagram." |
| **Animated SVG** | Everyone else | A single self-contained `<svg>` with the heat-flow animation baked in as CSS — plays even inside a plain `<img>` tag, with zero JS and zero network requests. Degrades gracefully to a static frame anywhere that can't animate SVG (e.g. importing into a design tool). |
| **Diagram JSON** | Both | The canonical, round-trippable source — download it, version it, or share it, then upload it back into the editor to keep editing. Node images are embedded as base64 `data:` URIs, so a JSON file is a single portable artifact. |

Every export is restyled through the same small token contract
(`primaryColor`, `secondaryColor`, `headingFont`, `bodyFont`) rather than a
full theming system — the tool's own look is just the default token values,
not a hard-coded skin.

## Getting started

```bash
npm install
npm run dev      # start the editor at http://localhost:5173
```

Other scripts:

```bash
npm run lint     # oxlint
npm run build    # tsc -b && vite build
npm test         # vitest run — generator/unit tests
```

## Using the editor

1. Drag a node kind in from the sidebar (or click one to drop it at the
   canvas center), then connect nodes to draw edges.
2. Select a node to rename it, change its kind (default / active / dim),
   attach an image (PNG, SVG, or JPEG), or resize it.
3. Select an edge to pick a variant: `heat-flow` (animated), `heat-static`,
   `dashed`, or `default`.
4. Set your brand's design tokens in the sidebar — the canvas restyles live,
   and every export target inherits the same values.
5. Export with one of the buttons in the header: **Export SVG**, **Export
   component**, **Download bundle**, or **Export JSON**. Use **Upload JSON**
   to load a previously exported (or hand-written) `diagram.json` back in.

## Project structure

```
src/
  App.tsx                 # canvas shell: React Flow wiring, node/edge state
  lab/
    designTokens.ts       # the four-token brand contract
    nodeKinds.ts           # node kind -> CSS class mapping
    heatVariants.ts        # edge variant vocabulary
    exportDiagram.ts        # canonical diagram.json - serialize/parse/download
    exportComponentCode.ts  # React component export
    exportBundle.ts         # agent-ready zip (fflate)
    exportSvg.ts             # self-contained animated SVG export
    promptTemplate.ts        # prompt.md generator for the bundle
    imageUpload.ts            # node image accept-list + size warning
    useExportActions.ts       # export/import button handlers + status labels
    Sidebar.tsx / Inspector.tsx / LabelNode.tsx / HeatEdge.tsx  # editor UI
test/lab/                 # generator unit tests + shared fixtures
specs/001-export-suite/   # spec-kit feature spec, plan, contracts, tasks
```

Each export generator is a pure function under `src/lab/` with its own unit
test file in `test/lab/` — the UI layer (`App.tsx`, `useExportActions.ts`)
only wires state and side effects (downloads, clipboard) around them.

## Contributing

See [CLAUDE.md](CLAUDE.md) for coding conventions (e.g. no default parameter
values) and [PRODUCT.md](PRODUCT.md) for the product's scope and
anti-references. CI runs lint, build, and the test suite on every push and
pull request to `main`; keep them green before merging.
