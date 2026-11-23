'use strict';
// Render scalars only. No simulation, navigation, work completion or rewards.
// Positions have already been sampled by the existing renderer/predictor.
class RenderPoseClock{
 constructor(){this.epoch=null;this.states=new WeakMap();this.depth=0;this.frames=[];}
 reset(){this.epoch=null;this.states=new WeakMap();}
 begin(actors,epoch,now,local=null){const depth=this.depth++,restore=this.frames[depth]||(this.frames[depth]=[]);restore.length=0;if(depth||!Number.isFinite(now))return restore;if(epoch!==this.epoch){this.reset();this.epoch=epoch;}
 const set=(e,key,value)=>{if(e[key]===value)return;restore.push(e,key,Object.hasOwn(e,key),e[key]);e[key]=value;};
 try{for(const e of actors||[]){if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;let s=this.states.get(e),distance=s?Math.hypot(e.x-s.x,e.y-s.y):0,elapsed=s?now-s.at:0;const reset=!s||elapsed<0||elapsed>1000||distance>160;if(reset){s={x:e.x,y:e.y,at:now,walk:Number.isFinite(e.walkDist)?e.walkDist:0,timer:0,collecting:false};this.states.set(e,s);distance=0;elapsed=0;}const dt=Math.max(0,elapsed),blocked=!!(e.dead||e.inTank||e.drivingTank||e.stunTimer>0||e.stunMs>0||e.robotStun>0);
 if(local?.entity===e&&!blocked&&typeof local.animate==='function'){
  // Only the original audited Entity.animTrack runs, on detached scalar work.
  // No movement/update/attack method is invoked. Authority fields are restored
  // after drawing; all other actors retain the existing pose projection.
  let own=s.owned;if(reset||!own||own.animate!==local.animate){own=s.owned={animate:local.animate,work:{x:e.x,y:e.y,_animX:Number.isFinite(local.fromX)?local.fromX:e.x,_animY:Number.isFinite(local.fromY)?local.fromY:e.y,walkDist:Number.isFinite(e.walkDist)?e.walkDist:0,moving:!!e.moving,facing:e.facing,facingV:e.facingV,sideways:!!e.sideways,turnAnim:Number.isFinite(e.turnAnim)?e.turnAnim:0,moveIntentX:0,moveIntentY:0,actionAnim:0}};}
  const work=own.work;work.x=e.x;work.y=e.y;const poseDt=Math.max(0,Math.min(100,dt)),intentScale=poseDt/(1000/60);work.moveIntentX=Number.isFinite(local.intentX)?local.intentX*intentScale:0;work.moveIntentY=Number.isFinite(local.intentY)?local.intentY*intentScale:0;work.actionAnim=0;
  // The held local control drives its pose. A presentation reconciliation is
  // not a change of input direction and must not flip front/back or advance
  // the walk cycle by the correction distance. Keep the audited original
  // animTrack; provide a detached, intent-sized animation displacement only.
  if(local.manualStop===true||Math.hypot(Number.isFinite(local.intentX)?local.intentX:0,Number.isFinite(local.intentY)?local.intentY:0)>0){work._animX=work.x-work.moveIntentX;work._animY=work.y-work.moveIntentY;}
  own.animate.call(work,poseDt);s.walk=work.walkDist;
  for(const key of['walkDist','moving','facing','facingV','sideways','turnAnim'])set(e,key,work[key]);
 }else{s.owned=null;if(Number.isFinite(e.walkDist)){if(!blocked)s.walk+=distance;set(e,'walkDist',s.walk);if(!reset)set(e,'moving',!blocked&&distance>.01);}}
 const collecting=!blocked&&!e.inHouse&&e.task?.phase==='collect'&&Number.isFinite(e.collectTimer)&&Number.isFinite(e.collectInterval)&&e.collectInterval>0;
 if(collecting){const interval=e.collectInterval;if(!s.collecting||s.target!==e.task.target||s.type!==e.task.type||s.interval!==interval)s.timer=Math.max(0,e.collectTimer)%interval;else s.timer=(s.timer+dt)%interval;s.interval=interval;s.target=e.task.target;s.type=e.task.type;set(e,'collectTimer',s.timer);}s.collecting=collecting;if(!collecting)s.target=null;s.x=e.x;s.y=e.y;s.at=now;
 }return restore;}catch(error){this.end(restore);throw error;}}
 end(restore){try{for(let i=restore.length-4;i>=0;i-=4){const e=restore[i],key=restore[i+1],own=restore[i+2],value=restore[i+3];if(own)e[key]=value;else delete e[key];}}finally{restore.length=0;this.depth=Math.max(0,this.depth-1);}}
}
module.exports={RenderPoseClock};
