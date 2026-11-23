'use strict';
// Walk the elf continuously and record per-frame time + how many terrain tiles were painted that frame.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
const [root, label] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-wl-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = { canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src'); Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; } };
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const sleep = ms => new Promise(r => setTimeout(r, ms)); const hr = () => Number(process.hrtime.bigint()) / 1e6;
let tid = 10; const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
(async () => {
  host.start(); await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w } = host.env(); const g = w.game;
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home', 20000);
  tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.frame(); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  for (let i = 0; i < 30000 && !(!g.roundStarting && !g.roundLoading591 && g.state === 'prep'); i++) { host.frame(); await sleep(2); }
  g.finishEndlessOpeningIntroBH();
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  for (let i = 0; i < 60 * 70; i++) { keep(); host.advance(16.667); host.frame(); if (i % 30 === 29) await sleep(0); }
  // hook tile painting
  let painted = 0; const proto = Object.getPrototypeOf(g.terrainTiles200 || {}); const p0 = proto.paintTileSurface200;
  let bands = 0; const b0 = proto.beginTileSurface200; let inBand = false; const pf = w.terrainEdgePrefetchBN; if (pf) w.terrainEdgePrefetchBN = function (...a) { const t = hr(); try { return pf.apply(this, a); } finally { prefMs += hr() - t; } }; let prefMs = 0;
  if (p0) proto.paintTileSurface200 = function (...a) { painted++; return p0.apply(this, a); };
  const j = g.getJoystickRect(); const SID = 4242; touch('TouchStart', j.x, j.y, SID);
  const rows = [];
  for (let i = 0; i < 1800; i++) {
    keep(); const a = Math.floor(i / 300) * 2.1; touch('TouchMove', j.x + Math.cos(a) * j.r, j.y + Math.sin(a) * j.r, SID);
    host.advance(16.667); painted = 0; prefMs = 0; const t = hr(); host.frame(); rows.push([+(hr() - t).toFixed(1), painted, +prefMs.toFixed(2)]);
    if (i % 30 === 29) await sleep(0);
  }
  touch('TouchEnd', 0, 0, SID);
  const withPaint = rows.filter(r => r[1] > 0), without = rows.filter(r => r[1] === 0);
  const avg = a => +(a.reduce((s, r) => s + r[0], 0) / Math.max(1, a.length)).toFixed(2);
  const ms = rows.map(r => r[0]).sort((x, y) => x - y);
  console.log("PREF", JSON.stringify(g.terrainTiles200?.prefStatsBN), "budgetMB", g.terrainTiles200?.budget/1048576, "tiles", g.terrainTiles200?.tiles.size, "zoom", g.zoom());
  console.log(JSON.stringify({ label, frames: rows.length, framesPaintingTiles: withPaint.length, tilesPainted: withPaint.reduce((s, r) => s + r[1], 0), avgMsWithPaint: avg(withPaint), avgMsWithout: avg(without), p95: ms[Math.floor(ms.length * .95)], p99: ms[Math.floor(ms.length * .99)], max: ms[ms.length - 1], over12: ms.filter(x => x > 12).length, worst: withPaint.sort((a, b) => b[0] - a[0]).slice(0, 8), prefetchMsTotal: +rows.reduce((s, r) => s + r[2], 0).toFixed(1), prefetchMaxMs: Math.max(...rows.map(r => r[2])) }));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
