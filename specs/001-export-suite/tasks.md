---

description: "Task list for Diagram Lab Export Suite"
---

# Tasks: Diagram Lab Export Suite

**Input**: Design documents from `/specs/001-export-suite/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. `research.md` decision #11 and `plan.md`'s Technical Context commit this feature to Vitest unit tests for every pure generator (`test/lab/*.test.ts`), so test tasks are part of each story rather than optional.

**Organization**: Tasks are grouped by user story (P1–P4 from spec.md) so each can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (component export), US2 (bundle), US3 (animated SVG), US4 (JPEG upload)
- File paths are exact and repo-root relative

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the new dependencies and dev tooling every story needs

- [X] T001 Add `fflate` (dependency) and `vitest` (devDependency) to package.json and install; if this repo deploys via Cloudflare Pages, regenerate package-lock.json with npm 10 per the landing repo's CLAUDE.md lock-file rule (quickstart.md note) before committing
- [X] T002 [P] Configure Vitest (root `vitest.config.ts` or a `test` block in vite.config.ts) and add a `"test": "vitest run"` script to package.json
- [X] T003 [P] Add `.github/workflows/ci.yml` running `npm run lint`, `npm run build`, and `npx vitest run` on push/PR (per plan.md Project Structure) — already present from the constitution v1.3.0 commit; conditional `npm test` step now runs for real

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared geometry math, the fixture diagram, and the export-handler hook that every story's UI wiring extends

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create src/lab/exportGeometry.ts: extract the node-sizing heuristic (label width, image height bump, manual `width`/`height` override) from src/lab/exportCode.ts, and add shared edge-path computation using `getBezierPath` from `@xyflow/react` (right-center → left-center handles, matching src/lab/HeatEdge.tsx)
- [X] T005 [P] Add a kitchen-sink fixture diagram (one of each node kind, an image node, a manually resized node, all four edge variants) in test/lab/fixtures/kitchenSink.ts
- [X] T006 [P] Add unit tests for src/lab/exportGeometry.ts (node-sizing correctness, manual-resize override, bezier path determinism) in test/lab/exportGeometry.test.ts
- [X] T007 Extract the export button handlers/status state from src/App.tsx into a new src/lab/useExportActions.ts hook — move the existing JSON-copy and static-code-copy handlers over unchanged, update src/App.tsx to consume the hook (keeps App.tsx under the constitution's line cap as buttons multiply)

**Checkpoint**: Foundation ready — user story phases can now begin in priority order

---

## Phase 3: User Story 1 - React Flow Component Code Export (Priority: P1) 🎯 MVP

**Goal**: A developer clicks "Export component" and gets a copy-pasteable React Flow component (`Diagram.tsx` + `diagram.css`) that reproduces the diagram live — layout, node kinds, images, resizes, edge variants, heat-flow animation, pan/zoom — styled only by the four design tokens.

**Independent Test**: Build a diagram exercising every canvas capability, export the component code, drop it into a fresh React app with `@xyflow/react` installed, and confirm it renders and animates identically to the canvas (quickstart.md "P1 component export").

### Tests for User Story 1

- [X] T008 [P] [US1] Unit tests for src/lab/exportComponentCode.ts in test/lab/exportComponentCode.test.ts, against the kitchen-sink fixture: asserts the fidelity mapping table in contracts/component-export.md (node kinds, image, manual resize, all edge variants, heat-flow keyframes present), tokens appear only as `--token-*` custom properties, labels are escaped via `JSON.stringify`, throws on empty input, and repeat calls are byte-identical (determinism)

### Implementation for User Story 1

- [X] T009 [US1] Implement src/lab/exportComponentCode.ts: `exportComponentCode(nodes, edges, tokens) => { tsx, css }` generating `Diagram.tsx` (default-exported `Diagram` component, embedded typed node/edge constants, local `LabelNode`/`HeatEdge` re-implementations, `--token-*` custom properties on the root wrapper, display-locked `<ReactFlow>` per contracts/component-export.md) and `diagram.css` (namespaced under `.chiffon-diagram`, heat-flow keyframes, `prefers-reduced-motion` override) — using src/lab/exportGeometry.ts for sizing/paths
- [X] T010 [US1] Add the clipboard-concatenated snippet form to src/lab/exportComponentCode.ts (`diagram.css` inside a `/* ─── diagram.css */` marker block followed by `// ─── Diagram.tsx`), matching contracts/component-export.md's "Clipboard form"
- [X] T011 [US1] Add an "Export component" button + handler (empty-canvas "Add nodes first" guard, copied/error status label, 1.8s reset) to src/lab/useExportActions.ts and wire it in src/App.tsx, alongside the existing (unchanged) "Export code" static-HTML button

