'use strict';
// Single lossless WebP with 16 authored transparent poses. No simulation state.
const FILE='forest-troll.webp.bin';
// A fixed world-size fit for all original poses, not an animated scale.
// Measured near 3x the visible body area of a normal slime at default camera.
const SIZE_FACTOR=.55;
const W=168,H=136, WIDTH=1344,HEIGHT=300, FOOT_X=74,FOOT_Y=122,WORLD=.9*SIZE_FACTOR;
const WAIT=8000,RETRY=12000;
const withDeadline=(work,after,clear)=>new Promise((resolve,reject)=>{
 let done=false;const end=(ok,v)=>{if(done)return;done=true;clear(timer);ok?resolve(v):reject(v);};
 const timer=after(()=>end(false,Error('Forest troll page timeout')),WAIT);
 Promise.resolve().then(work).then(v=>end(true,v),e=>end(false,e));
});
function unload(image){if(image)try{image.onload=image.onerror=null;image.src='';}catch(_){}}
function create({fallback,Image,readPage,wake=()=>{},clock=Date.now,after=setTimeout,clear=clearTimeout,allowed=()=>true}={}){
 let image=null,flight=null,recoverAt=0,retryAt=0,epoch=0;
 function read(current){
  const im=new Image();let valid=true;
  return withDeadline(()=>readPage(im,FILE,()=>valid&&current()),after,clear).then(()=>{
   if(im.width!==WIDTH||im.height!==HEIGHT)throw Error('Forest troll texture dimensions');
   return im;
  }).catch(e=>{valid=false;unload(im);throw e;});
 }
 function warm(){
  if(image)return Promise.resolve(true);
  if(flight)return flight;
  if(!allowed()||clock()<retryAt||typeof Image!=='function'||typeof readPage!=='function')return Promise.resolve(false);
  const stamp=epoch,current=()=>stamp===epoch&&allowed();
  flight=(async()=>{
   const decoded=await read(current);
   if(!current()){unload(decoded);return false;}
   image=decoded;wake();return true;
  })().catch(()=>{if(stamp===epoch)retryAt=clock()+RETRY;return false;}).finally(()=>{flight=null;});
  return flight;
 }
 function release(){epoch++;unload(image);image=null;retryAt=0;}
 // Only visible trolls or their visible shots request the authored page.
 function demand(){const now=clock();if(!image&&now>=recoverAt&&now>=retryAt&&allowed()){recoverAt=now+1000;void warm();}}
 function drawUnit(ctx,unit,pose,frameIndex,facing,viewRear){
  if(!Number.isFinite(unit?.x)||!Number.isFinite(unit?.y))return false;
  if(!image){
   demand();
   return fallback?.()?.draw(ctx,unit,false,pose,frameIndex,facing,viewRear)===true;
  }
  const ix=Number.isFinite(frameIndex)?Math.trunc(frameIndex):0;
  let col;
  if(pose==='walk')col=(ix%4+4)%4;
  else if(pose==='windup')col=4+Math.max(0,Math.min(ix,2));
  else if(pose==='release')col=7;
  else if(pose==='idle')col=4; // planted raise pose is also the held stance
  else return false;
  const sy=viewRear?H:0,dx=-FOOT_X*WORLD,dy=-FOOT_Y*WORLD;
  ctx.save();
  try{
   // Save the low-zoom silhouette while retaining the original authored poses.
   ctx.imageSmoothingEnabled=true;
   if(facing<0){ctx.translate(unit.x,unit.y);ctx.scale(-1,1);ctx.drawImage(image,col*W,sy,W,H,dx,dy,W*WORLD,H*WORLD);}
   else ctx.drawImage(image,col*W,sy,W,H,unit.x+dx,unit.y+dy,W*WORLD,H*WORLD);
  }finally{ctx.restore();}
  return true;
 }
 // Visual origin only. Gameplay may retain independent projectile/collision coordinates.
 function muzzle(unit,facing,viewRear){return {x:unit.x+(facing<0?-1:1)*(viewRear?50:52)*SIZE_FACTOR,y:unit.y-(viewRear?64:55)*SIZE_FACTOR};}
 function drawSeed(ctx,x,y,angle=0){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  demand();ctx.save();
  try{
   ctx.translate(x,y);if(Number.isFinite(angle)&&angle)ctx.rotate(angle);
   if(image)ctx.drawImage(image,8,H*2+3,34,22,-11.5,-7.5,23,15);
   else {
    ctx.scale(.90,.90);ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-3,-6);ctx.lineTo(5,-5);ctx.lineTo(11,0);ctx.lineTo(4,6);ctx.lineTo(-4,5);ctx.closePath();
    ctx.fillStyle='#e4a246';ctx.fill();ctx.strokeStyle='#42331a';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='#ffe397';ctx.fillRect(0,-2,5,3);
   }
  }finally{ctx.restore();}
  return true;
 }
 return {warm,release,drawUnit,drawSeed,muzzle,get ready(){return image!==null;}};
}
module.exports={create,SIZE_FACTOR};
