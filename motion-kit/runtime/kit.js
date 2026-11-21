/* motion-kit runtime: small, deterministic helpers shared by every scene.
 * Everything here is a function of timeline time or of a seed. No clocks,
 * no unseeded randomness, no network. Loaded once by video/index.html.
 * Hand-drawn mark paths are adapted from the HyperFrames registry's
 * hw-underline / hw-callout-circle helpers (seeded hash, draw-on by dashoffset). */
(function () {
  var MK = (window.MK = window.MK || {});

  MK.hash = function (n, seed) {
    var x = Math.sin(n * 127.1 + (seed || 1) * 311.7) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;
  };

  /** Largest size (px) at which every line fits maxWidth on one line, using the real font. */
  MK.fit = function (lines, o) {
    var size = o.max;
    var fit = window.__hyperframes && window.__hyperframes.fitTextFontSize;
    var canvas = document.createElement("canvas").getContext("2d");
    for (var i = 0; i < lines.length; i++) {
      var s = o.max;
      if (fit) {
        s = fit(lines[i], { fontFamily: '"' + o.family + '"', fontWeight: o.weight, maxWidth: o.maxWidth, baseFontSize: o.max, minFontSize: o.min, step: 2 }).fontSize;
      } else {
        while (s > o.min) {
          canvas.font = o.weight + " " + s + 'px "' + o.family + '"';
          if (canvas.measureText(lines[i]).width <= o.maxWidth) break;
          s -= 2;
        }
      }
      size = Math.min(size, s);
    }
    return size;
  };

  /** A word's x and width inside its line, from the font itself (works while the
   *  scene is not laid out yet, which is when it is built). trackingEm: CSS letter-spacing in em. */
  MK.wordBox = function (lineWords, index, o) {
    var ctx = document.createElement("canvas").getContext("2d");
    ctx.font = o.weight + " " + o.size + 'px "' + o.family + '"';
    if ("letterSpacing" in ctx) ctx.letterSpacing = (o.trackingEm * o.size).toFixed(2) + "px";
    var before = lineWords.slice(0, index).join(" ");
    var x = index > 0 ? ctx.measureText(before + " ").width : 0;
    return { x: x, w: ctx.measureText(lineWords[index]).width };
  };

  /** Squiggle underline, double-pass strike, in a w x h box. */
  MK.markPath = function (w, h, style, seed) {
    function wob(n, r) {
      return MK.hash(n, seed) * (r === undefined ? 5 : r);
    }
    var mid = h / 2;
    if (style === "strike") {
      return (
        "M " + (2 + wob(1, 3)) + " " + (mid + wob(2)) +
        " L " + (w - 4 + wob(3, 3)) + " " + (mid - 3 + wob(4)) +
        " M " + (w - 10 + wob(5, 4)) + " " + (mid + 7 + wob(6)) +
        " L " + (8 + wob(7, 4)) + " " + (mid + 3 + wob(8))
      );
    }
    var segs = Math.max(4, Math.round(w / 95));
    var d = "M 2 " + (mid + wob(0, 4));
    for (var i = 1; i <= segs; i++) {
      var x = (w / segs) * i;
      d += " Q " + (x - w / segs / 2 + wob(i * 4 + 1, 9)) + " " + (mid + (i % 2 ? -1 : 1) * (9 + wob(i * 4 + 2, 4))) + " " + x.toFixed(1) + " " + (mid + wob(i * 4 + 3, 4));
    }
    return d;
  };

  /** A hand-drawn ellipse that overshoots its start a little, like a pen ring. */
  MK.ellipsePath = function (cx, cy, rx, ry, seed) {
    var N = 14, pts = [];
    for (var i = 0; i <= N + 2; i++) {
      var a = -Math.PI * 0.62 + (i / N) * Math.PI * 2;
      var wr = 1 + MK.hash(i * 13 + 5, seed) * 0.04 + (i > N ? 0.06 : 0);
      pts.push([cx + Math.cos(a) * rx * wr, cy + Math.sin(a) * ry * wr]);
    }
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var j = 1; j < pts.length - 1; j++) {
      var p = pts[j], q = pts[j + 1];
      d += " Q" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " " + ((p[0] + q[0]) / 2).toFixed(1) + " " + ((p[1] + q[1]) / 2).toFixed(1);
    }
    return d;
  };

  /** Draw a path on between `at` and `at + dur`. */
  MK.drawOn = function (tl, path, at, dur) {
    var len = path.getTotalLength() || 1000;
    gsap.set(path, { strokeDasharray: len + " " + (len + 20), strokeDashoffset: len });
    tl.fromTo(path, { strokeDashoffset: len }, { strokeDashoffset: 0, duration: dur, ease: "power2.inOut" }, at);
  };

  /** Per-render callbacks driven by the timeline's own time (seek-safe). */
  MK.onRender = function (tl, fn) {
    if (!tl.__mkRenders) {
      tl.__mkRenders = [];
      tl.eventCallback("onUpdate", function () {
        for (var i = 0; i < tl.__mkRenders.length; i++) tl.__mkRenders[i](tl.time());
      });
    }
    tl.__mkRenders.push(fn);
    fn(0);
  };

  /** Count a figure up to its printed value; the final frame shows the exact text. */
  MK.countUp = function (tl, el, finalText, at, dur) {
    var m = finalText.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/);
    if (!m) return;
    var prefix = m[1], raw = m[2], suffix = m[3];
    var target = parseFloat(raw.replace(/,/g, ""));
    var decimals = (raw.split(".")[1] || "").length;
    var commas = raw.indexOf(",") >= 0;
    var ease = gsap.parseEase("power2.out");
    MK.onRender(tl, function (t) {
      var p = Math.max(0, Math.min(1, (t - at) / dur));
      if (p >= 1) { el.textContent = finalText; return; }
      var v = (target * ease(p)).toFixed(decimals);
      if (commas) v = Number(v).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      el.textContent = prefix + v + suffix;
    });
  };

  /** A three-frame landing shake on a wrapper. */
  MK.shake = function (tl, el, at, px) {
    var f = 1 / 30;
    tl.to(el, { x: px * 0.55, y: -px * 0.3, duration: f, ease: "power2.out" }, at);
    tl.to(el, { x: -px * 0.38, y: px * 0.2, duration: f, ease: "power2.out" }, at + f);
    tl.to(el, { x: 0, y: 0, duration: f, ease: "power2.out" }, at + 2 * f);
  };

  /** Hand-drawn line boil: re-pose every `drop` frames from the timeline time. */
  MK.boil = function (tl, el, seed, amp) {
    MK.onRender(tl, function (t) {
      var step = Math.floor((t * 30) / 3);
      gsap.set(el, { x: MK.hash(step * 3, seed) * amp, y: MK.hash(step * 3 + 1, seed) * amp, rotation: MK.hash(step * 3 + 2, seed) * 0.4 });
    });
  };
})();
