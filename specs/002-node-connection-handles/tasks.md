---

description: "Task list for Node Connection Handles"

---

# Tasks: Node Connection Handles

**Input**: Design documents from `/specs/002-node-connection-handles/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/edge-attachments.md](./contracts/edge-attachments.md)

**Tests**: Included — this project extends existing Vitest suites for every pure module touched (see [test/lab/](../../test/lab/)); there is no component-rendering test harness (no React Testing Library), so UI wiring (`LabelNode.tsx`, `App.tsx`, `App.css`) is verified via the manual quickstart gate instead.

**Organization**: Tasks are grouped by user story (spec.md priorities: US1 P1, US2 P2, US3 P1, US4 P2) so each can be delivered and verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths are exact and relative to the repository root

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: The single shared vocabulary every user story consumes — side names, legacy defaults, and side→Position/anchor math. Nothing below can start until this exists.

- [x] T001 Create `src/lab/handleSides.ts`: `HANDLE_SIDES` const array + derived `HandleSide` type ("top" | "bottom" | "left" | "right"), `isHandleSide` type guard, `LEGACY_SOURCE_SIDE = "right"` / `LEGACY_TARGET_SIDE = "left"` constants, a side→`Position` map (for `LabelNode`/generated component), and a pure helper that returns the anchor point + `Position` on a `NodeBox` for a given side (for `exportGeometry.ts`)
- [x] T002 [P] Add `test/lab/handleSides.test.ts`: covers `HANDLE_SIDES`/`isHandleSide`, the legacy default constants, and the anchor-point helper for all four sides against a sample `NodeBox`

**Checkpoint**: Foundation ready — user story work can begin.

---

## Phase 2: User Story 1 - Connect Edges on Any Side (Priority: P1) 🎯 MVP

**Goal**: Every node exposes four connection points, each able to both originate and receive an edge; edges attach to the exact sides dragged and keep that attachment when nodes move.

**Independent Test**: Place two nodes on the canvas and create four edges between them using different side combinations (e.g. left→top, bottom→right); confirm each edge visibly departs/arrives at the chosen sides and stays put after moving a node.

### Implementation for User Story 1

- [x] T003 [US1] In `src/lab/LabelNode.tsx`, replace the two fixed `Handle` elements with four `Handle type="source"` elements (ids `"top"`, `"bottom"`, `"left"`, `"right"`), positioned via `handleSides.ts`'s side→`Position` map
- [x] T004 [US1] In `src/App.tsx`, set `connectionMode="loose"` on `<ReactFlow>` and add an `isValidConnection` that rejects a connection where `source === target` (self-loop, per research.md R6)
- [x] T005 [US1] In `src/App.tsx`, verify `onConnect` forwards the dragged connection's `sourceHandle`/`targetHandle` onto the new edge unchanged (the current `addEdge({ ...connection, ... })` spread already carries them — confirm no field is stripped and add a short comment recording this invariant)

**Checkpoint**: User Story 1 is fully functional — any side can connect to any side, verified manually per the Independent Test above.

---

## Phase 3: User Story 3 - Attachments Survive Export and Import (Priority: P1)

**Goal**: `sourceHandle`/`targetHandle` round-trip through the canonical JSON and are honored identically by the component-code export and the animated SVG export.

**Independent Test**: Build a diagram using at least three distinct side combinations, export the diagram JSON, clear the canvas, re-import, and confirm every edge is attached to its original sides; export component code and the animated image and confirm the rendered edges depart/arrive on the same sides as the canvas.

### Implementation for User Story 3

- [x] T006 [US3] In `src/lab/exportDiagram.ts`, extend `toPlainDiagram` to serialize each edge's `sourceHandle`/`targetHandle`
- [x] T007 [US3] In `src/lab/exportDiagram.ts`, extend `parsePlainEdge` to validate `sourceHandle`/`targetHandle` against `HANDLE_SIDES` (from `handleSides.ts`), falling back to `LEGACY_SOURCE_SIDE`/`LEGACY_TARGET_SIDE` independently per endpoint when a field is missing or unrecognized (depends on T001, T006)
- [x] T008 [P] [US3] Extend `test/lab/exportDiagram.test.ts`: a round-trip test covering 3+ distinct side combinations, and a test asserting each endpoint falls back to its own legacy default independently when the other endpoint's value is valid
- [x] T009 [US3] In `src/lab/exportGeometry.ts`, extend `computeEdgePaths` to read each edge's `sourceHandle`/`targetHandle` (via the T001 helper, defaulting through `parsePlainEdge`'s resolved values) and anchor/position the bezier path on the matching side of each node's box, replacing the hardcoded right→left pair (depends on T001)
- [x] T010 [P] [US3] Extend `test/lab/exportGeometry.test.ts` with cases spanning multiple side combinations, asserting the computed path's endpoint coordinates land on the expected side of each node's box
- [x] T011 [US3] In `src/lab/exportComponentCode.ts`, update the generated `DiagramLabelNode`/CSS to render the same four handles (ids matching `handleSides.ts`, hidden via generated CSS) and give the generated `<ReactFlow>` `connectionMode="loose"` (depends on T001, T003)
- [x] T012 [P] [US3] Extend `test/lab/exportComponentCode.test.ts` asserting the generated `tsx` includes all four handle ids and `connectionMode="loose"`
- [x] T013 [P] [US3] Extend `test/lab/exportSvg.test.ts` asserting exported edge paths reflect each edge's recorded side attachments for a non-default side combination (via the updated `computeEdgePaths`)

**Checkpoint**: Side attachments now flow, unbroken, through JSON, component code, and SVG exports.

---

## Phase 4: User Story 2 - Distraction-Free Canvas (Priority: P2)

**Goal**: Connection points stay invisible at rest and appear only while hovering a node, dragging a new connection, or while a node or one of its connected edges is selected.

**Independent Test**: Load a diagram with several nodes, confirm no connection points are visible at rest, then hover a node, select a node, select an edge, and drag a new connection — confirming points appear in each case and disappear afterward.

### Implementation for User Story 2

- [x] T014 [US2] Create `src/lab/useHandleVisibility.ts`: a pure function that derives the set of node ids whose handles should be visible from the current selection (selected node ids, plus both endpoint ids of every selected edge), wrapped in a small hook that memoizes it over `nodes`/`edges`/`selection`
- [x] T015 [P] [US2] Add `test/lab/useHandleVisibility.test.ts` for the pure function: empty selection → empty set; selected node → that node's id; selected edge → both endpoint ids; overlapping selections dedupe
- [x] T016 [US2] In `src/App.tsx`, wire `useHandleVisibility` in: apply a `"handles-visible"` class to nodes in the derived set, and toggle a `"connecting"` class on the canvas wrapper via `onConnectStart`/`onConnectEnd` (depends on T014)
- [x] T017 [US2] In `src/App.css`, add handle-visibility rules: handles hidden by default (`opacity: 0`, pointer events retained so a hover-then-drag still works), revealed by `.react-flow__node:hover`, `.react-flow__node.selected`, `.react-flow__node.handles-visible`, and `.lab-canvas.connecting` (per research.md R4)

**Checkpoint**: Canvas is clean at rest; handles appear only during the interactions above, verified manually per the Independent Test.

---

## Phase 5: User Story 4 - Old Diagrams Keep Working (Priority: P2)

**Goal**: Diagram JSON exported before this feature (no `sourceHandle`/`targetHandle` fields) imports without error, with every edge assigned the legacy right→left sides; re-exporting makes those sides explicit.

**Independent Test**: Take a diagram JSON exported before this feature, import it, confirm it loads cleanly with all edges attached to the legacy right→left sides, then re-export and confirm the JSON now carries explicit sides.

### Implementation for User Story 4

- [x] T018 [P] [US4] Add a pre-feature diagram fixture (edges with no `sourceHandle`/`targetHandle` fields) to `test/lab/fixtures/kitchenSink.ts` or a new `test/lab/fixtures/legacyDiagram.ts`
- [x] T019 [US4] Extend `test/lab/exportDiagram.test.ts`: importing the legacy fixture assigns `sourceHandle: "right"` / `targetHandle: "left"` to every edge (FR-007), and re-serializing the parsed result emits those sides explicitly (FR-004, US4 scenario 2) — depends on T007, T018

**Checkpoint**: All four user stories are independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification across all stories.

- [x] T020 [P] Review [quickstart.md](./quickstart.md) against the finished behavior and correct any step whose wording no longer matches (e.g. handle ids, CSS class names)
- [x] T021 Run `npm run lint`, `npm run build`, and `npm test`; fix any resulting issues
- [x] T022 Manually execute the quickstart.md round-trip gate: export JSON → re-import → visual parity; render the component export in a bare app; open the SVG both directly and via `<img>` — confirm edge anchoring matches the canvas everywhere

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: No dependencies — start immediately. **BLOCKS** all user stories (every story consumes `handleSides.ts`).
- **User Story 1 (Phase 2, P1)**: Depends only on Foundational.
- **User Story 3 (Phase 3, P1)**: Depends on Foundational; depends on User Story 1's `LabelNode.tsx` handle ids (T003) for the component-code export task (T011) to mirror the same ids, but its JSON/geometry tasks (T006–T010) can start as soon as Foundational is done.
- **User Story 2 (Phase 4, P2)**: Depends only on Foundational — independent of US1/US3's export work, though it reads the same `nodes`/`edges`/`selection` already in `App.tsx`.
- **User Story 4 (Phase 5, P2)**: Depends on User Story 3's `parsePlainEdge` fallback logic (T007) — it only adds fixtures/tests for behavior already implemented there.
- **Polish (Phase 6)**: Depends on all four user stories being complete.

### Within Each User Story

- Foundational helpers before story-specific implementation
- Production code before its extended tests (tests are additive to existing suites, not written test-first, since this feature extends established modules rather than introducing new contracts)
- `LabelNode.tsx`/`App.tsx` wiring before the component-code export that mirrors it

### Parallel Opportunities

- T002 (Foundational test) can run alongside starting US1/US2/US3 planning, but logically follows T001.
- Within US3: T008, T010, T012, T013 (all test-file edits) can run in parallel once their corresponding implementation tasks (T006/T007, T009, T011) land.
- Within US2: T015 can run in parallel with T016/T017 once T014 lands.
- T018 (US4 fixture) can be authored in parallel with any US3 task.
- T020 (quickstart review) can run in parallel with T021.

---

## Parallel Example: User Story 3

```bash
# Once T006/T007 (exportDiagram.ts) and T009 (exportGeometry.ts) and T011 (exportComponentCode.ts) are done:
Task: "Extend test/lab/exportDiagram.test.ts with round-trip + per-endpoint fallback cases"
Task: "Extend test/lab/exportGeometry.test.ts with multi-side anchor assertions"
Task: "Extend test/lab/exportComponentCode.test.ts asserting four handle ids + loose mode"
Task: "Extend test/lab/exportSvg.test.ts asserting side-aware paths"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Foundational (`handleSides.ts`)
2. Complete Phase 2: User Story 1 — four connectable handles per node
3. **STOP and VALIDATE**: manually connect all 16 side combinations between two nodes
4. Demo if ready — the canvas already looks and behaves like the finished feature, minus export fidelity and hover-only visibility

### Incremental Delivery

1. Foundational → User Story 1 (MVP: any side connects to any side)
2. User Story 3 (exports stay trustworthy — JSON/component/SVG all honor sides)
3. User Story 2 (canvas returns to distraction-free at rest)
4. User Story 4 (legacy JSON keeps working — mostly test coverage on already-built fallback logic)
5. Polish (lint/build/test + manual quickstart gate)

### Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] labels map every user-story-phase task back to spec.md for traceability
- No new dependencies are introduced (plan.md Technical Context) — there is no separate Setup phase
- Commit after each task or logical group
