'use strict';
// Update-only benchmark: same seed, 8 allies, crazy; measures game.update time per minute and a final state digest.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), inspector = require('node:inspector');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
const [root, secsArg = '720'] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'ub-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
const graphics = require('./detgfx.cjs')(n, fs);
const host = makeHost(root, disk, false, { width: 390, height: 844, seed: 150, clockStart: 1800000000000, graphics, pixelRatio: 3 });
const hr = () => Number(process.hrtime.bigint()) / 1e6; let tid = 2;
const tap = b => { const x = b.x + b.w / 2, y = b.y + b.h / 2, f = { identifier: ++tid, clientX: x, clientY: y, x, y }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); host.emit('TouchEnd', { changedTouches: [f], touches: [] }); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const waitFor = async (cond, label, maxIter = 200000, frame = false) => { for (let k = 0; k < maxIter; k++) { host.advance(frame ? 16.667 : 4); if (frame) host.frame(); await graphics.flush(); if (process.env.DBGWAIT && k % 600 === 0) { const g = host.env().window.game; console.error('wait', label, k, 'pending', graphics.pendingCount(), 'vt', host.vtimerCount(), 'raf', host.pendingFrames(), 'state', g && g.state, 'rs', g && g.roundStarting, 'rl', g && JSON.stringify(g.roundLoading591)?.slice(0, 160)); } if (cond()) return; } throw Error('timeout ' + label); };
  const TW = Date.now(); const log = (m) => console.error('[' + Math.round((Date.now() - TW) / 1000) + 's] ' + m);
  host.start(); await waitFor(() => host.stored()[STARTUP]?.events?.at(-1)?.kind === 'ready', 'ready'); log('ready');
  const g = host.env().window.game;
  await waitFor(() => g.homeOptionsReadyBN, 'home', 200000, true); log('home');
  g.selectDifficulty(process.env.DIFF || 'crazy');
  for (let i = 0; i < 8; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tap(b); host.advance(16.667); host.frame(); }
  tap(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await waitFor(() => !g.roundStarting && !g.roundLoading591 && (g.state === 'prep' || g.state === 'hunt'), 'start', 200000, true); log('match started');
  if (g.endlessOpeningIntro) g.finishEndlessOpeningIntroBH();
  const W = { q: 0, line: 0, blk: 0 }; const T0 = hr();
  { const q = g.queryTerrainCollisionAt; g.queryTerrainCollisionAt = function (...a) { W.q++; return q.apply(this, a); };
    const l = g.demonLineBlocked; g.demonLineBlocked = function (...a) { W.line++; return l.apply(this, a); };
    const k = g.demonBlockingBuilding; g.demonBlockingBuilding = function (...a) { W.blk++; return k.apply(this, a); }; }
  const trace = []; const per = []; let acc = 0, mx = 0, over4 = 0; const all = [];
  const SPYF = +(process.env.SPYFROM || -1), spyLog = [];
  const spyArr = (arr, name) => { const push = arr.push; arr.push = function (...a) { if (curFrame >= SPYF) spyLog.push(curFrame + ' ' + name + '.push ' + a.length + ' ' + new Error().stack.split('\n').slice(2, 7).map(l => l.trim().replace(/^at /, '').replace(/\(?[^()]*\/client\//, '').replace(/\)$/, '')).join(' < ')); return push.apply(this, a); }; };
  let curFrame = 0, lastHounds = null, prof = null;
  for (let i = 0; i < +secsArg * 60; i++) {
    curFrame = i;
    if (process.env.PROF_FROM && i === +process.env.PROF_FROM * 60) { prof = new inspector.Session(); prof.connect(); await new Promise(r => prof.post('Profiler.enable', r)); await new Promise(r => prof.post('Profiler.setSamplingInterval', { interval: 200 }, r)); await new Promise(r => prof.post('Profiler.start', r)); }
    if (SPYF >= 0 && i >= SPYF && g.hounds !== lastHounds) { lastHounds = g.hounds; spyArr(g.hounds, 'hounds'); }
    if (SPYF >= 0 && i === SPYF + 60) { console.log(spyLog.slice(0, 30).join('\n')); break; }
    host.advance(1000 / 60);
    if (g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
    const t = hr(); if (!g.robotGuideBN?.combatPaused?.()) { g.update(1000 / 60); if (g.state !== 'start') g.updateCamera(); } const dt = hr() - t;
    acc += dt; mx = Math.max(mx, dt); if (dt > 4) over4++; all.push(dt);
    if (process.env.TRACE && i % 30 === 29) { const r6 = v => Math.round(v * 1e6) / 1e6; trace.push([i, ...g.miniTrolls.map(m => [r6(m.x), r6(m.y), r6(m.hp)]).flat(), r6(g.troll.x), r6(g.troll.y), ...g.hounds.slice(0, 40).map(h => r6(h.x + h.y)), g.hounds.length, r6(g.hounds.reduce((s, h) => s + (h.dead ? 0 : h.x + 3 * h.y + h.hp), 0)), g.buildings.length, r6(g.buildings.reduce((s, x) => s + (x.dead ? 0 : x.hp), 0)), g.miniTrolls.length, (g.allies || []).map(a => a.gold + ':' + a.wood).join('|')].join(',')); }
    if (i % 3600 === 3599) { per.push({ min: (i + 1) / 3600, msPerUpdate: +(acc / 3600).toFixed(3), max: +mx.toFixed(1), over4, wave: g.waveNumber, terrainQueriesK: Math.round(W.q / 1000), lineTestsK: Math.round(W.line / 1000), blockTestsK: Math.round(W.blk / 1000) }); W.q = W.line = W.blk = 0; console.error('[min ' + per.at(-1).min + '] ' + JSON.stringify(per.at(-1)) + ' wall=' + Math.round((hr() - T0) / 1000) + 's pendingImg=' + graphics.pendingCount()); acc = 0; mx = 0; over4 = 0; }
    if (i % 120 === 119) { if (g.endlessOpeningIntro) g.finishEndlessOpeningIntroBH(); if (g.cardPresentation?.modal?.()) g.cardPresentation.restore(); if (g.sessionMenuOpen) g.sessionMenuOpen = false; await graphics.flush(); }
    if (g.state !== 'prep' && g.state !== 'hunt') break;
  }
  if (prof) { const p = await new Promise(r => prof.post('Profiler.stop', (e, res) => r(res.profile))); fs.writeFileSync(process.env.PROF_OUT || 'upd.cpuprofile', JSON.stringify(p)); }
  const r6 = v => Math.round(v * 1e6) / 1e6, sum = (arr, f) => { let s = 0; for (const e of arr || []) if (!e.dead) s += f(e); return r6(s); };
  const dig = [g.state, g.waveNumber, r6(g.huntElapsed || 0), g.hounds.filter(h => !h.dead).length, sum(g.hounds, h => h.x + h.y * 3), sum(g.hounds, h => h.hp), g.buildings.filter(b => !b.dead).length, sum(g.buildings, b => b.hp), g.peasants.length, sum(g.miniTrolls, m => m.x + m.y), r6(g.troll.x), r6(g.troll.y), r6(g.troll.hp), (g.allies || []).map(a => [a.gold, a.wood, a.dead]).join('|')];
  all.sort((a, b) => a - b);
  if (process.env.TRACE) fs.writeFileSync(process.env.TRACE, trace.join('\n'));
  console.log(JSON.stringify({ per, p99: +all[Math.floor(all.length * 0.99)].toFixed(2), max: +all.at(-1).toFixed(1), mean: +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(3), digest: crypto.createHash('sha1').update(JSON.stringify(dig)).digest('hex').slice(0, 16), dig: dig.slice(0, 8) }));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
