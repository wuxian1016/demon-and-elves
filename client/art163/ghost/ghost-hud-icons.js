'use strict';
// Native, no glyph substitution: on some WX fonts the earlier symbols are tofu.
module.exports=function create({Image,loadPackage,seed,wake,lowMemory,stealthImage}){
 let icon=null,pending=false,retry=0,timer=0,batIcon=null,batPending=false,batRetry=0;
 function warm(){
  if(icon||pending||lowMemory()||Date.now()<retry)return;
  pending=true;let im=null;
  const done=success=>{clearTimeout(timer);if(im)im.onload=im.onerror=null;if(success)icon=im;pending=false;retry=Date.now()+6000;wake();};
  timer=setTimeout(()=>done(false),9000);
  Promise.resolve().then(loadPackage).then(()=>{if(!pending)return;im=new Image();im.onload=()=>done(im.width===128&&im.height===128);im.onerror=()=>done(false);im.src='factory-model-art/ghost-possess-icon.webp.bin';}).catch(()=>done(false));
 }
 function warmBat(){
  if(batIcon||batPending||lowMemory()||Date.now()<batRetry)return;
  batPending=true;let im=null;const done=ok=>{if(!batPending)return;clearTimeout(timeout);if(im)im.onload=im.onerror=null;if(ok)batIcon=im;batPending=false;batRetry=Date.now()+6000;wake();};
  const timeout=setTimeout(()=>done(false),9000);
  Promise.resolve().then(loadPackage).then(()=>{if(!batPending)return;im=new Image();im.onload=()=>done(im.width===72&&im.height===72);im.onerror=()=>done(false);im.src='factory-model-art/bat-steal-approved-review.png';}).catch(()=>done(false));
 }
 // Request independently of the canvas cache: a painted fallback does not imply art is ready.
 function warmVisible(type){if(type==='possess')warm();else if(type==='bat')warmBat();else if(type==='stealth'&&!lowMemory())stealthImage?.(true);}
 function draw(c,type,r){warmVisible(type);
  const stealth=type==='stealth'&&stealthImage?.(false);
  c.save();
  try{
   c.translate(r,r);c.scale(r/30,r/30);c.lineCap='round';c.lineJoin='round';
   if(type==='bat'){if(batIcon){c.drawImage(batIcon,-23,-23,46,46);return true;}return false;}
   if(type==='possess'&&icon){c.beginPath();c.arc(0,0,24,0,Math.PI*2);c.clip();c.drawImage(icon,-24,-24,48,48);return;}
   // The native dock supplies the only gold rim. Reuse the approved print's interior.
   if(stealth){c.beginPath();c.arc(0,0,25,0,Math.PI*2);c.clip();c.drawImage(stealth,72,466,82,82,-25,-25,50,50);return;}
   // Keep the named HUD button usable while original portrait art is loading.
   // The lower label is already visible; do not draw a substitute skill symbol.
   if(type==='stealth'||type==='possess')return false;
   if(type==='seed'&&seed(c))return;
   c.fillStyle='#b5f7ef';c.strokeStyle='#91e8ee';c.lineWidth=3;
   if(type==='attack'||type==='seed'){
    c.beginPath();c.ellipse(0,0,10,6,-.65,0,Math.PI*2);c.fill();c.stroke();
   }else{
    c.beginPath();c.moveTo(-13,10);c.bezierCurveTo(-19,-8,-13,-17,0,-17);c.bezierCurveTo(14,-17,19,-8,13,10);c.lineTo(7,6);c.lineTo(0,11);c.lineTo(-7,6);c.closePath();c.fill();c.fillStyle='#291c49';for(const x of [-5,5]){c.beginPath();c.ellipse(x,-5,2.1,3.2,0,0,Math.PI*2);c.fill();}
   }
  }finally{c.restore();}
 }
 return{draw,warmVisible,warm,warmBat,batReady:()=>!!batIcon,ready:()=>!!icon,stealthReady:()=>!!stealthImage?.(false)};
};
