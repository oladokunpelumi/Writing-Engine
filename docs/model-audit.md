# Co-Create Model Audit

Date: 2026-06-29
Supersedes: the prior model-audit pass (its $0.02 live bakeoff is carried forward as evidence below).

## Executive Read

The goal you set in the source images is right and now sharper: **cut operating cost ~80–90% by routing each task to the best intelligence-per-dollar model, with near-zero quality loss** — and, for the stages that touch private material, **own the model** (run it locally / self-hosted so nothing is banned out from under you and no data leaves).

Two principles drive this audit:

1. **A ladder, not one replacement model.** The Artificial Analysis chart you shared has a "most attractive quadrant" — high intelligence, low cost-per-task. Co-Create is *voice-critical*, so the right move is not to drop everything to the cheapest model; it is to put each stage on the cheapest model that still clears that stage's quality bar. Structuring/utility/bulk stages can fall a long way down the price curve; the voice-bearing stages cannot — yet.
2. **Sovereignty for the private path.** Your images' real thesis is not only price; it is *"not banned in a month, run locally, nobody steals my data."* That is a provider-independence requirement. Co-Create today is single-provider (OpenRouter only). The audit's second half is a concrete path to an OpenAI-compatible **local/self-hosted provider** so the engine survives any single vendor.

Recommended stance:

- **Cost-first** stages (cheap, high volume, low voice-risk): frame, discover, SEO, visual-prompt, swarm/experiments, signals-macro.
- **Balanced-strong** stages (voice matters, cost still matters): draft, refine, repurpose, synthesis, reviewgate.
- **Premium-on-demand** (voice-critical or high-stakes): Deep Sharpen (Fusion), final polish, Grid story + critic.
- `openrouter/auto` stays a *fallback*, never the product's named identity (it makes cost untrackable).

## Current Routing — findings

The engine already has everything needed to execute this audit without code changes: per-stage `MODEL_*`, plus `MODE_*` (chat/fusion/web_search), `TEMP_*`, `MAXTOK_*`, `FUSION_STAGES`, `FUSION_PANEL`, prompt caching, and `usage.cost` telemetry on every call. Resolver: `modelFor(stage)` → `MODEL_<STAGE>` → `MODEL_DRAFT` → `openrouter/auto` (`server/src/openrouter.ts`).

Findings:

- **`.env.example` and `render.yaml` disagree** on Frame/Sharpen/Discover/SEO/Image/Swarm. `render.yaml` (production) is more expensive than `.env.example` (Frame on `gemini-3.5-flash` vs `glm-5.2`; Sharpen on Opus vs Sonnet). **The two configs must converge** — pick one ladder and set it in both.
- **Grid stages are unmapped** in `modelEnv` (signals-deepdive, signals-macro, fintel-bridge, synthesis, reviewgate, story, critic) — they silently fall back to `MODEL_DRAFT` (Sonnet). That is overpaying for the cheap signal stages and under-specifying the expensive story stage. Map them explicitly.
- **Hidden-reasoning token burn is the real risk, not benchmark rank.** In the live bakeoff, "cheap" models sometimes spent the visible-output budget on hidden reasoning and returned empty or truncated text. Cost-per-*useful*-token matters more than headline price.
- **No empty-output guard.** If a provider returns no visible content (reasoning-only), the user sees a blank result instead of a graceful fallback. This is the single highest-leverage reliability fix before aggressive cost routing.

## Intelligence-vs-cost map (your images, normalized)

Your routing table maps cleanly onto Co-Create stages. Treating your benchmark-gap / price-multiple figures as the evidence:

| Your task | Co-Create stage(s) | Swap (your image) | Quality gap | Price |
| --- | --- | --- | ---: | ---: |
| reasoning / backend brain | sharpen, critic, deep-analysis | strong → Kimi K2-class | ~8% | ~11× cheaper |
| code generation | (n/a in writing path) | GPT-class → Qwen-Max | ~18% | ~7× cheaper |
| agent loops + tool calling | Grid run loop, Fusion judge | Sonnet → GLM-class | ~3% | ~5× cheaper input |
| cheap volume / bulk | swarm, discover, SEO | mini → MiMo-class | ~6% | ~12× cheaper |
| image generation | image | GPT-Image → Wan-class | ~5% | ~8× cheaper |
| video generation | (no pipeline yet) | Sora → Kling-class | ~0% | ~6× cheaper |

Caveats grounding this against what is actually routable today (don't ship versions that don't exist):

