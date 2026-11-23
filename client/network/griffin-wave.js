'use strict';

// Shares baked road geometry only. Griffins are never bats or cargo carriers.
const routes=require('./bat-fixed-route')(h=>h.griffinOrdinalBN&3);
const groundNet=require('./ground-net-control');
const HEIGHT=49,SPEED=71.5,AIM=300,DIVE=300,RECOVER=300;
const targets=new Set(['goldMine','houseForPeasants','tower','iceTower','manaTower','cannonTower']);
const isWave=n=>Number.isSafeInteger(n)&&n>=9&&n%10===9;
const rosterCount=(wave,count)=>Math.max(1,wave===9?Math.min(count,10)-3:count-4);
const scope=(g,win)=>!g.tutorial&&!g.superChallenge580&&!g.networkAuthorityPhases627&&!g.networkDrawCamera627&&win.networkDefenseModeBN?.()!==true&&win.batSoloPolicyBN?.allows?.(g)===true;
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const rank=b=>b.type==='goldMine'?0:b.type==='houseForPeasants'?1:2;
const sky=h=>h?.waveGriffinBN===true&&h.airborne===true;
const skyTower=b=>b.type==='tower'||b.type==='iceTower';
function canDamage(source,h,game){
 if(!sky(h))return true;
 return !!source&&(source.kind==='arrow'||source.kind==='ice'||source.batAntiAirBN===true||source.isRobot===true||source.batRobotSourceBN===true||source.cardStorm===true&&game?.cardsCandidate?.isStormSource?.(source)===true);
}
function hold(g,h,ms){
 if(!sky(h))return false;
 h.airborne=false;
 if(!groundNet.lock(g,h,ms)){h.airborne=true;return false;}
 h.griffinStrikeBN=null;h.griffinRecoverBN=0;h.griffinNetLeftBN=ms;
 return true;
}
function spawn(h,ordinal){
 h.waveGriffinBN=true;h.enemyKind='griffin';h.airborne=true;
 h.griffinOrdinalBN=ordinal;h.griffinAltitudeBN=HEIGHT;
 routes.spawned(h,ordinal);
}
const caches=new WeakMap();
function protection(g,b){return g.cardsCandidate?.mods(b)?.invulnerable===true;}
function eligible(g,b){
 if(!b||!targets.has(b.type)||!g.completedElfBuildingBN(b)||typeof b.takeDamage!=='function')return false;
 return !g.ownerWallet(b.ownerSlot??null)?.dead&&!b.invincible&&!b.invulnerable&&!b.protected&&!protection(g,b);
}
function targetRows(g,now){
 let s=caches.get(g);
 if(!s||s.player!==g.player||s.buildings!==g.buildings||s.zones!==g.resourceZones||s.n!==g.buildings.length||now<s.last||now-s.last>=200){
  s={player:g.player,buildings:g.buildings,zones:g.resourceZones,n:g.buildings.length,last:now,lanes:g.resourceZones.map(()=>[[],[],[]]),objects:new WeakMap()};
  for(const b of g.buildings){
   if(!eligible(g,b))continue;
   const lane=g.resourceZoneIndexFor401(b);
   if(s.lanes[lane]){s.lanes[lane][rank(b)].push(b);s.objects.set(b,{lane,x:b.x,y:b.y});}
  }
  caches.set(g,s);
 }
 return s;
}
function valid(g,cache,h,b){
 const row=b&&cache.objects.get(b);
 return row?.lane===h.waveZoneIndex&&row.x===b.x&&row.y===b.y&&eligible(g,b);
}
function bestTarget(g,cache,h){
 const groups=cache.lanes[h.waveZoneIndex];if(!groups)return null;
 for(const group of groups){
  let best=null,near=Infinity;
  for(const b of group){if(!valid(g,cache,h,b))continue;const d=d2(h,b);if(d<near){best=b;near=d;}}
  if(best)return best;
 }
 return null;
}
function face(h,dx,dy){
 const x=Math.abs(dx),y=Math.abs(dy);if(x+y<.01)return;
 if(x>y*.15)h.griffinFacingBN=h.facing=dx<0?-1:1;h.griffinRearBN=dy<-x*(h.griffinRearBN?.72:.95);
}
function move(h,p,dt){
 const dx=p.x-h.x,dy=p.y-h.y,d=Math.hypot(dx,dy),s=Math.min(d,SPEED*dt/1000*h.movementSlowMultiplier());
 if(d>.01){const x=dx*s/d,y=dy*s/d;face(h,x,y);h.x+=x;h.y+=y;h.setMoveIntent(x,y);}
 else h.setMoveIntent(0,0);
 return d<=s+.01;
}
function strikeTick(g,h,b,ms,allowed){
 const cast=h.griffinStrikeBN;
 h.setMoveIntent(0,0);if(!b||b.dead||!allowed()||d2(h,b)>((b.radius||0)+63)**2){h.griffinStrikeBN=null;return;}
 face(h,b.x-h.x,b.y-h.y);cast.age+=ms;
 if(cast.age>=AIM)h.griffinAltitudeBN=HEIGHT-39*Math.min(1,(cast.age-AIM)/DIVE);
 if(cast.age<AIM+DIVE)return;
 h.griffinStrikeBN=null;h.griffinRecoverBN=RECOVER;h.attackCd=h.slimeAttackInterval567()*(h.attackSlowTimer>0?h.attackSlowFactor:1);
 const damage=g.ghostElfAPI?.attackValue(h,b)??h.getDamage();if(allowed()&&damage>0)b.takeDamage(damage,h);
}
function possessedStrike(g,h,b,small=false){if(!b||!small&&b!==g.trollBase||b.dead||h.griffinStrikeBN||h.griffinRecoverBN>0||h.groundNetLockedBN||h.attackCd>0||d2(h,b)>((b.radius||0)+63)**2)return false;h.target=b;h.griffinStrikeBN={age:0,possessedSmall:small};h.setMoveIntent(0,0);return true;}
function possessedTick(g,h,dt,v,worldW,worldH,check){
 const ms=Math.min(50,dt);
 if(h.groundNetLockedBN||h.griffinNetLeftBN>0){h.griffinNetLeftBN=Math.max(0,(h.griffinNetLeftBN||0)-ms);h.airborne=false;h.griffinAltitudeBN=Math.max(0,h.griffinAltitudeBN-ms*.29);h.griffinStrikeBN=null;h.setMoveIntent(0,0);return;}
 h.airborne=true;
 if(h.griffinRecoverBN>0){h.griffinRecoverBN=Math.max(0,h.griffinRecoverBN-ms);h.griffinAltitudeBN=10+38*(1-h.griffinRecoverBN/RECOVER);h.setMoveIntent(0,0);return;}
 if(h.griffinStrikeBN){const small=h.griffinStrikeBN.possessedSmall===true;strikeTick(g,h,h.target,ms,()=>(small||h.target===g.trollBase)&&(!check||check(h,h.target)));return;}
 h.griffinAltitudeBN=Math.min(HEIGHT,h.griffinAltitudeBN+ms*.16);
 const dx=v?.dx||0,dy=v?.dy||0,s=SPEED*ms/1000*h.movementSlowMultiplier();
 const x=Math.max(0,Math.min(worldW,h.x+dx*s)),y=Math.max(0,Math.min(worldH,h.y+dy*s));
 face(h,x-h.x,y-h.y);h.setMoveIntent(x-h.x,y-h.y);h.x=x;h.y=y;
}
function update(g,h,dt,win){
 if(!scope(g,win)){h.target=null;h.griffinStrikeBN=null;h.setMoveIntent(0,0);return;}
 if(!(dt>0))return;
 h.moveSlowTimer=Math.max(0,(h.moveSlowTimer||0)-dt);h.attackSlowTimer=Math.max(0,(h.attackSlowTimer||0)-dt);h.attackCd=Math.max(0,(h.attackCd||0)-dt);
 h.slimeFlameStun407=Math.max(0,(h.slimeFlameStun407||0)-dt);
 if(h.robotFlameSlowUntilBN===-1)h.finishFlameStunBN(g.supportTime||0);
 // Native ground-net tracking is transient; restore the hold on a new graph.
 if(h.griffinNetLeftBN>0&&!groundNet.immune(g,h)){h.groundNetLockedBN=false;groundNet.lock(g,h,h.griffinNetLeftBN);}
 else if(h.groundNetLockedBN&&!groundNet.immune(g,h))h.groundNetLockedBN=false;
 h.griffinNetLeftBN=Math.max(0,(h.griffinNetLeftBN||0)-dt);
 if(h.groundNetLockedBN||h.griffinNetLeftBN>0){
  h.airborne=false;h.griffinAltitudeBN=Math.max(0,h.griffinAltitudeBN-dt*.29);h.setMoveIntent(0,0);return;
 }
 h.airborne=true;
 if(h.slimeFlameStun407>0||g.cardsCandidate?.consumeStormStun(h,dt)){h.griffinStrikeBN=null;h.setMoveIntent(0,0);return;}
 const ms=Math.min(50,dt);
 if(!h.griffinReachedLaneBN){
  h.griffinAltitudeBN=Math.min(HEIGHT,h.griffinAltitudeBN+ms*.16);
  if(routes.step(g,h,false,ms,(b,p)=>move(b,p,ms)))return;
  h.griffinReachedLaneBN=true;
 }
 const ghost=h.griffinStrikeBN?.ghostStoneBN;
 if(ghost){strikeTick(g,h,ghost,ms,()=>g.ghostStoneContactBN?.(h,63,true)===ghost);return;}
 const stoneContact=!h.griffinStrikeBN&&!h.griffinRecoverBN&&h.attackCd<=0&&g.ghostStoneContactBN?.(h,63,true);
 if(stoneContact){h.griffinStrikeBN={age:0,ghostStoneBN:stoneContact};h.setMoveIntent(0,0);face(h,stoneContact.x-h.x,stoneContact.y-h.y);return;}
 const now=g.supportTime||0,cache=targetRows(g,now);
 const old=h.target;
 if(!valid(g,cache,h,old)||h.griffinScanBN!==cache.last){
  const preferred=bestTarget(g,cache,h);
  h.target=valid(g,cache,h,old)&&preferred&&rank(old)===rank(preferred)?old:preferred;h.griffinScanBN=cache.last;
  if(old!==h.target)h.griffinStrikeBN=null;
 }
 if(h.griffinRecoverBN>0){
  h.griffinRecoverBN=Math.max(0,h.griffinRecoverBN-ms);
  h.griffinAltitudeBN=10+38*(1-h.griffinRecoverBN/RECOVER);
  h.setMoveIntent(0,0);return;
 }
 const b=h.target;
 if(!b){h.setMoveIntent(0,0);h.griffinAltitudeBN=Math.min(HEIGHT,h.griffinAltitudeBN+ms*.16);return;}
 const cast=h.griffinStrikeBN;
 const contact=(b.radius||0)+63;
 if(cast){strikeTick(g,h,b,ms,()=>valid(g,cache,h,b)&&g.buildings.includes(b));return;}
 h.griffinAltitudeBN=Math.min(HEIGHT,h.griffinAltitudeBN+ms*.16);
 const angle=h.griffinOrdinalBN*2.399963229728653,spread=(b.radius||0)+27+((h.griffinOrdinalBN%3)*7);
 if(!move(h,{x:b.x+Math.cos(angle)*spread,y:b.y+Math.sin(angle)*spread},ms))return;
 if(h.attackCd<=0&&d2(h,b)<=contact**2){
  h.griffinStrikeBN={age:0};h.setMoveIntent(0,0);face(h,b.x-h.x,b.y-h.y);
 }
}
function draw(g,c,h,art){
 const age=h.griffinStrikeBN?.age,left=h.griffinRecoverBN||0;
 let pose='fly',frame=Math.floor(((g.supportTime||0)+h.griffinOrdinalBN*69)/145)%4;
 if(!h.airborne){pose='aim';frame=0;}
 else if(Number.isFinite(age)){pose=age<AIM?'aim':'dive';frame=Math.min(2,Math.floor((age<AIM?age:age-AIM)/100));}
 else if(left>0){pose='return';frame=Math.min(2,Math.floor((RECOVER-left)/100));}
 return art?.drawUnit?.(c,h,pose,frame,h.griffinFacingBN<0?-1:1,h.griffinRearBN===true)===true;
}
module.exports={isWave,rosterCount,scope,spawn,sky,skyTower,canDamage,hold,update,draw,face,possessedStrike,possessedTick};
