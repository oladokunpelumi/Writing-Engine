# Co-Create Visual / UI Audit — Live V3 Re-Audit

Date: 2026-07-09
Status: first fully-authenticated visual audit — production landing, auth, Create, Library, Voice, Labs, and mobile captured live (`docs/audit-assets/live-*-2026-07-09.png`). Tokens unchanged since V2 (no commits touching `tailwind.config.ts`/`styles.css` since 2026-07-02), so V2's computed contrast ratios carry forward.

## Executive Read

The product now has a public face, and it is the strongest visual surface Co-Create ships: the landing page is calm, on-brand, and confident — the mark, the two-line promise with tide-colored "for/as" emphasis, one email field, one door, and "Messy is welcome here." as the quiet sign-off. The authenticated Create screen matches V2's intent: warm ember-wash Bring panel, legible step spine, disabled-CTA hint present, engine-first mobile with visible step labels at 390px (V2's P1, now closed on production).

The visual problem this cycle is not pixels but *placement*: the sidebar mixes writer surfaces with operator instruments. Every user sees Spend, a MODEL PROFILE select, a USAGE GUARD box, and the sentence "Explicit stage env vars still override this runtime profile." That block breaks the visual register (dense, technical, ALL-CAPS labels stacked under the calm nav), misstates state (the select showed "Balanced ladder" while the server reported cost-first), and hands every tenant a live global control (see model audit P0).

## Closure update — 2026-07-10

- **P1 "operator block breaks the writer surface" → closed:** Spend, the model-ladder display, and the usage guard now render only inside the Labs drawer, de-emphasized and in read-only form; the always-visible sidebar no longer carries this block.
- **P1 "profile select renders stale/incorrect state" → closed:** now hydrated from the server on every `refresh()`, and is display-only (see model audit P0-3 closure).
- **P1 "Library visual hierarchy inverts" → closed:** posts now render before the Add-Memory/instrument panel when the library has 3 posts or fewer.

## Acceptance-Criteria Scorecard (scored against V2's own criteria)

| V2 criterion | Status | Evidence |
| --- | --- | --- |
| Shared links render a card with the Co-Create mark on major social scrapers | Met (HTML side) | Production HTML emits absolute `og:image` (`https://writing-engine-production.up.railway.app/og-image.svg`, 200, 2026-07-09). Scraper-side render still unchecked against a card debugger. |
| No normal-sized text uses ember on paper/ember wash unless ≥4.5:1 | Met | Live screens show ember only on badges ("MESSY IS WELCOME HERE."), washes, and accents; body text is ink/dusk. Tokens unchanged since the V2 fix. |
| Mobile first paint shows the engine and each step is identifiable without guessing | Met | `live-create-mobile-2026-07-09.png`: top bar + numbered steps **with** Bring/Draft/Polish/Done text labels at 390px. |
| Audit screenshots reproducible from a documented script or working harness attach | Met | This cycle's captures come from a Playwright script (scratchpad `ux-journey*.mjs` pattern) against production with the test account; harness attach remained blocked (see P2). |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Landing (desktop + 390px) | Mark, promise, sub-promise, invite-request card, sign-in door, "Messy is welcome here." Clean hierarchy, generous whitespace. |
| Auth screen | Minimal two-field card, register toggle, back link. |
| Create (authed, desktop) | Step spine, ember-wash Bring panel, disabled-CTA hint "Add a line or some notes to begin." visible. |
| Sidebar (authed) | Nav + Spend $0.0927 + MODEL PROFILE select (reading "Balanced ladder" against server cost-first) + USAGE GUARD + env-var caveat sentence + Log out. |
| Library (authed, 1 draft) | Instruments (Add Memory, order seeding, arc) render above the single post card; post card shows raw "# Critique" body (defect logged in product/UX audits). |
| Voice (authed) | Dusk "MIRROR — Here's how you sound." treatment renders as designed; content is the seeded founder voice (product P0, not a visual defect). |
| Contrast (carried from V2, tokens unchanged) | Ink 15.74:1, dusk 5.21:1, tide 4.75:1 on paper pass; ember 3.43:1 accent-only rule in force. |

## Live Findings

- **P1 — Operator block breaks the writer surface.** Spend/MODEL PROFILE/USAGE GUARD/env-caveat form a dense technical stack under the calm nav — wrong register, wrong audience, and visually the heaviest element on an otherwise quiet screen. Move behind Labs or an admin-only flag; restyle whatever remains in brand voice.
- **P1 — Profile select renders stale/incorrect state** ("Balanced ladder" vs server cost-first). A control that misreports global state is worse than no control.
- **P1 — Library visual hierarchy inverts** for small libraries: three instrument panels outrank the user's only piece.
- **P2 — Social-card render still unverified on a scraper debugger** (HTML is correct; the card itself hasn't been seen).
- **P2 — browser-harness attach still blocked** (Chrome Allow handshake); Playwright fallback is scripted and repeatable, so this is now tooling debt rather than an evidence gap.

## Next Quality Bar

**P0**
- None purely visual this cycle — the visual P0s from V1/V2 (OG URL, ember contrast, mobile labels) are all verified closed on production.

**P1**
- Relocate/gate the operator block; fix profile-select hydration; reorder Library for small libraries.

**P2**
- Run the OG card through a social debugger once; capture a reduced-motion reveal screenshot; unblock the harness attach once for parity.

## Acceptance Criteria V3

- No operator instrument (spend, model policy, env caveats) is visible to a non-admin account.
- Every control that displays global state reads that state from the server on mount.
- A one-piece Library visually leads with the piece.
- A social-card debugger screenshot of the OG render exists in `docs/audit-assets/`.
