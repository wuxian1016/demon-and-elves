'use strict';
// Deterministic lifecycle checks: background/foreground continuity, save/load round trip, rotation.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-life-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = {
  canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src');
    Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; }
};
let W = 390, H = 844;
const host = makeHost(root, disk, false, { width: W, height: H, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const logs = []; const oe = console.error;
console.error = (...a) => logs.push('E ' + a.map(x => x?.stack || String(x)).join(' ').slice(0, 1500));
console.warn = (...a) => logs.push('W ' + a.map(x => x?.stack || String(x)).join(' ').slice(0, 600));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tid = 10;
const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
const png = name => { try { fs.writeFileSync(path.join(outDir, name + '.png'), mainCanvas.toBuffer('image/png')); } catch (e) { logs.push('png ' + e.message); } };
async function frames(nf, g, keep) { for (let i = 0; i < nf; i++) { if (keep) keep(); host.advance(1000 / 60); host.frame(); if (i % 30 === 29) await sleep(0); } }
(async () => {
  const R = { checks: [] };
  const check = (name, ok, detail) => { R.checks.push({ name, ok: !!ok, detail }); };
  host.start();
  await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w, runtime } = host.env(); const g = w.game;
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home', 20000);
  tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.advance(16.667); host.frame(); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && g.state === 'prep'; }, 'start', 120000);
  g.finishEndlessOpeningIntroBH();
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  // play ~150s with full frames (update+draw) so it is a real session
  await frames(150 * 60, g, keep);
  check('reached hunt', g.state === 'hunt', { state: g.state, wave: g.waveNumber });
  png('L1-before-hide');
  // ---- background / foreground continuity ----
  const snap = () => ({ hunt: +g.huntElapsed.toFixed(3), wave: g.waveNumber, gold: g.player.gold, wood: g.player.wood, px: Math.round(g.player.x), py: Math.round(g.player.y), hounds: g.hounds.filter(h => !h.dead).length, bld: g.buildings.filter(b => !b.dead).length, demonHp: Math.round(g.troll.hp) });
  const before = snap();
  host.emit('Hide', {}); host.advance(20000); for (let i = 0; i < 30; i++) { host.advance(16.667); host.frame(); } await sleep(5);
  host.emit('Show', {}); await frames(30, g, keep);
  const afterShow = snap();
  check('pause menu after returning from background', g.sessionMenuOpen === true, { menu: g.sessionMenuOpen });
  check('world unchanged while backgrounded', JSON.stringify(before) === JSON.stringify(afterShow), { before, afterShow });
  png('L2-after-show');
  const resume = g.sessionMenuButtons().find(b => b.id === 'resume'); if (resume) tapRect(resume);
  await frames(120, g, keep);
  const afterResume = snap();
  check('time advances after resume', afterResume.hunt > afterShow.hunt + 1.5, { afterShow: afterShow.hunt, afterResume: afterResume.hunt });
  // ---- save / load round trip ----
  const s0 = snap();
  let text = null, err = null;
  try { text = g.serializeProgress(); } catch (e) { err = e; }
  check('serializeProgress works', !!text && !err, { bytes: text?.length, err: String(err?.stack || err || '').slice(0, 400) });
  await frames(300, g, keep);
  let loaded = null; err = null;
  try { loaded = g.loadProgressAsync ? await g.loadProgressAsync(text) : g.loadProgress(text); } catch (e) { err = e; }
  await frames(5, g, keep);
  const s1 = snap();
  const diff = Object.fromEntries(Object.keys(s0).filter(k => s0[k] !== s1[k]).map(k => [k, [s0[k], s1[k]]]));
  check('loadProgress restores saved state', !err && Object.keys(diff).every(k => k === 'hunt' ? Math.abs(s0.hunt - s1.hunt) < 0.2 : false), { err: String(err?.stack || err || '').slice(0, 400), diff, loaded: typeof loaded });
  if (g.sessionMenuOpen) { const r2 = g.sessionMenuButtons().find(b => b.id === 'resume'); if (r2) tapRect(r2); }
  await frames(60, g, keep);
  png('L3-after-load');
  // ---- rotation during battle ----
  const rot = async (w2, h2, tag) => { W = w2; H = h2; host.setSize(W, H); host.emit('WindowResize', { size: { windowWidth: W, windowHeight: H } }); await frames(200, g, keep); png('L4-' + tag); return { canvas: [mainCanvas.width, mainCanvas.height], view: runtime.viewport() }; };
  const land = await rot(844, 390, 'landscape');
  check('landscape resize applies', land.canvas[0] > land.canvas[1], land);
  const port = await rot(390, 844, 'portrait');
  check('portrait resize applies', port.canvas[0] < port.canvas[1], port);
  // ---- long background (>10s) during battle, memory warning while hidden ----
  host.emit('Hide', {}); host.emit('MemoryWarning', { level: 15 }); host.advance(60000); await sleep(5);
  host.emit('Show', {}); await frames(60, g, keep);
  const r3 = g.sessionMenuButtons().find(b => b.id === 'resume'); if (r3) tapRect(r3);
  await frames(240, g, keep);
  png('L5-after-long-bg');
  check('game still running after long background + memory warning', g.state === 'hunt' && !runtime.frameFaultPausedBN, { state: g.state, paused: runtime.frameFaultPausedBN });
  const d = runtime.diagnosticReport();
  R.runtimeErrors = (d.current?.errors || []).map(e => e.kind + ': ' + e.detail.slice(0, 500));
  R.logs = logs;
  fs.writeFileSync(path.join(outDir, 'lifecycle.json'), JSON.stringify(R, null, 1));
  oe(JSON.stringify(R, null, 1).slice(0, 6000));
})().catch(e => { oe('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
