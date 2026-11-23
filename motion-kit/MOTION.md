# Motion language: the three house looks

Read from the code at `789169f` (23 Nov 2026): `shared/src/motionLooks.ts` (the looks), `motion-kit/build.mjs` (what the builder writes) and `motion-kit/runtime/kit.js` (shake, draw-on, count-up, boil). This file describes the code; it sets nothing. When the code changes, update this file from it. "Not set" means the code has no value for that row.

Row structure: `brand-intake` (Step 3, motion-language table).

## Shared by all three looks

The builder writes the same seams, word timing and hold for every look; only the word arrival, the treatments and the carrier differ.

| Seam (story `transitionOut`) | Exit (end of beat) | Entry (start of next beat) | Source |
| --- | --- | --- | --- |
| Cut-the-curve LEFT (`cut-the-curve`, and also `waterfall`, `rack-focus`, `cut`) | stage `xPercent` 0 → -12 and opacity to 0, 0.34 s `power3.in` | stage `xPercent` 10 → 0, opacity 0.35 → 1, 0.42 s `power4.out` | `build.mjs` SEAM, `entryTween`, `exitTween` |
| Zoom-through (push) | scale 1 → 1.18, blur 0 → 10 px, 0.21 s `power3.in`; opacity to 0, 0.21 s linear | scale 0.78 → 1, blur 10 → 0, opacity 0.15 → 1, 0.5 s `expo.out` | same |
| Inverse zoom (pull) | scale 1 → 0.8, same timings | scale 1.25 → 1, same timings | same |
| Rise UP into the payoff (`hold`) | stage `yPercent` 0 → -12, 0.34 s `power3.in` | stage `yPercent` 10 → 0, 0.42 s `power4.out` | same |

- The first line of each beat rides in with the seam entry; the hook's first line is on screen at frame 0.
- No crossfades: every seam is one of the four above.

## Motion language: Paper & Ember

| Row | Value |
|---|---|
| Arrival ease | Words are written on: a clip-path wipe left to right, 0.26 s `power2.inOut`. Marks (hook and CTA default `underline`, proof default `circle`) draw on 0.2 s after their word, `power2.inOut`: underline 0.5 s, circle 0.6 s, strike 0.35 s. |
| Exit ease | Words never leave on their own; the stage leaves with the seam (`power3.in`, see Shared). |
| Base timing unit | Not set. |
| Stagger rhythm | Reading order. Words 0.09 s apart; lines 0.33 s apart (hook 0.3 s). Payoff: one word every 0.09 s from 0.35 s. `focus` second line: 0.06 s a word. |
| Budget | Seams: in 10 %, out 12 % of the frame; zoom scales 0.78 / 1.18 and 1.25 / 0.8; blur 10 px. Overshoot: none (no `back` or `elastic` ease anywhere). A `slam`, if a writer picks it: scale 1.7 → 1 plus a 10 px, three-frame shake. |
| Hold rule | Landed words hold still until the stage exits (beat end − 0.34 s, or − 0.21 s on a zoom). The payoff holds to the last frame (`data-hold`). Minimum read time: not set in motion-kit (beat lengths come from `story.json`). |
| The one wow | Not set. |

Carrier: none. Grain 0.08.

## Motion language: Night Signal

| Row | Value |
|---|---|
| Arrival ease | Words blur in: opacity 0 → 1, blur 8 → 0 px, 0.16 s `power4.out`. Hook default `slam`: opacity 0 → 1, scale 1.7 → 1, 0.28 s `expo.out`, then a three-frame shake (10 px, one frame per step, `power2.out`). |
| Exit ease | Words never leave on their own; the stage leaves with the seam (`power3.in`). Proof default `focus`: line 1 falls back to opacity 0.4 and blur 5 px, 0.35 s `power2.inOut`. |
| Base timing unit | Not set. |
| Stagger rhythm | Reading order. Words 0.09 s apart; lines 0.33 s apart (hook 0.3 s). Payoff: one word every 0.09 s from 0.35 s. `focus` second line starts at max(1.1 s, 0.6 s + first-line words ÷ 3), 0.06 s a word. |
| Budget | Seams as Shared. Slam: scale 1.7 → 1, shake 10 px. Overshoot: none. Lane dashes: 220 px left per leftward cut. |
| Hold rule | As Paper & Ember. |
| The one wow | Not set. |

Carrier: lane dashes at y 1560, accent at 34 % opacity. They move only at seams: 220 px left per leftward cut, 0.76 s `power3.inOut` from 0.34 s before the cut. Before the rise they fade out over 0.5 s, `power2.in`. Grain 0.06.

## Motion language: Riso Print

| Row | Value |
|---|---|
| Arrival ease | Words print in two plates. Plate B (orange) fades in and settles into its off-register spot, 0.2 s `power3.out`. Plate A (blue) prints on 0.06 s later, 0.08 s linear. Hook and CTA default `stamp`: plate A scale 1.3 → 1 and rotation −4° → 0, 0.12 s `power4.out`; plate B from (16, 12) px to (7, 5) px, 0.35 s `power3.out`; then an 8 px three-frame shake. Proof default `count`: the figure fades in over 0.12 s and counts up over 1.3 s, `power2.out`. |
| Exit ease | Words never leave on their own; the stage leaves with the seam (`power3.in`). |
| Base timing unit | Not set. |
| Stagger rhythm | As Paper & Ember. |
| Budget | Plate B settles at (off, 0.7 × off) px from (off + 6, off + 3), where off is 4, or 7 on emphasis words. Stamp: scale 1.3, rotation 4°, shake 8 px. Seams as Shared. Overshoot: none. |
| Hold rule | As Paper & Ember. |
| The one wow | Not set. |

Carrier: a static halftone field fading up from the bottom (no tween). Grain 0.1.

## Contrast pairs (computed from `motionLooks.ts`, WCAG 2 ratio against the ground)

| Look | ink | accentText (emphasis word) | accent (marks, icons) | second | muted (not meant to be read) |
| --- | --- | --- | --- | --- | --- |
| Paper & Ember | 15.74 | 4.85 | 3.43 | 5.21 | 1.87 |
| Night Signal | 16.16 | 8.96 | 8.96 | 5.00 | 2.18 |
| Riso Print | 8.47 | 8.47 | 3.41 (was 2.63) | 2.63 (decorative plate) | 1.60 |

`motionLooks.ts` asks 4.5:1 of `accentText` and 3:1 of `accent`, and a test now holds every look to it. Riso's accent was `#FF5C39` (2.63:1) and is now `#E8441F` (3.41:1) for marks and icons; the off-register plate behind blue words keeps `#FF5C39` as `second`, since it is decorative.

## Found while reading the code (not rules; for review)

- The left and up seams exit on `power3.in` (12 % in 0.34 s) and enter on `power4.out` (10 % in 0.42 s). The ease names differ, but the speeds at the cut match within about 11 % (106 vs 95 % a second), which is what the seam gate measures. Switching the exit to `power4.in` would make it worse (141 vs 95). Leave it unless the distances or durations change.
- Story seams `waterfall` and `rack-focus` build as plain cut-the-curve LEFT. There is no per-word waterfall and no focus pull.
- Paper & Ember marks keep boiling after they draw (`MK.boil`: re-posed every 3 frames, up to 1.1 px and 0.4°) for the rest of the beat. That is sustained motion; check it against `motion-doctrine`'s idle-wobble ban.
- A picture plate (any look) pushes in from scale 1 to 1.06 linearly for its whole beat.
