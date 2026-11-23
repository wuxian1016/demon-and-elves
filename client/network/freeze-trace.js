'use strict';

const {cleanText} = require('./diagnostic-file-export');
const {Phase, makeFreezeRing} = require('./freeze-ring');

const Flags = Object.freeze({
  activeGame: 1, hidden: 2, menu: 4, loading: 8, waitingNetwork: 16,
  pendingGameCallback: 32, pendingHostCallback: 64
});
const UpdateStages = Object.freeze({
  0:'before-waves', 1:'warning-and-targets', 2:'workers', 3:'allies-and-production',
  4:'vehicles', 5:'defense-towers', 6:'projectiles', 7:'demon', 8:'hostiles',
  9:'animation-and-base', 10:'wall-and-placement', 11:'clock-and-evolution',
  12:'rescue-and-outcome', 13:'particles-and-cleanup', 14:'after-main-update'
});
const safeText = value => cleanText(value).replace(/https?:[^\s)]+/g, '[URL]');
const paused = Flags.hidden | Flags.menu | Flags.loading | Flags.waitingNetwork;

const labelFor = (trigger, stage) => trigger === 'update' ? UpdateStages[stage] || 'unknown-update' : trigger;

function createFreezeTrace({clock, flags, schedule, cancel, journal, context}) {
  const ring = makeFreezeRing();
  let heartbeat = null, stage = 0, reportedInRaf = false;
  let completedAt = null, touchAt = null;
  let maxFrameMs = 0, slowFrames = 0, sampledFrames = 0, memoryWarnings = 0;

  function sample(value, at) {
    let scene = null;
    try { scene = context(); } catch (_) {}
    return {
      at: Math.round(at), flags: value, scene,
      lastFrame: completedAt === null ? null : Math.round(completedAt),
      lastTouch: touchAt === null ? null : Math.round(touchAt),
      frames: sampledFrames, slowFrames, memoryWarnings, maxFrameMs: Math.round(maxFrameMs),
      trail: ring.recent(24)
    };
  }

  function checkpoint(value, at) {
    const result = sample(value, at);
    maxFrameMs = slowFrames = sampledFrames = 0;
    return result;
  }
  const instrumented = new WeakSet();

  function observe() {
    heartbeat = null;
    const value = flags();
    const at = clock();
    const eligible = !!(value & Flags.activeGame) && !(value & paused);
    const gap = ring.observe(at, eligible, value);
    if (gap) journal.incident('gap', gap, sample(value, at));
    if (eligible && completedAt !== null && at - completedAt < 500) {
      journal.checkpoint(at, () => checkpoint(value, at));
    } else {
      journal.checkpoint(at, null);
    }
    if (value & Flags.activeGame && !(value & Flags.hidden)) {
      heartbeat = schedule(observe, 250);
    }
  }

  function arm() {
    if (heartbeat === null && flags() & Flags.activeGame) {
      heartbeat = schedule(observe, 250);
    }
  }

  function lifecycle(kind) {
    ring.mark(kind === 'hide' ? Phase.hidden : Phase.shown, clock(), flags());
    if (heartbeat !== null) cancel(heartbeat);
    heartbeat = null;
    ring.observe(clock(), false);
    if (kind === 'show') arm();
  }

  function fault(trigger, error, force = false) {
    const at = clock(), value = flags();
    if (!(value & Flags.activeGame)) {
      ring.mark(Phase.frameError, at, value);
      return;
    }
    if (trigger === 'update' && !ring.hasFault()) ring.mark(Phase.updateStage, at, stage);
    const first = ring.fault(at, trigger, error, value);
    if (first || force && !reportedInRaf) {
      reportedInRaf=true;
      let fallbackStack='';
      if(!first)try{fallbackStack=String(error?.stack||error?.message||error||'');}catch(_){}
      let name = 'Error', message = '[message unavailable]';
      try { if (typeof error?.name === 'string') name = safeText(error.name).slice(0, 80); } catch (_) {}
      try {
        const value = error?.message;
        if (typeof value === 'string' || typeof error === 'string') message = safeText(typeof value === 'string' ? value : error).slice(0, 320);
      } catch (_) {}
      journal.incident('fault', {
        ...(first||{sequence:null,frame:null,at,trigger,flags:value}), name, message, stage: labelFor(trigger, stage), stageId: trigger === 'update' ? stage : null,
        stack: safeText(first?.stack||fallbackStack).slice(0, 640)
      }, sample(value, at));
    }
  }

  function wrapFrame(original) {
    return function () {
      const started = clock();
      reportedInRaf=false;ring.beginRaf(started);
      arm();
      try {
        const result = arguments.length === 0 ? original.call(this) : original.apply(this, arguments);
        const finished = clock(), value = flags();
        ring.finishRaf(finished, value);
        if (value & Flags.activeGame && !(value & paused)) {
          completedAt = finished;
          const cost = finished - started;
          sampledFrames++;
          if (cost >= 25) slowFrames++;
          maxFrameMs = Math.max(cost, maxFrameMs);
        }
        return result;
      } catch (error) {
        if (!ring.hasFault()) fault('host-frame', error);
        ring.abortRaf();
        throw error;
      }
    };
  }

  function wrapPhase(original, enter, exit, label, value = 0) {
    return function (value0) {
      const at = clock();
      if (enter === Phase.touchEnter) touchAt = at;
      if (enter === Phase.updateEnter) stage = 0;
      ring.mark(enter, at, value);
      try {
        return arguments.length === 1 ? original.call(this, value0) : original.apply(this, arguments);
      } catch (error) {
        fault(label, error, true);
        throw error;
      } finally {
        ring.mark(exit, clock(), value);
      }
    };
  }

  function instrument(game) {
    if (!game || instrumented.has(game)) return;
    instrumented.add(game);
    for (const [name, enter, exit] of [
      ['update', Phase.updateEnter, Phase.updateExit],
      ['updateHoundWaves', Phase.wavesEnter, Phase.wavesExit],
      ['drawSmoothFrame', Phase.drawEnter, Phase.drawExit]
    ]) {
      if (typeof game[name] === 'function') game[name] = wrapPhase(game[name], enter, exit, name);
    }
  }

  return {
    fault, instrument, lifecycle, wrapFrame, persisted:journal.read,
    updateStage(id) {
      stage = id;
    },
    memoryWarning(level) {
      memoryWarnings++;
      ring.mark(Phase.memoryEnter, clock(), Number.isInteger(level) ? level : 0);
    },
    wrapTouch: (original, kind) => wrapPhase(
      original, Phase.touchEnter, Phase.touchExit, 'touch-' + kind,
      {start: 1, move: 2, end: 3, cancel: 4}[kind]
    ),
    snapshot: () => ({...ring.snapshot(), phaseIds: Phase, flagBits: Flags, updateStages: UpdateStages})
  };
}

module.exports = {createFreezeTrace, Flags};
