'use strict';
// Injection requires the confirmed real card artwork, native buttons and coordinates.
// No scene manipulation, no new art, and no production auto-install before visual review.
function create({createCardInteraction,game,controller,view,clock,artReady=()=>true,warmGhost,drawFullCard,drawButton,screenToWorld}){
 if(typeof drawFullCard!=='function'||typeof drawButton!=='function'||typeof screenToWorld!=='function')throw Error('Native card presentation dependencies missing');
 let visibleIds=controller.core.state.hand.map(c=>c.id),queue=[];const g=game;
 const refresh=()=>{const v=view(),j=g.getJoystickRect(),hud=g.topHudLayout?.();Object.assign(options,{width:v.width,height:v.height,scale:v.width/552,safe:g.uiSafeRect396?.(),hudBottom:v.width>v.height?Math.max(hud?.bottom||0,(hud?.timer||0)+11):hud?.bottom,joystickX:j?.x??v.width*.16,joystickTop:j?j.y-j.r:v.height*.8});};
 const options={ghostReveal:require('./ghost-card-reveal'),guideMode:()=>g.easyOnboardingBN?.scope?.()===true,hand:controller.core.state.hand.map(c=>c.type),drawFullCard,drawButton,getCharges:i=>controller.core.state.hand.find(c=>c.id===visibleIds[i])?.uses||0,
  getAimRadius:()=>(controller.core.storm?.radius||0)*(g.zoom?.()||1),
  onSelect:type=>{if(type==='storm')g.cardVisuals?.warmStorm();},
  onAwardCollected:()=>{const next=queue.shift();if(next)visibleIds.push(next.id);},
  onDiscardGhost(index){const result=controller.discardGhost({owner:controller.core.state.owner,sequence:controller.core.state.lastCommand+1,cardId:visibleIds[index],confirmed:true});if(result.ok)visibleIds.splice(index,1);return result;},
  onConfirmUse(type,index,point,origin){const wasGhost=g.player?.ghostElf===true,cardId=visibleIds[index],area=point?screenToWorld(point):undefined;const result=controller.use({owner:controller.core.state.owner,sequence:controller.core.state.lastCommand+1,cardId,confirmed:true,area});if(result.ok){if(type==='ghost'&&!wasGhost&&g.player?.ghostElf&&origin)g.approvedGuideEventBN?.('role',origin);g.easyOnboardingBN?.noteCardUse?.(type);if(result.remaining===0)visibleIds.splice(index,1);}if(!result.ok)g.showToast?.({ 'storm-balance-pending':'当前模式尚不支持雷暴','invalid-area':'请选择地图内的区域','stacking-policy-pending':'上一轮技能还未结束','fortress-hp-policy-pending':'血量恢复规则待确认'}[result.reason]||'暂时无法使用');return result;}};
 refresh();const ui=createCardInteraction(options);
 const active=()=>artReady()&&controller.core.authority()&&(typeof g.joystickAvailable==='function'?!!g.joystickAvailable():!!g.getJoystickRect())&&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.demonPanel&&!g.relicPanel&&!g.ceremony;
 function tick(){refresh();ui.tick(clock());if(queue.length&&!ui.state.award){if(queue[0].type==='storm')g.cardVisuals?.warmStorm();ui.beginAward(queue[0].type,clock());}}
 function restore(){visibleIds=controller.core.state.hand.map(c=>c.id);queue=[];ui.state.hand=controller.core.state.hand.map(c=>c.type);ui.clearAward();ui.state.selected=0;ui.state.tween=null;ui.state.poses=[];ui.collapse(clock());if(ui.state.hand.includes('storm'))g.cardVisuals?.warmStorm();}
 const api={ui,restore,guideControl(id){if(!active())return null;const ix=id===undefined?undefined:visibleIds.indexOf(id);return ix===-1?null:ui.guideControl(ix);},onEvent(e){
  if(e.kind!=='award')return;
  if(e.replacedCardId){
   const visible=visibleIds.indexOf(e.replacedCardId);
   if(visible>=0){visibleIds.splice(visible,1);ui.removeOwnedCard(visible,clock());}
   else {
    const queued=queue.findIndex(c=>c.id===e.replacedCardId);
    if(queued>=0){queue.splice(queued,1);if(queued===0)ui.clearAward();}
   }
  }
  if(e.quickCollect===true&&!queue.some(c=>c.type==='ghost')){
   // Existing queued cards remain ordered before the new ones. Nothing takes
   // focus, adds a touch target, or starts a center-screen flight.
   const now=clock();
   ui.clearAward();
   for(const next of [...queue,e.card])if(ui.collectAwardQuick(next.type,now))visibleIds.push(next.id);
   queue=[];
   return;
  }
  queue.push(e.card);
 if(e.card.type==='ghost'){warmGhost?.();if(active())tick();}
 },modal(){return active()&&ui.state.award==='ghost';},suspend(){ui.suspendGhost();},draw(ctx){if(!active())return;tick();ui.draw(ctx,clock());},touch(x,y){if(!active())return false;tick();return ui.pointerDown(x,y,clock());},aimTicket(){return active()?ui.state.aim:null;},castAim(x,y,ticket){return active()&&ui.castAim({x,y},ticket,clock());},blocksDock(){return active()&&(ui.state.open||!!ui.state.aim||ui.state.award==='ghost');},noteActivity(){ui.noteActivity(clock());}};
 return api;
}
module.exports={create};
