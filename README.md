# Co-Create

**It doesn't write _for_ you. It writes _as_ you — on the days the blank page wins.**

Co-Create is a writing playground. You bring a rough idea or a pile of notes; you leave with a finished piece that sounds like *you* — not like generic AI. Start somewhere, land transformed.

---

## The problem

The blank page is brutal. And the easy way out — generic AI — flattens the one thing that makes your writing yours: your voice. Ghostwriters do the same. You end up with words that publish but don't sound like you.

## The promise

Co-Create learns how *you* sound from your own writing, then drafts in that voice — keeping your cadence, your obsessions, your way of seeing — while guarding against AI slop on every pass. Your published body of work should read like one author. You.

## How it works

A calm, four-step flow — one focus at a time, nothing crammed on screen:

1. **Bring** — paste a rough idea or messy notes. One box. That's the whole ask.
2. **Draft** — Co-Create turns it into a complete draft *in your voice*. Watch it appear; edit freely.
3. **Polish** — optional "moves" you reach for like toys: sharpen, refine for the reader, engineer a magnetic opening, check that every section carries a real want, add cover + section images, score for slop.
4. **Done** — save it, copy it, or spin it into an X thread / LinkedIn post / newsletter teaser — all in voice.

Everything advanced lives in **Labs**, out of the way until you want it.

## Who it's for

High-output, voice-conscious writers who refuse to sound like a robot: newsletter and Substack writers, thought-leadership operators, faith and ministry writers, founders who write. If you'd rather not publish than publish in someone else's voice — this is for you.

---

## Run it

```bash
npm install
npm run dev
```

Client: http://localhost:5173 · Server: http://localhost:4187

Works out of the box in **mock mode** (no API key, no spend) so you can explore the whole flow. Add an `OpenRouter` key and model env vars to switch on real drafting. See **[.env.example](.env.example)**.

## Deploy

One service, one URL, invite-only — your library and images live in managed Postgres. See **[DEPLOY.md](DEPLOY.md)** (Railway-first, with Render notes included).

---

<details>
<summary><strong>Under the hood</strong> — for the curious / power users</summary>

Co-Create is a TypeScript monorepo (React/Vite client, Node/Express server, shared Zod schemas) with a deep engine behind the simple flow:

- **Voice engine** — distills a voice profile from your archive; locks pillars, spine, register, constraints, banned terms, and lexicon onto every generation. Multiple named voices, switchable.
- **Pipeline** — Frame → Draft → Sharpen → Package, with streaming drafts, lexical retrieval (upgrading to semantic embeddings when configured), prompt caching, and per-stage model routing.
- **Craft doctrine, enforced** — recognition-first hooks (open on a scene the reader is already living), a per-section "desire" meter + active pass (every section, someone wants something), anti-slop scoring + clean rewrite, and citation guardrails.
- **Reader-first Refine** — rebuild a piece around the reader with selectable depth/arc/tone.
- **Article visuals** — real image generation: an art-directed cover plus a coherent section-image "visual story" in a consistent per-voice visual identity; meme/productified styles render text; images stored in Postgres.
- **Repurpose + SEO + editorial calendar** — recast finals into platform-native formats; metadata; scheduling.
- **Labs:**
  - **The Grid** — a second content engine that turns real signals into serialized fiction (signals → synthesis → human gate → story + critic loop → publish), with continuity memory.
  - **Experiments** — swarm-generate N cheap draft variations and keep the winner; A/B prompt versions.
  - **Knowledge Graph** — turn a corpus into a prerequisite concept DAG with reading order and gap analysis.
  - **Prompt Studio, Corpus, Import, History** — versioned prompts, memory classification, ingestion, and cost telemetry.
- **Shows / content lines** — each Show bundles a voice + workflow + memory.
- **Hybrid AI** — OpenRouter when configured, deterministic mock outputs otherwise. Cost telemetry on every call.
- **Multi-tenant** — optional auth with per-owner isolation; PostgreSQL in production, with pglite backing local dev and tests through the same async repository layer.

## Useful commands

```bash
npm run test       # server tests
npm run typecheck
npm run build
```

</details>