**Checkpoint**: User Story 1 is fully functional and independently testable per quickstart.md

---

## Phase 4: User Story 2 - Agent-Ready Bundle Download (Priority: P2)

**Goal**: A developer clicks "Download bundle" and gets `diagram-bundle.zip` containing the component code, canonical diagram JSON, image assets, and a `prompt.md` — enough for a coding agent to integrate the diagram unassisted.

**Independent Test**: Download a bundle, unzip it, paste `diagram.json` back into the editor (identical diagram), and hand the folder to a coding agent with only "integrate this diagram" (quickstart.md "P2 bundle").

### Tests for User Story 2

- [X] T012 [P] [US2] Unit tests for src/lab/promptTemplate.ts in test/lab/promptTemplate.test.ts: asserts all sections from contracts/bundle.md's "prompt.md contents" are present (what-this-is, file inventory, four-token contract with current values, integration steps, asset-migration note, verification checklist)
- [X] T013 [P] [US2] Unit tests for src/lab/exportBundle.ts in test/lab/exportBundle.test.ts: asserts zip layout matches contracts/bundle.md (`Diagram.tsx`, `diagram.css`, `diagram.json`, `prompt.md`, `assets/node-<id>.<ext>` only when images present), `Diagram.tsx`/`diagram.css`/`diagram.json` are byte-identical to the standalone generators' output for the same input, asset extensions derive from data-URI MIME type, throws on empty input, deterministic output

### Implementation for User Story 2

- [X] T014 [US2] Implement src/lab/promptTemplate.ts: generate `prompt.md` markdown from `(tokens, file list, node/edge counts)` per contracts/bundle.md
- [X] T015 [US2] Implement src/lab/exportBundle.ts: `exportBundle(nodes, edges, tokens) => Uint8Array` using `fflate`'s `zipSync`, reusing `exportComponentCode` (T009) for `Diagram.tsx`/`diagram.css`, `serializeDiagram` (src/lab/exportDiagram.ts) for `diagram.json`, `promptTemplate` (T014) for `prompt.md`, and decoding each node's image data URI into `assets/node-<id>.<ext>`
- [X] T016 [US2] Add a "Download bundle" button + handler (Blob + temporary `<a download="diagram-bundle.zip">` click, empty-canvas guard, status label) to src/lab/useExportActions.ts and wire it in src/App.tsx

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Animated SVG Export (Priority: P3)

**Goal**: A non-coder clicks "Export SVG" and gets one self-contained animated vector file — heat-flow plays even via `<img>`, and degrades to a complete static frame where animation isn't supported. This replaces the current static HTML snippet export (FR-006 — one image-track action).

**Independent Test**: Export an SVG from a diagram with animated and static edges, open it directly and via `<img>`, confirm animation plays in both with zero network requests, and confirm a design-tool import shows a complete static frame (quickstart.md "P3 animated SVG").

### Tests for User Story 3

- [X] T017 [P] [US3] Unit tests for src/lab/exportSvg.ts in test/lab/exportSvg.test.ts: asserts no `<script>` or external `href`/`url()` references, the `heat-flow` keyframes + `prefers-reduced-motion: reduce` override are present, the fidelity mapping table in contracts/animated-svg.md holds (node kinds, image, resize, all edge variants), the document is a complete static frame at time zero, throws on empty input, deterministic output

### Implementation for User Story 3

- [X] T018 [US3] Implement src/lab/exportSvg.ts: `exportSvg(nodes, edges, tokens) => string` per contracts/animated-svg.md, using src/lab/exportGeometry.ts for node boxes and bezier paths, with an embedded `<style>` block for tokens-as-custom-properties, node/edge classes, and the heat-flow keyframes
- [X] T019 [US3] Replace the static-HTML "Export code" button/handler with the new "Export SVG" action (download `diagram.svg` + clipboard copy, empty-canvas guard, status label) in src/lab/useExportActions.ts and src/App.tsx, per FR-006
- [X] T020 [US3] Delete src/lab/exportCode.ts and remove its remaining imports/usages (fully superseded)

**Checkpoint**: User Stories 1–3 all independently functional; only one image-track export action remains

---

## Phase 6: User Story 4 - JPEG Upload Support & Size Awareness (Priority: P4)

**Goal**: Node image upload accepts JPEG alongside PNG/SVG, and warns (non-blocking) when an attached image is large.

**Independent Test**: Attach a JPEG to a node, confirm it displays and round-trips through JSON export/import; attach an oversized image and confirm a non-blocking size warning appears at attach time (quickstart.md "P4 image upload").

### Tests for User Story 4

