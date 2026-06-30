# Co-Create Product Design Audit

Date: 2026-06-29
Companion: `docs/brand-system.md` (voice + copy), `docs/visual-ui-audit.md` (visual moves).

## Executive Read

The design target is not "AI writing app." It is **a creative partner that can hold the messy, contradictory self and return a more formed version without stealing authorship.** The product promise, said plainly:

> Bring the unfinished self — the half-thoughts, the contradictions, the thing you can't stop thinking about. Be met. Leave with work that is transformed but still unmistakably yours.

The current flow (Bring → Draft → Polish → Done) is the correct spine and the redesign already removed the old dashboard sprawl. The remaining work is **emotional and relational**, not structural: the product should *receive* before it *processes*, *reflect* rather than *replace*, and keep the writer feeling like the author at every step. Below, each journey stage gets: what works · the gap · the P0/P1 move.

Implementation note: the active build shipped the P0 relationship pass and several P1/P2 pieces: "Messy is welcome here," notes-first Bring, "Shape it," the other-side field, Become reveal copy, what-changed/what-it-kept, grouped/renamed Polish moves, "Still yours. Now shaped," Voice mirror, Library start-here arc, and a runtime Labs model-profile control.

## Product promise — current vs. stronger

- **Current (implicit):** "Turn your notes into a finished piece in your voice." Accurate, task-shaped.
- **Stronger:** "Lay down what you actually have — messy, raw, contradictory — and a co-creator meets you, finds the through-line, and hands back something formed that still sounds like you." Same engine; a relationship instead of a pipeline.

## Journey audit

### Onboarding (WelcomeScreen)
- **Works:** "It doesn't write for you. It writes as you." is the right line. Two honest doors (Just start / Build your voice) respect agency.
- **Gap:** It frames a *capability* ("paste posts, it learns") more than an *invitation*. A first-timer doesn't yet feel met.
- **P0:** Add one receptive line — "Messy is welcome here. Start with whatever you have." **P1:** After "Build your voice," reflect something back immediately ("Here's what I'm hearing in how you write: …") so the first interaction is a mirror, not an upload.

### Create · Bring
- **Works:** One line + one notes box is the right reduction; detail is collapsed.
- **Gap:** "What do you want to write about?" + a topic field can feel like *homework / a search box*. The promise is to receive fragments, but the field still asks for a tidy topic. "Draft it" is clear but not wand-like.
- **P0:** Lead with the notes box, not the topic line; relabel intake to invite fragments — placeholder "A thought, a voice note, a contradiction, a sentence you can't stop thinking about." Rename the primary action to **"Shape it"** (or "Begin"). **P1:** Accept a contradiction explicitly — a subtle "add a tension / the other side" affordance — since "lay down the opposite and be met" is core to the vision.

### Create · Draft
- **Works:** The draft is fully editable; "written as you" badge + "Edit freely — it's yours" protect authorship.
- **Gap:** The transformation is *invisible* — the most important moment in the product (fragments → formed piece) is an unmarked textarea swap. There's no felt "it met me."
- **P0:** Mark the reveal (see visual audit) and pair it with one line: **"A first form, written in your cadence. Still yours."** **P1:** Offer a gentle "what changed / what it kept" affordance so the writer sees the partner's hand without losing ownership.

### Polish moves
- **Works:** Optional, non-linear, reversible — "play, then come back to your piece" is exactly right for a playground.
- **Gap:** The move names are *mechanical* (Sharpen, Hook, Desire, Score). They describe operations, not the relationship. They also aren't grouped, so they read as a toolbar.
- **P0:** Rename to grounded-mythic verbs and group by intent:
  - **Shape:** Sharpen → "Tighten", Refine → **"Meet the reader"**
  - **Reflect:** Hook → **"Open a mirror"**, Desire → **"Give it want"**
  - **Dress:** Images → "Make it visible"
  - **Check:** Score → **"Clear the static"**
  **P1:** Each move opens with one line of intent in voice, not a parameter dump.

### Done
- **Works:** Save / Copy / Repurpose / SEO grouped as one finish step; auto-save reassurance present.
- **Gap:** "Ship it" is a product verb, not a Co-Create verb; the moment of completion isn't a settling.
- **P0:** Reframe to **"Still yours. Now shaped."** with quieter actions ("Save the piece," "Release it"). **P1:** A one-line reflection of the arc ("You brought 3 fragments; this became a 900-word piece in your voice").

### Voice (the mirror)
- **Works:** Editable profile, multi-voice, distillation from the archive.
- **Gap:** It presents as *settings* (pillars, register, constraints). The vision says Voice is where the writer *sees themselves* — it should read as a mirror, not a config form.
- **P0:** Lead the Voice screen with a reflected portrait ("Here's how you sound: …") above the editable fields. **P1:** Let the writer react ("more this / less that") and re-distill — a relationship, not a form.

### Library (the body of work)
- **Works:** Full view/edit, status filter, reading order — the archive is real.
- **Gap:** It's a list, not a *body of work*. The brand frames the archive as one author's arc.
- **P1:** A "start here" / arc view that treats the collection as a coherent voice over time (reuses existing reading-order).

### Labs (advanced instruments)
- **Works:** Correctly hidden; power preserved without crowding the path.
- **Gap:** Framed as a grab-bag of features.
- **P2:** Frame Labs as "advanced instruments" with one line each on *when you'd reach for it*, so discovery feels like growth, not clutter.

## Roadmap

**P0 (relationship + the wand)**
- Bring: notes-first intake, fragment-inviting placeholder, "Shape it" primary action.
- Draft: mark the reveal + "Still yours" line.
- Polish: rename + group the moves (Shape / Reflect / Dress / Check).
- Done: "Still yours. Now shaped." with quieter release actions.
- One receptive onboarding line ("Messy is welcome here").

**P1 (mirror + depth)**
- Voice as a reflected portrait, not settings.
- "What changed / what it kept" on the draft.
- Contradiction-aware Bring ("add the other side").
- Build-your-voice returns an immediate reflection.

**P2 (arc + instruments)**
- Library "start here" arc view.
- Labs reframed as instruments with reach-for-it copy.

## Acceptance criteria

- A first-time user reaches a finished piece via the Bring→Draft→Polish→Done path without touching Labs, and reports feeling *met*, not *served*.
- The draft reveal is a felt moment, accompanied by an authorship-preserving line.
- Every Polish move name is a relationship verb grouped by intent; no bare mechanical labels on the core path.
- The Voice screen opens with a reflection of the writer before any editable field.
- Completion reads as "still yours, now shaped" — no growth-hacky "ship/optimize/unlock" language anywhere on the core path (see brand voice do-not list).
- Copy changes are content-only where possible (labels/placeholders/headings), so P0 is low-risk to implement.
