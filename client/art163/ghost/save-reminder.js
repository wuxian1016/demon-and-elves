'use strict';
const soft=require('./soft-hint');
// One per match; a seen flag rides existing manual saves. No automatic save.
function install(g,{offline,text}){
 if(g.saveReminderR6BN)return;
 let owner=null, shownAt=null, inMenu=false, hideForSnapshot=false, heldAt=null;
 const label='可以保存游戏', overlaps=(a,b)=>b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 function layout(){
  if(owner!==g.player){owner=g.player;shownAt=null;inMenu=false;heldAt=null;}
  const t=g.huntElapsed;
  if(g.wallHalfGuideDemo?.urgent?.()){if(heldAt===null)heldAt=t;return null;}
  if(heldAt!==null){if(shownAt!==null)shownAt+=Math.max(0,t-heldAt);heldAt=null;}
  const armed=offline()&&g.state==='hunt'&&t>=480&&!g.player.dead;
  if(!armed){inMenu=false;return null;}
  if(g.sessionMenuOpen){if(!g.saveReminderSeenR6BN&&shownAt!==null){inMenu=true;g.saveReminderSeenR6BN=true;}return null;}
  inMenu=false;
  if(g.saveReminderSeenR6BN||g.popupActive515()||g.rotationInputBlocked398()||g.cardPresentation?.modal()||g.rewardAdBN?.pausesLive?.()||g.placement||g.tutorial||g.ceremony||g.endlessOpeningIntro||g.shareRescueVisible616?.())return null;
  if(shownAt!==null&&t-shownAt>=16){g.saveReminderSeenR6BN=true;return null;}
  const menu=g.sessionMenuRect(),safe=g.uiSafeRect396();
  const box={x:Math.max(safe.x,menu.x+(menu.w-89)/2),y:menu.y+menu.h+55,w:89,h:24};
  if(overlaps(box,g.getMinimapRect?.()))return null;
  return {box,tipX:menu.x+menu.w/2,tipY:menu.y+menu.h+2};
 }
 function draw(){
  if(g.passiveHintsR13?.quiet())return;
  if(hideForSnapshot)return;
  const p=layout();
  if(!p){
   if(g.sessionMenuOpen&&inMenu&&!g.wallHalfGuideDemo?.urgent?.()&&!g.audioSettingsOpen&&!g.saveSlotsPanel&&!g.allyDataPanel&&!g.demonPanel&&!g.rewardAdBN?.pausesLive?.()&&!g.rotationInputBlocked398()){
    const b=g.sessionMenuButtons().find(b=>b.id==='save');
    if(b)soft.cardinal(g,g.ctx,{x:b.x-4,y:b.y+b.h/2,direction:'right',scale:.84});
   }
   return;
  }
  if(shownAt===null)shownAt=g.huntElapsed;
  const c=g.ctx,b=p.box;
  soft.cardinal(g,c,{x:p.tipX,y:p.tipY,direction:'up',scale:.84});
  c.save();
  const x=b.x,y=b.y,w=b.w,h=b.h,r=7;
  c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
  c.fillStyle='rgba(8,32,17,.76)';c.fill();c.lineWidth=1;c.strokeStyle='rgba(121,233,157,.72)';c.stroke();
  c.fillStyle='#E0FFE5';c.textAlign='center';c.textBaseline='middle';c.font='bold 12px sans-serif';c.fillText(text(label),x+w/2,y+h/2+.5,w-12);
  c.restore();
 }
 const oldDraw=g.drawSessionMenu,oldHit=g.sessionMenuHit;
 g.drawSessionMenu=function(...args){const result=oldDraw.apply(this,args);draw();return result;};
 g.sessionMenuHit=function(x,y){const box=layout()?.box;return !!(box&&x>=box.x&&x<=box.x+box.w&&y>=box.y&&y<=box.y+box.h)||oldHit.call(this,x,y);};
 g.saveReminderR6BN={layout,beforeMenuOpen(){
  // The existing pause menu snapshots the most recent screen. Cleanly move
  // the cue from world HUD to the actual pause panel, never show two arrows.
  if(shownAt===null||!layout())return;
  hideForSnapshot=true;try{g.draw();}finally{hideForSnapshot=false;}
 }};
}
module.exports={install};
