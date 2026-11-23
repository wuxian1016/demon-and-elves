'use strict';
// Randomized play test for 恶魔与精灵 (COW8D) on the project's QA wx host. Collects runtime errors.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root, outDir, seedArg = '1', alliesArg = '8', framesArg = '20000'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const SEED = +seedArg, ALLIES = +alliesArg, FRAMES = +framesArg;
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-fuzz-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = {
  canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src');
    Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; }
};
let W = 390, H = 844;
const host = makeHost(root, disk, false, { width: W, height: H, seed: 150 + SEED * 7, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const logs = [];
const oe = console.error, ow = console.warn;
console.error = (...a) => { logs.push({ f: frame, kind: 'console.error', text: a.map(x => x?.stack || String(x)).join(' ').slice(0, 2000) }); };
console.warn = (...a) => { logs.push({ f: frame, kind: 'console.warn', text: a.map(x => x?.stack || String(x)).join(' ').slice(0, 1000) }); };
process.on('unhandledRejection', e => logs.push({ f: frame, kind: 'unhandledRejection', text: String(e?.stack || e).slice(0, 2000) }));
let rs = SEED * 2654435761 >>> 0; const rnd = () => ((rs = (Math.imul(rs, 1103515245) + 12345) >>> 0) / 4294967296);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tid = 100, frame = 0;
const touch = (type, x, y, id) => { const f = { identifier: id, clientX: x, clientY: y, x, y }; host.emit(type, { changedTouches: [f], touches: type === 'TouchEnd' ? [] : [f] }); };
function tapAt(x, y) { const id = ++tid; touch('TouchStart', x, y, id); touch('TouchEnd', x, y, id); }
function tapRect(b) { tapAt(b.x + b.w / 2, b.y + b.h / 2); }
function buttonPool(g) {
  const out = [];
  const add = (arr, src) => { if (Array.isArray(arr)) for (const b of arr) if (b && Number.isFinite(b.x) && Number.isFinite(b.y) && b.w > 0 && b.h > 0 && b.visible !== false) out.push({ ...b, src }); };
  try { add((g.buttons || []).filter(b => !b.scene || b.scene.includes(g.state)), 'hud'); } catch (_) {}
  const rects = (o, src, depth = 0) => { if (!o || typeof o !== 'object' || depth > 3) return; if (Number.isFinite(o.x) && Number.isFinite(o.y) && o.w > 0 && o.h > 0 && o.w < W && o.h < H * 0.6) out.push({ x: o.x, y: o.y, w: o.w, h: o.h, id: o.id || o.page || o.entry?.type || '?', src }); for (const k in o) { const v = o[k]; if (v && typeof v === 'object') rects(v, src, depth + 1); } };
  try { if (g.buildMenu) rects(g.getBuildMenuLayout(), 'buildMenu'); } catch (e) { logs.push({ f: frame, kind: 'pool-error', text: 'buildMenu: ' + String(e.stack || e).slice(0, 600) }); }
  try { if (g.selectedBuilding) rects(g.getUpgradePanelLayout(), 'upgradePanel'); } catch (e) { logs.push({ f: frame, kind: 'pool-error', text: 'upgrade: ' + String(e.stack || e).slice(0, 600) }); }
  for (const m of ['getPlacementButtons', 'sessionMenuButtons', 'getStartActionButtons', 'getDifficultyOptionButtons', 'getAllySlotButtons', 'getTimeOptionButtons', 'getDemonMinimapOptionButtons']) {
    try { if (typeof g[m] === 'function') add(g[m](), m); } catch (e) { logs.push({ f: frame, kind: 'pool-error', text: m + ': ' + (e.stack || e).toString().slice(0, 600) }); }
  }
  return out;
}
(async () => {
  const report = { seed: SEED, allies: ALLIES, frames: FRAMES, events: [], faults: [], stalls: [] };
  host.start();
  await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'Home ready', 60000);
  const { window: w, runtime } = host.env(); const g = w.game;
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home options', 20000);
  tap: {
    tapRect(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
    for (let i = 0; i < ALLIES; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tapRect(b); host.advance(16.667); host.frame(); }
    tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  }
  let hidden = 0, stick = null, drag = null, rotated = 0, noRaf = 0, lastState = null, games = 1;
  for (frame = 0; frame < FRAMES; frame++) {
    const r = rnd();
    // lifecycle
    if (hidden > 0) { hidden--; if (hidden === 0) { host.emit('Show', {}); report.events.push([frame, 'show']); } }
    else if (r < 0.0004) { hidden = rnd() < 0.5 ? 20 + (rnd() * 60 | 0) : 700; host.emit('Hide', {}); report.events.push([frame, 'hide', hidden]); if (hidden >= 700) host.advance(12000); }
    else if (r < 0.0025) { host.emit('MemoryWarning', { level: 10 }); report.events.push([frame, 'memory']); }
    else if (r < 0.0032) { rotated = !rotated; [W, H] = [H, W]; host.setSize(W, H); host.emit('WindowResize', { size: { windowWidth: W, windowHeight: H } }); report.events.push([frame, 'resize', W, H]); }
    if (!hidden) {
      const q = rnd();
      if (stick) { stick.left--; const a = stick.a; touch('TouchMove', stick.j.x + Math.cos(a) * stick.j.r, stick.j.y + Math.sin(a) * stick.j.r, stick.id); if (stick.left <= 0) { touch('TouchEnd', stick.j.x, stick.j.y, stick.id); stick = null; } }
      else if (drag) { drag.left--; drag.x += drag.dx; drag.y += drag.dy; touch('TouchMove', drag.x, drag.y, drag.id); if (drag.left <= 0) { touch('TouchEnd', drag.x, drag.y, drag.id); drag = null; } }
      else if (g.sessionMenuOpen && (g.state === 'prep' || g.state === 'hunt') && !g.saveSlotsPanel && q < 0.08) { let b = null; try { const mb = g.sessionMenuButtons(); b = rnd() < 0.85 ? mb.find(x => x.id === 'resume') : mb[rnd() * mb.length | 0]; } catch (_) {} if (b) { tapRect(b); report.events.push([frame, 'menu', b.id]); } }
      else if (g.saveSlotsPanel && q < 0.05) { tapAt(rnd() * W, rnd() * H); }
      else if (q < 0.025) tapAt(rnd() * W, rnd() * H);
      else if (q < 0.075) { const pool = buttonPool(g); if (pool.length) { const b = pool[rnd() * pool.length | 0]; tapRect(b); if (rnd() < 0.02) report.events.push([frame, 'tap', b.src, b.id]); } }
      else if (q < 0.085 && (g.state === 'prep' || g.state === 'hunt')) { let j = null; try { j = g.getJoystickRect(); } catch (_) {} if (j) { stick = { j, id: ++tid, a: rnd() * Math.PI * 2, left: 60 + (rnd() * 200 | 0) }; touch('TouchStart', j.x, j.y, stick.id); } }
      else if (q < 0.09) { drag = { id: ++tid, x: rnd() * W, y: rnd() * H, dx: (rnd() - .5) * 12, dy: (rnd() - .5) * 12, left: 20 + (rnd() * 60 | 0) }; touch('TouchStart', drag.x, drag.y, drag.id); }
    }
    const loading = g.roundStarting || g.roundLoading591 || runtime.preparing || (g.state === 'start' && !g.homeOptionsReadyBN);
    if (loading) { const t0 = Date.now(); await sleep(2); host.advance(Math.max(1, Date.now() - t0)); } else host.advance(1000 / 60);
    try { host.frame(); } catch (e) { report.faults.push({ f: frame, kind: 'host-frame-throw', text: String(e.stack || e).slice(0, 2000) }); }
    if (!hidden) { if (host.pendingFrames() === 0) noRaf++; else { if (noRaf > 90) report.stalls.push({ f: frame, frames: noRaf, state: g.state }); noRaf = 0; } }
    if (runtime.frameFaultPausedBN) { const d = runtime.diagnosticReport(); report.faults.push({ f: frame, kind: 'frame-fault-pause', state: g.state, errors: d.current?.errors?.slice(-3) }); break; }
    if (g.state !== lastState) { report.events.push([frame, 'state', g.state, Math.round(g.huntElapsed || 0)]); lastState = g.state; }
    if ((g.state === 'win' || g.state === 'lose') && rnd() < 0.01) { const b = (g.buttons || []).find(b => b.id === 'restart'); if (b) { tapRect(b); games++; } }
    if (frame % 30 === 29) await sleep(0);
  }
  if (noRaf > 90) report.stalls.push({ f: frame, frames: noRaf, state: g.state, open: true });
  const d = runtime.diagnosticReport();
  report.final = { state: g.state, wave: g.waveNumber, hunt: Math.round(g.huntElapsed || 0), games, menu: g.sessionMenuOpen, paused: runtime.frameFaultPausedBN, hiddenAtEnd: hidden > 0 };
  report.runtimeErrors = d.current?.errors || [];
  report.runtimeEvents = (d.current?.events || []).map(e => e.kind + ':' + String(e.detail).slice(0, 160));
  report.notices = host.notices.map(nn => ({ title: nn.title, content: String(nn.content || '').slice(0, 300) }));
  report.logs = logs;
  try { fs.writeFileSync(path.join(outDir, 'last.png'), mainCanvas.toBuffer('image/png')); } catch (_) {}
  fs.writeFileSync(path.join(outDir, `fuzz-${SEED}-${ALLIES}.json`), JSON.stringify(report, null, 1));
  oe(`seed=${SEED} allies=${ALLIES} final=${JSON.stringify(report.final)} faults=${report.faults.length} stalls=${report.stalls.length} rtErrors=${report.runtimeErrors.length} logs=${logs.length} notices=${report.notices.length}`);
})().catch(e => { oe('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
