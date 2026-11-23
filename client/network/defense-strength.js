'use strict';
// Transparent ranking heuristic, NOT simulated win probability or time-to-kill.
// Invoked only for camps already legally known to the raid policy.
const ATTACK=new Set(['tower','cannonTower','iceTower','manaTower']);
const finite=(x,fallback=0)=>Number.isFinite(x)?Math.max(0,x):fallback;
function levelOf(b){return Math.max(1,Math.floor(finite(b.level,1)));}
function iceControl(level){const extra=Math.max(0,level-6),regular=1.8+.2*(Math.min(6,Math.max(1,level))-1);const attackReduction=1-1/regular+(.8-(1-1/2.8))*extra/(extra+30);return {attackReduction,moveReduction:.6*extra/(extra+60)};}
function defenseStrength(buildings){
 const out={score:0,towerCount:0,towerLevels:0,wallCount:0,wallLevels:0,wallHp:0,wallScore:0,towerScore:0,nominalDps:0,controlScore:0,supportScore:0};let strongestIce=0;
 for(const b of buildings||[]){if(!b||b.dead||Number.isFinite(b.hp)&&b.hp<=0)continue;const level=levelOf(b);
  if(b.type==='wall'){
   const maxHp=finite(b.maxHp,700+(level-1)*620+(level-1)*(level-1)*150),hp=Math.min(maxHp,finite(b.hp,maxHp)),ratio=maxHp>0?hp/maxHp:0;
   out.wallCount++;out.wallLevels+=level;out.wallHp+=hp;
   // Levels/count preserve structural value; remaining health carries durability.
   //1400 = two intact native level1 walls. Wounded walls are easier, not unchanged.
   out.wallScore+=(1+level)*ratio+hp/1400;continue;
  }
  if(b.type==='watchtower'){out.towerCount++;out.towerLevels+=level;out.supportScore+=1+level+Math.max(0,level<2?0:2+3*(level-2))/10;continue;}
  if(!ATTACK.has(b.type))continue;
  out.towerCount++;out.towerLevels+=level;out.towerScore+=4+2*level;
  const damage=finite(typeof b.attackDamage==='function'?b.attackDamage():b.damage),interval=Math.max(1,finite(typeof b.attackInterval==='function'?b.attackInterval():null,b.type==='cannonTower'?900:b.type==='iceTower'?650:b.type==='manaTower'?520:400));
  let dps=damage*1000/interval;
  // Native cannon flame ticks every500ms. Potential stationary-target pressure;
  // not counted as guaranteed splash hits against a moving demon.
  if(b.type==='cannonTower'&&finite(b.burnDuration)>0)dps+=Math.max(1,damage*finite(b.burnDamageRatio,.12))*2;
  out.nominalDps+=dps;
  if(b.type==='iceTower'){const ice=iceControl(level);strongestIce=Math.max(strongestIce,4*ice.attackReduction+2*ice.moveReduction);}
  // Native mana bolt drains18; normalize18 mana/sec to one utility point.
  if(b.type==='manaTower')out.controlScore+=1000/interval;
 }
 out.controlScore+=strongestIce; // Native ice slows do not stack; strongest wins.
 //15 DPS is one native level1 arrow tower, before target armor/position effects.
 out.score=out.wallScore+out.towerScore+out.nominalDps/15+out.controlScore+out.supportScore;
 return out;
}
module.exports={defenseStrength,iceControl};
