'use strict';
const {installDemonKillCredit}=require('./network/demon-kill-credit');
const {createDeathResultsGate}=require('./network/death-results');
function installOfflineDeathResults(game,{runtime,Troll,offline=()=>true}){
 const originalTap=game.handleTap;let shownBody=null,shownSerial=null,cachedStore=null,rowByBody=new WeakMap(),bodyByOwner=new Map();const aliveBefore=[];
 Object.defineProperty(game,"offlineReviveFirstEnabledBN",{value:offline,configurable:true});
 // Native supportTime intentionally survives reset; only an explicit completed
 // new-world generator establishes fresh round history. Loaded saves retain
 // their own ledger or the truthful unknown-history fallback.
 const resetRound=game.resetSteps591;
 if(typeof resetRound==='function')Object.defineProperty(game,'resetSteps591',{enumerable:false,configurable:true,writable:true,value:function*(...args){const result=yield*resetRound.apply(this,args);if(offline()&&this.player)this.player.roundResultsAD={version:1,scope:'round',elapsedMs:0,rows:[]};return result;}});
 function ledger(){
  const p=game.player;if(!p)return null;
  if(!p.roundResultsAD||p.roundResultsAD.version!==1){const old=(game.supportTime||0)>100||(game.huntElapsed||0)>0||(game.demonKillCount||0)>0;p.roundResultsAD={version:1,scope:old?'since-load':'round',elapsedMs:0,rows:[]};}
  const store=p.roundResultsAD;if(store!==cachedStore){cachedStore=store;rowByBody=new WeakMap();bodyByOwner=new Map();}
  const allies=game.allies||[];for(let i=-1;i<allies.length;i++){const body=i<0?p:allies[i];
   let row=rowByBody.get(body);const id=row?.ownerId||(body===p?'self':'ai-'+body.slot);if(!row)row=store.rows.find(r=>r.ownerId===id);
   if(!row){row={ownerId:id,seat:body===p?0:body.slot+1,kind:body===p?'human':'ai',name:body===p?'你':'电脑'+(body.slot+1),aliveMs:0,kills:0,status:'survived',connected:true};store.rows.push(row);}
   rowByBody.set(body,row);bodyByOwner.set(id,body);row.status=body.defected?'defected':body.dead?'dead':'survived';
  }
  for(const row of store.rows){const body=bodyByOwner.get(row.ownerId);if(body)row.status=body.defected?'defected':body.dead?'dead':'survived';}
  return store;
 }
 function snapshot(){const l=ledger();if(!l)return null;const rank=(rows,key)=>{rows.sort((a,b)=>b[key]-a[key]||a.seat-b.seat);let last=null,n=0;rows.forEach((r,i)=>{if(r[key]!==last)n=i+1;r.rank=n;last=r[key];});return rows;},tick=Math.ceil(l.elapsedMs*60/1000);
  return {tick,scope:l.scope,survival:{endedTick:tick,clock:'cumulative-alive-from-round-start-60hz',rows:rank(l.rows.map(({kills,...r})=>({...r,aliveMs:Math.floor(r.aliveMs)})),'aliveMs')},kills:rank(l.rows.map(r=>({ownerId:r.ownerId,seat:r.seat,kind:r.kind,name:r.name,kills:r.kills})),'kills')};
 }
 const gate=createDeathResultsGate({current:()=>({dead:offline()&&!!game.player?.dead,body:game.player,epoch:game.playerDeathSerial||0,ownerId:'self'}),view:()=>runtime.viewport(),text:s=>runtime.nativeText?.(s)??s,wake:()=>runtime.wake?.(),onAction(id,scope){if(!offline()||game.player!==scope.body||!game.player.dead||(game.playerDeathSerial||0)!==scope.epoch)return;if(id==='new'){game.sessionMenuOpen=false;game.beginRound(false);return;}if(id==='home'){
   // Delegate to the native menu exit so input, transient caches and sounds
   // are reset in exactly the same way as an ordinary confirmed exit.
   const goHome=()=>{game.sessionMenuOpen=true;game.audioSettingsOpen=false;game.saveSlotsPanel=null;game.demonPanel=null;game.allyDataPanel=null;
   const button=game.sessionMenuButtons().find(b=>b.id==='exit');if(button)originalTap.call(game,button.x+button.w/2,button.y+button.h/2);};
   if(!game.rewardAdBN?.returnResult('lose',goHome))goHome();
  }}});
 Object.defineProperty(game,'deathResultsAD',{value:gate,configurable:true});
 installDemonKillCredit(game,{Troll,enabled:offline,onKill(body){const l=ledger(),id=body===game.player?'self':'ai-'+body.slot,row=l?.rows.find(r=>r.ownerId===id);if(row)row.kills++;}});
 const update=game.update;game.update=function(...args){
  const tracking=offline()&&!this.roundStarting&&!this.tutorial&&['prep','hunt'].includes(this.state),before=this.supportTime||0,body=this.player,l=tracking?ledger():null;aliveBefore.length=0;if(l){for(let i=-1;i<this.allies.length;i++){const b=i<0?body:this.allies[i];if(!b.dead&&!b.defected){const row=rowByBody.get(b);if(row)aliveBefore.push(row);}}}
  const result=update.apply(this,args);
  if(l&&this.player===body){const delta=Math.max(0,(this.supportTime||0)-before);l.elapsedMs+=delta;for(const r of aliveBefore)r.aliveMs+=delta;ledger();}return result;
 };
 const draw=game.draw;game.draw=function(...args){const result=draw.apply(this,args);gate.sync();if(!offline()||this.tutorial||this.roundStarting)return result;
  if(!this.player?.dead){shownBody=null;shownSerial=null;return result;}
  if(this.playerReviveFirstBN?.()||this.spectating587){if(gate.visible)gate.close();shownBody=this.player;shownSerial=this.playerDeathSerial;return result;}
  if((this.allies||[]).length&&['prep','hunt','lose'].includes(this.state)&&(shownBody!==this.player||shownSerial!==this.playerDeathSerial)){
   shownBody=this.player;shownSerial=this.playerDeathSerial;gate.open(snapshot());runtime.cancelInput?.();
  }
  gate.draw(this.ctx,runtime.canvas);return result;
 };
 game.handleTap=function(x,y,...args){if(gate.tap(x,y))return;return originalTap.call(this,x,y,...args);};
 return {gate,snapshot};
}
module.exports={installOfflineDeathResults};
