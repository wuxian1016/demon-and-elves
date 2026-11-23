'use strict';
// Deterministic regression trace: same seed + same inputs -> per-second state digest and per-2s frame pixel digest.
// usage: node compare.cjs <client> <out.json> [frames=7200]
// Compare two traces with: node compare.cjs --diff a.json b.json
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
if (process.argv[2] === '--diff') {
  const [a, b] = [process.argv[3], process.argv[4]].map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  let stateDiff = null, pixelDiff = [], firstPixel = null;
  for (let i = 0; i < Math.min(a.states.length, b.states.length); i++) if (a.states[i].d !== b.states[i].d) { stateDiff = { at: a.states[i].f, a: a.states[i].s, b: b.states[i].s }; break; }
  const bp = new Map(b.pixels.map(p => [p.f, p.h]));
  for (const p of a.pixels) if (bp.has(p.f) && bp.get(p.f) !== p.h) { pixelDiff.push(p.f); if (!firstPixel) firstPixel = p.f; }
  console.log(JSON.stringify({ statesCompared: Math.min(a.states.length, b.states.length), firstStateDiff: stateDiff, pixelFramesCompared: a.pixels.length, pixelDiffFrames: pixelDiff.slice(0, 20), pixelDiffCount: pixelDiff.length, timing: { a: a.timing, b: b.timing } }, null, 1));
  process.exit(0);
}
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outFile, framesArg = '7200'] = process.argv.slice(2);
const FR = +framesArg;
const SAVE = new Set((process.env.SAVE_FRAMES || '').split(',').filter(Boolean).map(Number));
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-cmp-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = { canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src'); Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; } };
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const sleep = ms => new Promise(r => setTimeout(r, ms)); const hr = () => Number(process.hrtime.bigint()) / 1e6;
let tid = 10; const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
const r6 = v => Math.round(v * 1e6) / 1e6;
function digest(g) {
  const sum = (arr, f) => { let s = 0; for (const e of arr || []) if (!e.dead) s += f(e); return r6(s); };
  const s = [g.state, g.waveNumber, r6(g.huntElapsed || 0), Math.round(g.player.x * 1e4), Math.round(g.player.y * 1e4), r6(g.player.hp), g.player.gold, g.player.wood, g.player.dead,
    g.hounds.filter(h => !h.dead).length, sum(g.hounds, h => h.x + h.y * 3), sum(g.hounds, h => h.hp), g.buildings.filter(b => !b.dead).length, sum(g.buildings, b => b.hp), g.peasants.length, sum(g.peasants, p => p.x + p.y),
    g.projectiles.length, g.particles.length, r6(g.troll.x), r6(g.troll.y), r6(g.troll.hp), g.troll.level, (g.allies || []).map(a => [a.gold, a.wood, a.dead]).join('|'), Math.round(g.camera.x * 100), Math.round(g.camera.y * 100)];
  return s;
}
(async () => {
  const states = [], pixels = []; let drawMs = 0, totalMs = 0;
  host.start(); await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w } = host.env(); const g = w.game;
  const d0 = g.draw; g.draw = function (...a) { const t = hr(); try { return d0.apply(this, a); } finally { drawMs += hr() - t; } };
  // loading phases: run frames without advancing game time so the start state does not depend on real loading speed
  for (let i = 0; i < 4000 && !g.homeOptionsReadyBN; i++) { host.frame(); await sleep(2); }
  const homePix = crypto.createHash('sha1').update(mainCanvas.data()).digest('hex').slice(0, 16);
  tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.frame(); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  for (let i = 0; i < 30000 && !(!g.roundStarting && !g.roundLoading591 && g.state === 'prep'); i++) { host.frame(); await sleep(2); }
  for (let i = 0; i < 50; i++) { host.frame(); await sleep(5); }
  g.finishEndlessOpeningIntroBH();
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  const j = () => g.getJoystickRect();
  const SID = 7001; let walking = false;
  for (let f = 0; f < FR; f++) {
    keep();
    // scripted inputs: walk segments, camera jumps, pause/resume
    if (f % 900 === 300 && j()) { const r = j(); touch('TouchStart', r.x, r.y, SID); walking = true; }
    if (walking) { const r = j() || { x: 60, y: 700, r: 50 }; const a = Math.floor(f / 120) * 1.3; touch('TouchMove', r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, SID); }
    if (f % 900 === 540 && walking) { touch('TouchEnd', 0, 0, SID); walking = false; }
    if (f % 1200 === 700) { g.manualCamera394 = true; const far = (f / 1200 | 0) % 2 ? g.trollBase : g.player; g.camera.x = g.cameraFollow.x = far.x - 195 / g.zoom(); g.camera.y = g.cameraFollow.y = far.y - 422 / g.zoom(); }
    if (f % 1200 === 760) g.manualCamera394 = false;
    if (f % 2400 === 1500) { host.emit('Hide', {}); host.advance(5000); host.emit('Show', {}); }
    if (f % 2400 === 1530 && g.sessionMenuOpen) { const b = g.sessionMenuButtons().find(x => x.id === 'resume'); if (b) tapRect(b); }
    host.advance(16.667);
    const t = hr(); host.frame(); totalMs += hr() - t;
    if (f % 60 === 0) { const s = digest(g); states.push({ f, d: crypto.createHash('sha1').update(JSON.stringify(s)).digest('hex').slice(0, 16), s }); }
    if (f % 120 === 1 || (f % 1200 >= 700 && f % 1200 < 705)) pixels.push({ f, h: crypto.createHash('sha1').update(mainCanvas.data()).digest('hex').slice(0, 16) });
    if (SAVE.has(f)) fs.writeFileSync(outFile + '.f' + f + '.rgba', mainCanvas.data());
    if (f < 600 || f % 10 === 9) await sleep(0);
  }
  const out = { homePix, states, pixels, timing: { framesMs: +(totalMs / FR).toFixed(2), drawMs: +(drawMs / FR).toFixed(2) }, final: digest(g) };
  fs.writeFileSync(outFile, JSON.stringify(out));
  console.log(JSON.stringify({ homePix, timing: out.timing, final: out.final.slice(0, 12) }));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
