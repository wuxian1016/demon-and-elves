'use strict';
const soft=require('./soft-hint'),priority=require('../../network/notice-priority'),mapCopy=[[['这是恶魔，',15],['它正在搜查据点。',13]],[['这是你的位置。',15]]],mapBeat=2420;
exports.install=(g,runtime)=>{
 let s,held=false,returnedWake,mapPlayer,mapAge=0,mapLast=null,mapScan=0,mapWake=null;
 const scoutWide=['恶魔开始逐个搜查营地。','一旦发现你，它就会猛攻你的基地，直到将它摧毁。'];
 const scoutNarrow=[scoutWide[0],'一旦发现你，它就会猛攻你的基地，','直到将它摧毁。'];
 const body=()=>g.ghostElfAPI?.host||g.player.drivingTank||g.player;
 const block=()=>runtime.hidden||g.wallHalfGuideDemo?.urgent?.()||g.state!=='hunt'||g.player.dead||g.popupActive515()||g.placement||g.cameraPeek||g.rotationInputBlocked398()||g.tutorial||g.endlessOpeningIntro||g.ceremony||g.cardPresentation?.modal()||g.robotGuideBN?.combatPaused?.()||g.dragonTutorialBL?.active||g.rewardAdBN?.pausesLive?.()||g.shareRescueVisible616();
 const clamp=(n,max)=>Math.min(max,Math.max(0,n));
 const ease=x=>(x=clamp(x,1))*x*x*(10+x*(-15+6*x));
 function restore(q,snap){
  if(q.mx===undefined)return;
  const p=body(),x=clamp(p.x-q.dx,q.mx),y=clamp(p.y-q.dy,q.my);
  g.cameraFollow.x=x;g.cameraFollow.y=y;
  if(snap){g.camera.x=x;g.camera.y=y;}
  g.cameraPan.x=g.cameraPan.y=g.cameraRecenter.x=g.cameraRecenter.y=0;g.manualCamera394=false;
 }
 function stop(){if(s){const q=s;s=null;restore(q,true);if(q.kind==='wake'&&q.id===g.player)returnedWake=q.id;}}
 function start(kind,t){
  if(!t||t.dead||block())return;
  const old=s,c=g.camera,p=body(),v=runtime.viewport(),z=g.zoom(),w=v.width/z,h=v.height/z;
  const dx=p.x-c.x,dy=p.y-c.y,onScreen=dx>0&&dx<w&&dy>0&&dy<h;
  s={kind,t,id:g.player,age:0,x:c.x,y:c.y,dx:old?.dx??(onScreen?dx:w/2),dy:old?.dy??(onScreen?dy:h/2),ox:t.x,oy:t.y,px:t.x,py:t.y,travel:0,sample:0,back:0,cx:c.x,cy:c.y};
 }
 function returning(q,fast=false){
  q.back=q.age||.001;q.x=g.camera.x;q.y=g.camera.y;q.brake=fast?56:96;q.bx=q.vx||0;q.by=q.vy||0;
  q.ms=Math.min(fast?680:1250,Math.max(fast?280:820,Math.hypot(body().x-q.dx-q.x,body().y-q.dy-q.y)*(fast?.19:.32)));
  if(q.kind==='wake'&&!fast)q.ms*=1.67;
  q.fast=fast;
 }
 function blocked(){if(s&&(s.id!==g.player||block()))stop();}
 function tick(dt){
  mapJourney();
  if(!s)return;blocked();const q=s;if(!q)return;
  {
   q.vx=(g.camera.x-q.cx)/dt;q.vy=(g.camera.y-q.cy)/dt;q.cx=g.camera.x;q.cy=g.camera.y;
  }
  q.age+=dt;if(q.back){if(q.age-q.back>=q.brake+q.ms)stop();return;}
  const t=q.t;if(t.dead){returning(q);return;}
  if(q.kind==='bat'){if(g.ghostElfAPI?.host!==t||!g.ghostElfAPI?.deliveringR7) returning(q);return;}
  q.travel+=Math.hypot(t.x-(q.lx??q.px),t.y-(q.ly??q.py));q.lx=t.x;q.ly=t.y;q.sample+=dt;
  if(q.age>=4100){returning(q);return;}
  if(q.sample>=300){const net=Math.hypot(t.x-q.px,t.y-q.py),moved=Math.hypot(t.x-q.ox,t.y-q.oy);
   if(q.age>=2260&&net>=32&&net>=q.travel*.86&&moved>=70){returning(q);return;}
   q.sample=q.travel=0;q.px=t.x;q.py=t.y;
  }
 }
 function frame(w,h,mx,my){
  const q=s;if(!q)return false;q.mx=mx;q.my=my;
  const p=body(),t=q.t,a=q.age-q.back,b=q.brake;
  let bx=q.x,by=q.y,u=ease(q.age/(q.kind==='bat'?420:2000));
  if(q.back){const k=clamp(a/b,1),d=b*(k-k*k/2);
   bx=clamp(bx+q.bx*d,mx);by=clamp(by+q.by*d,my);u=ease((a-b)/q.ms);
  }
  const x=clamp(q.back?p.x-q.dx:t.x-w/2,mx),y=clamp(q.back?p.y-q.dy:t.y-h*.49,my);
  g.camera.x=bx+(x-bx)*u;g.camera.y=by+(y-by)*u;return true;
 }
 function touch(kind,e){
  if(kind==='cancel'||kind==='hide'){const used=held;held=false;if(kind==='hide')stop();return used;}
  const count=(e.touches?.length?e.touches:e.changedTouches)?.length;
  if(held){
   if(kind==='start'&&count===1)held=false;
   else{if(kind==='end'&&!e.touches?.length)held=false;return true;}
  }
  if(kind!=='start'||!s)return false;
  blocked();if(!s)return false;
  const p=runtime.touches(e.touches?.length?e.touches:e.changedTouches)?.[0];
  if(p&&s.kind==='wake'){
   const x=p.clientX,y=p.clientY,j=g.getJoystickRect();
   if(g.hudButtonAt(x,y)||g.sessionMenuHit(x,y)||j&&Math.hypot(x-j.x,y-j.y)<=j.r||g.joystickMode==='floating'&&g.floatingJoystickHit(x,y)){if(!s.fast)returning(s,true);return false;}
  }
  if(s.fast){stop();return false;}
  held=true;
  returning(s,true);
  runtime.wake();return true;
 }
 // A tap on the explicit cinematic notice returns; all other touches keep the
 // current world coordinate under the finger and are passed through.
 function passiveInput(x,y){
  const q=s;if(!q)return false;
  const r=q.kind==='wake'&&!q.fast&&q.returnRect;
  if(r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h&&!g.hudButtonAt(x,y)&&!g.sessionMenuHit(x,y)){stop();runtime.wake();return true;}
  s=null;if(q.kind==='wake')returnedWake=q.id;
  g.cameraFollow.x=g.camera.x;g.cameraFollow.y=g.camera.y;
  g.cameraPan.x=g.cameraPan.y=g.cameraRecenter.x=g.cameraRecenter.y=0;g.manualCamera394=true;
  return false;
 }
 function fog(c,w,h,k,paint){
  const q=s;if(q?.kind!=='wake'||q.back)return paint();
  const z=g.zoom(),x=(q.t.x-g.camera.x)*z+k.x,y=(q.t.y-g.camera.y-24)*z+k.y,R=85;
  if(x< -R||y< -R||x>w+R||y>h+R)return paint();
  c.save();try{c.beginPath();c.rect(0,0,w,h);c.moveTo(x+R,y);c.arc(x,y,R,0,Math.PI*2,true);c.closePath();c.clip();paint();}finally{c.restore();}
  c.save();c.beginPath();c.arc(x,y,R,0,Math.PI*2);const a=c.createRadialGradient(x,y,R*.57,x,y,R);a.addColorStop(0,'rgba(1,6,10,0)');a.addColorStop(1,'#01060a');c.fillStyle=a;c.fill();c.restore();
 }
 function nearestCamp(t){
  let index=-1,d=Infinity;
  for(const [i,p] of t.searchZones.entries()){const r=Math.hypot(t.x-p.x,t.y-p.y);if(r<d){index=i;d=r;}}
  return {index,d};
 }
 function origin(){
  if(!g.operationGuideModeR13()||g.demonMapLessonR12===1||g.demonMapLessonR12<0)return;
  const t=g.troll;if(!t?.searchZones?.length)return;
  const {index}=nearestCamp(t);
  if(!(g.demonMapLessonR12>=2))g.demonMapLessonR12=index+3;
  mapWake={x:t.x,y:t.y};
 }
 function arrive(t,index){
  const stage=g.demonMapLessonR12;
  if(g.operationGuideModeR13()&&t===g.troll&&stage>=2&&index!==stage-3&&g.state==='hunt'&&t.searchZones[index])g.demonMapLessonR12=1;
 }
 function mapJourney(){
  if(mapPlayer!==g.player){mapPlayer=g.player;mapAge=0;mapLast=null;mapScan=0;mapWake=null;}
  if(!g.operationGuideModeR13()||g.state!=='hunt'||g.demonMapLessonR12===1||g.demonMapLessonR12<0)return;
  const t=g.troll,time=g.supportTime||0;
  if(!t?.searchZones?.length||t.dead||t.state==='frozen'||t.retreating||time<mapScan)return;
  mapScan=time+250;
  if(!mapWake){origin();
   // Restore in-progress patrols: use the native arrival ledger when the
   // earlier camera/old save never notified this overlay.
   const start=g.demonMapLessonR12-3;
   for(const i of t.visitedZones||[])if(i!==start&&t.searchZones[i]){arrive(t,i);return;}
  }
  const {index,d}=nearestCamp(t),p=t.searchZones[index];
  if(p&&index!==g.demonMapLessonR12-3&&d<=p.radius+72&&(!mapWake||Math.hypot(t.x-mapWake.x,t.y-mapWake.y)>=160))arrive(t,index);
 }
 function mapCue(c){
  if(![1,-2].includes(g.demonMapLessonR12)||!g.operationGuideModeR13()||g.passiveHintsR13?.quiet()||s||block()||
   priority.activeToast(g)||g.defenseGuideDemo?.resourceIntroActive()||g.troll.retreating||
   g.demonAttackFocus545||g.firstAttackCameraFocus||g.minimapExpanded515||g.buildMenu||g.selectedBuilding)return null;
  const beat=g.demonMapLessonR12===-2?1:0,t=g.troll,p=g.player;
  // Mirror drawMiniPortraits512: an instruction points only at a painted face.
  const dem=t&&!t.dead&&(!g.fogEnabled||g.fogStateAtWorld(t.x,t.y)===2);
  if(!beat&&!dem)return null;
  const m=g.getMinimapRect(),full=g.minimapToWorld(m.x+m.w,m.y+m.h),S=g.uiSafeRect396();
  const r=Math.max(3.4,Math.min(4.5,m.w*.0315));
  const pos=o=>[m.x+Math.max(r,Math.min(m.w-r,o.x/full.x*m.w)),m.y+Math.max(r,Math.min(m.h-r,o.y/full.y*m.h))];
  const [x,y]=pos(beat?p:t),other=beat&&!dem?null:pos(beat?t:p);
  if(!Number.isFinite(x+y)||other&&Math.hypot(x-other[0],y-other[1])<r*2.7)return null;
  const obs=[g.sessionMenuRect(),g.resourceCapPreview?.rect(),g.goldShortageGuideBN?.layout(),g.toast?.time>0&&g.toastRect,g.minimapZoomButton515?.()];
  const overlaps=(a,b)=>a&&b&&b.w>0&&b.h>0&&a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),top=g.topHudLayout().bottom;
  const plan=soft.layout(c,Math.min(135,S.w-26),mapCopy[beat]);
  const left=m.x-plan.w-12,right=m.x+m.w+12;
  const rows=[{x:left,y:clamp(y-plan.h*.5,top+7,S.bottom-plan.h-8),side:-1},
   {x:right,y:clamp(y-plan.h*.5,top+7,S.bottom-plan.h-8),side:1},
   {x:clamp(m.x+m.w-plan.w,S.x+5,S.right-plan.w-5),y:Math.max(top+9,m.y+m.h+35),side:0}];
  for(const q of rows){
   const box={...q,w:plan.w,h:plan.h};
   if(box.x<S.x+4||box.x+box.w>S.right-4||box.y<top+5||box.y+box.h>S.bottom-26||obs.some(o=>overlaps(box,o)))continue;
   const from=[q.side<0?q.x+plan.w:q.side>0?q.x:clamp(x,q.x+5,q.x+plan.w-5),q.side?q.y+plan.h*.5:q.y];
   const d=Math.hypot(from[0]-x,from[1]-y);
   if(d<12)continue;
   let angle=Math.atan2(y-from[1],x-from[0]);
   if(other&&Math.abs((other[0]-x)*Math.sin(angle)-(other[1]-y)*Math.cos(angle))<r*1.3&&
      (other[0]-x)*Math.cos(angle)+(other[1]-y)*Math.sin(angle)<0&&Math.hypot(other[0]-x,other[1]-y)<d){
    angle=Math.atan2(y-from[1]+(other[1]<y?-14:14),x-from[0]);
   }
   const end=[x-Math.cos(angle)*r*(beat?1.6:1.85),y-Math.sin(angle)*r*(beat?1.6:1.85)];
   const stem=[end[0]-Math.cos(angle)*14,end[1]-Math.sin(angle)*14];
   return {x:box.x,y:box.y,plan,end,stem,angle,beat};
  }
  return null;
 }
 function drawArrival(c){
  const q=mapCue(c);if(!q){mapLast=null;return;}
  const time=g.supportTime||0,delta=mapLast===null?0:Math.max(0,Math.min(80,time-mapLast));mapLast=time;
  const age=mapAge%mapBeat,alpha=Math.max(.27,Math.min(1,(age+90)/170,(mapBeat-age+40)/175));
  c.save();try{
   c.globalAlpha=alpha;soft.paint(c,q.x,q.y,q.plan);
   c.strokeStyle=c.fillStyle=q.beat?'#8EFFAD':'#FF9C8D';c.lineWidth=2;c.beginPath();c.moveTo(...q.stem);c.lineTo(...q.end);c.stroke();
   c.beginPath();c.moveTo(...q.end);
   for(const a of [-.55,.55])c.lineTo(q.end[0]-7*Math.cos(q.angle+a),q.end[1]-7*Math.sin(q.angle+a));
   c.closePath();c.fill();
  }finally{c.restore();}
  mapAge+=delta;
  if(mapAge>=mapBeat){g.demonMapLessonR12=q.beat?-1:-2;mapAge=0;mapLast=null;}
 }
 const mapCueVisible=()=>!!mapCue(g.ctx);
 function alert(){return s?.kind==='wake'&&!s.fast&&!block();}
 function drawAlert(c){
  if(!alert())return drawArrival(c);
  const q=s,m=g.getMinimapRect(),S=g.uiSafeRect396(),gear=g.sessionMenuRect(),bottom=g.topHudLayout().bottom;
  const full=g.minimapToWorld(m.x+m.w,m.y+m.h);
  const x=m.x+q.ox/full.x*m.w,y=m.y+q.oy/full.y*m.h,pulse=(q.age%950)/950;
  let width=196,px=(S.x+S.right-width)/2,py=Math.max(S.y+8,bottom+9);
  const left=gear.x+gear.w+9,right=m.x-9;
  if(right-left>=146){width=Math.min(width,right-left);px=left+(right-left-width)/2;}
  else py=Math.max(py,m.y+m.h+12);
  const h=48;if(py+h>S.bottom-70){q.returnRect=null;return;}q.returnRect={x:px,y:py,w:width,h};
  c.save();
  try{
   c.globalAlpha=Math.min(1,.32+q.age/160)*(q.back?Math.max(0,1-(q.age-q.back)/q.ms):1);
   c.save();c.beginPath();c.rect(m.x,m.y,m.w,m.h);c.clip();
   c.beginPath();c.arc(x,y,11+7*pulse,0,7);c.lineWidth=3-pulse;c.strokeStyle='rgba(35,7,9,.96)';c.stroke();
   c.beginPath();c.arc(x,y,10+7*pulse,0,7);c.lineWidth=2;c.strokeStyle='rgba(255,73,89,'+(1-.45*pulse)+')';c.stroke();
   c.beginPath();c.arc(x,y,8,0,7);c.fillStyle='rgba(55,10,18,.85)';c.fill();c.lineWidth=1.4;c.strokeStyle='#FFAA75';c.stroke();
   c.beginPath();c.moveTo(x,y-5);c.lineTo(x+4,y);c.lineTo(x,y+5);c.lineTo(x-4,y);c.closePath();c.fillStyle='#FF4F62';c.fill();c.restore();
   c.beginPath();c.moveTo(px+10,py);c.arcTo(px+width,py,px+width,py+h,10);c.arcTo(px+width,py+h,px,py+h,10);c.arcTo(px,py+h,px,py,10);c.arcTo(px,py,px+width,py,10);c.closePath();c.fillStyle='rgba(34,9,14,.90)';c.fill();c.lineWidth=1.3;c.strokeStyle='#D96666';c.stroke();
   c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
   c.font='900 25px sans-serif';c.lineWidth=3;c.strokeStyle='#2A080C';c.strokeText(runtime.nativeText('恶魔苏醒'),px+width/2,py+18,width-14);
   c.fillStyle='#FFDBA9';c.fillText(runtime.nativeText('恶魔苏醒'),px+width/2,py+18,width-14);
   c.font='11px sans-serif';c.fillStyle='#FFC3B9';c.fillText(runtime.nativeText('轻触返回'),px+width/2,py+36,width-14);
   const z=g.zoom(),v=runtime.viewport(),tx=(q.t.x-g.camera.x)*z,ty=(q.t.y-g.camera.y)*z;
   if(!g.operationGuideModeR13())return;
   if(!q.scout&&tx>=34&&tx<=v.width-34&&ty>=v.height*.21&&ty<=v.height*.84)q.scout=q.age||1;
   if(!q.scout)return;
   const sw=Math.min(390,S.right-S.x-20),land=v.width>v.height,sx=land?(q.scoutSide??=(tx<v.width*.49?S.right-sw-16:S.x+16)):(S.x+S.right-sw)/2,lines=sw>=374?scoutWide:scoutNarrow,sh=13+lines.length*21;
   const upper=land?Math.max(py+h+9,bottom+15,sx+sw>m.x?m.y+m.h+6:0):Math.max(py+h+9,m.y+m.h+6),lower=Math.min(S.bottom-79-sh,v.height*.69);
   const overlaps=y=>ty+53>y&&ty-53<y+sh&&tx+39>sx&&tx-39<sx+sw;
   const sy=overlaps(upper)&&lower>=upper&&!overlaps(lower)?lower:upper;
   if(sy+sh>S.bottom-75||overlaps(sy))return;
   c.globalAlpha=Math.min(1,(q.age-q.scout+16)/145)*(q.back?clamp((q.brake+q.ms-q.age+q.back)/240,1):1);
   c.beginPath();c.moveTo(sx+9,sy);c.arcTo(sx+sw,sy,sx+sw,sy+sh,9);c.arcTo(sx+sw,sy+sh,sx,sy+sh,9);c.arcTo(sx,sy+sh,sx,sy,9);c.arcTo(sx,sy,sx+sw,sy,9);c.closePath();
   c.fillStyle='rgba(30,12,16,.78)';c.fill();c.lineWidth=1;c.strokeStyle='rgba(234,135,115,.66)';c.stroke();
   c.font='700 15px sans-serif';
   for(let i=0;i<lines.length;i++){c.fillStyle=i?'#FFF0D9':'#FFD79B';c.fillText(runtime.nativeText(lines[i]),sx+sw/2,sy+17+i*21,sw-20);}
  }finally{c.restore();}
 }
 g.cameraScenesR7={drawAlert,mapCueVisible,alert,passiveInput,origin,arrive,wake:t=>{start('wake',t);if(s?.kind!=='wake')returnedWake=g.player;},wakeReturned:()=>returnedWake===g.player,bat:t=>start('bat',t),tick,frame,touch,fog,active:()=>!!s,fogActive:()=>s?.kind==='wake'&&!s.back,blocked,stop};
};
