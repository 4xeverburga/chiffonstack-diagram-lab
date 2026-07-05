# Implementation Plan: Node Connection Handles

**Branch**: `002-node-connection-handles` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-node-connection-handles/spec.md`

## Summary

Replace the fixed 2-handle layout (target-left, source-right) in `LabelNode`
with four side handles (top, bottom, left, right), each able to originate and
receive edges via React Flow's loose connection mode. Handle choices persist
as `sourceHandle`/`targetHandle` on the canonical edge JSON, flow through all
three export targets (JSON, React Flow component code, animated SVG) via the
shared geometry module, and default to the legacy right→left pair when absent
so old JSON imports unchanged. Handle visibility is interaction-scoped
(hover / selection / connection drag), implemented with CSS plus a small
selection-derived class, so the canvas stays clean at rest.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `@xyflow/react` (React Flow 12) — already the canvas engine; no new dependencies

**Storage**: N/A (canonical diagram JSON, serialized/parsed by `exportDiagram.ts`)

**Testing**: Vitest unit tests under `test/lab/` for all pure logic; manual round-trip gate for UI

**Target Platform**: Static Vite SPA (any static host); exports must render in consumer React apps and plain `<img>` tags

**Project Type**: Single-page web app with functional-core export modules

**Performance Goals**: No perceptible interaction lag; handle visibility is CSS-driven (no per-frame JS)

**Constraints**: Diagram JSON backward compatible; exports deterministic; files under ~250 lines (300 hard split)

**Scale/Scope**: 6 source files touched, 1 new hook, ~4 test files extended

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Export Fidelity Is the Product | `sourceHandle`/`targetHandle` ship in the same change across JSON round-trip, component code, and SVG geometry. Legacy JSON defaults to right→left (documented mapping, no silent drift). Handles themselves are editor chrome and are never rendered in exports (spec assumption). | PASS |
| II. Minimal Design-Token Contract | No new tokens. No new styling surface — handle sides are structure, not style; visibility styling lives in editor CSS only. | PASS |
| III. Open Source & Self-Contained | No backend, no new dependency; JSON shape gains two optional string fields, documented in the contract. | PASS |
| IV. Contributor-Legible Codebase | Geometry stays pure in `exportGeometry.ts` (side → anchor point is a pure function, unit-tested). Edge-selection→node-visibility derivation extracted to a hook so `App.tsx` (301 lines) does not grow past the cap — it must shed lines. No default parameter values. | PASS (requires the App.tsx extraction noted below) |
| V. Export Targets & Portability | All targets keep consuming the same canonical JSON; the shared `computeEdgePaths` is the single place side-anchoring math lives, so code/SVG cannot drift. | PASS |

**Post-design re-check (Phase 1)**: PASS — data-model.md adds only optional,
backward-compatible fields; contracts document the legacy default mapping;
no complexity-tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-node-connection-handles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── edge-attachments.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.tsx                       # onConnect captures handles; passes handle-visibility set; sheds lines to the new hook
├── App.css                       # Handle visibility rules (hidden at rest; hover/selected/connecting)
└── lab/
    ├── LabelNode.tsx             # 4 handles (Top/Bottom/Left/Right) with stable ids
    ├── handleSides.ts            # NEW — side vocabulary, legacy defaults, side→Position/anchor helpers (pure)
    ├── useHandleVisibility.ts    # NEW — derives which nodes show handles from selection state
    ├── exportDiagram.ts          # serialize + parse sourceHandle/targetHandle with fallbacks
    ├── exportGeometry.ts         # computeEdgePaths honors per-edge sides via handleSides helpers
    ├── exportComponentCode.ts    # generated component renders the same 4 handles + loose mode
    └── exportSvg.ts              # unchanged consumer of computeEdgePaths (verify only)

test/lab/
├── handleSides.test.ts           # NEW — side vocabulary, defaults, anchor math
├── exportDiagram.test.ts         # round-trip with/without handles; unknown-value fallback
├── exportGeometry.test.ts        # paths for representative side combinations
├── exportComponentCode.test.ts   # generated code carries sourceHandle/targetHandle + handles markup
└── exportSvg.test.ts             # SVG paths reflect sides (via geometry)
```

**Structure Decision**: Existing single-project layout. Two new small modules
(`handleSides.ts` pure core, `useHandleVisibility.ts` shell hook) keep
`App.tsx` and `LabelNode.tsx` under the file-size cap and keep the side→anchor
math in exactly one pure, testable place.

## Complexity Tracking

No constitution violations — table intentionally empty.
