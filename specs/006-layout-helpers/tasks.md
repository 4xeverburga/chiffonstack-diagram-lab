# Tasks: Layout Helpers

**Input**: Design documents from `/specs/006-layout-helpers/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/layout-helpers.md](./contracts/layout-helpers.md), [quickstart.md](./quickstart.md)

**Tests**: Included — the constitution requires unit tests for all pure logic (`layout.ts`); the UI shell (hook + overlay) is covered by the manual quickstart gate instead, per the constitution's functional-core/imperative-shell testing split.

**Organization**: This feature has a single user story (US1 — Snap Guides While Dragging; US2/US3 were cut, see [research.md](./research.md) R0), so almost everything lives in one phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (the only user story in this feature)
- Paths are exact, relative to the repo root (`diagram-lab/`)

---

## Phase 1: Setup

**Purpose**: Confirm the ground this feature builds on before writing code

- [ ] T001 Confirm no new dependency is needed: `@xyflow/react` (already installed) exposes `onNodeDrag`/`onNodeDragStop` props on `<ReactFlow>` and populates `node.measured.width`/`.height` — verify by grepping `node_modules/@xyflow/react/dist/esm/index.js` for `onNodeDrag`, no `package.json` change expected

---

## Phase 2: Foundational

*(none — a single-story feature has no shared prerequisite beyond the story's own pure module; skip straight to Phase 3)*

---

## Phase 3: User Story 1 - Snap Guides While Dragging (Priority: P1) 🎯 MVP

**Goal**: While dragging a node, show alignment guides and gently snap it when an edge or center lines up with a nearby node; release past a threshold or with a modifier key held; no guides at rest.

**Independent Test**: Place two nodes, drag a third slowly past alignment with each — guides appear at edge/center alignments, the node snaps, dragging beyond the threshold releases it, holding `Alt` disables it entirely, and at rest no guides are visible.

### Tests for User Story 1 ⚠️

> Write these first; they must fail (module doesn't exist yet) before implementation.

- [ ] T002 [P] [US1] Unit tests for `computeGuides` in `test/lab/layout.test.ts`: six comparison values per axis (left/centerX/right, top/centerY/bottom), nearest-match-wins when several are in range, exact threshold boundary (`<=` vs `>`), no match when `others` is empty or `thresholdFlow <= 0`, mixed-size rects (per [contracts/layout-helpers.md](./contracts/layout-helpers.md)), and that `dragged`/`others` are never mutated

### Implementation for User Story 1

- [ ] T003 [US1] Implement `Rect`, `Guide`, `SnapResult` types and the pure `computeGuides(dragged, others, thresholdFlow)` function in `src/lab/layout.ts` (per [data-model.md](./data-model.md)), making T002 pass
- [ ] T004 [US1] Implement `useLayoutHelpers` hook in `src/lab/useLayoutHelpers.ts`: wraps `onNodeDrag`/`onNodeDragStop`, converts the screen-space `SNAP_THRESHOLD_PX` constant to flow-space using the current viewport zoom before calling `computeGuides` (research.md R3), skips guide computation entirely when the drag event's `altKey` is set (research.md R4), applies the returned snapped `position` via `setNodes` on drag, clears active guides on drag stop, and exposes the current `Guide[]` for rendering (depends on T003)
- [ ] T005 [US1] Implement `AlignmentGuides.tsx` in `src/lab/AlignmentGuides.tsx`: renders the hook's current guides as lines via React Flow's `EdgeLabelRenderer` portal so they track pan/zoom (research.md R5), rendering nothing when there are no active guides (depends on T004)
- [ ] T006 [US1] Add guide-line styling in `src/App.css` (thin, low-opacity accent-colored lines consistent with existing editor chrome — not exported, editor-only per the Constitution Check)
- [ ] T007 [US1] Wire `useLayoutHelpers` and `<AlignmentGuides>` into `src/App.tsx`: pass `onNodeDrag`/`onNodeDragStop` to `<ReactFlow>` and mount the overlay alongside it, keeping `App.tsx`'s own body to wiring only (no algorithmic code) (depends on T004, T005, T006)

**Checkpoint**: Dragging any node near another now shows guides and snaps, escapable by threshold or `Alt`, invisible at rest — the full feature, independently testable via the quickstart.

---

## Final Phase: Polish & Verification

**Purpose**: Constitution-mandated quality gates before this feature is considered done

- [ ] T008 Run `npm run lint`, `npm run build`, and `npx vitest run` — all three must pass clean
- [ ] T009 Manual round-trip gate from [quickstart.md](./quickstart.md): drag-snap near a mixed-size diagram (including an image-fitted node from 005) → export JSON → re-import → visual parity; component and SVG exports match the canvas; try 50+ nodes to confirm no perceptible drag lag (SC-003)
- [ ] T010 [P] Check line counts (`wc -l`) of `src/lab/layout.ts`, `src/lab/useLayoutHelpers.ts`, `src/lab/AlignmentGuides.tsx`, and the modified `src/App.tsx` against the constitution's ~250-line soft cap / 300-line hard cap

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Skipped (single-story feature)
- **User Story 1 (Phase 3)**: Depends on Setup (T001) only
- **Polish (Final Phase)**: Depends on User Story 1 (Phase 3) being complete

### Within User Story 1

- T002 (tests) before T003 (implementation) — tests must fail first
- T003 before T004 (`useLayoutHelpers` calls `computeGuides`)
- T004 before T005 (`AlignmentGuides` renders the hook's guide state)
- T004, T005, T006 before T007 (`App.tsx` wiring needs the hook, the overlay component, and its styling)

### Parallel Opportunities

- T001 and T002 can run in parallel (independent: environment check vs. writing tests against the documented contract)
- T010 can run in parallel with nothing else remaining, but is independent of T008/T009's outcomes (pure line counting)

---

## Parallel Example: User Story 1

```bash
# T001 and T002 have no dependency on each other and can be done together:
Task: "Confirm @xyflow/react exposes onNodeDrag/onNodeDragStop and node.measured (T001)"
Task: "Write computeGuides unit tests in test/lab/layout.test.ts (T002)"

# T003 → T004 → T005 → T007 is a strict chain (each depends on the previous);
# T006 (CSS) can be done any time before T007.
```

---

## Implementation Strategy

**MVP = the whole feature** (single user story): complete Phase 1 → Phase 3 → Final Phase in order. There is no incremental multi-story rollout for this feature since US2/US3 were cut from scope (research.md R0) — T001 through T010 constitute the entire delivery.
