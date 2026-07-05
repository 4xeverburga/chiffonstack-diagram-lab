# Implementation Plan: Layout Helpers

**Branch**: `006-layout-helpers` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-layout-helpers/spec.md`

## Summary

A single editor-ergonomics helper, operating purely on node `position`
(already canonical, already exported): alignment guides that appear while
dragging a node and gently snap it when an edge or center lines up with a
nearby node, escapable by threshold or a modifier key. Guide detection
reads actual rendered bounds (`node.measured` — already populated by React
Flow, already used for image-fitted/resized nodes), so mixed node sizes
line up correctly. Nothing is added to the diagram JSON or any export
target — this is canvas-only geometry, isolated in a new pure module and a
thin coordinating hook. No multi-selection, align, or distribute actions
are introduced — deliberately dropped from the original three-part scope
(see research.md R0) to avoid the bugs a new multi-select UI/model would
risk, for a single drag interaction that alone delivers most of the value.
No undo is introduced either: a snap only changes `position`, a low-risk
and immediately-repeatable action, and no other mutation in the app is
undoable today — see research.md R2.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19

**Primary Dependencies**: `@xyflow/react` (React Flow 12) only — no new
runtime dependency. Uses `onNodeDrag`/`onNodeDragStop` (not currently wired
in `App.tsx`) and each node's `measured.width`/`measured.height` (already
populated by React Flow and already relied on by `imageFit`/`LabelNode`)

**Storage**: N/A — no new persisted data; only `node.position` changes,
already part of the canonical diagram JSON (001)

**Testing**: Vitest unit tests for the pure geometry (`computeGuides`);
drag feel, guide rendering, and snap escape are covered by the manual
quickstart gate (constitution: UI shell isn't unit-tested)

**Target Platform**: Existing Vite SPA, same canvas

**Project Type**: Single project (no change)

**Performance Goals**: Guide computation is O(n) per drag frame against
the other nodes; SC-003 requires no perceptible lag at 50 nodes — O(n) at
that scale is trivially fast, no spatial indexing needed

**Constraints**: Zero changes to the diagram JSON shape (FR-005); new
files stay under the ~250-line soft cap; `App.tsx` (261 lines, already
near the 300 cap) gains only wiring, not logic — all algorithmic and
state-tracking code lives in new modules/hooks; no new selection UI/model
(explicitly rejected — see research.md R0)

**Scale/Scope**: ~3 new source files (1 pure geometry module, 1
coordinating hook, 1 guide-overlay component), `App.tsx` wiring, 1 new
test file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Evaluation | Status |
|---|---|---|
| I. Export Fidelity Is the Product | Only `node.position` changes, via the same `setNodes` path every other mutation already uses; positions are already canonical and already honored by every export target. Nothing new to export. | PASS |
| II. Minimal Design-Token Contract | Guide lines are editor chrome, not exported — no new token, no variant. | PASS |
| III. Open Source & Self-Contained | No new dependency; pure client-side geometry only, nothing persisted or sent to a service. | PASS |
| IV. Contributor-Legible Codebase | Guide math is pure and unit-tested (`layout.ts`); `useLayoutHelpers.ts` is the thin imperative-shell hook wiring drag events and keyboard-modifier state to it — `App.tsx` only mounts the hook and renders its overlay output, keeping it under cap. | PASS |
| V. Export Targets & Portability | No export-target changes; positions already flow through the existing geometry/export pipeline for JSON, component, and SVG tracks. | PASS |

**Post-design re-check (Phase 1)**: PASS — no new persisted fields, no new
tokens, no new dependency, no new selection model or interaction-model
state beyond the drag the app already has.

## Project Structure

### Documentation (this feature)

```text
specs/006-layout-helpers/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── layout-helpers.md
└── tasks.md              # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.tsx                       # Wires useLayoutHelpers; renders <AlignmentGuides> overlay; adds onNodeDrag/onNodeDragStop to <ReactFlow>
└── lab/
    ├── layout.ts                  # NEW — pure: computeGuides(dragged, others, opts) → {guides, position}
    ├── useLayoutHelpers.ts        # NEW — imperative shell: tracks drag-in-progress guides/snap and modifier-key state, calls setNodes
    └── AlignmentGuides.tsx        # NEW — renders the current guide lines (flow-space overlay) during a drag; nothing when idle

test/lab/
└── layout.test.ts                 # NEW — guide detection + snap on all 6 comparison values, nearest-alignment-wins, mixed node sizes
```

**Structure Decision**: Existing single-project layout. All new logic is
either pure (`layout.ts`, unit-tested) or isolated in a new hook/component;
`App.tsx` only adds wiring calls, keeping it within the file-size
discipline the constitution already flags as tight.

## Complexity Tracking

No violations, nothing to justify — the feature adds only pure geometry
and a thin coordinating hook, with no new persisted state, dependency,
selection model, or app-wide mechanism.

