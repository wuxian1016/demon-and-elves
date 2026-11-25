'use strict';
const soft=require('./soft-hint');
exports.install=function(g,runtime,catalog,Building,cost,robotCost,offline){
 const kind='tankFactory',robotKind='robotFactory',entry=catalog.find(e=>e.type===kind),robotEntry=catalog.find(e=>e.type===robotKind),notice=require('../../network/notice-priority');
 const rads={[kind]:new Building(0,0,kind).radius,[robotKind]:new Building(0,0,robotKind).radius},text=x=>runtime.nativeText(x);
 const own=b=>b?.ownerSlot==null&&g.completedElfBuildingBN(b);
 let generation,site,counts=null;
 function synchronize(){
  if(generation===g.player)return;generation=g.player;site=counts=null;
  // An already paid factory order in an older save is real history. An
  // unlabelled pre-existing free/earned vehicle only blocks via the native slot.
  for(const b of g.indexedOwnerBuildings(null))if(own(b)){
   if(b.type===kind&&b.tankOrder)g.tankEconomyGuideDonePreview=true;
   if(b.type===robotKind&&b.robotOrderPF)g.robotEconomyGuideDonePreview=true;
  }
 }
 function count(){
  const n=g.navigationFrame,rows=g.indexedOwnerBuildings(null),old=counts;
  if(old&&old.n===n&&old.rows===rows&&old.peasants===g.peasants&&old.num===g.peasants.length)return old;
  let mines=0,towers=0,towers6=0,wall=0,factory=null,openFactory=false;
  for(const b of rows){
   if(!own(b))continue;
   if(b.type==='goldMine')mines++;
   else if(g.isDefenseGuideTowerType(b.type)){towers++;if(b.level>=6)towers6++;}
   else if(b.type==='wall')wall=Math.max(wall,b.level);
   else if(b.type===kind){factory??=b;if(g.easyOpeningGuideAllowsAction('tankFactoryBtn',b))openFactory=true;}
  }
  return counts={n,rows,peasants:g.peasants,num:g.peasants.length,mines,towers,towers6,wall,factory,openFactory,workers:g.getPeasantCount()};
 }
 function hasSite(type=kind){
  const home=g.indexedOwnerBuildings(null).find(b=>b.type==='house'&&b.isInitialBase&&own(b));if(!home)return false;
  const now=g.supportTime||0,n=g.buildings.length,grid=g.ordinaryBuildingGridAD,old=site;
  if(old&&old.type===type&&old.home===home&&old.n===n&&now>=old.now&&now-old.now<2000)return old.ok;
  site={type,home,n,now,ok:false};const unit=grid?.unit||100,geom=g.placementGeometry621;if(!geom)g.placementGeometry621=new Map();
  try{
   for(const r of[2,3,4,5])for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const x=home.x+dx*r*unit,y=home.y+dy*r*unit,p=grid?.nearest(x,y,type)||{x,y};
    if(!g.buildQueuePlacementReasonBN?.(type,p.x,p.y)&&g.canPlaceBuilding(p.x,p.y,rads[type],type)){site.ok=true;return true;}
   }
  }finally{if(!geom)g.placementGeometry621=null;}
  return false;
 }
 function ready(){
  if(!g.player||!offline()||g.state!=='hunt'||g.player.dead||!entry||!cost||g.tutorial||g.superChallenge580)return false;
  synchronize();
  return !(g.demonTowerGuidePreview?.view()||runtime.hidden||notice.economy(g)||g.wallBaseLevelGuideDemo?.active?.()||g.antiAirGuidePreview?.view()||g.goldMineGuidePreview?.view()||g.woodWorkforcePreview?.view()
   ||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()
   ||g.rewardAdBN?.pausesLive?.()||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony
   ||g.cameraScenesR7?.active()||g.rotationInputBlocked398()||g.roundLoading591||g.placement
   ||g.goldShortageGuideBN?.busy?.()||g.resourceCapPreview?.busy?.());
 }
 function tank(){
  const p=g.player;
  if(g.tankEconomyGuideDonePreview||p.wood<cost.wood||p.gold<cost.gold||g.playerVehicleSlotUsed())return null;
  const q=count();
  if(q.workers<10||q.mines<10||q.towers<7||q.wall<8)return null;
  let mode='down',copy,target;
  const explicit=g.selectedBuilding;
  if(q.factory&&q.openFactory){
   copy='经济和防线准备好了，可以制造坦克。';
   if(g.buildMenu)target=g.getBuildMenuLayout().closeBtn;
   else if(explicit){const L=g.getUpgradePanelLayout();target=explicit.type===kind&&own(explicit)&&!explicit.tankOrder&&g.easyOpeningGuideAllowsAction('tankFactoryBtn',explicit)?L.tankFactoryBtn:L.closeBtn;}
   else{
    const S=g.uiSafeRect396(),M=g.getMinimapRect(),z=g.zoom();let best=Infinity;
    for(const b of q.rows)if(b.type===kind&&own(b)&&!b.tankOrder&&g.easyOpeningGuideAllowsAction('tankFactoryBtn',b)){
     const x=(b.x-g.camera.x)*z,y=(b.y-g.camera.y)*z-54,d=(b.x-p.x)**2+(b.y-p.y)**2;
     if(x>S.x+27&&x<S.right-27&&y>g.topHudLayout().bottom+35&&y<S.bottom-105&&!(x>M.x-25&&x<M.x+M.w+25&&y<M.y+M.h+30)&&d<best){target={x:x-1,y,w:2,h:0};best=d;}
    }
   }
   return{kind:'make',mode,copy,target};
  }
  if(q.factory||q.rows.some(b=>!b.dead&&b.ownerSlot==null&&b.type===kind)||p.wood<entry.wood+cost.wood||p.gold<entry.gold+cost.gold||!g.isBuildUnlocked(entry)||g.easyOpeningGuideAllowsBuild(kind)===false
   ||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===kind)||!hasSite())return null;
  copy='物资够了，先建坦克厂，再制造坦克。';
  if(explicit)target=g.getUpgradePanelLayout().closeBtn;
  else if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
  else{
   const L=g.getBuildMenuLayout();
   if(g.buildMenuPage!==entry.page){target=soft.catalogTab(g,L,entry.page);copy=soft.catalogHint(g,entry.page)+'建造坦克厂。';}
   else{
    const b=L.rows.find(r=>r.entry.type===kind)?.rect,c=L.listRect;
    target=soft.catalogRow(g,L,b,kind);mode=target?.scrollDown?'scroll':'row';if(target?.scrollDown)copy=soft.scrollCopy('坦克厂');else if(!target&&b&&L.maxScroll)copy='向上滑，找到坦克厂。';
   }
  }
  return{kind:'factory',mode,copy,target};
 }
 function robot(){
  const p=g.player;
  if(g.robotEconomyGuideDonePreview||!robotEntry||!robotCost||!g.robotUnlocked()||p.wood<robotCost.wood||p.gold<robotCost.gold)return null;
  const q=count();if(q.mines<20||q.towers6<8||q.wall<11)return null;
  const chassis=g.tanks.find(t=>!t.dead&&t.ownerSlot==null&&!t.isRobot);
  if(!chassis||g.tanks.some(t=>!t.dead&&t.ownerSlot==null&&t.isRobot)||q.rows.some(b=>!b.dead&&b.ownerSlot==null&&b.robotOrderPF))return null;
  let mode='down',target,copy;
  const explicit=g.selectedBuilding,models=g.factoryModelsBN;
  const able=b=>{
   if(b?.type!==robotKind||!own(b)||b.robotOrderPF)return false;
   const model=models?.pick(b)||'stock';
   if(model==='ghost'&&(!models.unlocked()||!models.owned(b)))return false;
   const price=model==='ghost'?models.price(model):robotCost;
   if(!price||p.wood<price.wood||p.gold<price.gold)return false;
   const t=g.findRobotUpgradeTank(b);
   return !!t&&g.guidedRepairMission399?.()?.vehicle!==t;
  };
  if(q.rows.some(able)){
   copy='防线和经济达标，可以在机器人工厂制造机器人。';
   if(g.buildMenu)target=g.getBuildMenuLayout().closeBtn;
   else if(explicit){const L=g.getUpgradePanelLayout();target=able(explicit)?L.robotFactoryBtn:L.closeBtn;}
   else{
    const S=g.uiSafeRect396(),M=g.getMinimapRect(),z=g.zoom();let best=Infinity;
    for(const b of q.rows)if(able(b)){const x=(b.x-g.camera.x)*z,y=(b.y-g.camera.y)*z-61,d=(b.x-p.x)**2+(b.y-p.y)**2;
     if(x>S.x+27&&x<S.right-27&&y>g.topHudLayout().bottom+35&&y<S.bottom-105&&!(x>M.x-25&&x<M.x+M.w+25&&y<M.y+M.h+30)&&d<best){target={x:x-1,y,w:2,h:0};best=d;}
    }
   }
   return{kind:'robot',mode,copy,target};
  }
  if(q.rows.some(b=>b.type===robotKind&&!b.dead&&b.ownerSlot==null)||p.wood<robotEntry.wood+robotCost.wood||p.gold<robotEntry.gold+robotCost.gold
   ||!g.isBuildUnlocked(robotEntry)||g.easyOpeningGuideAllowsBuild(robotKind)===false||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===robotKind)||!hasSite(robotKind))return null;
  copy='物资够了，先建机器人工厂，再改造坦克。';
  if(explicit)target=g.getUpgradePanelLayout().closeBtn;
  else if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
  else{
   const L=g.getBuildMenuLayout();
   if(g.buildMenuPage!==robotEntry.page){target=soft.catalogTab(g,L,robotEntry.page);copy=soft.catalogHint(g,robotEntry.page)+'建造机器人工厂。';}
   else{const b=L.rows.find(r=>r.entry.type===robotKind)?.rect,c=L.listRect;
    target=soft.catalogRow(g,L,b,robotKind);mode=target?.scrollDown?'scroll':'row';if(target?.scrollDown)copy=soft.scrollCopy('机器人工厂');else if(!target&&b&&L.maxScroll)copy='向上滑，找到机器人工厂。';
   }
  }
  return{kind:'robotFactory',mode,copy,target};
 }
 function view(){
  const a=ready()&&(tank()||robot());if(!a)return null;
  const isRobot=a.kind==='robotFactory'||a.kind==='robot',build=a.kind==='factory'||a.kind==='robotFactory';
  // The action on the active panel wins; do not tell players to dismiss another panel.
  if(g.selectedBuilding&&(!a.target||a.target===g.getUpgradePanelLayout().closeBtn||g.selectedBuilding.type!==(isRobot?robotKind:kind)))return null;
  const step=build?1:2,which=isRobot?'robot':'tank',label=isRobot?'机器人':'坦克';
  return {...a,which,step,copy:step+'/4 '+(build?'建造'+(isRobot?'机器人工厂':'坦克厂'):'制造'+label)};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  const a=view();if(!a)return;
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const box=soft.layout(C,Math.min(302,S.w-44),[[text(a.copy)]]),x=S.x+(S.w-box.w)/2;
  let y=Math.max(g.topHudLayout().bottom+35,M.y+M.h+25);
  if(L)y=L.y+L.h+box.h+7<S.bottom-50?L.y+L.h+6:Math.max(S.y+5,L.y-box.h-6);
  const t=a.target;
  g.passiveHintsR13?.target(t);
  if(!t){soft.paint(C,x,Math.min(y,S.bottom-box.h-10),box);}
  if(t)soft.buildArrow(g,C,t,1.3,box);
 }
 const make=g.tryManufactureTank;
 g.tryManufactureTank=function(b,...a){
  const started=make.call(this,b,...a);
  if(started&&offline()&&b?.type===kind&&own(b)&&b.tankOrder)g.tankEconomyGuideDonePreview=true;
  return started;
 };
 const convert=g.tryTransformTankToRobot;
 g.tryTransformTankToRobot=function(b,owner=this.player,silent=false,...a){
  const accepted=convert.call(this,b,owner,silent,...a);
  if(accepted&&offline()&&owner===this.player&&b?.type===robotKind&&own(b))g.robotEconomyGuideDonePreview=true;
  return accepted;
 };
 const drawBase=g.draw;g.draw=function(...a){const out=drawBase.apply(this,a);draw();return out;};
 g.tankEconomyGuidePreview={view};
};
