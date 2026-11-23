'use strict';
// Display/selection and in-place variant swaps. New stock tank conversions remain native.
const GHOST_PRICE=Object.freeze({wood:1100,gold:1500}),STOCK_PRICE=Object.freeze({wood:900,gold:1200});
const activeLabels=[['激光重炮','扇形喷火','狂暴模式'],['传送','扇形喷火','复制恶魔']];
const sourceSlots=[[180,0],[180,88],[0,176]];
const ghosts=['ghostRelocate','robotFlame','ghostCopy'];
function install(g,{runtime,Image,offline,art,skills,makeCanvas,loadPackage}){
 const baseLayout=g.getUpgradePanelLayout,draw=g.drawUpgradePanel,tap=g.handleTap;
 let factory=null,page=0,selected=0,gesture=null,ghost=null,gray=null,loading=false,retry=0;
 const normal={x:0,y:-58,facing:1,facingV:1,moving:false,sideways:false,superActive:()=>false};
 const active=()=>offline()&&!runtime.hidden&&!g.player?.dead&&!g.roundStarting&&!g.rotationInputBlocked398?.()&&['prep','hunt'].includes(g.state)&&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.demonPanel&&!g.relicPanel&&!g.allyDataPanel&&g.selectedBuilding?.type==='robotFactory'&&!g.selectedBuilding.dead&&g.selectedBuilding.ownerSlot==null;
 const unlocked=()=>offline()&&!g.tutorial&&!g.superChallenge580&&g.player?.ghostElf===true&&!g.player.dead;
 const owned=b=>offline()&&['prep','hunt'].includes(g.state)&&!g.player?.dead&&b?.type==='robotFactory'&&!b.dead&&b.ownerSlot==null&&g.buildings.includes(b);
 const price=model=>model==='ghost'?GHOST_PRICE:STOCK_PRICE;
 const findModel=(b,model)=>{
  if(!owned(b))return null;
  let result=null,best=260**2;
  for(const t of g.tanks){if(t.dead||!(Number.isFinite(t.hp)&&t.hp>0)||!t.isRobot||t.ownerSlot!=null||!!t.ghostMechBN===(model==='ghost'))continue;
   const d=(t.x-b.x)**2+(t.y-b.y)**2;if(d<best){result=t;best=d;}}
  return result;
 };
 const busy=t=>!!(t.superTimer>0||t.flameTimer>0||g.ghostRelocateBN?.busy?.(t)||g.ghostCopyBN?.busy?.(t));
 function trySwap(b,model,t){
  if(!t||model!=='stock'&&model!=='ghost'||!owned(b)||model==='ghost'&&!unlocked()||!g.robotUnlocked()||findModel(b,model)!==t)return false;
  if(busy(t)){g.showToast('技能仍在施放，请结束后再改造');return false;}
  if(g.guidedRepairMission399?.()?.vehicle===t){g.showToast('请先在基地完成坦克维修，再改造');return false;}
  if(model==='stock'&&g.ghostFlightGroundAtBN?.(t)===false){g.showToast('请先把幽灵机器人开到空地再改回普通机型');return false;}
  const p=price(model),elf=g.player;
  if(!(elf.wood>=p.wood&&elf.gold>=p.gold)){g.showToast(`改造需要 木${p.wood} 金${p.gold}`);return false;}
  // Same entity: skills, tow links, attachments, armor, HP ratio and assists stay intact.
  elf.wood-=p.wood;elf.gold-=p.gold;t.ghostMechBN=model==='ghost';
  g.clearUnitNavigation?.(t);t.terrainClearDistance411=0;t.terrainEscape=null;
  t.hp=Math.max(0,Math.min(t.hp,t.maxHp));g.showToast(t.ghostMechBN?'已改造成幽灵机器人':'已改回普通机器人');
  return true;
 }
 function sync(){const b=active()?g.selectedBuilding:null;if(factory!==b){factory=b;page=0;selected=0;gesture=null;}if(!unlocked())selected=0;return !!b;}
 g.handleTap=function(...a){try{return tap.apply(this,a);}finally{sync();}};
 function layout(l){
  const b=l?.robotFactoryBtn;if(!b)return null;
  const wide=l.w>450,w=wide?Math.min(264,l.w*.49):b.w;
  const h=wide?Math.min(139,b.y-l.y-61):122+(l.modelExtraBN||0);
  if(h<95)return null;
  return {x:wide?l.x+l.w-w-12:b.x,y:b.y-h-19,w,h,wide,size:(w-10)/2,step:w+10};
 }
 g.getUpgradePanelLayout=function(...a){
  let l=baseLayout.apply(this,a);
  if(!active()||!l.robotFactoryBtn)return l;
  sync();
  if(l.w<=450){
   const dy=Math.min(55,Math.max(0,(runtime.viewport?.().height||0)-l.y-l.h-8));
   const shift=r=>r&&({...r,y:r.y+dy});
   l={...l,modelExtraBN:dy,h:l.h+dy,robotFactoryBtn:shift(l.robotFactoryBtn),upgradeBtn:shift(l.upgradeBtn),sellBtn:shift(l.sellBtn),closeBtn:shift(l.closeBtn)};
  }
  const f=layout(l),p=price(selected?'ghost':'stock'),width=f?f.x-l.x-20:l.w-24;
  l.modelStripBN=!!f;
  return {...l,content395:l.content395?.map(q=>({...q,text:q.text.startsWith('改造费')?`改造费 木${p.wood} 金${p.gold}`:q.text,...(f?.wide&&q.y<=52?{}:f?.wide?{maxWidth420:width}:{})}))};
 };
 function warm(){
  if(ghost||loading||!Image||!loadPackage||runtime.hidden||Date.now()<retry)return;
  loading=true;const done=()=>{loading=false;retry=Date.now()+5000;};
  const task=setTimeout(done,10000);
  Promise.resolve().then(loadPackage).then(()=>{
   const pic=new Image();
   pic.onload=()=>{clearTimeout(task);if(pic.width===268&&pic.height===264){ghost=pic;makeGray();}done();runtime.wake?.();};
   pic.onerror=()=>{clearTimeout(task);done();};
   pic.src='factory-model-art/ghost-models.webp.bin';
  }).catch(()=>{clearTimeout(task);done();});
 }
 function makeGray(){
  const canvas=makeCanvas?.();if(!canvas)return;
  try{
   canvas.width=180;canvas.height=176;
   const c=canvas.getContext('2d');c.drawImage(ghost,0,0,180,176,0,0,180,176);
   const im=c.getImageData(0,0,180,176),d=im.data;
   for(let i=0;i<d.length;i+=4){const y=Math.round((d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722)*.70);d[i]=d[i+1]=d[i+2]=y;}
   c.putImageData(im,0,0);gray=canvas;
  }catch(_){}
 }
 function drawIcon(c,id,variant,x,y,w){
  if(!variant)return false;
  const index=ghosts.indexOf(id);if(index<0)return false;
  if(!ghost)warm();
  if(ghost){const [sx,sy]=sourceSlots[index];c.save();c.beginPath();c.arc(x+w/2,y+w/2,w/2,0,Math.PI*2);c.clip();c.drawImage(ghost,sx,sy,88,88,x,y,w,w);c.restore();}
  else{c.save();c.beginPath();c.arc(x+w/2,y+w/2,w/2,0,Math.PI*2);c.fillStyle='#4b325e';c.fill();text(c,['传','火','影'][index],x+w/2,y+w/2,w*.40,'#e5c9fa',true);c.restore();}
  return true;
 }
 function rr(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
 }
 function text(c,s,x,y,n,color,bold=false){c.font=(bold?'bold ':'')+n+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.fillText(runtime.nativeText?.(s)??s,x,y);}
 function lock(c,x,y){
  c.beginPath();c.arc(x,y,11,0,Math.PI*2);c.fillStyle='#1b2323';c.fill();
  c.beginPath();c.moveTo(x-3,y);c.lineTo(x-3,y-2);c.arc(x,y-2,3,Math.PI,Math.PI*2);c.lineTo(x+3,y);c.strokeStyle='#cbd0cb';c.lineWidth=1.6;c.stroke();
  rr(c,x-5,y,10,7,1.5);c.fillStyle='#cbd0cb';c.fill();
 }
 function tile(c,f,x,n){
  const {y,h,size:w}=f,cx=x+w/2,locked=n>=2||n===1&&!unlocked(),chosen=n===selected,body=Math.min(f.wide?62:73,h-74),floor=y+body+7;
  rr(c,x,y,w,h,9);c.fillStyle=locked?'#303c39':chosen?'#234940':'#263d37';c.fill();c.lineWidth=chosen?1.7:1;c.strokeStyle=locked?'#596661':chosen?'#a8e8bd':'#638274';c.stroke();
  if(n>=2)text(c,'?',cx,y+body*.52+8,Math.min(46,body*.8),'#a4aaa6',true);
  else if(n===0){
   const s=body/117;c.save();c.translate(cx,floor);c.scale(s,s);
   try{art()?.character?.(c,normal,3,1);}finally{c.restore();}
  }else if(ghost&&(!locked||gray)){
   const w=180*body/176;
   c.imageSmoothingEnabled=true;c.drawImage(locked?gray:ghost,0,0,180,176,cx-w/2,floor-body,w,body);
  }
  if(locked)lock(c,x+w-19,y+19);
  if(n<2){
   const radius=f.wide?10:14,at=y+h-(f.wide?40:53),font=f.wide?8:10;
   text(c,n?'幽灵机器人':'普通机器人',cx,floor+(f.wide?10:13),f.wide?10:14,locked?'#b4bbb5':'#eef6e8',true);
   const std=skills?.();
   for(let j=0;j<3;j++){
    const x0=x+w*(j+.5)/3;
    c.save();c.globalAlpha=locked?.40:1;
    if(n)drawIcon(c,ghosts[j],true,x0-radius,at-radius,radius*2);
    else if(std){const k=j+3;c.drawImage(std,k%5*192,Math.floor(k/5)*192,192,192,x0-radius,at-radius,radius*2,radius*2);}
    c.restore();
    text(c,activeLabels[n][j],x0,at+radius+(f.wide?7:8),font,locked?'#adb6ac':'#edf8ea',true);
   }
  }
  text(c,locked?n===1?'幽灵转职后解锁':'未解锁':chosen?'当前选择':'点此选择',cx,y+h-10,f.wide?9:11,locked?'#c4cbc0':chosen?'#a8e8bd':'#c4cbc0');
 }
 function paint(c,f){
  c.save();
  try{
   const {x,y,w,h,size,step}=f;
   const shift=gesture?.horizontal&&gesture.distance>12?Math.max(-step,Math.min(step,gesture.dx)):0;
   const offset=Math.max(0,Math.min(step,page*step-shift));
   c.save();c.beginPath();c.rect(x-1,y-1,w+2,h+2);c.clip();
   try{for(let n=0;n<4;n++){const left=x+Math.floor(n/2)*step+(n%2)*(size+10)-offset;if(left<x+w&&left+size>x)tile(c,f,left,n);}}finally{c.restore();}
   const mid=x+w/2,sy=y+h+8;
   text(c,'‹',mid-71,sy,12,page?'#c6efd5':'#71897b',true);text(c,'›',mid+71,sy,12,page?'#71897b':'#c6efd5',true);
   text(c,'左右滑动查看更多',mid-12,sy,10,'#b6cec0');
   for(let i=0;i<2;i++){c.beginPath();c.arc(mid+43+i*9,sy,2.4,0,Math.PI*2);c.fillStyle=i===page?'#c6efd5':'#71897b';c.fill();}
  }finally{c.restore();}
 }
 g.drawUpgradePanel=function(...args){
  const result=draw.apply(this,args);
  if(sync()){
   const l=this.getUpgradePanelLayout(),f=l.modelStripBN&&layout(l);if(f){paint(this.ctx,f);warm();}
  }
  return result;
 };
 function down(x,y){
  if(!sync())return false;
  const l=g.getUpgradePanelLayout(),f=l.modelStripBN&&layout(l);
  if(!f||x<f.x||x>=f.x+f.w||y<f.y||y>=f.y+f.h+15)return false;
  gesture={x,y,dx:0,dy:0,distance:0,horizontal:false,factory,f};return true;
 }
 function move(x,y){
  if(!sync()||!gesture)return false;
  const p=gesture;p.dx=x-p.x;p.dy=y-p.y;p.distance=Math.max(p.distance,Math.hypot(p.dx,p.dy));
  const horizontal=Math.abs(p.dx)>1.3*Math.abs(p.dy);p.horizontal=horizontal;runtime.wake?.();return true;
 }
 function end(){
  const p=gesture;if(!p)return false;gesture=null;
  if(sync()&&p.factory===factory){
   if(p.horizontal&&Math.abs(p.dx)>=34)page=Math.max(0,Math.min(1,page-Math.sign(p.dx)));
   else if(page===0&&p.distance<=12&&p.y<p.f.y+p.f.h){
    const rel=p.x-p.f.x;if(rel<p.f.size)selected=0;
    else if(rel>=p.f.size+10&&unlocked())selected=1;
   }
   runtime.wake?.();
  }
  return true;
 }
 g.factoryModelsBN={down,move,end,cancel(){gesture=null;},unlocked,owned,price,findModel,trySwap,drawIcon,
  pick(b){return sync()&&b===factory&&selected===1?'ghost':'stock';},
  warm,drawGhostBody(c,x,y,h){if(!ghost){warm();return false;}const w=h*180/176;c.drawImage(ghost,0,0,180,176,x-w/2,y-h,w,h);return true;},artReady:()=>!!ghost};
}
module.exports={install};
