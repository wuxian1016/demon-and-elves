'use strict';
// Ground monsters reuse the preloaded lane polylines. No grid search or job queue.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function nearest(point,routes,valid){let best=null,choices=valid?[]:null;for(let lane=0;lane<routes.length;lane++){const route=routes[lane];if(!route||route.blocked)continue;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/l)):0,q={x:a.x+dx*t,y:a.y+dy*t},d=distance(point,q);const row={lane,index:i,t,q,d};if(!best||d<best.d)best=row;if(choices&&d<=370){choices.push(row);if(choices.length>12){let worst=0;for(let j=1;j<choices.length;j++)if(choices[j].d>choices[worst].d)worst=j;choices.splice(worst,1);}}}}if(choices){choices.sort((a,b)=>a.d-b.d);return choices.find(row=>valid(row.q))||best;}return best;}
function plan(from,goal,routes,entryClear){const a=nearest(from,routes,entryClear),b=nearest(goal,routes);if(!a||!b)return[];const out=[a.q],ap=routes[a.lane].points,bp=routes[b.lane].points;
 if(a.lane===b.lane){if(a.index+a.t<=b.index+b.t){for(let i=a.index;i<b.index;i++)out.push(ap[i]);}else for(let i=a.index-1;i>=b.index;i--)out.push(ap[i]);}
 else{for(let i=a.index-1;i>=0;i--)out.push(ap[i]);for(let i=1;i<b.index;i++)out.push(bp[i]);}
 out.push(b.q,{x:goal.x,y:goal.y});return out.filter((p,i)=>!i||distance(p,out[i-1])>.01);}
function routeBlocker(g,e,from,to){
 return typeof g.sharedMonsterRouteBlockerBN==='function'?g.sharedMonsterRouteBlockerBN(e,from,to):g.demonBlockingBuilding?.(e,from,to);
}
function segmentClear(g,e,from,to){
 return !g.demonLineBlocked(from,to,e.radius||18,true)&&!routeBlocker(g,e,from,to);
}
// At most 16 two-segment local probes, only on stalled movement; no graph search.
function localConnector(g,e,to){const dx=to.x-e.x,dy=to.y-e.y,d=Math.hypot(dx,dy);if(d<1||d>370)return null;
 const radius=e.radius||18;
 let buildingsFirst=false;
 for(const along of [.3,.6])for(const offset of [48,-48,84,-84,126,-126,176,-176]){
  const p={x:e.x+dx*along-dy/d*offset,y:e.y+dy*along+dx/d*offset};
  // A neighboring candidate often meets the same obstacle. Check buildings
  // first only after a real building rejection in this connector search.
  if(buildingsFirst){
   if(routeBlocker(g,e,e,p)||routeBlocker(g,e,p,to))continue;
   if(!g.demonLineBlocked(e,p,radius,true)&&!g.demonLineBlocked(p,to,radius,true))return p;
   buildingsFirst=false;
   continue;
  }
  if(g.demonLineBlocked(e,p,radius,true))continue;
  if(routeBlocker(g,e,e,p)){buildingsFirst=true;continue;}
  if(g.demonLineBlocked(p,to,radius,true))continue;
  if(routeBlocker(g,e,p,to)){buildingsFirst=true;continue;}
  return p;
 }
 return null;
}
module.exports=function create(){const states=new WeakMap();return {plan,localConnector,waypoint(g,e,goal){
 const now=g.supportTime||0,routes=g.slimeFixedRoutes413?.routes||g.fixedRouteSnapshot593?.routes;
 // Purge a save's old per-unit dynamic navigation before following shared geometry.
 g.navigationQueue?.delete(e);g.navigationJobs?.delete(e);g.navigationActiveJobs?.delete(e);
 const cache=g.navMotionCaches||(g.navMotionCaches=new WeakMap());cache.set(e,{mode:'shared-fixed'});
 let s=states.get(e);const moved=!s||distance(goal,s.goal)>96;
 if(!s||s.routes!==routes||(moved&&now>=s.refresh)){s={routes,goal:{x:goal.x,y:goal.y},points:routes?plan(e,goal,routes,q=>!g.demonLineBlocked(e,q,e.radius||18,true)&&!routeBlocker(g,e,e,q)):[],i:0,refresh:now+600,probeAt:0,last:{x:e.x,y:e.y},progress:now};states.set(e,s);}
 const obstacles=g.buildings,obstacleCount=obstacles?.length,revision=g.groundObstacleRevision;
 const terrainRevision=g.terrainClearEpoch411,terrainEnabled=g.terrainCollisionEnabled;
 const obstaclesChanged=s.obstacles!==obstacles||s.obstacleCount!==obstacleCount||s.obstacleRevision!==revision;
 const terrainChanged=s.terrainRevision!==terrainRevision||s.terrainEnabled!==terrainEnabled;
 if(obstaclesChanged){
  s.obstacles=obstacles;s.obstacleCount=obstacleCount;s.obstacleRevision=revision;
  s.wallProbeAt=0;
 }
 if(terrainChanged){s.terrainRevision=terrainRevision;s.terrainEnabled=terrainEnabled;}
 if(obstaclesChanged||terrainChanged){
  s.probeAt=0;
  if(s.connector)s.connectorNeedsCheck=true;
 }
 if(distance(e,s.last)>=18){s.last={x:e.x,y:e.y};s.progress=now;}
 // Local contact is limited to a short unobstructed segment; wall contact itself
 // is handled by the existing attack range and terrain collision, never bypassed.
 e.fixedRouteWallBN=null;
 if(now>=s.probeAt){s.probeAt=now+250;s.direct=distance(e,goal)<=320&&!g.demonLineBlocked(e,goal,e.radius||18)&&!routeBlocker(g,e,e,goal);}
 if(s.direct)return goal;
 if(goal.type==='wall'&&distance(e,goal)<(goal.radius||46)+(e.radius||18)+24)return goal;
 while(s.i<s.points.length-1&&distance(e,s.points[s.i])<=12)s.i++;
 const wp=s.points[s.i];if(!wp){e.fixedRouteBlockedBN='shared-route-not-ready';return e;}
 if(now>=(s.wallProbeAt||0)||s.wallProbeIndex!==s.i||s.wall?.dead){s.wallProbeAt=now+200;s.wallProbeIndex=s.i;s.wall=routeBlocker(g,e,e,wp);}
 const blocker=s.wall;
 if(blocker&&!blocker.dead&&blocker!==goal&&blocker.type==='wall'){
  e.fixedRouteWallBN=blocker;return blocker;
 }
 e.fixedRouteWallBN=null;
 if(s.connector){
  if(distance(e,s.connector)>8&&(!s.connectorNeedsCheck||
    (segmentClear(g,e,e,s.connector)&&segmentClear(g,e,s.connector,wp)))){
   s.connectorNeedsCheck=false;
   return s.connector;
  }
  s.connector=null;
  s.connectorNeedsCheck=false;
 }
 if(now-s.progress>=900&&now>=(s.nextRecovery||0)){
  s.nextRecovery=now+1000;
  for(let i=s.i;i<Math.min(s.points.length,s.i+3);i++){
   const end=s.points[i];if(distance(e,end)>370)continue;
   if(!g.demonLineBlocked(e,end,e.radius||18,true)&&!routeBlocker(g,e,e,end)){s.i=i;return end;}
   const p=localConnector(g,e,end);if(p){s.i=i;s.connector=p;return p;}
  }
 }
 e.fixedRouteBlockedBN=now-s.progress>4000?'local-contact-blocked':null;
 return wp;
 }};};
