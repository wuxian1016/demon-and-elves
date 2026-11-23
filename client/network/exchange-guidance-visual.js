'use strict';
const POINTS=[[-18,-3],[-10,-3],[-10,-7],[-8,-7],[0,0],[-8,7],[-10,7],[-10,3],[-18,3]];
const clip=(n,l,h)=>Math.max(l,Math.min(h,n));
const overlaps=(a,b)=>a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function arrow(c,{x,y,angle=Math.PI/2,time=0,unit=1,hopUnit=unit}){
 const u=Math.cos(angle),v=Math.sin(angle),offset=(.5-.5*Math.cos(time/900*2*Math.PI))*3*hopUnit;
 x+=u*offset;y+=v*offset;
 c.save();try{
  const g=c.createLinearGradient(x-u*18*unit,y-v*18*unit,x,y);
  g.addColorStop(0,'rgba(54,207,147,.22)');g.addColorStop(.45,'#48d9a2');g.addColorStop(1,'#ceffe0');
  c.fillStyle=g;c.strokeStyle='rgba(6,45,36,.82)';c.lineWidth=.9*unit;c.lineJoin='round';
  function mark(d,p,side){const sx=x+(p*u-side*v)*unit,sy=y+(p*v+side*u)*unit;if(d)c.lineTo(sx,sy);else c.moveTo(sx,sy);}
  c.beginPath();for(let i=0;i<POINTS.length;i++)mark(i,POINTS[i][0],POINTS[i][1]);c.closePath();c.stroke();c.fill();
  c.strokeStyle='rgba(233,255,247,.72)';c.lineWidth=.95*unit;c.lineCap='round';c.beginPath();mark(0,-7,-2.5);mark(1,-3,0);mark(1,-7,2.5);c.stroke();
 }finally{c.restore();}
 return{x,y};
}
function path(c,x,y,w,h,r){
 c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
const compactText=a=>a.target?['兑换富余资源','可以交易木材和金矿']:a.type?['建造交易所','可以交易木材和金矿']:['先备建造资源',a.detail.match(/木\d+、金\d+/)?.[0]||'采集缺少的建造资源'];
function create(g,time){
 let cached=null;
 function card(g,a,measure){
  const S=g.uiSafeRect396(),m=g.getMinimapRect(),menu=g.sessionMenuRect(),top=g.topHudLayout().bottom;
  let x=Math.ceil(menu.x+menu.w+8),y=Math.ceil(Math.max(S.y+8,top+8)),end=Math.floor(Math.min(S.right-8,m.x-9));
  if(end-x<150){x=Math.ceil(S.x+10);y=Math.ceil(Math.max(y,menu.y+menu.h+8));}
  if(end-x<130){end=Math.floor(S.right-10);y=Math.ceil(Math.max(y,m.y+m.h+36));}
  const w=clip(end-x,104,226),[title,detail]=compactText(a),key=JSON.stringify([w,title,detail]);
  if(!cached||cached.key!==key){
   const lines=[];let line='';g.ctx.save();try{g.ctx.font='11px sans-serif';for(const char of detail){if(line&&measure(g.ctx,line+char)>w-23){lines.push(line);line='';}line+=char;}if(line)lines.push(line);}finally{g.ctx.restore();}
   cached={key,title,lines,h:57+Math.max(0,lines.length-1)*13};
  }
  const meter=g.singlePlayerHud627?.layout(g.resourceCapViewport?.()||{width:S.right+S.x,height:S.bottom+S.y},g.hudGeometry504(),[]);
  if(overlaps(meter,{x,y,w,h:cached.h}))y=Math.ceil(meter.y+meter.h+5);
  return{x,y,w,h:cached.h,title:cached.title,lines:cached.lines};
 }
 function drawCard(c,r,text){
  const {x,y,w,h}=r;c.save();try{
   path(c,x+.5,y+.5,w-1,h-1,8);c.fillStyle='rgba(7,31,28,.96)';c.fill();c.strokeStyle='rgba(88,227,167,.76)';c.lineWidth=1;c.stroke();
   c.fillStyle='rgba(104,244,187,.13)';path(c,x+8,y+7,44,14,4);c.fill();
   c.textBaseline='alphabetic';c.textAlign='left';c.font='bold 9px sans-serif';c.fillStyle='#9af4c8';text(c,'交易所',x+15,y+17,34);
   c.font='bold 12px sans-serif';c.fillStyle='#e7fff4';text(c,r.title,x+10,y+35,w-20);
   c.font='11px sans-serif';c.fillStyle='#add2c2';r.lines.forEach((line,i)=>text(c,line,x+10,y+49+i*13,w-20));
  }finally{c.restore();}
 }
 function anchor(target,z,art){
  const l=art?.buildingLayout?.(target),top=target.y+26+(l?.offsetY||0)-Math.max(l?.visibleH||0,l?.h||0);
  return{x:target.x+(l?.offsetX||0),y:Math.min(top,target.y-target.radius-28)-8/z};
 }
 function drawDetail(a,art,{text,measure}){
  const c=g.ctx,S=g.uiSafeRect396(),open=g.selectedBuilding||g.buildMenu||g.placement;
  const rect=open?null:card(g,a,measure);
  if(rect)drawCard(c,rect,text);
  if(g.selectedBuilding&&g.selectedBuilding!==a.target)return;
  if(a.target&&!open){
   const z=g.zoom(),q=g.evolveQuakeOffset(),p=anchor(a.target,z,art),x=(p.x-g.camera.x)*z+q.x,y=(p.y-g.camera.y)*z+q.y;
   const b={x:x-9,y:y-20,w:18,h:24};
   if(!overlaps(rect,b)&&!overlaps(g.getMinimapRect(),b)&&x>=S.x+10&&x<=S.right-10&&y>=g.topHudLayout().bottom+29&&y<=(g.buttonAreaTop||S.bottom-70)-7
    &&(!g.fogEnabled||g.fogStateAtWorld(a.target.x,a.target.y)===2)){
    arrow(c,{x,y,time:time()});return;
   }
  }
  const p=g.easyOpeningGuidePointer(a);
  if(!p||(!open&&a.target&&p.direction===undefined))return;
  if(g.buildMenu&&p.page===undefined){
   const layout=g.getBuildMenuLayout();
   if(!overlaps(layout.listRect,p))return;
  }
  const side=!!g.buildMenu&&p.page===undefined&&p.x>=S.x+30;
  const angle=p.direction!==undefined?p.direction:side?0:Math.PI/2;
  const x=clip(p.direction!==undefined?p.x+p.w/2+Math.cos(angle)*15:side?p.x-6:p.x+p.w/2,S.x+11,S.right-11);
  const y=clip(p.direction!==undefined?p.y+p.h/2+Math.sin(angle)*15:side?p.y+p.h/2:p.y-6,S.y+22,S.bottom-9);
  const pointedExchangeButton=g.selectedBuilding===a.target&&!!a.target&&
   (a.action==='exchangeGoldToWoodBtn'||a.action==='exchangeWoodToGoldBtn');
  if(!overlaps(rect,{x:x-11,y:y-20,w:22,h:24}))arrow(c,{x,y,angle,time:time(),unit:pointedExchangeButton?1.25:1,hopUnit:1});
 }
 return {card:(a,measure)=>card(g,a,measure),drawDetail,anchor};
}
module.exports={create,arrow};
