'use strict';
// Direction banks contain only independent missing angles, in native sprite-cell sizes.
const coreFx=require('./ghost-basic-fx');
const E={file:'ghost-elf-directions.webp.bin',w:64,h:72,count:5,slots:[2,1,0,1]};
const FLOAT=[2,3],OLD_GESTURE=[0,1,2,3,2,1];
const M={file:'ghost-mech-directions.webp.bin',w:180,h:176,slots:[-1,0,1,2]};
function index(actor){
 if(!actor||!actor.moving&&!(actor.walkDist>0))return -1; // preserve original before first movement
 if(actor.sideways===true)return actor.facing===1?1:actor.facing===-1?3:-1;
 if(actor.sideways!==false)return -1;
 return actor.facingV===-1?2:actor.facingV===1?0:-1;
}
function firing(o,now){
 return !!(o&&(o.actionAnim>0||o.flameTimer>0||o.superTimer>0&&o.superDuration547-o.superTimer<600||coreFx.front(o,now)));
}
module.exports=function({Image,loadPackage,runtime,time=()=>undefined,casting=()=>false}){
 const armed=new WeakMap();
 function face(o,x,y,ms){
  const dx=x-o.x,dy=y-o.y;
  if(!Number.isFinite(dx+dy)||!(dx||dy))return;
  const side=Math.abs(dx)>Math.abs(dy),n=side?(dx<0?3:1):(dy<0?2:0),now=time()||0;
  o.sideways=side;if(dx)o.facing=dx<0?-1:1;if(dy)o.facingV=dy<0?-1:1;
  let v=armed.get(o);if(!v){v={n,end:0};armed.set(o,v);}
  v.end=Math.max(v.n===n?v.end:0,now+ms);v.n=n;
 }
 function weapon(o,now=time()){const v=armed.get(o);return v&&now<v.end?v.n:-1;}
 const front=(o,now=time())=>casting(o)||(!armed.has(o)?firing(o,now):weapon(o,now)===0);
 let elf=null,mech=null,elfBusy=false,mechBusy=false,elfRetry=0,mechRetry=0;
 function request(elfKind){
  const k=elfKind?E:M,now=Date.now();
  if(!Image||!loadPackage||runtime.hidden||runtime.memoryConstrained?.()||
     (elfKind?(elf||elfBusy||now<elfRetry):(mech||mechBusy||now<mechRetry)))return;
  if(elfKind)elfBusy=true;else mechBusy=true;
  let image=null,timer=null,closed=false;
  function finish(good){
   if(closed)return;closed=true;clearTimeout(timer);
   if(image){image.onload=image.onerror=null;}
   const keep=good&&!runtime.hidden&&!runtime.memoryConstrained?.();
   if(elfKind){elfBusy=false;elfRetry=Date.now()+5000;if(keep)elf=image;}
   else{mechBusy=false;mechRetry=Date.now()+5000;if(keep)mech=image;}
   if(keep)runtime.wake?.();
  }
  timer=setTimeout(()=>finish(false),10000);
  Promise.resolve().then(loadPackage).then(()=>{
   if(closed||runtime.hidden||runtime.memoryConstrained?.()){finish(false);return;}
   image=new Image();
   image.onload=()=>finish(image.width===k.w*(k.count||3)&&image.height===k.h);
   image.onerror=()=>finish(false);
   image.src='factory-model-art/'+k.file;
  }).catch(()=>finish(false));
 }
 return{
  drawElf(c,o,lift,motion=0,legacy){
   const strike=o.actionAnim>0&&o.acting?.('relicAttack')&&o.relicAttackSideways===false&&o.relicAttackFacingV===1;
   // Reuse the complete already-shipped forward gesture on a real sword strike.
   if(strike&&legacy?.width===256&&legacy.height===72){
    const k=Math.max(0,Math.min(5,Math.floor(6*(1-o.actionAnim/Math.max(1,o.actionDuration)))));
    c.save();c.translate(o.x,o.y-12);
    if(o.relicAttackFacing<0)c.scale(-1,1);
    c.drawImage(legacy,OLD_GESTURE[k]*64,0,64,72,-32,-64,64,72);c.restore();
    return true;
   }
   if(o.actionAnim>0&&!strike)return false;
   const n=strike?0:index(o);if(n<0||E.slots[n]<0)return false;
   if(!elf){request(true);return false;}
   let frame=E.slots[n];
   if(n===0){
    lift=12; // True authored front poses; don't stack an additional bounce.
    if(strike){const phase=1-o.actionAnim/Math.max(1,o.actionDuration);frame=phase<.18?2:phase<.68?4:3;}
    else frame=FLOAT[Math.floor(motion/145)%FLOAT.length];
   }
   if(n===1){
    // Orient the independent side silhouette east; movement itself does not deform it.
    c.save();c.translate(o.x,0);c.scale(-1,1);c.drawImage(elf,frame*64,0,64,72,-32,o.y-lift-64,64,72);c.restore();
   }else c.drawImage(elf,frame*64,0,64,72,o.x-32,o.y-lift-64,64,72);
   return true;
  },
  front,face,weapon,
  drawMech(c,o,h,now=time()){
   if(front(o,now))return false;
   const aim=weapon(o,now),n=aim<0?index(o):aim;if(n<0||M.slots[n]<0)return false;
   if(!mech){request(false);return false;}
   const w=h*180/176;
   c.drawImage(mech,M.slots[n]*180,0,180,176,o.x-w/2,o.y+18-h,w,h);return true;
  }
 };
};
