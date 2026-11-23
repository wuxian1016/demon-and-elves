'use strict';
// One fixed arrow shape, 60 translation states. No shape scaling/morphing or outline.
const STATES=Object.freeze(Array.from({length:60},(_,i)=>7*(1-Math.cos(i/60*Math.PI*2))/2));
const SHAPE=Object.freeze([[-5,-27],[5,-27],[5,-12],[13,-12],[0,0],[-13,-12],[-5,-12]]);
function draw(ctx,{tipX,tipY,direction='down',angle=null,color='green',timeMs=0,scale=1,travel=1}){
 const vectors={down:[0,1],up:[0,-1],left:[-1,0],right:[1,0]},v=Number.isFinite(angle)?[Math.cos(angle),Math.sin(angle)]:(vectors[direction]||vectors.down),offset=STATES[Math.floor(Math.max(0,timeMs)/900*60)%60]*scale*travel,x=tipX+v[0]*offset,y=tipY+v[1]*offset;
 const map=([px,py])=>[x+(-v[1]*-px+v[0]*py)*scale,y+(v[0]*-px+v[1]*py)*scale],pts=SHAPE.map(map),tail=[x-v[0]*27*scale,y-v[1]*27*scale];
 ctx.save();ctx.globalAlpha=1;const fill=ctx.createLinearGradient(x,y,tail[0],tail[1]);const rgb=color==='red'?'255,90,90':'96,255,146';fill.addColorStop(0,'rgba('+rgb+',1)');fill.addColorStop(.4,'rgba('+rgb+',0.94)');fill.addColorStop(1,'rgba('+rgb+',0.25)');ctx.fillStyle=fill;ctx.beginPath();
 for(let i=0;i<pts.length;i++){const prev=pts[(i+pts.length-1)%pts.length],p=pts[i],next=pts[(i+1)%pts.length],a=Math.hypot(p[0]-prev[0],p[1]-prev[1]),b=Math.hypot(next[0]-p[0],next[1]-p[1]),r=Math.min(1.1*scale,a/3,b/3),q=[p[0]+(prev[0]-p[0])*r/a,p[1]+(prev[1]-p[1])*r/a],z=[p[0]+(next[0]-p[0])*r/b,p[1]+(next[1]-p[1])*r/b];if(i===0)ctx.moveTo(...q);else ctx.lineTo(...q);ctx.quadraticCurveTo(p[0],p[1],z[0],z[1]);}ctx.closePath();ctx.fill();ctx.restore();return{tipX:x,tipY:y,direction};
}
module.exports={draw,STATES};
