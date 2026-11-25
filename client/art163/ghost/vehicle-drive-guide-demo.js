'use strict';
const soft=require('./soft-hint');
exports.install=function install(g,runtime,offline){
 const notice=require('../../network/notice-priority');
 const slot=t=>t?.isRobot?'robotDriveGuidePreview':'tankDriveGuidePreview';
 let player,start=null,nowLast=null,visible=0,episode=null,exitStarted=null;const clock=()=>g.supportTime||0;
 function clear(){start=nowLast=episode=exitStarted=null;visible=0;}
 function sync(){
  if(player!==g.player){player=g.player;clear();}
 }
 function ready(){
  return g.player&&!g.player.dead&&g.state==='hunt'&&offline()
   &&!runtime.hidden&&!g.tutorial&&!g.superChallenge580&&!g.roundLoading591
   &&!g.selectedBuilding&&!g.buildMenu&&!g.placement&&!g.sessionMenuOpen
   &&!g.saveSlotsPanel&&!g.demonPanel&&!g.relicPanel&&!g.allyDataPanel&&!g.ceremony
   &&!g.rotationInputBlocked398()&&!g.cameraScenesR7?.active()&&!g.wallBaseLevelGuideDemo?.active?.()
   &&!g.wallHalfGuideDemo?.active()&&!g.baseUpgradeGuideBN&&!g.robotGuideBN?.playing?.()&&!notice.economy(g)&&!g.batIntroCardBN?.visible?.()
   &&!g.cardPresentation?.modal()&&!g.cardPresentation?.blocksDock?.()&&!g.rewardAdBN?.pausesLive?.()
   &&!g.endlessOpeningIntro&&!g.popupActive515?.()&&!g.dragonTutorialBL?.active
   &&!g.ghostElfAPI?.host&&!g.demonTowerGuidePreview?.view()&&!g.antiAirGuidePreview?.view()&&!g.goldMineGuidePreview?.view()
   &&!g.woodWorkforcePreview?.view()&&!g.tankEconomyGuidePreview?.view();
 }
 function born(t){
  sync();
  if(!offline()||!t||t.ownerSlot!=null)return;
  const key=slot(t);
  if(!g[key])g[key]=1;
 }
 function board(t){
  sync();
  if(offline()&&t&&t.ownerSlot==null&&g[slot(t)]===1){g[slot(t)]=2;exitStarted=null;}
 }
 function exit(t){
  sync();
  if(offline()&&t&&t.ownerSlot==null)g[slot(t)]=3;
 }
 function view(){
  if(!ready())return null;
  sync();const p=g.player,driving=p.drivingTank;
  let button,copy;
  if(driving&&!driving.dead&&driving.ownerSlot==null&&driving.driver===p&&[1,2].includes(g[slot(driving)])){
   const native=g.buttons.find(b=>b.id==='exitTank'&&b.visible!==false&&b.w>0&&b.h>0);
   if(!native)return null;
   const n=clock();if(exitStarted===null)exitStarted=n;
   if(n-exitStarted>=3200){g[slot(driving)]=3;exitStarted=null;return null;}
   button='exitTank';copy='点「离开载具」，切回精灵。';
  }else if(!driving&&p.task?.type!=='boardVehicle512'){
   const v=g.availablePlayerVehicle512();if(!v||g[slot(v)]!==1)return null;
   const key=slot(v),n=clock();if(episode!==key){episode=key;start=n;visible=0;nowLast=null;}
   if(visible>=2300||(start!==null&&n-start>6500)){g[key]=3;return null;}
   const native=g.buttons.find(b=>b.id==='driveTank'&&b.visible!==false&&b.w>0&&b.h>0);
   if(!native)return null;
   button='driveTank';copy='点「乘坐载具」，进入载具操控。';
  }
  return button?{button,copy}:null;
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  const a=view(),n=clock();if(!a){nowLast=null;return;}
  if(a.button==='driveTank'){if(nowLast!==null)visible+=Math.min(75,Math.max(0,n-nowLast));nowLast=n;}
  const b=g.buttons.find(x=>x.id===a.button&&x.visible!==false&&x.w>0&&x.h>0);
  if(!b)return;
  const C=g.ctx,S=g.uiSafeRect396(),box=soft.layout(C,Math.min(214,S.w-80),[[runtime.nativeText(a.copy)]]);
  soft.cardinal(g,C,{x:b.x-3,y:b.y+b.h*.5,direction:'right',scale:1.16},box);
 }
 const original=g.draw;g.draw=function(...args){const out=original.apply(this,args);draw();return out;};
 g.vehicleDriveGuidePreview={born,board,exit,view,clear};
};
