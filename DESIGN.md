# ChiffonStack Design System

## 1. Visual Theme & Atmosphere

ChiffonStack is a premium product-engineering and ML studio with a thesis: **Rebel Core, Elite Delivery.** The surface must hold both halves at once — playful and fresh on top (PostHog-adjacent energy, a chiffon-cake loader, warmth, motion), uncompromising engineering rigor underneath (clean architecture, precise type, verifiable teardowns). The page itself is the first case study, so craft is non-negotiable.

The stage is **white**, not cream. Systems Debrief lives on a warm `PAPER_CANVAS`; ChiffonStack deliberately moves to a true white field so the studio reads as sharper, cleaner, more "elite delivery" — and to stay clear of the saturated cream/sand AI-landing default. Warmth is carried by the **ink** (a warm near-black borrowed from Systems Debrief), the **heat accent**, typography, and imagery — never by tinting the body background into parchment.

Depth comes from the contrast between white `CANVAS`, faint `SURFACE`, and the `INK` / `INK_SECONDARY` / `MUTED` text ramp, plus generous negative space. The signature accent is the **Heat gradient** (orange → red) inherited from the shared isotype: use it as the heat of *the hard problem being solved* — active CTAs, the live path through an architecture diagram, the focal point of a teardown, the one thing that matters in a fold. A **dark mode** (graphite stage, borrowed from Systems Debrief) is the alternate, higher-density system for hero moments and code-forward sections.

**Key Characteristics:**
- Crisp white `CANVAS` as the default stage; faint `SURFACE` and hairline borders for structure, not heavy cards
- Heat gradient accents (`HEAT_ORANGE → HEAT_RED`), used sparingly and decisively as "the hard part"
- Warm ink-led typography; Quicksand display (the bridge to Systems Debrief + chiffon softness) over a neutral grotesque body
- Architecture-first credibility: topology diagrams, system teardowns, real shipped-product screenshots — never icon-heading-text card grids
- Motion that feels engineered: orchestrated first-load, the chiffon-cake loader, inspection-ring focus, deferred WebGL
- A tone between elite engineering studio, playful dev-tool brand, and architectural case file

## 2. Color Palette & Roles

Small, committed palette. One accent family (Heat), the warm ink ramp, white, and an optional cool structural accent. More colors dilute the "one studio, one voice" thesis. **OKLCH** is the working space; hex is given for reference.

### Light Mode — Surfaces (default)

- **CANVAS** (`#FFFFFF`): Primary page background. The white field is the brand's "elite" register.
- **SURFACE** (`#F8F7F5`): Faint off-white for alternating sections and inset blocks. Whisper-warm, chroma near zero — **not** cream. Use sparingly to band the long scroll.
- **SURFACE_SUNKEN** (`#F4F2EF`): Code panels, terminal blocks, sunken technical surfaces in light mode.
- **INK** (`#18130F`): Primary text and primary-button fill. Warm near-black borrowed from Systems Debrief — the warmth lives here, not in the background. ~17:1 on white.
- **INK_SECONDARY** (`#574F47`): Body and supporting text. ≥7:1 on white — the safe body-secondary, use this for paragraphs, not the lighter muted tone.
- **MUTED** (`#6F665D`): Metadata, captions, mono labels, timestamps. ~5.5:1 on white — passes AA, but reserve for genuinely secondary text.
- **HAIRLINE** (`#E7E4E0`): Default borders, dividers, table rules.
- **BORDER_STRONG** (`#D8D4CF`): Emphasized borders, active input outlines, card edges that need to read.

### Dark Mode — Surfaces (alternate, borrowed from Systems Debrief)

- **GRAPHITE** (`#111111`): Dark-mode background, panel fill, grouped container surface.
- **BLACK** (`#000000`): Node fills and depth layer inside the graphite stage.
- **CHARCOAL_LINE** (`#222222`): Dark-mode dividers, inactive borders, faint bounding boxes.
- **SIGNAL_WHITE** (`#FFFFFF`): Primary text in dark mode.
- **SLATE_GRAY** (`#9CA3AF`): Secondary text, annotations, metadata in dark mode.

### Accent — Heat (primary, the shared identity)

- **HEAT_ORANGE** (`#FF8E05`): Warm end. Highlights, active diagram entry points, decorative heat.
- **HEAT_RED** (`#FF0024`): Hot end. Decisive reveals, the failure/critical node in a teardown, hover intensification.
- **HEAT_MID** (`#FF4715`): Flat midpoint. Use instead of a live gradient when a solid warm fill is needed.
- **HEAT_INK** (`#C4001A`): The AA-safe accent for **text and links** on white (~5.6:1). The bright `HEAT_RED`/`HEAT_ORANGE` fail body-text contrast — never use them for small text; deepen to `HEAT_INK`.
- **Heat Gradient**: `HEAT_ORANGE → HEAT_RED` at 135°. Reserved for the isotype, one hero accent moment, the live path in a topology, and thesis beats. **Never** a full-page or full-section background (per shared isotype rules — it behaves like heat, not wallpaper). For a warm full-bleed need, flatten to `HEAT_MID`.

