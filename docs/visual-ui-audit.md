# Co-Create Visual / UI Audit

Date: 2026-06-29
Screens referenced: original audit set (`docs/audit-assets/app-desktop-create.png`, `app-desktop-create-flow.png`, `app-mobile-create.png`, `app-mobile-create-flow.png`) plus shipped implementation set (`app-desktop-shipped.png`, `app-mobile-shipped.png`, `app-mobile-nav-shipped.png`, `app-desktop-bring-shipped.png`, `app-desktop-draft-shipped.png`, `app-desktop-polish-shipped.png`, `app-desktop-done-shipped.png`).
Companion: `docs/brand-system.md` (palette, type, mark) and `docs/brand/brand-system.html` (rendered identity).

## Executive Read

The information architecture is already right — Create / Library / Voice with Labs hidden, one calm column, a four-step spine. The current visual system says **"clean, trustworthy writing tool."** It does not yet say **"you have stepped into an engine that will meet what you bring and reflect a higher version back."** The gap is not decoration. It is **ritual, depth, and visible transformation** — the three things that would make a writer *feel* the brand promise instead of read it.

Direction (locked): **elevate the playground, do not rebuild it.** Keep Bring→Draft→Polish→Done. Add the felt sense of a co-creator and a threshold. The current build is the right skeleton; this audit is about giving it a nervous system.

Implementation note: the shipped pass now includes the custom mark, favicon/OG, ember/dusk tokens, mobile top bar + sheet, notes-first Bring, the `become` reveal class, grouped Polish moves, two panel tiers, and the "Still yours. Now shaped." Done state. Remaining observations below are preserved as the audit rationale and future quality bar.

## What works (keep)

- The calm paper field (`#f5f1e8`), generous whitespace, single reading column — already anti-dashboard.
- Three-item primary spine + collapsed Labs — complexity is hidden, not lost.
- The progress spine (Bring→Draft→Polish→Done) is the right ritual scaffold.
- Syne display + DM Sans body is a strong, distinctive pairing.
- Motion is accessibility-safe (`prefers-reduced-motion` honored). Build on that, don't regress it.

## Main gaps

**P0 — blocks the promise**

1. **No threshold; no transformation moment.** The single most important screen — the instant the **draft first appears** — currently just swaps a textarea in. This is *the* magic-wand beat and it passes unmarked. There is no "you brought fragments → here is a formed thing, in your voice" reveal.
2. **The mark is a stock icon.** A Lucide `PenLine` in an ink square reads "generic SaaS." There is no ownable identity at the one spot every user sees first.
3. **Mobile leads with the sidebar, not the engine.** On phones the nav stack sits above the welcome/Create content, and the step labels collapse to bare numbers — the first impression is a menu, not a threshold.
4. **`brass`/gold is defined but unused; no reflection color.** The palette is ink + tide + paper only. The brand's two most meaningful states — *transformation* (ember/gold) and *reflection* (dusk/violet) — have no visual existence, so the app can't show them.
5. **Disabled primary actions don't explain themselves.** "Draft it" sits grey with no reason; the engine should invite, not gate silently.

**P1 — high-value polish**

6. **The Polish "moves" read as a button row, not instruments.** Six equal chips (Sharpen/Refine/Hook/Desire/Images/Score) have no visual grouping by intent (shape vs. reflect vs. dress). They feel like a toolbar, not a set of deliberate moves you reach for.
7. **Panels are uniform boxes.** Everything is a `desk-panel`: same border, same weight. There is no hierarchy between "your living piece" (should feel central, warm, lit) and "an instrument acting on it" (should feel secondary, recessive).
8. **No empty-state warmth.** "No draft yet — go back to Bring" is functional, not inviting.
9. **Depth is flat.** `shadow-sm` everywhere; nothing rises toward the writer at the moments that matter (the reveal, the active move).

**P2 — atmosphere**

10. No favicon, no social/OG image — the brand vanishes in a browser tab and a shared link.
11. No motion language: transitions are incidental (a 2px hover lift), not a designed grammar of "entering," "becoming," "settling."

