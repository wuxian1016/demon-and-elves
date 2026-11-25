'use strict';
(async function () {
  const Q = Object.fromEntries(new URLSearchParams(location.search));
  const send = (s) => { try { window.webkit.messageHandlers.log.postMessage(String(s)); } catch (_) { console.log(s); } };
  window.onerror = (m, src, line, col, err) => send('ERROR ' + m + ' @' + src + ':' + line + ' ' + (err && err.stack || ''));
  window.onunhandledrejection = (e) => send('REJECT ' + (e.reason && e.reason.stack || e.reason));
  const sleep = (ms) => (ms <= 5 ? window.yieldTaskBN() : new Promise(r => setTimeout(r, ms)));
  async function until(fn, label, timeout = 60000) { const end = Date.now() + timeout; while (Date.now() < end) { if (fn()) return; await sleep(2); } throw Error('timeout: ' + label); }
  try {
    const ALLIES = +(Q.allies ?? 8), SECS = +(Q.secs || 60), FLUSH = Q.flush !== '0', W = 390, H = 844;
    const con = { log() {}, info() {}, debug() {}, warn: (...a) => send('WARN ' + a.map(String).join(' ').slice(0, 600)), error: (...a) => send('CERR ' + a.map(x => x && x.stack || String(x)).join(' ').slice(0, 1500)) };
    const DET = !!Q.det; const host = makeWebHost({ det: DET, con, base: 'c/' + (Q.client || 'r12') + '/', width: W, height: H, seed: +(Q.seed || 150) });
    let tid = 2;
    const tap = (b) => { if (!b) throw Error('no button'); const x = b.x + b.w / 2, y = b.y + b.h / 2, f = { identifier: ++tid, clientX: x, clientY: y, x, y }; host.emit('TouchStart', { changedTouches: [f], touches: [f] }); host.emit('TouchEnd', { changedTouches: [f], touches: [] }); };
    const t0 = performance.now();
    host.start();
    if (DET) { for (let k = 0; k < 200000; k++) { host.advance(4); await host.flush(); if (host.stored()['forest-startup-diagnostics-v1']?.events?.at(-1)?.kind === 'ready') break; } }
    try { await until(() => host.stored()['forest-startup-diagnostics-v1']?.events?.at(-1)?.kind === 'ready', 'Home ready', 30000); } catch (e) { send('KEYS ' + Object.keys(host.keys).join(',')); send('DIAG ' + JSON.stringify(host.stored()['forest-startup-diagnostics-v1']).slice(0, 3000)); send('MODULES ' + [...host.modules.keys()].length + ' last=' + [...host.modules.keys()].slice(-5).join(',')); throw e; }
    send('home ready ' + Math.round(performance.now() - t0) + ' ms');
    const g = host.env().window.game;
    const T = { u: 0, d: 0 };
    { const u = g.update, d = g.draw; g.update = function (...a) { const t = performance.now(); try { return u.apply(this, a); } finally { T.u += performance.now() - t; } }; g.draw = function (...a) { const t = performance.now(); try { return d.apply(this, a); } finally { T.d += performance.now() - t; } }; }
    if (DET) { for (let k = 0; k < 200000 && !g.homeOptionsReadyBN; k++) { host.advance(16.667); host.frame(); await host.flush(); } }
    await until(() => { host.advance(16.667); host.frame(); return g.homeOptionsReadyBN; }, 'home options', 60000);
    if (Q.dbgload) {
      const rt = host.env();
      for (const n of ['ensureCombatIcons471', 'loadPreparedPackage', 'ensureMetadataBN', 'ensureBatCargoReadyBN']) { const f = rt[n]; if (typeof f !== 'function') { send('no rt.' + n); continue; } rt[n] = async function (...a) { send('-> ' + n); try { const r = await f.apply(this, a); send('<- ' + n + ' ok'); return r; } catch (e) { send('<- ' + n + ' ERR ' + e.message); throw e; } }; }
      const ls = host.wx.loadSubpackage; host.wx.loadSubpackage = (o) => { send('loadSubpackage ' + o.name); return ls({ ...o, success: (r) => { send('  ok ' + o.name); o.success?.(r); }, fail: (e) => { send('  FAIL ' + o.name + ' ' + JSON.stringify(e)); o.fail?.(e); } }); };
    }
    if (Q.diff) g.selectDifficulty(Q.diff);
    for (let i = 0; i < ALLIES; i++) { const b = g.getAllySlotButtons()[i]; if (!b.selected) tap(b); host.advance(16.667); host.frame(); }
    tap(g.getStartActionButtons().find(b => b.id === 'startGame'));
    if (DET) { const t1 = performance.now(); for (let k = 0; k < 200000 && !(!g.roundStarting && !g.roundLoading591 && (g.state === 'prep' || g.state === 'hunt')); k++) { host.advance(16.667); host.frame(); await host.flush(); if (k % 300 === 0) send('loading k=' + k + ' t=' + Math.round(performance.now() - t1) + 'ms pending=' + host.pendingImages() + ' ' + JSON.stringify(g.roundLoading591 && { p: g.roundLoading591.phase, d: g.roundLoading591.detail })); } }
    await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && (g.state === 'prep' || g.state === 'hunt'); }, 'solo start', 180000);
    const log = [];
    const clearBlockers = () => {
      if (g.endlessOpeningIntro) { g.finishEndlessOpeningIntroBH(); log.push('intro'); }
      if (g.cardPresentation?.modal?.()) { g.cardPresentation.restore(); log.push('cardModal'); }
      if (g.sessionMenuOpen && (g.state === 'prep' || g.state === 'hunt')) { g.sessionMenuOpen = false; log.push('menu'); }
    };
    clearBlockers();
    send('match started ' + Math.round(performance.now() - t0) + ' ms, difficulty=' + g.trollDifficulty);
    const ctx = host.mainCanvas.getContext('2d');
    if (Q.ff) {
      // fast-forward with update only (no drawing), like the Node profiler's updateOnly
      const steps = Math.round(+Q.ff * 60);
      for (let i = 0; i < steps; i++) {
        host.advance(1000 / 60);
        if (Q.immortal && g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
        if (!g.robotGuideBN?.combatPaused?.()) { g.update(1000 / 60); if (g.state !== 'start') g.updateCamera(); }
        if (i % 120 === 119) { clearBlockers(); if (DET) await host.flush(); else await sleep(0); }
        if (g.state !== 'prep' && g.state !== 'hunt') break;
      }
      send('fast-forwarded to ' + Math.round(g.huntElapsed || 0) + 's wave ' + g.waveNumber + ' state ' + g.state);
      for (let i = 0; i < 120; i++) { host.advance(1000 / 60); host.frame(); }
    }
    let camTarget = null;
    const busyCam = (i) => {
      const z = g.zoom(), vw = W / z, vh = H / z;
      if (i % 120 === 0) {
        const pts = [];
        for (const h of g.hounds || []) if (!h.dead) pts.push(h);
        for (const b of g.buildings || []) if (!b.dead) pts.push(b);
        for (const p of g.peasants || []) pts.push(p);
        for (const a of g.allies || []) if (!a.dead) pts.push(a);
        if (g.troll && !g.troll.dead) pts.push(g.troll);
        let best = null, bestN = -1;
        for (let k = 0; k < pts.length; k += Math.max(1, Math.floor(pts.length / 80))) { const c = pts[k]; let n = 0; for (const p of pts) if (Math.abs(p.x - c.x) < vw / 2 && Math.abs(p.y - c.y) < vh / 2) n++; if (n > bestN) { bestN = n; best = c; } }
        if (best) camTarget = { x: best.x - vw / 2, y: best.y - vh * 0.5 };
      }
      if (!camTarget) return;
      g.manualCamera394 = true;
      const f = g.cameraFollow, dx = camTarget.x - f.x, dy = camTarget.y - f.y, d = Math.hypot(dx, dy), step = Math.min(d, Math.max(4, d * 0.08), 25);
      if (d > 0.5) { f.x += dx / d * step; f.y += dy / d * step; }
    };
    const STRESS = +(Q.stress || 0); let stressArt = null;
    if (STRESS) { stressArt = document.createElement('canvas'); stressArt.width = host.mainCanvas.width; stressArt.height = host.mainCanvas.height; const sc = stressArt.getContext('2d'); for (let y = 0; y < stressArt.height; y += 8) for (let x = 0; x < stressArt.width; x += 8) { sc.fillStyle = 'rgba(' + ((x * 7) & 255) + ',' + ((y * 3) & 255) + ',' + ((x + y) & 255) + ',' + (((x ^ y) & 7) / 7).toFixed(2) + ')'; sc.fillRect(x, y, 8, 8); } send('stress art ' + stressArt.width + 'x' + stressArt.height); }
    // optional per-phase raster timing: flush before/after each outermost wrapped draw call
    const PH = new Map(); let depth = 0, measuring = false, flushCost = 0, flushN = 0;
    const flush = () => ctx.getImageData(0, 0, 1, 1);
    const wrapPhase = (obj, name, label = name) => {
      const f = obj && obj[name]; if (typeof f !== 'function') return false;
      obj[name] = function (...a) {
        if (depth > 0 || !measuring) return f.apply(this, a);
        flush(); const t0 = performance.now(); depth++;
        try { return f.apply(this, a); } finally { flush(); depth--; const e = PH.get(label) || [0, 0]; e[0] += performance.now() - t0; e[1]++; PH.set(label, e); }
      };
      return true;
    };
    if (Q.phases === 'hud') {
      for (const n of ['drawStatusCached504', 'drawCircularDock512', 'uiFrame504', 'drawSlimeMinimap', 'drawLowWallMinimapWarnings', 'drawDemonAttackMinimap545', 'drawMiniPortraits512', 'drawMinimapToggle520', 'drawTutorialMinimap', 'drawEasyMinimapLegend', 'drawMinimapFog', 'drawBuildingStatus', 'drawShareRescueOffer', 'drawFpsHud', 'drawPerformanceHud', 'drawHudButtons', 'drawSkillButtons', 'drawJoystick']) wrapPhase(g, n);
      const wa = host.env().window.woodlandArt; if (wa) wrapPhase(wa, 'minimap', 'woodlandArt.minimap');
      const cnt = (n) => { const f = g[n]; g[n] = function (...a) { const r = f.apply(this, a); if (measuring) { const e = PH.get('#' + n + (r ? ':true' : ':false')) || [0, 0]; e[1]++; PH.set('#' + n + (r ? ':true' : ':false'), e); } return r; }; };
      cnt('minimapStateChanged');
    }
    if (Q.phases === 'hud2') {
      for (const n of ['drawStatus504', 'drawScreenBitmap411', 'drawCircularDock512', 'drawMiniPortraits512', 'drawSlimeMinimap', 'uiFrame504']) wrapPhase(g, n);
      const proto = Object.getPrototypeOf(g); const f = proto.drawHUD; const holder = { drawHUD: f }; wrapPhase(holder, 'drawHUD', 'proto.drawHUD'); g.__protoHud = holder.drawHUD;
      proto.drawHUD = function (...a) { return holder.drawHUD.apply(this, a); };
    }
    if (Q.phases && Q.phases !== 'hud' && Q.phases !== 'hud2') {
      for (const n of ['clearDisplay398', 'drawNativeLandscape', 'drawLandscapeDetails', 'drawClues', 'drawCannonFireZones', 'drawResourceBodies', 'drawTowerRange548', 'drawBuildingBodies', 'drawPlayerBuildGhost506', 'drawPlayerGroundAura', 'drawRepairEffects', 'drawFogOfWar', 'drawIncomingAttackWarning', 'drawIncomingAttackWarningCards440', 'drawDragonStorm', 'drawSessionMenu', 'drawBuildMenu', 'drawUpgradePanel', 'drawEasyOpeningGuide', 'drawEndlessOpeningIntro', 'drawRelicPanel', 'drawTutorial', 'drawDemonPanel', 'drawSaveSlots', 'drawDemonRetreatBanner', 'drawHUD', 'drawBuildingStatus', 'drawShareRescueOffer', 'drawSlimeMinimap', 'drawMinimap', 'drawStatusCached504'])
        if (!wrapPhase(g, n)) send('no phase ' + n);
      if (g.trollBase) wrapPhase(g.trollBase, 'draw', 'trollBase.draw');
      if (g.troll) wrapPhase(g.troll, 'draw', 'troll.draw');
      if (g.cardVisuals) { wrapPhase(g.cardVisuals, 'draw', 'cardVisuals.draw'); wrapPhase(g.cardVisuals, 'drawBases', 'cardVisuals.drawBases'); }
    }
    // count / optionally suppress primitive types on the main canvas while inside chosen functions
    const CNT = new Map(); let inScope = 0; const SUP = new Set((Q.suppress || '').split(',').filter(Boolean));
    if (Q.scope) {
      const proto2 = CanvasRenderingContext2D.prototype;
      for (const m of ['fillText', 'strokeText', 'fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'arc', 'clip', 'measureText', 'createLinearGradient', 'createRadialGradient']) {
        const o = proto2[m];
        proto2[m] = function (...a) { if (measuring && inScope && this === ctx) { CNT.set(m, (CNT.get(m) || 0) + 1); if (SUP.has(m)) return m === 'measureText' ? o.apply(this, a) : undefined; } return o.apply(this, a); };
      }
      for (const n of Q.scope.split(',')) { const target = n === 'trollBase.draw' ? g.trollBase : g, key = n === 'trollBase.draw' ? 'draw' : n; const f = target[key]; target[key] = function (...a) { inScope++; try { return f.apply(this, a); } finally { inScope--; } }; }
    }
    const SPY = new Map();
    if (Q.primspy) {
      const proto2 = CanvasRenderingContext2D.prototype;
      for (const m of ['fillText', 'strokeText', 'fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage']) {
        const o = proto2[m];
        proto2[m] = function (...a) {
          if (!(measuring && inScope && this === ctx)) return o.apply(this, a);
          const fsType = (s) => typeof s === 'string' ? s : (s && s.constructor && s.constructor.name) || String(s);
          const tr = this.getTransform();
          let geo = '';
          if (m === 'fillRect' || m === 'strokeRect') geo = a.slice(0, 4).map(v => Math.round(v)).join(',');
          else if (m === 'fillText' || m === 'strokeText') geo = JSON.stringify(String(a[0]).slice(0, 12)) + ' font=' + this.font;
          else if (m === 'drawImage') geo = (a[0] && a[0].width + 'x' + a[0].height) + ' -> ' + a.slice(a.length >= 9 ? 7 : 3, a.length >= 9 ? 9 : 5).map(v => Math.round(v)).join('x');
          const st = 'sh=' + this.shadowBlur + '/' + this.shadowColor + ' f=' + this.filter + ' op=' + this.globalCompositeOperation + ' a=' + this.globalAlpha + ' fill=' + fsType(this.fillStyle) + ' stroke=' + fsType(this.strokeStyle) + ' lw=' + this.lineWidth + ' sc=' + tr.a.toFixed(2);
          flush(); const t0 = performance.now(); const r = o.apply(this, a); flush(); const dt = performance.now() - t0 - flushCost;
          const area = (() => { if (m === 'fillRect' || m === 'strokeRect') return Math.abs(a[2] * a[3]) * tr.a * tr.d; if (m === 'drawImage') { const w = a.length >= 9 ? a[7] : a.length >= 5 ? a[3] : a[0]?.width, h = a.length >= 9 ? a[8] : a.length >= 5 ? a[4] : a[0]?.height; return Math.abs(w * h * tr.a * tr.d); } return 0; })();
          const bucket = area > 500000 ? 'XL' : area > 100000 ? 'L' : area > 10000 ? 'M' : 'S';
          const key = Q.primgroup ? (m + ' ' + bucket + ' a=' + (this.globalAlpha < 1 ? '<1' : '1') + ' fill=' + (typeof this.fillStyle === 'string' ? (/rgba\(.*,\s*0?\.\d+\)$/.test(this.fillStyle) ? 'rgba<1' : 'solid') : 'grad/pat') + (this.shadowBlur ? ' SHADOW' : '') + (this.globalCompositeOperation !== 'source-over' ? ' op=' + this.globalCompositeOperation : '')) : (m + ' | ' + geo + ' | ' + st);
          const e = SPY.get(key) || [0, 0]; e[0] += dt; e[1]++; SPY.set(key, e);
          return r;
        };
      }
    }
    if (Q.skipblit) { const f = g.drawScreenBitmap411; g.drawScreenBitmap411 = function (c, art, ...r) { if (art === g.hudLayer504) return; return f.call(this, c, art, ...r); }; }
    if (Q.skip) for (const n of Q.skip.split(',')) { if (n === 'trollBase.draw') g.trollBase.draw = () => {}; else if (typeof g[n] === 'function') g[n] = function () { return false; }; else send('no skip ' + n); }
    if (Q.jsphases) {
      // JS-only time (no flush): command recording + game logic inside the call
      for (const n of Q.jsphases.split(',')) {
        const holder = n.startsWith('wa.') ? host.env().window.woodlandArt : g, key = n.replace(/^wa\./, ''); const f = holder && holder[key]; if (typeof f !== 'function') { send('no js phase ' + n); continue; }
        holder[key] = function (...a) { if (!measuring || depth > 0) return f.apply(this, a); const t0 = performance.now(); depth++; try { return f.apply(this, a); } finally { depth--; const e = PH.get('js:' + n) || [0, 0]; e[0] += performance.now() - t0; e[1]++; PH.set('js:' + n, e); } };
      }
    }
    if (Q.phases || Q.primspy) {
      for (let k = 0; k < 200; k++) { flush(); const t0 = performance.now(); flush(); flushCost += performance.now() - t0; flushN++; }
      flushCost /= flushN; send('flush cost ms ' + flushCost.toFixed(4));
    }
    if (Q.statespy) {
      const seen = new Map(); const f = g.drawScreenBitmap411; let n = 0;
      g.drawScreenBitmap411 = function (c, art, ...rest) {
        const st = { shadowBlur: c.shadowBlur, shadowColor: c.shadowColor, shadowOffsetX: c.shadowOffsetX, shadowOffsetY: c.shadowOffsetY, filter: c.filter, op: c.globalCompositeOperation, alpha: c.globalAlpha, smooth: c.imageSmoothingEnabled, quality: c.imageSmoothingQuality, art: art && art.width + 'x' + art.height, transform: (() => { const m = c.getTransform(); return [m.a, m.b, m.c, m.d, m.e, m.f].map(v => +v.toFixed(2)).join(','); })() };
        flush(); const t0 = performance.now(); const r = f.call(this, c, art, ...rest); flush(); const dt = performance.now() - t0;
        const k = JSON.stringify(st); const e = seen.get(k) || { n: 0, ms: 0 }; e.n++; e.ms += dt; seen.set(k, e); n++;
        if (n === 600) send('STATESPY ' + JSON.stringify([...seen].map(([k, v]) => ({ state: JSON.parse(k), n: v.n, msEach: +(v.ms / v.n).toFixed(3) }))));
        return r;
      };
    }
    if (Q.jumpbench) {
      for (let i = 0; i < 300; i++) { host.advance(1000 / 60); host.frame(); }
      const out = {};
      const frameT = () => { flush(); const t0 = performance.now(); host.advance(1000 / 60); host.frame(); flush(); return +(performance.now() - t0).toFixed(1); };
      out.steady = [frameT(), frameT(), frameT()];
      const tt = g.terrainTiles200; const n0 = tt.tiles.size; tt.clear();
      out.afterClear = Array.from({ length: 8 }, frameT); out.tilesBefore = n0; out.tilesAfter = tt.tiles.size;
      // jump to far, never-visited places (minimap-tap style)
      const z = g.zoom(); g.manualCamera394 = true;
      for (const [fx, fy] of [[0.15, 0.2], [0.85, 0.25], [0.5, 0.85]]) {
        g.cameraFollow.x = g.camera.x = 10000 * fx - 195 / z; g.cameraFollow.y = g.camera.y = 8000 * fy - 422 / z;
        out['jump' + fx + ',' + fy] = Array.from({ length: 6 }, frameT);
      }
      const p = Object.getPrototypeOf(tt); const op = tt.paint; let paints = 0, paintMs = 0; tt.paint = function (...a) { flush(); const t0 = performance.now(); try { return op.apply(this, a); } finally { flush(); paintMs += performance.now() - t0; paints++; } };
      g.cameraFollow.x = g.camera.x = 10000 * 0.3 - 195 / z; g.cameraFollow.y = g.camera.y = 8000 * 0.6 - 422 / z;
      out.jumpTimed = Array.from({ length: 4 }, frameT); out.paints = paints; out.msPerTilePaint = +(paintMs / Math.max(1, paints)).toFixed(2);
      send('JUMPBENCH ' + JSON.stringify(out));
    }
    if (Q.bench) {
      for (let i = 0; i < 600; i++) { host.advance(1000 / 60); host.frame(); }
      const L = g.hudLayer504; send('hud layer ' + (L && L.width + 'x' + L.height));
      const mk = (w, h, alpha) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); for (let y = 0; y < h; y += 8) for (let xx = 0; xx < w; xx += 8) { x.fillStyle = alpha ? 'rgba(' + (xx & 255) + ',' + (y & 255) + ',90,' + (((xx ^ y) & 7) / 7).toFixed(2) + ')' : 'rgb(' + (xx & 255) + ',' + (y & 255) + ',90)'; x.fillRect(xx, y, 8, 8); } return c; };
      const copyOf = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
      const variants = { hudLayer: L, hudCopy: copyOf(L), alpha780x248: mk(L.width, L.height, true), opaque780x248: mk(L.width, L.height, false), alphaFull: mk(host.mainCanvas.width, host.mainCanvas.height, true), opaqueFull: mk(host.mainCanvas.width, host.mainCanvas.height, false) };
      const res = {};
      for (const sm of [false, true]) for (const [name, src] of Object.entries(variants)) {
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = sm;
        flush(); const t0 = performance.now(); for (let k = 0; k < 60; k++) ctx.drawImage(src, 0, 0); flush(); const dt = (performance.now() - t0) / 60;
        ctx.restore(); res[name + (sm ? '+smooth' : '')] = +dt.toFixed(3);
      }
      // bitmap from layer
      try { const bmp = await createImageBitmap(L); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); flush(); const t0 = performance.now(); for (let k = 0; k < 60; k++) ctx.drawImage(bmp, 0, 0); flush(); res.hudImageBitmap = +((performance.now() - t0) / 60).toFixed(3); ctx.restore(); } catch (e) { res.bmpErr = String(e); }
      const sctx = L.getContext('2d'); res.layerAttrs = JSON.stringify(sctx.getContextAttributes ? sctx.getContextAttributes() : {}); res.mainAttrs = JSON.stringify(ctx.getContextAttributes ? ctx.getContextAttributes() : {});
      send('BENCH ' + JSON.stringify(res));
    }
    const all = [], allJs = [], rows = [];
    const newSec = () => ({ f: 0, js: 0, tot: 0, max: 0, o12: 0, o16: 0, o33: 0, u: 0, d: 0 });
    let sec = newSec();
    const WARM = +(Q.warm || 0);
    for (let i = 0; i < SECS * 60; i++) {
      if (i === WARM * 60) { send('MEASURE_START'); await sleep(300); measuring = !!(Q.phases || Q.jsphases || Q.scope); PH.clear(); }
      if (Q.immortal && g.player && !g.player.dead) { g.player.hp = g.player.maxHp; g.player.invincibleTime = 1e9; }
      if (DET && i % 60 === 29) await host.flush();
      if (Q.cam === 'busy') busyCam(i);
      host.advance(1000 / 60);
      const u0 = T.u, d0 = T.d;
      const a = performance.now(); host.frame(); const b = performance.now();
      if (STRESS) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.02; for (let k = 0; k < STRESS; k++) ctx.drawImage(stressArt, (k % 3) - 1, 0); ctx.restore(); }
      if (FLUSH) ctx.getImageData(0, 0, 1, 1);
      const c = performance.now();
      const js = b - a, tot = c - a; all.push(tot); allJs.push(js);
      sec.f++; sec.js += js; sec.tot += tot; sec.max = Math.max(sec.max, tot); if (tot > 12) sec.o12++; if (tot > 16.7) sec.o16++; if (tot > 33.3) sec.o33++; sec.u += T.u - u0; sec.d += T.d - d0;
      if (i % 60 === 59) {
        rows.push({ s: (i + 1) / 60, wave: g.waveNumber, js: +(sec.js / sec.f).toFixed(2), tot: +(sec.tot / sec.f).toFixed(2), max: +sec.max.toFixed(1), o12: sec.o12, o16: sec.o16, o33: sec.o33, upd: +(sec.u / sec.f).toFixed(2), draw: +(sec.d / sec.f).toFixed(2), hounds: g.hounds.filter(h => !h.dead).length, bld: g.buildings.filter(x => !x.dead).length, peas: g.peasants.length, allies: (g.allies || []).filter(a => !a.dead).length });
        if (rows.length % 30 === 0) { const r = rows.at(-1); send(`[${r.s}s] wave=${r.wave} js=${r.js} tot=${r.tot} max=${r.max} o16=${r.o16} upd=${r.upd} draw=${r.draw} hounds=${r.hounds} bld=${r.bld}`); }
        sec = newSec(); clearBlockers(); if (DET) await host.flush(); else await sleep(0);
        if (g.state !== 'prep' && g.state !== 'hunt') { log.push('ended:' + g.state); break; }
      }
    }
    send('MEASURE_END'); await sleep(300);
    if (WARM) { all.splice(0, WARM * 60); allJs.splice(0, WARM * 60); rows.splice(0, WARM); }
    const q = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2); };
    const mean = arr => +(arr.reduce((x, y) => x + y, 0) / arr.length).toFixed(2);
    const summary = { frames: all.length, flush: FLUSH, tot: { mean: mean(all), p50: q(all, .5), p95: q(all, .95), p99: q(all, .99), max: q(all, 1) }, js: { mean: mean(allJs), p95: q(allJs, .95), p99: q(allJs, .99) }, o12: all.filter(x => x > 12).length, o16: all.filter(x => x > 16.7).length, o33: all.filter(x => x > 33.3).length, downloads: host.calls.downloadFile };
    const nF = Math.max(1, all.length); const phases = {}; let phSum = 0;
    for (const [k, [ms, n]] of [...PH].sort((x, y) => y[1][0] - x[1][0])) { const v = ms / nF - (k.startsWith('js:') ? 0 : (n / nF) * flushCost); phases[k] = { msPerFrame: +v.toFixed(3), callsPerFrame: +(n / nF).toFixed(2) }; phSum += v; }
    summary.phaseSumMsPerFrame = +phSum.toFixed(3);
    if (Q.primspy) summary.prims = [...SPY].sort((x, y) => y[1][0] - x[1][0]).slice(0, 30).map(([k, [ms, n]]) => [k, +(ms / nF).toFixed(3), +(n / nF).toFixed(2)]);
    if (Q.scope) summary.scopeCallsPerFrame = Object.fromEntries([...CNT].map(([k, v]) => [k, +(v / nF).toFixed(1)]));
    const r6 = v => Math.round(v * 1e6) / 1e6, sm = (arr, f) => { let s = 0; for (const e of arr || []) if (!e.dead) s += f(e); return r6(s); };
    summary.digest = JSON.stringify([g.state, g.waveNumber, r6(g.huntElapsed || 0), g.hounds.filter(h => !h.dead).length, sm(g.hounds, h => h.x + h.y * 3), sm(g.hounds, h => h.hp), g.buildings.filter(b => !b.dead).length, sm(g.buildings, b => b.hp), r6(g.troll.x), r6(g.troll.y), r6(g.troll.hp)]);
    send('RESULT ' + JSON.stringify({ query: Q, summary, phases, log, rows }));
    send('__DONE__');
  } catch (e) { send('FAILED ' + (e && e.message) + ' | ' + (e && e.stack || e)); send('__DONE__'); }
})();
