# Co-Create User Experience Audit — V3 (first edition)

Date: 2026-07-09
Status: new sixth lens; audits the *experienced* journey on production, not the intended one. Method: a fresh account (`audit-v3@cocreate.test`, invite code) executed the design-partner dry run end-to-end against `https://writing-engine-production.up.railway.app` — registration, Bring, live Draft, one Polish move, Save, feedback — via the real UI (Playwright, desktop 1280px + mobile 390px) and the API, with timings and screenshots.

## Executive Read

The happy path is real. A stranger with the invite code can register without help, land directly on a warm, legible Bring screen, and reach a finished draft; the feedback instrument fires and stores; the spend meter is accurate to the tenth of a cent. The core loop the last two audit cycles were building toward exists on production and works.

But the *first-session experience currently fails the pilot's own central question.* A brand-new user inherits the founder's voice as their "Default" — the Voice tab literally says "Here's how you sound" over someone else's register — and their first draft arrives with another writer's theology in it. Then, if they use the Sharpen move, the piece that lands in their Library is titled "Critique" and opens with an AI's critique of their writing. Both defects sit exactly on the two moments the product's promise depends on: *it sounds like you* and *it's still yours*.

## Closure update — 2026-07-10

- **P0 "new users inherit the founder's voice" → closed:** `getVoice()`'s brand-new-owner auto-create path now seeds a neutral `STARTER_VOICE_PROFILE` (empty pillars/spine/lexicon, generic register), never the founder's real `DEFAULT_VOICE_PROFILE`. Verified locally: a freshly-registered account's `GET /api/voice` returns `pillars: []`, `name: "Untitled voice"`. The founder's own account (legacy migration path) is unaffected — verified via a regression test.
- **P0 "Sharpen leaks critique into the saved piece" → closed:** the sharpen prompt now requires an explicit `<<<FINAL>>>` marker; `splitSharpenOutput()` separates critique from the revised piece before it is saved or titled. Verified locally: a saved draft after Sharpen is titled from the piece itself, with the critique available separately as a collapsed "What changed" disclosure in the client.
- **P1 "engine-room instruments in every sidebar" → closed:** Spend/model-ladder/usage-guard now render only inside the Labs drawer, in de-emphasized read-only form.

## Journey Scorecard (design-partner dry-run checklist, run live)

| Step | Status | Evidence |
| --- | --- | --- |
| Register a fresh account with the invite code, no hand-holding | Met | `POST /api/auth/register` → 201 with token; UI sign-in works ("Have an invite? Sign in" door → 2-field form). |
| Land ready to write | Met, with a caveat | Post-login lands directly on Bring ("Lay down what you have"). Caveat: no first-run welcome / "Build your voice" path appeared — see finding 1. |
| Reach a first draft in one sitting from a messy note | Met | Messy 60-word note → Frame 7.5s → Draft 34.6s → 830-word draft. Server-side time-to-first-draft ≈ 42s of generation. |
| One Polish move works end-to-end | Partly met | Sharpen returned a strong 1,203-word revision in 28.7s — but the raw output (critique + piece) leaked into the Library draft. See finding 2. |
| Save → feedback questions land | Met | Auto-save produced `draftPostId`; `POST /api/partner-feedback` → 201; `feedback_submitted` activation event recorded. |
| Spend is visible and accurate | Met | Sidebar Spend `$0.0927` exactly equals measured pipeline cost (0.0072 + 0.0210 + 0.0644). |
| Mobile is usable | Met | 390px: engine paints first, Bring/Draft/Polish/Done text labels visible, form legible. `live-create-mobile-2026-07-09.png`. |

## Live Findings

- **P0 — New users inherit the founder's voice.** `GET /api/voice` for a fresh account returns the founder's full profile (faith/theology pillar, spine, register) named "Default"; the Voice mirror renders "Here's how you sound" over it; the first frame generated "the Edenic impulse" for a note about todo apps. Consequence chain: the pilot's question "Did it sound like you?" is unanswerable — every partner's baseline is *your* voice. It also suppresses the first-run welcome: because a voice and show are pre-seeded, the "Build your voice / Just start" fork never shows, so the one moment that would fix this (teaching it *their* voice) is skipped. Evidence: `live-voice-desktop-2026-07-09.png`, frame response 2026-07-09.
- **P0 — Sharpen's critique leaks into the saved piece.** The sharpen stage returns `# Critique\n**Gate 1...**` followed by the revised piece (revision starts at char 1,935). The living-draft auto-save stores the whole blob; the Library card is titled "Critique" and displays the critique as the piece body. A design partner's "saved work" opens with an AI grading them. Evidence: `live-library-desktop-2026-07-09.png`, sharpen response 2026-07-09.
- **P1 — Engine-room instruments are in every writer's sidebar.** Spend, MODEL PROFILE select, USAGE GUARD, and the sentence "Explicit stage env vars still override this runtime profile" render for all users. This is founder/admin language on a writer's surface (see brand audit), and the select is also live ammunition (see model audit: any user can flip the global profile).
- **P1 — The profile select displays the wrong state.** UI showed "Balanced ladder" while the server reported `cost-first`. The select doesn't hydrate from `GET /api/model-profile`.
- **P1 — Library leads with instruments, not the work.** For a one-draft user, the Library opens with an Add Memory form, reading-order tooling, and "Shape the arc" before the single saved piece.
- **P2 — Post-detail modal blocks navigation.** While the detail modal is open, nav clicks are intercepted; closing affordance exists but an explicit Escape/overlay-click dismissal check belongs in the next click-through.

## What Worked (keep these)

- The Bring screen is the best surface in the product: one warm ask, fragment-inviting placeholder, the disabled-CTA hint ("Add a line or some notes to begin"), optional depth folded away.
- Draft quality on the live ladder was genuinely strong — the 830-word draft had a real spine and no slop-list tells.
- The feedback loop is frictionless (three fields, one optional note) and writes activation events for the readiness report.
- Landing → invite door → sign-in is a clean three-step funnel with no dead ends.

## Next Quality Bar

**P0**
- Ship neutral/empty default voice for new owners + surface the Build-your-voice fork on first login. "Did it sound like you?" must be measurable against *their* voice.
- Split sharpen output: persist only the revised piece (title from the piece); show the critique separately as an instrument (e.g., "What changed" affordance).

**P1**
- Hydrate the profile select from the server; move Spend/profile/guard behind Labs or an admin flag.
- Reorder Library: pieces first, instruments collapsed until >3 posts.

**P2**
- Add an explicit close/Escape test for the post-detail modal to the click-through script.

## Acceptance Criteria (V3)

- A brand-new production account's Voice tab shows *no inherited voice* — either an empty mirror with a build path, or a clearly-labeled neutral starter.
- After any Polish move, the Library piece contains only the piece; critique text appears only in a labeled instrument.
- A design partner cannot see or change global model policy from the writer surface.
- The dry-run checklist in `docs/design-partner-guide.md` passes on production with timings recorded per step.
