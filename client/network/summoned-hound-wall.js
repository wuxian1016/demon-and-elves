'use strict';
const installed=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=e=>e&&!e.dead;
function enemy(h,e){return alive(e)&&!(h.team!=null&&e.team!=null&&h.team===e.team);}
function installSummonedHoundWalls(game,{Hound,active=()=>true}={}){
 if(!Hound?.prototype||typeof Hound.prototype.update!=='function')return null;
 if(installed.has(Hound.prototype))return installed.get(Hound.prototype);
 const update=Hound.prototype.update,locks=new WeakMap(),stats={wallSelections:0,wallBites:0,wallReleases:0,approachProbes:0};
 const deferred=(h,e)=>game.isChaseTargetDeferred?.(h,e)===true;
 const intent=(h,elves,buildings,troll,tanks)=>{let nearest=null,best=Infinity;const consider=e=>{if(!enemy(h,e)||deferred(h,e))return;const d=distance(h,e);if(d<h.viewRange&&d<best){nearest=e;best=d;}};for(const e of elves||[])if(!e.inHouse&&!e.drivingTank)consider(e);for(const e of tanks||[])consider(e);for(const e of buildings||[])consider(e);return nearest||alive(troll)&&troll||null;};
 Hound.prototype.update=function(dt,elves,buildings,troll,tanks){
  if(!active()||this.dead||this.waveHound||this.waveBat||!Number.isFinite(dt)||dt<0)return update.call(this,dt,elves,buildings,troll,tanks);
  let row=locks.get(this);if(!row){row={clock:0,wall:null,intent:null,point:null,probeAt:-Infinity};locks.set(this,row);}row.clock+=dt;
  const candidates=(buildings||[]).filter(e=>enemy(this,e));
  let goal=row.wall&&enemy(this,row.intent)?row.intent:intent(this,elves,candidates,troll,tanks);
  const blocker=goal&&game.demonBlockingBuilding?.(this,this,goal,candidates);
  let wall=blocker?.type==='wall'&&distance(this,blocker)-(blocker.radius||0)<=this.viewRange&&!deferred(this,blocker)?blocker:null;
  if(row.wall&&wall!==row.wall){stats.wallReleases++;if(this.target===row.wall)this.target=null;row.point=null;}
  if(!wall){row.wall=row.intent=null;return update.call(this,dt,elves,candidates,troll,tanks);}
  if(row.rejected===wall&&row.clock<row.retryAt)return update.call(this,dt,elves,candidates.filter(e=>e!==wall),troll,tanks);
  if(wall!==row.wall){row.wall=wall;row.intent=goal;row.probeAt=-Infinity;row.point=null;stats.wallSelections++;}
  if(row.clock-row.probeAt>=500||Math.hypot(this.x-(row.px??Infinity),this.y-(row.py??Infinity))>=24||row.wx!==wall.x||row.wy!==wall.y){
   row.probeAt=row.clock;row.px=this.x;row.py=this.y;row.wx=wall.x;row.wy=wall.y;stats.approachProbes++;
   row.point=game.directWallAttackPoint?.(this,wall)||null;
  }
  const point=row.point;
  // A blocked front face is not permission to tunnel through terrain or chase
  // a wall elsewhere. Let the original target selection resume without it.
  if(!point||game.demonLineBlocked?.(this,point,this.radius)||game.demonBlockingBuilding?.(this,this,point,candidates)){
   if(this.target===wall)this.target=null;row.rejected=wall;row.retryAt=row.clock+500;row.wall=row.intent=row.point=null;stats.wallReleases++;return update.call(this,dt,elves,candidates.filter(e=>e!==wall),troll,tanks);
  }
  this.armorShredTimer=Math.max(0,(this.armorShredTimer||0)-dt);this.attackCd-=dt;
  this.moveSlowTimer=Math.max(0,(this.moveSlowTimer||0)-dt);this.attackSlowTimer=Math.max(0,(this.attackSlowTimer||0)-dt);
  this.target=wall;const reach=this.attackReachFor(wall),speed=this.speed*this.movementSlowMultiplier();
  if(distance(this,wall)>reach-2){const d=distance(this,point);if(d>0){const step=Math.min(speed,d);this.moveByTerrain((point.x-this.x)/d*step,(point.y-this.y)/d*step);}else this.setMoveIntent?.(0,0);}
  if(!wall.dead&&this.attackCd<=0&&distance(this,wall)<reach){const damage=this.getDamage();if(damage>0)wall.takeDamage?.(damage,this);this.attackCd=500*(this.attackSlowTimer>0?this.attackSlowFactor:1);this.playAction('bite',420);stats.wallBites++;}
 };
 const api={stats:()=>({...stats}),lock:h=>locks.get(h)?.wall||null};installed.set(Hound.prototype,api);return api;
}
module.exports={installSummonedHoundWalls};
