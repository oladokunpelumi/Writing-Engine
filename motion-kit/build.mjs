#!/usr/bin/env node
// motion-kit builder: story.json + a house look -> a HyperFrames project.
//
//   node build.mjs [pieceDir] [--look <id>] [--out <dir>] [--treatments t1,t2,...]
//
// pieceDir defaults to the current folder (the piece folder Co-Create exports).
// Writes <pieceDir>/video (or --out): index.html, compositions/b<N>.html,
// ledger.json (the vector ledger for motion-doctrine's seam gate),
// package.json, hyperframes.json and assets (GSAP, the kit runtime, fonts).
// Copy, times and seams are data from story.json; never hand-edit them in video/.
// Zero dependencies; Node 18+.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const PIECE = resolve(positional[0] ?? ".");
const story = JSON.parse(readFileSync(join(PIECE, "story.json"), "utf8"));
const looks = JSON.parse(readFileSync(join(KIT, "looks.json"), "utf8"));
const lookId = flag("look") ?? story.look ?? "paper-ember";
const look = looks.looks[lookId];
if (!look) throw new Error(`Unknown look "${lookId}". Known: ${Object.keys(looks.looks).join(", ")}`);
const OUT = resolve(PIECE, flag("out") ?? "video");
const overrides = flag("treatments")?.split(",");

