'use strict';
const {overlaps}=require('./attack-warning-avoidance');
const TAU=Math.PI*2;
function pose(g,zone){
 if(!zone||![zone.x,zone.y,zone.gateX,zone.gateY].every(Number.isFinite))return null;
 const dx=zone.x-zone.gateX,dy=zone.y-zone.gateY,len=Math.hypot(dx,dy)||1,ix=dx/len,iy=dy/len;
 // Use the gate center, never the first remaining unbuilt wall.
 const x=zone.gateX-ix*175,y=zone.gateY-iy*175;
 const seconds=Number.isFinite(g.waveElapsed)?g.waveElapsed:0,phase=((seconds%1.8)+1.8)%1.8/1.8;
 return{x,y,ix,iy,angle:Math.atan2(iy,ix)-Math.PI/2,phase,shine:.5+.5*Math.sin(phase*TAU),box:{x:x-110,y:y-112,w:220,h:112+Math.max(-96*iy,50*iy)+40*Math.abs(ix)}};
}
function canDraw(g,p,{viewport,art}){
 const z=g.zoom()||1,c=g.camera,v=viewport(),screen={x:(p.box.x-c.x)*z,y:(p.box.y-c.y)*z,w:p.box.w*z,h:p.box.h*z};
 if(screen.x+screen.w<0||screen.x>v.width||screen.y+screen.h<0||screen.y>(v.height||v.fullHeight))return false;
 // HUD is painted after world guides. It may mask this world arrow but the
 // arrow can never cover HUD; transient toasts must not toggle its body.
 const obstacles=g.attackWarningAvoidanceAZ?.hostileRects?.()||[];
 if(obstacles.some(r=>overlaps(screen,r,8)))return false;
 for(const b of g.buildings||[]){if(b.dead)continue;const l=art()?.buildingLayout?.(b),r=Math.max(48,b.radius||48),w=l?(l.visibleW||l.w):2*r+32,h=l?(l.visibleH||l.h):Math.max(180,r*2.8);
  if(overlaps(p.box,{x:b.x-w/2,y:b.y+26-h,w,h},12))return false;}
 return true;
}
function path(c){c.beginPath();c.moveTo(-13,-36);c.lineTo(13,-36);c.lineTo(13,-3);c.lineTo(32,-3);c.lineTo(0,43);c.lineTo(-32,-3);c.lineTo(-13,-3);c.closePath();}
function paint(c,p,text=x=>x,label=true){
 require('./resource-guidance-arrow').draw(c,{tipX:p.x+p.ix*43,tipY:p.y+p.iy*43,angle:Math.atan2(p.iy,p.ix),color:'red',scale:2.4,travel:.4,timeMs:p.phase*1800});
 if(!label)return;
 c.save();try{const x=p.x-78,y=p.y-111;c.globalAlpha=.68;c.fillStyle='#511F20';c.fillRect(x,y,156,30);c.globalAlpha=.94;c.fillStyle='#FFE6E3';c.font='bold 18px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text('敌人进攻方向'),p.x,y+15,145);}finally{c.restore();}
}
function install(g,{viewport=()=>({width:393,height:852}),art=()=>null,text=x=>x}={}){
 if(g.attackDirectionArrowBH)return g.attackDirectionArrowBH;
 const api={pose:zone=>pose(g,zone),draw(ctx,zone){const p=pose(g,zone);if(!p||!canDraw(g,p,{viewport,art}))return false;const z=g.zoom()||1,c=g.camera,v=viewport(),hud=g.topHudLayout?.(),labelBox={x:(p.x-78-c.x)*z,y:(p.y-111-c.y)*z,w:156*z,h:30*z};const label=![g.getMinimapRect?.(),g.toastRect,hud&&{x:0,y:0,w:v.width,h:hud.bottom}].filter(Boolean).some(r=>overlaps(labelBox,r,6));paint(ctx,p,text,label);return true;}};
 g.drawAttackDirectionArrowBH=(ctx,zone)=>api.draw(ctx,zone);
 const guides=g.drawDefenseRecommendationGuides;
 if(guides)g.drawDefenseRecommendationGuides=function(ctx,spots=this.defenseRecommendationSpots()){
  const type=this.placement?.type;
  if(!spots?.length&&(type==='wall'||type&&this.isDefenseGuideTowerType(type))){
   const zone=this.resourceZones?.[this.buildRecommendationZoneIndexBN?.()??this.playerStartZoneIndex];
   return this.drawAttackDirectionArrowBH(ctx,zone);
  }
  return guides.call(this,ctx,spots);
 };
 Object.defineProperty(g,'attackDirectionArrowBH',{value:api,configurable:true});return api;
}
module.exports={install,pose,canDraw,paint};
