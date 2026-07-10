# Co-Create Sales & Distribution Audit — Live V3 Re-Audit

Date: 2026-07-09
Status: design-partner readiness re-scored with authenticated production evidence; competitor scan refreshed (all sources re-accessed 2026-07-09).

Note: this document supersedes `Gbedu-Desk-Strategy.md` sections 3–4 for current GTM planning (carried from V2).

## Executive Read

The distribution surface went from zero to real in one cycle: a public landing with the wedge, a working waitlist (`POST /api/waitlist` → 201, idempotent, live-tested), an invite door, and a first outbound motion (the Ultra Successful cold pitch, 2026-07-02 cycle). The funnel now exists end-to-end and was walked by a stranger-account without founder help.

But the pilot itself is not safe to start this week, for three reasons this audit proved rather than suspected. (1) Every partner would draft in the *founder's* voice first (product P0) — the pilot's core question dies on contact. (2) Spend is uncapped and the effective model ladder is the expensive one: $0.093/piece measured live, any-user-flippable to Premium (model P0s). (3) The single shared invite code is now also a measured weakness — it is one common word, it appears in this repo's docs, and registration grants immediate uncapped generation. Fix the three, then invite the first five writers; the machine on the other side of the door works.

## Acceptance-Criteria Scorecard (scored against V2's own criteria)

| V2 criterion | Status | Evidence |
| --- | --- | --- |
| A stranger with an invite can reach a first draft in one sitting without founder hand-holding | Met | Live dry run 2026-07-09: register → messy note → 830-word draft, ~42s generation time, zero founder involvement. |
| Every competitor claim has a URL and access date, or is omitted | Met | Refreshed table below; unverifiable rows say so explicitly. |
| No paid launch until spend caps, ToS/privacy, support path, and naming review exist | Held (gate respected) | No billing shipped. But note: spend caps remain unset even for the *free* pilot — see P0. |
| Founder can point to a published piece made with Co-Create as the demo | Unverified | Not checkable from the repo; founder attestation needed (cadence item in `docs/design-partner-guide.md`). |

## Funnel State (live-tested 2026-07-09)

| Funnel step | Status | Evidence |
| --- | --- | --- |
| Public landing with promise + proof slot | Met | `live-landing-desktop-2026-07-09.png`; wedge copy verbatim from this doc's positioning. |
| Waitlist capture | Met | `POST /api/waitlist` → 201; stored idempotently; counted in `/api/admin/readiness`. |
| Invite → register (fail-closed) | Met | Wrong code → 403; valid code → 201. |
| Register → first draft | Met | Full pipeline live-run (see model audit table). |
| Activation telemetry | Met | `activation_events` + `partner_feedback` recorded during the run; `scripts/design-partner-readiness.ts` reads them. |
| Per-partner safety (caps, invite hygiene) | Unmet | No default cap env set; one shared guessable invite code; any user can flip the global model profile. |

## Competitor Scan (refreshed; all accessed 2026-07-09)

