'use strict';
const PHASE={camera:'镜头操作',defense:'防御',economy:'经济',tech:'科技',card:'卡牌',free:'自由发展'};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const hit=(a,b,m=0)=>!!a&&!!b&&a.x<b.x+b.w+m&&a.x+a.w+m>b.x&&a.y<b.y+b.h+m&&a.y+a.h+m>b.y;
function rounded(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
// Shared A-style pointer: the tip is the coordinate given by the caller.
function guideArrow(c,x,y,angle,t,size=1,emphasis=false){
 c.save();try{
  c.translate(x,y);c.rotate(angle);c.translate((-16+(t==null?0:Math.sin(t/175)*(emphasis?1.55:2.2)))*size,0);c.scale(1.068*size,1.068*size);
    const ink=c.createLinearGradient(-18,0,17,0);ink.addColorStop(0,emphasis?'rgba(71,242,125,.78)':'rgba(57,233,120,.46)');ink.addColorStop(.63,emphasis?'#70ff98':'#64f08e');ink.addColorStop(1,emphasis?'#edffe7':'#c3ffd0');
    c.shadowColor='rgba(89,253,140,.52)';c.shadowBlur=8;c.fillStyle=ink;c.beginPath();
    c.moveTo(-15,-4);c.quadraticCurveTo(-19,-4,-19,0);c.quadraticCurveTo(-19,4,-14,4);c.lineTo(0,4);c.lineTo(0,9);c.quadraticCurveTo(0,11,3,10);c.lineTo(15,2);c.quadraticCurveTo(18,0,15,-2);c.lineTo(3,-10);c.quadraticCurveTo(0,-11,0,-9);c.lineTo(0,-4);c.closePath();if(emphasis){c.shadowBlur=0;c.strokeStyle='rgba(12,46,26,.96)';c.lineJoin='round';c.lineWidth=1.8;c.stroke();}c.fill();
 }finally{c.restore();}
}
function create(g,text,time){
 function cardRect(advice){
  const s=g.uiSafeRect396(),mm=g.getMinimapRect(),menu=g.sessionMenuRect(),top=g.topHudLayout();
  const viewport=g.resourceCapViewport?.()||{width:s.right+s.x,height:s.bottom+s.y};
  const avoid=[mm,menu,g.toastRect];
  const meter=g.singlePlayerHud627?.layout(viewport,g.hudGeometry504?.(),g.toastRect?[g.toastRect]:[]);
  if(meter)avoid.push(meter);const effects=g.cardEffectHudBN?.rect?.();if(effects)avoid.push(effects);
  // Defense alerts keep their own native priority; reserve their landscape row.
  if(s.landscape)avoid.push(g.criticalWallBannerRect?.());
  const h=advice.cardGuideBN&&advice.cardEffectBN?74:advice.detail?58:43,minWidth=132,w=Math.min(222,s.w-20);
  const x=Math.ceil(s.x+9);
  function fit(px,py,pw){
   if(pw<minWidth||px+pw>s.right-6)return null;
   const r={x:px,y:py,w:pw,h};
   for(let i=0;i<avoid.length;i++){let maxY=r.y;for(const a of avoid)if(hit(r,a,5))maxY=Math.max(maxY,a.y+a.h+6);if(maxY===r.y)break;r.y=maxY;}
   return r.y+r.h<Math.min(s.bottom-30,g.buttonAreaTop||s.bottom-72)?r:null;
  }
  const narrow=mm.x-x-9;
  const y=Math.ceil(Math.max(s.y+8,top.bottom+8));
  return fit(x,y,Math.min(w,narrow))||fit(x,Math.ceil(Math.max(y,mm.y+mm.h+8)),w);
 }
 function drawCard(c,r,a){
  c.save();try{
   const {x,y,w,h}=r;
   rounded(c,x+.5,y+.5,w-1,h-1,12);
   const ink=c.createLinearGradient(x,y,x,y+h);ink.addColorStop(0,'rgba(25,39,39,.97)');ink.addColorStop(1,'rgba(12,24,25,.97)');
   c.fillStyle=ink;c.fill();
   c.fillStyle='#9bf5c5';c.beginPath();c.arc(x+12,y+12,2.5,0,Math.PI*2);c.fill();
   c.textAlign='left';c.textBaseline='middle';
   c.fillStyle='#90ebba';c.font='bold 10px sans-serif';text(c,PHASE[a.phaseBN]||'上手引导',x+20,y+12,w-31);
   c.fillStyle='#effff6';c.font='bold 14px sans-serif';text(c,a.title,x+11,y+30,w-22);
   if(a.detail){c.fillStyle='#b2deca';c.font='11px sans-serif';text(c,a.detail,x+11,y+46,w-22);}
   if(a.cardGuideBN&&a.cardEffectBN){c.fillStyle='#aef1c8';c.font='10px sans-serif';text(c,a.cardEffectBN,x+11,y+62,w-22);}
  }finally{c.restore();}
 }
 function drawPointer(c,p,card,small=false,emphasis=false){
  const s=g.uiSafeRect396();if(!p||!(p.w>0&&p.h>0))return;
  const cx=p.x+p.w/2,cy=p.y+p.h/2,world=p.direction!==undefined;
  if(cx<s.x||cx>s.right||cy<s.y||cy>s.bottom)return;
  const mm=g.getMinimapRect(),panel=g.buildMenu?g.getBuildMenuLayout():null;
  if(panel&&!hit(panel.listRect,p)&&!(panel.pageTabs||[]).some(a=>hit(a,p)))return;
  if(!p.guideBuildingBN&&(hit(p,mm,2)||hit(p,card,2)))return;
  const compact=small?.78:1,large=small?1.18:1.48;
  const tryArrow=(angle,x,y,size=compact)=>{
   const L=41*size,half=14*size;
   const u=Math.cos(angle),v=Math.sin(angle);
   const endX=x-L*u,endY=y-L*v;
   const bounds={x:Math.min(x,endX)-Math.abs(v)*half-2,y:Math.min(y,endY)-Math.abs(u)*half-2,w:Math.abs(endX-x)+2*Math.abs(v)*half+4,h:Math.abs(endY-y)+2*Math.abs(u)*half+4};
   if(bounds.x<s.x||bounds.y<s.y||bounds.x+bounds.w>s.right||bounds.y+bounds.h>s.bottom||hit(bounds,card,3)||hit(bounds,mm,2))return false;
   guideArrow(c,x,y,angle,time(),size,emphasis);return {bounds,angle,x,y,size};
  };
  function atSize(size){
   if(world){const a=p.direction;return tryArrow(a,cx+Math.cos(a)*(p.guideSpotBN?-18:12),cy+Math.sin(a)*(p.guideSpotBN?-18:12),size);}
   // Keep the tip locked to the target's center line; shorten on tight screens, never shift to its neighbor.
   const above=()=>tryArrow(Math.PI/2,cx,p.y-5,size);
   const left=()=>tryArrow(0,p.x-5,cy,size);
   const right=()=>tryArrow(Math.PI,p.x+p.w+5,cy,size);
   const below=()=>tryArrow(-Math.PI/2,cx,p.y+p.h+5,size);
   if(p.page!==undefined)return below()||above();
   if(p.guideBuildingBN)return above()||left()||right();
   if(p.id==='placeConfirm')return left()||below()||right()||above();
   if(panel&&p.w>100)return left()||above()||right()||below();
   return above()||left()||right()||below();
  }
  if(p.guideBuildingBN){
   return (emphasis&&tryArrow(Math.PI/2,cx,p.y-5,large))||tryArrow(Math.PI/2,cx,p.y-5,compact)||
    tryArrow(0,p.x-5,cy,compact)||tryArrow(Math.PI,p.x+p.w+5,cy,compact);
  }
  return (emphasis&&atSize(large))||atSize(compact);
 }
 function action(a,p){
  if(!p)return a;
  if(a.cardEffectPanBN)return a;
  if(a.lateArrowBN)return {...a,title:a.title};
  if(a.cardGuideBN)return {...a,title:a.cardStepBN==='confirm'?'② 确认使用':'① 点「'+a.cardCueNameBN+'」卡牌'};
  if(p.guideScrollBN)return {...a,title:'滑动列表找'+g.buildingName(a.type),detail:a.towerRoleBN||a.title};
  if(p.id==='moreBuilds'||g.buildMenu&&(g.getBuildMenuLayout()?.pageTabs||[]).some(b=>b===p||b.page===p.page&&b.x===p.x&&b.y===p.y)){
   const names=['资源','防御','武器'];
   return {...a,title:p.id==='moreBuilds'?'① 点「建筑」':('② 点「'+(names[p.page]||p.text||'分类')+'」'),detail:a.towerRoleBN||a.title};
  }
  if(p.guideSpotBN)return {...a,title:'④ 点推荐位置',detail:'也可以选其他格子。'};
  if(p.id==='placeConfirm')return {...a,title:(g.placement?.guideSpotBN?'⑤ ':'④ ')+'点「确认建造」',detail:a.towerRoleBN||a.title};
  if(a.target){
   const name=g.buildingName(a.target.type);
   if(g.selectedBuilding===a.target)return {...a,title:a.tradeLessonBN?'② '+a.actionLabel:a.action==='makePeasantBtn'?'② 点「制造伐木工」':a.action==='tankFactoryBtn'?'② 点「制造坦克」':a.upgrade?'② 点「升级」':a.title,detail:a.towerRoleBN||a.title};
   if(p.guideTravelBN)return {...a,title:'拖动镜头找到'+name,detail:a.towerRoleBN||a.title};
   return {...a,title:'① 点地图上的'+name,detail:a.towerRoleBN||a.title};
  }
  if(a.type)return {...a,title:(g.buildMenu?'③ ':'')+'点「'+g.buildingName(a.type)+'」',detail:a.towerRoleBN||a.title};
  if(a.button==='collectWood'||a.button==='collectGold')return {...a,title:a.button==='collectWood'?'点「伐木」':'点「采矿」',detail:a.detail};
  return a;
 }
 function catalogFocus(a,control){
  if(!a?.onboardingBN||!a.type||!control||control.page!==undefined||control.guideScrollBN||!g.buildMenu||g.placement||g.selectedBuilding)return null;
  const L=g.getBuildMenuLayout(),list=L?.listRect,row=L?.rows?.find(v=>v.entry.type===a.type),s=g.uiSafeRect396();
  if(!row||!list||row.entry.page!==g.buildMenuPage)return null;
  const b=row.rect,x=Math.max(b.x,list.x+(L.scrollable===false?0:10),s.x),right=Math.min(b.x+b.w,list.x+list.w,s.right);
  if(b.y<Math.max(list.y,s.y)-.5||b.y+b.h>Math.min(list.y+list.h,s.bottom)+.5||right-x<120||b.h<44)return null;
  const r={x,y:b.y,w:right-x,h:b.h};
  const thumbW=Math.min(64,b.w*.24),thumbX=b.x+b.w-thumbW-8;
  const px=Math.min(right-22,Math.max(x+24,thumbX-1)),py=b.y+Math.min(27,b.h*.28);
  if(px-22<x||py-13<b.y||py+13>b.y+b.h)return null;
  // Bury the label in the target's empty title row, left of the arrow.
  // This never overlaps the FPS strip/HUD, card name, or price.
  const width=78,height=18,lx=px-29-width,ly=b.y+9;
  const label=lx>=r.x+100&&ly+height<=r.y+r.h?{x:lx,y:ly,w:width,h:height}:{w:0};
  return {r,px,py,label};
 }
 function drawCatalogFocus(c,f,a){
  const {r,px,py,label}=f,s=g.uiSafeRect396(),v=g.resourceCapViewport?.()||{width:s.right+s.x,height:s.bottom+s.y};
  c.save();try{
   // Outside-only dimming: do not alter catalog draw or touch dispatch.
   c.fillStyle=a.lateArrowBN?'rgba(7,14,18,0)':'rgba(7,14,18,.30)';
   c.fillRect(0,0,v.width,r.y);
   c.fillRect(0,r.y+r.h,v.width,Math.max(0,v.height-r.y-r.h));
   c.fillRect(0,r.y,r.x,r.h);
   c.fillRect(r.x+r.w,r.y,Math.max(0,v.width-r.x-r.w),r.h);
   guideArrow(c,px+17,py,0,time(),a.smallPointerBN?.78:1);
   if(label.w>0){
    rounded(c,label.x,label.y,label.w,label.h,9);c.fillStyle='rgba(28,38,29,.95)';c.fill();
    c.font='bold 12px sans-serif';c.fillStyle='#ffe4a4';c.textAlign='center';c.textBaseline='middle';
    text(c,'③ 点这张卡',label.x+label.w/2,label.y+label.h/2,label.w-12);
   }
  }finally{c.restore();}
 }
 function drawInlineLabel(c,r,title){
  c.save();try{
   rounded(c,r.x,r.y,r.w,r.h,9);c.fillStyle='rgba(23,32,24,.96)';c.fill();
   c.font='bold 12px sans-serif';c.fillStyle='#ffe4a4';c.textAlign='center';c.textBaseline='middle';
   text(c,title,r.x+r.w/2,r.y+r.h/2,r.w-10);
  }finally{c.restore();}
 }
 function panelLabel(c,cue,p,title){
  if(!cue||!p||!title)return;
  const s=g.uiSafeRect396(),b=cue.bounds,m=g.getMinimapRect(),w=Math.min(s.w-22,Math.max(104,14*title.length+16)),h=23;
  const q=[{x:b.x+(b.w-w)/2,y:b.y-h-5},{x:b.x+(b.w-w)/2,y:b.y+b.h+5},{x:b.x-w-6,y:b.y+(b.h-h)/2},{x:b.x+b.w+6,y:b.y+(b.h-h)/2}];
  for(const spot of q){
   const r={x:clamp(spot.x,s.x+5,s.right-w-5),y:spot.y,w,h};
   if(r.y>=Math.max(s.y+4,g.topHudLayout().bottom+3)&&r.y+h<=s.bottom-5&&!hit(r,b,2)&&!hit(r,p,2)&&!hit(r,m,3)){drawInlineLabel(c,r,title);return;}
  }
 }
 function drawDrag(c,card){
  const s=g.uiSafeRect396(),mm=g.getMinimapRect();
  const top=Math.max(s.y+44,g.topHudLayout().bottom+36,card?card.y+card.h+30:0);
  const bottom=Math.min(s.bottom-55,(g.buttonAreaTop||s.bottom-80)-27);
  if(bottom-top<45)return;
  const y=Math.round(top+(bottom-top)*.44),x=s.x+s.w*.35,length=Math.min(110,s.w*.25);
  if(hit({x:x-25,y:y-24,w:length+53,h:62},mm,4))return;
  const tick=(time()%1850)/1850,u=clamp((tick-.16)/.59,0,1),e=u*u*(3-2*u),fx=x+length*e;
  c.save();try{
   c.globalAlpha=Math.min(1,tick*12,(1-tick)*10);
   c.strokeStyle='rgba(105,255,153,.69)';c.lineWidth=2;c.lineCap='round';
   c.beginPath();c.moveTo(x,y);c.lineTo(x+length-32,y);c.stroke();
   guideArrow(c,x+length+4,y,0,null,1.30,true);
   c.translate(fx,y);
   c.beginPath();c.arc(0,0,8+4*u,0,Math.PI*2);c.strokeStyle='#caffd5';c.stroke();
   // Finger silhouette follows the swipe path without moving the actual camera.
   c.translate(6,7);c.lineWidth=1.5;c.lineJoin='round';
   c.beginPath();c.moveTo(0,10);c.lineTo(-5,-2);c.quadraticCurveTo(-7,-7,-3,-9);c.quadraticCurveTo(0,-10,2,-6);c.lineTo(7,3);c.lineTo(11,2);c.quadraticCurveTo(14,1,16,4);c.lineTo(19,5);c.quadraticCurveTo(23,5,24,10);c.lineTo(24,17);c.lineTo(20,25);c.lineTo(8,25);c.lineTo(1,19);c.lineTo(-5,13);c.quadraticCurveTo(-8,8,-4,7);c.quadraticCurveTo(-2,7,0,10);c.closePath();
   c.fillStyle='#fff8e6';c.fill();c.strokeStyle='#68552f';c.stroke();
  }finally{c.restore();}
 }
 function draw(a){
  if(!a||g.endlessOpeningIntro||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.allyDataPanel||g.relicPanel||g.ceremony||g.player?.dead)return;
  if(g.easyOpeningGuideStateBN?.tank===true&&!a.cardGuideBN&&!a.cardEffectPanBN&&!a.lateArrowBN)a={...a,lateArrowBN:true};
  const c=g.ctx,open=g.selectedBuilding||g.buildMenu||g.placement;
  let control=a.cardGuideBN?a.cardPointerBN:g.easyOpeningGuidePointer(a);
  const placement=g.placement,spot=placement?.stage==='aim'&&placement.guideSpotBN;
  if(spot&&a.type===placement.type){
   const z=g.zoom(),x=(spot.x-g.camera.x)*z,y=(spot.y-g.camera.y)*z;
   control={x:x-18,y:y-26,w:36,h:36,id:'guideSpot',guideSpotBN:true,direction:Math.PI/2};
  }
  const display=action(a,control),r=!open&&!a.lateArrowBN?cardRect(display):null;
  // Keep the next action in text even when a successfully learned button no longer flashes.
  const p=control&&g.easyOnboardingBN?.allowsPointer(a,control)!==false?control:null;
  if(r)drawCard(c,r,display);
  if(a.cameraDragBN){drawDrag(c,r);return !!r;}
  if(a.cardGuideBN||!g.cardPresentation?.blocksDock?.()){
   const catalog=catalogFocus(a,p);
   if(catalog){drawCatalogFocus(c,catalog,a);return !!a.lateArrowBN;}
   const cue=drawPointer(c,p,r,a.smallPointerBN,!open&&g.easyOnboardingBN?.scope?.()===true);
   if(!r)panelLabel(c,cue,p,a.lateArrowBN&&p?.guideTravelBN?'拖镜头找目标':display.title);
   if(a.lateArrowBN&&cue)return true;
  }
  return !!r;
 }
 return{draw,cardRect,action,catalogFocus,drawPointer};
}
module.exports={create};
