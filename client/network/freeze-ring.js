'use strict';

// Install in a QA-only copy. Caller passes a single monotonically increasing clock.
const Phase = Object.freeze({
  rafEnter:1, rafExit:2, updateEnter:3, updateExit:4, wavesEnter:5, wavesExit:6,
  drawEnter:7, drawExit:8, touchEnter:9, touchExit:10,
  saveEnter:11, saveProgress:12, ioRequest:13, ioCallback:14, saveExit:15,
  stoneHandoffEnter:16, stoneHandoffExit:17, cardTickEnter:18, cardTickExit:19,
  hidden:20, shown:21, memoryEnter:22, memoryExit:23, frameError:24,
  loopWaiting:25, watchdogGap:26, updateStage:27
});
function makeFreezeRing({capacity=256, gapMs=1000}={}) {
  const time = new Float64Array(capacity);
  const frame = new Uint32Array(capacity);
  const phase = new Uint8Array(capacity);
  const arg = new Uint32Array(capacity);
  const cutTime = new Float64Array(capacity);
  const cutFrame = new Uint32Array(capacity);
  const cutPhase = new Uint8Array(capacity);
  const cutArg = new Uint32Array(capacity);
  let cutSeq=0, cutCount=0, armedAt=NaN;
  let seq=0, currentFrame=0, lastRaf=NaN, lastExit=NaN, lastWatch=NaN, inRaf=false;
  let firstFault=null, firstGap=null, watchdogArmed=false;

  function mark(id, at, value=0) {
    const i=seq++%capacity;
    time[i]=at;
    frame[i]=currentFrame;
    phase[i]=id;
    arg[i]=value;
  }

  function preserve() {
    if (cutSeq) return;
    cutSeq=seq;
    cutCount=Math.min(capacity,seq);
    for(let i=0;i<cutCount;i++) {
      const slot=(seq-cutCount+i)%capacity;
      cutTime[i]=time[slot];
      cutFrame[i]=frame[slot];
      cutPhase[i]=phase[slot];
      cutArg[i]=arg[slot];
    }
  }

  function beginRaf(at) {
    currentFrame++;
    inRaf=true;
    lastRaf=at;
    mark(Phase.rafEnter,at);
  }

  function finishRaf(at, flags) {
    inRaf=false;
    lastExit=at;
    mark(Phase.rafExit,at,flags);
  }

  // flags are caller-defined numeric gate state; commit this before optional metrics.
  function fault(at, trigger, error, flags=0) {
    mark(Phase.frameError,at,flags);
    if(firstFault!==null)return;
    let stack='[stack unavailable]';
    try { stack=String(error?.stack || error?.message || error || '').slice(0,2048); } catch (_) {}
    firstFault={sequence:seq,frame:currentFrame,at,trigger,stack,flags};
    preserve();
    return firstFault;
  }

  // Invoke only from a local QA timer. Gate intentional pause/hide/loading explicitly.
  function observe(at, eligible, flags=0) {
    const heartbeatGap = Number.isFinite(lastWatch) ? at-lastWatch : null;
    lastWatch=at;
    if(!eligible){watchdogArmed=false;return;}
    if(!watchdogArmed){watchdogArmed=true;armedAt=at;return;}
    if(firstGap || !Number.isFinite(lastExit) || at-Math.max(lastExit,armedAt)<gapMs)return;
    mark(Phase.watchdogGap,at,flags);
    firstGap={sequence:seq,frame:currentFrame,at,heartbeatGap,lastRaf,lastExit,inRaf,flags};
    preserve();
    return firstGap;
  }

  function recent(limit) {
    const rows=[];
    for(let n=Math.max(0,seq-Math.min(capacity,limit));n<seq;n++){
      const i=n%capacity;
      rows.push([n+1,Math.round(time[i]),frame[i],phase[i],arg[i]]);
    }
    return rows;
  }

  // Allocate export rows only at a diagnostic checkpoint or manual export.
  function snapshot() {
    const rows=[];
    for(let n=Math.max(0,seq-capacity);n<seq;n++){
      const i=n%capacity;
      rows.push([n+1,time[i],frame[i],phase[i],arg[i]]);
    }
    const firstTrail=[];
    for(let i=0;i<cutCount;i++)firstTrail.push([cutSeq-cutCount+i+1,cutTime[i],cutFrame[i],cutPhase[i],cutArg[i]]);
    return {firstTrail,sequence:seq,rolled:Math.max(0,seq-capacity),rows,
      firstFault:firstFault&&{...firstFault},firstGap:firstGap&&{...firstGap}};
  }
  return {mark,beginRaf,finishRaf,fault,observe,snapshot,recent,
    hasFault:()=>firstFault!==null,abortRaf:()=>{inRaf=false;}};
}
module.exports={Phase,makeFreezeRing};
