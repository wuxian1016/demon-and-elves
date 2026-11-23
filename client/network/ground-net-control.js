'use strict';
// Ground net is a position lock only. Keep ordinary targeting, attack range,
// attacks already in progress and status timers under native game authority.
const matches=new WeakMap();
function match(g,create=false){
 let s=matches.get(g);
 if(s&&s.player!==g.player){for(const [t,e] of s.active)release(t,e);matches.delete(g);s=null;}
 if(!s&&create){s={player:g.player,active:new Map()};matches.set(g,s);}
 return s;
}
function state(g,t){return match(g)?.active.get(t);}
function release(t,e){
 if(!e.locked)return;
 Object.defineProperties(t,{x:{...e.xDef,value:e.x},y:{...e.yDef,value:e.y}});
 e.locked=false;t.groundNetLockedBN=false;
}
function trackable(g,t){
 if(!t||t.dead||t.airborne||t.waveBat||state(g,t)?.immune>0)return false;
 const x=Object.getOwnPropertyDescriptor(t,'x'),y=Object.getOwnPropertyDescriptor(t,'y');
 return !!(x?.configurable&&y?.configurable&&x.writable&&y.writable&&Number.isFinite(x.value)&&Number.isFinite(y.value));
}
function lock(g,t,ms){
 if(!Number.isFinite(ms)||ms<=0||!trackable(g,t))return false;
 const xDef=Object.getOwnPropertyDescriptor(t,'x'),yDef=Object.getOwnPropertyDescriptor(t,'y');
 const visual=Math.max(1560,ms),e={x:xDef.value,y:yDef.value,xDef,yDef,locked:true,left:ms,immune:ms+2000,visual,visualLeft:visual};
 // Includes pushes and direct collision-recovery relocation, not only velocity.
 Object.defineProperties(t,{x:{configurable:true,enumerable:xDef.enumerable,get:()=>e.x,set:()=>{}},y:{configurable:true,enumerable:yDef.enumerable,get:()=>e.y,set:()=>{}}});
 t.groundNetLockedBN=true;t.setMoveIntent?.(0,0);t.moving=false;if(t.waveStone)t.stoneWalking=false;
 match(g,true).active.set(t,e);return true;
}
function relocateLocked(g,t,x,y){
 const e=state(g,t);
 if(!e?.locked||!Number.isFinite(x)||!Number.isFinite(y))return false;
 e.x=x;e.y=y;return true;
}
function tick(g,dt){
 const s=match(g);if(!s||!Number.isFinite(dt)||dt<=0)return;
 for(const [t,e] of s.active){
  if(t.dead){release(t,e);s.active.delete(t);continue;}
  e.left=Math.max(0,e.left-dt);e.immune-=dt;e.visualLeft=Math.max(0,e.visualLeft-dt);
  if(!e.left)release(t,e);
  if(e.immune<=0&&e.visualLeft<=0)s.active.delete(t);
 }
}
function draw(g,c,inView,paint,offset){
 const s=match(g);if(!s||typeof paint!=='function')return;
 for(const [t,e] of s.active)if(!t.dead&&e.visualLeft>0&&inView(t.x,t.y,140)){
 const o=offset?.(t);if(o?.x||o?.y){c.save();c.translate(o.x,o.y);try{paint(c,t,e.visualLeft,e.visual);}finally{c.restore();}}else paint(c,t,e.visualLeft,e.visual);
 }
}
function immune(g,t){return (state(g,t)?.immune||0)>0;}
module.exports={trackable,lock,tick,draw,immune,relocateLocked};