- **Kimi** is present on OpenRouter as a *code*-focused slug (`moonshotai/kimi-k2.7-code`). Do **not** default writing stages to it; it is a reasoning/code candidate for Sharpen/critic only after a voice bakeoff.
- **Qwen Max** is attractive on paper but **timed out 3/3** in the live bakeoff at an 18s cap — needs longer timeouts / provider pinning before it is safe as a default.
- **GLM-5.2** is the strongest immediate cost-saver and is already the `.env.example` Frame default.
- **MiMo V2.5** is extremely cheap and usable for bulk/swarm, but showed **empty visible output** on a polish-shaped prompt — bulk only until the empty-output guard exists.
- **Wan / Kling** are image/video; Co-Create has an OpenRouter **image** path only (no video pipeline). Wan-class is a cheap-cover candidate; video is out of scope until a pipeline exists.

## Live bakeoff — fresh run (2026-06-29, $0.02202 spent, 450-token cap)

Runner: `scripts/model-bakeoff.ts` (stops without a key; spend-capped by `BAKEOFF_CAP_USD`). Four candidates × three prompts (frame / draft / polish). `score` is the offline anti-slop total in `quality.ts` (out of 50 — measures slop markers, **not** voice fidelity). Per-call cost from OpenRouter `usage.cost`.

| Model | Visible | frame · draft · polish (score/50, verdict) | Cost (3 calls) | Latency |
| --- | :--: | --- | ---: | --- |
| `anthropic/claude-sonnet-4.6` | 3/3 | 47 Pass · 40 **Flag** · 45 Pass | $0.01429 | 2.2–13.3s |
| `z-ai/glm-5.2` | 3/3 | 47 Pass · 43 Pass · 45 Pass | $0.00585 | 6.7–13.4s |
| `xiaomi/mimo-v2.5-pro` | 3/3 | 48 Pass · 46 Pass · 45 Pass | $0.00088 | 2.7–8.9s |
| `google/gemini-3.1-flash-lite` | 3/3 | 49 Pass · 45 Pass · 44 Pass | $0.00101 | 0.9–3.0s |

Interpretation (supersedes the prior pass): **the v1 "empty output" failures were a token-cap artifact, not a model defect** — at a realistic 450-token cap, GLM-5.2, MiMo, and Gemini-lite all returned clean, visible, *Passing* output across all three prompts (v1's empties were at 180–200 tokens). The cheap models scored at or above Sonnet on the anti-slop scorer (Sonnet's draft even Flagged one marker); the scorer rewards terseness, so this validates the cheap models for **structuring/utility/bulk** — it does **not** prove voice parity, which still favors Sonnet for the voice-bearing stages. Cost spread is the headline: Sonnet's draft ($0.0069) is ~3× GLM and ~17× MiMo for comparable clean output. Net: the **balanced ladder is safe to ship**, and a **cost-first profile** (GLM/MiMo/Gemini-lite on everything but final polish) is now evidence-backed for drafts and bulk. The empty-output guard remains the safety net for aggressive swaps at low caps.

## Recommended env defaults (the "balanced" profile)

Converge `.env.example` **and** `render.yaml` on this, and map the Grid stages explicitly:

```bash
MODEL_PROFILE=balanced
# Voice-bearing (balanced-strong)
MODEL_DRAFT=anthropic/claude-sonnet-4.6
MODEL_SHARPEN=anthropic/claude-sonnet-4.6
MODEL_REFINE=anthropic/claude-sonnet-4.6
MODEL_REPURPOSE=anthropic/claude-sonnet-4.6
MODEL_STORY=anthropic/claude-sonnet-4.6
MODEL_SYNTHESIS=anthropic/claude-sonnet-4.6
# Structuring / utility (cost-first)
MODEL_FRAME=z-ai/glm-5.2
MODEL_DISCOVER=google/gemini-3.1-flash-lite
MODEL_SEO=google/gemini-3.1-flash-lite
MODEL_SWARM=google/gemini-3.1-flash-lite
MODEL_VISUAL_PROMPT=google/gemini-3.1-flash-lite
MODEL_SIGNALS_MACRO=google/gemini-3.1-flash-lite
MODEL_SIGNALS_DEEPDIVE=z-ai/glm-5.2
MODEL_FINTEL_BRIDGE=z-ai/glm-5.2
MODEL_REVIEWGATE=z-ai/glm-5.2
MODEL_CRITIC=z-ai/glm-5.2
MODEL_STUDY_SKILL=google/gemini-3.1-flash-lite
# Image
MODEL_IMAGE=google/gemini-3-pro-image          # cheap drafts: google/gemini-3.1-flash-image
# Premium panel (manual Deep Sharpen only)
FUSION_PANEL=z-ai/glm-5.2,anthropic/claude-sonnet-4.6,anthropic/claude-opus-4.8
FUSION_STAGES=
MAX_OUTPUT_TOKENS=4000
ENABLE_PROMPT_CACHE=true
```

