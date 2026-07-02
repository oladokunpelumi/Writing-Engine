# Co-Create Sales & Distribution Audit

Date: 2026-07-01
Status: new fifth lens for design-partner readiness and paid-launch runway

Note: this document supersedes `Gbedu-Desk-Strategy.md` sections 3-4 for current GTM planning. The strategy remains the historical source; do not rewrite it as part of this audit cycle.

## Executive Read

Co-Create's product wedge is real: a voice engine, anti-slop doctrine, craft moves, and a calm playground that says, "It doesn't write for you. It writes as you." The distribution surface is near zero. Production is invite-only, registration is gated, there is no public waitlist/landing page, and the app's best demo is still the founder's own body of published work.

That is acceptable for design partners and dangerous for paid launch. The immediate job is not billing. It is proving that 5-15 high-output, voice-conscious writers can go from a DM invite to a first draft in one sitting, without founder hand-holding and without one user draining the shared model key.

## Closure update — 2026-07-02

- **Public distribution surface: Unmet → Met.** A public landing now fronts the app for logged-out visitors (promise, "Request an invite" → `POST /api/waitlist`, "Have an invite?" sign-in door). Waitlist entries are stored idempotently and counted in `/api/admin/readiness`.
- **Owner library migration: Unverified → Met.** `scripts/reassign-owner.ts` run against production 2026-07-02: 37 posts + all content and 4 kv keys now owned by the registered account; 0 rows left on `owner-default`.
- **Probe users deleted** (`x@y.com`, `probe2@`, `probe3@`); only the real account remains.
- **Onboarding script gap closed:** `docs/design-partner-guide.md` (what to bring, the session, the three questions, dry-run checklist). ToS/privacy draft at `docs/legal/terms-privacy-draft.md`; naming record template at `docs/naming-decision.md`.

## Acceptance-Criteria Scorecard

| Criterion | Status | Evidence |
| --- | --- | --- |
| Invite-only design-partner gate exists | Met | Production health reports `authRequired: true`; invalid invite registration returned `403 Invalid invite code`, which implies an invite code is configured. |
| Public distribution surface exists | Unmet | Production root is the app shell/login; no public landing page or waitlist route found in repo. |
| Product wedge is visible in-app | Met | Local screenshots show notes-first Bring, voice/authorship copy, grouped craft moves, and quiet Done state. |
| Design-partner funnel is instrumented | Unmet | No activation dashboard or feedback loop was found for invite -> first draft -> save -> voice-match. |
| Per-owner spend caps exist | Unmet | No quota/spend cap implementation was found. |
| Owner library migration is resolved | Unverified | `scripts/reassign-owner.ts` exists; production DB state could not be read. |
| Paid launch prerequisites exist | Unmet | No billing, ToS/privacy launch package, public pricing, support/status, or naming review artifact found. |

## Evidence Table

| Evidence | Result |
| --- | --- |
| Production health | `200`; OpenRouter/vector/auth enabled. |
| Production registration probe | `403 Invalid invite code`; registration is not open. |
| Production shell | Auth/login screen only; `live-welcome-2026-07-01.png`. |
| Local core demo | `local-bring-2026-07-01.png`, `local-draft-2026-07-01.png`, `local-polish-2026-07-01.png`, `local-done-2026-07-01.png`. |
| Admin facts | Railway env, owner-default rows, probe users, and password rotation remain unverified from this run. |

## Competitor Scan

Access date for all sources: 2026-07-01.

