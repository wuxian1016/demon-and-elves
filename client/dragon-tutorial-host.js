'use strict';
// Single-player teaching presentation. Never pauses or replaces an online world.
function eligible(game,offline){const t=game.troll;return offline()&&game.state==='hunt'&&!game.player?.dead&&!game.dragonTutorialSeenBL&&!game.tutorial&&!game.superChallenge580&&!game.sessionMenuOpen&&!game.roundStarting&&!game.roundLoading591&&!game.saveSlotsPanel&&!game.shareRewardPending&&!game.ceremony&&t?.dragonEvolved&&!t.dead&&Number.isFinite(t.hp)&&t.hp>0&&Number.isFinite(t.maxHp)&&t.maxHp>0&&t.hp<t.maxHp*.5;}
function createHost({game,env,offline,bridge,createPresentation,sceneData,onError=()=>{}}){
 const diagnostic=(kind,data)=>env.runtime.diagnosticEvent?.('dragon-tutorial-'+kind,JSON.stringify(data));
 let active=false,demo=null,presentation=null,last=null,debt=0,gesture=null,disposed=false,failedPlayer=null;
 function finish(reason='completed'){
  if(!active)return;active=false;const old=presentation,world=demo;presentation=demo=null;last=null;debt=0;gesture=null;
  diagnostic('finish',{reason});
  try{old?.dispose?.();}catch(e){onError(e);}
  try{if(world)bridge.dispose(world);}catch(e){onError(e);}
  bridge.cancelInput();game.loopClock=null;game.simulationDebt=0;game.nextRenderTime=null;game.renderPrevious=[];game.framePacer?.reset?.();game.wxUiDirty=true;env.runtime.wake?.();
 }
 function start(){
  if(active||disposed||game.player===failedPlayer||!eligible(game,offline))return false;
  bridge.cancelInput();active=true;
  try{demo=bridge.create(sceneData());presentation=bridge.withGame(demo,()=>createPresentation({game:demo,env,types:env.window.originalNetwork627.types,nativeUpdate:dt=>bridge.update(demo,dt),finish}));if(!presentation||typeof presentation.update!=='function'||typeof presentation.draw!=='function')throw Error('Invalid tutorial presentation');game.dragonTutorialSeenBL=true;last=null;debt=0;return true;}
  catch(e){failedPlayer=game.player;finish('error');onError(e);return false;}
 }
 const host={get active(){return active;},finish,
 frame(now){
  if(disposed)return false;if(!active&&!start())return false;
  // If another session replaced this one, abort the local presentation immediately.
  if(!offline()){finish('session-changed');return false;}
  if(env.runtime.hidden){last=null;gesture=null;return true;}
  const clock=Number.isFinite(now)?now:(env.performance?.now?.()??Date.now());const elapsed=last===null?0:Math.max(0,clock-last);last=clock;
  debt+=Math.min(elapsed,50);
  try{while(active&&debt>=1000/60){debt-=1000/60;bridge.withGame(demo,()=>presentation.update(1000/60));}if(active)bridge.withGame(demo,()=>presentation.draw());}
  catch(e){finish('error');onError(e);}return true;
 },
 touchStart(points){gesture=points?.length===1?{id:points[0].identifier,x:points[0].clientX,y:points[0].clientY,moved:false}:null;diagnostic('touch-start',{count:points?.length||0,x:gesture?.x,y:gesture?.y,rect:presentation?.skipRect?.()});},
 touchMove(points){if(!gesture)return;if(points?.length!==1||points[0].identifier!==gesture.id){gesture=null;return;}if(Math.hypot(points[0].clientX-gesture.x,points[0].clientY-gesture.y)>12)gesture.moved=true;},
 touchCancel(){gesture=null;},
 touchEnd(points,changed){
  // Native WeChat may retain the just-ended point in touches. changedTouches is
  // authoritative for finger release; browser/legacy callers still use [].
  const p=gesture;let ended=null;
  if(changed?.length){ended=changed.find(t=>t.identifier===p?.id);if(!ended)return;
   if(changed.length!==1||(points||[]).some(t=>t.identifier!==p?.id)){gesture=null;return;}
  }else if(points?.length)return;
  gesture=null;if(!active||!p||p.moved)return;
  if(ended&&Math.hypot(ended.clientX-p.x,ended.clientY-p.y)>12)return;
  const r=presentation?.skipRect?.(),x=ended?.clientX??p.x,y=ended?.clientY??p.y;
  const hit=!!r&&p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
  diagnostic('touch-end',{count:points?.length||0,changed:changed?.length||0,x,y,hit});
  if(hit)finish('skipped');
 },
 dispose(){finish('disposed');disposed=true;},
 report(){return{active,seen:game.dragonTutorialSeenBL===true,...presentation?.report?.()};}
 };return host;
}
module.exports={eligible,createHost};
