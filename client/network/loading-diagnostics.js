'use strict';
const STAGES=new Set(['health','heartbeat','heartbeat-snapshot','snapshot','start','input','push','server','map','scene','render','ui','frame']);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
// Diagnostics only. Deliberately export seats/states, never room/player identity or URLs.
function captureLoadingState(battle){
 const c=battle?.client||{},v=battle?.loadBarrierView,at=typeof battle?.monotonic==='function'?battle.monotonic():null,received=battle?.loadBarrierLastSuccessAt;
 const rows=Array.isArray(v?.players)?v.players.slice(0,9).filter(p=>integer(p?.seat,0,8)!==null&&integer(p?.step,0,5)!==null&&['ready','loading','offline','failed'].includes(p?.state)).map(p=>({seat:p.seat,step:p.step,state:p.state})):[];
 let step=null;try{step=integer(battle?.loadStep?.(),0,5);}catch(_){}
 return {lastRequestStage:STAGES.has(c.requestStage)?c.requestStage:'unknown',hasAuthorityState:!!c.state,localLoadStep:step,barrierRequired:c.requireLoadingBarrier===true,barrierEnabledByHealth:c.loadingBarrierEnabled===true,barrierCachePresent:!!v,barrierCacheEnabled:typeof v?.enabled==='boolean'?v.enabled:null,barrierCacheStarted:typeof v?.started==='boolean'?v.started:null,barrierCacheEpoch:integer(v?.epoch,1,Number.MAX_SAFE_INTEGER),barrierCacheAgeMs:Number.isFinite(at)&&Number.isFinite(received)&&at>=received?Math.min(180000,Math.round(at-received)):null,barrierRequestPending:!!battle?.loadBarrierPoll,barrierRequestFailed:battle?.loadBarrierError===true,players:rows,scope:'cached client loading report, not a live server lifecycle observation; request stage may be last completed request'};
}
module.exports={captureLoadingState};
