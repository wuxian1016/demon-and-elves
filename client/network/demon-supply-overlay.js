'use strict';
// The original HUD supplies the normal 1.8s announcement and compact status.
// Cards are painted later than that HUD; redraw only the compact status above
// a card/menu, without extending timers or changing retreat/health state.
function installDemonSupplyOverlay(game,{runtime,text=s=>s}){
 let rect=null;const drawStatus=()=>{rect=null;
  const t=game.troll,base=game.trollBase;
  if(!['prep','hunt'].includes(game.state)||!t?.retreating||t.dead||base?.dead||!game.popupActive515?.())return false;
  const view=runtime.viewport(),W=view.width,H=view.fullHeight||view.height,top=game.topHudLayout(),safe=game.uiSafeRect396(),w=Math.min(330,safe.w-24),h=25;
  const other=game.resourceCapPreview?.criticalRect?.(),x=safe.x+(safe.w-w)/2,y=Math.max(view.safeTop||0,Math.min(H-h-8,Math.max(top.bottom+7,other?other.y+other.h+4:0)));
  const ctx=game.ctx;ctx.save();try{
   ctx.setTransform(runtime.canvas.width/W,0,0,runtime.canvas.height/H,0,0);ctx.globalAlpha=1;
   ctx.fillStyle='rgba(74,23,16,.96)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#FFAB40';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 13px sans-serif';ctx.fillStyle='#FFE0A0';
   const pct=Math.max(0,Math.min(100,Math.ceil(t.hp/Math.max(1,t.maxHp)*100)));
   ctx.fillText(text('恶魔返航补给 '+pct+'% → 100%'),x+w/2,y+h/2,w-14);
  }finally{ctx.restore();}
  rect={x,y,w,h};game.toastRect=rect;return rect;
 };
 const tap=game.handleTap;game.handleTap=function(x,y,...args){if(rect&&this.troll?.retreating&&!this.troll.dead&&x>=rect.x&&x<=rect.x+rect.w&&y>=rect.y&&y<=rect.y+rect.h)return true;return tap.call(this,x,y,...args);};
 Object.defineProperty(game,'drawDemonSupplyOverlayAD',{value:drawStatus,configurable:true});
 const original=game.draw;game.draw=function(...args){const result=original.apply(this,args);drawStatus();return result;};
 return {draw:drawStatus};
}
module.exports={installDemonSupplyOverlay};
