'use strict';
// Opt-in only. Does NOT install stone art/gameplay or grant cards.
module.exports=function link(g,{matchIdFactory=()=> 'solo:'+Date.now().toString(36)+':'+Math.random().toString(36).slice(2)+':'+Math.random().toString(36).slice(2)}={}){
 const host=require('./stone-card-outbox').create({game:g,matchIdFactory,sink:envelope=>{
  const api=g.cardsCandidate;if(!api)return{accepted:false};
  if(!g.cardRewardInboxData)api.prepareRewardInbox(envelope.matchId);
  return api.acceptStoneDefeat(envelope);
 }});
 // Legacy migration is evidence-only; resolveEnabled remains false.
 host.migrateLegacy(g.hounds,g.stoneDefeatEvents);
 return host;
};
