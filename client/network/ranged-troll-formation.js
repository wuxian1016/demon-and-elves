'use strict';
// Real but soft same-route body separation. Green range checks, shots, net,
// and enemy positions all share these world coordinates.
const SIDE=[0,-31,31],BODY=37,CELL=40,ROAD=new WeakMap(),MATCH=new WeakMap(),AIMS=new WeakMap();
const FIRE_SLOTS=[[0,0],[-.23,0],[.23,0],[-.11,33],[-.36,33],[.15,33],[.38,33],[-.28,63],[.29,63]];
// On a live wall, stand near the original firing distance instead of
// pushing front ranks deep into an adjacent gate-side defender's reach.
const WALL_SLOTS=[[0,0],[-.28,0],[.28,0],[-.14,8],[-.45,0],[.14,8],[.45,0],[-.37,10],[.37,10]];
function spawn(h,j){h.rangedTrollSlotBN=j;}
function point(route,i,j){
 const center=route.points[i],col=j%3;
 if(!col||!center||i>=route.points.length-2)return center;
 let strips=ROAD.get(route);if(!strips){strips=[null,[],[]];ROAD.set(route,strips);}
 const strip=strips[col];if(strip[i])return strip[i];
 // The baked route already supplies its collision clearance. Stay well
 // inside it, and let the native obstacle solver handle dynamic buildings.
 const side=Math.sign(SIDE[col])*Math.min(Math.abs(SIDE[col]),Math.max(0,(route.clearance||0)-27));
 if(Math.abs(side)<4)return strip[i]=center;
 const a=route.points[Math.max(0,i-1)],b=route.points[Math.min(route.points.length-1,i+1)];
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
 return strip[i]={x:center.x-dy/len*side,y:center.y+dx/len*side};
}
function roadPoint(h,route,i){return point(route,i,h.rangedTrollSlotBN||0);}
const spawnProbe={radius:18};
function blockedSpawn(g,p){return g.slimeBlockingBuilding410(spawnProbe,p,p);}
function spawnPoint(g,route,j,native,i){
 const side=SIDE[j%3],a=route.points[i-1],b=route.points[i];
 if(!side||!a||!b)return native;
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 const shift=Math.sign(side)*Math.min(Math.abs(side),Math.max(0,(route.clearance||0)-27));
 if(len<1||Math.abs(shift)<4)return native;
 // Offset precisely perpendicular to the native spawn segment. Its selected
 // longitudinal projection and route index do not change, even on fallback.
 const q={x:native.x-dy/len*shift,y:native.y+dx/len*shift};
 return g.slimeCentralPoint(q)&&!g.terrainCollisionAt(q.x,q.y,18)&&!blockedSpawn(g,q)?q:native;
}
const cell=(v)=>Math.floor(v/CELL);
const key=(x,y)=>((x+1024)<<13)+(y+1024);
function near(grid,x,y,h){
 let neighbor=null,best=BODY**2;
 for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){
  const b=grid.get(key(x+ox,y+oy));if(!b||b.dead||b===h)continue;
  const d=(b.x-h.x)**2+(b.y-h.y)**2;
  if(d<best){best=d;neighbor=b;}
 }
 return neighbor;
}
function firingSpot(g,h,t,reach){
 const gate=g.resourceZones[h.waveZoneIndex];if(!gate)return null;
 let a=AIMS.get(h),r=reach(t);
 if(a&&a.target===t&&a.x===t.x&&a.y===t.y&&a.r===r&&a.rev===g.groundObstacleRevision)return a.spot;
 const slots=t.type==='wall'?WALL_SLOTS:FIRE_SLOTS;
 const [offset,depth]=slots[h.rangedTrollSlotBN%slots.length]||slots[0];
 let dx=gate.gateX-t.x,dy=gate.gateY-t.y,d=Math.hypot(dx,dy);
 // Targets on the entrance itself must use the incoming road bearing.
 if(d<r*.55){const route=g.slimeFixedRoute413(h.waveZoneIndex),p=route.points[Math.max(0,route.points.length-4)];if(p){dx=p.x-t.x;dy=p.y-t.y;d=Math.hypot(dx,dy);}}
 if(d<1)return null;
 const bearing=Math.atan2(dy,dx),br=Math.max(44,r-7-depth),b=bearing+offset,rr=h.radius||16;
 let spot=null;
 for(const f of [1,.6]){
  const q={x:t.x+Math.cos(bearing+(b-bearing)*f)*br,y:t.y+Math.sin(bearing+(b-bearing)*f)*br};
  if(!g.terrainCollisionAt(q.x,q.y,rr+2)&&!g.slimeBlockingBuilding410(h,q,q)){
   const k=(t.radius||0)/br,end={x:t.x+(q.x-t.x)*k,y:t.y+(q.y-t.y)*k};
   if(!g.demonLineBlocked(q,end,3,true)){const block=g.slimeBlockingBuilding410(h,q,end);if(!block||block===t){spot=q;break;}}
  }
 }
 AIMS.set(h,{target:t,x:t.x,y:t.y,r,rev:g.groundObstacleRevision,spot});
 return spot;
}
function space(g,h,dt,reach){
 if(h.dead||!h.waveRangedTrollBN||h.waveZoneIndex<0||Number.isFinite(h.groundWaveRetireAtBN))return;
 let s=MATCH.get(g);
 if(!s||s.player!==g.player){s={frame:-1,player:g.player,lanes:[],legacy:new Map()};MATCH.set(g,s);}
 if(s.frame!==g.navigationFrame){s.frame=g.navigationFrame;for(const grid of s.lanes)grid?.clear();s.legacy.clear();}
 if(!Number.isInteger(h.rangedTrollSlotBN)){const id=h.waveNumber*16+h.waveZoneIndex,j=s.legacy.get(id)||0;h.rangedTrollSlotBN=j;s.legacy.set(id,j+1);}
 const grid=s.lanes[h.waveZoneIndex]||=new Map();
 const x=cell(h.x),y=cell(h.y);
 // Non-colliding members only do bounded lookups; one representative per
 // nearby cell, no complete roster iteration, no global physics repulsion.
 if(!h.groundNetLockedBN&&!h.rangedTrollCastBN&&!(h.slimeFlameStun407>0)){
  const t=h.target,had=t&&!t.dead&&(h.x-t.x)**2+(h.y-t.y)**2<reach(t)**2,r=h.radius||16;
  const pos=had&&h.attackCd>0&&t.type?firingSpot(g,h,t,reach):null;
  const moving=!!(h.moveIntentX||h.moveIntentY);
  const b=pos||!moving&&!had?null:near(grid,x,y,h);
  let dx=b?h.x-b.x:0,dy=b?h.y-b.y:0,d=Math.hypot(dx,dy);
  if(d<.02){
   const slot=h.rangedTrollSlotBN||0,phase=slot*2.399963229728653;
   dx=Math.cos(phase);dy=Math.sin(phase);d=1;
  }
  const push=b?Math.min(3,dt*.16,Math.max(0,(BODY-d)*.42)):0;
  let px=dx*push/d,py=dy*push/d,lateral=false;
  if(push>.05&&!had){
   // A neighbor must not balance a following unit's native forward step and
   // hold it outside range. While approaching, use only a lateral bypass.
   const fx=t&&!t.dead?t.x-h.x:h.moveIntentX,fy=t&&!t.dead?t.y-h.y:h.moveIntentY,fl=Math.hypot(fx,fy);
   if(fl>.01){
    let side=Math.sign(fx*dy-fy*dx);
    if(!side)side=(h.rangedTrollSlotBN%2)?-1:1;
    px=-fy/fl*push*side;py=fx/fl*push*side;lateral=true;
   }
  }
  function legal(vx,vy){
   const q={x:h.x+vx,y:h.y+vy};
   if(had&&(q.x-t.x)**2+(q.y-t.y)**2>reach(t)**2)return false;
   if(g.terrainCollisionAt(q.x,q.y,r+1)||g.slimeBlockingBuilding410(h,h,q))return false;
   h.x=q.x;h.y=q.y;return true;
  }
  let moved=false;
  if(pos){
   const sx=pos.x-h.x,sy=pos.y-h.y,sd=Math.hypot(sx,sy),amt=Math.min(3,dt*.14,sd);
   if(sd>2)moved=legal(sx*amt/sd,sy*amt/sd);
  }
  if(!pos&&!moved&&push>.05&&!legal(px,py)){
   if(lateral){legal(-px,-py);}
   else {
    const td=had?Math.hypot(h.x-t.x,h.y-t.y)||1:1,bx=had?(t.x-h.x)*push*.35/td:0,by=had?(t.y-h.y)*push*.35/td:0;
    if(!legal(-py+bx,px+by))legal(py+bx,-px+by);
   }
  }
 }
 const k=key(cell(h.x),cell(h.y));if(!grid.has(k))grid.set(k,h);
}
module.exports={spawn,spawnPoint,roadPoint,space};
