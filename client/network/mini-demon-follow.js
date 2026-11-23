'use strict';
// Shared client/authority follower. No independent target lottery, wallet or shop.
const {latchAttackFacing}=require('./demon-attack-facing');
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=e=>!!e&&!e.dead&&e.hp>0;
module.exports=function({simulate=()=>true}={}){
 const positionCache=new WeakMap();
 function prepare(g,m,leader){
  if(!m.miniFollowVersion){m.miniLegacyEconomy={gold:Number(m.gold)||0,xp:Number(m.xp)||0,gearTier:Number(m.gearTier)||0,equipmentDamage:Number(m.equipmentDamage)||0,equipmentArmor:Number(m.equipmentArmor)||0};}
  if(m.miniRallyVersion!==1){m.miniRallyVersion=1;m.miniRallyState='return';m.miniRallyWaitMs=60000;delete m.miniRallySlot;
   let nearest=-1,best=Infinity;for(let i=0;i<(g.resourceZones||[]).length;i++){const z=g.resourceZones[i],d=dist(m,z);if(d<best){best=d;nearest=i;}}
   const z=g.resourceZones?.[nearest];m.miniRallyExitZone=nearest;m.miniRallyExitPass=false;m.miniRallyExitPending=!!z&&best<=(z.radius||1120)&&exitProjection(z,m)<0;
  }
  const level=Math.max(1,Math.floor(Number(leader?.level)||1)),stage=leader?.dragonEvolved?2:leader?.evolved?1:0;
  const max=756+70*(level-1)+300*stage,damage=30+3*(level-1)+12*stage,armor=6+2*(level-1)+6*stage;
  const ratio=Math.max(0,Math.min(1,Number(m.hp)/Math.max(1,Number(m.maxHp)||1)));
  if(m.maxHp!==max)m.hp=m.dead?0:max*ratio;
  m.maxHp=max;m.level=level;m.miniFollowDamage=damage;m.miniFollowArmor=armor;m.miniFollowVersion=1;
  m.radius=18;m.attackRange=60;m.miniFollowSpeed=3.24;m.speed=m.miniFollowSpeed;
  m.gold=0;m.xp=0;m.gearTier=0;m.gearBuyCd=0;m.equipmentDamage=0;m.equipmentArmor=0;
  delete m.independentMiniVersion;delete m.independentMiniHpBonus;delete m.independentMiniOriginalRadius;delete m.independentMiniState;
  return {level,stage,damage,armor};
 }
 function spawnPoint(g,base){
  if(!alive(base)||!Number.isFinite(base.x)||!Number.isFinite(base.y))return null;
  const peers=g.miniTrolls||[],zones=g.resourceZones||[],buildings=g.buildings||[],radius=18,r=(base.radius||100)+70;
  // Use the same near-base slots as the existing sixty-second rally.
  for(let k=0;k<8;k++){
   const slot=(peers.length+k)%8,a=slot*Math.PI/4,p={x:base.x+Math.cos(a)*r,y:base.y+Math.sin(a)*r,slot};
   if(g.isTerrainBlocked?.(p.x,p.y,radius+2)||zones.some(z=>dist(p,z)<(z.radius||1120)+radius)||buildings.some(b=>alive(b)&&dist(p,b)<(b.radius||23)+radius+4)||peers.some(m=>alive(m)&&dist(p,m)<radius+(m.radius||18)+5))continue;
   return p;
  }
  return null;
 }
 function prepareAtBase(g,m,leader,spawn){
  prepare(g,m,leader);m.miniRallySlot=spawn.slot;m.miniRallyState='waiting';m.miniRallyWaitMs=60000;m.miniRallyExitPending=false;m.miniRallyExitPass=false;return m;
 }
 function visible(g,m,e){return alive(e)&&!e.inHouse&&!e.drivingTank&&!e.inTank&&!g.isChaseTargetDeferred?.(m,e);}
 function direction(g,target,leader,base){
  if(target.type==='wall'){
   const z=(g.resourceZones||[]).filter(z=>Number.isFinite(z.gateX)&&Number.isFinite(z.gateY)).reduce((a,z)=>!a||Math.hypot(z.gateX-target.x,z.gateY-target.y)<Math.hypot(a.gateX-target.x,a.gateY-target.y)?z:a,null);
   if(z&&Math.hypot(z.gateX-target.x,z.gateY-target.y)<=600){const dx=z.gateX-z.x,dy=z.gateY-z.y;return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx)||1,y:0}:{x:0,y:Math.sign(dy)||1};}
  }
  const dx=leader.x-target.x,dy=leader.y-target.y,len=Math.hypot(dx,dy)||1;return {x:dx/len,y:dy/len};
 }
 function slot(g,m){return Math.max(0,(g.miniTrolls||[]).filter(e=>!e.dead).indexOf(m));}
 function exitDirection(z){const dx=z.gateX-z.x,dy=z.gateY-z.y;return Math.abs(dx)>Math.abs(dy)?{x:Math.sign(dx)||1,y:0}:{x:0,y:Math.sign(dy)||1};}
 function exitProjection(z,p){const d=exitDirection(z);return (p.x-z.gateX)*d.x+(p.y-z.gateY)*d.y;}
 function isOriginGateWall(z,b){if(b.type!=='wall')return false;const d=exitDirection(z);return (z.gateCells||[{x:z.gateX,y:z.gateY}]).some(p=>Math.abs((b.x-p.x)*-d.y+(b.y-p.y)*d.x)<=4&&Math.abs((b.x-p.x)*d.x+(b.y-p.y)*d.y)<=94);}
 function collisionBuildings(g,m,from,to,buildings){
  if(m.miniRallyState!=='return'||!m.miniRallyExitPending||!m.miniRallyExitPass)return buildings;
  const z=g.resourceZones?.[m.miniRallyExitZone];if(!z||exitProjection(z,to)<exitProjection(z,from)-.001)return buildings;
  // Conversion escape is one-way through only its original gate walls.
  // This exception ends outside the gate; ordinary attacks never use it.
  return (buildings||g.buildings||[]).filter(b=>!isOriginGateWall(z,b));
 }
 function blocker(g,m,from,to,buildings=g.buildings){return g.demonBlockingBuilding?.(m,from,to,collisionBuildings(g,m,from,to,buildings));}
 function move(g,m,goal,dt,id){
  if(dist(m,goal)<=3){m.setMoveIntent(0,0);return;}
  const old={x:m.x,y:m.y},speed=m.speed*m.movementSlowMultiplier();
  if((dist(m,goal)<=320||m.miniRallyState==='return'&&m.miniRallyExitPending)&&clear(g,m,m,goal,g.buildings)){const d=dist(m,goal),step=Math.min(d,speed);m.moveByTerrain((goal.x-m.x)/d*step,(goal.y-m.y)/d*step);}else m.moveToward402(goal,speed,dt,id);
  if(blocker(g,m,old,m)){m.x=old.x;m.y=old.y;m.setMoveIntent(0,0);}
 }
 // The leader is a dynamic obstacle, not part of the static terrain route.
 // Reserve reachable attack positions rather than two fixed front slots and
 // permanently non-attacking back rows. Nearby walls belong to the same siege.
 function clear(g,m,a,b,buildings){return !g.demonLineBlocked?.(a,b,m.radius,true)&&!blocker(g,m,a,b,buildings);}
 function attackPosition(g,m,target,leader,base,buildings){
  const cached=positionCache.get(m);if(cached&&m.miniPositionTimer>0&&cached.source===target&&Math.hypot(cached.tx-target.x,cached.ty-target.y)<8&&cached.count===buildings.length&&cached.radius===leader.radius&&Math.hypot(cached.lx-leader.x,cached.ly-leader.y)<8&&(!cached.best||alive(cached.best.target)&&dist(cached.best.point,leader)>=m.radius+(leader.radius||34)+9)&&!(m.miniRejectedMs>0&&cached.best&&dist(cached.best.point,m.miniRejectedPosition)<20))return cached.best;
  const peers=(g.miniTrolls||[]).filter(q=>q!==m&&!q.dead),i=slot(g,m),side=i%2?1:-1;
  const candidates=[target];if(target.type==='wall')for(const b of buildings)if(b!==target&&alive(b)&&b.type==='wall'&&dist(b,target)<=190)candidates.push(b);
  let best=null,score=Infinity;
  for(const b of candidates){const dir=direction(g,b,leader,base),body=b.type==='wall'?Math.max(46,b.radius||0):(b.radius||12),front=body+m.radius+4,reach=body+m.attackRange-4;
   const offsets=b.type==='wall'?[side*64,-side*64,side*20,-side*20,side*76,-side*76,side*48,-side*48,0]:Array.from({length:12},(_,n)=>n*Math.PI/6);
   for(const extra of (b.type==='wall'?[0,12,24]:[0]))for(const offset of offsets){const depth=front+extra;const p=b.type==='wall'?{x:b.x+dir.x*depth-dir.y*offset,y:b.y+dir.y*depth+dir.x*offset}:{x:b.x+Math.cos(offset)*Math.min(reach,body+m.radius+30),y:b.y+Math.sin(offset)*Math.min(reach,body+m.radius+30)};
    if(m.miniRejectedPosition&&m.miniRejectedMs>0&&dist(p,m.miniRejectedPosition)<20)continue;
    if(dist(p,b)>reach||dist(p,leader)<m.radius+(leader.radius||34)+9||g.isTerrainBlocked?.(p.x,p.y,m.radius+2))continue;
    if(buildings.some(q=>alive(q)&&dist(p,q)<m.radius+(q.type==='wall'?Math.max(46,q.radius||0):(q.radius||12))+2))continue;
    if(peers.some(q=>q.miniFollowMode==='attack'&&q.miniAttackPosition&&q.miniAttackTarget&&!q.miniAttackTarget.dead&&dist(p,q.miniAttackPosition)<m.radius+(q.radius||18)+7))continue;
    const cost=dist(m,p)+(b===target?0:55)+(m.miniAttackTarget===b&&m.miniAttackPosition&&dist(p,m.miniAttackPosition)<2?-50:0)+(!clear(g,m,m,p,buildings)?70:0);
    if(cost<score){score=cost;best={target:b,point:p,dir,front};}
   }
  }
  positionCache.set(m,{source:target,tx:target.x,ty:target.y,count:buildings.length,radius:leader.radius,lx:leader.x,ly:leader.y,best});m.miniPositionTimer=200;
  if(best){m.miniAttackPosition=best.point;m.miniAttackTarget=best.target;return best;}
  m.miniAttackPosition=null;m.miniAttackTarget=null;return null;
 }
 function leaderClear(m,a,b,leader){
  const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(l<.001)return true;
  const t=Math.max(0,Math.min(1,((leader.x-a.x)*dx+(leader.y-a.y)*dy)/l)),min=m.radius+(leader.radius||34)+7;
  // An already overlapping follower may move outward to recover, never inward.
  if(dist(a,leader)<min&&dist(b,leader)>dist(a,leader)&&(a.x-leader.x)*dx+(a.y-leader.y)*dy>=0)return true;
  return Math.hypot(a.x+dx*t-leader.x,a.y+dy*t-leader.y)>=min;
 }
 function approach(g,m,goal,leader,dt,buildings){
  const peers=[leader,...(g.miniTrolls||[]).filter(q=>q!==m&&!q.dead)],clearPeers=(a,b)=>peers.every(q=>leaderClear(m,a,b,q));
  const blocking=peers.filter(q=>!leaderClear(m,m,goal,q)).sort((a,b)=>dist(m,a)-dist(m,b))[0];
  if(!blocking){m.miniLeaderRoute=null;m.miniLeaderRouteFailure=null;move(g,m,goal,dt,'mini-pack-attack');return;}
  leader=blocking;let route=m.miniLeaderRoute;
  if(route&&(route.obstacle!==leader||(leader.x-route.lx)**2+(leader.y-route.ly)**2>64||dist(goal,route.goal)>8))route=null;
  if(!route){
   const failed=m.miniLeaderRouteFailure;if(failed&&m.miniRouteProbeMs>0&&failed.obstacle===leader&&Math.hypot(failed.lx-leader.x,failed.ly-leader.y)<8&&dist(failed.goal,goal)<8){move(g,m,goal,dt,'mini-pack-attack');return;}
   const r=(m.radius+(leader.radius||34)+12)/Math.cos(Math.PI/12),nodes=[{x:m.x,y:m.y},{x:goal.x,y:goal.y}];
   for(let i=0;i<12;i++){const a=i*Math.PI/6,p={x:leader.x+Math.cos(a)*r,y:leader.y+Math.sin(a)*r};if(!g.isTerrainBlocked?.(p.x,p.y,m.radius+2))nodes.push(p);}
   const costs=nodes.map(()=>Infinity),prev=[],done=new Set();costs[0]=0;
   for(let n=0;n<nodes.length;n++){let u=-1;for(let k=0;k<nodes.length;k++)if(!done.has(k)&&(u<0||costs[k]<costs[u]))u=k;if(u<0||!Number.isFinite(costs[u])||u===1)break;done.add(u);
    for(let v=1;v<nodes.length;v++){if(v===u||done.has(v)||!clearPeers(nodes[u],nodes[v])||!clear(g,m,nodes[u],nodes[v],buildings))continue;const c=costs[u]+dist(nodes[u],nodes[v]);if(c<costs[v]){costs[v]=c;prev[v]=u;}}
   }
   if(Number.isFinite(costs[1])){const path=[];for(let k=1;k!==0;k=prev[k])path.unshift(nodes[k]);route={obstacle:leader,lx:leader.x,ly:leader.y,goal:{x:goal.x,y:goal.y},path,index:0};}
   m.miniLeaderRoute=route||null;m.miniLeaderRouteFailure=route?null:{obstacle:leader,lx:leader.x,ly:leader.y,goal:{x:goal.x,y:goal.y}};m.miniRouteProbeMs=200;
  }
  if(route){while(route.index<route.path.length-1&&dist(m,route.path[route.index])<4)route.index++;move(g,m,route.path[route.index],dt,'mini-pack-leader-detour');}
  else move(g,m,goal,dt,'mini-pack-attack');
 }
 function separate(g,m,leader){
  // Terrain-tested displacement, never teleport or move through occupied walls.
  const peers=(g.miniTrolls||[]).filter(e=>e!==m&&!e.dead);if(alive(leader))peers.push(leader);
  if(Number.isFinite(m.miniFollowPrevX))for(const e of peers){const min=m.radius+(e.radius||18)+5,now=dist(m,e),before=Math.hypot(m.miniFollowPrevX-e.x,m.miniFollowPrevY-e.y);if(now<min&&now<before-.01){m.x=m.miniFollowPrevX;m.y=m.miniFollowPrevY;
   const goal=m.miniFollowGoal||m,a=Math.atan2(goal.y-m.y,goal.x-m.x),speed=Math.min(3.24,m.speed*m.movementSlowMultiplier());
   for(const turn of [.8,-.8,1.57,-1.57,2.2,-2.2]){const dx=Math.cos(a+turn)*speed,dy=Math.sin(a+turn)*speed,p={x:m.x+dx,y:m.y+dy};if(peers.every(q=>dist(p,q)>=Math.min(m.radius+(q.radius||18)+5,dist(m,q))-.005)&&clear(g,m,m,p,g.buildings)){m.moveByTerrain(dx,dy);break;}}
   break;}}
  let x=0,y=0;for(const e of peers){let dx=m.x-e.x,dy=m.y-e.y,d=Math.hypot(dx,dy),min=m.radius+(e.radius||18)+5;if(d>=min)continue;if(d<.001){const a=(slot(g,m)+1)*2.399963;dx=Math.cos(a);dy=Math.sin(a);d=1;}const force=Math.min(.8,(min-d)*.08);x+=dx/d*force;y+=dy/d*force;}
  const len=Math.hypot(x,y);if(len>.001){const cap=Math.min(1.2,len);const old={x:m.x,y:m.y};m.moveByTerrain(x/len*cap,y/len*cap);if(blocker(g,m,old,m)){m.x=old.x;m.y=old.y;}}
 }
 function rallyMove(g,m,goal,base,dt){const b=blocker(g,m,m,goal),leader=g.troll;approach(g,m,goal,alive(leader)&&!leaderClear(m,m,goal,leader)?leader:alive(b)&&dist(m,b)<260?b:base,dt,g.buildings);}
 // Initial conversion lifecycle is simulation-time only. Arrival, not death,
 // starts the minute; saves retain both phase and remaining duration.
 function initialRally(g,m,leader,base,dt){
  if(m.miniRallyState==='active')return false;
  positionCache.delete(m);m.miniPositionTimer=0;m.target=null;m.miniAttackPosition=null;m.miniAttackTarget=null;m.miniLeaderRoute=null;
  if(!['return','waiting','rendezvous'].includes(m.miniRallyState)){m.miniRallyState='return';m.miniRallyWaitMs=60000;}
  if(!Number.isFinite(m.miniRallyWaitMs))m.miniRallyWaitMs=60000;
  m.miniRallyWaitMs=Math.max(0,Math.min(60000,m.miniRallyWaitMs));
  if(!Number.isInteger(m.miniRallySlot)||m.miniRallySlot<0)m.miniRallySlot=Math.max(0,(g.miniTrolls||[]).indexOf(m));
  const goal=m.miniFollowGoal||(m.miniFollowGoal={x:m.x,y:m.y});
  if(!alive(base)){m.miniFollowMode='base-unavailable';m.setMoveIntent(0,0);return true;}
  const a=m.miniRallySlot*Math.PI/4,r=(base.radius||100)+70;
  const home={x:base.x+Math.cos(a)*r,y:base.y+Math.sin(a)*r};
  const atBase=dist(m,base)<(base.radius||100)+100;
  if(m.miniRallyState==='return'){
   m.miniFollowMode='initial-return';goal.x=home.x;goal.y=home.y;
   const z=g.resourceZones?.[m.miniRallyExitZone];
   if(m.miniRallyExitPending&&z){
    const dir=exitDirection(z),gateWalls=(g.buildings||[]).filter(b=>alive(b)&&isOriginGateWall(z,b)),body=Math.max(46,...gateWalls.map(b=>exitProjection(z,b)+Math.max(46,b.radius||0))),edge=body+m.radius+8;
    if(exitProjection(z,m)>=edge){m.miniRallyExitPending=false;m.miniRallyExitPass=false;}
    else{
     const cells=z.gateCells||[{x:z.gateX,y:z.gateY}];
     const gaps=cells.filter(p=>!g.isTerrainBlocked?.(p.x,p.y,m.radius+2)&&!g.demonBlockingBuilding?.(m,{x:p.x-dir.x*(edge+12),y:p.y-dir.y*(edge+12)},{x:p.x+dir.x*(edge+50),y:p.y+dir.y*(edge+50)},gateWalls)).sort((a,b)=>dist(m,a)-dist(m,b));
     const insideWall=gateWalls.some(b=>dist(m,b)<Math.max(46,b.radius||0)+m.radius+2);
     if(gaps.length&&!insideWall)m.miniRallyExitPass=false;
     const sealed=[-90,0,90].some(depth=>cells.every(p=>gateWalls.some(b=>Math.abs(exitProjection(z,b)-depth)<=4&&Math.abs((b.x-p.x)*-dir.y+(b.y-p.y)*dir.x)<=4)));
     if(!gaps.length&&sealed)m.miniRallyExitPass=true;
     const gap=m.miniRallyExitPass?{x:z.gateX,y:z.gateY}:(gaps[0]||cells.slice().sort((a,b)=>dist(m,a)-dist(m,b))[0]);
     const lateral=Math.abs((m.x-gap.x)*-dir.y+(m.y-gap.y)*dir.x),depth=!m.miniRallyExitPass&&lateral>12&&exitProjection(z,m)<-72?-(edge+12):edge+50;
     goal.x=gap.x+dir.x*depth;goal.y=gap.y+dir.y*depth;
     if(depth>0&&alive(leader)&&dist(goal,leader)<m.radius+(leader.radius||34)+16){goal.x+=dir.x*110;goal.y+=dir.y*110;}
     rallyMove(g,m,goal,base,dt);separate(g,m,leader);
     if(exitProjection(z,m)>=edge){m.miniRallyExitPending=false;m.miniRallyExitPass=false;}return true;
    }
   }
   if(atBase){m.miniRallyExitPending=false;m.miniRallyExitPass=false;m.miniRallyState='waiting';m.miniFollowMode='base-wait';m.setMoveIntent(0,0);return true;}
   rallyMove(g,m,goal,base,dt);separate(g,m,leader);return true;
  }
  if(m.miniRallyState==='waiting'){
   m.miniFollowMode='base-wait';goal.x=home.x;goal.y=home.y;
   rallyMove(g,m,goal,base,dt);separate(g,m,leader);
   // Pushed outside the base? Return before consuming more of the wait.
   if(atBase&&dist(m,base)<(base.radius||100)+100)m.miniRallyWaitMs=Math.max(0,m.miniRallyWaitMs-dt);
   if(m.miniRallyWaitMs===0){m.miniRallyState='rendezvous';m.miniFollowMode='rendezvous';}
   return true;
  }
  m.miniFollowMode='rendezvous';
  if(!alive(leader)){goal.x=home.x;goal.y=home.y;rallyMove(g,m,goal,base,dt);separate(g,m,leader);return true;}
  if(dist(m,leader)<=220){m.miniRallyState='active';return false;}
  const focus=leader.target||leader.patrolTarget,angle=focus?Math.atan2(focus.y-leader.y,focus.x-leader.x):0,side=m.miniRallySlot%2?1:-1,row=Math.floor(m.miniRallySlot/2);
  goal.x=leader.x-Math.cos(angle)*(90+row*44)-Math.sin(angle)*side*24;
  goal.y=leader.y-Math.sin(angle)*(90+row*44)+Math.cos(angle)*side*24;
  move(g,m,goal,dt,'mini-initial-rendezvous');separate(g,m,leader);return true;
 }
 function update(g,m,dt,elves,buildings,tanks,base){
  if(!simulate())return true;if(!g)return false;if(!Number.isFinite(dt)||dt<=0)return true;
  m.miniRouteProbeMs=Math.max(0,(m.miniRouteProbeMs||0)-dt);
  m.miniPositionTimer=Math.max(0,(m.miniPositionTimer||0)-dt);
  m.miniRejectedMs=Math.max(0,(m.miniRejectedMs||0)-dt);
  const leader=g.troll;prepare(g,m,leader);if(m.dead)return true;
  m.miniFollowPrevX=m.x;m.miniFollowPrevY=m.y;const step=Math.min(100,dt);m.attackCd-=step;m.moveSlowTimer=Math.max(0,(m.moveSlowTimer||0)-step);m.attackSlowTimer=Math.max(0,(m.attackSlowTimer||0)-step);
  if(initialRally(g,m,leader,base,dt))return true;
  const i=slot(g,m),side=i%2?1:-1,row=Math.floor(i/2),follow=m.miniFollowGoal||(m.miniFollowGoal={x:m.x,y:m.y});
  if(!alive(leader)||leader.retreating){
   positionCache.delete(m);m.miniPositionTimer=0;m.target=null;m.miniAttackPosition=null;m.miniAttackTarget=null;m.miniLeaderRoute=null;m.miniFollowMode=alive(leader)?'retreat':'base';
   const home=alive(leader)?leader:alive(base)?base:null;
   if(home){follow.x=home.x+side*(54+row*8);follow.y=home.y+90+row*44;move(g,m,follow,step,'mini-pack-return');if(alive(base)&&base.inSupplyRange(m))m.hp=Math.min(m.maxHp,m.hp+m.maxHp*.04*step/1000);}else m.setMoveIntent(0,0);
   separate(g,m,leader);return true;
  }
  const contact=m.attackCd<=0&&dist(m,leader)<=650&&g.ghostStoneContactBN?.(m);
  if(contact){m.setMoveIntent(0,0);latchAttackFacing(m,contact);contact.takeDamage(m.miniFollowDamage,m);m.attackCd=800*(m.attackSlowTimer>0?m.attackSlowFactor:1);m.playAction('bite',240);return true;}
  let target=visible(g,m,leader.target)&&[...elves,...buildings,...tanks].includes(leader.target)?leader.target:null;
  if(!target){let nearest=Infinity;for(const e of [...elves,...buildings,...tanks]){if(!visible(g,m,e)||dist(e,leader)>leader.viewRange||dist(m,e)>m.viewRange)continue;const d=dist(m,e);if(d<nearest){nearest=d;target=e;}}}
  if(dist(m,leader)>650)target=null;
  if(target){const blocker=g.demonBlockingBuilding?.(m,m,target,buildings);if(alive(blocker)&&blocker.type==='wall')target=blocker;}
  if(target){
   m.miniFollowMode='attack';const assignment=attackPosition(g,m,target,leader,base,buildings);
   if(assignment)target=assignment.target;
   m.target=target;const dir=assignment?.dir||direction(g,target,leader,base),front=assignment?.front||Math.max(target.type==='wall'?46:12,target.radius||12)+m.radius+4;
   if(assignment){follow.x=assignment.point.x;follow.y=assignment.point.y;}
   else{follow.x=target.x+dir.x*(front+90+row*44)-dir.y*side*42;follow.y=target.y+dir.y*(front+90+row*44)+dir.x*side*42;}
   approach(g,m,follow,leader,step,buildings);separate(g,m,leader);
   if(assignment&&dist(m,follow)>8&&Math.hypot(m.x-m.miniFollowPrevX,m.y-m.miniFollowPrevY)<.35)m.miniAttackStall=(m.miniAttackStall||0)+step;else m.miniAttackStall=0;
   if(m.miniAttackStall>800){m.miniRejectedPosition={x:follow.x,y:follow.y};m.miniRejectedMs=2500;m.miniAttackStall=0;m.miniPositionTimer=0;m.miniAttackPosition=null;m.miniLeaderRoute=null;}
   const projection=(m.x-target.x)*dir.x+(m.y-target.y)*dir.y;
   const reach=(target.type==='wall'?Math.max(46,target.radius||0):(target.radius||12))+m.attackRange;
   if((target.type!=='wall'||projection>=front-4)&&dist(m,target)<reach&&m.attackCd<=0&&alive(target)&&typeof target.takeDamage==='function'&&!g.demonLineBlocked?.(m,target,0,true)&&!g.demonBlockingBuilding?.(m,m,target,buildings.filter(b=>b!==target))){
    latchAttackFacing(m,target);target.takeDamage(m.miniFollowDamage,m);m.attackCd=800*(m.attackSlowTimer>0?m.attackSlowFactor:1);m.playAction('bite',240);
   }
  }else{
   positionCache.delete(m);m.miniPositionTimer=0;m.target=null;m.miniAttackPosition=null;m.miniAttackTarget=null;m.miniLeaderRoute=null;m.miniFollowMode='follow';const focus=leader.target||leader.patrolTarget,angle=focus?Math.atan2(focus.y-leader.y,focus.x-leader.x):0,dx=Math.cos(angle),dy=Math.sin(angle);
   follow.x=leader.x-dx*(90+row*44)-dy*side*24;follow.y=leader.y-dy*(90+row*44)+dx*side*24;move(g,m,follow,step,'mini-pack-follow');separate(g,m,leader);
  }
  return true;
 }
 return {update,prepare,prepareAtBase,spawnPoint,enabled:()=>true,restore:()=>{},direction};
};
