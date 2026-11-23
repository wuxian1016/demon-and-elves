'use strict';
// V4 approved independent cloud/bolt/impact poses. These are atlas poses at
// their native proportions, not deformations of a single static frame.
const SETS=Object.freeze({cloud:{cols:2,rows:4},lightning:{cols:4,rows:2},impact:{cols:2,rows:4}});
const GROUND=Object.freeze([[0,.09],[-.35,.18],[.35,.16],[-.63,-.06],[.64,-.09],[-.19,-.43],[.22,-.45],[-.68,.37],[.63,.39],[-.28,.58],[.27,.62]].map((p,i)=>Object.freeze({x:p[0],y:p[1],delay:i*.155,height:i%3===0?1.17:i%3===1?1:.84})));
const fallback=()=>typeof wx!=='undefined'?wx:null;
function create({game:g,platform=fallback(),timeoutMs=9000,now=Date.now}={}){
 let images=null,flight=null,notBefore=0,draws=0,idleSince=null,pkg,bolt,loading;
 const load=()=>pkg||=(new Promise((y,n)=>platform.loadSubpackage({name:'stormArt',success:y,fail:n}))).catch(e=>{pkg=null;throw e;});
 function warmBolt(){
  if(bolt||loading||now()<notBefore||!platform?.createImage||!platform?.loadSubpackage)return;
  loading=load().then(()=>new Promise((y,n)=>{const im=platform.createImage(),t=setTimeout(n,timeoutMs);im.onload=()=>{clearTimeout(t);im.width>0?y(im):n();};im.onerror=()=>{clearTimeout(t);n();};im.src='storm-art/lightning.webp.bin';})).then(im=>bolt=im,()=>{notBefore=now()+15000;}).finally(()=>loading=null);
 }
 function drawBolt(c,x,y,h,a,t){if(bolt&&a>.01)frame(c,'lightning',Math.min(7.999,t*8),false,x-h/4,y-h,h/2,h,a);}
 function warmup(){
  idleSince=null;
  if(images)return Promise.resolve(true);
  if(flight)return flight;
  if(now()<notBefore||!platform?.createImage||!platform?.loadSubpackage)return Promise.resolve(false);
  let closed=false;const clean=[],stop=()=>{closed=true;for(const fn of clean)fn();};
  flight=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('storm art timed out')),timeoutMs);clean.push(()=>clearTimeout(timer));
   warmBolt(); load().then(()=>Promise.all(Object.keys(SETS).map(key=>key==='lightning'?Promise.resolve(loading).then(()=>bolt?['lightning',bolt]:Promise.reject()):new Promise((ok,fail)=>{
    if(closed)return fail(Error('storm art closed'));
    const im=platform.createImage();clean.push(()=>{im.onload=null;im.onerror=null;});
    im.onload=()=>im.width>0&&im.height>0?ok([key,im]):fail(Error('storm atlas dimensions'));
    im.onerror=fail;im.src='storm-art/'+key+'.webp.bin';
   }))))
   .then(resolve,reject);
  }).then(rows=>{images=Object.fromEntries(rows);return true;},()=>{notBefore=now()+15000;return false;}).finally(()=>{stop();flight=null;});
  return flight;
 }
 function frame(c,key,seq,loop,x,y,w,h,alpha){
  const im=key==='lightning'?bolt:images[key];if(!im)return;const {cols,rows}=SETS[key],sw=im.width/cols,sh=im.height/rows;
  const f=Math.floor(seq),frac=seq-f,next=loop?(f+1)%8:Math.min(f+1,7);
  const paint=(k,a)=>{if(a<.013)return;c.globalAlpha=a*alpha;c.drawImage(im,k%cols*sw,Math.floor(k/cols)*sh,sw,sh,x,y,w,h);draws++;};
  if(f!==next){paint(f,1-frac);paint(next,frac);}else paint(f,1);
 }
 function draw(c,inView,fxEnabled=true){
  draws=0;
  const core=g?.cardsCandidate?.core;
  if(!core?.authority()){images=null;idleSince=null;return;}
  const state=core.state;
  const e=state.effects.find(q=>q.type==='storm'&&q.ends>state.time);
  if(!e){
   if(images){
    idleSince??=state.time;
    if(state.time-idleSince>=20000){images=null;idleSince=null;}
   }
   return;
  }
  idleSince=null;
  const {x,y,radius:r}=e.area;
  if(!inView(x,y,r*1.75))return;
  const t=Math.max(0,(state.time-e.starts)/1000),fade=Math.min(1,(e.ends-state.time)/330),s=r/285;
  c.save();
  try{
   c.globalAlpha=fade*.68;c.strokeStyle='rgba(202,155,255,.65)';c.lineWidth=1.5;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();
   if(!images){if(!flight&&now()>=notBefore)warmup();return;}
   for(const location of GROUND){
    const phase=t-location.delay;if(phase<0)continue;const p=phase%1.8;
    if(p>1.13)continue;
    const gx=x+location.x*r,gy=y+location.y*r;
    if(fxEnabled&&p<.9){const h=386*s*location.height,w=h/2;frame(c,'lightning',Math.min(7.999,p/.9*8),false,gx-w/2,gy-h,w,h,fade);}
    if(p>=.23){const w=177*s*location.height,h=w/2;frame(c,'impact',Math.min(7.999,(p-.23)/.9*8),false,gx-w/2,gy-h*.6,w,h,.92*fade);}
   }
   frame(c,'cloud',t*3%8,true,x-280*s,y-440*s,560*s,280*s,fade);
  }finally{c.restore();}
 }
 return{warmup,warmBolt,drawBolt,draw,get boltReady(){return !!bolt;},get ready(){return images!==null;},get draws(){return draws;}};
}
module.exports={create};