### Accent — Cool (optional, structural, sparing)

- **COOL** (`#6D4AFF`): A deepened take on Systems Debrief's violet, for occasional secondary structure — supporting paths in a diagram, a non-focal system box, a structural underline. On white, use only at large/bold sizes or as a fill; for text deepen further. Heat is the star; cool is support and must stay rare.

### Semantic

- Success `#1F9D55`, Warning `#B26A00`, Error `HEAT_RED` / `HEAT_INK`. Keep functional color for forms and states; never let semantic green/blue creep into brand expression.

### Contrast Rules (non-negotiable)

- Body text ≥4.5:1; large/bold ≥3:1; placeholders ≥4.5:1.
- Accent text on white → `HEAT_INK`, never `HEAT_ORANGE`/`HEAT_RED`.
- White text on a heat button → use the red end (`#E4001F` or deeper) at bold/large, or use `INK` text on a lighter heat fill. Verify before shipping.
- No muted gray body text on `SURFACE`. If it's a paragraph, it's `INK_SECONDARY` or darker.

## 3. Typography

Quicksand is the deliberate bridge to Systems Debrief — its rounded geometry echoes the chiffon-cake softness and the rounded-square isotype, carrying the "playful / rebel" half. The grotesque body and mono carry the "precise / elite" half. (Inter and Poppins from the Systems Debrief video system are intentionally dropped: Inter is a reflex-default, Poppins is a captions face — neither belongs on the brand web surface.)

| Role | Font | Weight / Case | Use |
|---|---|---|---|
| Display / Hero | Quicksand | Bold, Title or Sentence case | Hero headline, section openers. Rounded, friendly, spacious. |
| Headings (H2–H4) | Quicksand | SemiBold / Bold | Section and sub-section headings. |
| Body & UI | Hanken Grotesk | Regular / Medium | Paragraphs, labels, nav, buttons. Warm, highly legible grotesque. |
| Mono / Technical | JetBrains Mono | Regular / Medium | Code, terminal blocks, architecture labels, metadata, kickers. Legit here — this *is* an engineering studio. |

### Scale (fluid, web)

| Step | Size (clamp) | Notes |
|---|---|---|
| Display | `clamp(2.75rem, 1.8rem + 4.6vw, 5rem)` | Hero. Cap ≤5rem (under the 6rem ceiling). `letter-spacing: -0.03em` (never tighter than -0.04em). `text-wrap: balance`. |
| H2 | `clamp(2rem, 1.4rem + 2.6vw, 3rem)` | Section heads. `text-wrap: balance`. |
| H3 | `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)` | Sub-sections. |
| Body L | `1.125rem` | Lead paragraphs, intros. |
| Body | `1rem`, line-height `1.6`, max `68ch` | Default prose. `text-wrap: pretty` on long blocks. |
| Small / Meta | `0.875rem` | Mono labels, captions, footnotes. |
| Code | `0.9375rem` JetBrains Mono | Code and terminal. |

### Principles

- One dominant idea per fold; one display headline carries it.
- Modular scale, ≥1.25 between major steps; flat scales read uncommitted.
- Title case for the hero/section heads, sentence case for prose.
- Mono is for technical labels and code, **not** decoration. Don't sprinkle mono to look "developer-y"; let it mark genuinely technical content.
- Cap body line length at 65–75ch. Generous negative space around the active idea.
- **No tiny uppercase tracked eyebrow above every section.** If a kicker is used, it's a single deliberate mono label, not section-by-section scaffolding. No `01 / 02 / 03` numbered markers unless a section genuinely *is* an ordered sequence.

## 4. Web Components

Web component language, not Manim primitives. Cards are the lazy answer — use them only when they're the best affordance, and **never nest them**.

### Buttons

- **Primary**: `INK` fill, `SIGNAL_WHITE` text, radius `--r-md` or pill. The premium, default CTA.
- **Heat CTA** (one per fold max): red-end heat fill (`#E4001F`+) with bold white text, or `HEAT_MID` fill with `INK` text — whichever clears contrast. Reserved for the single most important action (book a call).
- **Secondary**: transparent fill, `BORDER_STRONG` 1px, `INK` text. Hover → `SURFACE` fill.
- **Ghost / link**: `HEAT_INK` text, underline on hover; for tertiary actions.
- All buttons: visible `:focus-visible` ring (2px `COOL` or `INK`, 2px offset). Hover/press use ease-out, no bounce.

