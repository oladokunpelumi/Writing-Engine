# Co-Create Product Design Audit - Live V2 Re-Audit

Date: 2026-07-01
Status: live product re-audit against production shell plus local mock journey

## Executive Read

The core product design promise is now visible in the shipped product. A first-time local mock user can enter with notes, shape a draft, polish with relationship-named moves, and finish with "Still yours. Now shaped." The experience now feels more like a co-creator than a control panel.

The remaining risk is design-partner activation, not IA. Production is invite-only and auth-required, which is correct for this phase, but the journey cannot yet be audited end-to-end on production without an authenticated session. The next quality bar is a measured "invite DM -> registered account -> first draft in one sitting" path for a brand-new writer.

## Closure update — 2026-07-02

- **P0 "owner reassignment remains an admin-only risk" → closed:** production reassignment run; the registered owner account now holds all 37 posts + full content; 0 rows on `owner-default`; probe users deleted.
- The invite-to-first-draft dry run remains the founder's next action (checklist in `docs/design-partner-guide.md`).

## Acceptance-Criteria Scorecard

| Criterion | Status | Evidence |
| --- | --- | --- |
| Welcome/auth shell is branded | Met | `live-welcome-2026-07-01.png` shows Co-Create mark/name on production login. |
| Bring is notes-first | Met | `local-bring-2026-07-01.png` shows "Lay down what you have" and a primary notes textarea before detail fields. |
| CTA explains readiness | Met | Screenshot shows disabled "Shape it" on empty notes; `client/src/App.tsx` contains disabled begin copy. |
| Draft preserves authorship | Met | `local-draft-2026-07-01.png` shows "A first form. Still yours" plus editable draft area. |
| What changed / what it kept exists | Met | Draft screenshot includes both affordances above the text area. |
| Polish moves are relationship/grouped verbs | Met | `local-polish-2026-07-01.png` shows Shape, Reflect, Dress, and Check move groups. |
| Done settles rather than gamifies | Met | `local-done-2026-07-01.png` shows "Still yours. Now shaped." and quiet actions. |
| Voice mirror is implemented | Met from source/local route | `client/src/App.tsx` contains the Mirror treatment and `badge-dusk`; production interior is auth-gated. |
| Brand-new production activation is proven | Unverified | Requires authenticated production account and design-partner journey telemetry. |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Production health/auth | `authRequired: true`; production route is invite-only. |
| Production profile/auth probe | `/api/model-profile` returned `401 Authentication required`; interiors require authenticated session. |
| Registration negative probe | Invalid invite code returned `HTTP/2 403 {"error":"Invalid invite code"}`. |
| Mock journey screenshots | Bring, Draft, Polish, Done, and mobile Create screenshots saved under `docs/audit-assets/`. |
| Typecheck | `npm run typecheck` passed. |
| Authenticated production interior | Unverified: Chrome/browser-harness attach blocked; no credentials/session supplied in this run. |

## Live Findings

- **P0: invite-to-first-draft needs measured activation.** The local flow works, but the production design-partner funnel should be tested with a new account from invite to first draft.
- **P0: owner reassignment remains an admin-only risk.** The repo includes `scripts/reassign-owner.ts`; whether `owner-default` content has been reassigned in production could not be verified here.
- **P1: feedback loop is missing from the design-partner product surface.** There is no obvious in-app "this sounded like me / missed me" capture on Done.
- **P1: Voice mirror is strong but still form-heavy below the portrait.** Good enough for v2; next pass should make "more this / less that" an actual loop.

## Next Quality Bar

**P0**
- Run one real design-partner dry run: invite code, account creation, voice setup or skip, first draft, save.
- Confirm owner reassignment before the owner expects to see migrated library content.

**P1**
- Add a lightweight feedback instrument after Done: voice match, edit amount, and "what felt off?"
- Make "more this / less that" trigger a re-distill loop after imports.

**P2**
- Turn Library start-here arc into an onboarding asset for design partners: "read these three to understand the founder's voice."

## Acceptance Criteria V2

- A stranger with an invite can reach a first draft in one sitting without founder hand-holding.
- The first draft path is observable: start time, first draft time, save event, and feedback.
- The owner's migrated library is visible to the intended owner account before partner onboarding.
- Core path copy continues to avoid "optimize", "generate high-converting", and other do-not-list language.
