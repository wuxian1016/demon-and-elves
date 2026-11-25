'use strict';

// Capture only at the end of Tank/Robot.takeDamage's native fatal branch,
// after relic transfer and crew/driver ejection. Never call from an entity scan.
module.exports=function nativeRevive({Tank,Robot,width,height,game,match,solo,health}){
 if(typeof Tank!=='function'||typeof Robot!=='function'||typeof game!=='function'||
    typeof match!=='function'||typeof solo!=='function'||typeof health!=='function'||
    !Number.isFinite(width)||width<=0||!Number.isFinite(height)||height<=0)throw TypeError('Native vehicle revival contract required');
 let serial=0;const wrecks=new WeakMap();
 const kindOf=v=>v instanceof Robot?'robot':v instanceof Tank?'tank':null;
 const own=v=>v?.ownerSlot==null;
 function capture(g,v,driver,crew){
  const id=match(g),kind=kindOf(v);if(kind==null||g!==game()||solo(g)!==true||!id||!own(v)||
   !Array.isArray(g.tanks)||!g.tanks.includes(v)||v.dead!==true||v.hp!==0||v.driver||v.crew||
   ![v.x,v.y,v.radius,v.maxHp].every(Number.isFinite)||v.radius<=0||v.maxHp<=0)return null;
  const old=wrecks.get(v);if(old?.id===id&&!old.hasRevived)return null;
  const record={id,g,kind,x:v.x,y:v.y,driver,crew,deathId:++serial,hasRevived:false};
  wrecks.set(v,record);
  return {unit:v,eventId:record.deathId,kind,own:true,destroyed:true};
 }
 const groups=g=>[g.buildings,g.tanks,g.trees,g.goldMines,g.guardTrees,g.allies,g.peasants,g.hounds,g.miniTrolls,
  [g.player,g.troll,g.trollBase]];
 const steps=Array.from({length:12},(_,i)=>[Math.cos(i*Math.PI/6),Math.sin(i*Math.PI/6)]);
 function landing(g,v,old){
  const {x,y,radius:r}=v,terrain=(px,py)=>px-r<0||py-r<0||px+r>width||py+r>height||g.queryTerrainCollisionAt(px,py,r,false);
  if(g.playerVehicleSlotUsed()!==false||terrain(x,y))return null;
  const radius=o=>Math.max(0,o.type==='wall'?46:0,Number.isFinite(o.radius)?o.radius:0);
  const near=(o,px,py)=>((px-o.x)**2+(py-o.y)**2)<(r+radius(o)+2)**2;
  const local=[];
  let lower=0;
  // Keep the old original-site rule, except when only these actual dismounted
  // riders (not another unit/building) block a nearby safe recovery.
  for(const list of groups(g))for(const o of list||[]){
   if(!o||o===v||o.dead||!Number.isFinite(o.x)||!Number.isFinite(o.y))continue;
   const required=r+radius(o)+2,ds=(o.x-x)**2+(o.y-y)**2;
   if(ds<required**2){
    if(o!==old.driver&&o!==old.crew)return null;
    lower=Math.max(lower,required-Math.sqrt(ds));
   }
   if(ds<=(required+96)**2)local.push(o);
  }
  if(lower===0)return {x,y};
  const camp=g.resourceZoneIndexFor401?.(v);
  function safe(px,py){
   if(g.resourceZoneIndexFor401?.({x:px,y:py})!==camp||local.some(o=>near(o,px,py))||terrain(px,py))return false;
   const d=Math.hypot(px-x,py-y),n=Math.ceil(d/12);
   // The recovery offset is not a traversal exception: the whole footprint
   // stays on this side of terrain and walls. Riders are skipped only along
   // this virtual segment because the destroyed body started beneath them.
   for(let i=1;i<n;i++){
    const cx=x+(px-x)*i/n,cy=y+(py-y)*i/n;
    if(local.some(o=>o!==old.driver&&o!==old.crew&&near(o,cx,cy))||terrain(cx,cy))return false;
   }
   return true;
  }
  if(old.land&&safe(old.land.x,old.land.y))return old.land;
  for(let d=Math.ceil(lower)+1;d<=96;d+=10)for(const [dx,dy] of steps){
   const px=x+dx*d,py=y+dy*d;
   if(safe(px,py))return old.land={x:px,y:py};
  }
  return null;
 }
 function check(row,requireSite=true){
  const v=row?.unit,old=v&&wrecks.get(v),g=game();
  if(!old||old.hasRevived||old.g!==g||old.id!==match(g)||solo(g)!==true||
   (g.player?.dead??true)||old.deathId!==row.eventId||row.kind!==old.kind||kindOf(v)!==old.kind||
   !Array.isArray(g.tanks)||!own(v)||v.dead!==true||v.hp!==0||v.x!==old.x||v.y!==old.y||v.driver||v.crew||
   typeof g.playerVehicleSlotUsed!=='function'||
   typeof g.queryTerrainCollisionAt!=='function')return null;
  const {x,y,radius:r,maxHp}=v;
  if(!Number.isFinite(r)||r<=0||x-r<0||y-r<0||x+r>width||y+r>height||!Number.isFinite(maxHp)||maxHp<=0)return null;
  if(!requireSite)return true;
  const destination=landing(g,v,old);
  if(!destination)return null;
  const hp=health(v,old.kind,g);
  if(!Number.isFinite(hp)||hp<=0||!Number.isFinite(maxHp)||hp>maxHp)return null;
  return {v,g,old,hp,destination};
 }
 function restore(row){
  const plan=check(row);if(!plan)return false;
  const {v,g,old,hp,destination}=plan;
  // No constructor, tech recalculation, wallet writes, relic transfers, boarding,
  // or crew restoration. Keep model, exact elapsed cooldowns and upgrades intact.
  g.clearUnitNavigation?.(v);g.vehicleRecoveryWatches?.delete(v);
  old.hasRevived=true;
  v.x=destination.x;v.y=destination.y;v.hp=hp;v.dead=false;v.siegeTarget=null;v.turretAim=null;
  if(v instanceof Robot){v.laserAim=null;v.flameTimer=0;v.superTimer=0;}
  v.actionKind=null;v.actionAnim=0;v.moving=false;v.recoveryMoveIntent=false;
  v.moveIntentX=v.moveIntentY=0;v._animX=v.x;v._animY=v.y;
  if(!g.tanks.includes(v))g.tanks.push(v);
  return true;
 }
 return {capture,canRetain:row=>!!check(row,false),canRestore:row=>!!check(row),restore};
};
