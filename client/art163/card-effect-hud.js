'use strict';

// Read-only overlay. The card core owns start, end, pause, and restore.
const TYPES=Object.freeze({
 fury:['攻击','#ff888d'],fortress:['防御','#ffdb79'],harvest:['采集','#77e6a1'],
 sanctuary:['护罩','#8cd9ff'],storm:['雷暴','#d6a7ff'],
});
function overlaps(x,y,w,h,r){return r&&x<r.x+r.w+4&&x+w+4>r.x&&y<r.y+r.h+4&&y+h+4>r.y;}
function place(out,n,v,g,minimap,avoid,dockTop){
 const H=v.fullHeight||v.height,left=Math.max(v.safeLeft||0,g.resource.x)+4;
 const right=Math.min(v.width-(v.safeRight||0)-8,minimap?minimap.x-7:Infinity);
 if(right-left<69)return false;
 const row=23,gap=5,pref=g.land?90:84,available=right-left;
 const cols=Math.max(1,Math.min(n,Math.floor((available+gap)/(pref+gap))));
 const cw=Math.min(pref,Math.floor((available-gap*(cols-1))/cols));
 const width=cols*cw+(cols-1)*gap,height=Math.ceil(n/cols)*(row+gap)-gap;
 let y=Math.max(v.safeTop||0,g.resource.y+g.resource.h+6,g.land?(g.timerY||0)+16:0);
 const limit=Math.min(H-(v.safeBottom||0)-10,Number.isFinite(dockTop)?dockTop-7:Infinity);
 for(let pass=0;pass<=avoid.length;pass++){
  let retryAt=y;
  for(const r of avoid)if(overlaps(left,y,width,height,r))retryAt=Math.max(retryAt,r.y+r.h+5);
  if(retryAt===y)break;
  y=retryAt;
 }
 if(y+height>limit)return false;
 out.x=left;out.y=y;out.cols=cols;out.cw=cw;out.gap=gap;out.row=row;out.w=width;out.h=height;return true;
}
function create(nativeText=String){
 let shown=false;const rect={x:0,y:0,w:0,h:0,cols:0,cw:0,gap:0,row:0},rows=[],typeData=Object.create(null);
 for(const type of Object.keys(TYPES))typeData[type]={label:nativeText(TYPES[type][0]),color:TYPES[type][1],sec:-1,time:'',ratio:0};
 function draw(c,canvas,v,g,minimap,avoid,dockTop,core){
  shown=false;const state=core?.state;if(!state?.effects.length||!core.authority())return false;
  let n=0;
  for(const e of state.effects){
   const style=typeData[e.type],remaining=e.ends-state.time;if(!style||!(remaining>0))continue;
   const sec=Math.ceil(remaining/1000);
   if(style.sec!==sec){style.sec=sec;style.time=nativeText(String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0'));}
   style.ratio=Math.max(0,Math.min(1,remaining/(e.ends-e.starts)));rows[n++]=style;
  }
  rows.length=n;
  if(!n||!c||!canvas||!place(rect,n,v,g,minimap,avoid,dockTop))return false;
  const {x,y,cols,cw,gap,row}=rect;
  c.save();
  try{
   c.setTransform(canvas.width/v.width,0,0,canvas.height/(v.fullHeight||v.height),0,0);c.globalAlpha=1;
   c.font='bold 11px sans-serif';c.textBaseline='middle';
   for(let i=0;i<n;i++){
    const s=rows[i],a=x+(i%cols)*(cw+gap),b=y+Math.floor(i/cols)*(row+gap);
    c.fillStyle='rgba(8,21,17,.92)';c.fillRect(a,b,cw,row);
    c.fillStyle=s.color;c.fillRect(a+6,b+6,4,9);
    c.fillStyle='#f6f4de';c.textAlign='left';c.fillText(s.label,a+14,b+10,cw-50);
    c.textAlign='right';c.fillText(s.time,a+cw-6,b+10,34);
    c.fillStyle='rgba(245,244,222,.18)';c.fillRect(a+6,b+18,cw-12,2);
    c.fillStyle=s.color;c.fillRect(a+6,b+18,(cw-12)*s.ratio,2);
   }
  }finally{c.restore();}
  shown=true;return true;
 }
 return{draw,rect:()=>shown?rect:null,clear:()=>{shown=false;}};
}
module.exports={create,place};