| Product | What it sells | Pricing evidence | Change since 2026-07-01 | Co-Create implication |
| --- | --- | --- | --- | --- |
| [Lex](https://lex.page/pricing) | Distraction-free AI editor bundling premium models | Pricing page shows Pro + Teams, no public numbers | None observed | Model-access is their pitch, not voice; wedge holds. |
| [Sudowrite](https://www.sudowrite.com/pricing) | Fiction-writer AI (Muse model) | $10 / $22 / $44 monthly tiers | None observed | Still fiction-only; essayist lane open. |
| [Jasper](https://www.jasper.ai/pricing) | Marketing AI platform | Pro $59/mo annual, $69 monthly; Business custom | Repositioned around "GEO & AI Optimization" + new agents | Moving further from solo writers — helpful drift. |
| [Typeshare](https://typeshare.co/) | Templated social/atomic-essay tool | **Site unreachable (ECONNREFUSED, 2026-07-09)**; no pricing verifiable | Possible dormancy/shutdown | If confirmed, its creator audience is unclaimed — watch and re-check. |
| [Copy.ai](https://www.copy.ai/prices) | GTM automation platform | Chat $29/mo ($24 annual); Growth $1k → Scale $3k/mo | None; fully exited solo-writer market | Not a competitor for this ICP anymore. |
| [Writer](https://writer.com/) | Enterprise agentic AI | Own site blocked fetch (403); third parties list Starter ~$29/user/mo (unverified) | None verifiable | Enterprise lane; irrelevant to solo wedge. |
| [Notion AI](https://www.notion.com/pricing) | AI inside workspace | Plus $10 / Business $20 per member/mo; agent credits $10/1k; "Workers" beta free until Aug 11, 2026 | New credit-metered background agents | Workspace context play; not a voice chamber. |

**New entrants in the voice-clone-writing pattern:** [Shortwave Ghostwriter](https://www.shortwave.com/blog/introducing-ghostwriter-ai-writing-that-learns-from-you/) (drafts in your voice from email history — email-scoped) and [Oiti](https://www.ghostwriting-ai.com/) (LinkedIn "digital clone" ghostwriter). **No direct competitor found** doing archive-trained voice-lock + anti-slop gating for essayists/newsletter authors — but the *pattern* is spreading through adjacent niches, which shortens the window for claiming the essayist wedge publicly.

## Positioning (unchanged, now shipped)

ICP, wedge, promise, and sharp line carry from V2 — and are now live on the landing page verbatim. The scan reinforces the sharp line: the adjacent voice-clone entrants are channel-scoped (email, LinkedIn); Co-Create's claim is the *published body of work*.

## Stage 1 — Design-Partner Readiness (P0, revised by live evidence)

Blockers found this cycle (all verified live, details in model/product/UX audits):
1. Founder-voice seeding invalidates "Did it sound like you?"
2. No spend cap default + any-user global profile switch + premium-pinned ladder = uncontrolled unit cost ($0.093/piece measured).
3. Invite hygiene: one shared, guessable code ("Pelz"-class), present in internal docs, granting immediate generation. Minimum fix: rotate to a long random code per wave; better: per-partner codes so activation is attributable.

Already ready (verified): funnel, activation telemetry, feedback capture, concierge docs, readiness script.

### Closure update — 2026-07-10

- **Blocker 1 (founder-voice seeding) → closed:** brand-new owners now get a neutral starter voice; verified locally.
- **Blocker 2, half closed:** the any-user global profile switch is now admin-gated (403 for non-admins, verified locally). Spend caps and the Railway `MODEL_*` ladder-masking question remain founder-only ops actions — not resolved by this build.
- **Blocker 3 (invite hygiene) → still open:** rotating the shared invite code and/or moving to per-partner codes is a Railway env change, not attempted here.

## Stage 2 — Paid-Launch Runway (P1/P2, unchanged gates)

P1: naming review (now urgent — public surface exists), ToS/privacy completion, support contact on the landing page, pricing hypotheses **after** pilot usage data. The measured $0.093/piece on the current ladder vs ~$0.01 on cost-first is now a real COGS input for pricing: at Sudowrite-anchor $10–22/mo, cost-first supports hundreds of pieces/user/mo; the pinned ladder supports ~100–200.
P2: billing, referral loop, status page, integrations (all still gated on the conversion evidence rule).

## Metrics (unchanged targets, instrumentation now live)

Activation <20 min notes→draft; voice-match ≥80%; light-edit ≥80%; repeat ≥50% in 14 days; conversion gate: 5 partners × 2 sessions, 3 would pay. The readiness script can now compute the first three from production data.

## P0 / P1 / P2

**P0** — Fix the three pilot blockers (voice seeding, caps+profile gating+ladder decision, invite rotation); then invite wave 1 (5 writers) with concierge support; founder publishes weekly with the tool.
**P1** — Naming review; ToS/privacy finalization; support contact; per-partner invite codes; pricing hypotheses from pilot COGS + usage.
**P2** — Billing, referral, status page, export integrations, public case studies.

## Acceptance Criteria V3

- Wave-1 invites go out only after the three P0 blockers are verified closed on production.
- Each design partner's activation events are attributable to their invite.
- Unit cost per piece on the chosen default ladder is a recorded, founder-approved number.
- Typeshare's status is re-checked once before positioning claims reference it.
