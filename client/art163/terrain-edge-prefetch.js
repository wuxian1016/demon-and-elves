'use strict';
// PERF-L3 (11-23) ring prefetch + PERF-L4 (11-25) look-ahead for fast camera moves: tiles the moving view will reach
// within ~0.5 s are painted first (<=2 per frame, only while terrain work < 4 ms). Same paint ops, identical pixels.
const BANDS_SLOW = 4,
BANDS_FAST = 2;
const FAST_SPEED = 6, // world units per frame; walking the elf stays below this
LOOK_FRAMES = 30, // about half a second ahead
FAST_TILES = 2, // at most two look-ahead tiles per frame
FAST_GATE_MS = 4;
function stepBand(cache, job, paint) {
const n = Math.ceil(cache.size * cache.scale) + 4,
bleed = 2 / cache.scale;
if (!job.art) {
job.art = cache.beginTileSurface200({ key: job.key, x: job.x, y: job.y }, job.reuse || null);
job.reuse = null;
job.band = 0;
}
const B = job.bands || BANDS_SLOW,
c = job.art.getContext('2d'),
b0 = Math.floor((job.band * n) / B),
b1 = Math.floor(((job.band + 1) * n) / B);
c.save();
c.setTransform(1, 0, 0, 1, 0, 0);
c.beginPath();
c.rect(0, b0, n, b1 - b0);
c.clip();
c.imageSmoothingEnabled = false;
c.setTransform(cache.scale, 0, 0, cache.scale, -(job.x - bleed) * cache.scale, -(job.y - bleed) * cache.scale);
paint(c, job.x - bleed, job.y - bleed, job.art.width / cache.scale, job.art.height / cache.scale, job.key);
c.restore();
job.band++;
return job.band >= (job.bands || BANDS_SLOW);
}
function commit(cache, job) {
const n = Math.ceil(cache.size * cache.scale) + 4,
old = cache.tiles.get(job.key);
if (old) cache.bytes -= old.bytes;
const t = { key: job.key, x: job.x, y: job.y, art: job.art, bytes: n * n * 4, dirty: false };
cache.tiles.delete(job.key);
cache.tiles.set(job.key, t);
cache.bytes += t.bytes;
return t;
}
function axisWindow(pos, size, vel, c0, c1) {
if (Math.abs(vel) < 1e-6) return pos < c1 && pos + size > c0 ? [0, Infinity] : null;
let t0 = (c0 - size - pos) / vel,
t1 = (c1 - pos) / vel;
if (vel < 0) {
const s = t0;
t0 = t1;
t1 = s;
}
t0 = Math.max(0, t0);
return t1 > t0 ? [t0, t1] : null;
}
function reusable(cache, keep, size, take) {
const want = cache.wanted566;
for (const [k, t] of cache.tiles) {
if (!t.art || want.has(k) || t.art.width !== size || t.art.height !== size) continue;
const c = k.split(',');
if (keep(+c[0], +c[1])) continue;
if (!take) return true;
cache.tiles.delete(k);
cache.bytes -= t.bytes;
return t.art;
}
return take ? null : false;
}
function lookAhead(cache, st, x, y, w, h, v, paint, started, performance) {
const n = cache.size,
rect = cache.visibleCells614,
z = cache.scale,
size = Math.ceil(n * z) + 4,
bytes = size * size * 4,
reach = LOOK_FRAMES,
lx0 = Math.floor(Math.min(x, x + v.x * reach) / n),
lx1 = Math.floor((Math.max(x, x + v.x * reach) + w - 0.001) / n),
ly0 = Math.floor(Math.min(y, y + v.y * reach) / n),
ly1 = Math.floor((Math.max(y, y + v.y * reach) + h - 0.001) / n);
const inRing = (gx, gy) => gx >= rect.x0 - 1 && gx <= rect.x1 + 1 && gy >= rect.y0 - 1 && gy <= rect.y1 + 1;
const entry = (gx, gy) => {
const X = axisWindow(x, w, v.x, gx * n, gx * n + n),
Y = axisWindow(y, h, v.y, gy * n, gy * n + n);
if (!X || !Y) return Infinity;
const t0 = Math.max(X[0], Y[0]);
return t0 < Math.min(X[1], Y[1]) ? t0 : Infinity;
};
const keep = (gx, gy) => inRing(gx, gy) || (gx >= lx0 && gx <= lx1 && gy >= ly0 && gy <= ly1 && entry(gx, gy) <= reach);
let done = 0;
while (done < FAST_TILES && performance.now() - started < FAST_GATE_MS) {
let job = cache.edgeJobBN;
if (job) {
const have = cache.tiles.get(job.key);
if ((have && !have.dirty) || !keep(job.gx, job.gy)) {
st.dropped++;
job = cache.edgeJobBN = null;
}
}
if (!job) {
let best = null,
score = Infinity;
for (let gy = Math.min(ly0, rect.y0 - 1); gy <= Math.max(ly1, rect.y1 + 1); gy++)
for (let gx = Math.min(lx0, rect.x0 - 1); gx <= Math.max(lx1, rect.x1 + 1); gx++) {
const t = cache.tiles.get(gx + ',' + gy);
if (t && !t.dirty) continue;
const e = entry(gx, gy);
if (e > reach) continue;
if (e < score) {
score = e;
best = { gx, gy };
}
}
if (!best) {
st.noBest++;
return;
}
if (cache.bytes + bytes > cache.budget && !reusable(cache, keep, size, false)) {
st.budget++;
return;
}
const reuse = cache.bytes + bytes > cache.budget ? reusable(cache, keep, size, true) : null;
job = cache.edgeJobBN = {
key: best.gx + ',' + best.gy,
gx: best.gx,
gy: best.gy,
x: best.gx * n,
y: best.gy * n,
art: null,
band: 0,
reuse,
bands: 1,
};
st.lookStarted = (st.lookStarted || 0) + 1;
}
st.bands++;
if (job.band === 0 && !job.art) st.started++;
if (stepBand(cache, job, paint)) {
st.commits++;
st.lookCommits = (st.lookCommits || 0) + 1;
cache.edgeJobBN = null;
commit(cache, job);
done++;
}
}
}
module.exports = function (x, y, w, h, paint, started, wxRuntime, performance) {
const st =
this.prefStatsBN ||
(this.prefStatsBN = {
calls: 0,
noPrev: 0,
gate: 0,
jump: 0,
noBest: 0,
budget: 0,
started: 0,
bands: 0,
commits: 0,
dropped: 0,
});
st.calls++;
const prev = this.edgeView200;
this.edgeView200 = { x, y, w, h };
const rect = this.visibleCells614,
n = this.size;
if (!rect || !prev || Math.abs(prev.w - w) > 0.01 || Math.abs(prev.h - h) > 0.01) {
st.noPrev++;
this.edgeJobBN = null;
this.edgeVelBN = null;
return;
}
const dx = x - prev.x,
dy = y - prev.y;
if (Math.abs(dx) > n || Math.abs(dy) > n) {
st.jump++;
this.edgeJobBN = null;
this.edgeVelBN = null;
return;
}
const vel = this.edgeVelBN || (this.edgeVelBN = { x: dx, y: dy });
vel.x = vel.x * 0.6 + dx * 0.4;
vel.y = vel.y * 0.6 + dy * 0.4;
if (Math.hypot(vel.x, vel.y) > FAST_SPEED) {
if (performance.now() - started >= FAST_GATE_MS) {
st.gate++;
return;
}
lookAhead(this, st, x, y, w, h, vel, paint, started, performance);
return;
}
if (performance.now() - started >= 2) {
st.gate++;
return;
}
const inRing = (gx, gy) =>
gx >= rect.x0 - 1 &&
gx <= rect.x1 + 1 &&
gy >= rect.y0 - 1 &&
gy <= rect.y1 + 1 &&
!(gx >= rect.x0 && gx <= rect.x1 && gy >= rect.y0 && gy <= rect.y1);
let job = this.edgeJobBN;
if (job) {
const have = this.tiles.get(job.key);
if ((have && !have.dirty) || !inRing(job.gx, job.gy)) {
st.dropped++;
job = this.edgeJobBN = null;
}
}
if (!job) {
const mv = Math.hypot(dx, dy),
ux = mv > 0.01 ? dx / mv : 0,
uy = mv > 0.01 ? dy / mv : 0,
cx = x + w / 2,
cy = y + h / 2;
let best = null,
score = Infinity;
for (let gy = rect.y0 - 1; gy <= rect.y1 + 1; gy++)
for (let gx = rect.x0 - 1; gx <= rect.x1 + 1; gx++) {
if (!inRing(gx, gy)) continue;
const t = this.tiles.get(gx + ',' + gy);
if (t && !t.dirty) continue;
const tx = gx * n + n / 2 - cx,
ty = gy * n + n / 2 - cy,
s = Math.hypot(tx, ty) - (tx * ux + ty * uy) * 0.9;
if (s < score) {
score = s;
best = { gx, gy };
}
}
if (!best) {
st.noBest++;
return;
}
const z = this.scale,
size = Math.ceil(n * z) + 4,
bytes = size * size * 4;
if (this.bytes + bytes > this.budget && !reusable(this, inRing, size, false)) {
st.budget++;
return;
}
const reuse = this.bytes + bytes > this.budget ? reusable(this, inRing, size, true) : null;
job = this.edgeJobBN = {
key: best.gx + ',' + best.gy,
gx: best.gx,
gy: best.gy,
x: best.gx * n,
y: best.gy * n,
art: null,
band: 0,
reuse,
bands: Math.hypot(dx, dy) > 3 ? BANDS_FAST : BANDS_SLOW,
};
}
st.bands++;
if (job.band === 0 && !job.art) st.started++;
if (stepBand(this, job, paint)) {
st.commits++;
this.edgeJobBN = null;
commit(this, job);
}
};
