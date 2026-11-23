'use strict';
const STEP=1000/60,MAX_AGE=250;
const clamp=t=>Math.max(0,Math.min(1,t));
const linear=(track,now)=>track.from+(track.to-track.from)*clamp((now-track.at)/track.duration);
// Only trusted, audited PURE VISUAL original methods may run on detached work:
// Particle.update, TankShell.update, RobotLaser.update. Never Projectile.update
// or RobotSiegeLaser.update: both can execute hits/skills/gameplay side effects.
class RenderEffectClock{
 constructor(types={}){this.types=types;this.kinds=new Map();for(const name of['Particle','TankShell','RobotSiegeLaser','RobotLaser','Projectile','Tank','Robot'])if(types[name]?.prototype)this.kinds.set(types[name].prototype,name);this.frames=[];this.depth=0;this.reset();}
 reset(){this.scope=null;this.records=new WeakMap();this.live=[];this.zones=[];this.stamp=null;this.lastDraw=null;this.returnTrack=null;this.projectileList=[];this.particleList=[];this.zoneList=[];this.hidden=new Set();}
 kind(e){const name=this.kinds.get(Object.getPrototypeOf(e));if(name==='Particle'||name==='TankShell'||name==='RobotSiegeLaser'||name==='RobotLaser')return name;if(name==='Projectile'&&e.kind==='cannon')return'Cannon';if((name==='Tank'||name==='Robot')&&Number.isFinite(e.activityAngle584))return'Vehicle';return null;}
 commit(view,now,duration=100){
  if(!view||!Number.isFinite(view.presentationTimeMs)||!Number.isFinite(now))return;
  const scope=JSON.stringify([view.roomId??null,view.viewerOwnerId,view.epoch]);if(scope!==this.scope){this.reset();this.scope=scope;}
  this.stamp=view.presentationTimeMs;this.live.length=0;
  for(const collection of[view.worldView?.particles||[],view.worldView?.projectiles||[],view.worldView?.tanks||[]])for(const e of collection){
   const kind=this.kind(e);if(!kind)continue;let r=this.records.get(e);if(!r||r.kind!==kind){r={e,kind,work:{trail:[]},angle:e.activityAngle584};this.records.set(e,r);}
   r.baseAt=now;
   r.base={x:e.x,y:e.y,tx:e.tx,ty:e.ty,vx:e.vx,vy:e.vy,speed:e.speed,life:e.life,charge:e.charge,dead:!!e.dead};
   r.trail=Array.isArray(e.trail)?e.trail.slice(0,16):[];r.steps=0;Object.assign(r.work,r.base);r.work.trail.length=0;for(const p of r.trail)r.work.trail.push(p);
   if(kind==='Particle'){const next=r.next||(r.next={});Object.assign(next,r.base);this.types.Particle.prototype.update.call(next);r.particleDelta={x:next.x-e.x,y:next.y-e.y,life:next.life-e.life};}
   if(kind==='Cannon'){
    const from=r.travel?linear(r.travel,now):e.cannonTravelled;r.travel={from,to:e.cannonTravelled,at:now,duration:Math.max(1,duration)};
    const prior=r.trailTracks||[];r.trailTracks=r.trail.map((p,i)=>({fromX:prior[i]?linear(prior[i].x,now):p.x,fromY:prior[i]?linear(prior[i].y,now):p.y,toX:p.x,toY:p.y,x:null,y:null}));
    for(const p of r.trailTracks){p.x={from:p.fromX,to:p.toX,at:now,duration:Math.max(1,duration)};p.y={from:p.fromY,to:p.toY,at:now,duration:Math.max(1,duration)};}
   }
   this.live.push(r);
  }
  this.zones=(view.worldView?.cannonFireZones||[]).map(z=>({z,base:{life:z.life,burstAge:z.burstAge||0,paintAge:z.paintAge||0,visualRadius:z.visualRadius??z.radius,visualFade:z.visualFade??0,radius:z.radius},work:{}}));
 }
 begin(game,view,now,renderTime){
  const depth=this.depth++,restore=this.frames[depth]||(this.frames[depth]=[]);restore.length=0;
  if(depth||this.stamp===null||!Number.isFinite(now)||!Number.isFinite(renderTime)||!['hunt','prep'].includes(game.state)||JSON.stringify([view.roomId??null,view.viewerOwnerId,view.epoch])!==this.scope)return restore;
  try{
  const age=Math.min(MAX_AGE,Math.max(0,renderTime-this.stamp)),steps=Math.floor((age+1e-7)/STEP),fraction=Math.max(0,age/STEP-steps),dt=this.lastDraw===null?0:Math.min(MAX_AGE,Math.max(0,now-this.lastDraw));this.lastDraw=now;this.hidden.clear();
  const set=(e,k,v)=>{if(e[k]===v)return;restore.push(e,k,Object.hasOwn(e,k),e[k]);e[k]=v;};
  for(const r of this.live){
   const e=r.e,w=r.work,base=r.base;
   if(r.kind==='Particle'){
    const ticks=age/STEP,d=r.particleDelta,life=base.life+d.life*ticks;set(e,'x',base.x+d.x*ticks);set(e,'y',base.y+d.y*ticks);set(e,'life',Math.max(0,life));if(life<=0)this.hidden.add(e);
   }else if(r.kind==='TankShell'){
    if(steps<r.steps){Object.assign(w,base);w.trail.length=0;for(const p of r.trail)w.trail.push(p);r.steps=0;}
    while(r.steps<steps&&!w.dead){this.types.TankShell.prototype.update.call(w);r.steps++;}
    let x=w.x,y=w.y;
    if(fraction&&!w.dead){const next=r.next||(r.next={trail:[]}),trail=next.trail;Object.assign(next,w);next.trail=trail;trail.length=0;for(const p of w.trail)trail.push(p);this.types.TankShell.prototype.update.call(next);x+=(next.x-x)*fraction;y+=(next.y-y)*fraction;}
    set(e,'x',x);set(e,'y',y);set(e,'trail',w.trail);if(w.dead)this.hidden.add(e);
   }else if(r.kind==='RobotLaser'||r.kind==='RobotSiegeLaser'){
    if(r.kind==='RobotSiegeLaser'&&!e.fired){set(e,'charge',Math.max(0,base.charge-age/STEP));if(e.target&&!e.target.dead){set(e,'tx',e.target.x);set(e,'ty',e.target.y);}}
    // A monotonic shared scalar clock can be ahead of a newly committed short
    // beam after a stalled view. Do not consume time before this base existed
    // locally. This changes only detached visual life, never hits or cadence.
    else{const beamAge=Math.min(age,Math.max(0,now-r.baseAt)),life=base.life-beamAge/STEP;set(e,'life',Math.max(0,life));if(base.dead||life<=0)this.hidden.add(e);}
   }else if(r.kind==='Cannon'){
    const travel=linear(r.travel,now),p=clamp(travel/Math.max(1,e.cannonFlightDistance));if(Number.isFinite(travel)&&Number.isFinite(e.cannonArcHeight)){set(e,'cannonTravelled',travel);set(e,'renderY',e.y-4*p*(1-p)*e.cannonArcHeight);}
    const points=r.points||(r.points=[]);while(points.length<r.trailTracks.length)points.push({x:0,y:0});w.trail.length=0;for(let i=0;i<r.trailTracks.length;i++){const t=r.trailTracks[i],p=points[i];p.x=linear(t.x,now);p.y=linear(t.y,now);w.trail.push(p);}set(e,'trail',w.trail);
   }else if(r.kind==='Vehicle'){
    if(e.moving&&!e.dead&&!game.player?.dead&&e.driver===game.player)r.angle=((r.angle||0)+Math.min(dt,100)*.003)%(Math.PI*2);set(e,'activityAngle584',r.angle);
   }
  }
  for(const r of this.zones){const w=Object.assign(r.work,r.base);for(let i=0;i<steps+(fraction>1e-7?1:0);i++){const dt=i<steps?STEP:fraction*STEP;w.life-=dt;w.burstAge+=dt;w.paintAge+=dt;w.visualRadius+=(w.radius-w.visualRadius)*Math.min(1,dt/450);const f=clamp(w.life/900),target=f*f*(3-2*f);w.visualFade+=(target-w.visualFade)*Math.min(1,dt/(target>w.visualFade?520:760));}
   for(const k of['burstAge','paintAge','visualRadius','visualFade'])set(r.z,k,w[k]);if(w.life<=0)this.hidden.add(r.z);
  }
  const body=game.player?.drivingTank||game.player,task=game.player?.task;
  if(body&&!body.dead&&task?.type==='returnBase512'&&task.target&&!task.target.dead&&game.returnActivityTask586===task){
   let t=this.returnTrack;if(!t||t.body!==body||t.target!==task.target)t=this.returnTrack={body,target:task.target,time:game.returnActivityTime586||0};if(body.moving)t.time=(t.time+Math.min(dt,100))%125663.706;set(game,'returnActivityTime586',t.time);
  }else this.returnTrack=null;
  if(this.hidden.size)for(const[key,list]of[['projectiles',this.projectileList],['particles',this.particleList],['cannonFireZones',this.zoneList]]){const original=game[key];if(!Array.isArray(original)||!original.some(e=>this.hidden.has(e)))continue;list.length=0;for(const e of original)if(!this.hidden.has(e))list.push(e);set(game,key,list);}
  return restore;
  }catch(error){this.end(restore);throw error;}
 }
 end(restore){try{for(let i=restore.length-4;i>=0;i-=4){const e=restore[i],k=restore[i+1];if(restore[i+2])e[k]=restore[i+3];else delete e[k];}}finally{restore.length=0;this.depth=Math.max(0,this.depth-1);}}
}
module.exports={RenderEffectClock};
