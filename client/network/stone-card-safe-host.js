'use strict';
// Recoverable raw evidence lives in the SAME graph even after native dead units
// leave hounds. Optional failures never escape into combat. No sync disk writes.
module.exports=function create(g){
 let drainFailures=0,cursor=0,journalRef=null,records=new WeakMap();
 function journal(){const list=g.stoneRewardJournal||(g.stoneRewardJournal=[]);if(list!==journalRef){journalRef=list;records=new WeakMap();cursor=0;}return list;}
 function pressure(){g.stoneCardPressure={journal:g.stoneRewardJournal?.length||0,outbox:g.stoneCardData?.pending?.length||0,inbox:g.cardRewardInboxData?.events?.length||0,releaseBlocked:true,reason:'reward-capacity-policy-pending'};}
 function fault(stage,error){const previous=g.stoneCardDiagnostic;g.stoneCardDiagnostic={stage,message:String(error?.message||error).slice(0,180),count:(previous?.count||0)+1};console.warn('[stone-card optional]',stage,g.stoneCardDiagnostic.message);}
 function assign(b){try{g.stoneCardHandoff?.assign?.(b);}catch(e){fault('assign',e);}}
 function enqueue(b,source){const list=journal();
 const owner=source?g.elfRewardOwnerSlot?.(source):undefined;
 const liveStage=g.waveMonsterStageBN?.();
 const stage=liveStage===0||liveStage===1||liveStage===2?liveStage:(g.troll?.dragonEvolved?2:g.troll?.evolved?1:b.waveMonsterEvolutionStageBN??b.stoneStats?.stage??0);
 const dragon=stage===2;
 let localEligible=owner===null;
 if(!localEligible&&dragon&&Number.isInteger(owner)&&!g.player?.dead&&!g.player?.defected){
  const ally=g.ownerWallet?.(owner);
  // Allied final hits count only when they defend the player's active lane.
  if(ally&&ally!==g.player&&!ally.defected){
   const zone=g.playerWarningZone431?.();
   localEligible=!!zone&&g.resourceZones?.[b.waveZoneIndex]===zone;
  }
 }
 const cardCount=dragon?3:stage===1?2:1;
 if(g.cardsCandidate?.soloRewards){
  if(!localEligible||!g.cardsCandidate.core.authority())return null;
  // Explicit bounded trial, not the eventual full-hand rule. Existing eligible rewards are never evicted.
  const occupied=list.length+(g.stoneCardData?.pending?.length||0)+(g.cardRewardInboxData?.events?.length||0);
  if(occupied>=128){if(g.stoneTrialCapToasted!==g.stoneCardData?.matchId){g.stoneTrialCapToasted=g.stoneCardData?.matchId;g.showToast?.('卡牌测试场：本局发卡次数已达上限，已有奖励仍可领取');}return null;}
 }
 let record=records.get(b);if(!record){record={boss:b,sourceOwner:owner??null,localEligible,cardCount,attempts:0,lastError:null,slot:list.length};list.push(record);records.set(b,record);}pressure();return record;}
 function attempt(record,knownIndex=record.slot){if(!g.stoneCardHandoff||record.attempts>=3)return false;record.attempts++;try{const result=g.stoneCardHandoff.capture(record.boss,{rewardOwnerSlot:record.sourceOwner,localEligible:record.localEligible===true,cardCount:record.cardCount});if(result?.captured!==true){record.lastError='capture-not-accepted';fault('capture',record.lastError);return false;}const list=journal(),index=knownIndex;if(list[index]!==record)throw Error('Reward journal index mismatch');const last=list.pop();if(index<list.length){list[index]=last;last.slot=index;}records.delete(record.boss);pressure();return true;}catch(e){record.lastError=String(e?.message||e).slice(0,180);fault('capture',e);return false;}}
 function drain(){if(drainFailures>=3)return;try{g.stoneCardHandoff?.drain?.(4);drainFailures=0;}catch(e){drainFailures++;fault('drain',e);}}
 function retry(){const list=journal();let scanned=0;const budget=Math.min(4,list.length);while(list.length&&scanned<budget){if(cursor>=list.length)cursor=0;const index=cursor,record=list[index];scanned++;if(record.attempts<3&&attempt(record,index))continue;cursor++;}drain();pressure();return{scanned,pending:list.length};}

 return{assign,enqueue,attempt,drain,retry};
};
