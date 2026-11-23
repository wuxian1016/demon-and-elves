'use strict';
// Run ownership is runtime-only. A save field or online snapshot cannot grant it.
module.exports=function({offline=()=>false}={}){
 const runs=new WeakMap(),installed=new WeakSet();
 const eligible=g=>offline()===true&&!g.tutorial&&!g.superChallenge580;
 function allows(g){return eligible(g)&&runs.get(g)===g.troll;}
 function register(g,fresh=false){runs.delete(g);if(fresh){g.batPendingWavesBN=[];g.batQueuedThroughBN=0;g.batWaveSerialBN=0;g.batResourceCreditsBN={};g.batDeliveriesBN={};g.batPersistenceVersionBN=1;g.batIntroCardBN?.reset();g.batIntroSeenBN=false;}g.batWaveCandidateBN=eligible(g);if(g.batWaveCandidateBN)runs.set(g,g.troll);}
 function install(g){if(installed.has(g))return;installed.add(g);const reset=g.resetSteps591,restore=g.applySavedWorld;
  g.resetSteps591=function* (...args){yield*reset.apply(this,args);register(this,true);};
  g.applySavedWorld=function(...args){const result=restore.apply(this,args);if(result){register(this,false);this.ghostRelocateBN?.restore();this.cardsCandidate?.reconcileRestoredHp?.();}return result;};
  register(g,false);
 }
 return {allows,install};
};
