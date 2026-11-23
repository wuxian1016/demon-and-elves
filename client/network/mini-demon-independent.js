'use strict';
const COSTS=[80,170,260,460,720];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const bodyVisible=(g,m,e)=>!!e&&!e.dead&&!e.inHouse&&!e.drivingTank&&!e.inTank&&!g.isChaseTargetDeferred?.(m,e)&&distance(m,e)<=m.viewRange;
module.exports=function({offline=()=>false,random=Math.random,soloDefault=false}={}){
 const state=new WeakMap();
 const enabled=g=>!!g&&offline()===true&&(g.miniDemonIndependentCandidate===true||(soloDefault===true&&g.miniDemonIndependentCandidate!==false&&!g.tutorial&&['prep','hunt'].includes(g.state)&&Array.isArray(g.miniTrolls)&&g.miniTrolls.length>0));
 function owners(g,elves){return elves.filter(e=>e&&!e.dead&&!e.defected&&e.hp>0);}
 function slot(g,e){return e===g.player?null:e.slot;}
 function choose(g,s,elves){const living=owners(g,elves);if(!living.length){s.owner=null;return null;}const i=Math.min(living.length-1,Math.max(0,Math.floor(random()*living.length)));s.owner=living[i];s.target=null;return s.owner;}
 function prepare(m){m.syncProgression402();if(m.independentMiniVersion!==1){const ratio=Math.max(0,Math.min(1,m.hp/m.maxHp));m.independentMiniHpBonus=Math.round(m.maxHp*.35);m.independentMiniOriginalRadius=m.radius;m.maxHp+=m.independentMiniHpBonus;m.hp=m.dead?0:m.maxHp*ratio;m.radius=18;m.equipmentDamage+=8;m.independentMiniVersion=1;}}
 function restore(m){
  if(!m.independentMiniVersion)return;
  const ratio=Math.max(0,Math.min(1,m.hp/m.maxHp));
  m.maxHp=Math.max(1,m.maxHp-(m.independentMiniHpBonus||196));m.hp=m.dead?0:m.maxHp*ratio;
  m.radius=m.independentMiniOriginalRadius??14;m.equipmentDamage=Math.max(0,m.equipmentDamage-8);
  delete m.independentMiniVersion;delete m.independentMiniHpBonus;delete m.independentMiniOriginalRadius;
  m.target=null;delete m.independentMiniState;state.delete(m);
 }
 function update(g,m,dt,elves,buildings,tanks,base){
  if(!enabled(g)){restore(m);return false;}
  if(!Number.isFinite(dt)||dt<=0)return true;
  if(m.dead){delete m.independentMiniState;state.delete(m);return true;}
  g.miniDemonIndependentCandidate=true;prepare(m);let s=state.get(m);if(!s){s=m.independentMiniState;if(!s||s.version!==1||!['raid','supply'].includes(s.mode))s={version:1,owner:null,target:null,mode:'raid',elapsed:0,stalled:0,retarget:0};m.independentMiniState=s;state.set(m,s);}
  const step=Math.max(0,Math.min(100,Number(dt)||0));m.attackCd-=step;m.moveSlowTimer=Math.max(0,(m.moveSlowTimer||0)-step);m.attackSlowTimer=Math.max(0,(m.attackSlowTimer||0)-step);s.elapsed+=step;
  const price=COSTS[m.gearTier];
  if(base&&!base.dead&&(s.mode==='supply'||m.hp/m.maxHp<.3||(price!==undefined&&m.gold>=price))){
   s.mode='supply';m.target=null;
   if(base.inSupplyRange(m)){m.setMoveIntent(0,0);m.autoBuyEquipment402(base,step);m.hp=Math.min(m.maxHp,m.hp+m.maxHp*.06*step/1000);const next=COSTS[m.gearTier];if(m.hp/m.maxHp>=.85&&(next===undefined||m.gold<next)){s.mode='raid';s.owner=null;s.target=null;s.elapsed=0;}}
   else m.moveToward402(base,m.speed*m.movementSlowMultiplier(),step,'mini-independent-supply');
   return true;
  }
  s.mode='raid';if(!s.owner||s.owner.dead||s.owner.defected||!elves.includes(s.owner)||s.owner.hp<=0)choose(g,s,elves);
  if(!s.owner){m.target=null;m.setMoveIntent(0,0);return true;}
  const ownerSlot=slot(g,s.owner),own=buildings.filter(b=>!b.dead&&b.hp>0&&(b.ownerSlot??null)===ownerSlot);
  // Each raider selects its own owner. Break that owner's nearest wall before
  // entering; no reference to the large demon's current target or retreat flag.
  const walls=own.filter(b=>b.type==='wall');let target=(walls.length?walls:own).reduce((best,b)=>!best||distance(m,b)<distance(m,best)?b:best,null);
  if(!target){const vehicle=s.owner.drivingTank||s.owner.inTank;
   if(vehicle&&!vehicle.dead&&tanks.includes(vehicle)&&distance(m,vehicle)<=m.viewRange&&!g.isChaseTargetDeferred?.(m,vehicle))target=vehicle;
   else if(bodyVisible(g,m,s.owner))target=s.owner;
  }
  if(!target){
   // A raid may search the owner's public camp, not track a hidden/remote body.
   m.target=null;s.target=null;
   const index=s.owner===g.player?g.playerStartZoneIndex:s.owner.homeZoneIndex;
   const camp=(g.resourceZones||[])[index];
   if(camp&&distance(m,camp)>40)m.moveToward402(camp,m.speed*m.movementSlowMultiplier(),step,'mini-independent-search');else m.setMoveIntent(0,0);
   return true;
  }
  m.target=target;s.target=target;const reach=(target.type==='wall'?Math.max(46,target.radius||0):(target.radius||12))+m.attackRange;
  let goal=target,canHit=true;
  if(target.type==='wall'){
   const zone=(g.resourceZones||[]).reduce((best,z)=>!best||distance({x:z.gateX,y:z.gateY},target)<distance({x:best.gateX,y:best.gateY},target)?z:best,null);
   if(zone&&base){const dx=base.x-zone.gateX,dy=base.y-zone.gateY,len=Math.hypot(dx,dy)||1,gap=Math.max(46,target.radius||0)+m.radius+4;goal={x:target.x+dx/len*gap,y:target.y+dy/len*gap};canHit=(m.x-target.x)*dx/len+(m.y-target.y)*dy/len>=gap-3;}
  }
  const d=distance(m,target);if(d>reach-2||!canHit)m.moveToward402(goal,m.speed*m.movementSlowMultiplier(),step,'mini-independent-raid');else m.setMoveIntent(0,0);
  if(canHit&&distance(m,target)<reach&&m.attackCd<=0&&!target.dead&&typeof target.takeDamage==='function'){
   const before=target.hp;target.takeDamage(m.getDamage(),m);
   // Reward actual HP removed only, never invulnerable/failed hits or corpses.
   if(target.type&&target.hp<before)m.gainRaidRewards402(target,target.dead);
   m.attackCd=800*(m.attackSlowTimer>0?m.attackSlowFactor:1);m.playAction('bite',240);
   if(target.dead&&target===s.owner){s.owner=null;s.target=null;}
  }
  return true;
 }
 return {enabled,update,choose,owners,state,COSTS,restore};
};
