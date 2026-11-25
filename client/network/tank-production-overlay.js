'use strict';
// Read-only presentation of the native paid order. No wall-clock prediction,
// extra timers, queue mutation, manufacture override or production-speed change.
const WIDTH=86,HEIGHT=28;
function duration(factory){return Math.max(9000,20000-((factory.level||1)-1)*4500);}
function state(game,factory,{offline=true}={}){
 if(!factory||factory.dead||!['prep','hunt'].includes(game.state))return null;
 if(factory.type==='robotFactory'){
  const order=factory.robotOrderPF;if(!offline||!order||order.tank.dead||game.player.dead)return null;
  const total=20000,elapsed=total-order.left;
  return {total,elapsed,ratio:elapsed/total,remaining:Math.ceil(order.left/1000),status:game.sessionMenuOpen||game.demonPanel?'已暂停':'生产中',title:'机器人生产中'};
 }
 if(factory.type!=='tankFactory'||!factory.tankOrder)return null;
 const total=duration(factory),elapsed=Math.max(0,Math.min(total,Number(factory.tankProduceTimer)||0));
 const slot=factory.ownerSlot??null,occupied=(game.tanks||[]).some(t=>!t.dead&&(!t.isRobot||slot===null)&&(t.ownerSlot??null)===slot);
 const paused=offline&&!!(game.sessionMenuOpen||game.demonPanel||(['walls','earlyWalls'].includes(game.shareRescueOffer?.()?.kind)&&!game.deathSpectatorMode587?.()));
 return{total,elapsed,ratio:occupied?0:elapsed/total,remaining:Math.ceil((occupied?total:total-elapsed)/1000),status:occupied?'等待载具名额':paused?'已暂停':'生产中'};
}
function paint(ctx,box,s,text=x=>x){
 ctx.save();try{ctx.translate(box.cx,box.y);ctx.scale(box.scale,box.scale);ctx.globalAlpha=1;ctx.lineWidth=1;
 const x=-WIDTH/2;
 ctx.beginPath();ctx.moveTo(x+4,0);ctx.lineTo(x+WIDTH-4,0);ctx.quadraticCurveTo(x+WIDTH,0,x+WIDTH,4);ctx.lineTo(x+WIDTH,HEIGHT-4);ctx.quadraticCurveTo(x+WIDTH,HEIGHT,x+WIDTH-4,HEIGHT);ctx.lineTo(x+4,HEIGHT);ctx.quadraticCurveTo(x,HEIGHT,x,HEIGHT-4);ctx.lineTo(x,4);ctx.quadraticCurveTo(x,0,x+4,0);ctx.closePath();
 ctx.fillStyle='rgba(9,14,13,.53)';ctx.fill();ctx.strokeStyle='rgba(230,193,105,.23)';ctx.stroke();
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 9px sans-serif';
 ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=2;ctx.fillStyle='#FFE7A3';ctx.fillText(text(s.title||'坦克生产中'),0,6,WIDTH-9);ctx.shadowBlur=0;
 ctx.fillStyle='rgba(15,17,14,.56)';ctx.fillRect(x+7,12,WIDTH-14,3);ctx.fillStyle='#E9BD56';ctx.fillRect(x+7,12,(WIDTH-14)*s.ratio,3);
 ctx.font='9px sans-serif';ctx.fillStyle='#FFF0C7';ctx.shadowBlur=2;ctx.fillText(text(s.status==='生产中'?`剩余 ${s.remaining} 秒`:s.status==='已暂停'?`已暂停 · 剩余 ${s.remaining} 秒`:s.status),0,22,WIDTH-8);
 }finally{ctx.restore();}
}
function install(game,{art=()=>null,text=x=>x,offline=()=>true}={}){
 if(game.tankProductionOverlayBI)return game.tankProductionOverlayBI;
 let lastArray=null,lastLength=-1,factories=[];const original=game.drawBuildingStatus;
 const api={robotEnabled:()=>offline()&&!game.tutorial&&!game.superChallenge580,state:b=>state(game,b,{offline:offline()}),draw(ctx,x,y,w,h,z){
  // Cache only factory references; reads are O(factory count), not O(all buildings)
  // on every frame. Dead/cancelled/completed orders are checked at draw time.
  if(lastArray!==game.buildings||lastLength!==game.buildings.length){lastArray=game.buildings;lastLength=lastArray.length;factories=lastArray.filter(b=>b.type==='tankFactory'||b.type==='robotFactory');}
  let count=0;const scale=1/Math.max(.5,Math.min(1.25,z||1));
  for(const b of factories){const s=api.state(b);if(!s)continue;const layout=art()?.buildingLayout?.(b),artHeight=layout?(layout.visibleH||layout.h):Math.max(110,(b.radius||40)*2.5);const top=b.y+26-artHeight;
   const box={cx:b.x,y:Math.min(top-8,b.y-(b.radius||40)-38)-HEIGHT*scale,scale};
   if(b.x+WIDTH*scale/2<x||b.x-WIDTH*scale/2>x+w||box.y+HEIGHT*scale<y||box.y>y+h)continue;
   // HUD wins: never leave a partly obscured title behind the minimap or
   // resource/FPS header. The card keeps its factory anchor, not a HUD slot.
   const camera=game.camera,geometry=game.hudGeometry504?.();
   if(camera){const screen={x:(box.cx-WIDTH*scale/2-camera.x)*z,y:(box.y-camera.y)*z,w:WIDTH*scale*z,h:HEIGHT*scale*z},map=game.getMinimapRect?.();
    if(Number.isFinite(geometry?.bottom)&&screen.y<geometry.bottom+26)continue;
    if(map&&screen.x<map.x+map.w&&screen.x+screen.w>map.x&&screen.y<map.y+map.h&&screen.y+screen.h>map.y)continue;
   }
   paint(ctx,box,s,text);count++;
  }return count;
 }};
 game.drawBuildingStatus=function(ctx,x,y,w,h,z,...args){const result=original.call(this,ctx,x,y,w,h,z,...args);api.draw(ctx,x,y,w,h,z);return result;};
 Object.defineProperty(game,'tankProductionOverlayBI',{value:api,configurable:true});return api;
}
module.exports={install,state,duration,paint,WIDTH,HEIGHT};
