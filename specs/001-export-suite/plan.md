# Implementation Plan: Diagram Lab Export Suite

**Branch**: `001-export-suite` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-export-suite/spec.md`

## Summary

Build the two-track export model on top of the existing editor state
(`nodes`/`edges` from React Flow, `tokens` from the sidebar): (P1) generate a
self-contained React Flow component (`.tsx` + CSS) that reproduces the diagram
live with heat-flow animation and pan/zoom; (P2) package that code with the
canonical diagram JSON, image assets, and a generated `prompt.md` into a
client-side zip download; (P3) replace the current static HTML snippet export
with a single animated SVG whose heat-flow animation runs via CSS keyframes
embedded in the SVG (plays in `<img>`, degrades to a complete static frame);
(P4) accept JPEG uploads and warn (non-blocking) on images over ~500 KB.

All exports are pure functions of `(nodes, edges, tokens)` — deterministic
string/byte generation in small single-purpose modules alongside the existing
`exportDiagram.ts` / `exportCode.ts`.

## Technical Context

**Language/Version**: TypeScript ~6.0, React 19, ES modules

**Primary Dependencies**: `@xyflow/react` 12 (canvas + `getBezierPath` for
export-side geometry), Vite 8. New: `fflate` (zip generation, P2). New dev:
`vitest` (unit tests for generators).

**Storage**: None (static SPA). Diagram persistence = user-held JSON files.

**Testing**: `oxlint` + `tsc -b` (existing gates); `vitest` unit tests for the
pure export generators (deterministic input → output assertions).

**Target Platform**: Evergreen browsers; output artifacts target (a) consumer
React 18+/19 apps with `@xyflow/react` installed, (b) any HTML host for SVG.

**Project Type**: Single-page web app (Vite SPA), client-side only.

**Performance Goals**: Export of a 50-node diagram completes < 3 s (SC-006);
generators are synchronous string building, zip is the only async-heavy step.

**Constraints**: No backend (constitution III); exports styled only via the
4-token contract (constitution II); SVG must be zero-JS/zero-network
(constitution I); no default parameter values (constitution IV / CLAUDE.md).

**Scale/Scope**: Diagrams up to low hundreds of nodes; embedded images as
base64 data URIs (~500 KB warning threshold per image).

## Constitution Check

*GATE: evaluated against constitution v1.2.0. Re-checked after Phase 1 — PASS.*

| Principle | Gate | Status |
|---|---|---|
| I. Export Fidelity | Every canvas capability (node kinds, images, resizes, heat/dashed/default edges, animation) has a defined mapping in each target's contract (see `contracts/`); JSON stays round-trippable and self-contained (data-URI images) | PASS |
| II. Minimal Token Contract | All generators take `tokens: DesignTokens` explicitly; no new tokens added; no ChiffonStack styling hard-coded in output (defaults live only in `DEFAULT_DESIGN_TOKENS`) | PASS |
| III. Open Source & Self-Contained | Zip built client-side with `fflate`; downloads via Blob + anchor; no server, no accounts | PASS |
| IV. Contributor-Legible | One new module per export target (`exportComponentCode.ts`, `exportBundle.ts`, `exportSvg.ts`, `imageUpload.ts`); functional core / imperative shell (generators pure, side effects in `useExportActions`); files under the ~250-line cap (App.tsx export logic extracted); explicit arguments everywhere; oxlint + tsc + vitest enforced in GitHub Actions CI | PASS |
| V. Targets & Portability | All targets consume the same `(nodes, edges, tokens)`; deterministic output; SVG (image track) never requires the code track to view | PASS |

**New dependencies (justification per Additional Constraints)**: `fflate`
(~8 KB, zero-dep, the standard client-side zip choice — hand-rolling zip is
worse for legibility); `vitest` (dev-only; generators are pure functions that
deserve real tests, and lint+build alone can't catch output regressions).

## Project Structure

### Documentation (this feature)

```text
specs/001-export-suite/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── diagram-json.md
│   ├── component-export.md
│   ├── bundle.md
│   └── animated-svg.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/ci.yml           # NEW: lint + typecheck/build + vitest on push/PR

src/
├── App.tsx                    # lab-bar renders export buttons; stays a thin shell
│                              # (export handlers/status move to useExportActions)
├── App.css                    # canvas styles (source of truth the exports mirror)
└── lab/
    ├── designTokens.ts        # unchanged (4-token contract)
    ├── nodeKinds.ts           # unchanged
    ├── heatVariants.ts        # unchanged
    ├── exportDiagram.ts       # unchanged (canonical JSON)
    ├── exportGeometry.ts      # NEW: shared node sizing + bezier path math
    │                          #      (extracted from exportCode.ts so SVG and
    │                          #      component exports agree on layout)
    ├── exportComponentCode.ts # NEW (P1): (nodes, edges, tokens) → .tsx + .css strings
    ├── exportSvg.ts           # NEW (P3): (nodes, edges, tokens) → animated SVG string
    │                          #      (replaces exportCode.ts; exportCode.ts deleted)
    ├── exportBundle.ts        # NEW (P2): (nodes, edges, tokens) → zip bytes
    │                          #      (component files + diagram.json + assets/ + prompt.md)
    ├── promptTemplate.ts      # NEW (P2): prompt.md generator
    ├── useExportActions.ts    # NEW: hook owning export handlers + status labels
    │                          #      (keeps App.tsx under the 250-line cap as
    │                          #       buttons multiply; constitution IV)
    ├── imageUpload.ts         # NEW (P4): file→dataURI read, accept list, size check
    ├── Inspector.tsx          # P4: use imageUpload, render size warning
    └── Sidebar.tsx            # unchanged

test/
└── lab/
    ├── exportComponentCode.test.ts
    ├── exportSvg.test.ts
    ├── exportBundle.test.ts
    └── imageUpload.test.ts
```

**Structure Decision**: stay flat under `src/lab/` — one module per export
target, mirroring the existing convention (constitution IV). The shared
geometry module exists so the two visual exports (component, SVG) can't drift
apart on node sizing/paths. `exportCode.ts` (static HTML snippet) is retired
by P3 per FR-006; until P3 lands, it remains wired to the old button.

## Phase Outline

- **Phase 0 (research.md)**: settle generation strategy per target — component
  file shape, animation-in-SVG technique, zip library, download vs clipboard
  UX, escaping rules, size threshold. All resolved; no NEEDS CLARIFICATION.
- **Phase 1 (design)**: data-model.md (diagram JSON as the canonical entity),
  contracts/ (one contract per export artifact — these are the product's
  public interfaces), quickstart.md (dev loop + how to verify each export
  per constitution's round-trip gate).
- **Phase 2 (/speckit-tasks)**: task breakdown by user story (P1 → P4), each
  independently shippable.

## Complexity Tracking

No constitution violations to justify.
