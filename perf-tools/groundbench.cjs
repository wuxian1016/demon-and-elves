'use strict';
// Time the pieces of terrain-tile painting (ground / water / scenery / decorations) per 256x256 tile.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const n = require('@napi-rs/canvas');
const { makeHost, STARTUP, until } = require('./host.cjs');
const [root] = process.argv.slice(2);
const disk = fs.mkdtempSync(path.join(os.tmpdir(), 'cow8d-gb-')); fs.writeFileSync(path.join(disk, 'keys.json'), '{}');
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
  tapRect(g.getStartActionButtons().find(b => b.id === 'startGame'));
  await until(() => { host.advance(16.667); host.frame(); return !g.roundStarting && !g.roundLoading591 && g.state === 'prep'; }, 'start', 120000);
  for (let i = 0; i < 120; i++) { host.advance(16.667); host.frame(); }
  const art = w.woodlandArt; const T = {};
  const time = (k, fn) => { const t = hr(); fn(); T[k] = (T[k] || 0) + hr() - t; };
  const tile = n.createCanvas(260, 260), c = tile.getContext('2d');
  const vis = (ox, oy, cw, ch) => (px, py, p) => px > ox - p && px < ox + cw + p && py > oy - p && py < oy + ch + p;
  const world = w.referenceTerrain.world; let N = 0;
  for (let ty = 0; ty < 8; ty++) for (let tx = 0; tx < 8; tx++) {
    const ox = 2000 + tx * 256, oy = 1500 + ty * 256; N++;
    c.setTransform(1, 0, 0, 1, -ox + 2, -oy + 2);
    time('ground', () => art.ground(c, ox - 2, oy - 2, 260, 260));
    time('water', () => g.drawWaterPools(c, vis(ox, oy, 260, 260)));
    time('scenery', () => g.drawZoneScenery(c, vis(ox, oy, 260, 260)));
    time('decorations', () => g.drawDecorations(c, vis(ox, oy, 260, 260)));
  }
  // break ground() into its parts by temporarily disabling sub-steps
  const out = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, +(v / N).toFixed(2) + ' ms/tile']));
  console.log(JSON.stringify({ tiles: N, world: [world.width, world.height], earthPlacements: (w.earthPlacementPreview?.patches || []).length, perTile: out }, null, 1));
})().catch(e => { console.error('FAILED', e.stack || e); process.exitCode = 1; }).finally(() => host.close());
