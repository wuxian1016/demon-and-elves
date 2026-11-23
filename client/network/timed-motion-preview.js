'use strict';
// Private positional replay. Inputs are captured direction/tick history; ONLY
// a committed positional snapshot retires ticks. Queue receipts cannot do so.
function point(v){return v&&Number.isFinite(v.x)&&Number.isFinite(v.y)?{x:v.x,y:v.y}:null;}
function shadowOf(e){return{x:e.x,y:e.y,radius:e.radius,escapeRemaining627:Math.max(0,e.tankEscapeTime||0),terrainAvoidSign:[-1,0,1].includes(e.terrainAvoidSign)?e.terrainAvoidSign:0,terrainAvoidNormal:point(e.terrainAvoidNormal),terrainEscape:point(e.terrainEscape),terrainClearSteps:Number.isSafeInteger(e.terrainClearSteps)?e.terrainClearSteps:0};}
class TimedMotionPreview{
 constructor(){this.reset();}
 reset(){this.state=null;this.samples=0;this.rebases=0;this.rejected=0;this.maxCorrection=0;}
 sample({entity,epoch,tick,now,frames,step,speed,blocked=false}){
  if(blocked||!entity||entity.dead||!Number.isSafeInteger(epoch)||!Number.isSafeInteger(tick)||!Number.isFinite(now)||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||!Number.isFinite(speed)||speed<0||typeof step!=='function'||!Array.isArray(frames)||frames.length>128){this.state=null;this.rejected++;return null;}
  let previous=-1,target=tick;const inputs=new Map();
  for(const frame of frames){if(!Number.isSafeInteger(frame.tick)||frame.tick<=previous||!Number.isFinite(frame.dx)||!Number.isFinite(frame.dy)||Math.hypot(frame.dx,frame.dy)>1.000001){this.state=null;this.rejected++;return null;}previous=frame.tick;if(frame.tick>tick){if(frame.tick>tick+24){this.state=null;this.rejected++;return null;}inputs.set(frame.tick,frame);target=frame.tick;}}
  const shadow=shadowOf(entity),advance=(body,from,to)=>{for(let t=from+1;t<=to;t++){const f=inputs.get(t);step(body,f?.dx||0,f?.dy||0);}};
  advance(shadow,tick,target);let s=this.state;
  const identity=entity.networkId??entity,changed=!s||s.identity!==identity||s.epoch!==epoch||tick<s.tick||target<s.target||now<s.at||now-s.at>250||Math.hypot(entity.x-(s?.ax??entity.x),entity.y-(s?.ay??entity.y))>Math.max(160,speed*24);
  if(changed)s=this.state={identity,epoch,tick,target,at:now,ax:entity.x,ay:entity.y,shadow,offsetX:0,offsetY:0};
  else{
   if(tick!==s.tick||entity.x!==s.ax||entity.y!==s.ay){
    if(s.target>=tick){const expected={...s.shadow,terrainAvoidNormal:point(s.shadow.terrainAvoidNormal),terrainEscape:point(s.shadow.terrainEscape)};advance(expected,s.target,target);const dx=expected.x-shadow.x,dy=expected.y-shadow.y;if(Math.hypot(dx,dy)>1e-6){s.offsetX+=dx;s.offsetY+=dy;this.rebases++;this.maxCorrection=Math.max(this.maxCorrection,Math.hypot(dx,dy));}}
    else s.offsetX=s.offsetY=0;
   }
   const decay=Math.min(1,Math.max(0,now-s.at)/80);s.offsetX*=1-decay;s.offsetY*=1-decay;
   const bound=Math.max(18,Math.min(160,speed*24)),distance=Math.hypot(s.offsetX,s.offsetY);if(distance>bound){s.offsetX*=bound/distance;s.offsetY*=bound/distance;}
   Object.assign(s,{tick,target,at:now,ax:entity.x,ay:entity.y,shadow});
  }
  this.samples++;return{x:shadow.x+s.offsetX,y:shadow.y+s.offsetY,predictionTick:target,authorityTick:tick};
 }
 report(){return{samples:this.samples,rebases:this.rebases,rejected:this.rejected,maxCorrection:this.maxCorrection,scope:'Private bounded positional replay from actual snapshot plus captured input ticks; no authority updates, damage, harvesting, ACK latency, native/GPU FPS or phone acceptance.'};}
}
module.exports={TimedMotionPreview,shadowOf};
