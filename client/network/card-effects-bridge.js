'use strict';
const ATTACK=new Set(['tower','iceTower','manaTower','cannonTower']);
const STYLE={
 fury:{tint:'#ff304c',light:'#ff6570',fade:'rgba(255,48,76,0)'},
 fortress:{tint:'#ffbd38',light:'#ffdc61',fade:'rgba(255,189,56,0)'},
 harvest:{tint:'#3ef080',light:'#57ff9c',fade:'rgba(62,240,128,0)'}
};
const LIMIT=144,LOW_LIMIT=48,TURN_MS=420;
function create({game:g,controller,createCanvas,enabled=()=>false,constrained=()=>false}){
 const glows=Object.create(null),sparkGlows=Object.create(null),left={fury:0,fortress:0,harvest:0};
 const workers=[],actorFx=[],targets=[],kinds=[],flags=[];let paintActor=null;
 let bases=0,bodyTints=0,basePasses=0,draws=0,tinted=0,sparks=0,fallbackDraws=0,reduced=false,eligible=0,marked=0;
 function harvestWorkers(){
  workers.length=0;
  return enabled()&&controller?.core.authority()&&controller.core.modifiers().harvest>1?workers:null;
 }
 function own(e){
  return e&&!e.dead&&e.ownerSlot==null&&!e.preview&&!e.isPreview&&!e.underConstruction&&
   !(e.buildTime>0&&e.buildProgress<e.buildTime);
 }
 function ring(c,e,r,h,off){
  const x=e.x,y=e.y+off;
  c.moveTo(x+r,y);c.ellipse(x,y,r,h,0,0,Math.PI*2);bases++;
 }
 function paintBases(c,buildings,people,art){
  if(buildings)bases=bodyTints=basePasses=0;
  if(!people||!buildings&&!people.length)return;
  const before=bases;
  c.save();
  try{
   c.imageSmoothingEnabled=true;c.globalAlpha=1;
   c.beginPath();
   if(buildings)for(const e of buildings){if(e.type!=='goldMine'||!own(e))continue;
    if(art?.harvestTintBN?.(c,e))bodyTints++;
    else ring(c,e,Math.max(23,Math.min(46,e.radius*.92)),7,27);
   }
   else for(const e of people)if(own(e)&&(!e.inTank||e.inTank.dead))ring(c,e,13,4,21);
   if(bases>before){
    basePasses+=2;
    c.fillStyle='rgba(45,222,122,.30)';c.fill();
    c.lineWidth=2.5;c.strokeStyle='rgba(149,255,181,.93)';c.stroke();
   }
  }finally{c.restore();}
 }
 function glow(kind,spark=false){
  const atlas=spark?sparkGlows:glows;
  if(atlas[kind]!==undefined)return atlas[kind];
  try{const s=createCanvas();s.width=s.height=32;const c=s.getContext('2d'),style=STYLE[kind],gradient=c.createRadialGradient(16,16,0,16,16,16);
   if(spark){gradient.addColorStop(0,'#fffdf2');gradient.addColorStop(.23,'#fffdf2');gradient.addColorStop(.43,style.light);gradient.addColorStop(.62,style.tint);}
   else{gradient.addColorStop(0,style.light);gradient.addColorStop(.37,style.tint);}
   gradient.addColorStop(1,style.fade);c.fillStyle=gradient;c.fillRect(0,0,32,32);return atlas[kind]=s;}
  catch(_){return atlas[kind]=null;}
 }
 function paintTexture(c,kind,atlas,x,y,w,h,alpha){
  if(left[kind]<=0)return false;
  left[kind]--;draws++;c.globalAlpha=alpha;
  if(atlas){c.drawImage(atlas,x-w/2,y-h/2,w,h);return true;}
  // The visible fallback needs no new canvas, gradients, paths, or per-target state.
  c.fillStyle=STYLE[kind].light;c.fillRect(x-w*.16,y-h*.12,w*.32,h*.24);fallbackDraws++;return true;
 }
 function drawActorFx(c){
  if(!paintActor)return;
  const paint=paintActor;paintActor=null;
  c.save();
  try{for(let i=0;i<actorFx.length;i+=3){const k=actorFx[i+1];left[k]=actorFx[i+2];paint(actorFx[i],k,false);}}
  finally{actorFx.length=0;c.restore();}
 }
 function draw(c,inView,people,deferActors=false,visibleBuildings=null){
  actorFx.length=targets.length=kinds.length=flags.length=0;paintActor=null;
  eligible=marked=draws=tinted=sparks=fallbackDraws=0;reduced=false;if(!enabled()||!controller?.core.authority())return;
  const s=controller.core.state,m=controller.core.modifiers(),fury=m.attack>1,fortress=m.maxHp>1,harvest=m.harvest>1;
  if(!fury&&!fortress&&!harvest)return;
  reduced=constrained()===true;
  const cap=reduced?LOW_LIMIT:LIMIT,time=s.time/1000;
  function visible(e){return typeof inView==='function'?inView(e.x,e.y,160):Math.abs(e.x-g.camera.x)<1400&&Math.abs(e.y-g.camera.y)<1600;}
  function add(e,kind,flag){targets.push(e);kinds.push(kind);flags.push(flag);}
  function paint(e,kind,big,mixed=false){
   const r=Math.max(14,Math.min(67,e.radius||28));
   const spread=big?Math.max(24,r*.76):16,body=big?Math.max(46,r*1.56):38;
   // Split the two simultaneous tower accents vertically so red and gold stay identifiable.
   const height=mixed?(kind==='fury'?55:22):big?32:13;
   if(left[kind]>1&&paintTexture(c,kind,glow(kind),e.x,e.y-height,body,body*(mixed?1.0:big?1.42:1.14),reduced?.69:.62))tinted++;
   // Use the existing color and budget, but a bright, distinct cached spark core.
   // Keep rising motes above the body wash so both read at normal phone zoom.
   const count=reduced?1:big?3:2, size=big?19:15,atlas=glow(kind,true);
   for(let i=0;i<count&&left[kind];i++){
    const p=(time*.7+(i+1)/count+(Math.abs(e.x+e.y)%113)/113)%1;
    const x=e.x+(i%2?-1:1)*spread*(.48+.17*i),y=e.y-(big?30:22)-(big?98:60)*p;
    if(paintTexture(c,kind,atlas,x,y,size,size,.60+Math.sin(p*Math.PI)*.36))sparks++;
   }
  }
  // Build one reused worklist from native visible objects. Each entry gets a
  // bright particle before any entry gets extras. Dense scenes rotate by a
  // stable game-time interval (not by redraw), with no per-entity allocation.
  const p=g.player,playerVisible=own(p)&&!p.drivingTank&&visible(p);
  if(playerVisible){
   if(fury&&p.relicBladeLevel)add(p,'fury',0);
   if(harvest&&(p.task?.type==='gold'||p.task?.type==='wood'))add(p,'harvest',0);
  }
  if(harvest)for(const e of people||[])if(own(e)&&(!e.inTank||e.inTank.dead)&&visible(e))add(e,'harvest',0);
  for(const e of visibleBuildings||g.buildings||[]){
   if(!own(e)||!visible(e))continue;
   const armed=fury&&(ATTACK.has(e.type)||e.airDefenseKindBN==='antiAir'||e.airDefenseKindBN==='net');
   if(armed)add(e,'fury',fortress?3:1);
   if(fortress)add(e,'fortress',armed?3:1);
   if(harvest&&e.type==='goldMine')add(e,'harvest',1);
  }
  const count=targets.length;eligible=count;if(!count)return;
  const slots=Math.min(cap,count),start=count>cap?(Math.floor(s.time/TURN_MS)*cap)%count:0;
  const budget=reduced?cap:Math.min(cap,Math.max(72,count));
  const share=Math.floor(budget/slots),extra=budget%slots;
  c.save();
  try{
   for(let i=0,j=start;i<slots;i++,j=(j+1)%count){
    const e=targets[j],k=kinds[j],f=flags[j],big=!!(f&1);
    const quota=Math.min(share+Number(i<extra),reduced?2:big?4:3);
    marked++;
    if(!big&&deferActors){actorFx.push(e,k,quota);paintActor=paint;}
    else{left[k]=quota;paint(e,k,big,!!(f&2));}
   }
  }finally{targets.length=kinds.length=flags.length=0;c.restore();}
 }
 return{draw,drawActorFx,drawBases:paintBases,drawWorkerBases:(c,people)=>paintBases(c,null,people),harvestWorkers,stats:()=>({bases,bodyTints,basePasses,draws,tinted,sparks,fallbackDraws,eligible,marked,reduced,max:reduced?LOW_LIMIT:LIMIT,cachedTextures:Object.keys(glows).length+Object.keys(sparkGlows).length}),stormVisualReady:false};
}
module.exports={create};
