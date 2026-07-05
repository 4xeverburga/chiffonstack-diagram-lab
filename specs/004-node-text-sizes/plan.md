# Implementation Plan: Node Text Sizes

**Branch**: `main` (feature branch to be created at implementation) | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-node-text-sizes/spec.md`

## Summary

Add a closed text-size vocabulary — `small | normal | large`, default
`normal` — to node text. Today a node has exactly one text element (its
label, `data.label`), so the property is `data.labelSize` on the node; the
vocabulary is defined once in a new pure `textSizes.ts` module that also
owns the per-step font pixel size, the auto-size character-width factor,
and the node-height/label-band values the sizing heuristic needs. All node
text keeps rendering with the body font token — no heading concept. The
size is chosen from the Inspector's node pane, serialized in the canonical
JSON with a tolerant fallback, and rendered by canvas CSS, the generated
component CSS, and the SVG `<style>` block via a shared
`node-label-<size>` class. The auto-size heuristic in `exportGeometry.ts`
scales with the chosen step so auto-sized nodes grow to fit; manually
resized nodes keep their dimensions (existing width/height semantics).

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `@xyflow/react` (React Flow 12); no new dependencies

**Storage**: Canonical diagram JSON (`exportDiagram.ts` serialize/parse)

**Testing**: Vitest unit tests under `test/lab/` (size map, sizing heuristic, serialization, export generation); manual round-trip gate for UI

**Target Platform**: Static Vite SPA; exports render in consumer React apps and plain `<img>` tags

**Project Type**: Single-page web app with functional-core export modules

**Performance Goals**: Size is a CSS class — no measurement or per-frame JS; auto-size math stays a pure function

**Constraints**: Closed vocabulary only (no numeric font size in UI or JSON); backward-compatible JSON; deterministic exports; body font token for all steps; files under ~250 lines

**Scale/Scope**: ~6 source files touched, 1 new pure module, ~4 test files extended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Export Fidelity Is the Product | `labelSize` ships in the same change across JSON round-trip, component code, and SVG. Legacy JSON defaults to `normal` (documented mapping). Auto-size heuristic and exports read the same size map, so canvas and exports stay pixel-consistent. | PASS |
| II. Minimal Design-Token Contract | No new tokens; every step renders with the existing `bodyFont` token. Size steps are closed vocabulary — the variant rule, not a style panel. `headingFont` is deliberately not applied to node text. | PASS |
| III. Open Source & Self-Contained | No backend, no dependency; JSON gains one optional enum field, documented in the contract. | PASS |
| IV. Contributor-Legible Codebase | All pixel values (font size, char width, node height, label band) move into one pure, unit-tested `textSizes.ts`; `exportGeometry.ts` consumes it instead of its own constants. The one new mutation callback rides the `useDiagramMutations.ts` extraction mandated by plan 003 (if 004 lands first, the callback goes straight into that new hook — App.tsx must not grow; it is over the cap at 386 lines). | PASS |
| V. Export Targets & Portability | Same canonical JSON for every target; one size map projected into canvas CSS, component CSS, and SVG CSS — no target-specific values. | PASS |

**Post-design re-check (Phase 1)**: PASS — one optional field with tolerant
parsing; sizing constants consolidated (a legibility improvement over
today's scattered `NODE_HEIGHT`/`CHAR_WIDTH`/`LABEL_BAND_HEIGHT`); no
complexity-tracking entries beyond the App.tsx note shared with 003.

## Project Structure

### Documentation (this feature)

```text
specs/004-node-text-sizes/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── node-text-size.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.css                       # .node-label-small/-large font-size rules for the canvas
└── lab/
    ├── textSizes.ts              # NEW — size vocabulary, default, per-step font px / char width / node height / label band (pure)
    ├── LabelNode.tsx             # applies node-label-<size> class from data.labelSize
    ├── Inspector.tsx             # size chips in the node pane (small / normal / large)
    ├── useDiagramMutations.ts    # setNodeLabelSize callback (module introduced by plan 003)
    ├── exportDiagram.ts          # parse/serialize data.labelSize with tolerant fallback
    ├── exportGeometry.ts         # auto-size heuristic reads per-step metrics from textSizes
    ├── exportComponentCode.ts    # generated node component + CSS render the size classes
    └── exportSvg.ts              # per-node text class + font-size rules from the shared map

test/lab/
├── textSizes.test.ts             # NEW — vocabulary, default, metric map completeness
├── exportDiagram.test.ts         # round-trip with/without labelSize; unknown-value fallback
├── exportGeometry.test.ts        # auto-size scales per step; manual size unaffected
├── exportComponentCode.test.ts   # generated code carries size classes + CSS rules
└── exportSvg.test.ts             # SVG text elements carry size classes + CSS rules
```

**Structure Decision**: Existing single-project layout. `textSizes.ts`
follows the established pure-vocabulary pattern (`heatVariants.ts`,
`handleSides.ts`, 003's `edgeStyle.ts`) and becomes the single home for
text-derived sizing constants that `exportGeometry.ts` currently hardcodes.

## Complexity Tracking

No new violations. The pre-existing App.tsx overage (386 > 300) is owned by
plan 003's `useDiagramMutations.ts` extraction; this feature adds its one
callback there, never to App.tsx directly.