const { width: W, height: H } = story.canvas;
const FPS = story.fps;
const MARGIN = 96;
const MAX_WIDTH = 850; // ends by x ~946: clear of the right-hand 120 px action rail
const CENTRE_Y = 740; // the text block's centre, inside the 168-1330 px band
const r3 = (n) => +Number(n).toFixed(3);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9$%.,']/g, "").replace(/[.,']+$/g, "").replace(/^[']+/, "");

const SEAM = {
  "cut-the-curve": { axis: "x", dir: -1, technique: "cut-the-curve LEFT" },
  waterfall: { axis: "x", dir: -1, technique: "cut-the-curve LEFT" },
  "rack-focus": { axis: "x", dir: -1, technique: "cut-the-curve LEFT" },
  cut: { axis: "x", dir: -1, technique: "cut-the-curve LEFT" },
  "zoom-through": { axis: "z", dir: 1, technique: "zoom-through (push)" },
  "inverse-zoom": { axis: "z", dir: -1, technique: "inverse zoom (pull)" },
  hold: { axis: "y", dir: -1, technique: "rise UP after stillness (payoff)" }
};
const Z_BLUR = 10;

// Split a story line that is too long for this look's face at the word boundary
// nearest its middle. Layout only: the words and their order never change.
function rewrap(storyLines, maxChars) {
  const split = (line) => {
    const words = line.split(/\s+/);
    if (line.length <= maxChars || words.length < 2) return [line];
    let best = 1, bestGap = Infinity;
    for (let i = 1; i < words.length; i++) {
      const gap = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (gap < bestGap) { bestGap = gap; best = i; }
    }
    return [...split(words.slice(0, best).join(" ")), ...split(words.slice(best).join(" "))];
  };
  let out = storyLines.flatMap(split);
  if (out.length > 5) out = rewrap(storyLines, maxChars + 4);
  return out;
}

function resolveTreatment(treatment, emphasis) {
  const hasFigure = emphasis.some((w) => /\d/.test(w));
  const has = emphasis.length > 0;
  if (treatment === "count" && !hasFigure) return has ? "circle" : "reveal";
  if (treatment === "stamp" && look.id !== "riso-print") return has ? "slam" : "reveal";
  if (["slam", "underline", "circle", "strike", "stamp"].includes(treatment) && !has) return "reveal";
  return treatment;
}

function entryTween(sel, seam) {
  if (!seam) return "";
  if (seam.axis === "z") {
    const from = seam.dir === -1 ? 1.25 : 0.78;
    return `tl.fromTo("${sel}", { autoAlpha: 0.15, scale: ${from}, filter: "blur(${Z_BLUR}px)" }, { autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.5, ease: "expo.out" }, 0);`;
  }
  const prop = seam.axis === "x" ? "xPercent" : "yPercent";
  return `tl.fromTo("${sel}", { ${prop}: ${-10 * seam.dir}, autoAlpha: 0.35 }, { ${prop}: 0, autoAlpha: 1, duration: 0.42, ease: "power4.out" }, 0);`;
}

function exitTween(sel, seam, dur) {
  if (!seam) return "";
  if (seam.axis === "z") {
    const to = seam.dir === -1 ? 0.8 : 1.18;
    const at = r3(dur - 0.21);
    return `tl.to("${sel}", { scale: ${to}, filter: "blur(${Z_BLUR}px)", duration: 0.21, ease: "power3.in" }, ${at});
      tl.to("${sel}", { autoAlpha: 0, duration: 0.21, ease: "none" }, ${at});`;
  }
  const prop = seam.axis === "x" ? "xPercent" : "yPercent";
  return `tl.to("${sel}", { ${prop}: ${12 * seam.dir}, autoAlpha: 0, duration: 0.34, ease: "power3.in" }, ${r3(dur - 0.34)});`;
}

// How a word arrives in this medium: returns GSAP code for one word (plate A id, plate B id or null).
function revealCode(idA, idB, at, isAccent) {
  if (look.revealStyle === "blur") {
    return `tl.fromTo("#${idA}", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, ease: "power4.out" }, ${r3(at)});`;
  }
  if (look.revealStyle === "ink") {
    // written on, left to right, like a pen: nothing shows before its moment
    return `tl.fromTo("#${idA}", { clipPath: "inset(-25% 100% -25% -2%)" }, { clipPath: "inset(-25% -2% -25% -2%)", duration: 0.26, ease: "power2.inOut" }, ${r3(at)});`;
  }
  // print: plate B lands off register, plate A prints on top a beat later
  const off = isAccent ? 7 : 4;
  return `tl.fromTo("#${idB}", { opacity: 0, x: ${off + 6}, y: ${off + 3} }, { opacity: 1, x: ${off}, y: ${Math.round(off * 0.7)}, duration: 0.2, ease: "power3.out" }, ${r3(at)});
      tl.fromTo("#${idA}", { opacity: 0 }, { opacity: 1, duration: 0.08, ease: "none" }, ${r3(at + 0.06)});`;
}

const fontFace = look.display.file
  ? `@font-face { font-family: "${look.display.family}"; src: url("assets/fonts/${look.display.file}") format("woff2"); font-weight: ${look.display.weight}; font-display: block; }`
  : "";

mkdirSync(join(OUT, "compositions"), { recursive: true });
mkdirSync(join(OUT, "assets", "vendor"), { recursive: true });
mkdirSync(join(OUT, "assets", "fonts"), { recursive: true });
copyFileSync(join(KIT, "assets", "vendor", "gsap.min.js"), join(OUT, "assets", "vendor", "gsap.min.js"));
copyFileSync(join(KIT, "runtime", "kit.js"), join(OUT, "assets", "kit.js"));
if (look.display.file) copyFileSync(join(KIT, "assets", "fonts", look.display.file), join(OUT, "assets", "fonts", look.display.file));
// Pictures made in Co-Create (finished stills, icons) and hero shots made by shots.mjs.
const VISUALS = join(PIECE, "assets", "visuals");
if (existsSync(VISUALS)) {
  mkdirSync(join(OUT, "assets", "visuals"), { recursive: true });
  for (const name of readdirSync(VISUALS)) copyFileSync(join(VISUALS, name), join(OUT, "assets", "visuals", name));
}
const hasFile = (rel) => Boolean(rel) && existsSync(join(PIECE, rel));

const beats = story.beats;
const ledger = { fps: FPS, look: look.id, seams: [] };
const hosts = [];
const laneMoves = [];
const cues = []; // for the sound pass (sound-effects skill): cue times on the film clock

beats.forEach((beat, i) => {
  const id = `b${i + 1}`;
  const dur = r3(beat.end - beat.start);
  const inSeam = i > 0 ? SEAM[beats[i - 1].transitionOut] : undefined;
  const outSeam = i < beats.length - 1 ? SEAM[beat.transitionOut] : undefined;
  const lines = rewrap(beat.lines, look.display.maxChars).map((line) => (look.display.caps ? line.toUpperCase() : line));
  const emphasis = (beat.emphasis ?? []).map(norm).filter(Boolean);
  const chosen = overrides?.[i] && overrides[i] !== "-" ? overrides[i] : beat.treatment ?? look.defaults[beat.role] ?? "reveal";
  const treatment = resolveTreatment(chosen, beat.emphasis ?? []);
  const isHook = i === 0;
  const isPayoff = beat.role === "payoff";
  const marks = ["underline", "circle", "strike"].includes(treatment);
  const landed = ["slam", "stamp", "count"].includes(treatment);
  const plates = look.revealStyle === "print";
  // The beat's picture, if it exists on disk.
  const v = beat.visual && hasFile(beat.visual.file) ? beat.visual : null;
  const isPlate = v && v.kind !== "icon" && v.placement === "plate";
  const isObject = v && v.kind === "still" && v.placement === "object";
  const isIcon = v && v.kind === "icon";
  const video = v && v.video && hasFile(v.video.file) ? v.video : null;
  const centreY = isObject || isIcon ? 540 : CENTRE_Y;
  let mediaHtml = "";
  if (isPlate) {
    mediaHtml = `<div id="${id}-platewrap" class="platewrap"><img id="${id}-plate" class="plate" src="${v.file}" alt="" />${
      video ? `<video id="${id}-video" class="clip plate" src="${video.file}" data-start="0" data-duration="${dur}" data-track-index="0" muted playsinline></video>` : ""
    }</div>`;
  } else if (isObject) {
    mediaHtml = `<img id="${id}-object" class="object" src="${v.file}" alt="" />`;
  } else if (isIcon) {
    const svg = readFileSync(join(PIECE, v.file), "utf8").replace("<svg", `<svg id="${id}-icon" class="icon"`);
    mediaHtml = svg;
  }

  // Words with ids; the first emphasis word found is the treatment's target.
  let targetId = null;
  const words = lines.map((line, l) =>
    line.split(/\s+/).map((text, w) => {
      const wid = `${id}-l${l + 1}w${w + 1}`;
      const accent = emphasis.includes(norm(text));
      if (accent && !targetId) targetId = wid;
      return { text, wid, l, w, accent };
    })
  );
  const flat = words.flat();
  const target = flat.find((x) => x.wid === targetId);

  const lineHtml = (l, plate) =>
    `<div id="${id}-l${l + 1}${plate}" class="line${plate ? " plate-b" : ""}"${plate ? ' aria-hidden="true" data-layout-ignore data-layout-allow-overlap' : ""}>${words[l]
      .map((x) => {
        const cls = ["w"];
        // Riso keeps every word blue ink; emphasis is a wider orange off-register shadow.
        if (x.accent && !marks && !plates) cls.push("accent");
        return `<span id="${x.wid}${plate}" class="${cls.join(" ")}">${esc(x.text)}</span>`;
      })
      // A gap is its own element: whitespace text between spans can be rewritten by the runtime.
      .join('<span class="sp">&nbsp;</span>')}</div>`;
  const markup = lines.map((_, l) => (plates ? lineHtml(l, "-b") + "\n        " : "") + lineHtml(l, "")).join("\n        ");
  const markSvg = marks && target ? `<svg id="${id}-mark" class="mark" viewBox="0 0 10 10" preserveAspectRatio="none"><path id="${id}-mark-path"/></svg>` : "";

  // ---- timing: line 1 rides in with the stage (beat 1: it IS frame 0) ----
  const tw = [];
  const lineStart = (l) => (isHook ? 0.3 * l : 0.02 + 0.33 * l);
  let tTarget = 0.3;
  let k = 0;
  for (const x of flat) {
    const carried = x.l === 0 && !(landed && x.wid === targetId);
    const idx = k++;
    if (carried) {
      // Riso: a carried word's plate B still sits off register.
      if (plates) { const off = x.accent ? 7 : 4; tw.push(`gsap.set("#${x.wid}-b", { x: ${off}, y: ${Math.round(off * 0.7)} });`); }
      continue;
    }
    let at;
    if (isPayoff) at = 0.35 + 0.09 * (idx - words[0].length);
    else if (x.l === 0) at = isHook ? 0.3 : 0.25; // a landed target on the carried line
    else at = lineStart(x.l) + 0.09 * x.w;
    if (treatment === "focus" && x.l >= 1) at = r3(Math.max(1.1, 0.6 + words[0].length / 3) + 0.06 * x.w);
    if (x.wid === targetId) tTarget = at;
    if (x.wid === targetId && landed) continue; // the treatment brings it in
    tw.push(revealCode(x.wid, `${x.wid}-b`, at, x.accent));
  }
  if (target && !landed) tTarget = tTarget || 0.3;

  // ---- the treatment ----
  if (treatment === "slam" && target) {
    tw.push(`tl.fromTo("#${target.wid}", { opacity: 0, scale: 1.7 }, { opacity: 1, scale: 1, duration: 0.28, ease: "expo.out" }, ${r3(tTarget)});`);
    if (plates) tw.push(`tl.fromTo("#${target.wid}-b", { opacity: 0, scale: 1.7, x: 7, y: 5 }, { opacity: 1, scale: 1, duration: 0.28, ease: "expo.out" }, ${r3(tTarget)});`);
    tw.push(`MK.shake(tl, "#${id}-shake", ${r3(tTarget + 0.28)}, 10);`);
  }
  if (treatment === "stamp" && target) {
    tw.push(`tl.fromTo("#${target.wid}", { opacity: 0, scale: 1.3, rotation: -4 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.12, ease: "power4.out" }, ${r3(tTarget)});`);
    tw.push(`tl.fromTo("#${target.wid}-b", { opacity: 0, scale: 1.3, rotation: -4, x: 16, y: 12 }, { opacity: 1, scale: 1, rotation: 0, x: 7, y: 5, duration: 0.35, ease: "power3.out" }, ${r3(tTarget)});`);
    tw.push(`MK.shake(tl, "#${id}-shake", ${r3(tTarget + 0.12)}, 8);`);
  }
  if (treatment === "count" && target) {
    tw.push(`tl.fromTo("#${target.wid}", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, ${r3(tTarget)});`);
    tw.push(`MK.countUp(tl, document.getElementById("${target.wid}"), ${JSON.stringify(target.text)}, ${r3(tTarget)}, 1.3);`);
    if (plates) {
      tw.push(`tl.fromTo("#${target.wid}-b", { opacity: 0 }, { opacity: 1, duration: 0.12, ease: "none" }, ${r3(tTarget)});`);
      tw.push(`MK.countUp(tl, document.getElementById("${target.wid}-b"), ${JSON.stringify(target.text)}, ${r3(tTarget)}, 1.3);`);
    }
  }
  if (treatment === "focus" && lines.length > 1) {
    const at = r3(Math.max(1.1, 0.6 + words[0].length / 3));
    tw.push(`tl.fromTo("#${id}-l1", { opacity: 1, filter: "blur(0px)" }, { opacity: 0.4, filter: "blur(5px)", duration: 0.35, ease: "power2.inOut" }, ${at});`);
    if (plates) tw.push(`tl.fromTo("#${id}-l1-b", { opacity: 1 }, { opacity: 0, duration: 0.35, ease: "power2.inOut" }, ${at});`);
  }
  // Pictures move with purpose: a plate pushes in slowly for the whole beat; an
  // object settles in as a secondary move; an icon draws itself on in the accent.
  if (isPlate) tw.push(`tl.fromTo("#${id}-platewrap", { scale: 1 }, { scale: 1.06, duration: ${dur}, ease: "none" }, 0);`);
  if (isObject) tw.push(`tl.fromTo("#${id}-object", { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, 0.25);`);
  if (isIcon) {
    tw.push(`tl.fromTo("#${id}-icon *", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: "power2.inOut", stagger: 0.08 }, 0.3);`);
    cues.push({ t: r3(beat.start + 0.3), type: "hover_or_small_ui", desc: `icon ${v.icon} draws on` });
  }

  const markAt = r3(tTarget + 0.2);
  const markDur = treatment === "circle" ? 0.6 : treatment === "strike" ? 0.35 : 0.5;

  if (i > 0) cues.push({ t: r3(beat.start), type: "scene_cut", desc: `cut into ${beat.id}` });
  if (target && treatment === "slam") cues.push({ t: r3(beat.start + tTarget + 0.26), type: "reveal", desc: `${target.text} lands` });
  if (target && treatment === "stamp") cues.push({ t: r3(beat.start + tTarget + 0.1), type: "reveal", desc: `${target.text} stamped` });
  if (target && marks) cues.push({ t: r3(beat.start + markAt), type: "hover_or_small_ui", desc: `${treatment} on ${target.text}` });
  if (target && treatment === "count") cues.push({ t: r3(beat.start + tTarget), type: "hover_or_small_ui", desc: `${target.text} counts up` });
  if (isPayoff && i > 0) cues.push({ t: r3(Math.max(0, beat.start - 1.4)), type: "build_up", dur: 1.4, desc: "the held beat rises into the payoff" });

  // A beat whose last line lands early holds still; the payoff holds to the end.
  const stage = `#${id}-stage`;
  const fit = `MK.fit(${JSON.stringify(lines)}, { family: ${JSON.stringify(look.display.family)}, weight: ${look.display.weight}, maxWidth: ${MAX_WIDTH}, max: ${look.display.maxSize}, min: 84 })`;
  const html = `<template>
  <style>
    ${fontFace}
    #${id} { position:absolute; inset:0; }
    #${id}-stage { position:absolute; inset:0; transform-origin:50% ${((CENTRE_Y / H) * 100).toFixed(1)}%; }
    #${id}-shake { position:absolute; inset:0; }
    #${id} .line { position:absolute; left:${MARGIN}px; white-space:nowrap; font-family:"${look.display.family}", sans-serif;
      font-weight:${look.display.weight}; line-height:${look.display.lineHeight}; letter-spacing:${look.display.tracking}; color:var(--ink); }
    #${id} .plate-b { color:var(--second); }
    ${plates ? `#${id} .plate-b { mix-blend-mode:multiply; }` : ""}
    #${id} .w { display:inline-block; transform-origin:50% 60%; }
    #${id} .accent { color:var(--accent-text); }
    #${id} .plate-b .accent-b { color:var(--accent); }
    #${id} .mark { position:absolute; overflow:visible; pointer-events:none; }
    #${id} .platewrap { position:absolute; inset:0; overflow:hidden; transform-origin:50% 70%; }
    #${id} .plate { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
    #${id} .object { position:absolute; left:${(W - 560) / 2}px; top:880px; width:560px; height:560px; object-fit:contain; }
    #${id} .icon { position:absolute; left:${(W - 300) / 2}px; top:900px; width:300px; height:300px; overflow:visible; }
    #${id} .icon * { stroke:var(--accent); stroke-width:1.6; fill:none; }
    #${id} .mark path { fill:none; stroke:var(--accent); stroke-width:${look.markStroke}; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; }
  </style>
  <div id="${id}" data-composition-id="${id}" data-width="${W}" data-height="${H}">
    <div id="${id}-stage"${isPayoff ? ' data-hold="the payoff holds still to the last frame"' : ""}>
      ${mediaHtml}
      <div id="${id}-shake">
        ${markup}
        ${markSvg}
      </div>
    </div>
  </div>
  <script>
    // ${beat.role} · ${treatment}${chosen !== treatment ? ` (asked: ${chosen})` : ""} · ${beat.start}s-${beat.end}s · ${look.name}
    // From the piece: ${String(beat.sourceQuote).replace(/\n/g, " ")}
    (function () {
      const tl = gsap.timeline({ paused: true });
      const build = () => {
        const size = ${fit};
        const lh = size * ${look.display.lineHeight};
        const n = ${lines.length};
        const top = Math.round(${centreY} - (n * lh) / 2);
        for (let l = 0; l < n; l++) {
          for (const suffix of ["", "-b"]) {
            const el = document.getElementById("${id}-l" + (l + 1) + suffix);
            if (!el) continue;
            el.style.fontSize = size + "px";
            el.style.top = Math.round(top + l * lh) + "px";
          }
        }
        ${
          marks && target
            ? `const box = MK.wordBox(${JSON.stringify(lines[target.l].split(/\s+/))}, ${target.w}, { family: ${JSON.stringify(look.display.family)}, weight: ${look.display.weight}, size, trackingEm: ${parseFloat(look.display.tracking) || 0} });
        const mark = document.getElementById("${id}-mark");
        const path = document.getElementById("${id}-mark-path");
        const x = ${MARGIN} + box.x, w = box.w, h = size * ${look.display.lineHeight}, y = top + ${target.l} * lh;
        ${
          treatment === "circle"
            ? `const pad = h * 0.16; const bw = w + pad * 4, bh = h + pad * 2;
        Object.assign(mark.style, { left: (x - pad * 2) + "px", top: (y - pad) + "px", width: bw + "px", height: bh + "px" });
        mark.setAttribute("viewBox", "0 0 " + bw + " " + bh);
        path.setAttribute("d", MK.ellipsePath(bw / 2, bh / 2, bw / 2 - 4, bh / 2 - 4, ${i + 3}));`
            : treatment === "strike"
              ? `const bh = 40; Object.assign(mark.style, { left: (x - 6) + "px", top: (y + h * 0.5 - bh / 2) + "px", width: (w + 12) + "px", height: bh + "px" });
        mark.setAttribute("viewBox", "0 0 " + (w + 12) + " " + bh);
        path.setAttribute("d", MK.markPath(w + 12, bh, "strike", ${i + 3}));`
              : `const bh = 36; Object.assign(mark.style, { left: x + "px", top: (y + h * 0.88) + "px", width: w + "px", height: bh + "px" });
        mark.setAttribute("viewBox", "0 0 " + w + " " + bh);
        path.setAttribute("d", MK.markPath(w, bh, "underline", ${i + 3}));`
        }
        MK.drawOn(tl, path, ${markAt}, ${markDur});${look.id === "paper-ember" ? `\n        MK.boil(tl, mark, ${i + 7}, 1.1);` : ""}`
            : ""
        }
        ${entryTween(stage, inSeam)}
        ${tw.join("\n        ")}
        ${exitTween(stage, outSeam, dur)}
        window.__timelines["${id}"] = tl;
      };
      const ready = document.fonts && document.fonts.load
        ? document.fonts.load('${look.display.weight} 100px "${look.display.family}"').then(() => document.fonts.ready)
        : Promise.resolve();
      ready.then(build, build);
    })();
  </script>
</template>
`;
  writeFileSync(join(OUT, "compositions", `${id}.html`), html);
  hosts.push(
    `      <div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html"
        data-start="${beat.start}" data-duration="${dur}" data-track-index="${2 + (i % 2)}" data-track-kind="graphics"
        data-width="${W}" data-height="${H}" style="z-index:${10 + i}"></div>`
  );

  if (outSeam) {
    const next = `#b${i + 2}-stage`;
    const row = {
      id: `${beat.id}→${beats[i + 1].id}`,
      cut: beats[i + 1].start,
      technique: outSeam.technique,
      exit: { selector: stage, axis: outSeam.axis, dir: outSeam.dir },
      entry: { selector: next, axis: outSeam.axis, dir: outSeam.dir }
    };
    if (outSeam.axis === "z") {
      row.blur = Z_BLUR;
      row.entry.scanRoot = next;
    }
    ledger.seams.push(row);
    laneMoves.push({ cut: beats[i + 1].start, seam: outSeam });
  }
});

// ---- the ground: colour, grain, and the look's carrier ----
const total = r3(story.totalSeconds);
const dark = look.id === "night-signal";
const grain =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${dark ? 1 : 0}  0 0 0 0 ${dark ? 1 : 0}  0 0 0 0 ${dark ? 1 : 0}  0 0 0 ${look.grain * 2} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
  );

