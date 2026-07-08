---
name: SUGAR
description: An interactive performance, capacity, and chaos simulator for software architectures and data pipelines
colors:
  signal-orange: "#ff4715"
  warm-stone: "#d8d4cf"
  ink: "#08060d"
  slate: "#6b6375"
  paper: "#ffffff"
  hairline: "#e5e4e7"
  danger: "#ff0024"
  warning-border: "#d68a00"
  warning-bg: "#fff6e5"
  warning-text: "#7a5200"
typography:
  display:
    fontFamily: "Quicksand Variable, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontWeight: 500
  body:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Consolas, monospace"
    fontSize: "11px"
    lineHeight: "145%"
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    letterSpacing: "0.04em"
rounded:
  pill: "999px"
  md: "8px"
  sm: "6px"
  xs: "4px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "20px"
components:
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.slate}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  panel:
    backgroundColor: "{colors.paper}"
    rounded: "0px"
  status-badge:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
---

# Design System: SUGAR

## 1. Overview

**Creative North Star: "The Instrument Panel"**

SUGAR looks like the console of a piece of test equipment, not a diagramming
app or a dashboard SaaS. Monospace type stands in for gauge readouts
everywhere text appears — labels, buttons, meters, formulas — because the
product's whole premise is that every number on screen is a real,
citable measurement, not decoration. A single warning-orange accent
(`--token-primary`) is the only saturated color in the system, and it is
spent rarely and specifically: the thing currently selected, the thing
currently binding, the wall you just hit. Everywhere else stays quiet
near-white/near-black neutrals so that one orange signal reads instantly
as "look here" rather than competing with itself.

This system explicitly rejects: gamified toy-simulator polish (bright
multi-color scoring, playful iconography), diagramming-SaaS chrome
(gradients, glassy panels, marketing-style cards), and decorative motion
that doesn't encode a real simulated value (the only "premium motion
detail" in the whole product is edge-flow speed/density, and that speed
*is* the throughput reading — nothing animates for the sake of animating).

**Key Characteristics:**
- Monospace-first: body/label/data text runs in JetBrains Mono almost
  everywhere; the one display-font exception (Quicksand) is reserved for
  the app title bar only, never for in-canvas or panel content.
- Flat by default: 1px hairline borders separate every surface; no card
  shadows, no gradients. Elevation is spent on exactly one floating
  exception (see §4).
- One accent, spent rarely: `--token-primary` marks selection, hover
  intent, active/binding state, and saturation walls — nothing else uses
  it decoratively.
- Status is never color-only: saturated vs. degraded, chip-active vs.
  inactive, and every meter's binding highlight all pair the accent with
  a second signal (border-style, weight, or a text badge), so the system
  stays legible under a user-supplied low-contrast token pair.
- User-owned brand layer: `--token-primary`/`--token-secondary` (plus
  heading/body font family) are the only tokens an end user can
  reassign — every export target reads the same two variables, so
  "brand" here means exactly two colors and two font stacks, deliberately
  small.

## 2. Colors

Two user-facing brand tokens plus a fixed neutral scale. Nothing else in
the working canvas/Inspector surface carries color.

### Primary
- **Signal Orange** (`#ff4715`, CSS var `--token-primary`): selection
  rings, hover borders on every interactive control, active chips, resize
  handles, the heat-flow edge glow, and every "something needs your
  attention" state — saturated node borders, binding meter/formula
  highlights, the destructive-hover exception aside (see Neutral/Danger
  below). User-configurable via the sidebar's Design Tokens panel; every
  export target reads this same variable.

