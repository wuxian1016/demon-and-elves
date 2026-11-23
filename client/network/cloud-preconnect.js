'use strict';
const {safeCode}=require('./qa-connection');
// One background attempt per room client. No heartbeat loop, room creation,
// automatic replay of uncertain writes, or dependency of the single-player UI.
const pending=new WeakMap();
function preconnectCloudSession(room,{clock=Date.now}={}){
 if(pending.has(room))return pending.get(room);
 const startedAtMs=clock();
 const promise=Promise.resolve().then(async()=>{
  if(room.closed)return {state:'skipped'};
  room.preconnectObservation={state:'pending',startedAtMs};
  try{
   if(room.token)await room.refresh({fresh:true});else await room.login();
   if(room.closed)return {state:'skipped'};
   if(!room.token||!room.playerId)throw Error('LOGIN_REQUIRED');
   return room.preconnectObservation={state:'session-established',startedAtMs,elapsedMs:Math.max(0,clock()-startedAtMs),scope:'session establishment only; not room membership, Socket liveness or steady-state RTT'};
  }catch(error){
   if(room.closed)return {state:'skipped'};
   return room.preconnectObservation={state:'failed',startedAtMs,elapsedMs:Math.max(0,clock()-startedAtMs),error:safeCode(error.message)};
  }
 });pending.set(room,promise);return promise;
}
module.exports={preconnectCloudSession};