- [X] T021 [P] [US4] Unit tests for src/lab/imageUpload.ts in test/lab/imageUpload.test.ts: asserts the accept list includes `image/jpeg`, `readImageFile` returns `{ dataUri, byteSize }`, and `IMAGE_SIZE_WARNING_BYTES` is `500_000`

### Implementation for User Story 4

- [X] T022 [US4] Implement src/lab/imageUpload.ts: exported accept-list constant (`image/png,image/svg+xml,image/jpeg`), `readImageFile(file: File): Promise<{ dataUri: string, byteSize: number }>`, and `IMAGE_SIZE_WARNING_BYTES = 500_000`
- [X] T023 [US4] Update src/lab/Inspector.tsx: use the new accept list and `readImageFile` for the node image input, and render a persistent, dismissable inline warning under the image preview when `byteSize` exceeds `IMAGE_SIZE_WARNING_BYTES` (upload never blocks — FR-008)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full suite together and close out edge cases that span every export target

- [X] T024 [P] Add a "hostile label" fixture (label containing quotes, angle brackets, and backslashes) and assert it survives escaping without corrupting output in test/lab/exportComponentCode.test.ts, test/lab/exportSvg.test.ts, and test/lab/exportBundle.test.ts (FR-011)
- [X] T025 [P] Run quickstart.md's manual verification steps end-to-end for all four export targets against the kitchen-sink fixture (component in a scratch React app, bundle handed to a coding agent, SVG via `<img>`/design-tool import, JPEG round-trip)
- [X] T026 Confirm `npm run lint`, `npm run build`, and `npx vitest run` all pass clean (CI parity, constitution IV gate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs Vitest configured for T006) — BLOCKS all user stories
- **User Stories (Phase 3–6)**: All depend on Foundational completion
  - US1 (P1) has no dependency on other stories
  - US2 (P2) reuses US1's `exportComponentCode` output (T009) — must follow US1
  - US3 (P3) only depends on Foundational (`exportGeometry.ts`) — independent of US1/US2, but replaces the button US1 left untouched, so do it after US1 to avoid churn on the same UI file
  - US4 (P4) has no dependency on other stories or exportGeometry.ts — can run any time after Foundational
- **Polish (Phase 7)**: Depends on all four stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundational only
- **User Story 2 (P2)**: Foundational + User Story 1 (`exportComponentCode`)
- **User Story 3 (P3)**: Foundational only (independently testable in isolation; sequenced after US1/US2 here only to avoid conflicting edits to useExportActions.ts/App.tsx)
- **User Story 4 (P4)**: Foundational only

### Within Each User Story

- Tests are written first and should fail before implementation
- Geometry/data helpers before generators; generators before UI wiring
- Story complete (generator + tests + button wiring) before moving to the next priority

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel
- T005 and T006 (Foundational) can run in parallel once T004 lands
- T012 and T013 (US2 tests) can run in parallel
- T024 and T025 (Polish) can run in parallel
- US4 (T021–T023) has no file overlap with US1/US2/US3 and can be staffed in parallel with any of them once Foundational is done

---

## Parallel Example: Foundational

```bash
# After T004 (exportGeometry.ts) lands, run together:
Task: "Add kitchen-sink fixture diagram in test/lab/fixtures/kitchenSink.ts"
Task: "Add unit tests for exportGeometry.ts in test/lab/exportGeometry.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch both US2 test files together:
Task: "Unit tests for promptTemplate.ts in test/lab/promptTemplate.test.ts"
Task: "Unit tests for exportBundle.ts in test/lab/exportBundle.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (critical — blocks all stories)
3. Complete Phase 3: User Story 1 (component export)
4. **STOP and VALIDATE**: run quickstart.md's P1 steps independently
5. Ship the flagship export

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 (component export) → validate → ship (MVP!)
3. Add US2 (bundle) → validate → ship
4. Add US3 (animated SVG, retires the static HTML export) → validate → ship
5. Add US4 (JPEG + size warning) → validate → ship
6. Polish: cross-cutting escaping checks + full quickstart pass + CI gate

### Parallel Team Strategy

With multiple developers, after Foundational:

- Developer A: User Story 1, then User Story 2 (depends on US1)
- Developer B: User Story 3 (independent of US1/US2 apart from final button wiring — coordinate on useExportActions.ts/App.tsx)
- Developer C: User Story 4 (fully independent)

---

## Notes

- [P] tasks touch different files with no unmet dependencies
- [Story] labels map every user-story-phase task back to spec.md's P1–P4
- Generators (`exportComponentCode.ts`, `exportBundle.ts`, `exportSvg.ts`, `promptTemplate.ts`, `imageUpload.ts`, `exportGeometry.ts`) are pure functions — no default parameter values (constitution IV / CLAUDE.md)
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
