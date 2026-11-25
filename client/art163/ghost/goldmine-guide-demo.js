'use strict';
const soft=require('./soft-hint');
exports.install=function(g,runtime,catalog,Building,offline){
 const kind='goldMine',entry=catalog.find(b=>b.type===kind),notice=require('../../network/notice-priority');
 const radius=new Building(0,0,kind).radius,text=s=>runtime.nativeText(s),done=b=>b?.type===kind&&b.ownerSlot==null&&g.completedElfBuildingBN(b);
 let episode,site,generation,ore;
 const cash=()=>g.buildQueueAvailableBN?.()||g.player;
 const active=()=>offline()&&g.operationGuideModeR13?.()!==false&&!g.tutorial&&!g.superChallenge580&&['prep','hunt'].includes(g.state);
 function complete(){
  if(generation!==g.player){generation=g.player;episode=site=ore=null;
   if(g.indexedOwnerBuildings(null).some(b=>done(b)&&b.level>=3))g.goldMineGuideDonePreview=true;
  }
  return g.goldMineGuideDonePreview===true;
 }
 function reject(s,cost){
  if(!s||!cost||!active()||s.player!==g.player||complete()||g.getOwnerMaxHouseLevel()<3||Math.min(s.gold,cash().gold)>=cost.gold)return;
  if(!Number.isFinite(cost.gold)||cost.gold>g.player.maxGold)return;
  const chosen=s.action==='build'&&s.args?.type===kind||s.action==='upgrade'&&done(s.target);
  const e=episode?.player===s.player?episode:null;
  episode={player:s.player, target:done(s.target)?s.target:e?.target??null, paidMine:e?.paidMine===true};
  if(chosen)g.passiveHintsR13?.earned();
 }
 function naturalOre(p){
  const t=g.supportTime||0;
  if(ore?.x===p.x&&ore.y===p.y&&t>=ore.t&&t-ore.t<500&&ore.target?.gold>0&&!ore.target.dead)return ore.target;
  if(ore?.x===p.x&&ore.y===p.y&&t>=ore.t&&t-ore.t<500&&!ore.target)return null;
  const target=g.findTaskResource401?.({type:'gold',zoneIndex:g.resourceZoneIndexFor401(p),originX:p.x,originY:p.y,localRadius:1200})||null;
  ore={x:p.x,y:p.y,t,target};return target;
 }
 function fund(p,w,c,kind,b){
  const gold=Math.max(0,Math.ceil(c.gold-w.gold)),wood=Math.max(0,Math.ceil(c.wood-w.wood));
  const verb=kind==='build'?'建造':'升级',label=verb+'金矿厂';
  const buy=wood||gold?['木 '+wood,'金 '+gold].filter((_,i)=>i?gold:wood).join('、'):'';
  if(gold&&p.task?.type==='gold'&&p.task.phase==='return'&&p.carryGold>0)return{kind,copy:'正在运回金币，攒够后'+label+'。',buildCost:c};
  if(gold&&naturalOre(p)){
   if(p.task?.type==='gold'&&p.task.phase!=='wait')return{kind,copy:'正在'+(p.task.phase==='return'?'运回金币':'采矿')+'，攒够后'+label+'。',buildCost:c};
   const target=!g.selectedBuilding&&!g.buildMenu&&g.buttons.find(b=>b.id==='collectGold'&&b.w>0&&b.h>0&&b.visible!==false);
   if(target)return{kind,copy:'金币不足，点「采矿」为金矿厂攒钱。',target,mode:'gather',buildCost:c};
   return{kind,copy:label+'还缺'+buy+'，可先'+(g.selectedBuilding||g.buildMenu?'退出面板再':'')+'采矿。',buildCost:c};
  }
  if(gold)return{kind,copy:label+'还缺'+buy+'，'+(b||g.indexedOwnerBuildings(null).some(done)?'等金矿厂产金。':'附近已无可采金矿。'),buildCost:c};
  return{kind,copy:label+'还缺'+buy+'。',buildCost:c};
 }
 function available(){
  const home=g.indexedOwnerBuildings(null).find(b=>b.isInitialBase&&g.completedElfBuildingBN(b));if(!home)return false;
  const now=g.supportTime||0,n=g.buildings.length,grid=g.ordinaryBuildingGridAD,old=site;
  if(old&&old.home===home&&old.n===n&&now>=old.now&&now-old.now<2000)return old.ok;
  site={home,n,now,ok:false};const u=grid?.unit||100,geom=g.placementGeometry621;if(!geom)g.placementGeometry621=new Map();
  try{
   for(const r of [2,3,4])for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const x=home.x+dx*r*u,y=home.y+dy*r*u,p=grid?.nearest(x,y,kind)||{x,y};
    if(!g.buildQueuePlacementReasonBN?.(kind,p.x,p.y)&&g.canPlaceBuilding(p.x,p.y,radius,kind)){site.ok=true;return true;}
   }
  }finally{if(!geom)g.placementGeometry621=null;}
  return false;
 }
 const up=b=>done(b)&&b.level<3&&b.canUpgrade()&&!g.buildingUpgradeBlockReason(b)&&b.upgradeCost();
 function view(skipTower=false){
  if(!active()||g.midEconomyGuideR13?.ownsLatePlan?.())return null;
  const p=g.player;
  if(!p||p.dead||complete()||g.getOwnerMaxHouseLevel()<3||p.drivingTank||p.ghostElf||g.ghostElfAPI?.host)return null;
  if(!skipTower&&g.demonTowerGuidePreview?.view()||runtime.hidden||notice.economy(g)||g.wallHalfGuideDemo?.urgent?.()||g.wallBaseLevelGuideDemo?.active?.()||g.antiAirGuidePreview?.view(skipTower)
   ||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()
   ||g.rewardAdBN?.pausesLive?.()||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony
   ||g.cameraScenesR7?.active()||g.rotationInputBlocked398()||g.roundLoading591||g.placement
   ||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===kind))return null;
  const w=cash(),explicit=g.selectedBuilding,own=g.indexedOwnerBuildings(null);
  // Keep an already opened real Lv3 base for its worker affordance.
  if(explicit?.type==='house'&&explicit.ownerSlot==null&&explicit.level>=3&&g.completedElfBuildingBN(explicit)&&w.wood*3<p.maxWood&&
    g.getPeasantCount()<4&&!g.peasantBlockReason(explicit)&&g.easyOpeningGuideAllowsAction('makePeasantBtn',explicit)!==false)return null;
  const fits=c=>!!c&&c.wood<=p.maxWood&&c.gold<=p.maxGold,can=c=>!!c&&w.wood>=c.wood&&w.gold>=c.gold;
  const eligible=b=>{const c=up(b);return c&&fits(c);};
  let e=episode?.player===p?episode:null;
  if(!e&&w.gold>=entry.gold)return null;
  let mineCount=0,b=null,best=Infinity,affordable=null,cheap=Infinity;
  for(const a of own){if(!done(a))continue;mineCount++;const c=up(a);if(!fits(c))continue;
   const d=(a.x-p.x)**2+(a.y-p.y)**2;if(d<best){best=d;b=a;}
   if(can(c)&&d<cheap){cheap=d;affordable=a;}
  }
  // With no completed income, even a first Lv3 poor wallet needs an affordance
  // rather than waiting for the player to tap an already disabled project.
  if(!e){
   if(mineCount)return null;
   e=episode={player:p,target:null,paidMine:false};
  }
  const canStart=()=>fits(entry)&&!g.buildingCountBlockReason(kind)&&g.isBuildUnlocked(entry)&&g.easyOpeningGuideAllowsBuild(kind)!==false&&available();
  const chosen=eligible(explicit)?explicit:eligible(e.target)&&can(up(e.target))?e.target:affordable||b;
  const c=chosen&&up(chosen),maybeBuild=!explicit||!done(explicit);
  // One new mine per shortage episode, and no spending an endless list of
  // Lv1 mines when a funded move toward the existing Lv3 target is available.
  const wantBuild=!mineCount||maybeBuild&&!e.paidMine&&mineCount<3&&!can(c)&&can(entry);
  if(chosen&&!wantBuild){
   e.target=chosen;
   if(!can(c))return fund(p,w,c,'upgrade',chosen);
   let target;
   if(g.buildMenu)target=g.getBuildMenuLayout().closeBtn;
   else if(explicit){const L=g.getUpgradePanelLayout();target=explicit!==chosen?L.closeBtn:L.upgradeBtn;}
   else{
    const S=g.uiSafeRect396(),M=g.getMinimapRect(),z=g.zoom(),x=(chosen.x-g.camera.x)*z,y=(chosen.y-g.camera.y)*z-45;
    if(x>S.x+29&&x<S.right-29&&y>g.topHudLayout().bottom+38&&y<S.bottom-104&&!(x>M.x-25&&x<M.x+M.w+25&&y<M.y+M.h+30))target={x:x-1,y,w:2,h:0};
   }
   return{kind:'upgrade',copy:'把金矿厂升到 Lv'+(chosen.level+1)+'，加快产金。',target};
  }
  if(!canStart())return chosen&&!can(c)?fund(p,w,c,'upgrade',chosen):null;
  let copy='建一座金矿厂，持续补充金币。',mode='down',target;
  if(!can(entry))return fund(p,w,entry,'build',null);
  if(explicit)target=g.getUpgradePanelLayout().closeBtn;
  else if(!g.buildMenu){e.resourceTab=false;target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
  else{
   const L=g.getBuildMenuLayout(),page=entry.page||0;
   if(g.buildMenuPage!==page){target=soft.catalogTab(g,L,page);copy=soft.catalogHint(g,page)+'建造金矿厂。';}
   else{
    const b=L.rows.find(r=>r.entry.type===kind)?.rect,c=L.listRect;
    target=soft.catalogRow(g,L,b,kind);mode=target?.scrollDown?'scroll':'row';if(target?.scrollDown)copy=soft.scrollCopy('金矿厂');else if(!target&&b&&L.maxScroll)copy='向上滑，找到金矿厂。';
   }
  }
  return{kind:'build',copy,target,mode};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  if(g.defenseGuideDemo?.idleOwns?.())return;
  const a=view();if(!a)return;
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const box=soft.layout(C,Math.min(294,S.w-44),[[text(a.copy)]]),x=S.x+(S.w-box.w)/2;
  let y=Math.max(g.topHudLayout().bottom+35,M.y+M.h+25);
  if(L)y=L.y+L.h+box.h+7<S.bottom-50?L.y+L.h+6:Math.max(S.y+5,L.y-box.h-6);
  const t=a.target;
  g.passiveHintsR13?.target(t);
  if(!t){soft.paint(C,x,Math.min(y,S.bottom-box.h-10),box);}
  if(t)soft.buildArrow(g,C,t,1.3,box);
 }
 const tap=g.handleBuildMenuTap;
 g.handleBuildMenuTap=function(x,y,...args){
  if(episode?.player===g.player&&g.buildMenu){const b=g.getBuildMenuLayout().pageTabs?.find(t=>t.page===(entry.page||0));if(b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)episode.resourceTab=true;}
  return tap.call(this,x,y,...args);
 };
 const commit=g.updatePlayerBuild506;
 g.updatePlayerBuild506=function(...a){
  const watch=episode?.player===g.player&&g.player.task?.buildType===kind,n=watch&&g.buildings.length,out=commit.apply(this,a);
  if(watch&&g.buildings.length>n&&done(g.buildings[g.buildings.length-1])){episode.paidMine=true;episode.target=g.buildings[g.buildings.length-1];}
  return out;
 };
 const upgrade=g.tryUpgradeBuilding;
 g.tryUpgradeBuilding=function(b,...a){const lv=b?.level,out=upgrade.call(this,b,...a);if(out&&done(b)&&b.level>lv){if(b.level>=3){g.goldMineGuideDonePreview=true;episode=null;}else if(episode?.player===g.player)episode.target=b;}return out;};
 const original=g.draw;g.draw=function(...args){const out=original.apply(this,args);if(g.player&&active())complete();draw();return out;};
 g.goldMineGuidePreview={reject,view,actionPending:()=>episode?.player===g.player,ownsLate:()=>active()&&g.getOwnerMaxHouseLevel()>=3};
};
