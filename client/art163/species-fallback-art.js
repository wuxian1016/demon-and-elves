'use strict';
// Packed from the same transparent, independently authored Forest Troll and Griffin poses.
// Available from the already-loaded terrain art package; never needs monsterRearMotion.
module.exports=function create(Image,read,clock=Date.now){
 let image=null,flight=false,retry=0;
 function warm(){
  if(image||flight||clock()<retry)return;
  flight=true;
  Promise.resolve().then(async()=>{
   const im=new Image();await read(im,'monster-species-lite.webp.bin');
   if(im.width===368&&im.height===88)image=im;
  }).catch(()=>{}).finally(()=>{flight=false;retry=clock()+5000;});
 }
 function draw(c,u,griffin,pose,frame,facing,rear){
  if(!image)warm();
  const x=u.x,y=u.y-(griffin&&Number.isFinite(u.griffinAltitudeBN)?Math.max(0,u.griffinAltitudeBN):0);
  c.save();
  try{
   if(!image){ // Both native decoders are unavailable. Do not masquerade as a wolf.
    c.font='bold 12px sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#2c251c';c.fillStyle='#f5e0b7';
    const name=griffin?'狮鹫':'森林巨魔';c.strokeText(name,x,y-9);c.fillText(name,x,y-9);return true;
   }
   const i=pose==='walk'||pose==='fly'||pose==='return'?(frame>=2?1:0):pose==='release'||pose==='dive'||pose==='attack'?3:2;
   c.translate(x,y);if(facing<0)c.scale(-1,1);c.imageSmoothingEnabled=true;
   const k=griffin?1.116/.41:.9*.55*168/44;
   c.drawImage(image,(i+(griffin?4:0))*46,rear?44:0,46,44,griffin?-23*k:-(1+74*44/168)*k,griffin?-30*k:-(1+122*42/136)*(.9*.55*136/42),46*k,griffin?44*k:44*(.9*.55*136/42));
   return true;
  }finally{c.restore();}
 }
 return {warm,draw};
};
