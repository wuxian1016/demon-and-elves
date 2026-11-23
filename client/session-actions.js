'use strict';
const NO_ORE='矿石已经采完，附近没有矿石';
function availableMine(game){const p=game.player;if(!p||typeof game.findTaskResource401!=='function')return null;return game.findTaskResource401({type:'gold',zoneIndex:game.resourceZoneIndexFor401(p),originX:p.x,originY:p.y,localRadius:1200});}
function installSessionActions({game,runtime,wx,onInvalidate=null}){
 const saved=new Map(),patch=(name,value)=>{saved.set(name,{own:Object.hasOwn(game,name),value:game[name],installed:value});game[name]=value;};let pending=null,alive=true,revision=0;
 const invalidate=()=>{revision++;onInvalidate?.();if(pending){const row=pending;pending=null;row.done=true;row.resolve(false);}};
 patch('invalidateExitConfirmation627',invalidate);
 const menu=game.sessionMenuButtons,tap=game.handleTap,button=game.onButtonClick;
 const fog=game.drawStartFog472;if(typeof fog==='function')patch('drawStartFog472',function(...args){const im=this.startBackgroundImage471?.();if(!(im?.width>0&&im?.height>0))return;return fog.apply(this,args);});
 if(typeof menu==='function')patch('sessionMenuButtons',function(...args){return menu.apply(this,args).map(b=>b.id==='exit'?{...b,text:'退出游戏'}:b);});
 function requestExit(){if(pending)return pending.promise;if(!alive||!game.sessionMenuOpen||game.audioSettingsOpen||!['prep','hunt'].includes(game.state))return Promise.resolve(false);const scope={player:game.player,state:game.state,revision};let resolve;const promise=new Promise(r=>resolve=r),row={promise,resolve,done:false};pending=row;
  const finish=async confirmed=>{if(row.done||pending!==row)return;row.done=true;let exited=false;try{const current=alive&&scope.revision===revision&&game.player===scope.player&&game.state===scope.state&&game.sessionMenuOpen&&!game.audioSettingsOpen&&!game.saveSlotsPanel&&!game.demonPanel&&!game.allyDataPanel&&!game.relicPanel&&!game.rotationInputBlocked398?.();if(confirmed&&current){const b=game.sessionMenuButtons().find(b=>b.id==='exit');if(b){tap.call(game,b.x+b.w/2,b.y+b.h/2);exited=game.state==='start';}}}catch(_){game.showToast?.('退出未完成，请重试');}finally{if(pending===row)pending=null;resolve(exited);runtime.wake?.();}};
  try{if(typeof wx?.showModal!=='function'){void finish(false);game.showToast?.('未能打开退出确认，请重试');}else wx.showModal({title:'确认退出游戏',content:'确认退出当前对局并返回首页？未保存的进度将丢失。',showCancel:true,confirmText:'退出游戏',cancelText:'继续游戏',success:r=>{void finish(r?.confirm===true&&r?.cancel!==true);},fail:()=>{void finish(false);}});}catch(_){void finish(false);}return promise;
 }
 if(typeof tap==='function')patch('handleTap',function(x,y,...args){if(this.deathResultsAD?.visible)return tap.call(this,x,y,...args);if(this.sessionMenuOpen&&!this.audioSettingsOpen&&!this.saveSlotsPanel&&!this.demonPanel&&!this.allyDataPanel){const b=this.sessionMenuButtons().find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(b?.id==='exit')return requestExit();if(b)invalidate();}return tap.call(this,x,y,...args);});
 if(typeof button==='function')patch('onButtonClick',function(id,...args){if(id==='collectGold'&&!this.ghostElfAPI?.legend?.(id)&&!this.player?.dead&&!this.endlessOpeningIntro){const guide=this.easyOpeningGuideAdvice?.();if(!guide||guide.optional||guide.button==='collectGold'){const mine=availableMine(this);if(!mine){const p=this.player,t=p.task;if(t?.type==='gold'&&t.phase!=='return'&&(!t.target||t.target.dead||!(t.target.gold>0))){p.task=null;p.moveTarget=null;}this.showToast?.(NO_ORE);runtime.wake?.();return false;}}}return button.call(this,id,...args);});
 for(const name of ['beginRound','loadProgressAsync']){const fn=game[name];if(typeof fn==='function')patch(name,function(...args){invalidate();return fn.apply(this,args);});}
 return{requestExit,invalidate,dispose(){alive=false;invalidate();for(const[name,row]of saved){if(game[name]===row.installed){if(row.own)game[name]=row.value;else delete game[name];}}saved.clear();}};
}
module.exports={installSessionActions,availableMine,NO_ORE};