Three **model profiles** to ship as a Labs control (P1):

- **cost-first** — GLM/Gemini-lite/MiMo across the board; Sonnet only on Deep Sharpen. Cheapest; use for drafts and bulk.
- **balanced** (above) — cheap structuring, Sonnet voice. The default.
- **premium** — Sonnet draft, Opus sharpen/story. For flagship pieces.

## Sovereignty roadmap — local / self-hosted (the images' real ask)

Co-Create calls one base URL (`OPENROUTER_BASE_URL`) with an OpenAI-compatible body. That is the whole unlock: **an OpenAI-compatible local server (Ollama or vLLM) is a drop-in.** No rewrite of the stage engine — only a provider abstraction.

What it takes:

- **P0 (provider switch):** introduce `LLM_BASE_URL` + `LLM_API_KEY` (default to OpenRouter's values) so `chat`/`chatStream`/images point at any OpenAI-compatible endpoint. Add a `PROVIDER` notion so model slugs resolve per-provider (OpenRouter slug vs local tag like `glm-4-9b` / `qwen2.5-14b`). Fusion + the `web` plugin are OpenRouter-only server tools — they degrade gracefully (Deep Sharpen + web_search disabled when on a local provider).
- **P1 (hybrid routing):** per-stage `PROVIDER_<STAGE>` so the **private** stages (Bring intake, Draft, Voice distillation, Library) run **local**, while heavy/optional stages (Deep Sharpen Fusion, image gen) can still use cloud. This is the privacy story: your raw material and voice never leave your machine; only opt-in polish does.
- **Hardware/quant notes:** a 7–14B class open-weight model (Qwen/GLM/Llama-family) at 4-bit quant runs draft-quality writing on a 16–24GB GPU or an Apple-silicon machine via Ollama; a 32–70B class needs ~48GB+ or quant tradeoffs. Local won't match Sonnet's voice yet — so the honest hybrid is **local for privacy-sensitive + cheap-bulk, cloud premium reserved for flagship polish.**
- **Why it matters:** "not banned in a month" = no single vendor can pull your engine; "run locally" = offline + private; "learn them as I need" = you can fine-tune the local model on your own corpus later (a future Voice-engine upgrade).

This roadmap is **not** built this round — it is the audit's recommendation. The provider abstraction is ~a day of work and is the highest-leverage strategic change after the routing convergence.

## Roadmap

**P0**
- Converge `.env.example` + `render.yaml` on the balanced ladder above; map the 7 Grid stages explicitly.
- Add an **empty-visible-output guard**: if a provider returns reasoning-only/empty content, retry once then fall back to the named-safe model, with the brand error copy ("The model returned no visible draft…").
- Re-run the bakeoff with the cost-first ladder at realistic caps (cheap; ~$0.05) to validate before flipping Draft to GLM.

**P1**
- Ship the three **model profiles** (cost-first / balanced / premium) as a Labs control writing the `MODEL_*` set.
- Record model + latency + cost + fallback in History so routing is auditable over time (telemetry exists; surface it).
- Introduce the **`LLM_BASE_URL` provider switch** (local/self-host P0 from the sovereignty section).

**P2**
- Per-stage `PROVIDER_<STAGE>` hybrid routing (private→local, premium→cloud).
- A "try a cheaper route" Labs tool that bakes a piece against the candidate ladder and scores with `quality.ts` before changing defaults.
- Provider pinning / preferences for slow slugs (Qwen-Max timeout fix).

## Acceptance criteria

- One ladder, identical in `.env.example` and `render.yaml`; every Grid stage explicitly mapped.
- A blank/reasoning-only model response never reaches the user — it retries or falls back with branded copy.
- A fresh bakeoff table (real cost/latency/visible-output) backs any change to a voice-bearing default; **no model version is referenced that isn't live on the provider.**
- A documented, working `LLM_BASE_URL` pointing at a local Ollama/vLLM server produces a draft offline (proof of sovereignty), even if quality trails cloud.
- Projected blended cost drop modeled per profile (target: balanced ≈ −60–70%, cost-first ≈ −85%+, matching your images' headline), shown against the current production config.