### Navigation

- Minimal sticky top bar on `CANVAS` with a hairline bottom border that appears on scroll. Heat isotype + `ChiffonStack` wordmark (Quicksand) left; sparse links (Hanken Grotesk) right (e.g. blog), one Heat CTA, and the language toggle, all in a right-aligned group. Mobile → full-height sheet, not a cramped dropdown.

### Language Toggle

ChiffonStack ships bilingual (see §9 i18n). The toggle is a small **segmented pill** in the right of the nav: two mono labels `EN / ES`, the active one filled `INK` with white text, the inactive `MUTED` on transparent. `role="group"`, `aria-pressed` per button, visible focus ring. The swap is an instant text/content change (no motion needed); it sets `<html lang>` and persists the choice. Keep it compact — hide adjacent non-essential nav meta before the toggle collapses on small viewports.

### The Capabilities Roster (not a card grid)

The unified showcase of engineering mastery. **Avoid the banned identical icon-heading-text grid.** Prefer a structured **competency ledger**: an asymmetric two-column layout pairing a domain (Quicksand) with mono sub-capabilities and a one-line architectural proof. Reads as one studio's depth, never a list of freelancer profiles.

### Case-Study Teardown

The credibility engine. Each anonymized enterprise teardown leads with a **system topology** — a custom SVG/diagram of the architecture (nodes, paths, the live heat path, the failure point) — using the isotype-derived **inspection ring** to focus the active mechanism. Pair with mono labels and short architectural prose. This is imagery; ship the real diagram, never a colored placeholder block.

### Product Showcases

Interactive highlights for shipped assets (Bomba Word Game, Hablemos Manga). Lead with a **real screenshot/asset** (this is an image-led brief — zero imagery is a bug), framed in a rounded `--r-lg` shell with a hairline border, plus a mono performance/architecture caption.

### Code & Terminal Panels

`SURFACE_SUNKEN` fill (light) / `BLACK` on `GRAPHITE` (dark), `--r-md`, optional header strip with a mono filename in `MUTED`. JetBrains Mono body. Avoid heavy shadows; separation comes from fill + hairline.

### Surfaces & Elevation

White is the default; create structure with **hairline borders and faint `SURFACE` bands**, not stacked shadows. Reserve a single soft layered shadow for the one floating element that must lift (a primary CTA, a sticky callout). No side-stripe borders, no glassmorphism-by-default, no gradient text.

## 5. Motion Language

Motion is part of the build, not an afterthought — and it's where "rebel core" gets to play, *because* the engineering underneath is rigorous.

- **Curves**: ease-out exponential family (quart / quint / expo). No bounce, no elastic.
- **First-load choreography** (brand permission): one orchestrated entrance — heat-path draws through the isotype, hero headline rises and settles, supporting elements stagger. Earns its place; not fade-on-scroll bolted onto every section.
- **Inspection ring**: the isotype's circular cutout becomes a hover/focus motif on teardowns — a ring that isolates the active node.
- **Reveals enhance an already-visible default.** Never gate content visibility on a class-triggered transition (it ships blank on hidden tabs / headless renderers). Stagger within a list is fine; the uniform one-entrance-per-section reflex is not.
- **Premium materials**: blur, clip-path/mask (cutout reveals), and glow are in the palette when they materially help and stay smooth. Don't animate layout properties.
- **Reduced motion is mandatory**: every animation needs a `@media (prefers-reduced-motion: reduce)` crossfade/instant alternative.

### The Chiffon-Cake Loader

A minimalist, playful CSS/SVG (or optimized Lottie) animation of a chiffon cake being eaten. Constraints (from project context):
- Lightweight vector/CSS only — **no Three.js or heavy WebGL in the critical first frame.**
- `localStorage` session/day gating: plays only on a first visit; revisits and refreshes **bypass it entirely** for immediate paint.
- Must never block first contentful paint.

### 3D / WebGL

Any Three.js interaction lives in an isolated Astro island with a deferral directive (`client:idle` / `client:visible`). Core copy and layout render fully before WebGL downloads or compiles.

## 6. Layout & Spacing

