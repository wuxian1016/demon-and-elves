'use strict';
const {InputViewLatency}=require('./input-view-latency');
const {readRuntimeMode}=require('./runtime-mode-flags');
// Bounded, in-memory observations. No timers, requests, identity, payload or storage.
// Draw intervals are JS completed-draw cadence, not GPU/display FPS.
const LIMITS=[1,5,10,16.67,20,25,30,33.34,50,75,100,150,250,500,1000,3000,8000,15000];
const METRICS=['inputCommitJsMs','inputToConfirmedViewDrawMs','heartbeatMs','socketRttMs','socketProbeServerWorkMs','commandAckMs','acceptedCommandAckMs','inputQueueMs','inputRequestMs','inputServerElapsedMs','inputServerWorkerQueueMs','inputServerWorkerWorkMs','inputServerWorkerReturnMs','inputFailureMs','snapshotGapMs','snapshotRequestMs','localFeedbackMs','stickIntentToDrawMs','drawJsMs','packetJsMs','uiTaskMs','uiCommitLatencyMs','snapshotAgeMs'];
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const rounded=x=>Math.round(x*100)/100;
function histogram(){return {count:0,total:0,max:0,bins:Array(LIMITS.length+1).fill(0)};}
function add(h,value){if(!number(value))return;h.count++;h.total+=value;h.max=Math.max(h.max,value);const i=LIMITS.findIndex(x=>value<=x);h.bins[i<0?LIMITS.length:i]++;}
function summarize(h){const bound=p=>{let cumulative=0;for(let i=0;i<h.bins.length;i++){cumulative+=h.bins[i];if(h.count&&cumulative>=Math.ceil(h.count*p))return LIMITS[i]??null;}return null;};const above=limit=>{const index=LIMITS.indexOf(limit),count=h.bins.slice(index+1).reduce((a,b)=>a+b,0);return {count,percent:h.count?rounded(count*100/h.count):null};};return {count:h.count,meanMs:h.count?rounded(h.total/h.count):null,maxMs:h.count?rounded(h.max):null,p50UpperBoundMs:bound(.5),p95UpperBoundMs:bound(.95),p99UpperBoundMs:bound(.99),over30ms:above(30),over50ms:above(50),over100ms:above(100),aboveLargestBucket:h.bins[LIMITS.length]};}
function runtimeMetadata(wx){let info={};try{info=wx?.getSystemInfoSync?.()||{};}catch(_){}const version=v=>typeof v==='string'&&/^\d+(?:\.\d+){1,4}(?:[-a-zA-Z0-9.]*)?$/.test(v)&&v.length<=40?v:null;return {wechatVersion:version(info.version),baseLibraryVersion:version(info.SDKVersion),platform:['ios','android','devtools'].includes(info.platform)?info.platform:null,...readRuntimeMode()};}
class LongRunDiagnostics{
 constructor({clock=()=>Date.now(),wallClock=()=>Date.now(),wx}={}){this.clock=clock;this.wallClock=wallClock;this.runtime=runtimeMetadata(wx);this.reset();}
 reset(){this.runId=(this.runId||0)+1;this.started=this.clock();this.startedAtMs=this.wallClock();this.lastFrame=null;this.lastState=null;this.hasObservedBinding=false;this.awaitingObservedRecovery=false;this.lastFailure=null;this.lastFailureAt=null;this.metrics=Object.fromEntries(METRICS.map(k=>[k,histogram()]));this.inputViews=new InputViewLatency((key,value)=>this.recordMetric(key,value),(command,at)=>this.onConfirmedView?.(command,at));this.frameGaps=histogram();this.frames=0;this.excludedFrames=0;this.frameIntervals=0;this.frameElapsed=0;this.gapsOver50=0;this.transportCounts={socket:0,http:0};this.connection={samples:0,readyBoundSamples:0,readyUnboundSamples:0,notReadySamples:0,observedLosses:0,observedRecoveries:0,initialBindings:0,bindingsAfterUnobservedGap:0};this.inputs={accepted:0,rejected:0,failed:0};this.lifecycle={hidden:0,shown:0};this.events=[];this.minuteRows=[];}
 queuedInput(command,at,runId=this.runId){if(runId===this.runId)this.inputViews.queued(command,at);}
 confirmedInput(command,receipt,runId=this.runId){if(runId===this.runId)this.inputViews.receipt(command,receipt);}
 failedInput(command,runId=this.runId){if(runId===this.runId)this.inputViews.failed(command);}
 appliedView(packet){this.inputViews.appliedView(packet);}
 recordMetric(key,value){const h=this.metrics[key];if(h)add(h,value);}
 transport(kind){if(kind==='socket'||kind==='http')this.transportCounts[kind]++;}
 inputReceipt(accepted,ms,runId=this.runId){if(runId!==this.runId)return;if(accepted===true){this.inputs.accepted++;this.recordMetric('acceptedCommandAckMs',ms);}else this.inputs.rejected++;}
 inputFailed(runId=this.runId){if(runId===this.runId)this.inputs.failed++;}
 event(kind,at,extra={}){this.events.push({kind,elapsedMs:Math.max(0,Math.round(at-this.started)),...extra});if(this.events.length>32)this.events.shift();}
 boundary(kind){this.lastFrame=null;this.lastState=null;if(kind==='hidden'||kind==='shown'){this.lifecycle[kind]++;this.event(kind,this.clock());}}
 observeConnection({socketReady,socketBound,closeCode,failureRecordedAtMs}={},at=this.clock()){
  if(typeof socketReady!=='boolean'||typeof socketBound!=='boolean')return;
  const state=!socketReady?'notReady':socketBound?'readyBound':'readyUnbound';this.connection.samples++;this.connection[state+'Samples']++;
  if(this.lastState!==null&&state!==this.lastState){if(this.lastState==='readyBound'&&state!=='readyBound'){this.connection.observedLosses++;this.awaitingObservedRecovery=true;}this.event('connection-state',at,{state});}
  if(state==='readyBound'&&this.lastState!=='readyBound'){
   if(!this.hasObservedBinding){this.connection.initialBindings++;this.hasObservedBinding=true;}
   else if(this.awaitingObservedRecovery){this.connection.observedRecoveries++;}
   else this.connection.bindingsAfterUnobservedGap++;
   this.awaitingObservedRecovery=false;
  }this.lastState=state;
  if(Number.isSafeInteger(failureRecordedAtMs)&&failureRecordedAtMs>=0&&failureRecordedAtMs!==this.lastFailureAt&&Number.isInteger(closeCode)&&closeCode>=0&&closeCode<=65535){this.lastFailureAt=failureRecordedAtMs;this.lastFailure=closeCode;this.event('socket-failure-observed',at,{closeCode});}
 }
 frame(at,{eligible=false,drawJsMs,snapshotAgeMs,viewEpoch,viewRevision,...connection}={}){
  this.observeConnection(connection,at);
  if(!eligible){this.excludedFrames++;this.lastFrame=null;return;}
  this.inputViews.drawn({epoch:viewEpoch,revision:viewRevision},at);this.frames++;this.recordMetric('drawJsMs',drawJsMs);this.recordMetric('snapshotAgeMs',snapshotAgeMs);
  const minute=Math.max(0,Math.floor((at-this.started)/60000));let row=this.minuteRows[this.minuteRows.length-1];if(!row||row.minute!==minute){row={minute,frames:0,intervals:0,elapsedMs:0,maxGapMs:0,over50:0};this.minuteRows.push(row);if(this.minuteRows.length>60)this.minuteRows.shift();}row.frames++;
  if(this.lastFrame!==null&&number(at-this.lastFrame)){const gap=at-this.lastFrame;add(this.frameGaps,gap);this.frameIntervals++;this.frameElapsed+=gap;row.intervals++;row.elapsedMs+=gap;row.maxGapMs=Math.max(row.maxGapMs,gap);if(gap>50){this.gapsOver50++;row.over50++;}}
  this.lastFrame=at;
 }
 export(connection){this.observeConnection(connection);return {schema:1,kind:'fullgame-long-run-observations',startedAtMs:this.startedAtMs,exportedAtMs:this.wallClock(),elapsedMs:Math.max(0,Math.round(this.clock()-this.started)),runtime:{...this.runtime,...readRuntimeMode()},frames:{completedEligible:this.frames,excluded:this.excludedFrames,intervals:this.frameIntervals,measuredIntervalMs:rounded(this.frameElapsed),completedDrawCadenceFps:this.frameElapsed>0?rounded(this.frameIntervals*1000/this.frameElapsed):null,gapsOver50:this.gapsOver50,gaps:summarize(this.frameGaps)},metrics:Object.fromEntries(METRICS.filter(k=>this.metrics[k].count).map(k=>[k,summarize(this.metrics[k])])),transportCounts:{...this.transportCounts},connection:{...this.connection,lastObservedCloseCode:this.lastFailure},inputs:{...this.inputs},inputViewLatency:this.inputViews.report(),lifecycle:{...this.lifecycle},events:this.events.map(e=>({...e})),recentMinutes:this.minuteRows.map(r=>({...r,elapsedMs:rounded(r.elapsedMs),maxGapMs:rounded(r.maxGapMs)})),interpretation:{percentiles:'fixed histogram upper bounds; null if no sample or overflow',frameScope:'consecutive completed original-game draws with eligible states observed at frame boundaries',runtimeMode:'Boolean values are observed official GameGlobal runtime flags; unknown means unavailable. Package label/configuration is not runtime proof.',connection:'initial binding, observed loss/rebinding and binding after observation gap separated; sampled states are not proof of uninterrupted transport',transport:'completed battle input RPCs only; excludes health, heartbeat and snapshot-only calls',latency:'acceptedCommandAckMs is local enqueue-to-business-accepted receipt; localFeedbackMs is separate',thermal:'not measured',gpuDisplayFps:'not measured'}};}
}
module.exports={LongRunDiagnostics,runtimeMetadata};
