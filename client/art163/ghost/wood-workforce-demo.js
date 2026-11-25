'use strict';
const soft=require('./soft-hint');
exports.install=function(g,runtime,entries,Building,offline){
 const H='houseForPeasants',h=entries.find(row=>row.type===H),radius=new Building(0,0,H).radius;
 const notice=require('../../network/notice-priority');
 const cash=()=>g.buildQueueAvailableBN?.()||g.player;
 const canPay=(w,c)=>!!c&&Number.isFinite(c.wood)&&Number.isFinite(c.gold)&&w.wood>=c.wood&&w.gold>=c.gold;
 const short=(w,c)=>[c.wood>w.wood&&'木 '+Math.ceil(c.wood-w.wood),c.gold>w.gold&&'金 '+Math.ceil(c.gold-w.gold)].filter(Boolean).join('、');
 const text=s=>runtime.nativeText(s),own=b=>b.ownerSlot==null&&g.completedElfBuildingBN(b);
 let episode=null,site=null,generation;
 const isHouse=b=>b?.type===H&&own(b);
 function done(){
  if(generation!==g.player){
   generation=g.player;
   if(g.indexedOwnerBuildings(null).some(b=>isHouse(b)&&b.level>=3)){g.workforceHousePhasePreview=3;g.workforceHouseGuideBuildingPreview=null;}
  }
  return g.workforceHousePhasePreview===3;
 }
 function home(){
  let any=null;
  for(const b of g.indexedOwnerBuildings(null))if(b.type==='house'&&own(b)&&b.level>=b.maxUpgradeLevel()){
   if(b.isInitialBase)return b;
   if(!any)any=b;
  }
  return any;
 }
 function reject(snapshot,message){
  const p=g.player;
  if(!offline()||g.tutorial||!['prep','hunt'].includes(g.state)||!p||p.dead||snapshot.player!==p||!['build','upgrade'].includes(snapshot.action)||!snapshot.cost||!(Math.min(snapshot.wood,cash().wood)<snapshot.cost.wood)||!/资源不足|^升级需要 木\d+ 金\d+/.test(message))return;
  if(!home()||done())return;
  if(episode?.player===p&&episode.phase!=='recruit')return;
  const known=g.workforceHouseGuideBuildingPreview;
  episode=isHouse(known)&&known.level<3&&g.workforceHousePhasePreview>0?
   {player:p,cost:snapshot.cost.wood,phase:'upgrade',house:known,level:known.level}:{player:p,cost:snapshot.cost.wood,phase:'recruit'};
  site=null;
 }
 function legalSite(base){
  const now=g.supportTime||0,grid=g.ordinaryBuildingGridAD,n=g.buildings.length,old=site;
  if(old&&old.base===base&&old.n===n&&now>=old.when&&now-old.when<2000)return old.ok;
  const u=grid?.unit||100,d=g.placementGeometry621;
  if(!d)g.placementGeometry621=new Map();
  site={base,n,when:now,ok:false};
  try {
   for(const m of [2,3,4]) for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const x=base.x+dx*m*u,y=base.y+dy*m*u,p=grid?.nearest(x,y,H)||{x,y};
    if(!g.buildQueuePlacementReasonBN?.(H,p.x,p.y)&&g.canPlaceBuilding(p.x,p.y,radius,H)){site.ok=true;return true;}
   }
  }finally{if(!d)g.placementGeometry621=null;}
  return false;
 }
 function world(b){
  const S=g.uiSafeRect396(),M=g.getMinimapRect(),z=g.zoom();
  const x=(b.x-g.camera.x)*z,y=(b.y-g.camera.y)*z-33;
  if(x>S.x+25&&x<S.right-25&&y>g.topHudLayout().bottom+36&&y<S.bottom-105&&!(x>M.x-24&&x<M.x+M.w+24&&y<M.y+M.h+30))return{x:x-1,y,w:2,h:0};
  return null;
 }
 // Early teaches the real Lv3 recruiter, independent of the mature 50-worker plan.
 const earlyEligible=()=>offline()===true&&g.operationGuideModeR13?.()!==false&&['prep','hunt'].includes(g.state)&&g.player&&!g.player.dead&&!g.player.defected;
 const starter=()=>g.indexedOwnerBuildings(null).find(b=>b.type==='house'&&b.isInitialBase&&b.level>=3&&own(b))||home();
 const scarcity=p=>p.maxWood>0&&Math.min(p.wood,cash().wood)*3<p.maxWood;
 function earlyView(){
  const p=g.player;if(!earlyEligible()||!scarcity(p)||g.passiveHintsR13?.quiet()||runtime.hidden||g.roundStarting||g.roundLoading591||
   g.endlessOpeningIntro||g.popupActive515()&&!g.selectedBuilding||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||
   g.buildMenu||g.placement||g.ceremony||g.cameraPeek||g.cameraScenesR7?.active()||g.cameraScenesR7?.mapCueVisible?.()||g.firstAttackCameraFocus||g.demonAttackFocus545||
   notice.economy(g)||g.rotationInputBlocked398()||g.cardPresentation?.modal()||g.rewardAdBN?.pausesLive?.()||p.drivingTank||g.ghostElfAPI?.host)return null;
  const base=starter(),n=g.getPeasantCount(),cap=g.getPeasantCap();
  if(!base||n>=4||n>=cap||g.selectedBuilding&&g.selectedBuilding!==base||g.easyOpeningGuideAllowsAction('makePeasantBtn',base)===false)return null;
  const why=g.peasantBlockReason(base),shortage=why.startsWith('资源不足');
  if(why&&!shortage)return null;
  const target=shortage?null:g.selectedBuilding===base?g.getUpgradePanelLayout().makePeasantBtn:world(base);
  if(!target&&!g.selectedBuilding)return null;
  const copy=shortage?why.replace('资源不足','招募伐木工需要')+'。':'木材不够，制造伐木小精灵，让它替你伐木。';
  return {type:'earlyRecruit',target,mode:'down',copy};
 }
 function view(skipTower=false){
  if(g.midEconomyGuideR13?.ownsLatePlan?.())return null;
  const p=g.player;
  if(!episode||episode.player!==p||p.dead||done()||episode.phase==='recruit'&&p.wood>=episode.cost){episode=null;return earlyView();}
  if(!skipTower&&g.demonTowerGuidePreview?.view()||g.batIntroCardBN?.visible?.()||g.antiAirGuidePreview?.view(skipTower)||g.goldMineGuidePreview?.view(skipTower)||!offline()||g.state!=='hunt'&&!(episode.starter&&g.state==='prep')||runtime.hidden||g.tutorial||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.rewardAdBN?.pausesLive?.()||g.cardPresentation?.modal()||g.cameraScenesR7?.active()||g.rotationInputBlocked398()||notice.economy(g)||g.wallBaseLevelGuideDemo?.active?.()||g.goldShortageGuideBN?.busy?.()||g.resourceCapPreview?.busy?.())return null;
  const base=home();if(!base)return null;
  const cap=g.getPeasantCap(),n=g.getPeasantCount();
  const wallet=cash();
  if(episode.phase==='recruit'&&n>=cap&&!g.buildingCountBlockReason(H))episode.phase='housing';
  let target=null,mode='down',type,copy;
  if(episode.phase==='upgrade'){
   const b=episode.house;
   if(!b||!own(b)||b.level!==episode.level){episode=null;return null;}
   if(g.buildingUpgradeBlockReason(b)||!b.canUpgrade()||g.buildingCountBlockReason(H))return null;
   type='upgrade';copy='房屋升到 Lv'+(b.level+1)+'，可以增加更多人口。';
   const L=g.selectedBuilding?g.getUpgradePanelLayout():null,f=b.upgradeCost();
   if(g.placement||!f)return null;
   if(!canPay(wallet,f))return {type,target:null,mode,copy:'升级房屋还缺'+short(wallet,f)+'。'};
   if(g.buildMenu)target=g.getBuildMenuLayout().closeBtn;
   else if(L)target=g.selectedBuilding!==b?L.closeBtn:L.upgradeBtn;
   else target=world(b);
  }else if(episode.phase==='recruit'){
   if(g.placement||n>=cap&&g.buildingCountBlockReason(H))return null;
   type='recruit';const reason=g.peasantBlockReason(base),needs=/资源不足/.test(reason),full=n>=cap&&/人口已满/.test(reason);
   if(reason&&!needs&&!full)return null;
   copy=needs?'先凑木15、金5，再招募伐木工。':'木材不够了，招募伐木工补充木材。';
   if(needs)return {type,target:null,mode,copy};
   if(g.buildMenu){target=g.getBuildMenuLayout().closeBtn;}
   else if(g.selectedBuilding){const L=g.getUpgradePanelLayout();target=g.selectedBuilding===base?(!needs&&L.makePeasantBtn||null):L.closeBtn;}
   else target=world(base);
  }else{
   if(g.buildingCountBlockReason(H)||!g.isBuildUnlocked(h)||g.easyOpeningGuideAllowsBuild(H)===false||!legalSite(base))return null;
   type='housing';
   const can=canPay(wallet,h);
   copy=can?'人口已满，建一座房屋，就能招更多伐木工。':'建造房屋还缺'+short(wallet,h)+'。';
   if(g.placement||g.getPlayerBuildQueueBN?.().some(o=>o.buildType===H))return null;
   if(can){
    if(g.selectedBuilding)target=g.getUpgradePanelLayout().closeBtn;
    else if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
    else {
     const L=g.getBuildMenuLayout();
     if(g.buildMenuPage!==h.page){target=soft.catalogTab(g,L,h.page);copy=soft.catalogHint(g,h.page)+'建造房屋。';}
     else{
      const row=L.rows?.find(b=>b.entry.type===H)?.rect;target=soft.catalogRow(g,L,row,H);mode=target?.scrollDown?'scroll':'row';
      if(target?.scrollDown)copy=soft.scrollCopy('房屋');else if(!target&&row&&L.maxScroll)copy='向上滑，找到房屋。';
     }
    }
   }
  }
  return{type,target,mode,copy,buildCost:type==='housing'&&!target&&!canPay(wallet,h)?h:null};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  const a=view();if(!a||a.type!=='earlyRecruit'&&g.defenseGuideDemo?.idleOwns?.())return;
  const S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null,C=g.ctx;
  const box=soft.layout(C,Math.min(303,S.w-44),[[text(a.copy)]]),x=S.x+(S.w-box.w)/2;
  let y=Math.max(g.topHudLayout().bottom+35,M.y+M.h+25);
  if(L)y=L.y+L.h+box.h+7<S.bottom-50?L.y+L.h+6:Math.max(S.y+5,L.y-box.h-6);
  const t=a.target;
  g.passiveHintsR13?.target(t);
  if(!t){soft.paint(C,x,Math.min(y,S.bottom-box.h-10),box);}
  if(t)soft.buildArrow(g,C,t,1.3,box);
 }
 const tap=g.handleTap;
 g.handleTap=function(...args){
  const was=this.selectedBuilding,out=tap.apply(this,args),base=this.selectedBuilding;
  if(base?.type==='house'&&base!==was&&base.level>=3&&earlyEligible()&&scarcity(g.player)&&g.getPeasantCount()<4&&g.getPeasantCount()<g.getPeasantCap()&&base===starter()&&!this.peasantBlockReason(base))g.passiveHintsR13?.earned();
  return out;
 };
 const recruit=g.tryMakePeasant;
 g.tryMakePeasant=function(b,owner=null,silent=false,...args){
  const e=episode,match=e?.phase==='recruit'&&e.player===g.player&&owner==null&&!silent&&b===home();
  const next=!e&&owner==null&&!silent&&earlyEligible()&&b===starter()&&g.getPeasantCount()>=4&&g.getPeasantCount()>=g.getPeasantCap()&&!g.midEconomyGuideR13?.ownsLatePlan?.();
  const why=(match||next)&&g.peasantBlockReason(b);
  const out=recruit.call(this,b,owner,silent,...args);
  if(!out&&next&&/人口已满/.test(why)&&!done()&&!notice.economy(g)&&!g.buildingCountBlockReason(H)){
   episode={player:g.player,phase:'housing',starter:true};g.passiveHintsR13?.earned();
  }
  if(match&&episode===e){
   if(out)episode=null;
   else if(/人口已满/.test(why)&&!g.buildingCountBlockReason(H))e.phase='housing';
  }
  return out;
 };
 const commit=g.updatePlayerBuild506;
 g.updatePlayerBuild506=function(...args){
  const e=episode,track=e?.phase==='housing'&&e.player===g.player&&g.player.task?.buildType===H,len=g.buildings.length;
  const out=commit.apply(this,args);
  if(track&&episode===e&&g.buildings.length>len){const b=g.buildings[g.buildings.length-1];if(isHouse(b)){e.phase='upgrade';e.house=b;e.level=b.level;g.workforceHousePhasePreview=1;g.workforceHouseGuideBuildingPreview=b;}}
  return out;
 };
 const buy=g.tryUpgradeBuilding;
 g.tryUpgradeBuilding=function(b,...args){const e=episode,level=b?.level,out=buy.call(this,b,...args);
  if(out&&args[0]===true&&b.type==='house'&&level<3&&b.level>=3&&earlyEligible()&&own(b)&&scarcity(g.player))g.passiveHintsR13?.earned();
  if(out&&isHouse(b)){if(b.level>=3){g.workforceHousePhasePreview=3;g.workforceHouseGuideBuildingPreview=null;episode=null;}
   else if(e?.house===b&&e.level<b.level&&e.player===g.player){g.workforceHousePhasePreview=2;episode=null;}
  }return out;};
 g.woodWorkforcePreview={reject,view,actionPending:()=>episode?.player===g.player,preClick:b=>episode?.phase==='recruit'&&episode.player===g.player&&b===home()&&!done()&&g.getPeasantCount()>=g.getPeasantCap()&&!g.buildingCountBlockReason(H)&&!notice.economy(g)};
 const original=g.draw;g.draw=function(...args){const result=original.apply(this,args);if(g.player&&g.state==='hunt')done();draw();return result;};
 require('./mid-economy-guide-r13').install(g,runtime,entries,Building,offline);
};
