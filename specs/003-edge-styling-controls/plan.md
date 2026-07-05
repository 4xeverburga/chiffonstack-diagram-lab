# Implementation Plan: Edge Styling Controls

**Branch**: `main` (feature branch to be created at implementation) | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-edge-styling-controls/spec.md`

## Summary

Give every edge two new serializable properties — `thickness` (closed
vocabulary `thin | normal | thick`, default `normal`) and `direction`
(`forward | reverse`, default `forward`, visible only on the animated
`heat-flow` variant) — stored in `edge.data` beside the existing `variant`,
parsed with tolerant fallbacks, and rendered by all three export targets.
Selecting an edge shows a small floating toolbar at the edge's midpoint
(React Flow `EdgeLabelRenderer`) with two quick actions: cycle thickness and
reverse the flow animation. Rendering is class-driven: one pure module maps
each step to a stroke width consumed by canvas CSS, the generated component
CSS, and the SVG `<style>` block, so the targets cannot drift. `App.tsx` is
already over the constitution's 300-line hard cap (386 lines after 002) —
this feature must extract the edge/node mutation callbacks into a hook and
shed App.tsx below the cap rather than grow it.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `@xyflow/react` (React Flow 12) — `EdgeLabelRenderer` + `getBezierPath` midpoint for the toolbar; no new dependencies

**Storage**: Canonical diagram JSON (`exportDiagram.ts` serialize/parse)

**Testing**: Vitest unit tests under `test/lab/` for all pure logic (style maps, serialization, SVG/component generation); manual round-trip gate for UI

**Target Platform**: Static Vite SPA; exports render in consumer React apps and plain `<img>` tags

**Project Type**: Single-page web app with functional-core export modules

**Performance Goals**: Toolbar work only on selection change; thickness/direction are CSS classes — no per-frame JS

**Constraints**: Closed vocabularies only (no numeric input in UI or JSON); backward-compatible JSON; deterministic exports; files under ~250 lines (300 hard cap — App.tsx must shrink)

**Scale/Scope**: ~7 source files touched, 1 new pure module, 1 new component, 1 extraction hook, ~5 test files extended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Export Fidelity Is the Product | `thickness`/`direction` ship in the same change across JSON round-trip, component code, and animated SVG. Legacy JSON defaults (`normal`, `forward`) are a documented mapping. The toolbar is editor chrome, never exported. | PASS |
| II. Minimal Design-Token Contract | No new tokens. Thickness/direction are edge *variant-style* vocabulary — exactly the "new styling needs are variants, not tokens" rule. No free-form values anywhere (FR-008). | PASS |
| III. Open Source & Self-Contained | No backend, no dependency; JSON gains two optional enum fields, documented in the contract. | PASS |
| IV. Contributor-Legible Codebase | Style maps live in a new pure `edgeStyle.ts` (unit-tested). Toolbar is its own small component. **Pre-existing violation**: App.tsx is 386 lines (>300 hard cap) after 002 — this plan extracts the node/edge mutation callbacks into `useDiagramMutations.ts` and requires App.tsx to land under 300. See Complexity Tracking. | PASS (with mandated extraction) |
| V. Export Targets & Portability | All targets consume the same `edge.data` fields; stroke widths and animation direction come from one shared pure map, so code/SVG/canvas cannot drift. | PASS |

**Post-design re-check (Phase 1)**: PASS — data model adds only optional
enum fields with tolerant parsing; the single style-map module keeps the
projection rule (one source, faithful projections) intact; the App.tsx
extraction is scheduled as part of this feature's tasks, not deferred.

## Project Structure

### Documentation (this feature)

```text
specs/003-edge-styling-controls/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── edge-style.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.tsx                       # sheds mutation callbacks to useDiagramMutations; wires edge-action callbacks; MUST land <300 lines
├── App.css                       # toolbar styling + edge thickness/direction classes for the canvas
└── lab/
    ├── edgeStyle.ts              # NEW — thickness/direction vocabularies, defaults, step→stroke-width map, cycle order (pure)
    ├── useDiagramMutations.ts    # NEW — extraction of node/edge mutation callbacks currently inflating App.tsx
    ├── EdgeToolbar.tsx           # NEW — floating quick actions (cycle thickness, reverse flow) at the edge midpoint
    ├── HeatEdge.tsx              # applies thickness/direction classes; renders EdgeToolbar when selected
    ├── Inspector.tsx             # mirrors thickness chips + direction toggle (same callbacks; discoverability)
    ├── exportDiagram.ts          # parse/serialize data.thickness + data.direction with tolerant fallbacks
    ├── exportGeometry.ts         # EdgePath gains thickness/direction so SVG markup stays a dumb consumer
    ├── exportComponentCode.ts    # generated edge component + CSS render thickness/direction classes
    └── exportSvg.ts              # per-edge classes + CSS rules from the shared style map

test/lab/
├── edgeStyle.test.ts             # NEW — vocabularies, cycle order, width map
├── exportDiagram.test.ts         # round-trip with/without new fields; unknown-value fallback
├── exportGeometry.test.ts        # EdgePath carries thickness/direction
├── exportComponentCode.test.ts   # generated code contains classes + reversed animation rule
└── exportSvg.test.ts             # SVG carries classes + animation-direction rule
```

**Structure Decision**: Existing single-project layout. `edgeStyle.ts` is the
one pure home for the closed vocabularies and the step→width map (same
pattern as `handleSides.ts` from 002). `EdgeToolbar.tsx` keeps the selection
UI out of `HeatEdge.tsx`'s path logic; `useDiagramMutations.ts` is the
mandated App.tsx diet.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| App.tsx at 386 lines (pre-existing, from 002) | Not needed — being fixed here: mutation callbacks (rename, kind, image, edge variant/delete, plus the new thickness/direction) move to `useDiagramMutations.ts`, landing App.tsx under 300 | Leaving it and justifying in the PR was rejected: 003 adds more wiring, so without extraction the file drifts further from the cap |
