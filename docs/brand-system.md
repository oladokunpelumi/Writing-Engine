# Co-Create Brand System - Live V2 Re-Audit

Date: 2026-07-01
Rendered identity: `docs/brand/brand-system.html`

## Executive Read

The brand system is no longer only a document. Production now ships the Co-Create name, mark, favicon, meta description, and OG asset; the local mock app carries the "messy is welcome", "written as you", and "Still yours. Now shaped." language through the core path.

The public-launch blocker is not the identity itself. At audit time, the largest distribution hygiene issue was a relative OG image; Design-Partner Readiness P0 changed `client/index.html` to the absolute production URL. Naming/search/trademark review is still open, and there is no public landing/waitlist surface for the brand promise outside the app and README.

Implementation follow-up, 2026-07-01: `docs/brand/brand-system.html` now states the ember contrast rule and avoids normal-size ember text in small labels.

## Acceptance-Criteria Scorecard

| Criterion | Status | Evidence |
| --- | --- | --- |
| Product title is Co-Create | Met | Production root HTML contains `<title>Co-Create</title>`. |
| Meta description exists | Met | Production root HTML contains "Bring the unfinished self. Leave with transformed work that still sounds like you." |
| Bespoke mark is live | Met | `/favicon.svg` returns the custom mark; production screenshot shows it on login. |
| OG image exists | Met | `/og-image.svg` returns `200`; `client/index.html` references it with the absolute production URL. |
| Core promise appears in product | Met | Local screenshots show "Lay down what you have", "written as you", and "Still yours. Now shaped." |
| Brand artifact exists | Met | `docs/brand/brand-system.html` exists and uses the same tokens/mark family. |
| Naming/search/trademark review complete | Unverified | No legal/search artifact exists in repo; this remains P1 before public launch. |
| Do-not-copy sweep complete | Partly met | Core path screenshots pass; full production bundle was not exhaustively audited because browser-harness attach was blocked. |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Production root HTML | Title, description, OG title/description/type/image, favicon link. |
| Production JS bundle | Contains Co-Create, mock/local profile UI, Voice mirror, and core path copy; no obvious visible "Gbedu Desk" in fetched bundle excerpt. |
| Screenshots | Production auth shell plus local mock journey saved in `docs/audit-assets/`. |
| Source assets | `client/public/favicon.svg`, `client/public/og-image.svg`, `docs/brand/logo-mark.svg`, `docs/brand/logo-horizontal.svg`. |
| Contrast | Ember fails normal text contrast; dusk/ink/tide pass on paper. |

## Live Findings

- **P0 closed in Design-Partner Readiness: absolute OG URL.** Verify on the deployed HTML after release.
- **P0 closed in Design-Partner Readiness: contrast usage rule.** Ember is a brand accent, not a body text color at current values.
- **P1: naming/search review.** "Co-Create" is strategically right but generic; public launch needs trademark/search confidence and a canonical URL strategy.
- **P1: no public brand surface.** The app is invite-only, which is correct, but there is no waitlist or public page that teaches the promise.

## Next Quality Bar

**P0**
- Verify absolute `og:image` with a social-card debugger after deploy.
- Keep the brand artifact's contrast note current as new token usages are added.

**P1**
- Complete naming/search/trademark review.
- Ship a minimal public waitlist/landing surface only after design-partner P0s are closed.

**P2**
- Expand the icon system only if repeated UI surfaces need it; do not add decorative mystic clutter.

## Acceptance Criteria V2

- A shared production URL displays the intended title, description, and image card.
- The brand system includes contrast-safe usage rules for every token.
- A public-launch reviewer can find a naming/search decision record.
- The product, README, and future landing page use one consistent wedge: "It doesn't write for you. It writes as you."
