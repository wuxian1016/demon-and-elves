'use strict';
// Full-match timeline: every frame goes through the real loop (update + draw).
// usage: [ALLIES=8] [DIFF=crazy] [IMMORTAL=1] node --expose-gc longrun.cjs <client> <out.json> <gameSeconds>
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), inspector = require('node:inspector');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outFile, secsArg = '600'] = process.argv.slice(2);
const SECS = +secsArg, W = +(process.env.W || 390), H = +(process.env.H || 844), PR = +(process.env.PR || 3);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null; const C = { on: false, main: 0, off: 0, mainImg: 0, text: 0, path: 0 };
const proto = Object.getPrototypeOf(n.createCanvas(1, 1).getContext('2d'));
for (const m of ['drawImage', 'fillRect', 'fill', 'stroke', 'fillText', 'strokeText', 'clearRect']) {
  const o = proto[m];
  proto[m] = function (...a) { if (C.on) { if (this.canvas === graphics.main) { C.main++; if (m === 'drawImage') C.mainImg++; else if (m === 'fillText' || m === 'strokeText') C.text++; else if (m === 'fill' || m === 'stroke') C.path++; } else C.off++; } return o.apply(this, a); };
}
const graphics = require('./detgfx.cjs')(n, fs);
Object.defineProperty(globalThis, '__gfx', { value: graphics });
const host = makeHost(root, disk, false, { width: W, height: H, seed: +(process.env.SEED || 150), clockStart: 1800000000000, graphics, pixelRatio: PR });
const hr = () => Number(process.hrtime.bigint()) / 1e6;
let tid = 2;
function tap(b) { if (!b) throw Error('no button'); const x = b.x + b.w / 2, y = b.y + b.h / 2, f = { identifier: ++tid, clientX: x, clientY: y, x, y }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); host.emit('TouchEnd', { changedTouches: [f], touches: [] }); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function clearBlockers(g, log) {
  if (g.endlessOpeningIntro) { g.finishEndlessOpeningIntroBH(); log.push('intro'); }
  if (g.cardPresentation?.modal?.()) { g.cardPresentation.restore(); log.push('cardModal'); }
  if (g.sessionMenuOpen && (g.state === 'prep' || g.state === 'hunt')) { g.sessionMenuOpen = false; log.push('menu'); }
}