let carrierHtml = "";
let carrierCss = "";
let carrierTweens = "";
if (look.carrier === "lane-dashes") {
  // Lane dashes below the text band travel one dash-period with every leftward cut.
  carrierCss = `#lane-strip { position:absolute; left:0; top:1560px; width:${W * 4}px; height:14px; z-index:3;
        background:repeating-linear-gradient(90deg, var(--accent) 0 120px, transparent 120px 220px); opacity:0.34; }`;
  carrierHtml = `<div id="lane-strip" class="clip" data-start="0" data-duration="${total}" data-track-index="1" data-layout-ignore data-layout-allow-overflow></div>`;
  let x = 0;
  const moves = [];
  for (const m of laneMoves) {
    if (m.seam.axis === "x") {
      x -= 220;
      moves.push(`tl.to("#lane-strip", { x: ${x}, duration: 0.76, ease: "power3.inOut" }, ${r3(m.cut - 0.34)});`);
    } else if (m.seam.axis === "y") {
      moves.push(`tl.to("#lane-strip", { opacity: 0, duration: 0.5, ease: "power2.in" }, ${r3(m.cut - 0.5)});`);
    }
  }
  carrierTweens = moves.join("\n      ");
} else if (look.carrier === "halftone") {
  // Riso: every gradient is dots. A dot field fades up from the bottom edge.
  carrierCss = `#halftone { position:absolute; left:0; top:1080px; width:${W}px; height:840px; z-index:2;
        background-image:radial-gradient(circle, var(--second) 34%, transparent 36%); background-size:22px 22px;
        -webkit-mask-image:linear-gradient(to top, #000 0%, transparent 100%); mask-image:linear-gradient(to top, #000 0%, transparent 100%); opacity:0.28; }`;
  carrierHtml = `<div id="halftone" class="clip" data-start="0" data-duration="${total}" data-track-index="1" data-layout-ignore></div>`;
}

