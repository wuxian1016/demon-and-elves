'use strict';
// Same prepared road centerline as ground waves. Flying offsets ignore ground
// obstacles; no per-bat nav requests or runtime route generation.
module.exports=function createBatFixedRoute(readOrdinal=null,offsets=[-96,-32,32,96]){
 const units=new WeakMap(), prepared=new WeakMap(), fallback=new WeakMap();
 const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
 function route(g,bat){
  const lane=bat.waveZoneIndex,z=g.resourceZones?.[lane],base=g.trollBase;
  if(!z||!base||!Number.isFinite(z.gateX)||!Number.isFinite(z.gateY))return null;
  const cache=g.slimeFixedRoutes413,r=cache?.zones===g.resourceZones?cache.routes?.[lane]:null;
  if(r?.points?.length>1&&!r.blocked)return r.points;
  // Test/legacy surface without a prepared road: use the same fixed base/gate
  // endpoints. Never ask the ground solver to run during play.
  let f=fallback.get(z);
  if(!f||f.x!==base.x||f.y!==base.y||f.gx!==z.gateX||f.gy!==z.gateY){
   f={x:base.x,y:base.y,gx:z.gateX,gy:z.gateY,points:[{x:base.x,y:base.y},{x:z.gateX,y:z.gateY}]};fallback.set(z,f);
  }
  return f.points;
 }
 function shifted(points){
  let lanes=prepared.get(points);if(lanes)return lanes;
  lanes=offsets.map(offset=>points.map((p,i)=>{
   if(i===0)return p;
   const before=points[i-1],after=points[i+1]||p,dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
   return {x:p.x-dy/len*offset,y:p.y+dx/len*offset};
  }));
  prepared.set(points,lanes);return lanes;
 }
 function nearestSegment(b,points){
  let nearest=1,best=Infinity;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],c=points[i],dx=c.x-a.x,dy=c.y-a.y,l2=dx*dx+dy*dy;
   const t=l2?clamp(((b.x-a.x)*dx+(b.y-a.y)*dy)/l2,0,1):0;
   const gap=(b.x-a.x-dx*t)**2+(b.y-a.y-dy*t)**2;
   if(gap<best){best=gap;nearest=i;}
  }
  return nearest;
 }
 function state(g,b,returning){
  const points=route(g,b);if(!points)return null;
  const prev=units.get(b);if(prev?.points===points&&prev.returning===returning)return prev;
  const serial=Number(String(b.batIdBN).split(':').pop())||0;
  const ordinal=Number.isInteger(prev?.ordinal)?prev.ordinal:(readOrdinal?readOrdinal(b):((serial-1)&3));
  const waypoints=shifted(points)[ordinal],last=waypoints.length-1;
  let index;
  if(prev?.fresh&&!returning)index=1;
  else if(prev?.returning&&!returning)index=1;
  else if(prev&&!prev.returning&&returning)index=last;
  else index=nearestSegment(b,waypoints)-(returning?1:0);
  if(!returning&&b.batStateBN==='attack')index=last+1;
  // Returning saves can be on the target-to-gate leg, not on the inbound road.
  // A position beyond the gate's last route segment still has to rejoin there.
  if(returning&&!prev){
   const end=waypoints[last],before=waypoints[last-1];
   if((b.x-end.x)*(end.x-before.x)+(b.y-end.y)*(end.y-before.y)>=0)index=last;
  }
  const n={points,waypoints,ordinal,index,returning};units.set(b,n);return n;
 }
 function step(g,b,returning,dt,move){
  const stateRow=state(g,b,returning);if(!stateRow)return false;
  const {waypoints}=stateRow,direction=returning?-1:1;
  let p=waypoints[stateRow.index];
  while(p&&d2(b,p)<4){stateRow.index+=direction;p=waypoints[stateRow.index];}
  if(!p)return false;
  // One authored segment at a time; existing speed/root/schedule are unchanged.
  if(move(b,p,dt))stateRow.index+=direction;
  return true;
 }
 function rejoin(g,b){const s=state(g,b,false);if(s)s.index=s.waypoints.length-1;}
 function spawned(b,ordinal){units.set(b,{fresh:true,ordinal:ordinal%offsets.length});}
 function arrived(g,b){const s=state(g,b,false);if(s)s.index=s.waypoints.length;}
 return {spawned,step,arrived,rejoin};
};
