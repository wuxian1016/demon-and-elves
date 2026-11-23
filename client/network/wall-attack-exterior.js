'use strict';
// Keep the siege contact on the road-facing side of a camp wall. World-space
// geometry only: no sprite offsets, camera state, damage or attack clock changes.
function install(g){
 if(g.wallAttackExteriorBO)return g.wallAttackExteriorBO;
 const proto=Object.getPrototypeOf(g.troll),originalReach=proto.attackReachFor,originalDamage=proto.applyAttackDamage,originalMove=proto.moveSmartToward;
 const originalApproach=g.demonAttackApproach,originalDirect=g.directWallAttackPoint,originalBlocking=g.demonBlockingBuilding,cache=new WeakMap();
 function face(w){if(!w||w.dead||w.type!=='wall')return null;let best=null,d=Infinity;for(const z of g.resourceZones||[]){if(![z.x,z.y,z.gateX,z.gateY].every(Number.isFinite))continue;const distance=Math.hypot(w.x-z.gateX,w.y-z.gateY);if(distance<d){d=distance;best=z;}}if(!best||d>700)return null;const dx=best.gateX-best.x,dy=best.gateY-best.y;return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx)||1,y:0}:{x:0,y:Math.sign(dy)||1};}
 const clearance=(u,w)=>Math.max(28,w.radius||0)+(u.radius||0)+2;
 const signed=(u,w,n)=>(u.x-w.x)*n.x+(u.y-w.y)*n.y;
 const outside=(u,w,n)=>signed(u,w,n)>=clearance(u,w)-.01;
 function point(u,w,direct){const n=u===g.troll&&face(w);if(!n)return (direct?originalDirect:originalApproach).call(g,u,w);
  const reach=originalReach.call(u,w),r=reach-4,terrain=g.navigationTerrainCache(u.radius).state,now=g.supportTime||0;
  if(outside(u,w,n)&&Math.hypot(u.x-w.x,u.y-w.y)<=r&&!g.isTerrainBlocked(u.x,u.y,u.radius))return{x:u.x,y:u.y};
  let per=cache.get(w);if(!per){per=new WeakMap();cache.set(w,per);}const old=per.get(u);
  if(!direct&&old&&old.until>now&&old.x===w.x&&old.y===w.y&&old.radius===u.radius&&old.r===r&&old.terrain===terrain&&old.nx===n.x&&old.ny===n.y)return old.point;
  const candidates=[];for(const turn of[0,Math.PI/8,-Math.PI/8,Math.PI/4,-Math.PI/4]){const along=Math.cos(turn)*r,side=Math.sin(turn)*r,p={x:w.x+n.x*along-n.y*side,y:w.y+n.y*along+n.x*side};if(p.x<u.radius||p.y<u.radius||p.x>10000-u.radius||p.y>8000-u.radius||signed(p,w,n)<clearance(u,w)-.01||g.isTerrainBlocked(p.x,p.y,u.radius+2))continue;candidates.push(p);}
  const clear=p=>!g.demonLineBlocked(u,p,u.radius)&&!g.demonBlockingBuilding(u,u,p);
  const chosen=candidates.find(clear)||(direct?null:candidates[0])||null;
  if(!direct)per.set(u,{x:w.x,y:w.y,radius:u.radius,r,terrain,nx:n.x,ny:n.y,until:now+900,point:chosen});return chosen;
 }
 // Sweep the demon's full collision disc against every living wall. A wall
 // rebuilt around a unit is still solid: no "outward escape" through it.
 g.demonBlockingBuilding=function(u,from,to,candidates=this.buildings){
  if(u!==this.troll)return originalBlocking.call(this,u,from,to,candidates);
  const dx=to.x-from.x,dy=to.y-from.y,len2=dx*dx+dy*dy;
  let wall=null,first=Infinity;
  for(const w of candidates||[]){if(w.dead||w.type!=='wall')continue;
   const r=originalReach.call(u,w)-Math.max(u.attackRange||0,(u.radius||0)+6)+(u.radius||0);
   const x=from.x-w.x,y=from.y-w.y,c=x*x+y*y-r*r,dot=x*dx+y*dy;
   let entry;if(c<-.000001)entry=0;
   else{if(len2<1e-10||dot>=0)continue;const disc=dot*dot-len2*c;if(disc<0)continue;entry=(-dot-Math.sqrt(disc))/len2;if(entry<0||entry>1)continue;}
   if(entry<first){wall=w;first=entry;}
  }
  return wall||originalBlocking.call(this,u,from,to,candidates);
 };
 // A real movement collision is also a valid siege contact from the camp side
 // (especially during retreat). It does not grant permission to walk across.
 const contact=(u,w)=>u===g.troll&&g.demonMoveBlocker===w&&!w.dead&&w.type==='wall'
  &&Math.hypot(u.x-w.x,u.y-w.y)<=originalReach.call(u,w)+.01;
 // Preserve road-facing approach for ordinary raids. An actual blocked
 // retreat/contact must attack the wall in place, never cross or teleport.
 proto.moveSmartToward=function(w,speed,dt,...args){const n=this===g.troll&&face(w);if(n&&!outside(this,w,n)&&!contact(this,w)&&g.advanceAroundBlockerToTarget(this,w,w))return true;return originalMove.call(this,w,speed,dt,...args);};
 proto.attackReachFor=function(w){const n=this===g.troll&&face(w);return n&&!outside(this,w,n)&&!contact(this,w)?0:originalReach.call(this,w);};
 if(typeof originalDamage==='function')proto.applyAttackDamage=function(w,...args){const n=this===g.troll&&face(w);if(n&&!outside(this,w,n)&&!contact(this,w))return;return originalDamage.call(this,w,...args);};
 g.demonAttackApproach=function(u,w,...args){return u===this.troll&&face(w)?point(u,w,false):originalApproach.call(this,u,w,...args);};
 g.directWallAttackPoint=function(u,w,...args){return u===this.troll&&face(w)?point(u,w,true):originalDirect.call(this,u,w,...args);};
 return g.wallAttackExteriorBO={face,clearance,signed,outside,point,originalReach};
}
module.exports={install};
