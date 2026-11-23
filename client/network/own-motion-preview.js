'use strict';
// Fixed-step presentation prediction only. The existing protocol acknowledges
// joystick STATE commands, not individual simulation steps. lastSeq therefore
// retires command history, while snapshot.tick retires confirmed movement steps.
// No gameplay state or client-provided speed/dt is submitted to the authority.
const STEP=1000/60,MAX_STEPS=24,MAX_PREDICTION_MS=400;
class OwnMotionPreview{
 constructor(){this.reset();}
 reset(){this.state=null;this.commands=new Map();this.intentSeq=null;this.intent=null;this.handoffSeq=null;this.handoffAction=null;}
 command({epoch,seq,args}){
  if(this.state)this.state.recoveryStopHold=false;
  this.handoffSeq=null;this.handoffAction=null;this.intentSeq=seq;this.intent={epoch,seq,dx:args.dx,dy:args.dy};this.commands.set(seq,this.intent);
  while(this.commands.size>32)this.commands.delete(this.commands.keys().next().value);
 }
 retireForAuthorityAction({epoch,seq,action},now){
  const s=this.state;if(!s||s.epoch!==epoch||!Number.isFinite(now)){this.reset();return false;}
  // A new semantic action supersedes held-vector simulation, not the picture
  // already drawn. Retire speculative steps immediately and reconcile from
  // that last picture using subsequent authoritative positions.
  this.commands.clear();this.intentSeq=null;this.intent=null;this.handoffSeq=seq;this.handoffAction=['move','collectWood','collectGold','returnBase','board','exitTank'].includes(action)?action:null;
  s.release=null;s.stopAnchor=null;s.wasMoving=false;s.recoveryStopHold=false;s.authorityRecovery=null;s.semanticBarrierSeq=seq;s.confirmedControl=null;s.frames=[];s.shadow={x:s.ax,y:s.ay};s.simTick=s.tick;s.accumulator=0;
  s.offsetX=s.display.x-s.shadow.x;s.offsetY=s.display.y-s.shadow.y;s.at=now;return true;
 }
 acknowledge({epoch,seq,ok,tick}){
  const c=this.commands.get(seq);if(!c||c.epoch!==epoch)return;
  c.accepted=!!ok;c.tick=Number.isSafeInteger(tick)?tick:null;
  if(!ok&&this.state)this.state.frames=this.state.frames.filter(f=>f.seq!==seq);
 }
 sample({entity,epoch,tick,lastSeq=0,now,dx,dy,moving,base,clip,clipFrom=null,routeStep=null,step,speed,authoritativeMoving=!!entity?.stickDriven}){
  if(!Number.isFinite(now)||!Number.isSafeInteger(tick))return null;
  const motionSpeed=Number.isFinite(speed)?Math.max(0,speed):Math.max(0,entity.speed||0);const auth={x:entity.x,y:entity.y};let s=this.state;
  if(!s||s.entity!==entity||s.epoch!==epoch){
   if(!moving)return null;
   s=this.state={entity,epoch,tick,lastSeq,ax:auth.x,ay:auth.y,at:now-STEP,authAt:now,
    accumulator:0,simTick:tick,wasMoving:true,release:null,recoveryStopHold:false,authorityRecovery:null,semanticBarrierSeq:null,confirmedControl:null,frames:[],shadow:{...auth},display:{...auth},offsetX:0,offsetY:0};
  }
  if(moving){s.release=null;s.stopAnchor=null;s.recoveryStopHold=false;s.wasMoving=true;}
  else if(s.wasMoving){s.wasMoving=false;if(this.intent)s.release={x:s.display.x,y:s.display.y,at:now};}
  const advance=(shadow,frame)=>{
   if(step)return step(shadow,frame.dx,frame.dy);
   const speed=motionSpeed;
   const point=clip(shadow.x-auth.x+frame.dx*speed,shadow.y-auth.y+frame.dy*speed);
   if(point){shadow.x=point.x;shadow.y=point.y;}
  };
  if(tick!==s.tick||lastSeq!==s.lastSeq||auth.x!==s.ax||auth.y!==s.ay){
   const advanceTicks=tick-s.tick,authorityGap=now-s.authAt,advanceDistance=Math.hypot(auth.x-s.ax,auth.y-s.ay);
   const reachable=Math.max(160,motionSpeed*Math.min(30,Math.max(0,advanceTicks))+(entity.radius||0));
   // A confirmed held-control view after a stalled stream can contain many
   // real authority steps. Recognize only acknowledged, physically reachable
   // progress; keep semantic warps, reversals and unknown control state on the
   // original reset path. This changes no extrapolation/collision/error budget.
   // A refreshed identical held command can be newer than this positional
   // view. Use the newest accepted command actually included in the view,
   // never an older matching direction hidden behind a confirmed reversal.
   // Retain just that one confirmed control alongside the existing 32-command
   // history; no missing receipts or unconfirmed vector becomes authority.
   let control=s.confirmedControl;
   if(control?.epoch!==epoch||control.seq>lastSeq)control=null;
   for(const c of [...this.commands.values(),this.intent])if(c?.epoch===epoch&&c.accepted===true&&Number.isSafeInteger(c.tick)&&c.tick<=tick&&c.seq<=lastSeq&&(!control||c.seq>control.seq))control=c;
   s.confirmedControl=control?{...control}:null;
   const current=this.intent,sameHeld=current?.epoch===epoch&&current.accepted!==false&&control&&current.seq>=control.seq&&current.dx===control.dx&&current.dy===control.dy;
   // More than one joystick may be ordered after a delayed positional view.
   // Prove every intervening command is a joystick with an accepted receipt
   // strictly after that view; only the final in-flight command may lack ACK.
   // Missing/rejected commands, semantic barriers and old receipt ticks never
   // widen the original recovery, distance or extrapolation budgets.
   let pendingNextJoystick=!!(current?.epoch===epoch&&control?.seq===lastSeq&&current.seq>lastSeq&&current.seq-lastSeq<=32);
   if(pendingNextJoystick)for(let seq=lastSeq+1;seq<=current.seq;seq++){
    const c=seq===current.seq?current:this.commands.get(seq);
    if(!c||c.epoch!==epoch||!(c.accepted===true&&Number.isSafeInteger(c.tick)&&c.tick>tick||seq===current.seq&&c.accepted===undefined)){pendingNextJoystick=false;break;}
   }
   // An unacknowledged next joystick, or an accepted one whose actual receipt
   // tick strictly follows this positional view, belongs after the view. Its
   // reversal cannot turn already-confirmed physically reachable old movement
   // into a teleport. Require the exact last command in the view to have a real
   // accepted joystick receipt; never cross a semantic action or unknown gap.
   const pendingNextNeutral=pendingNextJoystick&&!moving&&!(current.dx||current.dy);
   const confirmedProgress=!s.semanticBarrierSeq&&(moving||pendingNextNeutral)&&authoritativeMoving&&(sameHeld||pendingNextJoystick)&&advanceTicks>30&&advanceTicks<=300&&authorityGap>MAX_PREDICTION_MS&&authorityGap<=5000&&advanceDistance<=motionSpeed*advanceTicks+(entity.radius||0);
   s.authorityRecovery=confirmedProgress?(pendingNextNeutral?'pending-neutral':pendingNextJoystick?'pending-next':'held'):null;
   if(confirmedProgress&&pendingNextNeutral)s.recoveryStopHold=true;
   const teleport=tick<s.tick||(!confirmedProgress&&advanceDistance>reachable);
   const neutral=this.intent&&this.intent.epoch===epoch&&!(this.intent.dx||this.intent.dy)&&this.intent.accepted!==false;
   // Once the positional view includes a confirmed neutral control, earlier
   // held-vector steps cannot remain future movement past that stop. lastSeq
   // alone is not a position ACK; require the snapshot's neutral body as well.
   const stopped=neutral&&!moving&&!authoritativeMoving&&lastSeq>=this.intent.seq;
   s.frames=teleport||stopped?[]:s.frames.filter(f=>{
    const c=this.commands.get(f.seq);
    if(c?.accepted===false||now-f.at>MAX_PREDICTION_MS)return false;
    // A receipt is not a positional acknowledgement. Only the snapshot can
    // confirm that a command and its movement have entered the world state.
    return f.seq!==null&&(f.seq>lastSeq||f.tick>tick);
   }).slice(-MAX_STEPS);
   s.shadow={...auth};
   let replayTick=tick;
   for(const frame of s.frames){replayTick=Math.max(replayTick,frame.tick);advance(s.shadow,frame);}
   s.simTick=replayTick;s.tick=tick;s.lastSeq=lastSeq;s.ax=auth.x;s.ay=auth.y;s.authAt=now;
   if(s.semanticBarrierSeq&&lastSeq>=s.semanticBarrierSeq)s.semanticBarrierSeq=null;
   s.offsetX=teleport?0:s.display.x-s.shadow.x;s.offsetY=teleport?0:s.display.y-s.shadow.y;
   if(teleport){s.recoveryStopHold=false;s.accumulator=0;s.display={...auth};s.at=now;return s.display;}
   for(const [seq,c]of this.commands)if(seq<=lastSeq||c.epoch!==epoch)this.commands.delete(seq);
  }
  const elapsed=Math.min(35,Math.max(0,now-s.at));s.at=now;
  // Never catch up a background pause, and never extrapolate a stalled view.
  s.accumulator=Math.min(STEP*2,s.accumulator+elapsed);
  const len=Math.max(1,Math.hypot(dx,dy));dx=moving?dx/len:0;dy=moving?dy/len:0;
  let count=0;
  while(s.accumulator+1e-7>=STEP&&count++<2){
   s.accumulator-=STEP;
   if(now-s.authAt>MAX_PREDICTION_MS||s.frames.length>=MAX_STEPS)continue;
   const c=this.intent,known=c&&c.epoch===epoch;
   if(c?.accepted===false)continue;
   // Preview the latest control actually enqueued to the authority. Intermediate
   // unsent stick directions are not replayable server input. Neutral local
   // release still stops immediately while its ordered command is in flight.
   const heldLength=known?Math.max(1,Math.hypot(c.dx,c.dy)):1;
   const frameDx=moving&&known?c.dx/heldLength:dx,frameDy=moving&&known?c.dy/heldLength:dy;
   const seq=known&&(moving||!(c.dx||c.dy))?c.seq:null;
   const frame={tick:++s.simTick,seq,dx:frameDx,dy:frameDy,at:now};const x=s.shadow.x,y=s.shadow.y;s.frames.push(frame);advance(s.shadow,frame);if(s.shadow.x===x&&s.shadow.y===y)s.frames.pop();
  }
  // Validate the segment actually displayed, not a chord from an older
  // authority point across an obstacle that the replay already went around.
  // A blocked segment holds the last still-legal picture. Current geometry,
  // endpoint bounds and authority-distance bounds remain enforced.
  const project=(dx,dy)=>clipFrom?clipFrom(s.display,{x:auth.x+dx,y:auth.y+dy}):clip(dx,dy);
  const boundedStopPoint=(anchor,bound)=>{
   const dx=anchor.x-auth.x,dy=anchor.y-auth.y,distance=Math.hypot(dx,dy);
   const ratio=distance>bound?Math.max(0,bound-1e-7)/distance:1;
   const point=project(dx*ratio,dy*ratio);
   return point&&Math.hypot(point.x-auth.x,point.y-auth.y)<=bound?point:null;
  };
  const neutral=this.intent&&this.intent.epoch===epoch&&!(this.intent.dx||this.intent.dy)&&this.intent.accepted!==false;
  const confirmedStop=neutral&&!authoritativeMoving&&lastSeq>=this.intent.seq;
  // A moving snapshot older than the pending neutral must not pull a released
  // picture backward. A pending ordered neutral keeps the same legal picture
  // until its actual positional stop arrives, including a delayed reply. The
  // existing authority-distance and terrain bounds still apply; the400ms
  // extrapolation budget is not proof the neutral was already applied.
  if(s.release&&!moving&&this.intent?.accepted!==false&&!confirmedStop&&(neutral||now-s.release.at<=MAX_PREDICTION_MS)){
   const bound=Math.min(160,Math.max(18,motionSpeed*MAX_STEPS));
   if(Math.hypot(s.release.x-auth.x,s.release.y-auth.y)<=bound){const held=project(s.release.x-auth.x,s.release.y-auth.y);if(held){s.display={x:held.x,y:held.y};s.offsetX=s.display.x-s.shadow.x;s.offsetY=s.display.y-s.shadow.y;return s.display;}}
   // A proven old moving view can arrive after a pending local stop. Reenter
   // the original distance bound only as far as required, then keep that legal
   // stopped picture until actual positional acknowledgement. No coasting to
   // the authority center and no extension of the extrapolation budget.
   if(s.recoveryStopHold){const held=boundedStopPoint(s.release,bound);if(held){s.release={...s.release,x:held.x,y:held.y};s.display={x:held.x,y:held.y};s.offsetX=s.display.x-s.shadow.x;s.offsetY=s.display.y-s.shadow.y;return s.display;}}
   s.release=null;
  }
  // A stopped display must not coast to an authority stop already ahead of
  // the last drawn prediction. Keep only this bounded render offset while the
  // confirmed stopped body stays at exactly that authority position. Any new
  // input, semantic action or authority movement releases it; no live position,
  // accepted receipt, collision, damage or resource value is changed here.
  if(confirmedStop&&!moving&&s.release&&!s.stopAnchor){const bound=Math.min(160,Math.max(18,motionSpeed*MAX_STEPS)),point=s.recoveryStopHold?boundedStopPoint(s.release,bound):project(s.release.x-auth.x,s.release.y-auth.y);if(point&&Math.hypot(point.x-auth.x,point.y-auth.y)<=bound)s.stopAnchor={x:point.x,y:point.y,authorityX:auth.x,authorityY:auth.y};}
  if(s.stopAnchor){const hold=s.stopAnchor;if(confirmedStop&&!moving&&auth.x===hold.authorityX&&auth.y===hold.authorityY){const point=project(hold.x-auth.x,hold.y-auth.y);if(point){s.display={x:point.x,y:point.y};return s.display;}}s.stopAnchor=null;}
  if(confirmedStop||this.intent?.accepted===false||s.release&&!neutral&&now-s.release.at>MAX_PREDICTION_MS)s.release=null;
  // Bound correction velocity instead of applying a large fraction in one frame.
  const fraction=Math.min(1,elapsed/80),correction=Math.hypot(s.offsetX,s.offsetY)*fraction;
  const limit=Math.max(.5,motionSpeed*Math.min(2,elapsed/STEP)*.35);
  const factor=correction>0?Math.min(1,limit/correction):1;
  s.offsetX*=1-fraction*factor;s.offsetY*=1-fraction*factor;
  const bound=Math.min(160,Math.max(18,motionSpeed*MAX_STEPS));
  const desiredX=s.shadow.x+s.offsetX,desiredY=s.shadow.y+s.offsetY;let x=desiredX,y=desiredY;
  const distance=Math.hypot(x-auth.x,y-auth.y);
  if(distance>bound){x=auth.x+(x-auth.x)*bound/distance;y=auth.y+(y-auth.y)*bound/distance;}
  let point=project(x-auth.x,y-auth.y);
  // A held vehicle may need to follow a legal curve while a target display
  // point is clipped. Bound both the detour and its return to a now-clear
  // segment, so clearing one tree cannot reintroduce a one-frame catch-up.
  const followLimit=motionSpeed*Math.min(2,elapsed/STEP)*2;
  if(routeStep&&moving&&elapsed>0&&(!point||Math.hypot(x-s.display.x,y-s.display.y)>followLimit)){
   const legalProjection=point;point=null;const route=s.routeShadow||(s.routeShadow={x:s.display.x,y:s.display.y});route.x=s.display.x;route.y=s.display.y;const target={x,y};routeStep(route,target,followLimit);
   const candidate=clipFrom?.(s.display,route);if(candidate&&Math.hypot(candidate.x-auth.x,candidate.y-auth.y)<=bound)point=candidate;
   // A new authoritative view can place the frozen picture outside the
   // unchanged error bound. A short detour cannot reenter it in one frame.
   // Prefer the already collision-validated bounded projection in that case,
   // rather than falling all the way back to the authority center. Never use
   // this exception for blocked segments or an already bounded picture.
   if(!point&&legalProjection&&Math.hypot(s.display.x-auth.x,s.display.y-auth.y)>bound)point=legalProjection;
  }
  point=point||(clipFrom&&Math.hypot(s.display.x-auth.x,s.display.y-auth.y)<=bound?clipFrom(s.display,s.display):null)||auth;
  // Continue from the point actually drawn after distance/terrain projection.
  // Keeping the pre-projection offset repeatedly targets the same unreachable
  // point, freezing between views and stepping again at every packet arrival.
  if(point.x!==desiredX||point.y!==desiredY){s.offsetX=point.x-s.shadow.x;s.offsetY=point.y-s.shadow.y;}
  s.display={x:point.x,y:point.y};if(!moving&&!authoritativeMoving&&Math.hypot(s.shadow.x-auth.x,s.shadow.y-auth.y)<.01&&Math.hypot(s.offsetX,s.offsetY)<.01)this.state=null;return s.display;
 }
}
module.exports={OwnMotionPreview,STEP,MAX_STEPS,MAX_PREDICTION_MS};
