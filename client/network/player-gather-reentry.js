'use strict';
const region=require('./camp-hint-region');
const routes=new WeakMap();
const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const outsideLimit=380;
const stop=p=>p.setMoveIntent(0,0);
const insideOrigin=(g,t,inside)=>Number.isFinite(t.originX+t.originY)&&inside(g,t.gatherCampBN,t.originX,t.originY);
function belongsNearGate(g,p,z,lane,f){
 const nearest=region.campAt(g,p.x,p.y);
 return (!nearest||nearest.camp===lane)&&length(p,f)<=outsideLimit&&region.inOutsideRoad(g,z,p.x,p.y);
}
function solidBlockers(g,f){
 return g.buildings.filter(b=>!b.dead&&!(b.type==='wall'&&b.ownerSlot==null&&
  Math.abs((b.x-f.x)*f.ay-(b.y-f.y)*f.ax)<=285&&Math.abs((b.x-f.x)*f.ax+(b.y-f.y)*f.ay)<=165));
}
function route(g,t,inside){
 const p=g.player,lane=t.gatherCampBN,z=g.resourceZones?.[lane];
 if(p.ghostElf===true||!Number.isInteger(lane)||!z||!insideOrigin(g,t,inside)||typeof g.networkPreviewPosition627!=='function')return null;
 const f=region.gateFrame(g,z);
 if(!(f.ax||f.ay)||!belongsNearGate(g,p,z,lane,f))return null;
 // Player feet already walk through wall geometry in native movement. This
 // temporary re-entry permits only the owner's gate walls, and no enemy walls
 // or unrelated solid structures (demon/monster collision is never changed).
 const blocks=solidBlockers(g,f),points=[];
 for(const d of [78,165])for(const offset of [0,-86,86,-172,172,-258,258]){
  const x=f.x-f.ax*d+f.ay*offset,y=f.y-f.ay*d-f.ax*offset,q={x,y};
  if(!inside(g,lane,x,y)||g.isTerrainBlocked(x,y,p.radius+2))continue;
  const clear=!g.demonLineBlocked(p,q,p.radius,true)&&!g.demonBlockingBuilding(p,p,q,blocks);
  points.push({q,clear,dist:length(p,q)});
 }
 points.sort((a,b)=>Number(b.clear)-Number(a.clear)||a.dist-b.dist);
 return points.length?{g,p,lane,z,f,points,index:0,idle:0,total:0,last:{x:p.x,y:p.y},blocks,revision:g.groundObstacleRevision,buildings:g.buildings}:null;
}
function attach(t,r){if(r)routes.set(t,r);}
function advance(g,t,dt,inside){
 const p=g.player,r=routes.get(t);
 if(!r||r.g!==g||r.p!==p||g.resourceZones?.[r.lane]!==r.z||p.task!==t)return 'blocked';
 if(inside(g,r.lane,p.x,p.y)){routes.delete(t);g.clearUnitNavigation(p);return 'inside';}
 if(!belongsNearGate(g,p,r.z,r.lane,r.f)){routes.delete(t);return 'blocked';}
 r.total+=dt;if(r.total>=9500){routes.delete(t);return 'blocked';}
 if(r.revision!==g.groundObstacleRevision||r.buildings!==g.buildings){
  r.revision=g.groundObstacleRevision;r.buildings=g.buildings;
  r.blocks=solidBlockers(g,r.f);
 }
 const goal=r.points[r.index]?.q;if(!goal){routes.delete(t);return 'blocked';}
 const wp=g.demonRouteWaypoint(p,goal,'player-gather-reentry')||goal,mode=g.navMotionCaches?.get(p)?.mode;
 if(mode==='failed'||r.idle>1350){r.index++;r.idle=0;g.clearUnitNavigation(p);stop(p);return 'moving';}
 if(mode==='pending'){stop(p);return 'moving';}
 const len=length(p,wp),d=Math.min(p.speed,len);
 if(d>0.001){
  const dx=(wp.x-p.x)*d/len,dy=(wp.y-p.y)*d/len,next=g.networkPreviewPosition627(p,dx,dy,true);
  if(next&&!g.demonBlockingBuilding(p,p,next,r.blocks)){
   p.setMoveIntent(dx,dy);p.moveByTerrain(dx,dy);
  }else stop(p);
 }else stop(p);
 if(length(p,r.last)>=3){r.last.x=p.x;r.last.y=p.y;r.idle=0;}else r.idle+=dt;
 return 'moving';
}
module.exports={route,attach,advance,has:t=>routes.has(t)};
