'use strict';
const LIFE=60000,CD=180000,FORM=720,MAX_STEP=50;
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const num=(x,f=0)=>Number.isFinite(x)?x:f;
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const live=u=>!!u&&!u.dead&&Number.isFinite(u.hp)&&u.hp>0;
const stopped=(u)=>u.setMoveIntent?.(0,0);
const smallRay={radius:2};
const fade=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function rays(c,sx,sy,x,y,p){
 c.save();c.globalCompositeOperation='screen';const reach=fade(p/.33),join=fade((p-.24)/.67),alpha=fade(p/.12)*(1-fade((p-.83)/.17));
 for(let i=0;i<17;i++){
  const d=(i-8)*7,ex=sx+(x-sx)*reach,ey=sy+(y-sy)*reach+d*(1-join)*reach;
  c.beginPath();c.moveTo(sx,sy);c.bezierCurveTo(sx+(ex-sx)*.24,sy+d*.64,sx+(ex-sx)*.72,ey+d*.25,ex,ey);
  c.lineCap='round';c.strokeStyle=i%4?'rgba(201,147,255,'+(alpha*.69)+')':'rgba(210,252,250,'+(alpha*.82)+')';c.lineWidth=i%4?1.8:2.9;c.stroke();
 }
 c.beginPath();c.arc(sx,sy,3+6*alpha,0,Math.PI*2);c.fillStyle='rgba(191,255,244,'+(alpha*.82)+')';c.fill();c.restore();
}
module.exports=function install(g,{Entity,Projectile,MiniTroll,win=globalThis,offline=()=>false,width,height,canvas=()=>null,Image,loadPackage,ranged,attackFacing,readCastArt,sidePoseRatio=1.3}={}){
 if(g.ghostCopyBN)return g.ghostCopyBN;
 const scope=()=>offline()===true&&!g.networkAuthorityPhases627&&!g.networkDrawCamera627&&win.networkDefenseModeBN?.()!==true&&!g.superChallenge580&&!g.tutorial;
 let body=null,record=null,castBot=null,castArt=null,artPending=false,retryArtAt=0,run=g.player,now=0,queue=[],bound=new WeakMap(),visFrame=-1,failure=null;
 const poison=(enemy,key)=>{if(enemy[key])enemy[key]=null;};
 const possessed=e=>e?.ghostPossessedBN===true||g.ghostElfAPI?.host===e;
 function syncRun(){
  if(run===g.player&&record===(g.ghostCopySaveBN||null))return;
  const next=g.ghostCopySaveBN||null;drop();run=g.player;now=0;record=next;targetSaved=null;nextSearch=0;
  if(scope()&&g.player?.ghostElf&&validRecord(next)){g.ghostCopySaveBN=next;body=makeBody(next);}
  else{record=null;g.ghostCopySaveBN=null;}
 }
 function validRecord(r){return r&&r.v===1&&['x','y','maxHp','hp','life','form','radius','damage','armor','speed','reach','attackCd','interval','originX','originY','taunt'].every(k=>Number.isFinite(r[k]))&&r.hp>0&&r.hp<=r.maxHp&&r.life>0&&r.life<=LIFE&&r.form>=0&&r.form<=FORM&&r.radius>0&&r.radius<=256&&r.reach>0&&r.reach<=1400&&r.taunt>0&&r.taunt<=1400&&r.interval>0&&r.x>=r.radius&&r.y>=r.radius&&r.x<=width-r.radius&&r.y<=height-r.radius;}
 function makeBody(r){
  const b=new Entity(r.x,r.y,r.radius);
  Object.assign(b,{isGhostCopyBN:true,hp:r.hp,maxHp:r.maxHp,radius:r.radius,facing:r.facing||1,facingV:r.facingV||1,evolved:r.stage>0,dragonEvolved:r.stage===2,breathRange:r.breathRange,attackRange:r.reach,attackCd:r.attackCd,slot:null,ownerSlot:null});
  const terrain=g.terrainCollisionAt?.(r.x,r.y,r.radius);
  b.copyTerrainEscapeBN=!!terrain&&terrain.kind!=='guardTree';
  Object.defineProperty(b,'attackReachFor',{value(t){return (t?.radius||0)+(b.dragonEvolved&&b.breathRange>0?b.breathRange:r.reach);}});
  Object.defineProperty(b,'takeDamage',{value(amount){
   if(!live(b)||!Number.isFinite(amount)||amount<=0)return 0;
   const old=b.hp;b.hp=Math.max(0,old-Math.max(1,Math.round(amount*100/(100+Math.max(0,r.armor)))));
   r.hp=b.hp;if(!b.hp){b.dead=true;drop();}return old-b.hp;
  }});
  return b;
 }
 function drop(){
  if(body){body.dead=true;g.clearUnitNavigation?.(body);tintCache.clear();}
  // Enemy links and in-flight clone-only shots never enter the serialized world.
  body=null;record=null;castBot=null;failure=null;if(g.ghostCopySaveBN)g.ghostCopySaveBN=null;
  for(const q of queue)q.dead=true;queue.length=0;
 }
 const hint=(text,short)=>{
  if(short)failure={bot:g.player?.drivingTank,text:short,until:now+1800};
  g.showToast?.(text);return false;
 };
 const control=bot=>scope()&&g.state==='hunt'&&g.player?.ghostElf===true&&!g.player.dead&&live(bot)&&bot.isRobot===true&&bot.ghostMechBN===true&&g.player.drivingTank===bot&&bot.driver===g.player;
 function sourceCheck(bot){
  const enemy=g.troll;if(!live(enemy)||possessed(enemy))return '场上没有可复制的恶魔';
  const range=bot.basicLaserRange?.(g),edge=near(bot,enemy)-Math.max(0,enemy.radius||0);
  if(!(range>0)||edge>range)return '恶魔超出激光射程，靠近后再试';
  return '';
 }
 const aimOk=()=>g.ghostRobotAimUIBN?.()!==false;
 function canBegin(bot){return control(bot)&&aimOk()&&bot.superUnlocked?.(g)===true&&!(bot.ghostCopyCdBN>0)&&!active()&&!(body&&live(body))&&!sourceCheck(bot);}
 function begin(bot){
  syncRun();
  if(!control(bot)||!aimOk())return false;
  if(bot.superUnlocked?.(g)!==true)return hint('激光和小机器人均升满后解锁复制恶魔');
  if(bot.ghostCopyCdBN>0)return hint('复制恶魔尚在冷却');
  if(body&&live(body))return hint('已有恶魔复制体在场');
  const bad=sourceCheck(bot);if(bad)return hint(bad,live(g.troll)&&!possessed(g.troll)?'恶魔超出射程':'没有可复制目标');
  const d=g.troll,r=d.radius,angle=bot.forwardAngle?.();
  if(!Number.isFinite(angle))return hint('请调整机甲朝向后重试复制','请调整朝向');
  // One short world-space step in the logic-facing direction, with a local spawn footprint guard.
  const p=frontSpot(bot,r,angle);
  return p?spawn(bot,d,p.x,p.y,r):hint('正前方被树林、建筑或地图边缘挡住，调整朝向后重试','正前方落点受阻');
 }
 function forestAt(p,r,trees=g.trees||[]){
  const hit=t=>!t.dead&&(t.x-p.x)**2+(t.y-p.y)**2<(r+num(t.radius,24))**2;
  return !!win.referenceTerrain?.hit(g.referenceTerrainZones,p.x,p.y,r)||g.nearbyGuardTrees?.(p.x,p.y,r).some(hit)||trees.some(hit);
 }
 function frontSpot(bot,r,angle){
  const D=r+bot.radius+12,at=(length,bend=0)=>({x:bot.x+Math.cos(angle+bend)*length,y:bot.y+Math.sin(angle+bend)*length});
  const touches=(o,p,gap=0)=>!o.dead&&(o.x-p.x)**2+(o.y-p.y)**2<(r+Math.max(o.type==='wall'?45.9:1,num(o.radius,24))+gap)**2;
  const localTrees=(g.trees||[]).filter(t=>!t.dead&&near(bot,t)<D+24+r+num(t.radius,24));
  const clear=p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=r&&p.y>=r&&p.x<=width-r&&p.y<=height-r
   &&!forestAt(p,r,localTrees)
   &&!(g.buildings||[]).some(o=>touches(o,p))&&!(g.trollBase&&touches(g.trollBase,p));
  const actors=[g.tanks,g.allies,g.peasants,g.hounds,g.miniTrolls,[g.player,g.troll]];
  let spare=null;
  const choose=p=>{
   if(!clear(p))return null;
   spare??=p;
   return actors.some(list=>list?.some(o=>live(o)&&touches(o,p,3)))?null:p;
  };
  let chosen=choose(at(D));if(chosen)return chosen;
  for(const step of [-8,8,16,24]){chosen=choose(at(D+step));if(chosen)return chosen;}
  for(const bend of [Math.PI/12,-Math.PI/12,7*Math.PI/45,-7*Math.PI/45]){
   for(const step of [-8,0,12,24]){chosen=choose(at(D+step,bend));if(chosen)return chosen;}
  }
  return spare;
 }
 function spawn(bot,d,x,y,r){
  const stock=d.getGhostCopyStatsBN?.()||{maxHp:d.maxHp,hp:d.hp,damage:d.getDamage?.(),armor:num(d.effectiveArmor?.(),num(d.totalArmor?.()))};
  const v={v:1,x,y,maxHp:stock.maxHp,hp:stock.hp,life:LIFE,form:FORM,radius:r,damage:num(stock.damage),armor:num(stock.armor),
   speed:num(d.getGhostCopySpeedBN?.()??d.getChaseSpeed?.(),num(d.getMoveSpeed?.(),num(d.speed))),reach:num(d.attackRange,40),interval:num(d.getAttackCd?.(),750),attackCd:0,taunt:bot.basicLaserRange(g),
   stage:d.dragonEvolved?2:d.evolved?1:0,breathRange:num(d.breathRange),originX:bot.x,originY:bot.y-36,facing:d.facing||1,facingV:d.facingV||1};
  if(!validRecord(v))return hint('恶魔状态已变，请重新选择');
  failure=null;body=makeBody(v);castBot=bot;record=g.ghostCopySaveBN=v;bot.ghostCopyCdBN=CD;g.showToast?.('复制恶魔正在成形');return true;
 }
 // form is the remaining 720 ms formation phase, independent of stage (0, 1, or 2).
 function active(){return live(body)&&record?.form===0&&record.life>0&&scope()?body:null;}
 function forced(enemy){
  const c=active();
  if(!c||!live(enemy)||enemy===c||possessed(enemy)||enemy===g.troll&&enemy.retreating)return null;
  if(bound.get(enemy)?.unit===c)return c;
  // Once affected, bind to this copy until it dies or expires. Others retain native logic.
  return near(enemy,c)<=record.taunt+(enemy.radius||0)?c:null;
 }
 function groundLine(e,c){
  if(e.airborne===true||e.dragonEvolved===true)return true;
  const d=near(e,c),edge=Math.max(0,d-(c.radius||0)),end=edge<=0?e:{x:e.x+(c.x-e.x)*edge/d,y:e.y+(c.y-e.y)*edge/d};
  return !g.demonLineBlocked?.(e,end,1,true)&&!g.slimeBlockingBuilding410?.(smallRay,e,end);
 }
 const bypasses=new WeakMap(),TURN=Math.PI/12;
 let bypassBudget=2;
 function bypass(e,c,blocker,step,row){
  // Keep the bypass entirely local. The boss wall helper requires Troll-only movement
  // and writes global demon state, and is never safe for an ordinary enemy or the copy.
  if(row?.blocker===blocker&&row.goal===c&&now<row.next)return row.point;
  if(bypassBudget<=0)return null;
  bypassBudget--;
  const angle=Math.atan2(e.y-blocker.y,e.x-blocker.x),radius=Math.max(num(blocker.radius),blocker.type==='wall'?45.9:0)+e.radius+Math.max(5,step*2);
  const targetAngle=Math.atan2(c.y-blocker.y,c.x-blocker.x);
  const orient=Math.sin(targetAngle-angle)>=0?1:-1;
  let point=null,sign=row?.blocker===blocker&&row.goal===c&&row.sign||orient;
  // Step around the live blocker using short tangent waypoints; the other side is
  // tried if the preferred side is itself blocked. Never tunnel or teleport.
  for(const turn of [sign,-sign]){
   for(let i=3;i>=1;i--){
    const a=angle+TURN*i*turn,x=blocker.x+Math.cos(a)*radius,y=blocker.y+Math.sin(a)*radius;
    if(x<e.radius||y<e.radius||x>width-e.radius||y>height-e.radius)continue;
    const candidate={x,y};if(g.demonLineBlocked?.(e,candidate,e.radius,true)||g.slimeBlockingBuilding410?.(e,e,candidate))continue;
    point=candidate;sign=turn;break;
   }
   if(point)break;
  }
  bypasses.set(e,{goal:c,blocker,point,sign,next:now+(point?700:210+(Math.floor(e.x+e.y)&63))});
  return point;
 }
 function pursue(e,c,step){
  const d=near(e,c);if(!(d>.1)||!(step>0)){stopped(e);return;}
  if(e.airborne===true){const k=Math.min(step,d)/d,dx=(c.x-e.x)*k,dy=(c.y-e.y)*k;e.setMoveIntent?.(dx,dy);e.x+=dx;e.y+=dy;return;}
  let row=bypasses.get(e);
  if(row&&(row.goal!==c||!live(row.blocker))){bypasses.delete(e);row=null;}
  let p=row?.point;
  if(!p||near(e,p)<2||now>=row.next){
   // Once the direct path clears, abandon the detour; otherwise progress around the
   // current wall before requesting another shared terrain path.
   if(row&&g.slimeBlockingBuilding410?.(e,e,c)===row.blocker){
    if(row.point)row.next=0;
    p=bypass(e,c,row.blocker,step,row);
    if(!p){stopped(e);return;}
   }else{
    if(row)bypasses.delete(e);row=null;
    // A temporary taunt is a local encounter; do not send an unobstructed actor
    // to a distant fixed wave lane (shared-fixed can report its own position).
    if(!g.demonLineBlocked?.(e,c,e.radius,true))p=c;
    else{
     p=g.demonRouteWaypoint?.(e,c,c)||c;
     const m=g.navMotionCaches?.get(e)?.mode;
     if(m==='pending'||m==='failed'){stopped(e);return;}
    }
   }
  }
  let len=near(e,p);if(!(len>.1)){stopped(e);return;}
  let k=Math.min(step,len)/len,dx=(p.x-e.x)*k,dy=(p.y-e.y)*k;
  const probe={x:e.x+dx,y:e.y+dy},blocker=g.slimeBlockingBuilding410?.(e,e,probe);
  if(blocker){
   if(row?.point===p)row.next=0;
   p=bypass(e,c,blocker,step,row);if(!p){stopped(e);return;}
   len=near(e,p);if(!(len>.1)){stopped(e);return;}
   k=Math.min(step,len)/len;dx=(p.x-e.x)*k;dy=(p.y-e.y)*k;
   probe.x=e.x+dx;probe.y=e.y+dy;
   if(g.slimeBlockingBuilding410?.(e,e,probe)){stopped(e);return;}
  }
  const ox=e.x,oy=e.y;
  // Native terrain stepping without its role-specific attack/target side effects. The
  // terrain solver can slide, so recheck the swept segment if it chose a different step.
  g.moveEntityTerrainStep?.(e,dx,dy);
  if((e.x!==probe.x||e.y!==probe.y)&&(e.x!==ox||e.y!==oy)&&g.slimeBlockingBuilding410?.(e,{x:ox,y:oy},e)){e.x=ox;e.y=oy;}
  e.setMoveIntent?.(e.x-ox,e.y-oy);
 }
 function freshBinding(e,c){
  let old=bound.get(e);if(old?.unit===c)return old;
  if(old)release(e,old);
  const q={unit:c,ranged:null,wind:0};
  bound.set(e,q);
  // Cancel only windups not yet committed. Already-fired native shots are untouched.
  for(const key of ['target','rangedTrollCastBN','mammothAttackBN','mammothCastBN','griffinStrikeBN','slimeCombatTarget539'])poison(e,key);
  if(e.waveBat){e.batAttackSlotBN=undefined;e.batStateBN=Object.values(e.batCargoBN||{}).some(v=>v.gold>0||v.wood>0)?'return':'seek';}
  g.clearUnitNavigation?.(e);return q;
 }
 function release(e,row){
  bound.delete(e);bypasses.delete(e);if(e.ghostForcedTargetBN===row.unit){
   delete e.ghostForcedTargetBN;
   if(e.batGhostStrikingBN)delete e.batGhostStrikingBN;
   if(e.griffinStrikeBN)e.griffinStrikeBN=null;
   if(e.rangedTrollCastBN?.target===row.unit)e.rangedTrollCastBN=null;
   g.clearUnitNavigation?.(e);
  }
 }
 function timers(e,dt){
  for(const k of ['attackCd','moveSlowTimer','attackSlowTimer','armorShredTimer','robotSuperSlowTimer','robotStunImmunity','siegeStunFlash413','survivalPurchaseCd','lateUpgradeCd','shoppingCooldown','shopCheckCd','batRootBN','batNetImmuneBN','batNetVisualBN','slimeFlameStun407','robotStun','griffinNetLeftBN','griffinRecoverBN'])if(e[k]>0)e[k]=Math.max(0,e[k]-dt);
  if(e.waveBat){e.batTimeBN=num(e.batTimeBN)+dt;e.batGroundedBN=e.batRootBN>0;e.airborne=!e.batGroundedBN;}
 }
 function rangedIn(e,c,q,dt,interval){
  // Temporarily use the native windup and actual native seed; never serialize an actor pointer.
  const normal=e.rangedTrollCastBN;e.rangedTrollCastBN=q.ranged;
  try{
   const oldLength=g.projectiles.length;
   if(q.ranged){ranged.tickCast(g,e,dt,Projectile,win.rangedTrollArtBN);if(g.projectiles.length>oldLength)queue.push(...g.projectiles.splice(oldLength));}
   else if(e.attackCd<=0)ranged.start(g,e,c,interval);
   q.ranged=e.rangedTrollCastBN;
  }finally{e.rangedTrollCastBN=normal??null;}
 }
 function enemyTick(e,dt){
  const c=forced(e);
  if(!c||e===g.troll&&e.state!=='frozen'&&e.shouldRetreat(g.trollBase)){const q=bound.get(e);if(q)release(e,q);return false;}
  const q=freshBinding(e,c);
  if(!Object.hasOwn(e,'ghostForcedTargetBN'))Object.defineProperty(e,'ghostForcedTargetBN',{value:c,writable:true,configurable:true});
  else e.ghostForcedTargetBN=c;
  const wasStunned=e.robotStun>0||e.slimeFlameStun407>0;
  timers(e,dt);
  // Ground-lane retirement is preserved. A living unit can respond locally to
  // the existing taunt while waiting, without restarting an extinguished lane.
  const dwell=e.state!=='frozen'&&g.groundWaveDwellBN?.(e);
  if(!live(e)||e.state==='frozen'||(dwell&&near(e,c)>record.taunt+(e.radius||0))||wasStunned||g.cardsCandidate?.consumeStormStun?.(e,dt)||e.batGroundedBN||e.groundNetLockedBN){q.ranged=null;q.wind=0;q.mammoth=null;stopped(e);return true;}
  if(q.mammoth&&(q.mammoth.age+=dt)>=840)q.mammoth=null;
  const boss=e===g.troll,isWave=e.waveHound===true,isMini=e instanceof miniType;
  const factor=e.attackSlowTimer>0?(e.attackSlowFactor||1):1;
  const interval=boss?num(e.getAttackCd?.(),750):e.waveBat?1500*factor:!isWave&&isMini?800*factor:num(e.slimeAttackInterval567?.(),850)*factor;
  const reach=e.waveBat?c.radius+55:e.waveGriffinBN?c.radius+63:e.dragonEvolved?c.radius+num(e.breathRange,350):num(e.attackReachFor?.(c),c.radius+num(e.attackRange,24));
  if(q.ranged){rangedIn(e,c,q,dt,interval);return true;}
  if(boss&&e.robotStun>0){stopped(e);return true;}
  if(q.wind===0&&e.batGhostStrikingBN)e.batGhostStrikingBN=false;
  if(near(e,c)>reach||!groundLine(e,c)||e.waveRangedTrollBN&&!ranged.position(g,e,c)){
   q.wind=0;q.mammoth=null;
   const speed=boss?num(e.getChaseSpeed?.(),num(e.speed)):e.waveBat||e.waveGriffinBN?71.5*dt/1000*(e.movementSlowMultiplier?.()??1):num(e.speed)*(e.movementSlowMultiplier?.()??1);
   const x=e.x,y=e.y;
   pursue(e,c,speed);if(e.waveMammothBN)g.mammothCandidate?.possessedWalk?.(e,x,y,dt);return true;
  }
  stopped(e);if(e.waveMammothBN)e.mammothMovingBN=false;
  if(e.waveRangedTrollBN){rangedIn(e,c,q,dt,interval);return true;}
  if(e.attackCd>0&&q.wind<=0)return true;
  if(e.waveMammothBN||e.waveGriffinBN||e.waveBat){
   if(e.waveMammothBN&&!q.wind){
    const dx=c.x-e.x,dy=c.y-e.y;if(Math.abs(dx)>Math.max(7,Math.abs(dy)*.28)){e.mammothFaceBN=dx<0?-1:1;e.mammothHeadingXBN=undefined;}
    q.mammoth={age:0};
   }
   q.wind+=Math.min(MAX_STEP,dt);
   if(e.waveGriffinBN){e.griffinStrikeBN={age:q.wind};e.griffinAltitudeBN=49-39*clamp((q.wind-300)/300,0,1);}
   if(e.waveBat){e.batAttackStartBN=e.batTimeBN-q.wind;if(!Object.hasOwn(e,'batGhostStrikingBN'))Object.defineProperty(e,'batGhostStrikingBN',{value:true,writable:true,configurable:true});else e.batGhostStrikingBN=true;}
   if(q.wind<(e.waveGriffinBN?600:e.waveBat?330:480))return true;
   q.wind=0;if(e.waveGriffinBN){e.griffinStrikeBN=null;e.griffinRecoverBN=300;}
  }
  e.attackCd=interval;
  if(boss){e.playAttack?.(c);e.applyAttackDamage?.(c,[],[],[],false);}
  else{e.playAction?.('bite',isMini?240:420);c.takeDamage(e.waveBat?num(e.batStatsBN?.damage):num(e.getDamage?.()),e);}
  return true;
 }
 const miniType=MiniTroll||class {};
 let nextSearch=0,targetSaved=null;
 function cloneTarget(){
  if(live(g.troll)&&!possessed(g.troll))return g.troll;
  if(now<nextSearch&&targetSaved!==g.trollBase&&live(targetSaved)&&!possessed(targetSaved))return targetSaved;
  nextSearch=now+175;let t=null,best=Infinity;
  for(const list of [g.hounds,g.miniTrolls])for(const u of list||[]){if(!live(u)||u===g.trollBase||u.airborne===true||possessed(u))continue;const d=near(body,u);if(d<best){best=d;t=u;}}
  return targetSaved=t;
 }
 function cloneAttack(dt){
  const r=record,c=body;const enemy=cloneTarget();c.attackCd=Math.max(0,c.attackCd-dt);
  c.animTrack?.(dt);
  if(!enemy){stopped(c);return;}
  // A water/rock birth can start inside native terrain. Reach the bank via the
  // normal overlap resolver before asking the route finder for a land path.
  if(c.copyTerrainEscapeBN){
   if(g.terrainCollisionAt?.(c.x,c.y,c.radius)){
    const x=c.x,y=c.y;g.moveEntityTerrainStep?.(c,r.speed,0);
    if(forestAt(c,c.radius)||g.slimeBlockingBuilding410?.(c,{x,y},c)){c.x=x;c.y=y;}
    c.setMoveIntent?.(c.x-x,c.y-y);return;
   }
   c.copyTerrainEscapeBN=false;
  }
  const reach=enemy.radius+(c.dragonEvolved&&c.breathRange>0?c.breathRange:r.reach);
  const distance=near(c,enemy);
  if(distance>reach||(c.dragonEvolved&&distance>=reach)||!groundLine(c,enemy)){pursue(c,enemy,r.speed);return;}
  stopped(c);
  if(c.attackCd>0)return;
  const dx=enemy.x-c.x,dy=enemy.y-c.y;if(c.dragonEvolved&&attackFacing.latchAttackFacing(c,enemy,sidePoseRatio))c.facingV=c.attackFacingV;else{c.attackSideways=dy<0||Math.abs(dx)>Math.abs(dy)*.65;c.attackFacingV=dy<0?-1:1;c.attackFacing=dx<0?-1:1;c.facing=c.attackFacing;c.facingV=c.attackFacingV;}
  if(!c.dragonEvolved||c.actionKind!=='attack'||c.actionAnim<=0)c.playAction?.('attack',c.dragonEvolved?1050:Math.min(r.stage===1?480:425,r.interval),false);
  c.attackCd=r.interval;let damage=r.damage;
  if(c.dragonEvolved){const v=g.troll?.dragonBreathFactor?.call(c,enemy,enemy)??1;damage*=v;c.breathTarget={x:enemy.x,y:enemy.y};}
  // Preserve the real enemy's native damage/defeat path, without assigning new owner rewards.
  enemy.takeDamage?.(damage,c);
 }
 function tick(dt){
  syncRun();
  if(!scope()||!g.player?.ghostElf){if(body)drop();return;}
  if(!Number.isFinite(dt)||dt<=0)return;now+=dt;bypassBudget=2;const bot=g.player?.drivingTank;if(bot?.ghostMechBN&&bot.superUnlocked?.(g))warmCastArt();
  for(const v of g.tanks||[])if(v.ghostCopyCdBN>0)v.ghostCopyCdBN=Math.max(0,v.ghostCopyCdBN-dt);
  if(!body||!record)return;
  if(record.form>0){if(live(castBot)){record.originX=castBot.x;record.originY=castBot.y-36;}const elapsed=record.form;record.form=Math.max(0,elapsed-dt);dt=Math.max(0,dt-elapsed);if(record.form>0)return;}
  record.life=Math.max(0,record.life-dt);if(record.life<=0||!live(body)){drop();return;}
  for(let i=queue.length-1;i>=0;i--){const q=queue[i];q.update?.(dt);if(q.dead)queue.splice(i,1);}
  if(body&&dt>0){cloneAttack(dt);Object.assign(record,{x:body.x,y:body.y,facing:body.facing,facingV:body.facingV,attackCd:body.attackCd,hp:body.hp});}
 }
 function warmCastArt(){
  if(readCastArt){castArt=readCastArt();return;}
  if(castArt||artPending||!Image||!loadPackage||now<retryArtAt||win.__wxRuntime?.memoryConstrained?.())return;
  artPending=true;
  const done=()=>{artPending=false;retryArtAt=now+5500;};
  Promise.resolve().then(loadPackage).then(()=>{const im=new Image();im.onload=()=>{if(im.width===258&&im.height===91)castArt=im;done();win.__wxRuntime?.wake?.();};im.onerror=done;im.src='factory-model-art/ghost-copy-double-arm.webp.bin';}).catch(done);
 }
 function drawCaster(c,bot){
  if(!castArt||!record?.form||castBot!==bot||!live(bot)||!scope())return false;
  const u=1-record.form/FORM,pose=u<.20||u>.86?0:u<.34||u>.76?1:2,k=1.45;
  const anchor=[48.27,48.20,51.34][pose];
  c.drawImage(castArt,pose*86,0,86,91,bot.x-43*k,bot.y-36-anchor*k,86*k,91*k);
  return true;
 }

 const tintCache=new Map();let tintDragonAtlasMask=-1;
 function paintPurple(c,b,stage=record.stage){
  const art=win.woodlandArt;if(!art?.character)return;
  if(stage===2){const mask=art.dragonAtlasMaskBN?.()??0;if(mask!==tintDragonAtlasMask){tintDragonAtlasMask=mask;tintCache.clear();}}
  const action=b.actionAnim>0?Math.min(5,Math.floor((1-b.actionAnim/(b.actionDuration||425))*6)):-1;
  const facing=attackFacing.attackDirection(b,b.sideways?b.facing<0?1:2:b.facingV<0?3:0);
  const key=stage+':'+facing+':'+action+':'+(b.moving?1+Math.floor((b.walkDist||0)/16)%3:0);
  // Native evolved bodies sit well above the collision anchor. Keep their full ears/wings
  // while using fewer cached pixels than the old symmetric 400-square Dragon canvas.
  const w=stage===2?340:stage===1?270:220,h=stage===2?340:stage===1?310:220,anchor=stage===2?254:stage===1?224:110;
  let artFrame=tintCache.get(key);
  if(!artFrame){
   const src=canvas(w,h);
   if(!src){c.save();c.globalAlpha=.8;art.character(c,stage===2?{...b,breathTarget:null}:b,2,1);c.restore();return;}
   const cx=src.getContext('2d'),off={...b,x:w/2,y:anchor};delete off.breathTarget;
   if(!art.character(cx,off,2,1))return;
   const img=cx.getImageData(0,0,w,h),d=img.data;
   for(let i=0;i<d.length;i+=4){if(!d[i+3])continue;const l=.3*d[i]+.55*d[i+1]+.15*d[i+2];if(l<16)continue;d[i]=14+l*.82;d[i+1]=8+l*.45;d[i+2]=27+l*.96;}
   cx.putImageData(img,0,0);artFrame=src;tintCache.set(key,src);if(tintCache.size>7)tintCache.delete(tintCache.keys().next().value);
  }
  c.drawImage(artFrame,b.x-w/2,b.y-anchor);
 }
 function draw(c,inView=()=>true){
  if(!scope()||!live(body)||!record)return;
  const r=record,b=body;
  if(r.form>0&&(inView(b.x,b.y,150)||inView(r.originX,r.originY,100))){rays(c,r.originX,r.originY,b.x,b.y-36,1-r.form/FORM);}
  if(!inView(b.x,b.y,r.stage===2?272:r.stage===1?224:180))return;
  c.save();if(r.form>0)c.globalAlpha=fade((1-r.form/FORM-.52)/.48);paintPurple(c,b);c.restore();
  if(r.form>0)return;
  win.woodlandArt?.copyDragonFlame?.(c,b);
  const w=74,x=b.x-w/2,y=b.y-(r.stage===2?251:r.stage===1?186:111);
  c.save();c.fillStyle='#312143';c.fillRect(x,y,w,5);c.fillStyle='#ca88f2';c.fillRect(x,y,w*r.life/LIFE,5);
  c.fillStyle='#25352a';c.fillRect(x,y+10,w,7);c.fillStyle='#75c35d';c.fillRect(x,y+10,w*b.hp/b.maxHp,7);c.restore();
  for(const q of queue)if(inView(q.x,q.y,45))q.draw?.(c);
 }
 function reset(){drop();run=g.player;now=0;bound=new WeakMap();tintCache.clear();targetSaved=null;nextSearch=0;}

 // Keep a cast rejection beside its own dock icon without replacing
 // the existing wall/battle warning or changing the button hit area.
 const drawHud=g.drawHUD;
 if(drawHud)g.drawHUD=function(...args){
  const out=drawHud.apply(this,args);
  if(!failure)return out;
  if(now>=failure.until||!control(failure.bot)){failure=null;return out;}
  if(!aimOk()||g.robotGuideBN?.playing())return out;
  const b=g.buttons?.find(b=>b.id==='ghostCopy'&&b.visible);
  if(!b)return out;
  const c=g.ctx,y=b.y+(b.diameter512||b.w)/2;
  c.save();c.font='bold 11px sans-serif';c.textAlign='center';c.textBaseline='middle';
  const w=c.measureText(failure.text).width+12,x=b.x-7-w/2;
  c.fillStyle='rgba(61,29,23,.94)';c.fillRect(x-w/2,y-8,w,16);
  c.fillStyle='#ffe6ae';c.fillText(failure.text,x,y);c.restore();
  return out;
 };
 g.ghostCopyBN={castArt:()=>castArt,warm:warmCastArt,begin,canBegin,cancel:()=>false,busy:r=>castBot===r&&record?.form>0,pending:()=>false,drawCaster,draw,tick,enemyTick,forced,active,mammothAttack:e=>{const q=bound.get(e);return q&&q.unit===active()?q.mammoth:null;},reset,read:()=>record,rasterCount:()=>tintCache.size};
 return g.ghostCopyBN;
};