| Product | What it sells | Pricing / packaging evidence | Co-Create implication |
| --- | --- | --- | --- |
| [Lex](https://lex.page/) | Collaborative documents with AI editing, feedback, versions, commands, title ideas, publishing, and mobile web; says it is loved by 300K+ writers. | Public page links Pricing but fetched homepage did not expose plan prices. | Lex owns "AI docs/editor"; Co-Create should not compete as another doc editor. Lead with voice-lock and transformation from fragments. |
| [Sudowrite](https://sudowrite.com/pricing) | Creative-writing AI for authors; features include Brainstorm, Expand, Write, feedback, rephrasing, show-not-tell, characters, multilingual support. | Public monthly plans shown at $10, $22, and $44 with credit allowances. | Sudowrite owns novelist/fiction fun. Co-Create can borrow creative-partner energy but focus on essayists/solo publishers and voice fidelity. |
| [Jasper](https://www.jasper.ai/pricing) | Marketing AI platform for on-brand written/visual content, multiple brands, campaigns, enterprise controls. | Pro listed at $59/month yearly or $69/month monthly; Business is custom. | Jasper owns marketing teams and brand governance. Co-Create should avoid enterprise content-machine language. |
| [Typeshare](https://typeshare.co/) | All-in-one writing platform for writing, publishing everywhere, seeing what works, and improving; claims 85,000+ writers and 690,000+ pieces. | Public homepage says "Start Writing Now (It's Free)"; no paid plan details captured. | Typeshare owns creator distribution/workflow. Co-Create should integrate with distribution later, but the wedge is the voice engine before publishing ops. |
| [Copy.ai](https://www.copy.ai/prices) | GTM AI for sales/marketing/operations with workflows, tables, actions, brand voice, and integrations. | Chat plan listed at $29/mo monthly or $24/mo annually; Growth $1,000/mo; Expansion $2,000/mo; Scale $3,000/mo. | Copy.ai anchors the high-price GTM automation category. Co-Create should stay out of GTM automation positioning for v1. |
| [Writer](https://writer.com/) | Enterprise AI platform and agents for on-brand work, knowledge graph, connectors, trust/security, Palmyra LLMs. | Public homepage pushes demo/trial, not self-serve pricing. | Writer owns enterprise AI governance. Co-Create's counter-position is solo-author intimacy and taste. |
| [Notion AI](https://www.notion.com/product/ai) | AI inside docs/workspaces: agents, enterprise search, meeting notes, admin controls, model/provider flexibility. | Notion AI is included with Business/Enterprise; custom agents move to credits after May 4, 2026. | Notion owns workspace context. Co-Create should not become a general workspace; it should be the author's voice chamber. |

## Positioning

**ICP:** high-output, voice-conscious solo publishers, essayists, newsletter writers, and founder-writers who want AI help but refuse generic AI voice.

**Wedge:** voice-lock + anti-slop doctrine + craft moves + calm playground.

**Promise:** "Bring the unfinished self. Leave with transformed work that still sounds like you."

**Sharp line:** Co-Create is not an AI content pipeline, enterprise brand-governance suite, or generic doc editor. It is a voice engine for people whose published body of work is the product.

## Stage 1 - Design-Partner Readiness (P0)

Current funnel:

DM or personal email -> invite code -> register -> optionally build voice -> Bring notes -> Shape it -> first draft -> Polish -> Done/save.

Gaps:

- No invite management beyond one shared code.
- No per-owner spend caps.
- No activation telemetry for time-to-first-draft.
- No in-app feedback loop for voice match or edit effort.
- Owner reassignment, probe-user cleanup, and Postgres password rotation are unverified admin tasks.
- No onboarding script that tells a partner what to bring and what feedback to give.

Design-partner motion:

- Invite 5-15 writers whose voice already matters to their audience: newsletter operators, founder-essayists, solo consultants, cultural/strategy writers.
- Ask for one focused session: bring a messy note, generate a first draft, use one Polish move, save or reject, then answer three questions: "Did it sound like you?", "What did you change?", "Would you use it again next week?"
- Founder publishes weekly with the tool during this period. The founder's Substack/body of work is the public demo.

## Stage 2 - Paid-Launch Runway (P1/P2)

**P1**
- Public landing/waitlist with one promise, one founder demo, and design-partner proof.
- ToS/privacy and data-use language before charging.
- Usage limits, quotas, and support contact.
- Naming/search/trademark decision record.
- Pricing hypotheses only after usage data: solo monthly plan, limited credits, and a higher-touch founder/voice setup package.

**P2**
- Billing and account management.
- Referral loop through published pieces.
- Status page and incident language.
- Export/publish integrations if design partners repeatedly ask for them.

## Metrics

- Activation: notes -> first draft in under 20 minutes.
- Voice-match satisfaction: 80%+ say "sounds like me" or better after one edit pass.
- Light-edit acceptance: 80%+ of saved drafts need light or moderate editing, not a full rewrite.
- Repeat intent: 50%+ of design partners return for a second draft within 14 days.
- Conversion gate: do not launch paid until at least 5 design partners complete two sessions and 3 would pay.

## P0 / P1 / P2

**P0**
- Confirm admin safety items: invite code, owner reassignment, probe users, password rotation, model overrides, spend cap plan.
- Run the 5-15 writer design-partner loop with manual concierge support.
- Add a simple feedback capture surface or structured post-session form.

**P1**
- Landing/waitlist, usage caps, ToS/privacy, support/status basics, naming review.
- Pricing tests based on observed usage and competitor anchors, not invented willingness-to-pay.

**P2**
- Billing, referral/distribution loop, export integrations, public case studies.

## Acceptance Criteria

- A stranger with an invite can reach a first draft in one sitting without founder hand-holding.
- Every competitor claim in this doc has a URL and access date, or is omitted.
- No paid launch until spend caps, ToS/privacy, support path, and naming review exist.
- The founder can point to a published piece made with Co-Create as the demo.
