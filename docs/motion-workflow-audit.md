# Writing → Motion Graphics Workflow — Audit & Design

Date: 2026-11-20
Scope: the `gym-reel` reference project, the installed content-studio skill pack, Co-Create's current pipeline, and anti-slop v1.2. Docs only; nothing has been built.

---

## 1. The goal, restated

Co-Create turns rough notes into finished writing in the author's voice. The goal is a second output for that writing: a **narrative motion-graphics video**, built and rendered by Claude Code, that carries the same idea, the same voice and the same craft standards as the written piece.

The problem is a missing middle. Co-Create stops at a finished essay (or, in Video Studio, at prompts for AI-generated footage). The motion tools installed in Claude Code start at a **brief and a timed beat list**. Nothing turns a 1,200-word essay into a 30-second story with timed beats, on-screen words and visual ideas, and nothing checks those few on-screen words with the rigour the essay gets. The new anti-slop version should govern that copy.

---

## 2. How `gym-reel` works (the reference application)

### 2.1 What it is

A finished test project from the **content-studio skill pack** (now installed at `~/.claude/skills/`, 35 skills). It turns real gym footage into a 38-second 9:16 reel: exercise titles, a live rep counter, speed badges, seams, a synthesized beat and impact sounds. It is **footage-led**, not writing-led. It has no narrative or script stage.

### 2.2 Folder anatomy (content-studio's "one folder per piece")

| Path | Role |
|---|---|
| `brief.md` | `ad-brief` output: audience, belief now → after, objection, message, proof, 3 hooks, timed structure, CTA, platforms, variants, flags, assumptions |
| `work/` | Intermediate data and tools: `rep_times.json`, `reps.py`, `build_scenes.py`, `sound.py`, `mix.sh`, `footage_9x16.mp4`, `music.wav`, `sfx.wav` |
| `video/` | The HyperFrames project: `index.html` (master timeline), `compositions/*.html` (scenes), `assets/vendor/gsap.min.js`, `hyperframes.json`, `package.json` (pins `hyperframes@0.8.223`) |
| `review/REVIEW.md` | What was checked, measured numbers, what was fixed, what was not checked |
| `make_assets.sh` | Re-encodes footage with a keyframe every second (HyperFrames needs it) and extracts gym audio |

### 2.3 The pipeline as built

