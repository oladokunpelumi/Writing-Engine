# Co-Create Model Audit — Live V3 Re-Audit

Date: 2026-07-09
Status: authenticated live re-audit against `https://writing-engine-production.up.railway.app` with a fresh invite-registered account and a real generation run (frame → draft → sharpen, $0.093 total spend). This is the first cycle with production-interior evidence; V2's headline "Unverified" items are now resolved — several in the wrong direction.

## Executive Read

The two-cycle question — "is cost-first actually live?" — finally has an answer, and it is **no**. The *setting* is cost-first (`GET /api/model-profile` → `{"profile":"cost-first"}`, authed, 2026-07-09), but the *effective ladder* is masked by per-stage `MODEL_*` env pins on Railway, exactly the scenario V1 and V2 warned about. A live run showed frame on `google/gemini-3.5-flash`, draft on `anthropic/claude-sonnet-4.6`, and sharpen on `anthropic/claude-opus-4.8`; cost-first maps all three stages to `z-ai/glm-5.2`. None of the observed models even appear in the cost-first rows, so these are environment pins, not profile output. Effective cost: ~$0.093 per piece vs a cost-first target near $0.01 — roughly 10×, with no spend caps set.

Worse, the profile control is a live multi-tenant hazard: `PUT /api/model-profile` accepts any authenticated user's token (verified live, 200), mutates `process.env` and the kv-persisted setting, and therefore silently changes every tenant's ladder. One enthusiastic design partner clicking "Premium polish" re-prices the whole deployment.

The good news is equally concrete: telemetry works end-to-end (latency/cost/fallback recorded per generation and the sidebar Spend meter matched measured cost to the tenth of a cent), the empty-output guard was armed but never needed (fallback `null` on all calls), and output quality on the current (expensive) ladder is high.

## Closure update — 2026-07-10

- **P0 "PUT /api/model-profile is any-user, global, durable" → closed:** the route now requires `x-admin-token` matching `ADMIN_TOKEN` (reusing `adminReadinessAllowed`, the same gate as `/api/admin/readiness`); a non-admin token now gets 403 (verified locally). The client's writable select was replaced with a read-only "set by the workspace admin" display.
- **P1 "profile select renders stale/incorrect state" → closed:** the client now hydrates the displayed profile from `GET /api/model-profile` inside `refresh()` (which runs post-login), not only in the pre-auth `bootstrap()` that was silently skipped for authenticated sessions.
- **Still open (founder-only, no dashboard access from here):** the Railway `MODEL_*` per-stage env-pin masking and the spend-cap env vars are unchanged — these require a Railway policy decision and env-var changes, not code.

## Acceptance-Criteria Scorecard (scored against V2's own criteria)

| V2 criterion | Status | Evidence |
| --- | --- | --- |
| A future audit can prove the live profile and every active per-stage override from production evidence | Met (the mechanism), Failed (the finding) | Authed `GET /api/model-profile` → `cost-first`; live generations expose the real per-stage models, proving overrides are active: frame=`google/gemini-3.5-flash`, draft=`anthropic/claude-sonnet-4.6`, sharpen=`anthropic/claude-opus-4.8` (all 2026-07-09). |
| One enthusiastic design partner cannot drain the shared OpenRouter key | Unmet | `GET /api/usage` for a fresh account returns spend but **no limit fields** → `DEFAULT_DAILY_COST_LIMIT_USD`/`_MONTHLY_` unset on Railway; no per-owner cap active. Cap machinery exists (`usage_limits` table, `scripts/set-owner-limit.ts`, env fallback in `repository.ts:1238`). |
| Every generation history row shows stage, provider, model, tokens, cost, latency, and fallback status | Met | Live responses carried `latencyMs` (6288 / 33589 / 27430) and `fallbackModel: null`; `/api/generations` returns rows with usage; History UI displays them. |
| Model recommendations tied to a real bakeoff or cited availability | Met | The 2026-06-30 bakeoff table stands; this audit adds live production quality/latency/cost datapoints per stage. |

## Live Generation Evidence (2026-07-09, fresh account, one full pipeline)

| Stage | Model actually used | Cost-first says | Latency (recorded) | Cost | Output |
| --- | --- | --- | --- | --- | --- |
| frame | `google/gemini-3.5-flash` | `z-ai/glm-5.2` | 6,288 ms | $0.0072 | Solid structured frame (cold open, want, spine). |
| draft | `anthropic/claude-sonnet-4.6` | `z-ai/glm-5.2` | 33,589 ms | $0.0210 | 830 words, genuinely strong, no slop tells. |
| sharpen | `anthropic/claude-opus-4.8` | `z-ai/glm-5.2` | 27,430 ms | $0.0644 | 1,203-word revision preceded by a critique block (see UX audit P0). |
| **total** | | | ~67 s | **$0.0927** | Sidebar Spend meter read exactly $0.0927. |

`google/gemini-3.5-flash` appears in **no** profile row → unambiguous env pin. Opus-on-sharpen matches the *premium* row → likely `MODEL_SHARPEN` pin.

## Live Findings

- **P0 — Effective ladder ≠ selected profile (masking confirmed).** Railway `MODEL_FRAME`/`MODEL_DRAFT`/`MODEL_SHARPEN` (at minimum) override cost-first. Decide deliberately: either remove the pins so the profile is the single source of truth, or codify today's pinned ladder as the intended profile and update `.env.example`'s doctrine. What is untenable is a Labs switch that reads cost-first while spending premium.
- **P0 — `PUT /api/model-profile` is any-user, global, durable.** Verified live with a non-admin token (200). It must be admin-gated (`ADMIN_TOKEN` or an owner-role check); as-is it is both a cost hazard and a cross-tenant privilege escalation.
- **P0 — Spend caps still absent in production.** Third consecutive cycle. Everything needed exists; it is one Railway env var (`DEFAULT_DAILY_COST_LIMIT_USD`) plus optionally `scripts/set-owner-limit.ts` per partner. At the observed $0.093/piece on the pinned ladder, an uncapped partner running 50 pieces/day ≈ $4.65/day/user.
- **P1 — Profile select shows stale state.** UI displayed "Balanced ladder" while the server reported cost-first; hydrate the select from `GET /api/model-profile` on mount.
- **P1 — `ADMIN_TOKEN` still unset/unshared.** `/api/admin/readiness` → 403; the readiness report remains unreadable from outside. (The workaround this cycle was a full authed journey; the endpoint is still the right long-term evidence surface.)

## Next Quality Bar

**P0**
- Reconcile the ladder: remove Railway per-stage pins **or** adopt them into the profile map; re-verify with one live generation per changed stage and record the result here.
- Admin-gate `PUT /api/model-profile`.
- Set `DEFAULT_DAILY_COST_LIMIT_USD` (suggest $1–2 for pilot accounts) and verify the 429 + brand-voice copy path live.

**P1**
- Fix profile-select hydration.
- Set `ADMIN_TOKEN`; capture `/api/admin/readiness` output in the next audit.

**P2**
- Revisit the local-provider (`LLM_BASE_URL`) milestone only after pilot usage shows which stages need privacy or cost relief.

## Acceptance Criteria V4

- One authed probe (`/api/admin/readiness` or equivalent) lists the *effective* model per stage, and it matches the selected profile with zero silent pins.
- A non-admin token receives 403 from `PUT /api/model-profile`.
- A pilot account that exceeds its daily cap receives the branded 429 (verified live once).
- Per-piece pipeline cost on the default ladder is recorded in this doc from a live run, and the founder has explicitly chosen it.
