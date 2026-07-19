# Evidara Brand System

**Version:** 1.0 · July 2026  
**Brand line:** Evidence-Driven Student Development

This repository document translates the approved Evidara Brand Book into product and engineering rules. The original PDF remains the visual source of truth for master artwork, logo clear space, print examples and visual references.

## Brand foundation

Evidara is a school assessment and student intelligence platform that turns evidence into practical development pathways.

The product experience follows four stages:

1. **Assess** — capture reliable evidence.
2. **Understand** — translate scores into context and patterns.
3. **Guide** — give a clear priority and practical next step.
4. **Develop** — track progress and refine support from new evidence.

Priority order for every product decision:

1. Clarity
2. Evidence
3. Humanity
4. Consistency

Never use language that predicts destiny, humiliates a learner, exaggerates certainty or treats one score as the whole student.

## Product voice

Always be:

- specific about what changed and where;
- calm rather than alarmist;
- constructive by pairing every gap with a next action;
- plain-spoken when explaining technical evidence;
- respectful and non-labelling.

Preferred pattern:

> Current evidence shows strong recall and an opportunity to improve application speed.

Avoid deterministic statements such as “the student is weak” or “unlikely to succeed”.

## Colour tokens

| Token | Hex | Product use |
|---|---:|---|
| Evidara Teal | `#0E5A5A` | trust, evidence, navigation, primary actions |
| Insight Amber | `#F2B84B` | selected insight, focus, one key highlight |
| Midnight Ink | `#14232B` | primary text, premium dark surfaces |
| Cloud White | `#F7F9F7` | product background |
| Evidence Mist | `#DCE9E7` | cards, selected rows, panels and dividers |
| Pure White | `#FFFFFF` | cards and reversed text |
| Success | `#237A57` | completed or positive change |
| Information | `#2E6D8B` | neutral guidance |
| Warning | `#9A6508` | attention required, not failure |
| Error | `#B54747` | system errors and destructive actions only |
| Focus | `#2164D6` | keyboard and interactive focus |

Typical composition ratio: 55% light space, 25% teal, 15% ink and approximately 5% amber. Amber is a signal, not a background habit.

Never rely on colour alone to communicate rank, status or urgency.

## Typography and layout

- Inter for display, body, UI and data.
- Fallback: Arial, Helvetica, system sans-serif.
- Minimum product body text: 16 px.
- Minimum touch target: 44 px.
- Use the 8-point spacing system: 4, 8, 12, 16, 24, 32, 48 and 64.
- Use borders, spacing and tonal surfaces before shadows.
- Desktop: 12-column grid. Tablet: 6. Mobile: 4.
- Keep most layouts to three visible text levels.

## Dashboard and data rules

- Teal is the primary data series.
- Amber identifies a selected point, target or critical insight.
- Neutral greys provide comparison context.
- Prefer bars and lines before pie charts. Never use 3D charts.
- Label data directly where practical.
- Always show the sample size and evidence window.
- Distinguish observation from prediction.
- Never visually exaggerate differences.
- Pair every insight with a next action.

## Metric explanation standard

Every decision-support metric must provide an accessible information control containing:

1. What the metric means.
2. How it is evaluated, including formula or evidence window.
3. Why it is useful.
4. What it cannot responsibly claim.

Metric rules are versioned in `metric_definition_versions` and mirrored in `src/lib/evidaraMetrics.ts`.

## Segment standard

Segments are temporary action groups, not labels of ability. Every segment must expose:

- the exact rule used;
- the evidence minimum;
- the recommended next action;
- the recalculation date or event;
- a responsible-use note.

## Shared benchmark privacy standard

A shared benchmark is valid only when participants answer the exact same paper version with the same marks, duration and scoring rule.

Public or cross-school results may contain:

- valid attempt count;
- assessment version and window;
- average and median;
- aggregate score bands;
- privacy-threshold status.

They must never contain:

- another school name or public school leaderboard;
- student name, email, phone or profile identifier;
- individual response sheet;
- individual row-level rank;
- a metric before the minimum privacy sample is reached.

The default minimum sample is 20 valid attempts.

## Certificates and achievements

Certificates use a constructive hierarchy:

1. summary and next action;
2. context and evidence;
3. strengths and opportunities;
4. development plan;
5. progress history;
6. method, limitations and privacy note.

Badges are issued only from documented evidence rules. They must not imply guaranteed success.

For co-branding, Evidara appears first on Evidara-owned material. The partner-school logo follows at equal optical height, separated by clear space or a neutral divider. Never merge or recolour the marks.

## Logo governance

The approved master artwork is the source of truth. Do not stretch, recolour, rotate, shadow, crowd, retype or rearrange the logo.

The product now renders `public/brand/evidara-master.svg` through `src/components/Logo.tsx`; the wordmark is no longer recreated with CSS. This asset was prepared from the approved master lockup in the supplied Brand Book for the Version 6 digital interface.

The committed SVG is a lightweight wrapper around a high-quality embedded digital image. It is suitable for the web pilot, but the original vector master supplied by the brand designer should replace it later without changing component usage.

Planned source-asset handoff:

- `public/brand/evidara-master.svg` — committed and in use;
- reversed master artwork — add when the original vector export is supplied;
- standalone symbol artwork — add when the original vector export is supplied;
- print-ready PDF/EPS source — retain outside the web bundle for production artwork.

On dark product surfaces, place the approved master lockup on a quiet white holding panel rather than recolouring or reconstructing it.
