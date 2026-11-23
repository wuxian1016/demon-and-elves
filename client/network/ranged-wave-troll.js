'use strict';
const STAND=180,HARD=210,WINDUP=300,RELEASE=260,SEED_SPEED=505;
const PER_LANE_CAP=9;
// Match a full lane's pre-armor attack; do not boost waves already born in a save.
const rosterCount=n=>Math.min(PER_LANE_CAP,n);
// Siege-only tuning against normally available walls; armor and shields still apply.
const WALL_BY_PHASE={easy:[1.80,1,1.40],medium:[1,1.16,1.43],crazy:[1,1.19,1.46]};
function shotDamage(g,h,t){const own=g.ghostElfAPI?.attackValue(h,t);return own??nativeDamage(g,h,t);}
function nativeDamage(g,h,t){
 const roster=h.rangedTrollRosterScaleBN;
 if(!Number.isFinite(roster)||roster<1)return h.getDamage();
 const phase=h.slimeDragon570?2:h.slimeEvolved?1:0;
 const siege=t?.type==='wall'?(WALL_BY_PHASE[g.trollDifficulty]||WALL_BY_PHASE.medium)[phase]:1;
 return h.getDamage()*roster*siege;
}
const isWave=w=>Number.isSafeInteger(w)&&w>=7&&w%10===7;
const scope=(g,win)=>!g.tutorial&&!g.superChallenge580&&!g.networkAuthorityPhases627&&!g.networkDrawCamera627&&win.networkDefenseModeBN?.()!==true&&win.batSoloPolicyBN?.allows?.(g)===true;
const reach=(t,limit=STAND)=>t?.type==='tower'&&!t.airDefenseKindBN&&typeof t.attackRange==='function'?Math.max(0,Math.min(limit,t.attackRange()-24)):limit;
const valid=t=>!!t&&!t.dead&&!(t.hp<=0)&&typeof t.takeDamage==='function';
const ray={radius:3};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// Gameplay coordinates follow the ground plane. Only rendering starts at the sprite's pouch.
function cut(g,from,to,target){
 if(g.demonLineBlocked(from,to,ray.radius,true))return true;
 const building=g.slimeBlockingBuilding410(ray,from,to);
 return !!building&&building!==target;
}
const rear=(h,t)=>t.y<h.y&&h.y-t.y>=Math.abs(t.x-h.x)*.85;
const face=(h,t)=>Math.abs(t.x-h.x)>2?(t.x<h.x?-1:1):(h.facing<0?-1:1);
function clearTo(g,h,t){
 const dx=t.x-h.x,dy=t.y-h.y,d=Math.hypot(dx,dy),edge=Math.min(d,Math.max(0,t.radius||0));
 if(d<=edge)return true;
 const end={x:t.x-dx*edge/d,y:t.y-dy*edge/d};
 return !cut(g,h,end,t);
}
const los=new WeakMap();
function position(g,h,t){
 if(!h.waveRangedTrollBN)return true;
 if(!valid(t)||distance(h,t)>reach(t,HARD))return false;
 const now=g.supportTime||0,old=los.get(h),rev=g.groundObstacleRevision,terrain=g.terrainRevision;
 if(old&&old.t===t&&old.rev===rev&&old.terrain===terrain&&now>=old.t0&&now-old.t0<120&&Math.abs(h.x-old.x)+Math.abs(h.y-old.y)+Math.abs(t.x-old.tx)+Math.abs(t.y-old.ty)<4)return old.clear;
 const clear=clearTo(g,h,t);
 los.set(h,{t,rev,terrain,t0:now,x:h.x,y:h.y,tx:t.x,ty:t.y,clear});return clear;
}
function start(g,h,t,cooldown){
 if(!h.waveRangedTrollBN||h.rangedTrollCastBN||!(h.getDamage()>0)||!valid(t)||distance(h,t)>reach(t,HARD)||!clearTo(g,h,t))return false;
 h.facing=face(h,t);h.rangedTrollRearBN=rear(h,t);h.rangedTrollCastBN={target:t,age:0};h.attackCd=cooldown;
 h.setMoveIntent(0,0);return true;
}
function tickCast(g,h,dt,Projectile,art){
 const cast=h.rangedTrollCastBN;if(!cast)return false;
 h.setMoveIntent(0,0);
 if(h.slimeFlameStun407>0||h.groundNetLockedBN&&distance(h,cast.target)>reach(cast.target,HARD)||!valid(cast.target)||cast.ghostStoneBN&&g.ghostElfAPI?.host!==cast.target){h.rangedTrollCastBN=null;return true;}
 cast.age+=Math.min(50,Math.max(0,dt));if(cast.age<WINDUP)return true;
 h.rangedTrollCastBN=null;
 const t=cast.target;if(distance(h,t)>reach(t,HARD)||!clearTo(g,h,t))return true;
 h.facing=face(h,t);h.rangedTrollRearBN=rear(h,t);
 const muzzle=art?.muzzle?.(h,h.facing,h.rangedTrollRearBN),seed=new Projectile(h.x,h.y,t,{kind:'rangedTrollSeed',damage:shotDamage(g,h,t),soundSource:h});
 if(cast.ghostStoneBN)seed.ghostStoneBN=true;seed.rangedTrollSourceBN=h;seed.rangedTrollAgeBN=0;seed.rangedTrollDistanceBN=0;
 seed.rangedTrollMuzzleXBN=Number.isFinite(muzzle?.x)?muzzle.x-h.x:h.facing*20;
 seed.rangedTrollMuzzleYBN=Number.isFinite(muzzle?.y)?muzzle.y-h.y:-33;
 seed.rangedTrollVisualRangeBN=Math.max(1,distance(h,t)-(t.radius||0));
 seed.rangedTrollAngleBN=Math.atan2(t.y-h.y,t.x-h.x);g.projectiles.push(seed);
 h.rangedTrollReleaseUntilBN=(g.supportTime||0)+RELEASE;g.rangedWatchtowerGuideBN?.onShot(h,t);return true;
}
function tickSeed(g,p,dt){
 if(p.dead)return;
 const t=p.target;
 if(!g||!valid(t)||!p.rangedTrollSourceBN?.waveRangedTrollBN||p.ghostStoneBN&&g.ghostElfAPI?.host!==t){p.dead=true;return;}
 const ms=Number.isFinite(dt)?Math.min(50,Math.max(0,dt)):1000/60;if(!ms)return;
 p.rangedTrollAgeBN+=ms;if(p.rangedTrollAgeBN>650){p.dead=true;return;}
 const dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),edge=Math.max(0,d-(t.radius||0)-p.radius);
 const step=Math.min(edge,SEED_SPEED*ms/1000),next=step>0?{x:p.x+dx*step/d,y:p.y+dy*step/d}:p;
 if(step>0&&cut(g,p,next,t)){p.dead=true;return;}
 p.x=next.x;p.y=next.y;p.rangedTrollDistanceBN+=step;
 if(d>0)p.rangedTrollAngleBN=Math.atan2(dy,dx);
 if(edge<=step){t.takeDamage(p.damage,p.rangedTrollSourceBN);p.dead=true;}
}
function drawUnit(g,c,h,art){
 const cast=h.rangedTrollCastBN,now=g.supportTime||0,left=(h.rangedTrollReleaseUntilBN||0)-now;
 if(cast)return art?.drawUnit?.(c,h,'windup',Math.min(2,Math.floor(cast.age/100)),h.facing,h.rangedTrollRearBN===true);
 else if(left>0)return art?.drawUnit?.(c,h,'release',0,h.facing,h.rangedTrollRearBN===true);
 else if(h.moving)return art?.drawUnit?.(c,h,'walk',Math.floor(now/185)%4,h.facing,!h.sideways&&h.facingV<0);
 else return art?.drawUnit?.(c,h,'idle',0,h.facing,!h.sideways&&h.facingV<0);
}
function drawSeed(c,p,art){
 const u=Math.min(1,p.rangedTrollDistanceBN/p.rangedTrollVisualRangeBN),fade=1-u;
 const x=p.x+p.rangedTrollMuzzleXBN*fade,y=p.y+p.rangedTrollMuzzleYBN*fade-18*u-56*u*fade;
 if(art?.drawSeed?.(c,x,y,p.rangedTrollAngleBN)!==true){c.fillStyle='#E7A645';c.fillRect(x-3,y-3,6,6);}
}
module.exports={isWave,scope,rosterCount,reach,position,start,nativeDamage,tickCast,tickSeed,drawUnit,drawSeed};