## Direction: the engine reflects you back

The felt sequence the visuals must support:

1. **Threshold (Bring).** The writer arrives with unfinished, contradictory material. The surface should feel *receptive and unhurried* — a wide, calm intake that says "lay it down, messy is welcome," not a form with eight fields.
2. **Becoming (Draft).** When the draft arrives, mark it. A brief, dignified reveal — light/warmth blooming (ember), the piece rising on the page — that says *transformation just happened, and it is still yours.* The "written as you" badge is the seed of this; it should be a moment, not a tag.
3. **Reflection (Polish).** The moves are the co-creator offering perspectives (dusk/violet accent). The living piece stays centered and warm; instruments are quieter satellites around it.
4. **Release (Done).** A settling, not a celebration — "still yours, now shaped."

Visual principles: **fewer boxes, more thresholds. Light and depth as transformation cues, never decorative orbs. The writer's text is the warmest, most-lit object on every screen. The engine is present but recessive — a partner, not a chrome.**

## Recommended visual changes

**P0**
- **Design a reveal for the draft.** When `draft` first populates, animate a short threshold (respecting reduced-motion): the Draft card rises + an ember wash settles, the "written as you" badge fades in. One beat, ~600ms. This is the wand.
- **Replace the mark.** Ship a real Co-Create mark (see `brand-system.md`: two strokes converging — "one and separate"). Use it in the sidebar, favicon, and OG.
- **Extend the palette in `tailwind.config.ts`/`styles.css`:** add `ember` (transformation) and `dusk` (reflection), and put the existing `brass` to use. Wire them to the three states (badge/reveal = ember; Polish moves = dusk).
- **Mobile: lead with the engine.** Collapse the sidebar into a top bar + sheet on small screens so Welcome/Create content is first; keep step labels (don't degrade to bare numbers).
- **Explain disabled CTAs:** a one-line hint under "Draft it" ("Add a line or some notes to begin").

**P1**
- **Group the Polish moves by intent:** Shape (Sharpen, Refine) · Reflect (Hook→"Open a mirror", Desire→"Give it want") · Dress (Images) · Check (Score). Small section labels; the living piece stays centered.
- **Two panel tiers:** a warm, slightly elevated "piece" surface vs. recessive "instrument" surfaces (lighter, bordered, no shadow). Establishes hierarchy without new components.
- **Warm empty states** in brand voice ("Nothing here yet — bring a fragment and watch it take form").
- **Voice as the mirror:** give the Voice screen a reflective treatment (dusk accent) so it reads as "this is how you sound," not a settings form.

**P2**
- **A motion grammar:** define `enter` (threshold), `become` (reveal), `settle` (done) as named transitions, all reduced-motion-safe; document them in the brand system.
- **Favicon + OG image** from the new mark.
- **Texture, sparingly:** a faint paper grain on the field; never gradient orbs or mystical clutter (explicitly on the brand "avoid" list).

## Accessibility & responsiveness

- Keep the `prefers-reduced-motion` guard; every new transition must have a static fallback (the reveal becomes an instant state change).
- Maintain the tide focus ring; verify ember/dusk additions meet 4.5:1 contrast on paper for text, 3:1 for UI.
- Mobile target 390px: sidebar→sheet, full-width fields, persistent step labels, thumb-reachable primary CTA.

## Acceptance criteria

- The draft reveal is a perceptible, dignified moment on desktop and mobile (and a clean instant-state under reduced-motion).
- The sidebar mark is a custom Co-Create symbol, present as favicon and OG; "Co-Create" never appears as a bare browser-default tab.
- Ember and dusk exist in the token system and are each bound to a brand state (transformation / reflection), used with restraint.
- On a 390px viewport the first paint is the engine (threshold + content), not the nav; step labels remain legible.
- The living piece is visibly the warmest, highest object on Draft and Polish; instruments read as secondary.
- Nothing on the "avoid" list ships: no gradient orbs, no purple-blue SaaS sameness, no mystical clutter.
