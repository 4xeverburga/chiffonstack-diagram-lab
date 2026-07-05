# Product

## Register

brand

## Users

Founders, CTOs, and Product Managers evaluating an engineering partner for serious custom software and production ML work. They are technically literate (or advised by someone who is), allergic to vague agency marketing, and trying to answer one question fast: *can these people actually architect and ship the hard thing?* Primary first-wave context is Peru via professional networks, but every word of the surface is English and built to read as a credible global studio from day one. They arrive skeptical of offshore staffing shops and enterprise boilerplate, and they leave either convinced of technical depth or gone.

## Product Purpose

ChiffonStack's landing page is the studio's first proof of work. It exists to convert technically-discerning decision-makers into qualified leads by *demonstrating* engineering mastery rather than asserting it — through architectural teardowns, real shipped products, and a roster of capabilities presented as one cohesive studio (never a freelancer catalog). Success looks like: a CTO reads a case study, thinks "they actually understand hybrid-cloud RAG at scale," and books a call. The page must also embody the brand thesis — **Rebel Core, Elite Delivery** — so that the *craft of the page itself* is the first case study.

## Brand Personality

**Rebel Core, Elite Delivery.** Three words: **playful, precise, uncompromising.** Young and high-impulse on the surface (fresh, a little irreverent, PostHog-adjacent energy, a chiffon-cake loader that doesn't take itself too seriously) over a spine of world-class engineering discipline (DDD, hexagonal architecture, strict testing, clean separation of concerns). The voice is confident without being corporate, technical without being dry, warm without being soft on rigor. It should feel like the sharpest engineers you know decided to have fun building their own studio. Emotional goal: a discerning technical buyer feels *respected* (no dumbed-down marketing) and *intrigued* (this is not the same six agency templates).

## Anti-references

- **BairesDev and offshore staffing directories** — headcount-as-product, "1000+ vetted developers," body-shop energy. ChiffonStack sells *structural solutions and architecture*, never developer headcount.
- **TCS / generic enterprise consultancy boilerplate** — vague marketing abstractions, stock handshake imagery, "digital transformation synergy." Empty corporate template filled with nothing.
- **The saturated AI-landing-page look** — cream/sand body background, tiny tracked uppercase eyebrows above every section, identical icon-heading-text card grids, gradient text, hero-metric template. If it reads as "an AI made this," it has failed the brand thesis on contact.
- **Editorial-magazine costume** — display-serif-italic + drop caps + broadsheet grid. ChiffonStack is an engineering studio, not a literary journal.

## Design Principles

1. **Show the architecture, don't claim the expertise.** Every credibility moment is a teardown, a topology, a real shipped artifact — value the reader can verify, not adjectives. (Sidesteps NDA via pure architectural value.)
2. **The page is the portfolio.** Craft, performance (zero-JS baseline, deferred WebGL), and precision in the page itself prove "Elite Delivery" before any copy does. Practice what we preach.
3. **One studio, one voice.** Capabilities and case studies read as a single cohesive engineering practice, never a roster of independent freelancers.
4. **Rebel core, earned.** Playfulness (the cake loader, motion, warmth) is permitted *because* the engineering underneath is rigorous. Delight never undercuts credibility; it rides on top of it.
5. **English-first, bilingual from day one.** Structure, copy, and SEO assume a global audience (English is the default locale), with a first-class **Spanish** track for the initial Peru leads. The site ships bilingual — a visible EN/ES toggle, proper i18n routing, and full copy parity — not an English page with an afterthought translation.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text ≥4.5:1 contrast (the warm-ink-on-white system is built to clear this; never ship muted gray on tinted white that fails it). Full keyboard navigability and visible focus states. The chiffon-cake loader and all entrance/scroll motion must honor `prefers-reduced-motion: reduce` with a crossfade or instant-paint alternative — and the loader must never gate first paint (localStorage first-visit-only, deferred Three.js island). Respect reduced-data/low-end devices: the critical render path ships no WebGL.
