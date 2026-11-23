'use strict';
// Reference-style visual inset only. Cell centres,90-unit reservations, legal
// placement checks and submitted world anchors stay exactly the same.
const INSET=2,VERSION='bi-orange-wall-v1';
// The original wall row has100-unit side pitch versus103 internally.
// Inset only its side-facing edges by another1.5units so every visible slot
// retains the same17-unit opening; physical90-unit walls keep their10-unit gap.
function visibleBounds(s){const inset=Math.min(INSET,s.w/8,s.h/8),ix=inset+(s.hintWallAxis==='x'?1.5:0),iy=inset+(s.hintWallAxis==='y'?1.5:0);return{x0:s.x0+ix,x1:s.x1-ix,y0:s.y0+iy,y1:s.y1-iy,w:s.w-ix*2,h:s.h-iy*2,cx:s.cx??(s.x0+s.x1)/2,cy:s.cy??(s.y0+s.y1)/2};}
function paint(ctx,site,{chosen=false,invalid=false,occupied=false,role='normal'}={}){
 const palettes={'wall-inner':['rgba(215,94,20,.42)','rgba(234,114,28,.42)','rgba(247,139,51,.42)','rgba(246,183,112,.72)'],'wall-outer':['rgba(244,151,59,.28)','rgba(251,168,80,.28)','rgba(255,184,104,.28)','rgba(249,207,158,.70)'],defense:['rgba(232,181,35,.62)','rgba(232,181,35,.62)','rgba(232,181,35,.62)','rgba(244,204,91,.70)'],'defense-mid':['rgba(244,216,120,.32)','rgba(244,216,120,.32)','rgba(244,216,120,.32)','rgba(247,225,153,.55)'],'defense-soft':['rgba(255,241,201,.12)','rgba(255,241,201,.12)','rgba(255,241,201,.12)','rgba(255,244,211,.42)'],resource:['rgba(100,181,44,.70)','rgba(111,194,48,.70)','rgba(116,201,51,.70)','rgba(160,229,120,.66)']},palette=palettes[role];
 const s=visibleBounds(site),r=Math.min(s.w*.125,s.h*.125,12),center=invalid?'rgba(195,76,57,.38)':chosen?'rgba(255,203,42,.84)':palette?.[0]||'rgba(100,181,44,.70)',inner=invalid?'rgba(208,88,64,.40)':chosen?'rgba(255,216,62,.86)':palette?.[1]||'rgba(111,194,48,.70)',edge=invalid?'rgba(222,105,78,.42)':chosen?'rgba(255,230,103,.90)':palette?.[2]||'rgba(116,201,51,.70)';
 ctx.save();try{ctx.globalAlpha=1;const gradient=ctx.createRadialGradient?.(s.cx,s.cy,0,s.cx,s.cy,Math.hypot(s.w,s.h)/2);if(gradient?.addColorStop){gradient.addColorStop(0,center);gradient.addColorStop(.65,inner);gradient.addColorStop(1,edge);}ctx.fillStyle=gradient||center;ctx.shadowColor='rgba(0,0,0,0)';ctx.shadowBlur=0;
 ctx.beginPath();ctx.moveTo(s.x0+r,s.y0);ctx.lineTo(s.x1-r,s.y0);ctx.quadraticCurveTo(s.x1,s.y0,s.x1,s.y0+r);ctx.lineTo(s.x1,s.y1-r);ctx.quadraticCurveTo(s.x1,s.y1,s.x1-r,s.y1);ctx.lineTo(s.x0+r,s.y1);ctx.quadraticCurveTo(s.x0,s.y1,s.x0,s.y1-r);ctx.lineTo(s.x0,s.y0+r);ctx.quadraticCurveTo(s.x0,s.y0,s.x0+r,s.y0);ctx.closePath();if(!occupied)ctx.fill();
 const glow=invalid?'rgba(245,106,78,.40)':chosen?'rgba(255,211,42,.95)':palette?.[3]||'rgba(133,232,91,.43)';ctx.shadowColor=occupied?'rgba(0,0,0,0)':glow;ctx.shadowBlur=occupied?0:chosen?12:4;ctx.lineWidth=occupied?1:chosen?2.2:2;ctx.strokeStyle=occupied?'rgba(139,225,112,.38)':invalid?'rgba(244,111,86,.25)':chosen?'rgba(255,227,85,.96)':palette?.[3]||'rgba(139,225,112,.23)';ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=occupied?1:chosen?1.2:1.1;ctx.strokeStyle=occupied?'rgba(139,225,112,.38)':invalid?'rgba(245,112,86,.78)':chosen?'rgba(255,249,197,1)':palette?.[3]||'rgba(160,229,120,.66)';ctx.stroke();
 }finally{ctx.restore();}
}
module.exports={INSET,VERSION,visibleBounds,paint};
