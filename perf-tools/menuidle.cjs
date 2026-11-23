'use strict';
// Count frame callbacks per second while the in-game pause menu sits idle, and check a tap still responds.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
const [root, label] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-mi-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = { canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src'); Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; } };
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: null, graphics, pixelRatio: 3 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tid = 10; const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
const tapRect = b => { const id = ++tid, x = b.x + b.w / 2, y = b.y + b.h / 2; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); };
(async () => {
  host.start(); await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready', 60000);
  const { window: w } = host.env(); const g = w.game;
  for (let i = 0; i < 3000 && !g.homeOptionsReadyBN; i++) { host.frame(); await sleep(2); }
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  for (let i = 0; i < 30000 && !(!g.roundStarting && !g.roundLoading591 && g.state === 'prep'); i++) { host.frame(); await sleep(2); }
  g.finishEndlessOpeningIntroBH();
  for (let i = 0; i < 120; i++) { host.frame(); await sleep(16); }
  host.emit('Hide', {}); await sleep(50); host.emit('Show', {});
  for (let i = 0; i < 30; i++) { host.frame(); await sleep(16); }
  // idle in the pause menu for 3 s of real time, servicing RAF like a 60 Hz display would
  let callbacks = 0; const t0 = Date.now();
  while (Date.now() - t0 < 3000) { if (host.pendingFrames()) { host.frame(); callbacks++; } await sleep(16); }
  // a tap on "resume" must still take effect promptly
  const b = g.sessionMenuButtons().find(x => x.id === 'resume'); tapRect(b);
  let resumedAfter = -1; for (let i = 0; i < 30; i++) { if (host.pendingFrames()) host.frame(); if (!g.sessionMenuOpen) { resumedAfter = i; break; } await sleep(16); }
  console.log(JSON.stringify({ label, menuOpenDuringIdle: true, frameCallbacksPerSecond: +(callbacks / 3).toFixed(1), resumeTookFrames: resumedAfter, stateAfter: g.state }));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
