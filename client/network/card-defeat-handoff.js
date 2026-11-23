'use strict';
// Synchronous MEMORY commit, never filesystem access. Producer MUST retain an
// unaccepted event in its authoritative save graph. No death/gameplay mutation.
// Accepted means captured in the current in-memory save graph, not disk durable.
function create({getInbox}) {
 let busy=false;
 return function accept(envelope){
  if(busy)return{accepted:false,retry:true,reason:'reentrant-handoff'};
  busy=true;
  try {const inbox=getInbox();
  if(!inbox)return{accepted:false,retry:true,reason:'inbox-not-ready'};
  if(!envelope||envelope.matchId!==inbox.state.matchId)return{accepted:false,retry:false,reason:'wrong-match'};
  const result=inbox.record(envelope.event);const accepted=result.ok||result.reason==='duplicate-death';return{accepted,retry:!accepted&&['inbox-capacity','not-authority'].includes(result.reason),reason:result.reason,commit:accepted?'memory-only':null};}
  catch(error){return{accepted:false,retry:true,reason:'handoff-exception'};}
  finally{busy=false;}
 };
}
module.exports={create};
