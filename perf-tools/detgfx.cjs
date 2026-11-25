'use strict';
// Deterministic graphics for the QA host: image load/error callbacks are delivered only at flush() points
// (the harness calls flush at fixed frame counts and waits there for any decode still running), and the
// image reports itself incomplete (0x0) until delivery. Results then depend on frame counts, not machine speed.
module.exports = function makeDetGraphics(n, fs) {
  let main = null; const pending = new Set(), ready = [];
  const proto = n.Image.prototype, d = (k) => Object.getOwnPropertyDescriptor(proto, k);
  const srcD = d('src'), wD = d('width'), hD = d('height'), cD = d('complete'), nwD = d('naturalWidth'), nhD = d('naturalHeight');
  const graphics = {
    get main() { return main; },
    canvas(w, h) { const c = n.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); c.addEventListener = () => {}; c.removeEventListener = () => {}; if (!main) main = c; return c; },
    image(locate) {
      const i = new n.Image(); let name, gameLoad = null, gameError = null, token = 0, delivered = false, job = null;
      const nativeLoad = () => {}, nativeError = () => {};
      Object.defineProperty(i, 'onload', { configurable: true, get: () => i.__nl || null, set: (f) => { gameLoad = f; } });
      Object.defineProperty(i, 'onerror', { configurable: true, get: () => i.__ne || null, set: (f) => { gameError = f; } });
      const dims = (D) => ({ configurable: true, get() { return delivered && D ? D.get.call(i) : 0; } });
      Object.defineProperty(i, 'width', dims(wD)); Object.defineProperty(i, 'height', dims(hD));
      Object.defineProperty(i, 'naturalWidth', dims(nwD || wD)); Object.defineProperty(i, 'naturalHeight', dims(nhD || hD));
      Object.defineProperty(i, 'complete', { configurable: true, get() { return delivered; } });
      Object.defineProperty(i, 'src', { configurable: true, get() { return name; }, set(s) {
        name = s; const my = ++token; delivered = false; if (job) { pending.delete(job); job = null; } if (!s) return;
        let buf;
        try { buf = fs.readFileSync(locate(s)); } catch (e) { ready.push(() => { if (my === token) gameError?.call(i, e); }); return; }
        const mine = job = {}; pending.add(mine);
        i.__nl = () => { pending.delete(mine); ready.push(() => { if (my !== token) return; delivered = true; gameLoad?.call(i); }); };
        i.__ne = (e) => { pending.delete(mine); ready.push(() => { if (my === token) gameError?.call(i, e); }); };
        srcD.set.call(i, buf);
      } });
      return i;
    },
    async flush() {
      for (let k = 0; pending.size && k < 20000; k++) await new Promise((r) => setTimeout(r, 1));
      while (ready.length) { const batch = ready.splice(0); for (const f of batch) f(); }
    },
    pendingCount: () => pending.size,
  };
  return graphics;
};
