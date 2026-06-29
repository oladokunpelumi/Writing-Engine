# Gbedu Desk

A production-shaped writing desk for turning raw notes into publishable Substack-ready essays in a consistent voice.

## What Is Included

- Compose pipeline: Frame -> Draft -> Sharpen -> Package (Draft streams token-by-token)
- Library memory with lexical retrieval by default, upgrading to semantic (embedding) retrieval when `OPENROUTER_API_KEY` + `EMBED_MODEL` are set — same `retrieve()` interface, graceful fallback
- Workflow recipes: run an ordered multi-stage pipeline (e.g. deep-analysis -> synthesis-article -> visual-prompt -> sharpen) from the Compose tab
- Recognition-first hooks: every narrative stage (Frame, Draft, synthesis, Grid story) opens on a specific scene the reader is already living ("that's me") before making the point — with a per-piece hook style (mirror-scene / direct-analytical / provocative-question / confession). A **Hook Lab** (in Compose's first-look panel) swarm-generates and ranks alternative openers by an offline `hookScore`, and a "first look" preview shows what a scroller sees first.
- Desire doctrine (every section, someone wants something): every narrative stage (Frame, Draft, synthesis, Grid story) is told that in *each* section a character/the reader/the writer must visibly want something (Vonnegut's "glass of water") — desire is what pulls the reader forward and keeps sections from going inert. A **Desire meter** (in Compose) splits the piece into sections and flags, with an offline rule-based scorer, which ones carry a want vs. read flat; an active **Desire pass** then incrementally rewrites only the flat sections to add a concrete, true want (auto-saves the living draft, shows the before→after score).
- Experiments (swarm harness): fix your voice + memory + brief as a prompt-cached prefix, fan out N cheap variations on a cheap `MODEL_SWARM`, score them with the anti-slop scorer, and keep the winner (auto-saved as a draft) — the transitive-learning "find signal cheaply" idea. Also supports prompt A/B (`ab-prompt`). Per-experiment cost tracked.
- Knowledge Graph (territories): swarm-extract concepts from a source (your archive, The Grid universe, or a pasted course) → frequency-merge → a prerequisite DAG (max in-degree 4, acyclic) with gates; view a prerequisite-sorted reading order, gap analysis (uncovered prerequisites / thin concepts = what to write or cover next), and a "study skill" navigator. The MathAcademy-for-your-corpus idea.
- The Grid (second content engine): a signal-to-fiction episode pipeline as its own Show — Signals (deep-dive/fusion + macro/web-search + Fintel-report bridge) → Synthesis → ReviewGate (Gate 1) → Story (+ critic loop) → Publish (Gate 2). Continuity memory (Universe Bible + append-only Story Log) advances the serial (next installment #, no repeated lead/emotion, rotated easter-egg method). Shows switch in the sidebar; essays and The Grid share one engine.
- Shows / Content Lines: each Show bundles a voice + workflow + memory; "Substack Essays" is the default, "The Grid" is a second line, and new shows can be added.
- Per-stage execution: each stage runs as chat, web_search (OpenRouter web plugin), or fusion, with per-stage temperature/max-tokens via env.
- Refine (reader-first): a 'Refine' stage adapted from the article-refiner skill — rebuilds a piece around the reader with selectable depth (light / full / structural), arc, tone, and theological prominence. Works on the current piece, a pasted article, or a saved Library post; distinct from Sharpen's quick critique. The skill's reference doctrine (reader principles, prose standards, structural arcs, audience guides) is seeded into the Corpus per owner and editable there; Refine pulls the relevant pieces per request based on the chosen depth/arc/reader
- Editable voice profile
- Discover proposals, clustered into ordered **series** so the archive reads as one arc
- Draft **callbacks**: drafts build on retrieved prior posts and weave distilled recurring motifs
- **Repurpose** stage: recast a final essay into an X/Twitter thread, a LinkedIn post, and a newsletter teaser in voice
- Library **reading order**: set a curated "start here" sequence across the body of work
- Markdown/export flow
- Article visuals: real image generation via OpenRouter's images endpoint, from an art-directed concept (not raw text) tied to the recognition scene; choose a style (editorial / meme / productified / diagram). **Meme + productified styles render text in the image** (a witty caption / the article title overlaid). A **visual story** set extracts 3–6 visual beats from the final and renders a cover + one section image per beat in one consistent look, shown as a gallery; "Copy w/ images" interleaves the section images at their beats into exportable markdown. A **per-Show visual identity** (art style + palette + motifs), editable inline in Compose, is injected into every image prompt so a piece — and the whole Show's body of work — coheres. The cover appears in the first-look "what a scroller sees" preview. Images are **stored on disk** and served from `/api/images/*` (not base64-inlined in SQLite), and **per-image cost rolls into telemetry** (the images endpoint's response cost, falling back to `IMAGE_COST_USD`).
- SEO pack and editorial calendar
- Hybrid AI mode: OpenRouter when configured, deterministic mock outputs otherwise
- Prompt caching: set `ENABLE_PROMPT_CACHE=true` to mark the repeated voice/system prompt as cacheable across stages
- Per-stage model routing via `MODEL_*` env vars (cheap Frame/SEO/Discover, strong Draft/Sharpen); `openrouter/auto` is the fallback
- **Fusion / Deep Sharpen**: OpenRouter's server-side multi-model panel + judge. `FUSION_STAGES` lets stages auto-invoke it; with it empty, Fusion runs only via the manual **Deep Sharpen** button. `FUSION_PANEL` narrows the panel (defaults to two cheaper models). Costs more per call — reserve for high-value passes
- **Cost telemetry**: every OpenRouter call records tokens + cost on the generation; History shows per-call usage and the sidebar shows total spend. `MAX_OUTPUT_TOKENS` caps output per call (keeps requests within the key's credit budget)
- **Auto-save**: Compose Sharpen and Workflow finals persist as a living **draft** (one per piece) so a paid run survives a closed tab; "Save to Library" promotes a draft to published
- **Library detail**: open any note in a full view+edit panel; filter by status; auto-saved drafts appear here
- **Multi-tenant**: paste/upload ingestion (no hardcoded paths; legacy local import behind `ALLOW_LOCAL_IMPORT`), multiple named **voice profiles** with an active selector, and optional auth (`AUTH_REQUIRED=true` + `INVITE_CODE`) with per-owner isolation of all content
- **Onboarding**: a first-run card distills a new writer's voice from pasted posts

## Run Locally

```bash
npm install
npm run dev
```

Client: http://localhost:5173

Server: http://localhost:4187

The app works without an API key. Add `OPENROUTER_API_KEY` and model env vars to enable real AI calls.

## Deploy

One Docker web service serves the API + built client from a single URL, with SQLite + images on a persistent disk and invite-only auth. See **[DEPLOY.md](DEPLOY.md)** for the Render blueprint walkthrough (`render.yaml` + `Dockerfile` are included). To run the production image locally: `docker build -t writing-engine . && docker run -p 4187:4187 -e OPENROUTER_API_KEY=... -v "$(pwd)/.localdata:/data" writing-engine`.

## Useful Commands

```bash
npm run test
npm run typecheck
npm run build
```

## Production Notes

SQLite is used for immediate local persistence through Node's built-in `node:sqlite` module. The repository layer is intentionally isolated so Postgres + pgvector can replace the storage backend without changing client or route contracts.
