# motion-kit

Turns an approved Co-Create motion story (`story.json`, contract `co-create.motion-story/2`) into a HyperFrames project in one of the house looks. Co-Create ships this folder inside every exported piece folder at `work/motion-kit/`.

```bash
node work/motion-kit/build.mjs .                                   # the story's own look -> video/
node work/motion-kit/build.mjs . --look riso-print --out video-riso   # try another look
```

It writes `index.html`, one scene per beat in `compositions/`, `ledger.json` (the vector ledger for motion-doctrine's seam gate), `cues.json` (the cue list for the sound-effects skill), and copies GSAP, the kit runtime and the look's font. Zero dependencies; Node 18 or later.

## The looks

Defined once in `shared/src/motionLooks.ts`; `looks.json` here is generated from it (a test keeps them in step).

| Look | For | Medium | Type | Music mood |
| --- | --- | --- | --- | --- |
| Paper & Ember | reflective essays, Co-Create's own posts | ink on warm paper, an ember pen marks the key word | Syne 700 | calm, warm |
| Night Signal | punchy, motivational pieces | headlight caps on asphalt, lane dashes travel with every cut | League Gothic | night drive, tension that resolves |
| Riso Print | lists, proof, figures, marketing | two-plate risograph: blue ink, orange off-register plate, halftone | Archivo Black | bright, bouncy |

## Treatments (per beat)

`reveal`, `slam`, `underline`, `circle`, `strike`, `focus`, `count`, `stamp` (Riso only; a slam elsewhere), `still`. A beat with no treatment takes its look's default for its role. Treatments that need a key word fall back to `reveal` without one; `count` needs a number.

## Rules the builder keeps

- Copy is data. Every on-screen word comes from `story.json`. The builder may split a long line where a look's typeface is wide (layout only), never change a word.
- Type is fitted to the real font at render time and kept clear of the platform UI: the text block sits in the 168–1330 px band and ends before the right-hand 120 px action rail.
- Every seam is a mirrored-ease cut in the film's current (left), with zoom-through, inverse zoom and the payoff's rise spent on meaning. The first line of each beat rides in with its seam, so a cut always carries words.
- Everything is a function of timeline time: no clocks, no unseeded randomness, no network.

## Fonts and licences

`assets/fonts/LICENSES.md`: Syne and DM Sans under the SIL Open Font License. GSAP is under its own standard licence (header in `assets/vendor/gsap.min.js`). Music is never shipped here: pick a track per the look's suggestion and check its licence page before export.
