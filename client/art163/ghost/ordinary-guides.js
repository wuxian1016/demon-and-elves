'use strict';
const priority=require('../../network/notice-priority');
const type=key=>key==='wood'?'collectWood':'collectGold';
const name=key=>key==='wood'?'伐木':'采矿';
function install(g,catalog){
 let player,pending,kick,early,homeMemo,memoAt,rest,wallGate;
 const now=()=>g.supportTime||0;
 const solo=()=>g.operationGuideModeR13?.()!==false&&!g.tutorial&&!g.superChallenge580&&!g.networkAuthorityPhases627&&['prep','hunt'].includes(g.state)&&g.player&&!g.player.dead;
 const live=(b)=>b?.ownerSlot==null&&g.completedElfBuildingBN(b)&&g.buildings.includes(b);
 const balance=(cost,p=g.player)=>['wood','gold'].find(k=>p[k]<cost[k]&&cost[k]<=(k==='wood'?p.maxWood:p.maxGold));
 const payable=b=>live(b)&&b.canUpgrade()&&!g.buildingUpgradeBlockReason(b)&&g.validUpgradeCostR12(b.upgradeCost());
 const blocked=()=>priority.economy(g)||!!g.criticalPlayerWall399?.()||g.baseUpgradeGuideBN||g.cameraScenesR7?.active()||g.demonAttackFocus545||g.firstAttackCameraFocus;
 const gated=()=>!solo()||blocked()||g.endlessOpeningIntro||g.roundStarting||g.roundLoading591||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.batIntroCardBN?.visible?.()||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()||g.rewardAdBN?.pausesLive?.()||g.rotationInputBlocked398()||g.player.drivingTank||g.ghostElfAPI?.host;
 function reset(){
  if(player!==g.player){player=g.player;pending=rest=wallGate=null;kick=early=null;homeMemo=null;memoAt=-1;}
 }
 function home(){
  const t=now();if(t>=memoAt&&t-memoAt<400&&homeMemo&&live(homeMemo))return homeMemo;
  memoAt=t;return homeMemo=g.indexedOwnerBuildings(null).find(b=>b.type==='house'&&b.isInitialBase&&g.completedElfBuildingBN(b))||null;
 }
 function state(s){reset();pending={...s,ends:now()+9500};}
 function inWindow(){reset();return pending&&now()<pending.ends&&!g.baseUpgradeGuideBN;}
 function hint(k,label){
  if(g.midTradePaintSupplyR13===k)return null;
  if(g.placement||g.buildMenu||g.selectedBuilding)return {label,mode:'ordinary'};
  if(g.player.task?.type===k&&g.player.task.phase!=='wait')return null;
  const b=g.buttons.find(b=>b.id===type(k)&&b.w>0&&b.h>0&&b.visible!==false);
  return b?{label,mode:'gather',target:b}:null;
 }
 function baseHint(b,label){
  if(g.buildMenu||g.placement||g.selectedBuilding&&g.selectedBuilding!==b)return {label,mode:'ordinary'};
  if(g.selectedBuilding===b)return {label,mode:'base',target:g.getUpgradePanelLayout().upgradeBtn};
  if(!b)return {label,mode:'ordinary'};
  const o=g.screenToWorld(0,0),z=g.zoom(),S=g.uiSafeRect396();
  const x=(b.x-o.x)*z,y=(b.y-o.y)*z-Math.max(18,b.radius*z*.6);
  return {label,mode:'base',target:x>=S.x&&x<=S.right&&y>=S.y&&y<=S.bottom?{x,y,w:0,h:0}:null};
 }
 function shortage(cost){
  if(!g.validUpgradeCostR12(cost))return null;
  const k=balance(cost);
  return k?hint(k,'缺'+(k==='wood'?'木材':'金币')+'，点「'+name(k)+'」'+(g.placement?'补资源，可先退出选址':'补资源')):null;
 }
 function view({allowFirstMine=false,defenseCost=null,allowBase=null}={}){
  reset();if(gated())return null;
  if(inWindow()){
   const q=pending;
   if(q.need){
    if(q.blocked&&(!live(q.blocked)||q.blocked.level!==q.level)||q.entry&&g.buildingCountBlockReason(q.entry.type)){pending=null;return null;}
    if(g.getOwnerMaxHouseLevel()>=q.need){pending=null;return null;}
    const b=home(),c=b?.upgradeCost(),k=c&&balance(c);
    if(k&&!g.buildMenu&&!g.placement&&!g.selectedBuilding)
     return hint(k,'升级基地还缺'+(k==='wood'?'木材':'金币')+'，点「'+name(k)+'」');
    return baseHint(b,'先把基地升到 '+q.need+' 级'+(k?'，需先攒够资源':''));
   }
   if(q.building&&(!live(q.building)||q.building.level!==q.level)){pending=null;return null;}
   const row=shortage(q.cost);if(!balance(q.cost))pending=null;
   return row;
  }
  if(defenseCost&&!g.placement&&!g.buildMenu&&!g.selectedBuilding)return shortage(defenseCost);
  if(!allowFirstMine&&!allowBase)return null;
  if(g.getPlayerBuildQueueBN?.().length||g.placement||g.buildMenu)return null;
  const b=home();if(!payable(b)||b.level!==1)return null;
  const c=b.upgradeCost();
  if(allowFirstMine&&balance(c)&&!g.selectedBuilding){
   if(early===null)early=now()+9500;
   if(now()<early)return shortage(c);
  }
  if(!allowBase||g.goldShortageGuideBN?.busy?.()||g.resourceCapPreview?.busy?.()||g.player.wood<c.wood||g.player.gold<c.gold||!allowBase())return null;
  if(g.selectedBuilding&&g.selectedBuilding!==b)return null;
  if(kick===null)kick=now()+11000;
  if(now()>=kick)return null;
  return baseHint(b,'可以把基地升到 2 级，解锁更多建筑');
 }
 // Real, funded purchases advance this advice; a gathering task doesn't expire it.
 function afterWarehouse(){
  reset();
  if(gated()||g.placement||g.buildMenu)return null;
  const b=home(),w=g.buildQueueAvailableBN?.()||g.player;
  if(!b)return null;
  const afford=c=>c&&w.wood>=c.wood&&w.gold>=c.gold;
  const canRaise=target=>payable(target)&&g.easyOpeningGuideAllowsUpgrade(target)!==false&&afford(target.upgradeCost());
  const suggest=(target,label)=>({...baseHint(target,label),progress:true});
  if(b.level===1&&canRaise(b))return suggest(b,'基地升到二级，解锁更多建筑。');
  if(b.level<3){
   let wall,tower;
   for(const x of g.indexedOwnerBuildings(null)){
    if(x.level!==1||x.type!=='wall'&&x.type!=='cannonTower'||!canRaise(x))continue;
    if(!wall&&x.type==='wall')wall=x;
    if(!tower&&x.type==='cannonTower')tower=x;
    if(wall&&tower)break;
   }
   if(wall)return suggest(wall,'升级城墙，稳住防线。');
   if(tower)return suggest(tower,'升级炮塔，增强防守。');
   if(b.level===2&&canRaise(b))return suggest(b,'基地升到三级，解锁伐木工。');
  }
  return null;
 }
 function wallPrerequisite(){
  reset();
  const q=wallGate,p=g.player;
  if(!q)return null;
  if(!solo()||!live(q.wall)||q.wall.level!==q.level||g.buildingBaseRequiredLevelBN(q.wall)!==q.need||now()>=q.until){wallGate=null;return null;}
  if(g.baseUpgradeGuideBN||g.roundStarting||g.roundLoading591||g.endlessOpeningIntro||g.placement||g.buildMenu||g.sessionMenuOpen||g.saveSlotsPanel||
    g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.batIntroCardBN?.visible?.()||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()||
    g.rewardAdBN?.pausesLive?.()||g.rotationInputBlocked398()||p.drivingTank||g.ghostElfAPI?.host)return null;
  const critical=g.criticalPlayerWall399?.(),red=critical===q.wall;
  if(critical&&!red||!red&&(priority.active(g)||g.cameraScenesR7?.active()||g.demonAttackFocus545||g.firstAttackCameraFocus))return null;
  let h=null;
  for(const b of g.indexedOwnerBuildings(null))if(b.type==='house'&&payable(b)&&g.easyOpeningGuideAllowsUpgrade(b)!==false&&
    (!h||b.level>h.level||b.level===h.level&&b.isInitialBase))h=b;
  const label=(red?'城墙告急，':'')+'先把基地升到 '+q.need+' 级，再升级城墙。';
  if(!h)return {label,mode:'ordinary',wallPrerequisite:true};
  const w=g.buildQueueAvailableBN?.()||p,c=h.upgradeCost(),canPay=w.wood>=c.wood&&w.gold>=c.gold;
  if(!canPay&&g.selectedBuilding===h){
   const need=[w.wood<c.wood?'木 '+Math.ceil(c.wood-w.wood):'',w.gold<c.gold?'金 '+Math.ceil(c.gold-w.gold):''].filter(Boolean).join('、');
   return {label:label+'基地还缺 '+need+'。',mode:'ordinary',wallPrerequisite:true};
  }
  if(g.selectedBuilding&&g.selectedBuilding!==h)return {label,mode:'base',target:g.getUpgradePanelLayout().closeBtn,wallPrerequisite:true};
  return {...baseHint(h,label),wallPrerequisite:true};
 }
 function pendingView(){return inWindow()?view():null;}
 const secondsIntoRound=()=>g.state==='prep'?Math.max(0,60-g.prepTimeLeft):60+Math.max(0,g.huntElapsed||0);
 function idle(){
  reset();
  const p=g.player,t=now();
  if(!solo()||secondsIntoRound()>=300||g.roundStarting||g.roundLoading591||p.ghostElf||p.inHouse||
    p.task||p.moveTarget||p.drivingTank||g.ghostElfAPI?.host||g.getPlayerBuildQueueBN?.().length){rest=null;return null;}
  const stick=g.stickVector();
  if(stick?.dx||stick?.dy||p.moveIntentX||p.moveIntentY){rest=null;return null;}
  if(!rest||t<rest.since||Math.abs(p.x-rest.x)>1||Math.abs(p.y-rest.y)>1)rest={x:p.x,y:p.y,since:t};
  return t-rest.since>=1200?rest:null;
 }
 const canGather=k=>g.player[k]<g.player[k==='wood'?'maxWood':'maxGold'];
 function idleView(row,cost,waitingIntro,allowDefault=false){
  const q=idle();
  if(!q||gated()||waitingIntro||g.buildMenu||g.selectedBuilding||g.placement||row?.target&&row.mode!=='gather')return null;
  const wanted=cost??(inWindow()?pending.cost:null);
  const match=row?.mode==='gather'&&(row.target?.id==='collectGold'?'gold':row.target?.id==='collectWood'?'wood':null);
  const missing=wanted&&(match&&g.player[match]<wanted[match]&&canGather(match)?match:balance(wanted));
  const k=missing&&canGather(missing)?missing:allowDefault&&canGather('wood')?'wood':null;
  if(!k)return null;
  const label=missing?'精灵在偷懒！点「'+name(k)+'」补资源。':'精灵在偷懒！先去伐木，备点资源。';
  const result=hint(k,label);
  if(!result)return null;
  return {...row,...result,idleBuild:true,welcome:false};
 }
 function drawIdleSleep(c,waitingIntro){
  const q=idle(),p=g.player;
  if(!q||gated()||waitingIntro||g.buildMenu||g.selectedBuilding||g.placement)return;
  const z=g.zoom(),w=g.screenToWorld(0,0),S=g.uiSafeRect396(),M=g.getMinimapRect();
  const x=(p.x-w.x)*z+7,y=(p.y-w.y)*z-Math.max(20,p.radius*z+13);
  if(x<S.x+18||x>S.right-42||y<g.topHudLayout().bottom+55||y>S.bottom-20||x>M.x-22&&x<M.x+M.w+12&&y<M.y+M.h+46)return;
  const sleepStart=q.since+1200;
  c.save();c.textAlign='center';c.textBaseline='middle';c.fillStyle='#FFFFFF';
  for(let i=0;i<2;i++){
   const t=((now()-sleepStart+i*840)%1680)/1680;if(t<0)continue;
   c.globalAlpha=Math.min(t*7,1)*(1-t);
   const size=11+10*t,tx=x+19*t,ty=y-37*t,txt=i?'z':'Zzz';
   c.font='900 '+size+'px "Arial Black", Helvetica, sans-serif';
   c.fillText(txt,tx,ty,size*(i?.58:1.42));
  }
  c.restore();
 }
 const upgrade=g.tryUpgradeBuilding;
 g.tryUpgradeBuilding=function(b,clicked,...a){
  const inspect=clicked&&solo()&&live(b),need=inspect&&g.buildingBaseRequiredLevelBN(b),cost=inspect&&(b.airDefenseKindBN?null:b.upgradeCost());
  const unlocked=inspect&&!g.buildingUpgradeBlockReason(b)&&b.canUpgrade()&&g.easyOpeningGuideAllowsUpgrade(b)!==false;
  const out=upgrade.call(this,b,clicked,...a);
  if(inspect&&!out&&!this.baseUpgradeGuideBN){
   if(need&&b.type==='wall'&&b.canUpgrade()&&this.validUpgradeCostR12(cost)&&this.easyOpeningGuideAllowsUpgrade(b)!==false){
    reset();wallGate={wall:b,level:b.level,need,until:now()+18000};this.passiveHintsR13?.earned();
   }else if(need)state({need,blocked:b,level:b.level});
   else if(unlocked&&this.validUpgradeCostR12(cost)&&balance(cost))state({cost,building:b,level:b.level});
  }
  return out;
 };
 const build=g.startBuildFromCatalog;
 g.startBuildFromCatalog=function(kind,...a){
  const e=catalog.find(e=>e.type===kind),level=e?.requires==='house2'?2:e?.requires==='house3'||e?.requires==='tankFactory'?3:0;
  const relevant=level&&solo()&&this.getOwnerMaxHouseLevel()<level&&!this.buildingCountBlockReason(kind)&&!this.isBuildUnlocked(e);
  const out=build.call(this,kind,...a);
  if(relevant&&!out)state({need:level,entry:e});
  return out;
 };
 const placement=g.handlePlacementTap;
 g.handlePlacementTap=function(x,y,...a){
  const p=this.placement,confirm=p&&solo()&&this.placementButtonAt(x,y)?.id==='placeConfirm';
  const out=placement.call(this,x,y,...a);
  if(confirm&&this.placement===p&&p.insufficientBN&&p.reason==='资源不足'){
   const cost={wood:p.woodCost,gold:p.goldCost};
   if(this.validUpgradeCostR12(cost)&&balance(cost))state({cost});
  }
  return out;
 };
 const saved=g.applySavedWorld;
 g.applySavedWorld=function(...a){const ok=saved.apply(this,a);if(ok){player=null;reset();early=-1;}return ok;};
 return {view,pendingView,afterWarehouse,wallPrerequisite,idleView,hasIdle:()=>!!idle(),drawIdleSleep};
}
module.exports={install};
