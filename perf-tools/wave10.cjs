'use strict';
// Per-frame timeline across the wave-10 stone golem arrival: frame time, images decoded, canvases made, memory.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outFile] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-w10-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null; const ev = []; let frameNo = -1; const liveC = [], liveI = [];
const graphics = {
  canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; liveC.push(new WeakRef(c)); if (frameNo >= 0) ev.push({ f: frameNo, kind: 'canvas' }); return c; },
  image(locate) { const i = new n.Image(); liveI.push(new WeakRef(i)); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src');
    Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; const t = process.hrtime.bigint(); try { orig.set.call(i, fs.readFileSync(locate(s))); if (frameNo >= 0) ev.push({ f: frameNo, kind: 'image', name: String(s).replace(/^.*client\//, ''), w: i.width, h: i.height, decodeMs: Number(process.hrtime.bigint() - t) / 1e6 }); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; }
};
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const pkgs = []; const ls = host.wx.loadSubpackage; host.wx.loadSubpackage = o => { pkgs.push({ f: frameNo, name: o.name }); return ls(o); };
const hr = () => Number(process.hrtime.bigint()) / 1e6; const sleep = ms => new Promise(r => setTimeout(r, ms));
let tid = 10; const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
function liveMB() { let cb = 0, ib = 0; for (const r of liveC) { const c = r.deref(); if (c && c !== mainCanvas) cb += c.width * c.height * 4; } for (const r of liveI) { const i = r.deref(); if (i && i.width && i.src) ib += i.width * i.height * 4; } return { canvasMB: +(cb / 1048576).toFixed(1), imageMB: +(ib / 1048576).toFixed(1) }; }
(async () => {
  host.start(); await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w, runtime } = host.env(); const g = w.game;
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home', 20000);
  tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.advance(16.667); host.frame(); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && g.state === 'prep'; }, 'start', 120000);
  g.finishEndlessOpeningIntroBH();
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  while (g.waveNumber < 9 || (g.waveNumber === 9 && false)) { keep(); host.advance(16.667); host.frame(); if (++frameNo % 30 === 0) await sleep(0); }
  frameNo = 0; const rows = []; const rss0 = process.memoryUsage().rss;
  let stoneSeenAt = -1;
  for (let i = 0; i < 60 * 75; i++) {
    keep(); host.advance(16.667); const t = hr(); host.frame(); const ms = hr() - t;
    const alive = g.hounds.filter(h => h.waveStone && !h.dead).length; if (alive && stoneSeenAt < 0) stoneSeenAt = i;
    if (i % 10 === 0 || ms > 12) { const m = process.memoryUsage(); rows.push({ f: i, wave: g.waveNumber, ms: +ms.toFixed(1), stones: alive, rssMB: +((m.rss - rss0) / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1) }); }
    frameNo = i + 1; if (i % 30 === 29) await sleep(0);
  }
  const R = { stoneSeenAtFrame: stoneSeenAt, pkgs, live: liveMB(), stoneReport: g.stoneBossCandidate?.bankReport?.(), longFrames: rows.filter(r => r.ms > 12), imagesDecoded: ev.filter(e => e.kind === 'image'), canvasesMade: ev.filter(e => e.kind === 'canvas').length,
    rssPeakDeltaMB: Math.max(...rows.map(r => r.rssMB)), heapPeakMB: Math.max(...rows.map(r => r.heapMB)) };
  fs.writeFileSync(outFile, JSON.stringify({ R, rows }, null, 1));
  console.log(JSON.stringify(R, null, 1));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
