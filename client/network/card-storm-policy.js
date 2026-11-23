'use strict';
const RADIUS=350;
const PULSES=24,STUN_MS=3000;
// The serialized DPS already identifies the cast's numerical policy. Preserve
// an in-progress older cast, including its remaining pulses, across upgrades.
const LEGACY_DPS=1800,PREVIOUS_DPS=3200,DPS=4000;
const LEGACY_SLIME_CURVE=[[17,1.28],[18,.994],[19,.94],[20,.86],[25,.47],[45,.32]];
// Full-field damage relative to an ordinary slime. Early waves are clearable;
// healthy late slimes progressively survive a single cast.
const PREVIOUS_SLIME_CURVE=[[17,1.85],[18,1.26],[19,1.16],[20,1.06],[21,.98],[25,.80],[45,.55]];
const SLIME_CURVE=[[17,2.12],[18,1.46],[19,1.37],[20,1.28],[21,1.22],[25,1.07],[26,.99],[45,.75]];
function slimeRatio(wave,curve=SLIME_CURVE){
 if(wave<=curve[0][0])return curve[0][1];
 for(let i=1;i<curve.length;i++){const [to,dst]=curve[i];if(wave<=to){const [from,src]=curve[i-1];return src+(dst-src)*(wave-from)/(to-from);}}
 return curve[curve.length-1][1];
}
function create(g,{width,height}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('Invalid storm world bounds');
 function damagePolicy(e,p){
  const maxHp=e.maxHp;
  if(!Number.isFinite(maxHp)||maxHp<=0)return 0;
  const legacy=p.damage===LEGACY_DPS/4,previous=p.damage===PREVIOUS_DPS/4,boss=e===g.troll||e.waveStone===true;
  if(boss)return Math.min(legacy ? LEGACY_DPS/4 : PREVIOUS_DPS/4,maxHp*(e===g.troll?(legacy ? .06 : .08):(legacy ? .12 : .16))/PULSES,Math.max(0,e.hp-1));
  const wave=Number.isFinite(e.waveNumber)?Math.max(1,e.waveNumber):Math.max(1,g.waveNumber||1);
  if(e.waveBat)return maxHp*(legacy ? .65 : previous ? (wave<=20 ? 1.05 : .90) : wave<=20 ? 1.18 : wave<=35 ? 1.07 : .97)/PULSES;
  if(e.waveMammoth||e.waveMammothBN)return maxHp*(legacy ? .90 : previous ? (wave<=20 ? 1.14 : .98) : wave<=20 ? 1.28 : wave<=35 ? 1.10 : .99)/PULSES;
  if(e.waveHound){
   return maxHp*slimeRatio(wave,legacy ? LEGACY_SLIME_CURVE : previous ? PREVIOUS_SLIME_CURVE : SLIME_CURVE)/PULSES;
  }
  return Math.min(p.damage,maxHp*(legacy ? .76 : previous ? .96 : 1.08)/PULSES);
 }
 return Object.freeze({approved:true,radius:RADIUS,damagePerSecond:DPS,
  acceptsDamagePerSecond:value=>value===DPS||value===PREVIOUS_DPS||value===LEGACY_DPS,
  validateArea:({x,y})=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<=width&&y<=height,
  damagePolicy,
  stunPolicy:()=>({allowed:true,durationMs:STUN_MS}),
 });
}
module.exports={create,RADIUS,PULSES,slimeRatio};