const music = existsSync(join(PIECE, "work", "music.json")) ? JSON.parse(readFileSync(join(PIECE, "work", "music.json"), "utf8")) : null;
if (music) {
  mkdirSync(join(OUT, "assets", "audio"), { recursive: true });
  copyFileSync(join(PIECE, music.file), join(OUT, "assets", "audio", music.name));
}
const audioHtml = music
  ? `<audio id="music" class="clip" src="assets/audio/${music.name}" data-start="0" data-duration="${total}" data-media-start="${music.mediaStart ?? 0}" data-track-index="20" data-volume="${music.volume ?? 0.8}" data-fade-in="${music.fadeIn ?? 0.4}" data-fade-out="${music.fadeOut ?? 1.5}"></audio>`
  : "";

const vars = [
  { id: "ground", type: "color", label: "Ground", default: look.palette.ground },
  { id: "ink", type: "color", label: "Ink", default: look.palette.ink },
  { id: "accent", type: "color", label: "Accent", default: look.palette.accent },
  { id: "second", type: "color", label: "Second ink", default: look.palette.second }
];
const index = `<!doctype html>
<html lang="en" data-composition-variables='${JSON.stringify(vars)}'>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${esc(story.title)} · ${esc(look.name)}</title>
    <script src="assets/vendor/gsap.min.js"></script>
    <script src="assets/kit.js"></script>
    <style>
      ${fontFace}
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { margin:0; width:${W}px; height:${H}px; overflow:hidden; background:${look.palette.ground}; }
      #root { width:100%; height:100%; position:relative; background:var(--ground, ${look.palette.ground});
        --ground:${look.palette.ground}; --ink:${look.palette.ink}; --accent:${look.palette.accent}; --accent-text:${look.palette.accentText}; --second:${look.palette.second}; }
      #ground { position:absolute; inset:0; z-index:1; background-color:var(--ground);
        background-image:url("${grain}"); background-size:260px 260px; }
      ${carrierCss}
    </style>
  </head>
  <body>
    <!-- Built by motion-kit/build.mjs from story.json (${story.contract}), look: ${look.name}. Do not hand-edit copy. -->
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}">
      <div id="ground" class="clip" data-start="0" data-duration="${total}" data-track-index="0"></div>
      ${carrierHtml}
${hosts.join("\n")}
      ${audioHtml}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      ${carrierTweens}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
writeFileSync(join(OUT, "index.html"), index);
writeFileSync(join(OUT, "ledger.json"), JSON.stringify(ledger, null, 2) + "\n");
writeFileSync(join(OUT, "cues.json"), JSON.stringify(cues.sort((a, b) => a.t - b.t), null, 2) + "\n");
writeFileSync(
  join(OUT, "hyperframes.json"),
  JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2) + "\n"
);
writeFileSync(
  join(OUT, "package.json"),
  JSON.stringify(
    {
      name: `${story.source?.title ? String(story.source.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") : "motion-story"}-${look.id}`,
      private: true,
      type: "module",
      scripts: {
        dev: "HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.8.223 preview",
        check: "HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.8.223 check",
        render: "HYPERFRAMES_NO_TELEMETRY=1 npx --yes hyperframes@0.8.223 render --quality delivery"
      }
    },
    null,
    2
  ) + "\n"
);
console.log(`${look.name}: ${beats.length} scenes, ${ledger.seams.length} seams, ${total}s${music ? ", with music" : ""} -> ${OUT}`);
