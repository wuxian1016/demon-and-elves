'use strict';
const {cleanClientRpc}=require('./socket-timing-fields');
const finite = n => Number.isFinite(n) && n >= 0;
const copyLoop = value => {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of ['samples','lastDelayMs','maxDelayMs','meanDelayMs','p95UpperBoundMs','p99UpperBoundMs','over30Ms','pendingTimerOverdueMs']) {
    if (value[key] === null || finite(value[key])) out[key] = value[key];
  }
  return out;
};
const same = (a,b) => !!a && !!b && ['socket','roomId','token','generation','epoch','startAttempt','roomBattleGeneration'].every(k => a[k] === b[k]);
class ApplicationHeartbeat {
  constructor({context,onAttempt=()=>{},onSample=()=>{},onFailure=()=>{},onStale=()=>{},clock=()=>typeof performance!=='undefined'?performance.now():Date.now(),schedule=setTimeout,cancel=clearTimeout,intervalMs=2500,deadlineMs=2000,missLimit=2,rawLimit=4096}={}) {
    if(typeof context!=='function'||!Number.isFinite(intervalMs)||intervalMs<1000||intervalMs>10000||!Number.isFinite(deadlineMs)||deadlineMs<100||deadlineMs>8000||!Number.isInteger(missLimit)||missLimit<2||missLimit>3||!Number.isInteger(rawLimit)||rawLimit<4||rawLimit>4096)throw Error('INVALID_HEARTBEAT_CONFIG');
    Object.assign(this,{context,onAttempt,onSample,onFailure,onStale,clock,schedule,cancel,intervalMs,deadlineMs,missLimit,rawLimit});
    this.active=false; this.bound=null; this.generation=0; this.serial=0; this.connectionSerial=0; this.connectionIds=new WeakMap(); this.entries=new Set(); this.rows=[]; this.events=[]; this.timers=new Set(); this.nextAt=-Infinity; this.timer=null;
    this.stats={supported:false,scheduled:0,started:0,count:0,failed:0,skipped:0,deadlineMisses:0,lateReplies:0,retiredReplies:0,staleRetirements:0,rawTruncated:0,unavailable:0,connections:0};
  }
  later(fn,ms) { const t=this.schedule(()=>{this.timers.delete(t);fn();},Math.max(0,ms)); this.timers.add(t); t?.unref?.(); return t; }
  clear(t) { if(t!==undefined&&t!==null){this.cancel(t);this.timers.delete(t);} }
  event(kind,fields={}) { this.events.push({kind,atWallMs:Date.now(),...fields}); if(this.events.length>128)this.events.shift(); }
  start() { if(!this.active){this.active=true;this.nextAt=-Infinity;} this.tick(); }
  stop(reason='stopped') { this.active=false;this.generation++;this.bound=null;for(const t of this.timers)this.cancel(t);this.timers.clear();this.timer=null;this.event('lifecycle',{reason}); }
  arm() { this.clear(this.timer); if(this.active)this.timer=this.later(()=>{this.timer=null;this.tick();},this.nextAt-this.clock()); }
  tick() {
    if(!this.active)return;
    const ctx=this.context(),now=this.clock(),changed=ctx&&!ctx.unavailable&&!same(ctx,this.bound?.ctx);
    if(now<this.nextAt&&!changed){this.arm();return;}
    this.nextAt=now+this.intervalMs; this.arm();
    if(!ctx||ctx.unavailable){this.stats.unavailable++;this.event('unavailable',{reason:ctx?.unavailable||'unknown'});if(['inactive','hidden','fatal'].includes(ctx?.unavailable))this.stop(ctx.unavailable);return;}
    if(changed){
      let connection=this.connectionIds.get(ctx.socket);if(!connection){connection=++this.connectionSerial;this.connectionIds.set(ctx.socket,connection);this.stats.connections=this.connectionSerial;}
      this.bound={ctx,generation:++this.generation,connection,entries:[],retired:false};
      this.event('connection-context',{connection,contextEpoch:this.generation});
    }
    const bound=this.bound;
    this.retireIfStale(bound);if(bound.retired)return;
    if(this.entries.size>=16||bound.entries.filter(e=>!e.settled).length>=2){this.stats.skipped++;this.event('unavailable',{reason:'probe-capacity',connection:bound.connection});return;}
    this.stats.supported=true; this.stats.scheduled++;
    const row={attempt:++this.serial,connection:bound.connection,contextEpoch:bound.generation,epoch:Number.isSafeInteger(ctx.epoch)?ctx.epoch:null,wireNonce:null,scheduledAtMs:now,sentAtMs:null,sentAtWallMs:null,started:false,outcome:'pending',deadlineMiss:false,timeoutObservedMs:null,late:false,retired:false,rttMs:null};
    this.rows.push(row);if(this.rows.length>this.rawLimit){this.rows.shift();this.stats.rawTruncated++;}
    const entry={row,ctx,bound,settled:false,timer:null,clock:typeof ctx.socket.rttClock==='function'?()=>ctx.socket.rttClock():this.clock};bound.entries.push(entry);if(bound.entries.length>32)bound.entries.shift();this.entries.add(entry);
    const sent=info=>{
      if(row.started)return;row.started=true;this.stats.started++;row.sentAtMs=finite(info?.atMs)?info.atMs:entry.clock();row.sentAtWallMs=Number.isSafeInteger(info?.atWallMs)?info.atWallMs:Date.now();
      entry.timer=this.later(()=>{if(entry.settled||!this.active||entry.bound!==this.bound)return;this.miss(entry);const late=Math.max(0,entry.clock()-row.sentAtMs-this.deadlineMs);row.timeoutObservedMs=entry.clock()-row.sentAtMs;if(late>25){bound.graceUntil=Math.max(bound.graceUntil||0,entry.clock()+25);this.event('deadline-dispatch-delayed',{attempt:row.attempt,lateMs:late});this.later(()=>this.retireIfStale(bound),25);}else this.retireIfStale(bound);},this.deadlineMs);
    };
    const promise=Promise.resolve().then(()=>{
      if(!this.active||!same(ctx,this.context()))return null;
      return ctx.socket.probeRtt(ctx.roomId,{onNonce:nonce=>{if(Number.isSafeInteger(nonce)&&nonce>0)row.wireNonce=nonce;},onSent:sent});
    }).then(sample=>{
      this.clear(entry.timer);entry.settled=true;this.entries.delete(entry);row.retired=!this.active||entry.bound.retired||!same(ctx,this.context())||entry.bound!==this.bound;
      if(!sample){row.outcome='not-started';this.stats.skipped++;return;}
      if(!finite(sample.rttMs)||(row.wireNonce!==null&&sample.probeNonce!==undefined&&sample.probeNonce!==row.wireNonce))throw Error('INVALID_SOCKET_PONG');
      if(!row.started)sent({atMs:row.scheduledAtMs,atWallMs:Date.now()});this.clear(entry.timer);
      row.outcome='pong';row.rttMs=sample.rttMs;row.receivedAtWallMs=Number.isSafeInteger(sample.receivedAtWallMs)?sample.receivedAtWallMs:Date.now();
      if(sample.rttMs>this.deadlineMs)this.miss(entry);
      row.late=row.deadlineMiss;if(row.late)this.stats.lateReplies++;if(row.retired)this.stats.retiredReplies++;
      for(const key of ['serverWorkMs','serverElapsedMs','queuedPayloadBytes','stateMessages','bufferedAmountBytes','pendingRpcs'])if(sample[key]===null||finite(sample[key]))row[key]=sample[key];
      row.localLoop=copyLoop(sample.localLoop);row.serverLoop=copyLoop(sample.serverLoop);row.clientRpc=cleanClientRpc(sample.clientRpc);
      this.stats.count++;this.totalRtt=(this.totalRtt||0)+sample.rttMs;this.maxRtt=Math.max(this.maxRtt||0,sample.rttMs);this.over30=(this.over30||0)+(sample.rttMs>30?1:0);
      // The matching late pong discharges only its own outstanding heartbeat;
      // it cannot masquerade as the ACK of another nonce or connection epoch.
      try{this.onSample(sample,{current:!row.retired,row});}catch(_){this.event('local-sample-observer-error');}
    }).catch(error=>{
      this.clear(entry.timer);entry.settled=true;this.entries.delete(entry);row.outcome='failed';row.code=/^[A-Z0-9_]{1,80}$/.test(error?.message||'')?error.message:'OTHER';row.retired=!this.active||entry.bound.retired||!same(ctx,this.context())||entry.bound!==this.bound;this.stats.failed++;
      if(!row.retired)try{this.onFailure(error,ctx);}catch(_){this.event('local-failure-observer-error');this.stop('observer-error');}
    });
    try{this.onAttempt(promise,row);}catch(_){this.event('local-attempt-observer-error');}
  }
  miss(entry) { if(entry.row.deadlineMiss)return;entry.row.deadlineMiss=true;this.stats.deadlineMisses++;this.event('deadline-miss',{attempt:entry.row.attempt,wireNonce:entry.row.wireNonce,connection:entry.row.connection,contextEpoch:entry.row.contextEpoch}); }
  retireIfStale(bound) {
    const current=this.context();if(!this.active||this.bound!==bound||bound.retired||!same(bound.ctx,current)||(current?.unavailable&&current.unavailable!=='control-busy'))return;
    const currentNow=typeof bound.ctx.socket.rttClock==='function'?bound.ctx.socket.rttClock():this.clock();if(currentNow<(bound.graceUntil||0))return;
    let misses=0,oldest=null;
    for(let i=bound.entries.length-1;i>=0;i--){const e=bound.entries[i],r=e.row;if(!r.started)continue;if(r.outcome==='pong')break;if(r.deadlineMiss){misses++;oldest=e;}if(misses>=this.missLimit)break;}
    if(misses<this.missLimit||!oldest)return;
    const socket=bound.ctx.socket,proof=Math.max(finite(socket.lastAuthenticatedRpcMonoAt)?socket.lastAuthenticatedRpcMonoAt:-Infinity,finite(socket.lastAuthenticatedViewMonoAt)?socket.lastAuthenticatedViewMonoAt:-Infinity);
    if(proof>oldest.row.sentAtMs&&currentNow-proof<this.intervalMs+this.deadlineMs){this.event('heartbeat-degraded-but-authority-progress',{connection:bound.connection});return;}
    bound.retired=true;this.stats.staleRetirements++;this.event('retire-stale-socket',{connection:bound.connection,contextEpoch:bound.generation});try{this.onStale(Error('SOCKET_HEARTBEAT_STALE'),bound.ctx);}catch(_){this.event('local-retirement-observer-error');this.stop('observer-error');}
  }
  report() {
    const ctx=this.context(),samples=this.rows.map(r=>({...r,...(r.clientRpc?{clientRpc:{...r.clientRpc}}:{}),...(r.localLoop?{localLoop:{...r.localLoop}}:{}),...(r.serverLoop?{serverLoop:{...r.serverLoop}}:{})})),values=samples.filter(r=>r.outcome==='pong').map(r=>r.rttMs).sort((a,b)=>a-b);
    return {...this.stats,active:this.active,intervalMs:this.intervalMs,deadlineMs:this.deadlineMs,consecutiveUnacknowledgedRequired:this.missLimit,meanMs:this.stats.count?this.totalRtt/this.stats.count:null,maxMs:this.stats.count?this.maxRtt:null,over30:this.over30||0,over30Percent:this.stats.count?100*(this.over30||0)/this.stats.count:null,p95Ms:values[Math.ceil(values.length*.95)-1]??null,p99Ms:values[Math.ceil(values.length*.99)-1]??null,percentileScope:this.stats.rawTruncated?'retained samples only; raw truncated':'all completed observed pongs in this match',rawLimit:this.rawLimit,samples,events:this.events.map(r=>({...r})),currentConnectionSupported:ctx?.socket?.capabilities?.applicationPing===true,currentSocketReady:ctx?.socket?.ready===true,scope:'Actual send-to-matching-pong callback RTT unchanged, including late/retired completed probes.2s is a liveness deadline, not a low RTT substitute. Two independent unacknowledged sends required; late ACK discharges only itself. Valid current-Socket authority progress prevents false retirement. No membership/session deletion; unavailable periods and failed attempts remain explicit.'};
  }
}
module.exports={ApplicationHeartbeat};
