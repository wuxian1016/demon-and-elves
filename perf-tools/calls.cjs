'use strict';
// Count calls/frame and inclusive ms/frame for selected game methods at a late-game checkpoint.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
const [root, secs = '300', namesArg] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-calls-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
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
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.advance(16.667); host.frame(); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && g.state === 'prep'; }, 'start', 120000);
  g.finishEndlessOpeningIntroBH();
  const keep = () => { const p = g.player; if (p && !p.dead) { p.hp = p.maxHp; p.invincibleTime = 1e9; p.noBuildingGraceAbsentAtAZ = 1e12; } };
  for (let i = 0; i < +secs * 60; i++) { keep(); host.advance(16.667); g.update(16.667); g.updateCamera(); if (i % 120 === 0) await sleep(0); }
  const names = (namesArg || 'allyWorkPointSafe,waveLaneOccupancyBN,hostileMinions,hostilesNear200,slimeCentralPoint,findSlimeCentralSpot,placementBlockReason,defenseRecommendationLayout,allyWallProtectsTower,resourceZoneIndexFor401,batLaneActiveBN,ownerWallet,allyBuildings,animatedEntities,minimapStateChanged,drawResourceBodies,drawBuildingStatus,drawHUD,drawMinimap,updateHoundWaves,updateWaveHound').split(',');
  const stats = {}; const P = Object.getPrototypeOf(g);
  for (const nm of names) { const target = typeof g[nm] === 'function' ? g : null; if (!target) { stats[nm] = 'missing'; continue; } const orig = g[nm]; const st = stats[nm] = { calls: 0, ms: 0, depth: 0 }; g[nm] = function (...a) { st.calls++; if (st.depth++) { try { return orig.apply(this, a); } finally { st.depth--; } } const t = hr(); try { return orig.apply(this, a); } finally { st.ms += hr() - t; st.depth--; } }; }
  const F = 600; const t0 = hr();
  for (let i = 0; i < F; i++) { keep(); host.advance(16.667); host.frame(); if (i % 30 === 29) await sleep(0); }
  const total = hr() - t0;
  const out = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, typeof v === 'string' ? v : { callsPerFrame: +(v.calls / F).toFixed(1), msPerFrame: +(v.ms / F).toFixed(3) }]));
  console.log(JSON.stringify({ wave: g.waveNumber, hounds: g.hounds.length, buildings: g.buildings.length, frameMs: +(total / F).toFixed(2), out }, null, 1));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
