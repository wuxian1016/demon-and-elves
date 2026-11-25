'use strict';
// fillRect(tint) vs drawImage(tint tile): pixel identity + cost, on a deterministic opaque/alpha background
function tintBench(make, opts = {}) {
  const W = 780, H = 1688, out = {};
  let seed = 12345; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const bg = make(W, H), b = bg.getContext('2d');
  for (let i = 0; i < 4000; i++) { b.fillStyle = `rgba(${(rnd() * 256) | 0},${(rnd() * 256) | 0},${(rnd() * 256) | 0},${opts.alphaBg ? (0.2 + rnd() * 0.8).toFixed(2) : 1})`; b.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 4 + ((rnd() * 60) | 0), 4 + ((rnd() * 60) | 0)); }
  const colors = opts.colors || ['rgba(129, 212, 250, 0.15)', 'rgba(0,0,0,.38)', 'rgba(0,0,0,0.55)', 'rgba(17,39,31,.90)', 'rgba(255,255,255,0.08)', 'rgba(28,52,36,0.72)', 'rgba(200,30,30,0.33)'];
  const read = (c) => c.getContext('2d').getImageData(0, 0, W, H).data;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  for (const col of colors) {
    const A = make(W, H), B = make(W, H), C = make(W, H);
    for (const X of [A, B, C]) { const x = X.getContext('2d'); x.drawImage(bg, 0, 0); }
    const tile1 = make(1, 1); { const t = tile1.getContext('2d'); t.fillStyle = col; t.fillRect(0, 0, 1, 1); }
    const tileF = make(W, H); { const t = tileF.getContext('2d'); t.fillStyle = col; t.fillRect(0, 0, W, H); }
    const a = A.getContext('2d'), bb = B.getContext('2d'), c = C.getContext('2d');
    a.setTransform(2, 0, 0, 2, 0, 0); a.fillStyle = col; a.fillRect(0, 0, 390, 844);
    bb.imageSmoothingEnabled = false; bb.drawImage(tile1, 0, 0, W, H);
    c.drawImage(tileF, 0, 0);
    const da = read(A), db = read(B), dc = read(C);
    let nb = 0, mb = 0, nc = 0, mc = 0;
    for (let i = 0; i < da.length; i++) { const x = Math.abs(da[i] - db[i]), y = Math.abs(da[i] - dc[i]); if (x) { nb++; if (x > mb) mb = x; } if (y) { nc++; if (y > mc) mc = y; } }
    // timing (flush by reading 1 px)
    const T = (fn) => { a.getImageData(0, 0, 1, 1); const t0 = now(); for (let k = 0; k < 20; k++) fn(); a.getImageData(0, 0, 1, 1); return +((now() - t0) / 20).toFixed(3); };
    const fillMs = T(() => { a.fillRect(0, 0, 390, 844); });
    a.setTransform(1, 0, 0, 1, 0, 0); a.imageSmoothingEnabled = false;
    const img1Ms = T(() => a.drawImage(tile1, 0, 0, W, H)), imgFMs = T(() => a.drawImage(tileF, 0, 0));
    out[col] = { diff1x1: [nb, mb], diffFull: [nc, mc], fillMs, img1x1Ms: img1Ms, imgFullMs: imgFMs };
  }
  return out;
}
if (typeof module !== 'undefined') module.exports = tintBench;
