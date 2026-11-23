'use strict';
// Profile camera-jump long frames. usage: node jumpprof.cjs <client>
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), inspector = require('node:inspector');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}
const [root] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-jp-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
let mainCanvas = null;
const graphics = { canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!mainCanvas) mainCanvas = c; return c; },
  image(locate) { const i = new n.Image(); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src'); Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } }); return i; } };
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  for (let i = 0; i < 150 * 60; i++) { keep(); host.advance(16.667); host.frame(); if (i % 30 === 29) await sleep(0); }
  const s = new inspector.Session(); s.connect(); await new Promise(r => s.post('Profiler.enable', r)); await new Promise(r => s.post('Profiler.setSamplingInterval', { interval: 50 }, r)); await new Promise(r => s.post('Profiler.start', r));
  const marks = [];
  for (let k = 0; k < 4; k++) {
    const far = k % 2 === 0 ? { x: g.trollBase.x, y: g.trollBase.y } : { x: g.player.x, y: g.player.y };
    g.manualCamera394 = true; g.camera.x = g.cameraFollow.x = far.x - 195 / g.zoom(); g.camera.y = g.cameraFollow.y = far.y - 422 / g.zoom();
    for (let i = 0; i < 20; i++) { keep(); host.advance(16.667); const t0 = Number(process.hrtime.bigint() / 1000n); host.frame(); const t1 = Number(process.hrtime.bigint() / 1000n); if (i < 3) marks.push({ k, i, ms: (t1 - t0) / 1000, t0, t1 }); }
    g.manualCamera394 = false; for (let i = 0; i < 60; i++) { keep(); host.advance(16.667); host.frame(); }
    await sleep(0);
  }
  const prof = await new Promise(r => s.post('Profiler.stop', (e, res) => r(res.profile)));
  const byId = new Map(prof.nodes.map(nd => [nd.id, nd])); const parent = new Map(); for (const nd of prof.nodes) for (const c of nd.children || []) parent.set(c, nd.id);
  const nm = nd => { const cf = nd.callFrame; return `${cf.functionName || '(anon)'} ${cf.url.replace(/^.*\/client\//, '').replace(/^.*\/harness\//, 'H:')}:${cf.lineNumber + 1}`; };
  let t = prof.startTime; const times = prof.timeDeltas.map(d => (t += d));
  for (const L of marks.filter(m => m.i === 0)) {
    const incl = new Map(), self = new Map(); let nS = 0;
    for (let i = 0; i < prof.samples.length; i++) { if (times[i] < L.t0 || times[i] > L.t1) continue; nS++; let id = prof.samples[i]; const k0 = nm(byId.get(id)); self.set(k0, (self.get(k0) || 0) + 1); const seen = new Set(); while (id != null) { const kk = nm(byId.get(id)); if (/js\/|network\/|art163\//.test(kk) && !seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + 1); } id = parent.get(id); } }
    const top = (m, c) => [...m].sort((a, b) => b[1] - a[1]).slice(0, c).map(([kk, v]) => Math.round(v / nS * 100) + '% ' + kk);
    console.log(`\n== jump ${L.k} frame0 ${L.ms.toFixed(1)}ms samples=${nS}`); console.log(' self:', top(self, 5).join(' | ')); console.log(' incl:\n   ' + top(incl, 22).join('\n   '));
  }
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
