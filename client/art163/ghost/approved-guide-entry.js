'use strict';
const {create}=require('./approved-guide-flow');
// Integration is modal-only and affirmative: absent original scene material never substitutes a mock.
module.exports=function install(g,env){
 const {viewport,hidden,resetInput,wake,now,offline,iconFor=()=>null,stageFor=()=>null}=env;
 const d=g.draw,u=g.update,button=g.onButtonClick,hud=g.drawHUD;
 const beforeResearch=g.tryResearchRobotTech,beforeFactory=g.tryTransformTankToRobot;
 function dockEligible(key){
  const p=g.player,r=p?.drivingTank,host=g.ghostElfAPI?.host;
  if(!p||p.dead||g.ghostRelocateBN?.pending?.()||g.ghostCopyBN?.pending?.())return false;
  if(key==='batRaid')return !!host?.waveBat&&!host.dead;
  if(key==='ghostStealth'||key==='ghostPossess')return p.ghostElf===true&&!host&&!r;
  return r?.isRobot&&!r.dead&&r.driver===p&&!!r.ghostMechBN===key.startsWith('ghost');
 }
 function slot(key,id){
  if(!dockEligible(key))return null;
  const b=g.buttons.find(b=>b.id===id&&b.visible&&b.circular512);
  if(!b||!b.diameter512)return null;
  const icon=iconFor(key,id);if(!icon)return null;
  return{x:b.x,y:b.y,w:b.diameter512,h:b.diameter512,icon};
 }
 const flow=create(g,{viewport,hidden,resetInput,wake,now,offline,slot,dockEligible,stageFor:k=>stageFor(k,g)});
 const rcopy=b=>b&&{x:b.x,y:b.y,w:b.w,h:b.h};
 const ownedRobotKeys=()=>[...new Set([g.player.drivingTank,...g.tanks]
 .filter(r=>r?.isRobot&&!r.dead&&r.ownerSlot==null)
 .flatMap(r=>robotKeys(r,g.robotTech)))];
 const ids={ghostStealth:'collectGold',ghostPossess:'collectWood',batRaid:'collectWood',ghostFlame:'robotFlame'};
 const stock=['robotSiege','robotFlame','robotSuper'],ghost=['ghostRelocate','ghostFlame','ghostCopy'];
 function robotKeys(r,t){return t.laser<10?[]:(r.ghostMechBN?ghost:stock).slice(0,t.laser>=20&&t.minion>=20?3:2);}
 function announceDock(key,id,notify=false){
  if(!dockEligible(key))return false;
  if(flow.wanted(key)){const b=g.buttons.find(b=>b.id===id&&b.visible&&b.circular512);if(b)flow.announce(key,{x:b.x,y:b.y,w:b.diameter512,h:b.diameter512});}
  if(notify&&flow.frameAble()&&flow.waiting(key)){g.showToast?.('正在准备首次技能介绍');return true;}
  return false;
 }
 function reconcile(){
  if(flow.playing()||!flow.frameAble())return;
  const p=g.player,r=p.drivingTank,h=g.ghostElfAPI?.host;
  if(p.ghostElf&&!r&&!h){announceDock('ghostStealth',ids.ghostStealth);announceDock('ghostPossess',ids.ghostPossess);}
  else if(h?.waveBat)announceDock('batRaid',ids.batRaid);
  else if(r?.isRobot&&!r.dead&&r.driver===p){
   const t=g.robotTech;if(t.laser<10)return;const a=r.ghostMechBN?ghost:stock;
   announceDock(a[0],a[0]);announceDock(a[1],ids[a[1]]||a[1]);
   if(t.laser>=20&&t.minion>=20)announceDock(a[2],a[2]);
  }
 }
 g.tryResearchRobotTech=function(kind,lab){
  if(kind!=='laser'&&kind!=='minion')return beforeResearch.call(this,kind,lab);
  const before=ownedRobotKeys();
  const origin=this.selectedBuilding===lab?rcopy(this.getUpgradePanelLayout()?.[kind==='laser'?'robotLaserBtn':'robotMinionBtn']):null;
  const result=beforeResearch.call(this,kind,lab);
  if(result===true&&origin){const level=this.robotTech[kind],label=(kind==='laser'?'激光':'小机器人')+'升至 '+level+' 级';for(const key of ownedRobotKeys())if(!before.includes(key))flow.announce(key,origin,label,lab);}
  return result;
 };
 g.tryTransformTankToRobot=function(factory,owner=this.player,silent=false,model='stock'){
  const before=ownedRobotKeys();
  const origin=this.selectedBuilding===factory&&owner===this.player&&!silent?rcopy(this.getUpgradePanelLayout()?.robotFactoryBtn):null;
  const result=beforeFactory.call(this,factory,owner,silent,model);
  if(result===true&&origin){for(const key of ownedRobotKeys())if(!before.includes(key))flow.announce(key,origin,'完成'+(model==='ghost'?'幽灵':'普通')+'机甲改造',factory);}
  return result;
 };
 g.approvedGuideEventBN=function(type,origin){
  if(type==='role'){flow.announce('ghostStealth',origin);flow.announce('ghostPossess',origin);}
  else if(type==='bat'){
   const v=viewport(),a=origin,z=g.zoom(),s=g.screenToWorld(0,0),x=(a.x-s.x)*z,y=(a.y-s.y-(a.batGroundedBN?14:42))*z;
   const dock=g.buttons.find(b=>b.id==='collectWood'&&b.visible&&b.circular512);
   flow.announce('batRaid',x>=14&&x<=v.width-14&&y>=14&&y<=v.height-14?{x:x-14,y:y-14,w:28,h:28}:rcopy(dock));
  }
 };
 // Retain existing aiming feedback and late migration of eligible legacy technicians,
 // but use the same native scene rather than an obsolete simulated paint path.
 const aimCopy={text:'点战场空地放置分身',time:1};
 if(hud)g.drawHUD=function(...args){
  const old=this.toast,copy=this.ghostCopyBN?.pending()&&!flow.playing()&&!(old?.time>0)&&this.ghostRobotAimUIBN?.()!==false;
  if(copy)this.toast=aimCopy;
  try{return hud.apply(this,args);}finally{if(copy)this.toast=old;if(!flow.playing())this.ghostRelocateBN?.drawFeedback?.(this.ctx);}
 };
 g.onButtonClick=function(id,...rest){
  if(flow.playing())return;
  if(id==='collectGold'&&this.player.ghostElf&&announceDock('ghostStealth',id,true)
     ||id==='collectWood'&&this.player.ghostElf&&announceDock(this.ghostElfAPI?.host?.waveBat?'batRaid':'ghostPossess',id,true))return;
  const r=this.player?.drivingTank;
  if(r?.isRobot&&!r.dead&&!this.player.dead&&r.driver===this.player){
   const key=id==='robotFlame'&&r.ghostMechBN?'ghostFlame':id;
   if(robotKeys(r,this.robotTech).includes(key)&&announceDock(key,id,true))return;
  }
  return button.call(this,id,...rest);
 };
 g.update=function(...args){if(!flow.combatPaused())return u.apply(this,args);};
 g.draw=function(...args){
  const old=this.guideDockUnderPanelBN;
  if(this.selectedBuilding&&viewport().width>viewport().height&&flow.dockNeeded())this.guideDockUnderPanelBN=true;
  const res=(()=>{try{return d.apply(this,args);}finally{this.guideDockUnderPanelBN=old;}})();
  reconcile();flow.draw(this.ctx);return res;
 };
 g.robotGuideBN=Object.assign(flow,{report:(report=>()=>({approved:report()}))(flow.report)});
 return flow;
};
