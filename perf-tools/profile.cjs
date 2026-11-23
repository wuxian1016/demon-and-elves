'use strict';
// Profiling harness for 恶魔与精灵 (COW8D) built on the project's own QA wx host.
// usage: node profile.cjs <client-dir> <out-dir> [scenario]
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const inspector = require('node:inspector');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
try { n.GlobalFonts.registerFromPath('/System/Library/Fonts/Hiragino Sans GB.ttc', 'sans-serif'); } catch (_) {}

const [root, outDir, scenario = 'default'] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-prof-'));
fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
const W = +(process.env.W || 390), H = +(process.env.H || 844), PR = +(process.env.PR || 3);

// ---------- canvas instrumentation ----------
let mainCanvas = null;
const created = [];
const proto = Object.getPrototypeOf(n.createCanvas(1, 1).getContext('2d'));
const counting = { createdSites: {}, bigMain: {}, on: false, main: {}, off: {}, mainArea: 0, offArea: 0, shadowDraws: 0, filterDraws: 0, compositeOps: {} };
const canvasStats = new Map(); const canvasSite = new WeakMap();
function site(){const st=new Error().stack.split('\n').slice(3,9).map(l=>l.trim().replace(/^at /,'').replace(/\(?[^()]*\/client\//,'').replace(/\)$/,'')).filter(l=>!l.includes('profile.cjs')&&!l.includes('host.cjs'));return st.slice(0,4).join(' < ');}
function bump(isMain, k) { const o = isMain ? counting.main : counting.off; o[k] = (o[k] || 0) + 1; }
const METHODS = ['drawImage', 'fillText', 'strokeText', 'fillRect', 'strokeRect', 'clearRect', 'fill', 'stroke', 'save', 'restore', 'clip',
  'createLinearGradient', 'createRadialGradient', 'createPattern', 'getImageData', 'putImageData', 'measureText', 'setTransform', 'arc', 'beginPath'];
for (const m of METHODS) {
  const orig = proto[m];
  if (typeof orig !== 'function') continue;
  proto[m] = function (...a) {
    if (counting.on) {
      const isMain = this.canvas === mainCanvas;
      bump(isMain, m);
      if (m === 'drawImage' || m === 'fillRect' || m === 'fill' || m === 'fillText' || m === 'stroke' || m === 'strokeText') {
        let sb = 0; try { sb = this.shadowBlur; } catch (_) {}
        if (sb > 0) { let sc = ''; try { sc = String(this.shadowColor); } catch (_) {} if (!/rgba\(0, 0, 0, 0\)|transparent|#00000000/.test(sc)) { counting.shadowDraws++; bump(isMain, 'shadow:' + m); } }
        let f = 'none'; try { f = this.filter; } catch (_) {}
        if (f && f !== 'none') { counting.filterDraws++; bump(isMain, 'filter:' + m); }
        let op = 'source-over'; try { op = this.globalCompositeOperation; } catch (_) {}
        if (op !== 'source-over') counting.compositeOps[op] = (counting.compositeOps[op] || 0) + 1;
      }
      if (m === 'drawImage' || m === 'fillRect') {
        let dw, dh;
        if (m === 'fillRect') { dw = a[2]; dh = a[3]; }
        else if (a.length >= 9) { dw = a[7]; dh = a[8]; }
        else if (a.length >= 5) { dw = a[3]; dh = a[4]; }
        else { dw = a[0]?.width || 0; dh = a[0]?.height || 0; }
        let sx = 1, sy = 1; try { const t = this.getTransform(); sx = Math.hypot(t.a, t.b); sy = Math.hypot(t.c, t.d); } catch (_) {}
        const area = Math.abs(dw * sx * dh * sy);
        if (Number.isFinite(area)) { if (isMain) { counting.mainArea += area; if (area > 150000) { const k = m + ' ' + Math.round(dw*sx) + 'x' + Math.round(dh*sy) + ' @ ' + site().split(' < ').slice(0,2).join(' < '); counting.bigMain[k] = (counting.bigMain[k] || 0) + area; } } else { counting.offArea += area; let st = canvasStats.get(this.canvas); if (!st) { st = { w: this.canvas.width, h: this.canvas.height, area: 0, draws: 0, site: canvasSite.get(this.canvas) || '?', drawSite: site() }; canvasStats.set(this.canvas, st); } st.area += area; st.draws++; } }
      }
    }
    return orig.apply(this, a);
  };
}

const INV = {}; const liveCanvases = [], liveImages = []; const imgName = new WeakMap(), canvasBorn = new WeakMap();
function memInventory() { if (global.gc) { global.gc(); global.gc(); } let cb = 0, cn = 0, ib = 0, inn = 0; const big = []; for (const r of liveCanvases) { const c = r.deref(); if (!c || c === mainCanvas) continue; cn++; const b = c.width * c.height * 4; cb += b; if (b > 2e6) big.push(c.width + 'x' + c.height); } const byImg = []; for (const r of liveImages) { const i = r.deref(); if (!i || !i.width || !i.src) continue; inn++; const b = i.width * i.height * 4; ib += b; byImg.push([String(i.src).replace(/^.*client\//, ''), i.width + 'x' + i.height, +(b / 1048576).toFixed(2)]); } byImg.sort((a, b) => b[2] - a[2]); const byDir = {}; for (const [nm, , mb] of byImg) { const d = nm.split('/').slice(0, nm.includes('/') ? 1 : 0).join('/') || '(root)'; byDir[d] = +((byDir[d] || 0) + mb).toFixed(2); } const bySite = {}; for (const r of liveCanvases) { const c = r.deref(); if (!c || c === mainCanvas) continue; const k = canvasBorn.get(c) || '?'; const o = bySite[k] || (bySite[k] = [0, 0]); o[0]++; o[1] = +(o[1] + c.width * c.height * 4 / 1048576).toFixed(2); } INV.last = { byImg: byImg.slice(0, 40), byDir, bySite: Object.entries(bySite).sort((a, b) => b[1][1] - a[1][1]).slice(0, 25) }; return { offscreenCanvases: cn, offscreenMB: +(cb / 1048576).toFixed(1), bigCanvases: big, decodedImages: inn, decodedImageMB: +(ib / 1048576).toFixed(1), mainCanvasMB: +(mainCanvas.width * mainCanvas.height * 4 / 1048576).toFixed(1), jsHeapMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1) }; }
const graphics = {
  canvas(w, h) {
    const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); liveCanvases.push(new WeakRef(c)); if (process.env.INVSITE) canvasBorn.set(c, site().split(' < ').slice(0, 2).join(' < '));
    c.addEventListener = () => {}; c.removeEventListener = () => {};
    if (!mainCanvas) mainCanvas = c; else canvasSite.set(c, site());
    created.push({ at: Date.now(), w: c.width, h: c.height });
    if (counting.on) { counting.canvasesCreatedInWindow = (counting.canvasesCreatedInWindow || 0) + 1; const k = c.width + 'x' + c.height + ' @ ' + site().split(' < ').slice(0, 3).join(' < '); counting.createdSites[k] = (counting.createdSites[k] || 0) + 1; }
    return c;
  },
  image(locate) {
    const i = new n.Image(); liveImages.push(new WeakRef(i)); let name; const orig = Object.getOwnPropertyDescriptor(n.Image.prototype, 'src');
    Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; try { orig.set.call(i, fs.readFileSync(locate(s))); } catch (e) { queueMicrotask(() => i.onerror?.(e)); } } });
    return i;
  }
};
const counters = { storageWrites: 0, storageBytes: 0, timers: 0, timerOrigins: new Map(), canvases: 0, fileWrites: 0, traceTimers: true };
const host = makeHost(root, disk, false, { width: W, height: H, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: PR, counters });

const hr = () => Number(process.hrtime.bigint()) / 1e6;
const LONG_MS = +(process.env.LONGMS || 12);
let tid = 2;
function tap(b) { if (!b) throw Error('no button'); const x = b.x + b.w / 2, y = b.y + b.h / 2, f = { identifier: ++tid, clientX: x, clientY: y, x, y }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); host.emit('TouchEnd', { changedTouches: [f], touches: [] }); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const T = { update: 0, draw: 0, updates: 0, draws: 0 };
function wrapTiming(g) {
  const u = g.update, d = g.draw;
  g.update = function (...a) { const t = hr(); try { return u.apply(this, a); } finally { T.update += hr() - t; T.updates++; } };
  g.draw = function (...a) { const t = hr(); try { return d.apply(this, a); } finally { T.draw += hr() - t; T.draws++; } };
}

function snapshotPNG(name) {
  try { fs.writeFileSync(path.join(outDir, name + '.png'), mainCanvas.toBuffer('image/png')); } catch (e) { console.error('png fail', e.message); }
}

// Run N frames through the real host RAF path (loop -> update/draw), advancing fake clock 16.667ms per frame.
async function runFrames(label, frames, { count = true, profile = false, move = false, pan = false } = {}) {
  const g = host.env().window.game;
  Object.assign(T, { update: 0, draw: 0, updates: 0, draws: 0 });
  canvasStats.clear();
  counting.bigMain = {}; counting.createdSites = {};
  Object.assign(counting, { main: {}, off: {}, mainArea: 0, offArea: 0, shadowDraws: 0, filterDraws: 0, compositeOps: {}, canvasesCreatedInWindow: 0 });
  counters.timers = 0; counters.timerOrigins = new Map(); counters.storageWrites = 0; counters.storageBytes = 0;
  const frameMs = [];
  let session = null;
  let hsession = null;
  if (process.env.ALLOC && !profile) { hsession = new inspector.Session(); hsession.connect(); await new Promise(r => hsession.post('HeapProfiler.enable', r)); await new Promise((r, j) => hsession.post('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }, (e) => e ? j(e) : r())); }
  if (profile) { session = new inspector.Session(); session.connect(); await new Promise(r => session.post('Profiler.enable', r)); await new Promise(r => session.post('Profiler.setSamplingInterval', { interval: +(process.env.SAMPLE_US || 200) }, r)); await new Promise(r => session.post('Profiler.start', r)); }
  const WA = host.env().window.woodlandArt; const ps0 = WA?.poseCacheStats215?.(), sh0 = WA?.shadowStats?.();
  counting.on = count;
  let rafMissing = 0; const longFrames = [];
  const j = move ? g.getJoystickRect() : null; const SID = 9001; let camStart = { x: g.camera.x, y: g.camera.y }, camPath = 0, lastCam = { ...camStart };
  if (move && j) { const f = { identifier: SID, clientX: j.x, clientY: j.y, x: j.x, y: j.y }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); }
  if (pan) { const f = { identifier: SID, clientX: W * .55, clientY: H * .45, x: W * .55, y: H * .45 }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); }
  for (let i = 0; i < frames; i++) {
    if (process.env.IMMORTAL && g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
    if (move && j) { const seg = Math.floor(i / 150), a = seg * Math.PI / 2 + 0.35; const x = j.x + Math.cos(a) * j.r * 0.95, y = j.y + Math.sin(a) * j.r * 0.95; const f = { identifier: SID, clientX: x, clientY: y, x, y }; host.emit('TouchMove', { changedTouches: [f], touches: [f] }); }
    if (pan) { const t = i / 60, x = W * .55 + Math.sin(t * 1.3) * W * .3, y = H * .45 + Math.cos(t * 0.9) * H * .2; const f = { identifier: SID, clientX: x, clientY: y, x, y }; host.emit('TouchMove', { changedTouches: [f], touches: [f] }); }
    host.advance(1000 / 60);
    const t = hr(); const tUs = Number(process.hrtime.bigint() / 1000n);
    if (host.pendingFrames() === 0) rafMissing++;
    const u0 = T.update, d0 = T.draw;
    host.frame();
    const ft = hr() - t; frameMs.push(ft);
    if (ft > LONG_MS) longFrames.push({ i, ms: +ft.toFixed(1), upd: +(T.update - u0).toFixed(1), draw: +(T.draw - d0).toFixed(1), t0: tUs, t1: Number(process.hrtime.bigint() / 1000n), wave: g.waveNumber });
    camPath += Math.hypot(g.camera.x - lastCam.x, g.camera.y - lastCam.y); lastCam = { x: g.camera.x, y: g.camera.y };
    if (i % 30 === 29) await sleep(0); // let promise/timer work run like a real host would between frames
  }
  if ((move && j) || pan) { const f = { identifier: SID, clientX: 0, clientY: 0, x: 0, y: 0 }; host.emit('TouchEnd', { changedTouches: [f], touches: [] }); }
  counting.on = false;
  const ps1 = WA?.poseCacheStats215?.(), sh1 = WA?.shadowStats?.();
  let prof = null;
  if (profile) { prof = await new Promise(r => session.post('Profiler.stop', (e, res) => r(res.profile))); session.disconnect(); }
  let alloc = null;
  if (hsession) { const hp = await new Promise(r => hsession.post('HeapProfiler.getSamplingProfile', (e, res) => r(res.profile))); await new Promise(r => hsession.post('HeapProfiler.stopSampling', r)); hsession.disconnect(); const by = new Map(); let total = 0; const walk = (nd, jsKey) => { const cf = nd.callFrame; const own = (cf.functionName || '(anon)') + ' ' + cf.url.replace(/^.*\/client\//, '') + ':' + (cf.lineNumber + 1); const isGame = /\/client\//.test(cf.url); const key = isGame ? own : (jsKey ? jsKey + ' [via ' + (cf.functionName || '?') + ']' : own); const sz = (nd.selfSize || 0); total += sz; if (sz && !/harness\//.test(cf.url)) by.set(key, (by.get(key) || 0) + sz); for (const c of nd.children || []) walk(c, isGame ? own : jsKey); }; walk(hp.head, null); alloc = { totalMBPerSec: +(total / 1048576 / (frames / 60)).toFixed(2), KBPerFrame: +(total / 1024 / frames).toFixed(1), top: [...by].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => [k, +(v / 1024 / frames).toFixed(1) + ' KB/f']) }; }
  frameMs.sort((a, b) => a - b);
  const q = p => +frameMs[Math.min(frameMs.length - 1, Math.floor(frameMs.length * p))].toFixed(2);
  const per = (o) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / frames).toFixed(1)]));
  const res = {
    alloc, label, frames, cameraTravelPx: Math.round(camPath), poseCache: ps1 && { frames: ps1.frames, MB: +(ps1.frameBytes / 1048576).toFixed(1), budgetMB: ps1.frameBudget / 1048576, evictionsInWindow: ps1.evictions - ps0.evictions }, shadowCache: sh1 && { hits: sh1.hits - sh0.hits, misses: sh1.misses - sh0.misses, staticEntries: sh1.staticEntries, animatedEntries: sh1.animatedEntries }, state: g.state, wave: g.waveNumber, huntElapsed: Math.round(g.huntElapsed || 0),
    entities: { hounds: g.hounds?.filter(h => !h.dead).length, peasants: g.peasants?.length, buildings: g.buildings?.filter(b => !b.dead).length, allies: g.allies?.length, projectiles: g.projectiles?.length, particles: g.particles?.length, tanks: g.tanks?.length },
    hostFrameMs: { p50: q(.5), p95: q(.95), p99: q(.99), max: q(1), mean: +(frameMs.reduce((a, b) => a + b, 0) / frames).toFixed(2) },
    updateMsPerFrame: +(T.update / frames).toFixed(2), drawMsPerFrame: +(T.draw / frames).toFixed(2), updatesPerFrame: +(T.updates / frames).toFixed(2), drawsPerFrame: +(T.draws / frames).toFixed(2),
    rafMissing,
    mainCanvas: { w: mainCanvas.width, h: mainCanvas.height },
    perFrameMain: per(counting.main), perFrameOffscreen: per(counting.off),
    mainFillMpxPerFrame: +(counting.mainArea / frames / 1e6).toFixed(2), offscreenFillMpxPerFrame: +(counting.offArea / frames / 1e6).toFixed(2),
    shadowDrawsPerFrame: +(counting.shadowDraws / frames).toFixed(1), filterDrawsPerFrame: +(counting.filterDraws / frames).toFixed(1), compositeOps: counting.compositeOps,
    canvasesCreated: counting.canvasesCreatedInWindow,
    createdSites: Object.entries(counting.createdSites).sort((a, b) => b[1] - a[1]).slice(0, 10),
    bigMainLayers: Object.entries(counting.bigMain).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, +(v / frames / 1e6).toFixed(2)]),
    topOffscreen: [...canvasStats.values()].sort((a, b) => b.area - a.area).slice(0, 8).map(v => ({ size: v.w + 'x' + v.h, mpxPerFrame: +(v.area / frames / 1e6).toFixed(2), drawsPerFrame: +(v.draws / frames).toFixed(1), created: v.site, firstDraw: v.drawSite })),
    timersPerSecond: +(counters.timers / (frames / 60)).toFixed(1),
    topTimerOrigins: [...counters.timerOrigins].sort((a, b) => b[1] - a[1]).slice(0, 8),
    storageWritesPerMin: +(counters.storageWrites / (frames / 3600)).toFixed(1), storageKBPerMin: +(counters.storageBytes / 1024 / (frames / 3600)).toFixed(1),
  };
  res.longFrames = longFrames.map(({ t0, t1, ...r }) => r);
  res.longCount = { over12: frameMs.filter(x => x > 12).length, over16: frameMs.filter(x => x > 16.7).length, over33: frameMs.filter(x => x > 33.3).length, over50: frameMs.filter(x => x > 50).length };
  if (prof) { fs.writeFileSync(path.join(outDir, label + '.cpuprofile'), JSON.stringify(prof)); res.topSelf = topSelf(prof, 25); res.longAttribution = attributeLong(prof, longFrames); }
  return res;
}

function attributeLong(profile, longs) {
  const byId = new Map(profile.nodes.map(nd => [nd.id, nd])); const parent = new Map();
  for (const nd of profile.nodes) for (const c of nd.children || []) parent.set(c, nd.id);
  const name = nd => { const cf = nd.callFrame; return `${cf.functionName || '(anon)'} ${cf.url.replace(/^.*\/client\//, '').replace(/^.*\/harness\//, 'H:')}:${cf.lineNumber + 1}`; };
  let t = profile.startTime; const times = profile.timeDeltas.map(d => (t += d));
  return longs.slice(0, 12).map(L => {
    const self = new Map(), incl = new Map(); let n = 0;
    for (let i = 0; i < profile.samples.length; i++) { if (times[i] < L.t0 || times[i] > L.t1) continue; n++; let id = profile.samples[i]; const nd = byId.get(id); const k = name(nd); self.set(k, (self.get(k) || 0) + 1); const seen = new Set(); while (id != null) { const nn = byId.get(id); const kk = name(nn); if (/js\/|network\/|art163\/|runtime\.js|woodland|unit-motion/.test(kk) && !seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + 1); } id = parent.get(id); } }
    const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([kk, v]) => kk + ' ' + Math.round(v / Math.max(1, n) * 100) + '%');
    return { i: L.i, ms: L.ms, upd: L.upd, draw: L.draw, samples: n, self: top(self, 6), inclusive: top(incl, 14) };
  });
}
function topSelf(profile, k) {
  const byId = new Map(profile.nodes.map(nd => [nd.id, nd]));
  const self = new Map();
  const dt = profile.timeDeltas; let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const nd = byId.get(profile.samples[i]); const d = dt[i] || 0; total += d;
    const cf = nd.callFrame; const key = `${cf.functionName || '(anon)'} ${cf.url.replace(/^.*\/client\//, '')}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + d);
  }
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, v]) => [key, +(v / total * 100).toFixed(1) + '%']);
}

async function fastForward(seconds, { drawEvery = 0 } = {}) {
  const g = host.env().window.game;
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    host.advance(1000 / 60);
    host.frame(); // full loop (update + draw)
    if (i % 60 === 59) await sleep(0);
    if (g.state !== 'prep' && g.state !== 'hunt') break;
  }
}


function clearBlockers(g, log) {
  if (g.endlessOpeningIntro) { g.finishEndlessOpeningIntroBH(); log.push('intro'); }
  if (g.cardPresentation?.modal?.()) { g.cardPresentation.restore(); log.push('cardModal'); }
  if (g.sessionMenuOpen && (g.state === 'prep' || g.state === 'hunt')) { g.sessionMenuOpen = false; log.push('menu'); }
}
async function updateOnly(g, seconds, log) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    host.advance(1000 / 60);
    if (process.env.IMMORTAL && g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
    if (!g.robotGuideBN?.combatPaused?.()) { g.update(1000 / 60); if (g.state !== 'start') g.updateCamera(); }
    if (i % 120 === 119) { clearBlockers(g, log); await sleep(0); }
    if (g.state !== 'prep' && g.state !== 'hunt') { log.push('ended:' + g.state + '@' + i); break; }
  }
}
(async () => {
  const ALLIES = +(process.env.ALLIES ?? 8);
  const CHECKS = (process.env.CHECKS || '90,240,480,780').split(',').map(Number);
  const PROFILE_AT = new Set((process.env.PROFILE_AT || '').split(',').filter(Boolean).map(Number));
  const report = { scenario, viewport: { W, H, PR }, allies: ALLIES, steps: [], blockers: [] };
  const t0 = hr();
  host.start();
  await until(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'Home ready', 60000);
  report.startupMs = Math.round(hr() - t0);
  const { window: w } = host.env(); const g = w.game;
  wrapTiming(g);
  await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home options', 20000);
  if (!process.env.SKIP_HOME) report.steps.push(await runFrames('home-idle', 240));
  tap(g.getDifficultyOptionButtons().find(b => b.id === 'medium'));
  for (let i = 0; i < ALLIES; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tap(b); host.advance(16.667); host.frame(); }
  report.allySlots = g.allySlots.slice();
  tap(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && (g.state === 'prep' || g.state === 'hunt'); }, 'solo start', 120000);
  clearBlockers(g, report.blockers);
  report.steps.push(await runFrames('prep-start', 300, { profile: PROFILE_AT.has(0) }));
  snapshotPNG('ck-000');
  let gameSec = 5;
  for (const ck of CHECKS) {
    await updateOnly(g, ck - gameSec, report.blockers); gameSec = ck;
    if (g.state !== 'prep' && g.state !== 'hunt') { report.ended = { state: g.state, at: ck }; snapshotPNG('ended'); break; }
    clearBlockers(g, report.blockers);
    const r = await runFrames('t' + ck, 300, { profile: PROFILE_AT.has(ck) }); r.memory = memInventory(); r.inventory = INV.last; r.stone = (() => { try { return { report: g.stoneBossCandidate?.bankReport?.(), alive: g.hounds.filter(h => h.waveStone && !h.dead).length }; } catch (e) { return String(e); } })(); r.memConstrained = host.env().runtime.memoryConstrained(); console.error(`[${ck}s] memory ${JSON.stringify(r.memory)}`);
    report.steps.push(r); snapshotPNG('ck-' + String(ck).padStart(3, '0'));
    if (process.env.MOVE) { const rm = await runFrames('t' + ck + '-walk', 600, { move: true, profile: PROFILE_AT.has(ck) }); report.steps.push(rm); snapshotPNG('ck-' + String(ck).padStart(3, '0') + '-walk'); console.error(`[${ck}s walk] pose=${JSON.stringify(rm.poseCache)} shadow=${JSON.stringify(rm.shadowCache)} cam=${rm.cameraTravelPx} p50=${rm.hostFrameMs.p50} p95=${rm.hostFrameMs.p95} draw=${rm.drawMsPerFrame} mainMpx=${rm.mainFillMpxPerFrame} offMpx=${rm.offscreenFillMpxPerFrame} canv=${rm.canvasesCreated}`);
      if (process.env.MEMWARN) { host.emit('MemoryWarning', { level: 10 }); report.steps.push({ label: 'memory-warning-emitted', constrained: host.env().runtime.memoryConstrained() }); }
      const rm2 = await runFrames('t' + ck + '-walk2', 600, { move: true }); report.steps.push(rm2); console.error(`[${ck}s walk2] cam=${rm2.cameraTravelPx} canv=${rm2.canvasesCreated} pose=${JSON.stringify(rm2.poseCache)} shadow=${JSON.stringify(rm2.shadowCache)}`);
      const rp = await runFrames('t' + ck + '-pan', 600, { pan: true }); report.steps.push(rp); console.error(`[${ck}s pan] cam=${rp.cameraTravelPx} p50=${rp.hostFrameMs.p50} p95=${rp.hostFrameMs.p95} draw=${rp.drawMsPerFrame} mainMpx=${rp.mainFillMpxPerFrame} offMpx=${rp.offscreenFillMpxPerFrame} canv=${rp.canvasesCreated}`); }
    console.error(`[${ck}s] state=${r.state} wave=${r.wave} hounds=${r.entities.hounds} bld=${r.entities.buildings} p50=${r.hostFrameMs.p50} upd=${r.updateMsPerFrame} draw=${r.drawMsPerFrame} mainMpx=${r.mainFillMpxPerFrame} offMpx=${r.offscreenFillMpxPerFrame}`);
  }
  try { const st = host.stored(); report.runtimeDiag = st['forest-runtime-diagnostics-v615']; report.freezeJournal = st['forest-qa-freeze-journal-v1']; report.startupDiag = st['forest-startup-diagnostics-v1']; } catch (e) { report.diagErr = String(e); }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  console.log('DONE ' + path.join(outDir, 'report.json'));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => { host.close(); });
