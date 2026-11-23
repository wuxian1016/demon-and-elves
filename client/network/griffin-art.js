'use strict';
// One packed 20-pose, no-effects atlas: 4 fly, 3 aim, 3 dive per angle.
// Left/right facing mirrors illustrations; pose frames are separately authored.
const FILE='griffin.webp.bin';
const BOX=[476,344];
const FRAMES=[[[2,2,74,91,37,66],[80,2,100,58,46,35],[184,2,98,52,48,25],[286,2,88,57,40,34],[300,97,94,64,43,38],[398,97,76,71,32,43],[2,172,74,80,35,53],[80,172,81,78,38,40],[165,172,81,87,38,51],[250,172,90,75,40,43]],[[378,2,78,90,42,56],[2,97,100,58,46,28],[106,97,96,55,48,22],[206,97,90,63,42,33],[344,172,92,60,42,34],[2,263,79,70,36,40],[85,263,78,79,41,45],[167,263,78,61,40,34],[249,263,80,74,42,38],[333,263,90,70,44,39]]];
// Fixed atlas↔world conversion, never animated or inferred from the current frame.
const WORLD=1.116, WAIT=8000, RETRY=12000;
const bounded=(n,max)=>Number.isFinite(n)?Math.max(0,Math.min(Math.trunc(n),max)):0;
function withDeadline(work,after,clear){
 return new Promise((ok,fail)=>{
  let done=false;const t=after(()=>end(false,Error('Griffin texture deadline')),WAIT);
  function end(pass,v){if(done)return;done=true;clear(t);(pass?ok:fail)(v);}
  Promise.resolve().then(work).then(v=>end(true,v),e=>end(false,e));
 });
}
function unload(im){if(im)try{im.onload=im.onerror=null;im.src='';}catch(_){}}
function create({fallback,Image,readPage,clock=Date.now,after=setTimeout,clear=clearTimeout,allowed=()=>true}={}){
 let recoverAt=0;
 let image=null,job=null,again=0,epoch=0;
 function decode(current){
  const im=new Image();let valid=true;
  return withDeadline(()=>readPage(im,FILE,()=>valid&&current()),after,clear).then(()=>{
   if(im.width!==BOX[0]||im.height!==BOX[1])throw Error('Griffin texture dimensions');
   return im;
  }).catch(e=>{valid=false;unload(im);throw e;});
 }
 function warm(){
  if(image)return Promise.resolve(true);
  if(job)return job;
  if(!allowed()||clock()<again||typeof Image!=='function'||typeof readPage!=='function')return Promise.resolve(false);
  const stamp=epoch;
  const current=()=>stamp===epoch&&allowed();
  job=(async()=>{
   const decoded=await decode(current);
   if(stamp!==epoch||!allowed()){unload(decoded);return false;}
   image=decoded;return true;
  })().catch(()=>{if(stamp===epoch)again=clock()+RETRY;return false;}).finally(()=>{job=null;});
  return job;
 }
 function release(){epoch++;unload(image);image=null;again=0;}
 function framesFor(pose,frame){
  if(pose==='fly')return bounded(frame,3);
  if(pose==='aim'||pose==='grounded')return 4+bounded(frame,2);
  if(pose==='dive'||pose==='attack')return 7+bounded(frame,2);
  // As it brakes, transition through three already illustrated flight poses.
  if(pose==='return')return [2,1,0][bounded(frame,2)];
  return null;
 }
 function drawUnit(ctx,h,pose,frame,facing,viewRear){
  if(!Number.isFinite(h?.x)||!Number.isFinite(h?.y))return false;
  if(!image){
   // Still retry for monsters already alive after their scheduled wave has passed.
   if(clock()>=recoverAt){recoverAt=clock()+1000;void warm();}
   return fallback?.()?.draw(ctx,h,true,pose,frame,facing,viewRear)===true;
  }
  const index=framesFor(pose,frame);
  if(index==null)return false;
  const [sx,sy,w,hh,ax,ay]=FRAMES[viewRear?1:0][index];
  const dx=-ax*WORLD,dy=-ay*WORLD,x=h.x,y=h.y-(Number.isFinite(h.griffinAltitudeBN)?Math.max(0,h.griffinAltitudeBN):0);
  ctx.save();
  try {
   ctx.imageSmoothingEnabled=true;
   if(facing<0){ctx.translate(x,y);ctx.scale(-1,1);ctx.drawImage(image,sx,sy,w,hh,dx,dy,w*WORLD,hh*WORLD);}
   else ctx.drawImage(image,sx,sy,w,hh,x+dx,y+dy,w*WORLD,hh*WORLD);
  } finally{ctx.restore();}
  return true;
 }
 return {warm,release,drawUnit,get ready(){return image!=null;}};
}
module.exports={create,WORLD};
