'use strict';
const soft=require('./soft-hint');
exports.install=function(g,runtime,catalog,offline,menuEnabled){
 const kind='antiAirTowerBN',entry=catalog.find(b=>b.type===kind),notice=require('../../network/notice-priority');
 const owned=b=>b?.airDefenseKindBN==='antiAir'&&b.ownerSlot==null&&g.completedElfBuildingBN(b);
 const text=s=>runtime.nativeText(s);
 let generation,cardSeen=false,evidence=new WeakMap();
 const supported=()=>offline()&&!g.tutorial&&!g.superChallenge580&&g.state==='hunt'&&!g.player?.dead&&g.batWaveCandidateBN===true;
 function departure(b,shown){
  if(generation!==g.player){generation=g.player;cardSeen=false;evidence=new WeakMap();}
  if(g.antiAirGuideStagePreview!==0)return;
  if(shown)cardSeen=true;
  if(!cardSeen||!supported()||!b?.waveBat||!b.airborne||b.dead||b===g.ghostElfAPI?.host)return;
  const target=b.target;if(!target||evidence.get(b)===target)return;evidence.set(b,target);
  if(!g.hounds.includes(b))return;
  if(!(target===g.player||target?.ownerSlot==null&&g.completedElfBuildingBN(target)&&g.buildings.includes(target)))return;
  g.antiAirGuideStagePreview=g.indexedOwnerBuildings(null).some(owned)?2:1;
 }
 function view(skipTower=false){
  if(g.antiAirGuideStagePreview!==1||!supported())return null;
  if(g.indexedOwnerBuildings(null).some(owned)){g.antiAirGuideStagePreview=2;return null;}
  if(g.baseUpgradeGuideBN||!skipTower&&g.demonTowerGuidePreview?.view()||runtime.hidden||g.wallHalfGuideDemo?.active()||g.wallBaseLevelGuideDemo?.active?.()||notice.economy(g)
   ||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.cardPresentation?.modal()||g.cardPresentation?.blocksDock?.()
   ||g.rewardAdBN?.pausesLive?.()||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel
   ||g.ceremony||g.cameraScenesR7?.active()||g.rotationInputBlocked398()||g.roundLoading591||g.placement
   ||g.goldShortageGuideBN?.busy?.()||g.resourceCapPreview?.busy?.()
   ||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===kind)
   ||!menuEnabled()||!g.isBuildUnlocked(entry)||g.easyOpeningGuideAllowsBuild(kind)===false)return null;
  const p=g.player,affordable=p.wood>=entry.wood&&p.gold>=entry.gold;
  let copy='飞行敌人来了，建一座防空塔。',mode='down',target;
  if(!affordable){copy=entry.wood>p.maxWood||entry.gold>p.maxGold?'先扩仓，攒够木90、金60再建防空塔。':'准备木90、金60，再建防空塔。';return{copy,target:null,buildCost:entry};}
  if(g.selectedBuilding)target=g.getUpgradePanelLayout().closeBtn;
  else if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
  else{
   const L=g.getBuildMenuLayout();
   if(g.buildMenuPage!==entry.page){target=soft.catalogTab(g,L,entry.page);copy=soft.catalogHint(g,entry.page)+'建造防空塔。';}
   else{
    const b=L.rows.find(r=>r.entry.type===kind)?.rect;
    target=soft.catalogRow(g,L,b,kind);mode=target?.scrollDown?'scroll':'row';
    if(target)copy=target.scrollDown?soft.scrollCopy('防空塔'):'点防空塔，拦截飞行敌人。';
    else if(b&&L.maxScroll)copy='向上滑，找到防空塔。';
   }
  }
  return{copy,target,mode};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  if(g.defenseGuideDemo?.idleOwns?.())return;
  const a=view();if(!a)return;
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const box=soft.layout(C,Math.min(264,S.w-44),[[text(a.copy)]]),x=S.x+(S.w-box.w)/2;
  let y=Math.max(g.topHudLayout().bottom+35,M.y+M.h+25);
  if(L)y=L.y+L.h+box.h+7<S.bottom-50?L.y+L.h+6:Math.max(S.y+5,L.y-box.h-6);
  const t=a.target;
  g.passiveHintsR13?.target(t);
  if(!t){soft.paint(C,x,Math.min(y,S.bottom-box.h-10),box);}
  if(t)soft.buildArrow(g,C,t,1.3,box);
 }
 const commit=g.updatePlayerBuild506;
 g.updatePlayerBuild506=function(...a){
  const watch=g.antiAirGuideStagePreview===1&&g.player.task?.buildType===kind,n=watch&&g.buildings.length;
  const out=commit.apply(this,a);
  if(watch&&g.buildings.length>n&&owned(g.buildings[g.buildings.length-1]))g.antiAirGuideStagePreview=2;
  return out;
 };
 const original=g.draw;g.draw=function(...args){const out=original.apply(this,args);draw();return out;};
 g.antiAirGuidePreview={departure,view};
};
