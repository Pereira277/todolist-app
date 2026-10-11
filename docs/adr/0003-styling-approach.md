# ADR-0003: Styling approach for the frontend

- **Status:** Accepted
- **Date:** 2026-10-11

## Context
The design system was exported from the canvas mockups into `design/v0.1/canvas/ds/todoui/`,
with `tokens.json` (colors, type, spacing, radius, shadow) and a ready-made CSS bundle
(`components/bundle.css`) implementing the `td-*` classes used across the mockups.

This project has two goals: an AWS/SRE portfolio piece and SAA-C03 exam practice. The
frontend itself is intentionally small (a handful of screens: landing, auth, home), so the
styling approach should optimize for low maintenance and fast iteration rather than a bespoke
design-system implementation.

## Options considered
1. **CSS variables + CSS Modules:** reuse `bundle.css` almost as-is, scope component styles
   with CSS Modules. Pros: near-zero translation work, bundle already matches the mockups
   pixel-for-pixel. Cons: CSS Modules are a less common pattern in current Next.js projects,
   so it teaches less about the modern frontend ecosystem; styling logic (variants, states)
   stays in hand-written CSS.
2. **Tailwind v4:** map `tokens.json` into `@theme` in `globals.css`, rewrite the `td-*`
   components as utility classes. Pros: Tailwind v4's CSS-first config (`@theme`) maps
   cleanly onto a token file; it is the current market-standard styling approach, which
   serves the portfolio goal; utility classes keep variants (hover, disabled, responsive)
   inline with markup instead of in separate stylesheets. Cons: adds a dependency; every
   component from the design system must be manually translated to utility classes instead
   of reused as-is, so there is a risk of visual drift from the mockups if done carelessly.

## Decision
We chose **Tailwind v4**. Tokens from `tokens.json` are mapped into `@theme` in
`globals.css` (colors, spacing, radius, shadows, font family). Design-system components
(buttons, inputs, cards, etc.) are reimplemented with Tailwind utility classes, kept
faithful to the mockups in `design/v0.1/canvas/`.

## Consequences
- Positive: aligns with current market practice (useful for the portfolio goal); utility
  classes keep state variants close to the markup; token mapping via `@theme` keeps a single
  source of truth for design values.
- Negative / trade-offs: one more dependency; components from the design system must be
  translated by hand instead of reused directly, with a small risk of visual drift that
  needs manual checking against the mockups and PNG references.
- What needs revisiting, and when: if the number of screens grows significantly and utility
  classes become unwieldy, revisit extracting shared component classes with `@apply`.

## SAA-C03 relevance
None — this is a frontend tooling decision with no AWS service implications.
