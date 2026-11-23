'use strict';
// Baseline spike/memory scenarios: camera jump, memory warning in battle, repeated rounds.
// usage: node --expose-gc spikes.cjs <client> <out.json>
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outFile] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-spk-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null; const liveC = [], liveI = [];
const graphics = {
  canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; liveC.push(new WeakRef(c)); return c; },
  image(locate) { const i = new n.Image(); liveI.push(new WeakRef(i)); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src');
    Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; }
};
function mem() { if (global.gc) { global.gc(); global.gc(); } let cb = 0, cn = 0, ib = 0, inn = 0; for (const r of liveC) { const c = r.deref(); if (!c || c === mainCanvas) continue; cn++; cb += c.width * c.height * 4; } for (const r of liveI) { const i = r.deref(); if (!i || !i.width || !i.src) continue; inn++; ib += i.width * i.height * 4; } return { canvases: cn, canvasMB: +(cb / 1048576).toFixed(1), images: inn, imageMB: +(ib / 1048576).toFixed(1), heapMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1) }; }
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const hr = () => Number(process.hrtime.bigint()) / 1e6; const sleep = ms => new Promise(r => setTimeout(r, ms));
let tid = 10; const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
async function frames(nf, keep, out) { for (let i = 0; i < nf; i++) { keep?.(); host.advance(1000 / 60); const t = hr(); host.frame(); out?.push(+(hr() - t).toFixed(1)); if (i % 30 === 29) await sleep(0); } }
(async () => {
  const R = {};
  host.start(); await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w, runtime } = host.env(); const g = w.game;
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home', 20000);
  R.home0 = mem();
  const startRound = async () => {
    tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
    for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.advance(16.667); host.frame(); }
    tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
    await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && g.state === 'prep'; }, 'start', 120000);
    g.finishEndlessOpeningIntroBH();
  };
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  await startRound();
  await frames(150 * 60, keep);
  R.round1 = mem();
  // (a) camera jumps: return-to-base button and a far jump (minimap-style)
  const jumps = [];
  for (let k = 0; k < 4; k++) {
    const far = k % 2 === 0 ? { x: g.trollBase.x, y: g.trollBase.y } : { x: g.player.x, y: g.player.y };
    g.manualCamera394 = true; g.camera.x = g.cameraFollow.x = far.x - 195 / g.zoom(); g.camera.y = g.cameraFollow.y = far.y - 422 / g.zoom();
    const ft = []; await frames(20, keep, ft); jumps.push(ft.slice(0, 8));
    g.manualCamera394 = false; await frames(60, keep);
  }
  R.cameraJumpFirstFrames = jumps;
  // (b) memory warning mid-battle
  const before = []; await frames(60, keep, before);
  host.emit('MemoryWarning', { level: 15 });
  const after = []; await frames(120, keep, after);
  R.memoryWarning = { beforeMax: Math.max(...before), afterFirst10: after.slice(0, 10), afterMax: Math.max(...after), over16: after.filter(x => x > 16.7).length, memAfter: mem() };
  // (c) repeated rounds: exit to home and start again, 3 times
  R.rounds = [];
  for (let k = 0; k < 3; k++) {
    if (typeof g.returnToStartAfterFrameFaultBN === 'function') { try { g.returnToStartAfterFrameFaultBN(); } catch (e) { R.exitErr = String(e); } }
    await until(() => { host.advance(16.667); host.frame(); return g.state === 'start' && g.homeOptionsReadyBN; }, 'home again', 30000).catch(e => { R.exitWait = String(e); });
    const homeMem = mem();
    await startRound(); await frames(90 * 60, keep);
    R.rounds.push({ home: homeMem, inRound: mem(), state: g.state });
  }
  fs.writeFileSync(outFile, JSON.stringify(R, null, 1));
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
