'use strict';
const {eventIssue}=require('./game-feedback');
const scope=['roomId','viewerOwnerId','epoch','sceneRevision','mapChecksum'];
// A server toast's remaining duration ages within the same event identity.
// Every other field must remain identical; changed content is never disguised
// as a duplicate. The latest remaining duration is the authoritative value.
function sameAgingEvent(old,next){
 if(JSON.stringify(old)===JSON.stringify(next))return true;
 if(old.type!=='toast'||next.type!=='toast'||next.duration>old.duration)return false;
 const {duration:a,...left}=old,{duration:b,...right}=next;
 return JSON.stringify(left)===JSON.stringify(right);
}
function mergePresentationFeedback(older,newer,appliedEventId,decision,eventApplied=null){
 const consumed=(packet,event)=>typeof eventApplied==='function'&&eventApplied(packet,event)===true;
 const decide=(a,b,id)=>typeof eventApplied==='function'?decision(a,b,id,eventApplied):decision(a,b,id);
 if(!scope.every(k=>older[k]===newer[k])||!Number.isSafeInteger(newer.tick)||newer.tick<older.tick)return null;
 const direct=decide(older,newer,appliedEventId);
 if(direct.allowed)return newer;
 if(direct.reason!=='feedback-not-retained')return null;
 const applied=Number.isSafeInteger(appliedEventId)&&appliedEventId>=0?appliedEventId:0;
 for(const p of [older,newer])if(!Array.isArray(p.events)||p.events.length>128||p.events.some(e=>eventIssue(e,p.tick))||new Set(p.events.map(e=>e.id)).size!==p.events.length)return null;
 const events=new Map();
 for(const e of older.events)if(e.id>applied&&!consumed(older,e))events.set(e.id,e);
 for(const e of newer.events)if(e.id>applied){const old=events.get(e.id);if(old&&!sameAgingEvent(old,e))return null;events.set(e.id,e);}
 // Preserve all unread events even when they have left the server's rolling
 // window. At 128 unread events stop merging; retain the existing FIFO barrier.
 // No capacity increase, silent eviction, or new expiration policy.
 if(events.size>128)return null;
 const merged={...newer,events:[...events.values()].sort((a,b)=>a.id-b.id)};
 // New event copies may age a toast. Check all urgent-state barriers against a
 // normalized old packet; IDs and other content remain byte-for-byte intact.
 const normalizedOld={...older,events:older.events.map(e=>{
  const next=events.get(e.id);return next&&sameAgingEvent(e,next)?next:e;
 })};
 return decide(normalizedOld,merged,applied).allowed?merged:null;
}
module.exports={mergePresentationFeedback,sameAgingEvent};
