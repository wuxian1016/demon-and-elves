'use strict';
// Browser (WebKit) port of the QA WeChat host: same wx surface, seeded Math.random, fake Date.now, manual RAF.
(function () {
  const HOST = 'wxfile://usr';
  function syncGet(url, binary) {
    const x = new XMLHttpRequest();
    x.open('GET', url, false);
    if (binary) x.overrideMimeType('text/plain; charset=x-user-defined');
    x.send();
    if (x.status !== 200 && x.status !== 0) { const e = Error('HTTP ' + x.status + ' ' + url); e.code = 'ENOENT'; throw e; }
    if (!binary) return x.responseText;
    const s = x.responseText, u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
    return u;
  }
  function syncSize(url) {
    const x = new XMLHttpRequest(); x.open('HEAD', url, false); x.send();
    if (x.status !== 200) { const e = Error('ENOENT ' + url); e.code = 'ENOENT'; throw e; }
    return +x.getResponseHeader('Content-Length') || 0;
  }
  function norm(p) { const out = []; for (const part of p.split('/')) { if (!part || part === '.') continue; if (part === '..') out.pop(); else out.push(part); } return out.join('/'); }
  function packageName(name) { const f = name.replace(/^\//, ''); if (f.split('/').some(p => p === '..' || p === '.')) throw Error('bad path ' + name); return f; }
  const SHADOW = ['window', 'document', 'self', 'navigator', 'location', 'performance', 'localStorage', 'sessionStorage', 'indexedDB', 'fetch', 'XMLHttpRequest', 'Image', 'HTMLCanvasElement', 'OffscreenCanvas', 'createImageBitmap', 'setInterval', 'clearInterval', 'queueMicrotask', 'TextDecoder', 'TextEncoder', 'URL', 'Blob', 'atob', 'btoa', 'structuredClone', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'addEventListener', 'removeEventListener', 'postMessage', 'screen', 'crypto', 'frames', 'parent', 'top', 'opener', 'alert', 'origin', 'history', 'getComputedStyle', 'matchMedia', 'DOMMatrix', 'Path2D', 'ImageData', 'Worker', 'MessageChannel', 'FileReader'];
  // macrotask yield that hidden-page timer throttling does not slow down
  const ch = new MessageChannel(), waiters = []; ch.port1.onmessage = () => { const w = waiters.shift(); if (w) w(); };
  const yieldTask = () => new Promise((r) => { waiters.push(r); ch.port2.postMessage(0); });
  window.yieldTaskBN = yieldTask;
  window.makeWebHost = function ({ base, width = 390, height = 844, seed = 150, clockStart = 1800000000000, pixelRatio = 3, onCanvas = null, con = console, det = false } = {}) {
    const ROOT = new URL(base, location.href).href;
    let now = clockStart, random = seed;
    const math = Object.create(Math);
    math.random = () => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) / 4294967296);
    const RealDate = Date;
    class HostDate extends RealDate { static now() { return now === null ? RealDate.now() : Math.floor(now); } }
    const keys = Object.create(null);
    const files = new Map(), dirs = new Set(['']);
    const events = new Map(), raf = new Map(), timers = new Set();
    let serial = 0, visible = true;
    const manifest = JSON.parse(syncGet(ROOT + 'game.json'));
    const packages = new Map(manifest.subpackages.map(p => [p.name, p.root + 'game.js']));
    const get = key => (key in keys ? JSON.parse(keys[key]) : '');
    const put = (key, data) => { keys[key] = JSON.stringify(data); };
    const remove = key => { delete keys[key]; };
    const signal = (o, errMsg) => o.fail?.({ errMsg });
    const run = (o, fn) => { let r; try { r = fn(); } catch (e) { signal(o, String(e)); return; } o.success?.(r || {}); };
    const isUser = n => n === HOST || n.startsWith(HOST + '/');
    const rel = n => (n === HOST ? '' : norm(n.slice(HOST.length + 1)));
    const enoent = n => { const e = Error('ENOENT: no such file or directory ' + n); e.code = 'ENOENT'; return e; };
    const toBytes = (data, enc) => (typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data.slice(0)) : new Uint8Array(data.buffer ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data));
    const stats = (size, dir) => ({ size, isDirectory: () => dir, isFile: () => !dir, mtimeMs: RealDate.now(), lastModifiedTime: Math.floor(RealDate.now() / 1000), mode: dir ? 16877 : 33188 });
    const nativeFiles = {
      mkdirSync(name) { if (!isUser(name)) throw Error('包内路径禁止写入'); const r = rel(name).split('/'); for (let i = 1; i <= r.length; i++) dirs.add(r.slice(0, i).join('/')); },
      statSync(name) {
        if (isUser(name)) { const r = rel(name); if (dirs.has(r)) return stats(0, true); if (files.has(r)) return stats(files.get(r).length, false); throw enoent(name); }
        return stats(syncSize(ROOT + packageName(name)), false);
      },
      stat(o) { run(o, () => ({ stats: this.statSync(o.path) })); },
      readdir(o) { run(o, () => { const r = rel(o.dirPath); if (!dirs.has(r)) throw enoent(o.dirPath); const pre = r ? r + '/' : ''; const out = new Set(); for (const k of [...files.keys(), ...dirs]) if (k.startsWith(pre) && k !== r) out.add(k.slice(pre.length).split('/')[0]); return { files: [...out] }; }); },
      readFile(o) {
        run(o, () => {
          let bytes;
          if (isUser(o.filePath)) { const r = rel(o.filePath); if (!files.has(r)) throw enoent(o.filePath); bytes = files.get(r); }
          else bytes = syncGet(ROOT + packageName(o.filePath), true);
          const start = o.position || 0, range = bytes.subarray(start, o.length === undefined ? bytes.length : start + o.length);
          return { data: o.encoding ? new TextDecoder().decode(range) : range.slice().buffer };
        });
      },
      writeFile(o) { if (!isUser(o.filePath)) return signal(o, 'Error: 包内路径禁止写入'); run(o, () => { files.set(rel(o.filePath), toBytes(o.data, o.encoding)); }); },
      appendFile(o) { run(o, () => { const r = rel(o.filePath), a = files.get(r) || new Uint8Array(0), b = toBytes(o.data, o.encoding), c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); files.set(r, c); }); },
      unlink(o) { run(o, () => { const r = rel(o.filePath); if (!files.delete(r)) throw enoent(o.filePath); }); },
      copyFile(o) { run(o, () => { const src = isUser(o.srcPath) ? files.get(rel(o.srcPath)) : syncGet(ROOT + packageName(o.srcPath), true); if (!src) throw enoent(o.srcPath); files.set(rel(o.destPath), src.slice()); }); },
    };
    let mainCanvas = null;
    function canvas() { const c = document.createElement('canvas'); c.width = width; c.height = height; if (!mainCanvas) { mainCanvas = c; c.id = 'main'; c.style.cssText = 'position:fixed;left:0;top:0;width:' + width + 'px;height:' + height + 'px'; document.body.appendChild(c); } onCanvas?.(c); return c; }
    const blobUrls = new Map();
    const pendingImgs = new Set(), readyQ = [];
    function image() {
      const img = new Image(); let name;
      const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (!det) {
        Object.defineProperty(img, 'src', { configurable: true, get() { return name; }, set(s) { name = s; if (!s) return; let url; if (isUser(s)) { const r = rel(s); const b = files.get(r); if (!b) { setTimeout(() => img.onerror?.({ errMsg: 'missing ' + s })); return; } url = blobUrls.get(r) || URL.createObjectURL(new Blob([b])); blobUrls.set(r, url); } else url = ROOT + packageName(s); d.set.call(img, url); } });
        return img;
      }
      // deterministic: game handlers are delivered only at flush(); the image reports 0x0/incomplete until then
      let gameLoad = null, gameError = null, token = 0, delivered = false, job = null;
      Object.defineProperty(img, 'onload', { configurable: true, get: () => gameLoad, set: (f) => { gameLoad = f; } });
      Object.defineProperty(img, 'onerror', { configurable: true, get: () => gameError, set: (f) => { gameError = f; } });
      img.addEventListener('load', () => { const j = job, my = token; if (!j) return; pendingImgs.delete(j); job = null; readyQ.push(() => { if (my !== token) return; delivered = true; gameLoad?.call(img); }); });
      img.addEventListener('error', (e) => { const j = job, my = token; if (!j) return; pendingImgs.delete(j); job = null; readyQ.push(() => { if (my === token) gameError?.call(img, e); }); });
      Object.defineProperty(img, 'src', { configurable: true, get() { return name; }, set(s) {
        name = s; const my = ++token; delivered = false; if (job) { pendingImgs.delete(job); job = null; } if (!s) return;
        let url; if (isUser(s)) { const r = rel(s); const b = files.get(r); if (!b) { readyQ.push(() => { if (my === token) gameError?.call(img, { errMsg: 'missing ' + s }); }); return; } url = blobUrls.get(r) || URL.createObjectURL(new Blob([b])); blobUrls.set(r, url); } else url = ROOT + packageName(s);
        job = {}; pendingImgs.add(job); d.set.call(img, url);
      } });
      return img;
    }
    const deny = n => { throw Error('unexpected WX backend/network call: ' + n); };
    const calls = { downloadFile: 0 };
    const wx = {
      env: { USER_DATA_PATH: HOST },
      getFileSystemManager: () => nativeFiles,
      getStorageSync: get, setStorageSync: put, removeStorageSync: remove,
      getStorage(o) { o.success?.({ data: get(o.key) }); o.complete?.({}); },
      setStorage(o) { try { put(o.key, o.data); } catch (e) { signal(o, String(e)); o.complete?.({}); return; } o.success?.({}); o.complete?.({}); },
      removeStorage(o) { remove(o.key); o.success?.({}); o.complete?.({}); },
      clearStorageSync: () => {}, getStorageInfoSync: () => ({ keys: Object.keys(keys) }),
      downloadFile: () => { calls.downloadFile++; },
      request: () => deny('request'), connectSocket: () => deny('connectSocket'),
      login: o => o.fail?.({ errMsg: 'offline WebKit host' }),
      getWindowInfo: () => ({ windowWidth: width, windowHeight: height, pixelRatio, safeArea: { top: 0, left: 0, right: width, bottom: height } }),
      getDeviceInfo: () => ({ model: 'WebKit QA harness', platform: 'mac' }),
      getAppBaseInfo: () => ({ SDKVersion: 'host' }),
      getAccountInfoSync: () => ({ miniProgram: { appId: JSON.parse(syncGet(ROOT + 'project.config.json')).appid } }),
      setClipboardData: o => o.success?.({}), showModal: () => {},
      createCanvas: canvas, createImage: image,
      loadSubpackage: o => { (det ? (f) => queueMicrotask(f) : (f) => setTimeout(f))(() => { if (!packages.has(o.name)) return signal(o, 'unknown package'); try { load(packages.get(o.name)); } catch (e) { signal(o, String(e.stack || e)); return; } o.success?.({}); }); return { onProgressUpdate() {} }; },
    };
    for (const name of ['Hide', 'Show', 'MemoryWarning', 'Error', 'UnhandledRejection', 'TouchStart', 'TouchMove', 'TouchEnd', 'TouchCancel', 'WindowResize', 'DeviceOrientationChange']) {
      wx['on' + name] = fn => events.set(name, [...(events.get(name) || []), fn]);
      wx['off' + name] = fn => events.set(name, (events.get(name) || []).filter(l => l !== fn));
    }
    const vtimers = new Set(); let vseq = 0;
    const st = (fn, ms) => { if (det) { const h = { due: now + Math.max(0, +ms || 0), seq: ++vseq, fn }; vtimers.add(h); return h; } const h = setTimeout(() => { timers.delete(h); fn(); }, ms); timers.add(h); return h; };
    const ct = h => { if (det) { vtimers.delete(h); return; } clearTimeout(h); timers.delete(h); };
    const fireVirtual = () => { if (!det) return; for (let guard = 0; guard < 10000; guard++) { let next = null; for (const h of vtimers) if (h.due <= now && (!next || h.due < next.due || (h.due === next.due && h.seq < next.seq))) next = h; if (!next) break; vtimers.delete(next); next.fn(); } };
    const rafFn = fn => { const id = ++serial; raf.set(id, fn); return id; };
    const cafFn = id => raf.delete(id);
    const G = { wx, console: con, Math: math, Date: HostDate, setTimeout: st, clearTimeout: ct, requestAnimationFrame: rafFn, cancelAnimationFrame: cafFn };
    G.GameGlobal = G; G.globalThis = G;
    const PARAMS = [...SHADOW, 'globalThis', 'GameGlobal', 'wx', 'console', 'Math', 'Date', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'];
    const modules = new Map();
    function load(file) {
      const key = norm(file);
      if (modules.has(key)) return modules.get(key).exports;
      const module = { exports: {} };
      modules.set(key, module);
      const dir = key.split('/').slice(0, -1).join('/');
      const localRequire = name => { if (!name.startsWith('.')) throw Error('require ' + name); const next = norm((dir ? dir + '/' : '') + name); return load(/\.[a-z0-9]+$/i.test(next.split('/').pop()) ? next : next + '.js'); };
      const src = syncGet(ROOT + key);
      let outer;
      try { outer = new Function(...PARAMS, 'return function (require, module, exports) {' + src + '\n};\n//# sourceURL=client/' + key); }
      catch (e) { throw Error('compile ' + key + ': ' + e.message); }
      outer(...SHADOW.map(() => undefined), G, G, wx, con, math, HostDate, st, ct, rafFn, cafFn)(localRequire, module, module.exports);
      return module.exports;
    }
    return {
      wx, keys, calls, modules,
      get mainCanvas() { return mainCanvas; },
      stored: () => new Proxy({}, { get: (_, k) => (k in keys ? JSON.parse(keys[k]) : undefined) }),
      advance(ms) { now = (now ?? RealDate.now()) + ms; fireVirtual(); },
      async flush() { for (let k = 0; pendingImgs.size && k < 200000; k++) await yieldTask(); while (readyQ.length) { const b = readyQ.splice(0); for (const f of b) f(); } },
      pendingImages: () => pendingImgs.size,
      now: () => now,
      pendingFrames: () => raf.size,
      start: () => load('game.js'),
      env: () => load('runtime.js'),
      emit(name, ev) { if (name === 'Hide') visible = false; if (name === 'Show') visible = true; for (const fn of events.get(name) || []) fn(ev); },
      frame() { if (!visible) return; const job = raf.entries().next().value; if (job) { raf.delete(job[0]); job[1](); } },
      close() { for (const h of timers) clearTimeout(h); timers.clear(); raf.clear(); },
    };
  };
})();
