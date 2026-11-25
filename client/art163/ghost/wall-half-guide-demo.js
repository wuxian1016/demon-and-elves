'use strict';
exports.install=function(g,runtime,input){
 let wall=null,pending=0,shot,guideAt=0,initialLevel=0,own=null,under,lastCheck,lastCritical;
 const isLow=b=>b&&!b.dead&&b.hp>0&&b.maxHp>0&&b.hp<=b.maxHp/3;
 const soft=require('./soft-hint'),text=s=>runtime.nativeText(s),clock=()=>g.supportTime||0;
 function blocked(){return runtime.hidden||g.state!=='hunt'||g.player.dead||g.tutorial||g.cardPresentation?.modal()||g.rewardAdBN?.pausesLive?.()||g.shareRescueVisible616()||g.rotationInputBlocked398()||g.cameraPeek||g.ceremony||g.endlessOpeningIntro||g.cameraScenesR7?.active()||g.demonAttackFocus545||g.pendingDemonFocus545||g.firstAttackCameraFocus;}
 const occupied=()=>g.popupActive515()||g.placement;
 function hold(settle=true){const c=g.camera;g.cameraFollow.x=c.x;g.cameraFollow.y=c.y;if(settle){g.cameraPan.x=g.cameraPan.y=0;g.cameraRecenter.x=g.cameraRecenter.y=0;g.manualCamera394=true;}shot=null;}
 const sync=()=>{if(own!==g.player){
  own=g.player;wall=shot=under=null;lastCheck=lastCritical=null;pending=guideAt=0;
  const saved=g.wallHalfPreviewTarget;if(saved&&g.buildings.includes(saved.wall)&&saved.wall.type==='wall'&&saved.wall.ownerSlot==null&&!saved.wall.dead&&saved.wall.level===saved.level){wall=saved.wall;initialLevel=saved.level;guideAt=clock()||1;}
 }};
 function hit(actor,target,before){
  if(g.state!=='hunt'||g.tutorial||g.superChallenge580||g.networkAuthorityPhases627||
   !actor||actor===g.ghostElfAPI?.host||actor.stonePossessedSource||target.type!=='wall'||target.ownerSlot!=null||target.dead||
   !isLow(target)||!g.completedElfBuildingBN(target))return;
  sync();under=target;
  if(g.operationGuideModeR13?.()===false)return;
  if(g.wallHalfPreviewSeen===true||before<=target.maxHp/3||!g.buildings.includes(target))return;
  g.wallHalfPreviewSeen=true;wall=target;initialLevel=wall.level;guideAt=0;pending=1;g.wallHalfPreviewTarget={wall,level:initialLevel};
  // The legacy animation returns to the player. A valid half-HP hit on its same
  // wall takes over the camera only; leave its warning, marks, and other targets.
  if(g.goldShortageGuideBN?.ownsToast?.(g.toast?.text))g.toast={text:'',time:0};
  g.resourceCapPreview?.cancelGuide?.();g.goldShortageGuideBN?.cancelGuide?.();
  const same=f=>f?.x===wall.x&&f?.y===wall.y;
  if(same(g.pendingDemonFocus545))g.pendingDemonFocus545=null;
  if(same(g.demonAttackFocus545))g.demonAttackFocus545=null;
 }
 function urgent(){
  if(!['prep','hunt'].includes(g.state)||!g.player||g.player.dead)return false;
  sync();
  if(isLow(under)||isLow(g.wallBannerBN?.target))return true;
  const frame=g.navigationFrame;
  if(frame!==lastCheck||lastCritical&&!isLow(lastCritical)){lastCheck=frame;lastCritical=g.criticalPlayerWall399?.();}
  return !!lastCritical;
 }
 function tick(){
  sync();if(g.operationGuideModeR13?.()===false){if(shot)hold(false);return;}if(!wall)return;
  if(runtime.hidden){if(shot)hold();return;}
  if(wall.dead||wall.level!==initialLevel||g.state!=='hunt'||g.player.dead){if(shot)hold();g.wallHalfPreviewTarget=null;wall=shot=null;return;}
  const playerBusy=g.passiveHintsR13?.quiet()||g.player.task;
  if(shot&&(playerBusy||blocked()||occupied()||input()?.active||input()?.panning||input()?.stick?.active||input()?.pinch?.active)){hold(false);return;}
  if(!pending)return;
  if(!playerBusy&&!blocked()&&!occupied()&&!input()?.active&&!input()?.panning&&!input()?.stick?.active&&!input()?.pinch?.active){
   shot={fromX:g.camera.x,fromY:g.camera.y,start:clock()}; guideAt=clock();pending=0;g.buildingMapFocus=null;
  }
 }
 function frame(w,h,mx,my){
  if(!shot||g.operationGuideModeR13?.()===false)return false;
  const x=Math.max(0,Math.min(mx,wall.x-w/2)),y=Math.max(0,Math.min(my,wall.y-h*.57));
  const t=Math.min(1,(clock()-shot.start)/1250),e=t*t*t*(10+t*(-15+6*t));
  g.camera.x=shot.fromX+(x-shot.fromX)*e;g.camera.y=shot.fromY+(y-shot.fromY)*e;
  if(t===1)hold();return true;
 }
 function paint(){
  sync();if(g.operationGuideModeR13?.()===false||g.baseUpgradeGuideBN||!wall||!guideAt||blocked()||wall.dead||wall.level!==initialLevel||g.buildMenu||g.placement||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.selectedBuilding&&g.selectedBuilding!==wall)return;
  const S=g.uiSafeRect396(),mm=g.getMinimapRect(),C=g.ctx;
  let x,y,L;
  if(g.selectedBuilding===wall){
   L=g.getUpgradePanelLayout();const b=L.upgradeBtn;
   if(!b)return;x=b.x+b.w*.5;y=b.y-3;
  }else{
   const z=g.zoom();x=(wall.x-g.camera.x)*z;y=(wall.y-g.camera.y)*z-25;
   const visible=x>S.x+24&&x<S.right-24&&y>=g.topHudLayout().bottom+30&&y<=S.bottom-100;
   if(!visible)x=y=null;
  }
  let top=Math.min(S.bottom-110,Math.max(S.y+8,g.topHudLayout().bottom+12,mm.y+mm.h+29));
  const width=Math.min(294,S.w-26);let left=S.x+(S.w-width)/2;
  if(L){if(L.y+L.h+35<=S.bottom-65)top=L.y+L.h+7;
   else if(L.y>=S.y+37)top=L.y-34;
   else if(L.x-S.x>=width+12){left=L.x-width-10;top=Math.max(S.y+8,L.y+4);}
  }
  if(x!==null){soft.buildArrow(g,C,{x,y,w:0,h:0},1.37,soft.layout(C,width,[[text('城墙告急！升级城墙，恢复满血'),15]]));return;}
  C.save();C.fillStyle='rgba(11,36,24,.94)';C.strokeStyle='#7AE6A1';C.lineWidth=1;
  C.beginPath();C.moveTo(left+8,top);C.arcTo(left+width,top,left+width,top+28,8);C.arcTo(left+width,top+28,left,top+28,8);C.arcTo(left,top+28,left,top,8);C.arcTo(left,top,left+width,top,8);C.closePath();C.fill();C.stroke();
  C.textAlign='center';C.textBaseline='middle';C.font='bold 15px sans-serif';C.fillStyle='#E8FFE9';C.fillText(text('城墙告急！升级城墙，恢复满血'),left+width/2,top+14,width-14);C.restore();
 }
 // Advise only for a completed owned attack tower and never take the camera.
 let tower=null,towerOwner=null,scanAt=0;
 const eligibleTower=b=>isLow(b)&&b.ownerSlot==null&&g.completedElfBuildingBN(b)&&g.buildings.includes(b);
 function towerHit(actor,target){
  if(g.operationGuideModeR13?.()===false||!actor||actor===g.ghostElfAPI?.host||actor.stonePossessedSource||!eligibleTower(target))return;
  if(towerOwner!==g.player){towerOwner=g.player;tower=null;scanAt=0;}
  if(!eligibleTower(tower)||target.hp/target.maxHp<tower.hp/tower.maxHp)tower=target;
 }
 function towerView(){
  if(g.operationGuideModeR13?.()===false||!['prep','hunt'].includes(g.state)||g.player.dead||runtime.hidden||urgent()||g.passiveHintsR13?.quiet()||
    g.roundStarting||g.roundLoading591||g.popupActive515()&&!g.selectedBuilding||g.placement||g.tutorial||g.endlessOpeningIntro||g.cameraScenesR7?.active()||
    g.cameraScenesR7?.mapCueVisible?.()||g.cardPresentation?.modal()||g.rewardAdBN?.pausesLive?.()||g.sessionMenuOpen||g.ceremony)return null;
  if(towerOwner!==g.player){towerOwner=g.player;tower=null;scanAt=0;}
  if(!eligibleTower(tower))tower=null;
  const t=clock();
  if(t>=scanAt){
   scanAt=t+360;
   for(const b of g.indexedOwnerBuildings(null))if((g.isDefenseGuideTowerType(b.type)||b.type==='watchtower')&&eligibleTower(b)&&(!tower||b.hp/b.maxHp<tower.hp/tower.maxHp))tower=b;
  }
  if(!tower||g.selectedBuilding&&g.selectedBuilding!==tower)return null;
  const price=tower.upgradeCost?.(),can=price&&tower.canUpgrade()&&!g.buildingUpgradeBlockReason(tower)&&g.validUpgradeCostR12(price)&&g.player.wood>=price.wood&&g.player.gold>=price.gold;
  return {tower,label:g.buildingName(tower)+'告急 · 血量 '+Math.ceil(100*tower.hp/tower.maxHp)+'%',can:!!can};
 }
 function paintTower(){
  const v=towerView();if(!v)return;const {tower:b,label,can}=v,c=g.ctx,S=g.uiSafeRect396(),m=g.getMinimapRect(),z=g.zoom();
  const plan=soft.layout(c,Math.min(198,S.w-28),(can?[[text(label),14],[text('可升级这座塔'),12]]:[[text(label),14]]));
  const L=g.selectedBuilding===b?g.getUpgradePanelLayout():null,button=can&&L?.upgradeBtn;
  if(button){soft.buildArrow(g,c,button,1.04,plan);return;}
  const sx=(b.x-g.camera.x)*z,sy=(b.y-g.camera.y)*z-Math.min(60,Math.max(26,b.radius*z));
  if(!L&&sx>S.x+44&&sx<S.right-44&&sy>Math.max(m.y+m.h,g.topHudLayout().bottom)+52&&sy<S.bottom-120){
   soft.buildArrow(g,c,{x:sx,y:sy,w:0,h:0},.95,plan);return;
  }
  const x=S.x+(S.w-plan.w)/2,y=Math.max(g.topHudLayout().bottom+9,m.y+m.h+9,L?L.y+L.h+7:0);
  if(y+plan.h<S.bottom-90)soft.paint(c,x,y,plan);
 }
 const draw=g.draw;g.draw=function(...a){const result=draw.apply(this,a);paint();paintTower();return result;};
 g.wallHalfGuideDemo={hit,towerHit,towerView,tick,frame,urgent,active:()=>{sync();return g.operationGuideModeR13?.()!==false&&!!wall&&!wall.dead&&wall.level===initialLevel&&g.state==='hunt'&&!g.player.dead;},state:()=>({wall,pending,shot})};
};
