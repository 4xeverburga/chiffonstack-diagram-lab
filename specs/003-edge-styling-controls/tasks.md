# Tasks: Edge Styling Controls

**Input**: Design documents from `/specs/003-edge-styling-controls/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/edge-style.md

**Tests**: Included — the constitution mandates unit tests for all pure logic (vocabularies, serialization, export generation).

**Organization**: Tasks are grouped by user story. US1 (thickness), US2 (reverse), US3 (selection-scoped toolbar), US4 (export fidelity).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create feature branch `003-edge-styling-controls` from up-to-date `main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure vocabulary module, the serialization contract, and the App.tsx extraction every story's callbacks depend on.

- [x] T002 Create `src/lab/edgeStyle.ts`: `EDGE_THICKNESSES` / `EdgeThickness`, `EDGE_DIRECTIONS` / `EdgeDirection`, `DEFAULT_THICKNESS`, `DEFAULT_DIRECTION`, `THICKNESS_STROKE_WIDTH = { thin: 1.5, normal: 2.5, thick: 4 }`, `nextThickness(current: EdgeThickness): EdgeThickness` (cycle thin→normal→thick→thin), `edgeStyleClassNames(variant, thickness, direction, prefix)` helper returning the class list (data-model.md "Rendering contract")
- [x] T003 [P] Create `test/lab/edgeStyle.test.ts`: vocabulary completeness, cycle order wraps, width map covers every step, class-name builder output for all variant/thickness/direction combos incl. prefix handling
- [x] T004 Extend `src/lab/exportDiagram.ts`: `parsePlainEdge` whitelists `data` to exactly `{ variant, thickness, direction }` with tolerant fallbacks (`normal`, `forward`) mirroring the variant pattern; `toPlainDiagram` keeps serializing `edge.data` but strips non-whitelisted keys so runtime-injected fields (primaryColor, callbacks) never reach JSON (contracts/edge-style.md guarantees 2, 3, 5)
- [x] T005 [P] Extend `test/lab/exportDiagram.test.ts`: round-trip preserves thickness/direction; legacy edge (no fields) parses to defaults; unknown values fall back per-field; injected runtime keys stripped from serialized output; re-export after import emits explicit values
- [x] T006 Create `src/lab/useDiagramMutations.ts` extracting from `src/App.tsx` the existing mutation callbacks (`handleRenameNode`, `handleSetNodeKind`, `handleSetNodeImage`, `handleSetEdgeVariant`, `handleDeleteEdge`) into one hook taking `setNodes`/`setEdges` explicitly (no default parameters); rewire `App.tsx` and verify `wc -l src/App.tsx` < 300 (plan.md Complexity Tracking)

**Checkpoint**: `npm run lint && npm test` green; canvas behavior unchanged.

---

## Phase 3: User Story 1 - Adjust Edge Thickness (Priority: P1) 🎯 MVP

**Goal**: Selecting an edge exposes a quick action that cycles thin → normal → thick; the value persists in edge state.

**Independent Test**: Create three edges, set one to each step via the quick action, deselect — the three render visibly different and keep their step.

- [x] T007 [US1] Add `cycleEdgeThickness(id)` and `setEdgeThickness(id, thickness)` to `src/lab/useDiagramMutations.ts` using `nextThickness` from `src/lab/edgeStyle.ts`
- [x] T008 [US1] Update `src/lab/HeatEdge.tsx`: read `data.thickness`/`data.direction`, build className via `edgeStyleClassNames(variant, thickness, direction, 'lab-edge')`; update `src/App.css`: move `stroke-width` declarations out of the variant rules into `.lab-edge-w-thin/normal/thick` rules using the shared map's values
- [x] T009 [US1] Create `src/lab/EdgeToolbar.tsx`: floating toolbar rendered via `EdgeLabelRenderer` at the bezier midpoint (`labelX`/`labelY` from `getBezierPath`), shown only when `selected`; thickness button cycles via callback injected through `edge.data` (research.md R4); mount it from `src/lab/HeatEdge.tsx`
- [x] T010 [US1] Wire callbacks in `src/App.tsx`: inject `onCycleThickness` into `renderedEdges` beside `primaryColor`; add toolbar button styling to `src/App.css` (small, canvas-chrome look, usable at any zoom)
- [x] T011 [US1] Add thickness chips (thin / normal / thick) to the edge pane in `src/lab/Inspector.tsx`, wired to `setEdgeThickness` (research.md R7)

**Checkpoint**: US1 fully functional — thickness cycles from toolbar and Inspector, persists across deselection.

---

## Phase 4: User Story 2 - Reverse Flow Animation (Priority: P1)

**Goal**: One click reverses a heat-flow edge's animation without touching endpoints or attachments.

**Independent Test**: Create a heat-flow edge, reverse it — animation travels the opposite way, endpoints/handles unchanged; reverse again — original direction.

