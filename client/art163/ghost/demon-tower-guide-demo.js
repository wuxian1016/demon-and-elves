'use strict';
const soft=require('./soft-hint');
exports.install=function(g,runtime,catalog,offline){
 const plan=['','iceTower','tower','manaTower','','watchtower','watchtower'],intro=[
  null,['冰霜塔：压制敌人','冰弹降低攻速，高等级还能减慢移动。'],
  ['箭塔：主要单体输出','对付恶魔或石头人时，可多建几座集中输出。'],
  ['魔法光塔：消耗恶魔魔力','持续消耗魔力，限制恶魔施放技能。'],
  null,['哨塔：为覆盖内的防线提供增益','升到 Lv2，覆盖内的炮塔、箭塔、冰霜塔、','魔法光塔提高攻击力和射程。'],
  ['升级哨塔：扩大防线优势','升到 Lv2，覆盖内的炮塔、箭塔、冰霜塔、','魔法光塔提高攻击力和射程。']
 ],buildTitles=['','建造冰霜塔','建造箭塔','建造魔法光塔'];
 const notice=require('../../network/notice-priority'),text=x=>runtime.nativeText(x),own=b=>b?.ownerSlot==null&&g.completedElfBuildingBN(b);
 const entries=new Map(catalog.map(e=>[e.type,e]));
 const showed=1400;
 let visibleAt=null,wrapAt=null,generation=null,sample;
 function census(){
  const a=g.indexedOwnerBuildings(null),now=g.supportTime||0,r=g.groundObstacleRevision,ar=g.watchtowerAuraRevision,builds=g.buildings,old=sample;
  if(old&&old.a===a&&old.r===r&&old.ar===ar&&old.builds===builds&&old.len===builds.length&&now>=old.now&&now-old.now<220)return old;
  const towers={iceTower:[],tower:[],manaTower:[],watchtower:[]};
  for(const b of a)if(own(b)&&Object.prototype.hasOwnProperty.call(towers,b.type)&&!(b.type==='tower'&&b.airDefenseKindBN))towers[b.type].push(b);
  return sample={a,now,r,ar,builds,len:builds.length,towers};
 }
 const count=kind=>census().towers[kind]?.length||0;
 const watch=()=>census().towers.watchtower;
 const readyForWatch=()=>count('iceTower')&&count('tower')>=2&&count('manaTower');
 const scope=()=>offline()&&g.state==='hunt'&&!g.player?.dead&&!g.tutorial&&!g.superChallenge580;
 function hit(victim,source){
  if((g.demonTowerGuideStagePreview??0)!==0||!scope()||source!==g.troll||!own(victim)||!g.buildings.includes(victim))return;
  g.demonTowerGuideStagePreview=1;g.demonTowerGuideIntroMsPreview=0;
 }
 function clear(){
  return runtime.hidden||g.baseUpgradeGuideBN||g.wallHalfGuideDemo?.active()||g.wallBaseLevelGuideDemo?.active?.()||notice.economy(g)
   ||g.pendingDemonFocus545||g.demonAttackFocus545||g.cameraScenesR7?.active()
   ||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()
   ||g.rewardAdBN?.pausesLive?.()||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony
   ||g.rotationInputBlocked398()||g.roundLoading591||g.placement;
 }
 const permit=entry=>g.isBuildUnlocked(entry)&&g.easyOpeningGuideAllowsBuild(entry.type)!==false&&!g.buildingCountBlockReason(entry.type);
 const enough=(p,b)=>p.wood>=b.wood&&p.gold>=b.gold;
 function advance(to){
  g.demonTowerGuideStagePreview=to;g.demonTowerGuideIntroMsPreview=0;visibleAt=null;
 }
 function canUpgrade(b){
  if(!own(b)||b.level!==1||!g.easyOpeningGuideAllowsUpgrade(b)||!b.canUpgrade()||g.buildingUpgradeBlockReason(b))return false;
  const cost=b.upgradeCost();return g.validUpgradeCostR12(cost)&&enough(g.player,cost);
 }
 function worldPointer(b){
  const S=g.uiSafeRect396(),M=g.getMinimapRect(),z=g.zoom(),x=(b.x-g.camera.x)*z,y=(b.y-g.camera.y)*z-43;
  if(x>S.x+28&&x<S.right-28&&y>g.topHudLayout().bottom+35&&y<S.bottom-107&&!(x>M.x-24&&x<M.x+M.w+24&&y<M.y+M.h+28))return{x:x-1,y,w:2,h:0};
 }
 function upgradeView(stage){
  if(g.buildMenu)return null;
  const n=g.demonTowerGuideUpgradePreview||0;if(n>=3)return null;
  const k=plan[n+1],list=census().towers[k];
  if(list.some(b=>own(b)&&b.level>=2))return null;
  const b=g.selectedBuilding;
  if(b&&(!list.includes(b)||!canUpgrade(b)))return null;
  const subject=b||list.find(canUpgrade);if(!subject)return null;
  const name=entries.get(k).name,price=subject.upgradeCost(),target=b?g.getUpgradePanelLayout().upgradeBtn:worldPointer(subject);
  return {stage,upgrading:k,subject,title:'升级'+name+'到 2 级',detail:b?'木'+price.wood+'／金'+price.gold+'，点「升级」完成。':'点选自家'+name+'，再点「升级」。',target,mode:'down'};
 }
 function view(){
  const stage=g.demonTowerGuideStagePreview;
  if(!(stage>=1&&stage<=7)||!scope()||clear()||g.antiAirGuideStagePreview===1&&g.antiAirGuidePreview?.view(true))return null;
  if(!(stage>=5&&stage<=6)){
   const m=g.goldMineGuidePreview,w=g.woodWorkforcePreview;
   if(m?.actionPending()&&m.view(true)||w?.actionPending()&&w.view(true))return null;
  }
  if(stage===7||stage===4&&!readyForWatch())return upgradeView(stage);
  if(stage===4)return null;
  const k=plan[stage],p=g.player,e=entries.get(k),desc=intro[stage],ready=count(k)>0;
  let title=desc[0],detail=desc[1],tail=desc[2],target,mode='down';
  if(stage===6){
   const all=watch(),b=all.find(canUpgrade);
   if(!b||all.some(b=>b.level>=2))return null;
   const cost=b.upgradeCost();if(!cost)return null;
   if(g.buildMenu||g.selectedBuilding&&g.selectedBuilding!==b)return null;
   target=g.selectedBuilding?g.getUpgradePanelLayout().upgradeBtn:worldPointer(b);
   return{stage,title,detail,tail,target,mode};
  }
  if(ready)return{stage,title,detail,tail,target,mode};
  if(!permit(e)||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===k)||stage<=3&&g.selectedBuilding)return null;
  if(stage<=3){title=buildTitles[stage];tail=undefined;}
  if(!enough(p,e))return{stage,title,detail:detail+'（木'+e.wood+'／金'+e.gold+'）',target,buildCost:e};
  if(g.selectedBuilding)target=g.getUpgradePanelLayout().closeBtn;
  else if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
  else{
   const L=g.getBuildMenuLayout();
   if(g.buildMenuPage!==e.page){target=soft.catalogTab(g,L,e.page);tail=soft.catalogHint(g,e.page);}
   else{
    const b=L.rows.find(row=>row.entry.type===k)?.rect,c=L.listRect;
    target=soft.catalogRow(g,L,b,k);mode=target?.scrollDown?'scroll':'row';
    if(!target&&c&&b&&L.maxScroll){const more='向上滑，找到'+e.name+'。';if(stage<=3)tail=more;else title=more;}
   }
  }
  return{stage,title,detail,tail,target,mode};
 }
 function stepUpgrade(n,acted){
  if(acted&&!g.demonTowerGuideWrapPreview)g.demonTowerGuideWrapPreview=-2;
  if(n===3&&g.demonTowerGuideWrapPreview===-2)g.demonTowerGuideWrapPreview=5400;
  g.demonTowerGuideUpgradePreview=n;
 }
 function wrapView(){
  if(!(g.demonTowerGuideWrapPreview>0)||clear()||g.selectedBuilding||g.buildMenu
   ||g.antiAirGuidePreview?.view()||g.defenseGuideDemo?.view()||g.goldMineGuidePreview?.view()||g.woodWorkforcePreview?.view()||g.tankEconomyGuidePreview?.view()
   ||g.vehicleDriveGuidePreview?.view()||g.vehicleLabGuidePF?.view()||g.goldShortageGuideBN?.busy?.()||g.resourceCapPreview?.priorityAvailable?.())return null;
  return{wrap:true,title:'如果防线还吃紧，',detail:'资源和升级条件允许时，',tail:'可以继续升级防御塔。',extra:'也可以建造更多防御塔，补强防线。'};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  if(g.defenseGuideDemo?.idleOwns?.())return;
  if(generation!==g.player){generation=g.player;visibleAt=wrapAt=null;}
  const stage=g.demonTowerGuideStagePreview;
  if(!(stage>0&&stage<=7)||!scope()){visibleAt=wrapAt=null;return;}
  if(stage>=4){
   let n=g.demonTowerGuideUpgradePreview||0;
   while(n<3&&census().towers[plan[n+1]].some(b=>own(b)&&b.level>=2))n++;
   if(n!==(g.demonTowerGuideUpgradePreview||0))stepUpgrade(n,false);
  }
  if(stage===4&&readyForWatch()){wrapAt=null;advance(5);return;}
  if(stage===6&&watch().some(b=>b.level>=2)){advance(7);return;}
  if(stage===6&&!watch().length){advance(5);return;}
  const a=view()||wrapView(),now=g.supportTime||0;
  if(!a){visibleAt=wrapAt=null;return;}
  if(a.wrap){
   if(wrapAt!=null&&now>=wrapAt){
    const remaining=g.demonTowerGuideWrapPreview-Math.min(100,now-wrapAt);
    g.demonTowerGuideWrapPreview=remaining>0?remaining:-1;
    if(remaining<=0){wrapAt=null;return;}
   }
   wrapAt=now;visibleAt=null;
  }else{
   wrapAt=null;
   if(!a.upgrading&&visibleAt!=null&&now>=visibleAt)g.demonTowerGuideIntroMsPreview=Math.min(showed,(g.demonTowerGuideIntroMsPreview||0)+Math.min(100,now-visibleAt));
   visibleAt=a.upgrading?null:now;
  }
  if(stage<=3&&count(plan[stage])&&(g.demonTowerGuideIntroMsPreview||0)>=showed){advance(stage+1);return;}
  if(stage===5&&watch().length&&(g.demonTowerGuideIntroMsPreview||0)>=showed){advance(6);return;}
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const pieces=[[text(a.title),a.upgrading||a.stage<=3&&a.title===buildTitles[a.stage]?18:15,'#EEFFE9'],[text(a.detail),13,'#DCF5E5','']];
  if(a.tail)pieces.push([text(a.tail),13,'#DCF5E5','']);
  if(a.extra)pieces.push([text(a.extra),13,'#DCF5E5','']);
  const box=soft.layout(C,Math.min(331,S.w-44),pieces),{w,h}=box,x=S.x+(S.w-w)/2;
  let y=Math.min(S.bottom-h-12,Math.max(g.topHudLayout().bottom+41,M.y+M.h+25));
  if(a.wrap&&S.w>S.h)y=S.bottom-h-18;
  if(L)y=L.y+L.h+h+7<S.bottom-55?L.y+L.h+6:Math.max(S.y+5,L.y-h-6);
  const t=a.target;
  g.passiveHintsR13?.target(t);
  if(!t){soft.paint(C,x,y,box);}
  if(t)soft.buildArrow(g,C,t,1.3,box);
 }
 const attack=g.recordDemonAttack545;
 g.recordDemonAttack545=function(victim,source,...args){
  const out=attack.call(this,victim,source,...args);
  hit(victim,source);return out;
 };
 const buy=g.tryUpgradeBuilding;
 g.tryUpgradeBuilding=function(b,...args){const out=buy.call(this,b,...args);if(out&&scope()&&g.demonTowerGuideStagePreview>=4&&own(b)&&b.level>=2){
  const n=g.demonTowerGuideUpgradePreview||0;
  if(n<3&&b.type===plan[n+1]&&!b.airDefenseKindBN)stepUpgrade(n+1,true);
  if(g.demonTowerGuideStagePreview===6&&b.type==='watchtower')advance(7);
 }return out;};
 const original=g.draw;g.draw=function(...a){const out=original.apply(this,a);draw();return out;};
 g.demonTowerGuidePreview={view,reservesWatch:()=>scope()&&g.demonTowerGuideStagePreview>0&&g.demonTowerGuideStagePreview<7};
};
