'use strict';
// Flight alters collision and navigation only, not combat target classes or status flags.
module.exports=function create(win,ejectLanding,opts,wallRadius){
 const {width,height}=opts,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const scope=g=>g&&!g.networkDrawCamera627&&!g.networkAuthorityPhases627&&
  win.networkDefenseModeBN?.()!==true&&(g.state==='prep'||g.state==='hunt')&&win.batSoloPolicyBN?.allows(g)===true;
 const mech=(g,t)=>t?.isRobot===true&&t.ghostMechBN===true&&t.ownerSlot==null&&scope(g);
 const elf=(g,e,unmounted=true)=>e===g.player&&!e.dead&&e.ghostElf===true&&(!unmounted||!e.drivingTank)&&scope(g);
 function body(g,e){
  if(mech(g,e))return true;
  if(!elf(g,e))return false;
  const h=g.ghostElfAPI?.host;
  return !h||!h.dead&&h.airborne===true&&(h.waveBat===true||h.waveGriffinBN===true);
 }
 function move(g,e,vx,vy){
  if(e.dead||e.groundNetLockedBN===true||e===g.player&&g.ghostElfAPI?.host?.groundNetLockedBN===true||
   !Number.isFinite(vx)||!Number.isFinite(vy)||!(vx||vy))return false;
  const x=e.x,y=e.y,r=Math.max(1,e.radius||1);
  e.x=clamp(x+vx,r,width-r);e.y=clamp(y+vy,r,height-r);
  e.terrainClearDistance411=0;e.terrainEscape=null;
  return e.x!==x||e.y!==y;
 }
 function ground(g,t){
  const r=t.radius;
  return t.x>=r&&t.x<=width-r&&t.y>=r&&t.y<=height-r&&!g.terrainCollisionAt(t.x,t.y,r)&&
   !g.buildings.some(b=>!b.dead&&b.type==='wall'&&Math.hypot(b.x-t.x,b.y-t.y)<Math.max(b.radius,wallRadius)+r);
 }
 function landing(g,t,e,dx,dy,forced=false){
  const local=ejectLanding.find(g,t,e,dx,dy,opts);
  if(local||!forced)return local;
  // A wreck can be over the middle of a lake. Only force-eject to a separately
  // checked ground point near a native home/camp; a voluntary exit must be local.
  for(const a of [...g.ownerBuildings().filter(b=>b.type==='house'),...g.resourceZones]){
   const p=ejectLanding.find(g,{x:a.x,y:a.y,radius:30},e,dx,dy,opts);
   if(p)return p;
  }
  return null;
 }
 function eject(g,t,e,dx,dy,safe){
  const air=mech(g,t),hover=air&&elf(g,e,false);
  return {hover,safe:safe||(air&&!hover?landing(g,t,e,dx,dy,true):t.dead&&g&&!hover?ejectLanding.find(g,t,e,dx,dy,opts):null)};
 }
 function exit(g,t,dx,dy,includeCrew=false){
  if(!mech(g,t))return null;
  const crew=includeCrew?t.crew:null,driver=t.driver,need=driver&&!elf(g,driver,false);
  const p=need?landing(g,t,driver,dx,dy):null,q=crew?landing(g,t,crew,-dx,-dy):null;
  if(need&&!p||crew&&!q){g.showToast('请先把幽灵机器人开到空地再下车');return false;}
  return {driver:p,crew:q};
 }
 return {body,mech,move,ground,eject,exit};
};