- **Spacing scale**: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`. Fluid section padding via `clamp()`; vary rhythm — generous separations between sections, tight groupings within.
- **Radius scale**: `--r-sm 8px` · `--r-md 12px` · `--r-lg 20px` · `--r-pill 999px`. The rounded-square isotype (~16% corner) sets the soft, generous radius language.
- **Grid**: Flexbox for 1D, Grid for 2D — don't default to Grid. Responsive card rows: `repeat(auto-fit, minmax(280px, 1fr))`. Asymmetric, intentional layouts are encouraged for emphasis; break the grid on purpose, not by accident.
- **z-index**: semantic scale — dropdown → sticky → modal-backdrop → modal → toast → tooltip. Never `999`/`9999`.
- **Text overflow**: test every heading at every breakpoint; long words + large clamp + narrow columns overflow on tablet/mobile. The viewport is part of the design.

## 7. Isotype & Logo

The shared mark: a rounded square with a central circular cutout. ChiffonStack reuses it — primarily in the **Heat gradient**, with a **monochrome** variant for small/constrained contexts.

- **Heat version** (`HEAT_ORANGE → HEAT_RED`, 135°): primary brand mark in the nav, hero, and footer.
- **Monochrome version**: `INK` on light / `SIGNAL_WHITE` on dark. Use for favicon, tiny nav marks, watermarks, and any one-color context. Preserve the gradient exactly when the heat version is used; never recolor the mark into cyan, violet, green, or gray.
- **Derived motifs**: inspection ring (focus an active mechanism), rounded system shell (the black-box container in diagrams), heat path (source → conclusion), cutout reveal (mask transition opening a hidden layer).
- Don't scatter the logo over busy diagrams; give it clear space.

## 8. Imagery

This is an image-led brief — text-only is the failure mode.

- **Ship real assets**: product screenshots (Bomba Word Game, Hablemos Manga), and custom architecture topologies (which count as imagery). A colored `<div>` where a screenshot or diagram belongs is a bug.
- For any greenfield/stock need, verify URLs resolve before shipping (Unsplash default shape `https://images.unsplash.com/photo-{id}?auto=format&fit=crop&w=1600&q=80`); prefer fewer confirmed images over guessed IDs that 404.
- Alt text is part of the voice: "AI helpdesk topology routing 20k users across BigQuery and Firebase" beats "diagram".

## 9. Tech & Implementation Notes

- **Stack**: Astro + Tailwind, zero-JS baseline, Component Islands; deploy static / edge to Cloudflare Pages or Vercel. Don't over-engineer with Storybook in this phase — semantic layout directly in the project tree.
- **Tokens**: express the palette, type, spacing, and radius scales above as CSS custom properties + Tailwind theme extensions. OKLCH for color definitions.
- **Blog**: type-safe Markdown/MDX hierarchy; when re-publishing the founder's portfolio articles, emit `rel="canonical"` to the original source.
- **i18n / SEO**: Bilingual **English (default) + Spanish (Peru leads)**, English-first and global from day one.
  - **Routing**: Astro built-in i18n. `defaultLocale: "en"` served prefix-less at `/`; Spanish under `/es/`. Emit `<link rel="alternate" hreflang="…">` for each locale + `x-default`, and set `<html lang>` per route.
  - **Translation scope**: marketing and UI copy translate; **technical identifiers stay language-neutral** — design tokens, code snippets, architecture labels, and stack tags (Kafka, CDC, RAG, DDD) are not translated. Alt text *is* translated (it's voice).
  - **Persistence**: remember the visitor's locale (`localStorage`/cookie) and respect it on return; never trap a visitor in the wrong language. In the static validation sheet this is a vanilla `data-es` / `data-es-html` swap; in Astro it's per-route content collections, not client-side text replacement.
  - **Copy parity**: every shipped string needs both locales before launch; no half-translated folds. Spanish runs longer than English — test headings/buttons at every breakpoint in both languages (the viewport is part of the design).

## 10. Do's and Don'ts

### Do
- Keep the stage **white**; carry warmth in ink, heat, type, and imagery.
- Use the Heat gradient sparingly and decisively as "the hard part."
- Use `HEAT_INK` for accent text/links; `INK_SECONDARY` for body.
- Prove engineering with topologies and real screenshots.
- Orchestrate one first-load moment; honor reduced motion everywhere.
- Keep "one studio, one voice" across capabilities and case studies.

### Don't
- No cream/sand body background (that's the AI default and Systems Debrief's lane, not ChiffonStack's).
- No tiny uppercase tracked eyebrows or `01/02/03` markers on every section.
- No identical icon-heading-text card grids; no nested cards; no side-stripe borders; no gradient text; no default glassmorphism.
- No `HEAT_ORANGE`/`HEAT_RED` for small text (fails contrast).
- No Heat gradient as a full-section/full-page background.
- No Three.js or heavy WebGL in the critical first paint; no loader that blocks first paint.
- No headcount/staffing or corporate-boilerplate energy (BairesDev / TCS).