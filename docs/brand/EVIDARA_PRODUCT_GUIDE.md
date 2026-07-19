# Evidara Product Brand Guide

Source of truth: `docs/brand/Evidara_Brand_Book_v1.0.pdf`

## Brand line

**Evidence-Driven Student Development**

## Product principles

1. Clarity
2. Evidence
3. Humanity
4. Consistency

The interface must never turn one score into a permanent judgement of a student. Use calm, specific and constructive language.

## Core colours

| Token | Hex | Use |
|---|---:|---|
| Evidara Teal | `#0E5A5A` | Primary actions, trust and navigation |
| Insight Amber | `#F2B84B` | Selected insight and restrained emphasis |
| Midnight Ink | `#14232B` | Primary text and dark surfaces |
| Cloud White | `#F7F9F7` | Application background |
| Evidence Mist | `#DCE9E7` | Panels, selected states and dividers |
| Success | `#237A57` | Positive completion |
| Information | `#2E6D8B` | Neutral guidance |
| Warning | `#9A6508` | Attention required |
| Error | `#B54747` | System errors and destructive actions |
| Focus | `#2164D6` | Keyboard focus |

## Typography and layout

- Inter for display, body, UI and data.
- Arial, Helvetica and system sans-serif as fallback.
- Product body text should normally be at least 16 px.
- Interactive targets should be at least 44 px.
- Use the spacing rhythm 4, 8, 12, 16, 24, 32, 48 and 64.
- Prefer borders, spacing and tonal surfaces over heavy shadows.

## Logo rules

Approved product exports:

- `public/brand/evidara-logo-light.png` — horizontal lockup for light or Cloud White surfaces
- `public/brand/evidara-logo-dark.png` — horizontal lockup for Midnight Ink or Evidara Teal surfaces
- `public/brand/evidara-emblem.png` — compact navigation, favicon and icon use

Implementation rules:

- PNG assets use transparent backgrounds so the surrounding product surface remains continuous.
- Never place the logo inside an unnecessary white rectangle, holding card or clipped screenshot-style panel.
- Select the variant that belongs to the surrounding surface instead of recolouring with CSS.
- Do not redraw, stretch, rotate, add shadows or apply visual effects.
- Maintain clear space around the complete lockup.
- Use the emblem only when the horizontal lockup does not fit or the context is intentionally compact.

The earlier `public/brand/evidara-master.svg` is retained only as historical artwork and must not be used by the live product.

## Metric transparency rules

Every important number must explain:

1. What it means
2. How it is evaluated
3. Why it is useful
4. Any responsible-use limitation

Definitions are stored centrally in `src/lib/evidaraMetrics.ts` and displayed through `src/components/ui/MetricInfo.tsx`.

Development segments are temporary evidence groupings. They are recalculated after every valid comparable assessment and must never be described as fixed intelligence, identity or potential.

## Release boundary

Version 6.2 includes the PNG logo correction, metric explanations and transparent segment definitions. Universal table sorting, anonymous shared-paper benchmarking, badges and certificates remain separate later releases.
