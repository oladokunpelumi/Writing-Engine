# Co-Create Visual / UI Audit - Live V2 Re-Audit

Date: 2026-07-01
Status: live product re-audit against production shell plus identical local mock interiors

## Executive Read

The shipped v2 now looks like Co-Create rather than a generic writing app. Production serves the custom mark as favicon, the root HTML title is `Co-Create`, the OG image exists, and the local mock flow shows the intended chamber: notes-first Bring, warm Draft, grouped Polish moves, quiet Done, and mobile-first engine content.

At audit time, the highest live defect was outside the pixels of the app: `og:image` was a relative URL (`/og-image.svg`). Design-Partner Readiness P0 changed `client/index.html` to the absolute production URL. The second defect was accessibility: ember text on paper is only 3.43:1 and ember text on ember wash is 3.07:1, so ember is acceptable for badges/UI accents but not normal body text at WCAG AA.

Implementation follow-up, 2026-07-01: `client/index.html` now uses `https://writing-engine-production.up.railway.app/og-image.svg`, and normal-size product `text-ember` usage was removed in favor of ink/dusk/tide text with ember retained for accents.

Closure update, 2026-07-02: **P1 mobile step labels → closed** — Bring/Draft/Polish/Done text labels are now always visible (compact type + tighter connectors at 390px), not bare numbers.

## Acceptance-Criteria Scorecard

| Criterion | Status | Evidence |
| --- | --- | --- |
| Custom mark replaces stock icon | Met | Production `/favicon.svg` returns the bespoke two-stroke Co-Create mark; `live-welcome-2026-07-01.png` shows the mark on the auth shell. |
| Favicon and OG image exist | Met | `/favicon.svg` and `/og-image.svg` return `200`; `client/index.html` now points `og:image` to the absolute production URL. |
| Ember/dusk tokens exist and map to states | Met | `client/tailwind.config.ts` defines ember/dusk/washes; screenshots show ember for Draft/Done and grouped moves. |
| Mobile leads with the engine | Met | `local-mobile-create-2026-07-01.png` first paints the top bar, step spine, and Bring surface rather than a full sidebar. |
| Step labels remain legible | Partly met | Desktop labels are legible; mobile screenshot keeps numbered step controls but omits text labels at 390px. |
| Draft reveal is present | Met | `local-draft-2026-07-01.png` shows the warm elevated draft surface and "written as you" badge after the reveal state. |
| Living piece outranks instruments | Met | `local-polish-2026-07-01.png` keeps the draft centered below smaller move instruments. |
| Text contrast passes | Partly met | Ink 15.74:1, dusk 5.21:1, tide 4.75:1 on paper pass; ember 3.43:1 on paper and 3.07:1 on ember wash fail for normal text. |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Production root HTML | `<title>Co-Create</title>`, description present, `og:title`, `og:description`, `og:type`; source now uses absolute `og:image`. |
| Production favicon | `HTTP/2 200`, `content-type: image/svg+xml`, custom mark SVG. |
| Production OG image | `HTTP/2 200`, `content-type: image/svg+xml`, mark plus "Still yours. Now shaped." |
| Screenshots | `live-welcome-2026-07-01.png`, `local-bring-2026-07-01.png`, `local-draft-2026-07-01.png`, `local-polish-2026-07-01.png`, `local-done-2026-07-01.png`, `local-mobile-create-2026-07-01.png`. |
| Contrast ratios | Ember/paper 3.43:1; dusk/paper 5.21:1; ink/paper 15.74:1; tide/paper 4.75:1; ember/ember-wash 3.07:1; dusk/dusk-wash 4.83:1. |

## Live Findings

- **P0 closed in Design-Partner Readiness: social card URL is absolute.** Verify on the deployed HTML after release.
- **P0 closed in Design-Partner Readiness: ember text no longer carries normal product body copy.** Keep ember for badges/icons/borders or increase size/weight; use ink/dusk/tide for normal text.
- **P1: mobile step labels need one more pass.** The mobile layout is much better, but numeric-only steps are less self-explanatory than Bring/Draft/Polish/Done labels.
- **P2: browser-harness capture is blocked.** Chrome remote-debugging required profile/Allow setup; screenshots were captured via Playwright instead.

## Next Quality Bar

**P0**
- Verify absolute `og:image` on production after deploy.
- Keep ember reserved for non-body accents unless contrast is increased.

**P1**
- Restore compact mobile step labels or accessible visible text at 390px.
- Add screenshot coverage for reduced-motion reveal state.

**P2**
- Add a paper texture only if it remains subtle and does not lower contrast.

## Acceptance Criteria V2

- Shared links render a card with the Co-Create mark on major social scrapers.
- No normal-sized text uses ember on paper or ember wash unless it reaches 4.5:1.
- Mobile first paint still shows the engine and the user can identify each step without guessing.
- Future audit screenshots are reproducible from a documented local mock script or working browser-harness attach.