### Secondary
- **Warm Stone** (`#d8d4cf`, CSS var `--token-secondary`): the quieter
  brand color — default node/panel border tint, alignment guides,
  straddled connection-handle color, secondary-emphasis borders (e.g. a
  status badge's resting border before it becomes saturated/degraded).
  User-configurable alongside Primary.

### Neutral
- **Ink** (`#08060d` light / `#f3f4f6` dark, CSS var `--text-h`):
  headings, high-contrast body text, values inside meters/formulas —
  anything that must read as "the number itself," not surrounding label
  text.
- **Slate** (`#6b6375` light / `#9ca3af` dark, CSS var `--text`): the
  default label/caption color for chips, field labels, placeholder notes,
  formula expressions.
- **Paper** (`#ffffff` light / `#16171d` dark, CSS var `--bg`): every
  panel, node, and control background. No secondary "elevated surface"
  neutral exists — depth comes from borders, not a lighter/darker fill.
- **Hairline** (`#e5e4e7` light / `#2e303a` dark, CSS var `--border`):
  every 1px divider and resting-state border across the app.

### Semantic (fixed, not user-configurable)
- **Danger** (`#ff0024`): destructive actions only (`Delete edge`, `Remove
  image`) — never the brand orange, so a destructive hover can never be
  mistaken for a selection/active hover.
- **Warning** (border `#d68a00`, background `#fff6e5`, text `#7a5200`):
  the large-image-size inline warning banner — the one place a
  traffic-light amber appears, and it is fixed, not token-driven.

### Legacy / not part of the product surface
- `--accent` (`#aa3bff`), `--sans` (Hanken Grotesk), `--code-bg`,
  `--social-bg`: inherited from the original Vite scaffold this project
  was created from, predating the Diagram Lab → SUGAR pivot. Grepped
  confirmed unused anywhere in `App.tsx`/`App.css`. Do not reach for these
  when building new UI — they are not live tokens, just unremoved
  boilerplate.

### Named Rules
**The One Signal Rule.** `--token-primary` is spent on exactly one thing
at a time per surface: the current selection, the current hover, or the
current binding constraint. It is never used as a background fill or a
decorative wash — always a border, a ring, or a small highlighted value.

## 3. Typography

**Display Font:** Quicksand Variable (with system-ui, "Segoe UI", Roboto,
sans-serif fallback)
**Body/Label/Data Font:** JetBrains Mono Variable (with ui-monospace,
Consolas, monospace fallback)

**Character:** a technical instrument, not a text document. The display
font appears in exactly one place (the app title bar) so its presence
reads as "this is a named tool," while everything a user actually reads
or edits — labels, values, formulas, source citations — runs in monospace
so numbers align and read as measurements rather than prose.

### Hierarchy
- **Display** (weight 500, Quicksand): the app title bar only
- **Label** (JetBrains Mono, 11–12px, `letter-spacing: 0.04em` on
  badges/uppercase labels): field labels, chip text, button text, status
  badges, formula names/expressions, source links.
- **Body/data** (JetBrains Mono, 11–13px): metrics readouts, formula
  inputs, placeholder notes, warning/error copy.
- **Node label** (JetBrains Mono, default 13px with small/large steps at
  11px/16px per `textSizes.ts`): the one place a canvas-facing "content"
  font is user-adjustable independent of the Inspector chrome.

### Named Rules
**The Monospace Workhorse Rule.** If it's inside the canvas, Sidebar, or
Inspector and it isn't the app's own title, it's JetBrains Mono. Reaching
for the display font (or any other family) outside the title bar is a
regression, not a style choice.

## 4. Elevation

Flat by default. Every panel, node, and control is a 1px hairline border
on a flat background — no drop shadows, no layered surface tones. Depth
signals state, not hierarchy: a `color-mix`-based ring (`box-shadow: 0 0 0
1px color-mix(in srgb, var(--token-primary) 40%, transparent)`) marks the
active/selected node, and a keyframe inset ring
(`box-shadow: inset 0 0 0 1px #ff4715` → transparent) briefly flashes the
Inspector when selection changes. Both are "this changed," never
permanent decoration.

### Shadow Vocabulary
- **Selection ring** (`box-shadow: 0 0 0 1px color-mix(in srgb, var(--token-primary, #ff4715) 40%, transparent)`):
  the active-node border treatment; pairs with a solid border-color
  change, never shadow alone.
- **Inspector flash** (`box-shadow: inset 0 0 0 1px #ff4715` animating to
  transparent, 0.5s ease-out): a one-shot pulse when the Inspector's
  target changes, respecting `prefers-reduced-motion`.
- **Floating readout** (`box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12)`): the
  single true "elevated card" in the system — the edge dual-unit
  (req/s ↔ MB/s) label, which must visually separate from the canvas
  behind it (and from nodes, via `z-index: 1001` — see the codebase's
  `App.css` comment on why 1000 specifically) since it floats
  unconditionally rather than only on hover/selection like every other
  floating element.

### Named Rules
**The Flat-By-Default Rule.** Shadows exist only as a response to state
(selection changing, a value that must float above the canvas) — never as
resting-state surface decoration. If a new component wants a shadow "to
look nice," that's the tell it should be a border instead.

## 5. Components

### Buttons / Chips
- **Shape:** pill (`border-radius: 999px`) for all role/style/variant
  toggles ("chip" pattern — node kind, text size, sim role, hardware
  profile compression); rectangular `8px` radius for action buttons
  (Export/Upload/Start/Pause/Reset) and `6px` for compact/destructive
  buttons.
- **Resting:** 1px hairline border, paper background, slate text.
- **Hover:** border turns Signal Orange — universal across every button
  variant in the app; the only exception is destructive buttons, whose
  hover border turns Danger red instead.
- **Active/selected (chip-active):** Ink text, Signal Orange border, plus
  a 1px accent-tinted ring (`rgba(255, 71, 21, 0.4)`) — border color alone
  is never the only signal for "this is selected."
- **Disabled:** `opacity: 0.5`, cursor reverts to default; no separate
  disabled color palette.

### Inputs
- Hairline border, `8px` radius (bare text fields) or inherits the
  surrounding field's radius; Ink text, paper background. No focus-ring
  color currently differs from the browser default — every input sits
  inside a `.lab-field` label wrapper with an 11px Slate caption above it.

### Panels (Sidebar / Inspector)
- Flat paper background, single hairline border on the panel's inner
  edge (right for Sidebar, left for Inspector) — no shadow, no rounded
  corners at the panel level. Section titles are uppercase, Slate,
  11–12px, tracked (`letter-spacing: 0.04em`).

### Status badges & meters (feature 010 — Kafka simulation UI)
- **Shape:** pill, Warm Stone resting border.
- **Saturated:** solid Signal Orange border. **Degraded:** dotted Signal
  Orange border. The two are never distinguished by color alone — border
  *style* carries the difference, satisfying the low-contrast-token
  accessibility fallback.
- **Binding meter/formula row:** Ink text, `font-weight: 600`, a Signal
  Orange bottom border/left border — always paired with the word
  "(binding)" in the label text itself, never a color-only cue.

### Formula cards
- **Shape:** `6px` radius, hairline border; Signal Orange border only
  when that formula `isBinding`. Body copy in Slate, values/expression in
  the field's own monospace body size; source citations render as
  Signal-Orange-colored external links.

### Canvas nodes
- **Shape:** `8px` radius, hairline (Warm-Stone-tinted) border, paper
  background. This box is invariant — its border-width and border-style
  never change for any simulated status (only its border-*color* may).
- **Active/selected:** Signal Orange border + the color-mix ring above.
- **Dim:** dashed border, Slate text — a user-chosen style variant (not a
  simulated status), communicating "de-emphasized" without touching
  opacity (which would also wash out an attached image).
- **Saturated (feature 010):** border-color swaps to Signal Orange (still
  1px, still solid — a color change, not a shape change) plus a blurred,
  no-spread glow (`box-shadow`, fades to transparent) that breathes
  smoothly. A hard-edged ring around the node was tried and rejected: even
  positioned outside the node's own box, its crisp edge still read as
  "this node got bigger" — a glow that fades to nothing avoids that
  entirely and never affects canvas layout.
- **Degraded (feature 010):** same border-color swap and glow mechanism;
  distinguished from saturated only by the glow's *animation pattern* —
  an abrupt, stepped flicker instead of a smooth breathing fade, and
  faster — never by shape, ring style, or color alone. The node's own
  border and footprint never differ from any other node's.

### Named Rules
**The Invariant-Node Rule.** A node's own box (size, border-width,
border-style, visual footprint) never changes for any simulated status —
nodes are meant to be visually interchangeable geometry, including any
glow/shadow effect layered on top of them, which must fade rather than
form a hard second edge. Status is communicated only via (a) a
border-color swap and/or (b) an animation whose fade/timing pattern
differs — never by resizing, restyling, or drawing a crisp outline around
the node element.

