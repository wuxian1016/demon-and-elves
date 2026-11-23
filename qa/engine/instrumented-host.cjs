'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {imageSize} = require('image-size');

const HOST = 'wxfile://usr';
const PREFIX = 'forest:c3-freeze-qa:v2:';
const DIRECTORY = HOST + '/forest-c3-freeze-qa-v2';
const INDEX = 'demon-and-elves.wx.slots.v1';
const STARTUP = 'forest-startup-diagnostics-v1';
const JOURNAL = 'forest-qa-freeze-journal-v1';
const LEGACY = 'demon-and-elves.save.v1';
const SETTINGS = 'demon-and-elves.settings.v1';
const BUILD = 'BN19R10-C3-INT-R3-QAFREEZE2';
const signal = (options, errMsg) => options.fail?.({errMsg});
const delay = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
const noop = () => {};

function packageName(name) {
  const file = name.replace(/^\//, '');
  assert.match(file, /^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/);
  assert(!file.split('/').some(part => part === '..' || part === '.'));
  return file;
}

function makeHost(root,disk,expectQa=true,{width=414,height=896,seed=150,keyPrefix=PREFIX,userDir=DIRECTORY,graphics=null,clockStart=null}={}) {
  let now=clockStart, random=seed;
  const math=Object.create(Math);
  math.random=()=>((random=(Math.imul(random,1664525)+1013904223)>>>0)/4294967296);
  class HostDate extends Date {static now(){return now===null?Date.now():Math.floor(now);}}
  const keys = path.join(disk, 'keys.json');
  const log = path.join(disk, 'access.jsonl');
  const userRoot = path.join(disk, 'files');
  const access = [];
  const events = new Map(), raf = new Map(), timers = new Set();
  const notices = [];
  let serial = 0, clipboard, nextWrite, nextStorageFailure = null, visible = true;
  let setCrashPoint;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game.json'), 'utf8'));
  const packages = new Map(manifest.subpackages.map(pack => [pack.name, pack.root + 'game.js']));
  const report = (action, target) => {
    access.push([action, target]);
    if (expectQa && !(
      target.startsWith(keyPrefix) || target === userDir || target.startsWith(userDir + '/') ||
      (action.startsWith('package:') && !target.startsWith(HOST))
    )) {
      fs.appendFileSync(log, JSON.stringify({action, target}) + '\n');
      throw Error('测试客户端接触了普通命名空间：' + action + ' ' + target);
    }
  };
  const stored = () => JSON.parse(fs.readFileSync(keys, 'utf8'));
  const putKeys = value => {
    const tmp = keys + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, keys);
  };
  const get = key => { report('key:read', key); return stored()[key] ?? ''; };
  const put = (key, data) => {
    report('key:write', key);
    if (key === nextStorageFailure) {
      nextStorageFailure = null;
      throw Error('fixture: index publish failure');
    }
    putKeys({...stored(), [key]: data});
  };
  const remove = key => {
    report('key:remove', key);
    const values = stored();
    delete values[key];
    putKeys(values);
  };
  const filePath = (name, action) => {
    if (name === HOST || name.startsWith(HOST + '/')) {
      report(action, name);
      const relative = name === HOST ? '' : packageName(name.slice(HOST.length + 1));
      return path.join(userRoot, relative);
    }
    if (action !== 'file:read' && action !== 'file:stat') throw Error('包内路径禁止写入');
    report('package:' + action, name);
    return path.join(root, packageName(name));
  };
  const run = (options, fn) => {
    let result;
    try { result = fn(); } catch (error) { signal(options, String(error)); return; }
    options.success?.(result || {});
  };
  function crash(target) {
    fs.appendFileSync(path.join(disk, 'crash.jsonl'), JSON.stringify({
      point:setCrashPoint, target, publishedIndex:stored()[keyPrefix + INDEX]
    }) + '\n');
    process.kill(process.pid, 'SIGKILL');
  }
  const nativeFiles = {
    mkdirSync(name) {
      const target = filePath(name, 'file:mkdir');
      fs.mkdirSync(target, {recursive:true});
    },
    statSync(name) { return fs.statSync(filePath(name, 'file:stat')); },
    stat(options) { run(options, () => ({stats: this.statSync(options.path)})); },
    readdir(options) {
      run(options, () => ({files: fs.readdirSync(filePath(options.dirPath, 'file:list'))}));
    },
    readFile(options) {
      run(options, () => {
        const bytes = fs.readFileSync(filePath(options.filePath, 'file:read'));
        const start = options.position || 0;
        const range = bytes.subarray(start, options.length === undefined ? bytes.length : start + options.length);
        return {data: options.encoding ? range.toString(options.encoding) : Uint8Array.from(range).buffer};
      });
    },
    writeFile(options) {
      let target;
      const match = options.filePath.startsWith(userDir + '/forest-saves-v1/');
      try { target = filePath(options.filePath, 'file:write'); } catch (error) { signal(options, String(error)); return; }
      const persist = () => fs.writeFileSync(target, options.data, options.encoding);
      if (match && ['before-file','after-file'].includes(setCrashPoint)) {
        if (setCrashPoint === 'after-file') persist();
        crash(options.filePath);
        return;
      }
      const pending = match ? nextWrite : null;
      if (pending) {
        nextWrite = null;
        pending.arrive(() => run(options, persist));
      } else run(options, persist);
    },
    appendFile(options) {
      run(options, () => fs.appendFileSync(filePath(options.filePath, 'file:append'), options.data, options.encoding));
    },
    unlink(options) {
      if (setCrashPoint === 'after-index' && options.filePath.startsWith(userDir + '/forest-saves-v1/')) {
        crash(options.filePath);
        return;
      }
      run(options, () => fs.unlinkSync(filePath(options.filePath, 'file:remove')));
    },
    copyFile(options) {
      run(options, () => fs.copyFileSync(filePath(options.srcPath, 'file:read'), filePath(options.destPath, 'file:write')));
    }
  };

  function canvas() {
    if (graphics) return graphics.canvas(width, height);
    const surface = {width,height};
    const context = new Proxy({canvas:surface}, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return text => ({width:Array.from(String(text)).length * 8});
        if (key === 'getImageData') return (_x, _y, w, h) => ({data:new Uint8ClampedArray(w * h * 4)});
        if (key === 'createImageData') return (w,h) => ({data:new Uint8ClampedArray(w * h * 4)});
        if (key.startsWith?.('create') && key.endsWith('Gradient')) return () => ({addColorStop:noop});
        if (key === 'getTransform') return () => ({a:1,b:0,c:0,d:1,e:0,f:0});
        return noop;
      }
    });
    return Object.assign(surface,{getContext:()=>context, addEventListener:noop, removeEventListener:noop});
  }

  function denyBackend(name){console.error(new Error('unexpected WX backend/network call: '+name).stack);process.exitCode=91;throw Error('unexpected WX backend/network call: '+name);}
  const wx = {
    env:{USER_DATA_PATH:HOST},
    getFileSystemManager:()=>nativeFiles,
    getStorageSync:get,
    setStorageSync:put,
    removeStorageSync:remove,
    getStorage(options) { options.success?.({data:get(options.key)}); options.complete?.({}); },
    setStorage(options) {
      try { put(options.key, options.data); } catch (error) { signal(options, String(error)); options.complete?.({}); return; }
      options.success?.({});
      options.complete?.({});
    },
    removeStorage(options) { remove(options.key); options.success?.({}); options.complete?.({}); },
    clearStorageSync:() => report('key:clear','native-all'),
    getStorageInfoSync:() => report('key:list','native-all'),
    downloadFile:() => { if (!new Error().stack.includes('/runtime.js:')) return denyBackend('downloadFile'); if(expectQa) report('network:download','network'); },
    request:() => denyBackend('request'),
    connectSocket:() => denyBackend('connectSocket'),
    login:options => options.fail?.({errMsg:'offline Mac host'}),
    getWindowInfo:()=>({windowWidth:width,windowHeight:height,pixelRatio:1,safeArea:{top:0,left:0,right:width,bottom:height}}),
    getDeviceInfo:() => ({model:'Mac QA harness',platform:'mac'}),
    getAppBaseInfo:() => ({SDKVersion:'host'}),
    getAccountInfoSync:() => ({miniProgram:{appId:JSON.parse(fs.readFileSync(path.join(root,'project.config.json'))).appid}}),
    setClipboardData:options => {clipboard=options.data; options.success?.({});},
    showModal:options => notices.push(options),
    createCanvas:canvas,
    createImage:() => {
      const locate=name=>name.startsWith(HOST + '/') ? filePath(name, 'file:read') : path.join(root, packageName(name));
      if (graphics) return graphics.image(locate);
      let source;
      return {width:1024,height:1024,get src(){return source;},set src(name){
        source=name;
        if (!name) return;
        try {
          const target = locate(name);
          const {width,height}=imageSize(fs.readFileSync(target));
          Object.assign(this,{width,height});
          queueMicrotask(() => this.onload?.());
        } catch(error) {
          queueMicrotask(() => this.onerror?.({errMsg:'unreadable package asset ' + name + ': ' + error.message}));
        }
      }};
    },
    loadSubpackage:options => {
      queueMicrotask(() => {
        if (!packages.has(options.name)) return signal(options, 'unknown package');
        try { load(path.join(root,packages.get(options.name))); } catch (error) { signal(options,String(error.stack||error)); return; }
        options.success?.({});
      });
      return {onProgressUpdate:noop};
    }
  };
  for (const name of ['Hide','Show','MemoryWarning','Error','UnhandledRejection','TouchStart','TouchMove','TouchEnd','TouchCancel','WindowResize','DeviceOrientationChange']) {
    wx['on' + name] = fn => events.set(name, [...(events.get(name) || []), fn]);
    wx['off' + name] = fn => events.set(name,(events.get(name)||[]).filter(listener=>listener!==fn));
  }
  const box = vm.createContext({
    wx, console,Math:math,Date:HostDate,
    setTimeout(fn, ms) {
      const handle = setTimeout(() => { timers.delete(handle); fn(); }, ms);
      timers.add(handle);
      return handle;
    },
    clearTimeout(handle) { clearTimeout(handle); timers.delete(handle); },
    requestAnimationFrame(fn) { const id=++serial; raf.set(id,fn); return id; },
    cancelAnimationFrame:id => raf.delete(id)
  });
  vm.runInContext('globalThis.GameGlobal = globalThis;',box);
  const modules = new Map();
  function load(file) {
    const normalized = path.resolve(file);
    if (modules.has(normalized)) return modules.get(normalized).exports;
    const module = {exports:{}};
    modules.set(normalized, module);
    const localRequire = name => {
      assert(name.startsWith('.'), name);
      const next = path.resolve(path.dirname(normalized),name);
      return load(path.extname(next) ? next : next + '.js');
    };
    vm.runInContext('(function(require,module,exports){' + fs.readFileSync(normalized,'utf8') + '\n})',
      box,{filename:normalized,timeout:30000})(localRequire,module,module.exports);
    return module.exports;
  }
  return {
    access, notices, stored, wx, loaded:()=>[...modules.keys()], evaluate:load,
    advance(ms){now=(now??Date.now())+ms;},
    pendingFrames:()=>raf.size,
    get clipboard(){return clipboard;},
    start:() => load(path.join(root,'game.js')),
    env:() => load(path.join(root,'runtime.js')),
    failStorage:key => {nextStorageFailure=key;},
    crashAt:point => {setCrashPoint=point;},
    holdNextSave() { return new Promise(resolve => { nextWrite={arrive:resolve}; }); },
    emit(name, event) {
      if (name === 'Hide') visible=false;
      if (name === 'Show') visible=true;
      for(const fn of events.get(name)||[]) fn(event);
    },
    frame() {
      if (!visible) return;
      const job=raf.entries().next().value;
      if (job) { raf.delete(job[0]); job[1](); }
      assert(raf.size<=1,'一个待执行 RAF');
    },
    close(){ for(const handle of timers) clearTimeout(handle); timers.clear(); raf.clear(); }
  };
}

async function until(fn, label, timeout = 25000) {
  const end=Date.now()+timeout;
  while (Date.now()<end) {
    if (fn()) return;
    await delay(5);
  }
  throw Error('等待超时：' + label);
}

module.exports = {HOST,PREFIX,DIRECTORY,INDEX,STARTUP,JOURNAL,LEGACY,SETTINGS,BUILD,delay,makeHost,until};