1. **Brief** — `brief.md`. One message ("Legs and back, three supported machines, every rep counted"), the objection it answers, hook A chosen over B and C.
2. **Footage prep** — trim, reframe to 1080×1920, speed-ramp middle reps (`ffmpeg-skill`).
3. **Measure** — `reps.py` takes the first principal component of downscaled frames as a 1-D motion signal and finds turnaround peaks. Each candidate rep is then confirmed on a contact-sheet frame. Result: `rep_times.json`, the **single source of truth** (26 reps, section times).
4. **Generate** — `build_scenes.py` writes every composition and `index.html` *from* `rep_times.json`. No number on screen is typed by hand.
5. **Compose** — HyperFrames renders HTML to video. `index.html` holds a muted footage track (track 0) and hosts scene compositions on graphics tracks 2–4 via `data-composition-src`, `data-start`, `data-duration`. Each scene registers a **paused GSAP timeline** on `window.__timelines[id]`; the renderer seeks every timeline frame by frame, so output is deterministic.
6. **Motion doctrine applied** — a "film's current" (everything exits left, enters from the right); a volt bar crosses every hard cut (`seams.html`); frame 0 carries the hook so it doubles as the thumbnail; counter held until 1.5 s so the hook reads alone.
7. **Sound** — `sound.py` synthesizes a beat whose tempo **bends per section so every cut lands on a downbeat**, plus CC0 sound effects placed on each measured rep (tick, click when sped up, punch on the last rep). Seeded RNG makes the mix reproducible.
8. **Master** — `mix.sh` two-pass loudnorm to −14 LUFS / −1.5 dBTP (platform target, not the sound skill's −16 default).
9. **Review** — contact sheets of the render; rep counter checked against all 26 reps; safe zones; seams; delivery checks pass for Reels, TikTok, Shorts. The review states what it did *not* check ("not checked by ear").

### 2.4 Principles worth carrying into a writing-led workflow

- **Data is the source of truth; a generator writes the scenes.** Edits go to the data file, never to the HTML. For writing, the data file becomes the *story*.
- **Never invent a figure.** Every number is measured and verified. For writing, every claim on screen must trace to the source piece.
- **Gates with evidence.** Each stage ends with a check that leaves an artifact (contact sheet, loudness number, probe output).
- **Doctrine before decoration.** Direction of travel, seams and the frame-0 hook are decided before styling.
- **Honest review.** The review says what it did not verify.

### 2.5 What does not transfer

Rep detection, speed ramps and the footage track are specific to filmed exercise. A writing-led piece has no footage to measure, so its "measurement" step becomes **verifying the words**: every on-screen line traces to the essay, survives the anti-slop pass and fits its time on screen.

### 2.6 Defects and traps found

| # | Finding | Effect |
|---|---|---|
| 1 | Every script hardcodes `~/gym-reel` (`build_scenes.py`, `sound.py`, `mix.sh`). Two copies exist: `~/Downloads/gym-reel` (pristine zip) and `~/gym-reel` (already run, with `deliver/`, archive-clips test output, built `footage.mp4`). | Running the scripts "from" Downloads reads and **overwrites the home-folder copy**. |
| 2 | `sound.py` loads SFX from `~/content-studio-pack/skills/sound-effects/sfx`, which does not exist. The library is now at `~/.claude/skills/sound-effects/sfx`. | `sound.py` fails as shipped. |
| 3 | `video/assets/footage.mp4` is absent in the Downloads copy. | The Downloads project will not render until `make_assets.sh` runs. |
| 4 | Fonts (League Gothic, Inter, Space Mono) are named in CSS but never loaded (no `@font-face`, no font link). | Unverified: renders may fall back to system fonts unless HyperFrames resolves them. |
| 5 | `D = 38.3` and `atrim=0:38.3` are hardcoded in `sound.py` / `mix.sh` while the timeline length comes from JSON. | A re-cut of different length breaks the sound silently. |

None of these block learning from the project. They matter if we copy its scripts as a template.

---

## 3. How Co-Create relates today

- **Writing pipeline:** Bring → Draft → Polish → Done, with Frame emitting "The one thing:", the shared attention layer (Headline/Hook Lab, `ONE_THING_DOCTRINE`, scannability), the desire doctrine, voice lock and repurpose.
- **Video Studio:** piece or product → `VideoScript` (hook, beats, CTA) → Veo shot list → persona keyframe. Its target is **AI-generated footage in Google Flow**, not code-rendered motion graphics.
- **Quality layer:** `server/src/quality.ts` still encodes **anti-slop v1**: tier-one words become automatic critical violations, the verdict auto-drops to "Reject", and `headlineScore` subtracts points per banned word. v1.2 retires all three.

> **Correction (2026-11-21).** This section missed two uncommitted subsystems that were already in the working tree: an **adjudicated quality gate** (`registers.ts`, `slopGuards.ts`, `slopScan.ts`, `adjudicate.ts`, `publishGate.ts`, calibrated on the 120-item Slop Drill Pack) and **Video Studio V2** (sources → treatments → master script of `ProductionScene`s → adaptations → shots → storyboard → export). Both were committed as `60f041f` and the build below extends them rather than starting a second quality engine or a second script model. `quality.ts` is now only the sentence-hygiene sub-score under the publish gate.

**The gap:** Co-Create has the story ingredients (the one thing, the hook, beats, desire per section) but no export that a motion build can consume, and no text gate tuned for words seen for two seconds on a phone.

---

## 4. Anti-slop: what v1.2 changes and what to adopt

### 4.1 Version map

| Copy | Version | Notes |
|---|---|---|
| Installed in Claude (`anthropic-skills:anti-slop`) | v1 | Vocabulary tiers, em-dash quota, auto-reject |
| `~/Downloads/anti-slop.skill` | v1 (July 2026) | Same as installed |
| `~/Downloads/skill.zip` = `~/Downloads/anti-slop 2/` | **v1.2 "Codex edition"** (17 Nov 2026) | Identical to each other |

### 4.2 Adopt (general improvements)

- **Candidate → verify.** Pass 1 marks `F?` formulaic, `V?` vague/unsupported, `W?` wordy, `R?` repetitive. Pass 2 keeps a finding only with location, exact quote, mechanism and reader effect.
- **Primary-cause order** V → W → F → R when codes overlap.
- **Severity, confidence, frequency** instead of a numeric total. Low-confidence signals do not drive decisions.
- **No word policing.** Vocabulary and em-dashes are cues, not violations. No automatic rejection. No authorship claims.
- **`scripts/rapid_scan.py`**: stdlib-only candidate scanner for `.txt`/`.md` (plus `.docx`/`.pptx` with optional libs). Usable as a pre-scan on an exported script.

### 4.3 Do not wire in

About a third of v1.2 serves a different job: grading presentation decks on an evaluation platform (the nine-task router in `task-boundaries.md`, "live batch" authority rules, TRACE rationale checks, the ban on composing rationales, the 45-minute time plan). It is gated behind explicit presentation-task mentions, so it is inert here, but it should not shape this pipeline.

### 4.4 Where it sits in the motion workflow

Anti-slop judges **words only**: the narration script and the on-screen text. Visuals are judged by `motion-review-loop`. v1.2 draws the same line ("avoided extending written-content grading to visual-only tasks").

On-screen text gets the strictest read. A viewer sees each line for one or two seconds, so a `V?` (vague benefit) or `R?` (header restating the line below it) costs more on screen than in an essay.

---

## 5. Proposed workflow

### 5.1 The chain

| # | Stage | Where | Output | Gate |
|---|---|---|---|---|
| 0 | Brand (once) | Claude Code `brand-intake` | `brand/brand.md`, `brand/MOTION.md` | Colours, type, logo come from the brand |
| 1 | Write | Co-Create | Finished piece in voice | Existing craft passes |
| 2 | **Shape the story** | Co-Create (new) | `story.json` + `brief.md` | One thing stated; hook works at frame 0 with sound off; every beat has a visible want or turn |
| 3 | **Words gate** | Co-Create (new, v1.2) | Verified findings on VO + on-screen lines | No verified major/moderate finding; every claim traces to the source piece; each line fits its time on screen |
| 4 | Handoff | Co-Create export | Piece folder (content-studio layout) | `story.json` validates against the schema |
| 5 | Build | Claude Code `content-studio` → `hyperframes` (or `animate`) | `video/` | A generator reads `story.json`; no copy typed into HTML |
| 6 | Sound | `sound-effects`, `media-use` | Music, SFX, optional VO | Cuts on the beat; one sound per visible action |
| 7 | Review | `motion-review-loop` | `review/REVIEW.md` + contact sheets | A full pass finds nothing to fix |
| 8 | Deliver | `reel-export`, `ffmpeg-skill check.py` | `deliver/<piece>_<platform>_<ratio>_<s>s.mp4` | Every file passes its platform check |

Stages 2–4 are the new work. Everything from 5 onward already exists in the installed pack.

### 5.2 The handoff contract (`story.json`, sketch)

Modelled on `rep_times.json`: the one file the generator reads.

```json
{
  "piece": "archive-of-efficiency",
  "source": { "postId": "…", "title": "The Archive of Efficiency" },
  "oneThing": "Organizing the work quietly became the work.",
  "audience": "…", "beliefNow": "…", "beliefAfter": "…",
  "format": { "lane": "kinetic-type", "ratio": "9:16", "seconds": 30 },
  "hooks": [{ "id": "A", "line": "My todo app has 4 todo apps inside it.", "score": 9 }],
  "beats": [
    {
      "id": "b1", "start": 0.0, "end": 2.0, "role": "hook",
      "onScreen": ["MY TODO APP", "HAS 4 TODO APPS IN IT."],
      "vo": null,
      "visual": "app icons stack inside each other, nesting inward",
      "turn": "recognition",
      "transitionOut": "zoom-through",
      "sourceQuote": "My todo app has four archived todo apps inside it."
    }
  ],
  "cta": "Full essay in bio.",
  "claims": [{ "text": "…", "source": "[NEEDS SOURCE]" }]
}
```

Rules: `onScreen` is the only copy the generator may render; `sourceQuote` ties each beat back to the essay; unverifiable claims stay marked `[NEEDS SOURCE]` (content-studio rule 7).

### 5.3 Pick the lane per piece

| Lane | Engine | Suits |
|---|---|---|
| Kinetic type + motion graphics | `hyperframes` (+ `motion-doctrine`, `cut-the-curve`, `captions-overlay`) | Essay hooks, the one thing as a 15–30 s reel, quote cards |
| Illustrated narrative | `animate` (cut paper, ink, riso, pixel…) | Stories, histories, explainers with a character |
| Data and numbers | `animated-chart`, `milestone-reveal` | A result or stat inside the piece |
| AI-actor UGC | Co-Create Video Studio → Google Flow | Talking-head promotion (already built) |

One story feeds all four. Video Studio's `VideoScript` and `story.json` should share a beat model rather than become two script systems.

### 5.4 Piece folder

```
<piece>/
  story.json   brief.md        ← exported from Co-Create
  brand/                        ← brand-intake, once per brand
  work/        video/          ← Claude Code build
  review/      deliver/
```

---

## 6. Recommendations

1. **Build stages 2–4 inside Co-Create; leave stages 5–8 to the installed pack.** The pack already handles HyperFrames, sound, review and delivery well. The writing system's strength is the story and the words.
2. **Make `story.json` the contract.** Generator-driven builds (as in gym-reel) keep every on-screen word traceable and make revisions a data edit.
3. **Refactor `quality.ts` to v1.2.** Replace tier-one auto-criticals, the auto-"Reject" verdict and `headlineScore`'s per-word penalty with candidate → verify findings (code, severity, confidence, frequency). Keep `DEFAULT_BANNED_TERMS` as an author preference in the voice profile, not a scoring penalty.
4. **Install a writing-system edition of v1.2** in Claude: the F/V/W/R core, references and `rapid_scan.py`, without the presentation-grading branch, so Co-Create and Claude Code apply one standard.
5. **Add a reading-time check per beat** (on-screen words vs seconds shown). Treat any threshold as a starting point to tune in review, not a fixed rule.
6. **Turn gym-reel into a template only after fixing its traps** (§2.6): parametrize paths and duration, point SFX at the installed library, load fonts explicitly.
7. **Start with one lane** (kinetic type in HyperFrames) and one existing essay before generalizing.

---

## 7. Decisions (2026-11-20)

| Question | Decision |
|---|---|
| Where the story step lives | **Inside Co-Create** — a new export: piece → story beats → words gate → `story.json` + `brief.md` |
| First lane | **Kinetic type** in HyperFrames |
| Narration | **Text-only, sound-off first** — meaning carried by on-screen words, music and SFX |
| Anti-slop v1.2 deck-grading branch | **Keep intact** in the Claude install (used for separate work); this pipeline uses only the writing-quality core |

Consequences: the words gate is the most important check in the chain, because on-screen text carries the whole meaning. No VO track, so `story.json` beats carry `onScreen` lines only (`vo` stays reserved for later). `quality.ts` adopts v1.2's general method; it does not import the deck-grading router.

### Still open

- Is Claude Code the permanent build environment, or should Co-Create eventually render in-app?
- ~~Production is down.~~ Restored at `https://co-create-production.up.railway.app` (2026-11-20).

---

## 8. Status (2026-11-21): steps 1–5 built

| Step | Built | Where |
|---|---|---|
| 1. Anti-slop v1.2 | F/V/W/R primary cause ranked by evidence tier then V > W > F > R; severity, confidence and frequency on every finding; low-confidence cues shown but never counted; no auto-Reject; `rewriteSlop` keeps only meaning-preserving deletions; `headlineScore` judges portability, not banned words. Drill pack unchanged: 99.2% accuracy, 0% false positives, 97.1% recall, 90.9% bucket agreement. v1.2 installed intact at `~/.claude/skills/anti-slop`. | `f3ec13a` |
| 2. Story stage | "Make a motion story" on Done → a Video Studio project with a **Motion story** stage. Beats extend `ProductionScene` with start/end, on-screen lines, emphasis, seam out and the verbatim source sentence. The Hook Lab scorer ranks the opening card. | `e83cd4a` |
| 3. Words gate | v1.2 on every card in its register (hook = title, turn = caption, payoff = closing); reading time (0.6 s + 1 s per 3 words); every beat traced to a sentence of the piece; no figure on screen the piece does not state; hook at second 0. Approval needs a pass on the current content hash. | `e83cd4a` |
| 4. Export | Approved stories download as a content-studio piece folder: `story.json` (contract `co-create.motion-story/1`, frames exact at 30 fps), `brief.md`, `CLAUDE.md`, `source/`, `brand/`, `work/`, `video/`, `review/`, `deliver/`. V2's export package lists the story too. | `e83cd4a` |
| 5. Proof reel | *The Rearview* (archive post 1) → `story.json` → HyperFrames, built data-first by `work/build_scenes.mjs`: `check` 0 errors, seam gate 7/7, ffprobe-clean 1080×1920 H.264 with a silent AAC track, 795 frames = the contract's frame count. Folder: `Writing System/reels/the-rearview/`, notes in its `REVIEW.md`. | outside the repo |

What the build taught the product (folded back in): vertical lines run about 5 words, not 7; a film uses 2–3 seam kinds; the payoff can't double as the hook; a line break before a capital ends a unit (poems, titles); repeated stems ("You are worried about…") are one card, not three; the first line of every beat must ride in with its seam, or the cut carries nothing.
