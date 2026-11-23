'use strict';
// Presentation-only budget gate. Never cancel or refund already reserved jobs.
function install(g,{catalog=[]}={}){
 if(g.buildResourceGateBN)return g.buildResourceGateBN;
 let closed=0;
 const entries=new Map(catalog.map(e=>[e.type,e]));
 function affordable(p){const f=g.buildQueueAvailableBN?.()||g.player;return !!f&&f.wood>=p.woodCost&&f.gold>=p.goldCost;}
 function notice(){g.showToast('资源不足');if(g.toast)g.toast.time=Math.min(g.toast.time||1500,1500);}
 function close(p,force=false){if(!p||p.pending627||(!force&&affordable(p)))return false;if(g.placement===p){g.placement=null;closed++;g.finishPlacementCamera?.(p);g.wxUiDirty=true;}notice();return true;}
 g.rejectInsufficientBuildBN=p=>close(p,true);
 function busy(){return g.singleBuildPendingBN?.()===true;}
 const start=g.startPlacement;
 g.startPlacement=function(type,woodCost,goldCost,...args){
  // Do not replace an in-flight command or lose its acknowledgement identity.
  if(this.placement?.pending627)return;
  if(busy()){this.showToast('请等待当前建筑建造完成');return;}
  const entry=entries.get(type),cost={woodCost:entry?.wood??woodCost,goldCost:entry?.gold??goldCost};
  // Air-defense variants recurse through tower with their own price: the outer
  // catalog gate is authoritative; the inner call must preserve that price.
  if(!affordable({woodCost,goldCost})||!affordable(cost)){close(this.placement,true);const guide=this.goldShortageGuideBN;guide?.failure(guide.capture('build',{type}),'资源不足');notice();return;}
  return start.call(this,type,woodCost,goldCost,...args);
 };
 // Completion ends the same build session even if a later grid tap left it
 // in confirmation. A new explicit startPlacement creates an unmarked session.
 function finishContinuation(){const p=g.placement;if(p?.buildQueueContinuationBN&&!p.pending627){g.placement=null;g.finishPlacementCamera?.(p);g.wxUiDirty=true;}}
 let sawQueue=false,confirmQueueDepth=null;
 function observeQueue(){if(g.placement?.buildQueueReceiptBN)return;const count=g.getPlayerBuildQueueBN?.().length||0;if(count)sawQueue=true;else if(sawQueue){sawQueue=false;finishContinuation();}}
 for(const name of ['updatePlacement','handlePlacementTap']){const original=g[name];g[name]=function(...args){if(name==='updatePlacement'&&confirmQueueDepth!==null&&(this.getPlayerBuildQueueBN?.().length||0)>confirmQueueDepth)return;observeQueue();if(name==='handlePlacementTap'&&!this.placement)return;if(name==='handlePlacementTap'&&busy()&&this.placementButtonAt?.(...args)?.id!=='placeCancel'){this.showToast('请等待当前建筑建造完成');return;}if(close(this.placement))return;const before=closed,queued=this.getPlayerBuildQueueBN?.().length||0;const priorDepth=confirmQueueDepth;if(name==='handlePlacementTap'&&this.placement?.stage==='confirm'&&this.placementButtonAt?.(...args)?.id==='placeConfirm')confirmQueueDepth=queued;let result;try{result=original.apply(this,args);}finally{confirmQueueDepth=priorDepth;}const count=this.getPlayerBuildQueueBN?.().length||0;if(name==='handlePlacementTap'&&count>queued&&this.placement?.stage==='aim'&&!this.placement.pending627){const p=this.placement;this.placement=null;this.finishPlacementCamera?.(p);this.wxUiDirty=true;sawQueue=true;this.showToast(queued?'已放下投影，将按顺序建造':'已放下投影，正在前往建造');return result;}if(count)sawQueue=true;close(this.placement);if(closed!==before)notice();return result;};}
 const buildStep=g.updatePlayerBuild506;
 g.updatePlayerBuild506=function(...args){const result=buildStep.apply(this,args);observeQueue();return result;};
 const draw=g.drawPlacementPreview;
 g.drawPlacementPreview=function(...args){const p=this.placement;if(!p)return;if(!affordable(p)){if(!p.pending627)close(p);return;}return draw.apply(this,args);};
 function authority(view){
  const p=g.placement,r=p?.buildQueueReceiptBN;
  if(!r||!view||r.epoch!==view.epoch||!Number.isSafeInteger(view.lastSeq)||view.lastSeq<r.seq||p.pending627||!p.buildQueueContinuationBN)return;
  if((g.getPlayerBuildQueueBN?.().length||0)>0)return;
  // ACK is only acceptance. Require a new owned, completed authority building
  // at this accepted command's exact site; wallet changes are not evidence.
  const built=(g.buildings||[]).some(b=>!b.dead&&b.ownerSlot==null&&b.networkId&&!r.existingIds.includes(b.networkId)&&Math.abs(b.x-r.x)<.01&&Math.abs(b.y-r.y)<.01&&(r.type==='antiAirTowerBN'?b.airDefenseKindBN==='antiAir':r.type==='netTowerBN'?b.airDefenseKindBN==='net':b.type===r.type));
  if(built)finishContinuation();
 }
 return g.buildResourceGateBN={affordable,authority};
}
module.exports={install};
