# Tasks: Node Text Sizes

**Input**: Design documents from `/specs/004-node-text-sizes/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/node-text-size.md

**Tests**: Included — the constitution mandates unit tests for all pure logic (vocabularies, serialization, export generation).

**Organization**: Tasks are grouped by user story. US1 (set size), US2 (export/import fidelity), US3 (reflow to fit).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 Create feature branch `004-node-text-sizes` from up-to-date `main`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure size vocabulary + metric map every story's code depends on.

- [x] T002 Create `src/lab/textSizes.ts`: `TEXT_SIZES = ["small", "normal", "large"]` const array + derived `TextSize` type, `DEFAULT_TEXT_SIZE = "normal"`, `TEXT_SIZE_METRICS: Record<TextSize, { fontPx: number; charWidth: number; nodeHeight: number; labelBand: number }>` with `normal` equal to today's hardcoded constants (`fontPx: 13, charWidth: 7.5, nodeHeight: 40, labelBand: 20`), `small: { fontPx: 11, charWidth: 6.5, nodeHeight: 36, labelBand: 18 }`, `large: { fontPx: 16, charWidth: 9.2, nodeHeight: 48, labelBand: 24 }`; export `resolveTextSize(value: unknown): TextSize` tolerant helper (unknown/missing → `DEFAULT_TEXT_SIZE`) per research.md R2/R5
- [x] T003 [P] Create `test/lab/textSizes.test.ts`: vocabulary has exactly 3 steps, default is `normal`, `TEXT_SIZE_METRICS` has a complete row for every step with positive values, `resolveTextSize` falls back to `normal` for `undefined`/unknown strings and passes through recognized values

**Checkpoint**: `npm run lint && npm test` green; no behavior change yet (module unused).

---

## Phase 3: User Story 1 - Set a Text Element's Size (Priority: P1) 🎯 MVP

**Goal**: Selecting a node exposes Size chips (small/normal/large); the label re-renders at that size immediately, keeps the body font, and retains its size across edits/deselection.

**Independent Test**: Create a node with two text elements... (single label per node today, per research.md R1) — create two nodes, set one label to large and one to small, confirm visibly different sizes using the same font, and that they keep their size after deselection.

- [x] T004 [US1] Add `setNodeLabelSize(id: string, size: TextSize)` to `src/lab/useDiagramMutations.ts`, spreading previous `data` like the existing mutations
- [x] T005 [US1] Update `src/lab/LabelNode.tsx`: resolve `data.labelSize` via `resolveTextSize` from `src/lab/textSizes.ts` and add a `node-label-<size>` class to the existing `.node-label` span (body font keeps coming from the unchanged base rule — FR-002)
- [x] T006 [US1] Add `.node-label-small` / `.node-label-large` `font-size` rules to `src/App.css` (values from `TEXT_SIZE_METRICS`; `normal` keeps rendering from the base `.node` rule, unchanged)
- [x] T007 [US1] Add Size chips (small / normal / large) to the node pane in `src/lab/Inspector.tsx`, next to the existing Style chips, wired to `setNodeLabelSize` (FR-003/SC-001: select + click = 2 interactions); wire the callback through `src/App.tsx`'s `Inspector` props

**Checkpoint**: US1 fully functional — size chips change the canvas label size immediately, body font unchanged, size survives deselection and label edits.

---

## Phase 4: User Story 2 - Sizes Survive Export and Import (Priority: P1)

**Goal**: A diagram mixing all three sizes round-trips through JSON exactly and renders proportionally identical sizes in the component-code and animated SVG exports.

**Independent Test**: Build a diagram using all three sizes, round-trip the JSON, confirm all sizes restore; render the component-code export and the animated SVG and confirm text sizes match the canvas proportionally; import pre-004 JSON and confirm it loads at normal size with no errors.

- [x] T008 [US2] Extend `src/lab/exportDiagram.ts`: `parsePlainNode` sets `data.labelSize` via `resolveTextSize(value.data.labelSize)` (missing/unrecognized → `"normal"`, never throws — FR-006); `toPlainDiagram` serializes `data.labelSize` from canvas state (explicit value on every re-export — normalization, consistent with 002/003)
- [x] T009 [P] [US2] Extend `test/lab/exportDiagram.test.ts`: round-trip preserves `labelSize` for all three steps; a legacy node (no `labelSize`) parses to `"normal"`; an unknown value falls back to `"normal"` without affecting the rest of the node; re-export after import emits an explicit `labelSize` on every node
- [x] T010 [US2] Extend `src/lab/exportComponentCode.ts`: generated `DiagramLabelNode` applies `node-label-<size>` from the plain node's `data.labelSize` (via `resolveTextSize`); generated CSS gains `.node-label-small` / `.node-label-large` `font-size` rules from `TEXT_SIZE_METRICS`; fix the generated `.node-label` rule's `font-family` to read `var(--token-body-font, sans-serif)` instead of `--token-heading-font` so the component export matches the body-font invariant already honored by the canvas and the SVG export (FR-002, contracts/node-text-size.md guarantee 5)
- [x] T011 [P] [US2] Extend `test/lab/exportComponentCode.test.ts`: generated tsx applies the size class per node; generated css defines the small/large font-size rules; `.node-label` rule uses the body-font token, not the heading-font token
- [x] T012 [US2] Extend `src/lab/exportSvg.ts`: each `<text class="node-label">` gains a `node-label-<size>` class (size resolved via `resolveTextSize(node.data.labelSize)`); `<style>` block gains `.node-label-small` / `.node-label-large` `font-size` rules from `TEXT_SIZE_METRICS`
- [x] T013 [P] [US2] Extend `test/lab/exportSvg.test.ts`: emitted SVG text elements carry the size class per node; style block contains the small/large font-size rules matching the metric map
- [x] T014 [US2] Update `test/lab/fixtures/kitchenSink.ts` to include a `small`-labeled node, a `large`-labeled node, and keep one node with no `labelSize` (legacy) so every export test exercises all three steps and the fallback

**Checkpoint**: US1 + US2 both work; JSON round-trips exactly; component code and SVG exports render size classes and the correct font-family everywhere.

---

## Phase 5: User Story 3 - Nodes Reflow to Fit Text (Priority: P2)

**Goal**: An auto-sized node grows/shrinks to fit its label's chosen size; a manually resized node keeps its fixed dimensions and the label wraps/ellipsizes within them (never silently overflows).

**Independent Test**: On an auto-sized node, cycle a label through small/normal/large and confirm the node grows/shrinks to fit each step with no clipping; on a manually resized node, confirm its dimensions stay fixed as the label size changes.

- [x] T015 [US3] Extend `src/lab/exportGeometry.ts`: replace the hardcoded `NODE_HEIGHT`/`CHAR_WIDTH` constants with per-node lookups into `TEXT_SIZE_METRICS` keyed by `resolveTextSize(node.data.labelSize)`; `nodeWidth`/`nodeHeight` take the resolved size and use its `charWidth`/`nodeHeight`; `computeNodeBoxes` resolves each node's size once and passes it through (manual `width`/`height` still win over the heuristic, unchanged)
- [x] T016 [P] [US3] Extend `test/lab/exportGeometry.test.ts`: an auto-sized node's computed width/height grows for `large` and shrinks for `small` relative to `normal`; a manually resized node's box dimensions are unaffected by its `labelSize`
- [x] T017 [US3] Extend `src/lab/exportSvg.ts`: replace the local hardcoded `LABEL_BAND_HEIGHT` constant with `TEXT_SIZE_METRICS[resolveTextSize(node.data.labelSize)].labelBand` so an image node's label band (and therefore its image area) scales with the chosen size, matching `exportGeometry.ts`'s per-step `labelBand`
- [x] T018 [P] [US3] Extend `test/lab/exportSvg.test.ts`: an image node's label band position/height scales with its `labelSize` (small vs. large) consistent with the node box height from `exportGeometry.ts`

**Checkpoint**: All three stories complete; auto-sized nodes reflow with no clipping; manual sizes stay fixed everywhere (canvas, component export, SVG export).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T019 Run full gates: `npm run lint`, `npm run build`, `npm test`; confirm every touched file stays under the constitution's ~250-line cap (`wc -l`)
- [x] T020 Manual round-trip gate per quickstart.md: size chips on the canvas; JSON export → re-import parity for all three steps + a pre-004 diagram; component export in a bare app; SVG opened directly and via `<img>` — text sizes match the canvas everywhere

---

## Dependencies & Execution Order

- **Phase 2 blocks everything**: T002 (module) → T003 (its tests); every later task imports `textSizes.ts`.
- **US1 (Phase 3)**: needs T002 only. T004 (mutation) and T005 (rendering)/T006 (CSS) are independent of each other; T007 (Inspector) wires T004.
- **US2 (Phase 4)**: needs T002 only — independent of Phase 3's UI files (disjoint files: exportDiagram.ts, exportComponentCode.ts, exportSvg.ts vs. LabelNode.tsx/Inspector.tsx/useDiagramMutations.ts). T008 before T009; T010 before T011; T012 before T013; T014 depends on the fixture existing before the tests in T009/T011/T013 exercise it, so land T014 alongside its phase or earlier.
- **US3 (Phase 5)**: needs T002 only; T015 before T016; T017 depends on T015 having established the per-node size-resolution pattern in `exportGeometry.ts` (`resolveTextSize` usage) but touches a different file, so can follow immediately. T017 before T018.
- **Polish**: last.

### Parallel Opportunities

- T003 has no sibling in Phase 2 to parallelize with (only foundational task).
- Phase 4 (export files) ∥ Phase 3 (editor UI) ∥ Phase 5 (geometry) — all touch disjoint files once Phase 2 is done.
- T009 ∥ T011 ∥ T013 (different test files) after their respective implementation tasks.
- T016 ∥ T018 (different test files) after T015/T017 respectively.

## Parallel Example: User Story 2

```bash
# After T008/T010/T012 land, their tests are independent files:
Task: "Extend test/lab/exportDiagram.test.ts with labelSize round-trip cases"
Task: "Extend test/lab/exportComponentCode.test.ts with size-class + font-family cases"
Task: "Extend test/lab/exportSvg.test.ts with size-class cases"
```

## Implementation Strategy

MVP = Phase 2 + Phase 3 (size chips change the canvas label size, body font unchanged). Then US2 (export/import fidelity) and US3 (reflow) can proceed in parallel since they touch disjoint files — but per Constitution I, **do not merge** before both are done: a size step without matching export fidelity and reflow is incomplete. Single-developer order: T001→T003, then Phase 3 → Phase 4 → Phase 5 → Phase 6.
