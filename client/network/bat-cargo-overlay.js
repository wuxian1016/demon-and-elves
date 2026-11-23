'use strict';
const visual=require('./bat-cargo-visual');
// Per-source-frame basket-mouth locations, expressed in a 300px frame.
// These are state-layer anchors, not interpolated or deformed character poses.
const mouths=[
 [[129,174,19,13],[207,181,14,14]],[[129,175,19,13],[207,182,14,14]],[[130,172,19,13],[204,182,14,13]],[[124,172,18,13],[200,183,14,13]],
 [[130,176,19,13],[201,184,13,13]],[[130,176,19,13],[203,182,14,13]],[[129,176,19,13],[203,184,14,13]],[[129,177,19,13],[202,185,14,13]],
 [[129,176,19,13],[205,183,14,13]],[[130,176,19,13],[207,182,14,13]],[[128,176,19,13],[208,181,14,13]],[[126,177,19,13],[205,182,14,13]],
 [[130,165,21,16],[216,175,15,14]],[[140,162,21,16],[226,175,15,14]],[[139,159,21,16],[212,180,13,12]],[[142,158,21,16],null],
 [[135,157,21,16],null],[[137,153,21,16],null],[[132,158,21,16],null],[[132,160,21,16],null],
 [[128,165,21,16],[205,190,12,10]],[[120,169,21,16],[201,194,13,11]],[[128,171,21,16],[213,190,13,11]],[[126,170,21,16],[209,192,13,11]]
];
module.exports=function({Image,imagePath=value=>value}={}){
 let image=null,ready=false,pending=null;
 function preload(){
  if(pending)return pending;
  if(!Image)return Promise.resolve();
  const im=image=new Image();
  pending=require('./native-image-decode')(im,imagePath('art-bat-preview/cargo-empty-mouth.png')).then(()=>{
   ready=true;
  },error=>{
   if(image===im){pending=null;image=null;ready=false;}
   throw Error('Bat cargo artwork decode failed: '+error.message);
  });
  return pending;
 }
 function draw(c,b,frame,attacking,x,y,size){
  if(!ready||!image?.width)return false;
  const m=mouths[(attacking?12:0)+frame];if(!m)return false;
  const state=b.batCargoBN?visual.cargoState(b):visual.presentationState(b);
  c.save();c.translate(x,y);c.scale(size/300,size/300);
  m.forEach((p,side)=>{if(state==='mixed'||!p||(side===0&&state==='gold')||(side===1&&state==='wood'))return;const[cx,cy,rx,ry]=p;c.save();c.beginPath();c.ellipse(cx,cy,rx,ry,.18,0,Math.PI*2);c.clip();c.fillStyle='#28160c';c.fill();c.drawImage(image,side?55:0,0,55,40,cx-rx,cy-ry,rx*2,ry*2);c.restore();});
  // Cargo-only warm highlights; original action sprites and their timing stay untouched.
  if((state==='wood'||state==='mixed')&&m[1]){
   const[cx,cy,rx,ry]=m[1];c.save();c.beginPath();c.ellipse(cx,cy,rx,ry,.18,0,Math.PI*2);c.clip();
   const glow=c.createRadialGradient(cx+rx*.2,cy-ry*.3,0,cx,cy,rx*1.1);glow.addColorStop(0,'rgba(255,226,167,0.36)');glow.addColorStop(1,'rgba(255,226,167,0)');c.fillStyle=glow;c.fill();
   c.strokeStyle='rgba(255,232,184,0.48)';c.lineWidth=1.1;c.lineCap='round';
   for(const [dx,dy,r] of [[.3,-.25,.36],[-.25,.34,.31]]){c.beginPath();c.ellipse(cx+rx*dx,cy+ry*dy,rx*r,ry*r,.35,Math.PI*.95,Math.PI*1.9);c.stroke();}
   c.restore();
  }
  c.restore();return true;
 }
 return {preload,draw,ready:()=>ready};
};