- [x] T012 [US2] Add `reverseEdgeDirection(id)` to `src/lab/useDiagramMutations.ts` (flips forward⇄reverse; never touches source/target/handles — FR-004)
- [x] T013 [US2] Add `.lab-edge-reverse { animation-direction: reverse; }` to `src/App.css` (class already emitted by T008's builder); verify inert on non-animated variants
- [x] T014 [US2] Add the reverse button to `src/lab/EdgeToolbar.tsx`, rendered only when `variant === 'heat-flow'` (research.md R6); inject `onReverseDirection` through `renderedEdges` in `src/App.tsx`
- [x] T015 [US2] Add a direction toggle (forward / reverse) to the edge pane in `src/lab/Inspector.tsx`, shown only for heat-flow edges, wired to `reverseEdgeDirection`

**Checkpoint**: US1 + US2 both work; direction survives variant round-trips (stored inertly on non-animated variants).

---

## Phase 5: User Story 3 - Quick Actions Appear Only on Selection (Priority: P2)

**Goal**: Zero edge controls at rest; toolbar appears adjacent to the selected edge, follows selection, disappears on deselect.

**Independent Test**: With many edges, nothing is visible at rest; select an edge → buttons at its midpoint; select another → buttons move; click empty canvas → gone; works at any pan/zoom.

- [x] T016 [US3] Verify/adjust `src/lab/EdgeToolbar.tsx` + `src/App.css`: toolbar only renders when `selected` (no residual DOM when not), `pointer-events: all` on buttons, `transform: translate(-50%, -50%)` positioning at the midpoint, offset so it doesn't cover very short edges (spec edge case), keyboard-focusable buttons with `aria-label`s
- [x] T017 [US3] Manual check + fix pass for boundary cases: edge near canvas edge stays reachable via pan (EdgeLabelRenderer tracks viewport); multi-select of edges shows toolbar only for single selection (guard in `src/lab/HeatEdge.tsx` if React Flow reports multiple selected)

**Checkpoint**: All three interactive stories work; canvas is clean at rest.

---

## Phase 6: User Story 4 - Styling Survives Export and Import (Priority: P1)

**Goal**: Thickness and direction render identically in the component-code export and the animated SVG, and round-trip through JSON (JSON round-trip itself landed in T004/T005).

**Independent Test**: Build a diagram with all three thicknesses and one reversed heat-flow edge; JSON round-trips; component export and SVG match the canvas visually, including reversed animation.

- [x] T018 [US4] Extend `src/lab/exportGeometry.ts`: `EdgePath` gains `thickness` and `direction` fields, populated in `computeEdgePaths` via the same defaults (`edgeStyle.ts`) so SVG markup stays a dumb consumer
- [x] T019 [P] [US4] Extend `test/lab/exportGeometry.test.ts`: EdgePath carries thickness/direction with defaults for legacy edges
- [x] T020 [US4] Extend `src/lab/exportSvg.ts`: per-path classes from `edgeStyleClassNames(variant, thickness, direction, 'edge')`; `<style>` block gains `.edge-w-*` stroke-width rules (values from `THICKNESS_STROKE_WIDTH`) and `.edge-reverse { animation-direction: reverse; }`; remove stroke-widths from variant rules
- [x] T021 [P] [US4] Extend `test/lab/exportSvg.test.ts`: emitted SVG contains the thickness classes and rules, reversed edge carries `edge-reverse`, reduced-motion block unchanged
- [x] T022 [US4] Extend `src/lab/exportComponentCode.ts`: generated `DiagramHeatEdge` builds classes from serialized `data.thickness`/`data.direction`; generated CSS gains the same `.edge-w-*` and `.edge-reverse` rules from the shared map; variant rules lose hardcoded stroke-widths
- [x] T023 [P] [US4] Extend `test/lab/exportComponentCode.test.ts`: generated tsx/css contain the classes and rules; plain edges in the snippet carry thickness/direction
- [x] T024 [US4] Update `test/lab/fixtures/kitchenSink.ts` to include a thin edge, a thick edge, and a reversed heat-flow edge so every export test exercises the new fields

**Checkpoint**: All four stories complete; exports and canvas agree.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T025 Run full gates: `npm run lint`, `npm run build`, `npm test`; confirm `wc -l` ≤ cap for every touched file (App.tsx < 300)
- [x] T026 Manual round-trip gate per constitution + quickstart.md: JSON export→import parity; component export in a bare app; SVG opened directly and via `<img>` — thickness and flow direction match the canvas everywhere

---

## Dependencies & Execution Order

- **Phase 2 blocks everything**: T002→(T003), T004→(T005), T006 independent of T002/T004 but must precede all story callbacks.
- **US1 (Phase 3)**: needs T002 (cycle/classes), T006 (hook). T008 before T009 (toolbar styles classes it toggles).
- **US2 (Phase 4)**: needs T008 (class builder in HeatEdge) and T009 (toolbar exists); otherwise independent of US1's chips.
- **US3 (Phase 5)**: refines T009's toolbar; needs US1 (and ideally US2) done to verify both buttons.
- **US4 (Phase 6)**: needs T002/T004 only — can run in parallel with Phases 3–5 (different files).
- **Polish**: last.

### Parallel Opportunities

- T003 ∥ T005 (different test files); T002 ∥ T006.
- Phase 6 (exports) ∥ Phases 3–5 (editor UI) — disjoint files.
- T019 ∥ T021 ∥ T023 after their implementation tasks.

## Implementation Strategy

MVP = Phase 2 + Phase 3 (thickness end-to-end in the editor). Then US2 (reverse), US3 (polish the toolbar), US4 (exports) — though per Constitution I, **do not merge** before Phase 6 is done: a canvas capability without its export representation is incomplete. Single-developer order: T001→T006, then 3→4→5→6→7.