**The Border-Style-Not-Color Rule.** Any two states that must both use
the accent color (saturated vs. degraded, binding vs. not) are
distinguished by border style/weight/text or animation pattern, never by
shade of the same orange. This is a hard accessibility floor, not a
nicety — enforced across badges and meters via border style, and across
nodes via glow animation pattern (see the Invariant-Node Rule above)
rather than the node's own border, which stays shape-invariant.

## 6. Do's and Don'ts

**Do:**
- Reuse `--token-primary`/`--token-secondary` for any new accent need;
  every export target and every existing component already reads these
  two variables.
- Keep new UI text in JetBrains Mono unless it is genuinely the app's own
  title/wordmark.
- Pair any new saturated-accent state with a second, non-color signal
  (border style, weight, icon, or text) — never ship a status that only a
  fully sighted, full-contrast user can distinguish.
- Keep new floating/portal-rendered elements (tooltips, edge labels,
  toolbars) flat with a hairline border by default; reach for the
  "floating readout" shadow only when the element must read as detached
  from the canvas.

**Don't:**
- Don't introduce a third brand color. The system intentionally has
  exactly two user-configurable tokens; a genuinely new token requirement
  is a constitution-level discussion, not a component-level choice.
- Don't reach for `--accent`, `--sans`, `--code-bg`, or `--social-bg` —
  they are unused scaffold leftovers, not part of this design system.
- Don't add resting-state shadows/gradients "to look nice." Flat +
  hairline border is the default; shadows are reserved for the exceptions
  in §4.
- Don't add decorative motion. The only animation in the product (edge
  flow speed/density) encodes a real simulated value; anything that
  doesn't encode data doesn't belong here.
