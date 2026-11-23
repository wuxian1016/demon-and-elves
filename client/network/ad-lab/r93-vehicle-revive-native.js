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
 function capture(g,v){
  const id=match(g),kind=kindOf(v);if(kind==null||g!==game()||solo(g)!==true||!id||!own(v)||
   !Array.isArray(g.tanks)||!g.tanks.includes(v)||v.dead!==true||v.hp!==0||v.driver||v.crew||
   ![v.x,v.y,v.radius,v.maxHp].every(Number.isFinite)||v.radius<=0||v.maxHp<=0)return null;
  const old=wrecks.get(v);if(old?.id===id&&!old.hasRevived)return null;
  const record={id,g,kind,x:v.x,y:v.y,deathId:++serial,hasRevived:false};
  wrecks.set(v,record);
  return {unit:v,eventId:record.deathId,kind,own:true,destroyed:true};
 }
 const groups=g=>[g.buildings,g.tanks,g.trees,g.goldMines,g.guardTrees,g.allies,g.peasants,g.hounds,g.miniTrolls,
  [g.player,g.troll,g.trollBase]];
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
  const e=g.player,clearOfPlayer=(x-e.x)**2+(y-e.y)**2>=(r+(e.radius||0)+2)**2;
  if(!clearOfPlayer||g.playerVehicleSlotUsed()!==false||g.queryTerrainCollisionAt(x,y,r,false))return null;
  // Conservative extra separation. Native lists include solids, resource nodes,
  // and any live ejected crew standing at the destination.
  for(const list of groups(g))for(const o of list||[]){
   if(!o||v===o||o.dead||![o.x,o.y].every(Number.isFinite))continue;
   const d=Math.max(0,Number.isFinite(o.radius)?o.radius:0)+r+2;
   if((x-o.x)**2+(y-o.y)**2<d*d)return null;
  }
  const hp=health(v,old.kind,g);
  if(!Number.isFinite(hp)||hp<=0||!Number.isFinite(maxHp)||hp>maxHp)return null;
  return {v,g,old,hp};
 }
 function restore(row){
  const plan=check(row);if(!plan)return false;
  const {v,g,old,hp}=plan;
  // No constructor, tech recalculation, wallet writes, relic transfers, boarding,
  // or crew restoration. Keep model, exact elapsed cooldowns and upgrades intact.
  g.clearUnitNavigation?.(v);g.vehicleRecoveryWatches?.delete(v);
  old.hasRevived=true;
  v.hp=hp;v.dead=false;v.siegeTarget=null;v.turretAim=null;
  if(v instanceof Robot){v.laserAim=null;v.flameTimer=0;v.superTimer=0;}
  v.actionKind=null;v.actionAnim=0;v.moving=false;v.recoveryMoveIntent=false;
  v.moveIntentX=v.moveIntentY=0;v._animX=v.x;v._animY=v.y;
  if(!g.tanks.includes(v))g.tanks.push(v);
  return true;
 }
 return {capture,canRetain:row=>!!check(row,false),canRestore:row=>!!check(row),restore};
};
