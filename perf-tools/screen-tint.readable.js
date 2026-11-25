'use strict';
// PERF-T1 (2026-11-25): full-screen translucent overlays (prep tint, rescue dim, menu/panel backdrops).
// On a CPU-rasterized canvas (CoreGraphics) a full-screen translucent fillRect costs ~5x a blit of a
// same-size canvas pre-filled with that colour. The blit is used only when an on-device probe, one step
// per loading/home frame, finds BOTH:
//   1. fills clearly slower than blits (the CPU-raster signature; a GPU canvas shows ~equal times), and
//   2. blit == fill pixel for pixel, for every overlay colour below, over every channel value 0-255
//      (on a GPU canvas the two differ by 1-4 levels, so this also catches a timing misread).
// Anything else (GPU canvas, a colour not verified here, unusual transform/state, any error) keeps the
// original fillRect. The layer (~5 MB at 780x1688) exists only while an overlay is shown and is dropped
// 3 s after its last use. window.tintBlitModeBN = 'image' | 'fill' forces a mode (tests only).
const COLORS = [
  'rgba(129, 212, 250, 0.15)', // prep period
  'rgba(0,0,0,.38)', // wall destroyed, rescue prompt
  'rgba(4,15,10,.45)', // build menu
  'rgba(0,0,0,0.18)', // upgrade panel
  'rgba(0,0,0,.48)', // relic choice
  'rgba(0,0,0,.55)', // ally data
  'rgba(0,0,0,.5)', // demon panel
  'rgba(4,15,10,.5)', // session menu (pauseOverlayColorBN)
  'rgba(4,15,10,.6)', // save slots
  'rgba(0,0,0,.45)', // ally economy
];
const W = 1024,
  H = 512, // large enough to get the same canvas backing as the screen
  SW = 256,
  SH = 4; // check strip: every channel value 0-255, opaque and translucent rows
module.exports = function (env) {
  let mode = null,
    probe = null,
    layer = null,
    timer = null,
    ok = null,
    probeLog = null;
  const now = () => Date.now();
  function decide(m, why) {
    mode = m;
    probeLog = { why, fill: probe ? probe.fill : null, image: probe ? probe.image : null, colors: ok ? ok.size : 0 };
    probe = null;
    return mode;
  }
  function samePixels(p, color) {
    p.cb.clearRect(0, 0, W, H);
    p.cb.fillStyle = color;
    p.cb.fillRect(0, 0, W, H);
    p.ca.putImageData(p.strip, 0, 0);
    p.ca.fillStyle = color;
    p.ca.fillRect(0, 0, W, H);
    const f = p.ca.getImageData(0, 0, SW, SH).data;
    p.ca.putImageData(p.strip, 0, 0);
    p.ca.drawImage(p.b, 0, 0);
    const g = p.ca.getImageData(0, 0, SW, SH).data;
    for (let i = 0; i < f.length; i++) if (f[i] !== g[i]) return false;
    return true;
  }
  function step() {
    if (mode) return mode;
    const forced = env.window.tintBlitModeBN;
    if (forced === 'image' || forced === 'fill') return decide(forced, 'forced');
    try {
      if (!probe) {
        const a = env.document.createElement('canvas'),
          b = env.document.createElement('canvas');
        a.width = b.width = W;
        a.height = b.height = H;
        const ca = a.getContext('2d'),
          cb = b.getContext('2d');
        ca.imageSmoothingEnabled = false;
        cb.fillStyle = ca.fillStyle = 'rgba(0,0,0,.38)';
        cb.fillRect(0, 0, W, H);
        ca.fillRect(0, 0, W, H);
        ca.drawImage(b, 0, 0);
        ca.getImageData(0, 0, 1, 1);
        const strip = ca.createImageData(SW, SH),
          d = strip.data;
        for (let i = 0; i < SW; i++)
          for (let r = 0; r < SH; r++) {
            const k = (r * SW + i) * 4;
            d[k] = r & 1 ? (i * 73) & 255 : i;
            d[k + 1] = r & 1 ? i : 255 - i;
            d[k + 2] = r & 1 ? 255 - i : (i * 37) & 255;
            d[k + 3] = r < 2 ? 255 : r === 2 ? Math.max(i, 1) : 256 - Math.max(i, 1);
          }
        probe = { b, ca, cb, strip, n: 0, c: 0, fill: [], image: [] };
        return null;
      }
      const p = probe;
      if (p.n < 4) {
        const image = p.n % 2 === 1;
        p.ca.getImageData(0, 0, 1, 1); // wait out drawing queued before this step, so only the probe's own work is timed
        const t0 = now();
        for (let i = 0; i < 6; i++) image ? p.ca.drawImage(p.b, 0, 0) : p.ca.fillRect(0, 0, W, H);
        p.ca.getImageData(0, 0, 1, 1);
        (image ? p.image : p.fill).push(now() - t0);
        if (++p.n < 4) return null;
        const fill = p.fill[0] + p.fill[1],
          blit = p.image[0] + p.image[1];
        if (!(fill >= 4 && fill >= 2 * Math.max(blit, 1))) return decide('fill', 'not-slower');
        ok = new Set();
        return null;
      }
      const color = COLORS[p.c++]; // one colour per frame keeps each step to ~1.5 ms on a CPU canvas
      if (!samePixels(p, color)) {
        ok = null;
        return decide('fill', 'pixels-differ ' + color);
      }
      ok.add(color);
      return p.c < COLORS.length ? null : decide('image', 'cpu');
    } catch (_) {
      ok = null;
      return decide('fill', 'error');
    }
  }
  function release() {
    timer = null;
    if (!layer) return;
    if (now() - layer.used >= 3000) layer = null;
    else timer = setTimeout(release, 3000);
  }
  function tint(ctx, color, w, h) {
    if (mode !== 'image' || (ok && !ok.has(color)) || typeof ctx.getTransform !== 'function') return false;
    const m = ctx.getTransform();
    if (
      m.b ||
      m.c ||
      !(m.a > 0) ||
      !(m.d > 0) ||
      ctx.globalAlpha !== 1 ||
      ctx.globalCompositeOperation !== 'source-over' ||
      ctx.shadowBlur > 0 ||
      ctx.shadowOffsetX ||
      ctx.shadowOffsetY ||
      (ctx.filter && ctx.filter !== 'none')
    )
      return false;
    const x = m.e,
      y = m.f,
      dw = m.a * w,
      dh = m.d * h;
    if (![x, y, dw, dh].every(Number.isInteger) || dw <= 0 || dh <= 0) return false;
    if (!layer || layer.color !== color || layer.w !== dw || layer.h !== dh) {
      const art = (layer && layer.art) || env.document.createElement('canvas');
      art.width = dw;
      art.height = dh;
      const c = art.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, dw, dh);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = color;
      c.fillRect(0, 0, dw, dh);
      layer = { art, color, w: dw, h: dh, used: 0 };
    }
    layer.used = now();
    if (!timer) timer = setTimeout(release, 3000);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(layer.art, x, y);
    ctx.restore();
    return true;
  }
  return { tint, step, mode: () => mode, probeLog: () => probeLog, layerBytes: () => (layer ? layer.w * layer.h * 4 : 0) };
};
