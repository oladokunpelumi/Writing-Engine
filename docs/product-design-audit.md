# Co-Create Product Design Audit — Live V3 Re-Audit

Date: 2026-07-09
Status: first audit with an authenticated production journey — a fresh invite-registered account ran the full design-partner path (register → Bring → live Draft → Sharpen → Save → feedback) on `https://writing-engine-production.up.railway.app`.

## Executive Read

V2's biggest unknown — "brand-new production activation is proven" — is now answered in both directions. The path works: a stranger with the invite code registers unaided, lands on Bring, and gets a real, good draft from a messy note in under a minute of generation time. The feedback instrument (V2's P1) shipped and fires correctly, writing activation events the readiness script can read.

But the first session betrays the product's two core promises at their exact moments of truth. Promise one, *it writes as you*: a new user starts with the founder's voice installed as "Default," so their first draft sounds like the founder, and the pre-seeded voice suppresses the first-run "Build your voice / Just start" fork that was designed to prevent precisely this. Promise two, *still yours*: the Sharpen move auto-saves its raw output — critique first — so the user's Library shows a piece titled "Critique" that opens with an AI grading their writing. Neither is an edge case; both happen on the canonical happy path the design-partner guide scripts.

## Closure update — 2026-07-10

- **P0 "the seeded Default voice is the founder's" → closed:** brand-new owners now get a genuinely neutral starter voice (`STARTER_VOICE_PROFILE`); the founder's own account keeps its real voice via the untouched legacy-migration path. Verified locally with a fresh registration.
- **P0 "Sharpen's auto-save stores the critique" → closed:** sharpen output is split on an explicit marker before saving; only the revised piece is persisted/titled. Verified locally: a saved draft's title now comes from the piece, not "Critique".
- **P1 "Library hierarchy inverts for small libraries" → closed:** the Library now shows the writer's own pieces before the Add-Memory/reading-order instruments once the library has 3 posts or fewer.

## Acceptance-Criteria Scorecard (scored against V2's own criteria)

| V2 criterion | Status | Evidence |
| --- | --- | --- |
| A stranger with an invite can reach a first draft in one sitting without founder hand-holding | Met | Fresh account, 2026-07-09: register 201 → Bring → frame 7.5s → draft 34.6s → 830-word draft. No founder involvement. |
| The first draft path is observable: start time, first draft time, save event, and feedback | Met | `activation_events` + `partner_feedback` live; feedback POST → 201 with a `feedback_submitted` event; generation timestamps + latency stored per stage. |
| The owner's migrated library is visible to the intended owner account | Met (carried) | Closed 2026-07-02 (37 posts on the registered owner; 0 on `owner-default`); unchanged since. |
| Core path copy avoids do-not-list language | Met on writer surfaces, Unmet in the sidebar | Bring/Draft/Polish/Done copy is clean; the sidebar ships "Explicit stage env vars still override this runtime profile" and "USAGE GUARD" to every writer (see brand audit). |

## Journey Findings (live, in order encountered)

- **Register → land: clean.** The invite door ("Have an invite? Sign in") reads naturally; register with the code lands directly in Create/Bring. **Gap:** the intended first-run welcome with the "Build your voice" fork never appeared — pre-seeding a default voice and show makes every account look like a returning user, so the single most important onboarding decision (teach it *your* voice vs just start) is silently skipped.
- **P0 — The seeded "Default" voice is the founder's.** Pillars ("Faith and theology…"), spine, register, constraints — all the founder's, attached verbatim to every new owner. The Voice mirror then asserts "Here's how you sound." over it, and the first frame for a todo-app note produced "the Edenic impulse." The pilot's core metric ("Did it sound like you?") cannot produce a meaningful answer while this holds. Fix shape: seed an explicitly neutral starter (named "Starter — not you yet") or no voice + a mirror empty-state routing to Build-your-voice. Evidence: `GET /api/voice` on the fresh account; `live-voice-desktop-2026-07-09.png`.
- **P0 — Sharpen's living-draft auto-save stores the critique.** Sharpen returns critique + revised piece as one blob (revision begins at char 1,935 of the response); `upsertDraft` saves it whole; the Library card takes "Critique" as its title and the critique as its opening body. The move's *output contract* (what part is "the piece") needs to be structural, not conventional — return `{critique, revised}` or delimit and parse before persisting. Evidence: `live-library-desktop-2026-07-09.png`.
- **P1 — Library hierarchy inverts for small libraries.** A one-draft user sees Add Memory, reading-order seeding, and "Shape the arc" above their single piece. Instruments should collapse until the library earns them (e.g., >3 posts).
- **P1 — Voice mirror remains form-heavy below the portrait** (carried from V2, unchanged).
- **Positive:** the disabled-CTA hint, the "other side" contradiction field, the ember-wash Bring panel, and the feedback capture's three-question brevity all survived contact with production intact.

## Next Quality Bar

**P0**
- Neutral default voice + restore the first-run fork for genuinely-new accounts (voice absent, or unmodified-seed detection).
- Fix the sharpen output contract so only the revised piece persists as the draft; surface the critique as a "What changed" instrument.

**P1**
- Library: content before instruments below a post-count threshold.
- Re-run the founder dry run after the P0s land; record step timings in `docs/design-partner-guide.md`.

**P2**
- Voice mirror "more this / less that" → re-distill loop (carried).

## Acceptance Criteria V3

- A new account's first draft is generated against either *their* imported voice or an explicitly neutral starter — never another author's profile.
- After Sharpen, Library shows the piece's own title and body; critique text is never the piece.
- The first-run fork (Build your voice / Just start) renders for every genuinely-new account on production.
- "Did it sound like you?" pilot responses are attributable to a voice the user actually owns.
