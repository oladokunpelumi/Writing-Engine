# Co-Create Model Audit - Live V2 Re-Audit

Date: 2026-07-01
Status: live product re-audit against `https://writing-engine-production.up.railway.app`

## Executive Read

The live product is running the right broad architecture for the cost thesis: production reports `aiProvider: "openrouter"`, vector retrieval is enabled, and auth is required. The repo also now contains the cost-first profile resolver, Labs model-profile control, empty-output retry/fallback logic, and generation cost telemetry.

The live risk is not the code path. It is operational certainty. The public app confirms OpenRouter and auth, but the effective production ladder is auth/admin-gated: `/api/model-profile` requires a token and the Railway CLI is not available in this workspace. The deployment should therefore be scored as **mostly implemented, partly unverified** until Railway variables or an authenticated model-profile check confirm that per-stage `MODEL_*` overrides are not masking the intended cost-first profile.

## Closure update — 2026-07-02

- **P1 "history is close but incomplete" → closed:** `latency_ms` and `fallback_model` are now recorded per generation (chat, streaming, and empty-output-fallback paths) and displayed in History.
- **P1 "model-profile control is runtime-local" → closed:** the profile persists in kv, is loaded at boot, and survives restarts (test-covered).
- Still open: Railway env confirmation of the effective production ladder (use `/api/admin/readiness` with `ADMIN_TOKEN` once set).

## Acceptance-Criteria Scorecard

| Criterion | Status | Evidence |
| --- | --- | --- |
| Production AI path is live | Met | `curl /api/health` returned `200` with `{"aiProvider":"openrouter","vectorRetrievalEnabled":true,"authRequired":true}` on 2026-07-01. |
| Auth gates model/profile internals | Met | Public `/api/model-profile` returned `HTTP/2 401 {"error":"Authentication required"}`; production health reports `authRequired: true`. |
| Model profiles exist in code | Met | `server/src/openrouter.ts` defines `cost-first`, `balanced`, and `premium`; `client/src/App.tsx` exposes a Labs "MODEL PROFILE" select. |
| Cost-first is actually the effective production profile | Unverified | `render.yaml` and `.env.example` default to `MODEL_PROFILE=cost-first`, but Railway env and per-stage overrides could not be read from this workspace. |
| Empty visible output has a retry/fallback guard | Met | `server/src/openrouter.ts` includes retry-on-empty paths in `rawChat` and streaming recovery; `server/tests/routing.test.ts` covers fallback behavior. |
| Generation history surfaces model/cost | Partly met | History UI states stage/model/provider/token/cost are shown; latency/fallback are explicitly called "ready for display once the server stores those fields." |
| Per-owner spend caps exist | Unmet | No quota/spend-cap route or table was found; this remains a GTM safety P0 before design partners. |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Production health | `HTTP/2 200`; OpenRouter, vector retrieval, auth required. |
| Production model profile | `HTTP/2 401`; effective profile cannot be read without auth/admin access. |
| Local mock health | `HTTP/1.1 200`; mock provider, vector disabled, auth disabled for screenshots. |
| Local screenshot | `docs/audit-assets/local-draft-2026-07-01.png` shows the runtime model profile select set to Cost-first in mock mode. |
| Typecheck | `npm run typecheck` passed for shared, server, and client. |
| Admin/Railway evidence | Unverified: `railway` CLI not present; browser-harness Chrome attach blocked by remote-debugging setup. |

## Live Findings

- **P0: effective ladder still needs admin confirmation.** Public production proves OpenRouter is live, not which model ladder is active. Confirm Railway `MODEL_PROFILE`, `MODEL_*`, `MAXTOK_*`, and `FUSION_*` variables before claiming the cost-first deployment is truly live.
- **P0: spend caps are missing.** Design partners can generate real OpenRouter cost; there is no visible per-owner quota, per-user daily cap, or admin kill switch beyond global provider limits.
- **P1: history is close but incomplete.** Cost/model/provider are stored and visible; latency/fallback are not yet stored as first-class fields.
- **P1: model-profile control is runtime-local.** The Labs switch mutates process env; it is useful for one server process, but not durable admin policy.

## Next Quality Bar

**P0**
- Confirm Railway env and record the effective production ladder in this doc.
- Add per-owner spend caps before inviting 5-15 design partners.
- Add an authenticated read-only `/api/model-profile` evidence capture to future audits.

**P1**
- Store and display latency, fallback model, and fallback reason per generation.
- Add explicit admin-only routing status: profile, overrides, max tokens, fusion/web-search modes.

**P2**
- Revisit `LLM_BASE_URL`/local provider sovereignty after design-partner usage shows which stages most need privacy or cost relief.

## Acceptance Criteria V2

- A future audit can prove the live profile and every active per-stage override from production evidence.
- One enthusiastic design partner cannot drain the shared OpenRouter key.
- Every generation history row shows stage, provider, model, tokens, cost, latency, and fallback status.
- Any model recommendation remains tied to a real bakeoff table or a cited provider availability check.
