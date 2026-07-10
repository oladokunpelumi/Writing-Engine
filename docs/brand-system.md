# Co-Create Brand System — Live V3 Re-Audit

Date: 2026-07-09
Rendered identity: `docs/brand/brand-system.html`
Status: authenticated production re-audit; first cycle where the brand has a public surface to audit.

## Executive Read

The brand finally exists in public. The landing page is the promise, verbatim and well-set: "It doesn't write **for** you. It writes **as** you." over the mark, with "Bring the unfinished self" and "Messy is welcome here." doing exactly the work the brand system assigned them. The OG image, favicon, title, and meta description are all live and absolute. The wedge sentence on the landing ("a voice engine for writers whose published body of work is the product") matches the sales audit's positioning word-for-word — the docs and the product now speak one language.

Two brand breaks remain, both *inside* the product. First, the operator block in every user's sidebar speaks fluent engineer ("Explicit stage env vars still override this runtime profile", "USAGE GUARD", "MODEL PROFILE") — the do-not-copy list exists precisely to keep this register off writer surfaces. Second, the header byline reads "writes as you · openrouter": the brand promise sharing a line with a vendor name undercuts the intimacy the line is for. And the naming/trademark review is now three cycles old as an open P1 — it gates any public push of the very landing page that finally exists.

## Closure update — 2026-07-10

- **P1 "engineer register on writer surfaces" → closed:** the operator block (Spend/model-ladder/usage-guard) moved behind the Labs drawer and no longer sits in the always-visible sidebar next to the brand copy.
- **P1 "writes as you · openrouter" → closed:** the header byline now reads "writes as you" — no vendor name on the writer surface.
- **Still open:** the naming/search/trademark review (`docs/naming-decision.md`) — a founder action, not a code change.

## Acceptance-Criteria Scorecard (scored against V2's own criteria)

| V2 criterion | Status | Evidence |
| --- | --- | --- |
| A shared production URL displays the intended title, description, and image card | Met (HTML) | Title "Co-Create", description, og:title/description/type and absolute og:image all in production HTML (2026-07-09). Card render on a scraper debugger still pending (visual P2). |
| The brand system includes contrast-safe usage rules for every token | Met (carried) | Ember accent-only rule stated in `docs/brand/brand-system.html`; live screens comply. |
| A public-launch reviewer can find a naming/search decision record | Partly met | `docs/naming-decision.md` exists as a template; the checklist (search, trademark, canonical URL) remains unexecuted. |
| Product, README, and landing use one consistent wedge | Met | "It doesn't write for you. It writes as you." verified identical on landing (screenshot), README, and in-app copy. |

## Live Brand Findings

- **Met — the landing page is the brand system executed.** Mark → promise → sub-promise → single ask → quiet sign-off. No feature list, no urgency mechanics, no do-not-copy vocabulary. `live-landing-desktop-2026-07-09.png`, `live-landing-mobile-2026-07-09.png`.
- **P1 — engineer register on writer surfaces.** The sidebar operator block (see visual audit) is the only place the shipped product violates the voice guide. When it moves behind Labs/admin, whatever copy remains should be rewritten in brand voice (e.g., "Today's shaping: $0.09" rather than "USAGE GUARD").
- **P1 — "writes as you · openrouter".** Drop the provider from the header byline; provider identity belongs in Labs/History, not beside the promise.
- **P1 — naming/search/trademark review still open (third cycle).** The landing page makes this urgent: it is now indexable brand surface. Execute `docs/naming-decision.md` before any public link-sharing push.
- **P2 — "the engine is open" (mobile top bar)** is a nice line but appears nowhere in the brand doc; either adopt it into the copy library or align it.

## Next Quality Bar

**P0**
- None — shipped brand surfaces are consistent; the breaks are P1 placement/register issues owned jointly with the visual lens.

**P1**
- Rewrite/relocate operator copy in brand voice; drop "openrouter" from the header.
- Execute the naming decision record end-to-end (search sweep, trademark scan, canonical-domain choice) and mark it done in `docs/naming-decision.md`.

**P2**
- Reconcile "the engine is open" with the copy library; verify the OG card visually once.

## Acceptance Criteria V3

- No engineer-register copy is visible to a non-admin writer anywhere in the product.
- The header carries the promise only; no vendor names on writer surfaces.
- `docs/naming-decision.md` has every checklist item checked with evidence links.
- Landing, README, in-app, and audit docs continue to share the single wedge sentence (spot-check each cycle).