// Presentation-only camera: look at the busiest area like a player dragging the map (manual camera mode).
let camTarget = null;
function busyCam(g, i) {
  const z = g.zoom(), vw = 390 / z, vh = 844 / z;
  if (i % 120 === 0) {
    const pts = [];
    for (const h of g.hounds || []) if (!h.dead) pts.push(h);
    for (const b of g.buildings || []) if (!b.dead) pts.push(b);
    for (const p of g.peasants || []) pts.push(p);
    for (const a of g.allies || []) if (!a.dead) pts.push(a);
    if (g.troll && !g.troll.dead) pts.push(g.troll);
    let best = null, bestN = -1;
    for (let k = 0; k < pts.length; k += Math.max(1, Math.floor(pts.length / 80))) {
      const c = pts[k]; let n = 0;
      for (const p of pts) if (Math.abs(p.x - c.x) < vw / 2 && Math.abs(p.y - c.y) < vh / 2) n++;
      if (n > bestN) { bestN = n; best = c; }
    }
    if (best) camTarget = { x: best.x - vw / 2, y: best.y - vh * 0.5, n: bestN };
  }
  if (!camTarget) return;
  g.manualCamera394 = true;
  const f = g.cameraFollow, dx = camTarget.x - f.x, dy = camTarget.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, Math.max(4, d * 0.08), 25);
  if (d > 0.5) { f.x += dx / d * step; f.y += dy / d * step; }
}
(async () => {
  const ALLIES = +(process.env.ALLIES ?? 8);
  host.start();
  const waitFor = async (cond, label, frame = false) => { for (let k = 0; k < 200000; k++) { host.advance(frame ? 16.667 : 4); if (frame) host.frame(); await graphics.flush(); if (cond()) return; } throw Error('timeout ' + label); };
  await waitFor(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'Home ready');
  const g = host.env().window.game;
  const T = { u: 0, d: 0 }; { const u = g.update, d = g.draw; g.update = function (...a) { const t = hr(); try { return u.apply(this, a); } finally { T.u += hr() - t; } }; g.draw = function (...a) { const t = hr(); try { return d.apply(this, a); } finally { T.d += hr() - t; } }; }
  await waitFor(() => g.homeOptionsReadyBN, 'home options', true);
  if (process.env.DIFF) g.selectDifficulty(process.env.DIFF);
  for (let i = 0; i < ALLIES; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tap(b); host.advance(16.667); host.frame(); }
  tap(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await waitFor(() => !g.roundStarting && !g.roundLoading591 && (g.state === 'prep' || g.state === 'hunt'), 'solo start', true);
  const log = []; clearBlockers(g, log);
  let paints = 0; const tt = g.terrainTiles200; if (tt) { const p = tt.paint; tt.paint = function (...a) { paints++; return p.apply(this, a); }; }
  const arrays = Object.keys(g).filter(k => Array.isArray(g[k]) && g[k].length && typeof g[k][0] === 'object').slice(0, 60);
  const rows = []; const all = [];
  let sec = null; const newSec = () => ({ f: 0, sum: 0, max: 0, o12: 0, o16: 0, o33: 0, u: 0, d: 0, cam: 0, paints: 0, main: 0, img: 0, text: 0, path: 0, off: 0 });
  sec = newSec(); let last = { x: g.camera.x, y: g.camera.y };
  C.on = true;
  let session = null; const PROF_AT = +(process.env.PROF_AT || -1), PROF_LEN = +(process.env.PROF_LEN || 20);
  for (let i = 0; i < SECS * 60; i++) {
    if (i === PROF_AT * 60) { session = new inspector.Session(); session.connect(); await new Promise(r => session.post('Profiler.enable', r)); await new Promise(r => session.post('Profiler.setSamplingInterval', { interval: 250 }, r)); await new Promise(r => session.post('Profiler.start', r)); console.error('profiling from', PROF_AT); }
    if (session && i === (PROF_AT + PROF_LEN) * 60) { const prof = await new Promise(r => session.post('Profiler.stop', (e, res) => r(res.profile))); session.disconnect(); session = null; fs.writeFileSync(outFile.replace(/\.json$/, '') + '.cpuprofile', JSON.stringify(prof)); console.error('profile written'); }
    if (process.env.IMMORTAL && g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
    if (i % 60 === 29) await graphics.flush();
    if (process.env.CAM === 'busy') busyCam(g, i);
    host.advance(1000 / 60);
    const u0 = T.u, d0 = T.d, p0 = paints, m0 = C.main, i0 = C.mainImg, x0 = C.text, q0 = C.path, f0 = C.off;
    const t = hr(); host.frame(); const ms = hr() - t; all.push(ms);
    sec.f++; sec.sum += ms; sec.max = Math.max(sec.max, ms); if (ms > 12) sec.o12++; if (ms > 16.7) sec.o16++; if (ms > 33.3) sec.o33++;
    sec.u += T.u - u0; sec.d += T.d - d0; sec.paints += paints - p0; sec.main += C.main - m0; sec.img += C.mainImg - i0; sec.text += C.text - x0; sec.path += C.path - q0; sec.off += C.off - f0;
    sec.cam += Math.hypot(g.camera.x - last.x, g.camera.y - last.y); last = { x: g.camera.x, y: g.camera.y };
    if (i % 60 === 59) {
      const ent = {}; for (const k of arrays) { const a = g[k]; if (Array.isArray(a)) ent[k] = a.filter(e => e && !e.dead).length; }
      const pst = g.terrainTiles200?.prefStatsBN || {}; rows.push({ s: (i + 1) / 60, look: pst.lookCommits || 0, ringCommits: pst.commits || 0, wave: g.waveNumber, state: g.state, mean: +(sec.sum / sec.f).toFixed(2), max: +sec.max.toFixed(1), o12: sec.o12, o16: sec.o16, o33: sec.o33, upd: +(sec.u / sec.f).toFixed(2), draw: +(sec.d / sec.f).toFixed(2), cam: Math.round(sec.cam), paints: sec.paints, mainCalls: Math.round(sec.main / sec.f), mainImg: Math.round(sec.img / sec.f), text: Math.round(sec.text / sec.f), path: Math.round(sec.path / sec.f), offCalls: Math.round(sec.off / sec.f), ent });
      if (rows.length % 30 === 0) { const r = rows.at(-1); console.error(`[${r.s}s] wave=${r.wave} mean=${r.mean} max=${r.max} o16=${r.o16} upd=${r.upd} draw=${r.draw} img=${r.mainImg} cam=${r.cam} ent=${JSON.stringify(r.ent)}`); }
      sec = newSec(); clearBlockers(g, log); await graphics.flush();
      if (g.state !== 'prep' && g.state !== 'hunt') { log.push('ended:' + g.state + '@' + (i + 1) / 60); break; }
    }
  }
  C.on = false;
  const s = all.slice().sort((a, b) => a - b), q = p => +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2);
  const summary = { frames: s.length, mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2), p50: q(.5), p95: q(.95), p99: q(.99), max: q(1), o12: s.filter(x => x > 12).length, o16: s.filter(x => x > 16.7).length, o33: s.filter(x => x > 33.3).length };
  fs.writeFileSync(outFile, JSON.stringify({ allies: ALLIES, difficulty: g.trollDifficulty, summary, log, rows }, null, 0));
  console.log('DONE', JSON.stringify(summary));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
