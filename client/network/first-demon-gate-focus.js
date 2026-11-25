'use strict';
const consumed=new WeakMap(),priority=require('./notice-priority');
function gateFor(game,point){let zone=null,best=Infinity;for(const z of game.resourceZones||[])if(Number.isFinite(z.gateX)&&Number.isFinite(z.gateY)){const d=Math.hypot(z.gateX-point.x,z.gateY-point.y);if(d<best){best=d;zone=z;}}return zone;}
function interrupted(game,input){return !!(game.player?.dead||input?.stick?.active||input?.panning||input?.pinch?.active||game.manualCamera394||game.placement||game.sessionMenuOpen||game.saveSlotsPanel||game.selectedBuilding||game.demonPanel||game.relicPanel);}
function beginGateFocus(game,point){const zone=gateFor(game,point);if(!zone)return false;const warning={kind:'demon',zone,compact:true,estimated:true,seconds:0};let marker;try{marker=game.incomingWarningDisplayMarker440?.(warning);}catch(_){}marker=marker&&Number.isFinite(marker.x)&&Number.isFinite(marker.y)?marker:{x:zone.gateX,y:zone.gateY};game.pendingDemonFocus545={x:marker.x,y:marker.y};game.firstGateHintAB={zone,until:(game.supportTime||0)+3600};return true;}
function consumeGateFocus(game,event,scope,tick,input){if(!event)return false;const prior=consumed.get(game),same=prior&&prior.roomId===scope.roomId&&prior.epoch===scope.epoch&&prior.viewerOwnerId===scope.viewerOwnerId;if(same&&event.serial<=prior.serial)return false;consumed.set(game,{...scope,serial:event.serial});const fresh=Number.isSafeInteger(event.issuedTick)&&Number.isSafeInteger(tick)&&tick>=event.issuedTick&&tick-event.issuedTick<=300;if(!fresh||interrupted(game,input)){game.pendingDemonFocus545=null;return false;}return beginGateFocus(game,event);}
function installOfflineGateFocus(game,{enabled=()=>true,input=null}={}){
 let raidZoneList=null,raidSerial=null;
 const record=game.recordDemonAttack545;
 if(typeof record==='function')game.recordDemonAttack545=function(victim,source,...args){
  if(!enabled())return record.call(this,victim,source,...args);
  const own=victim===this.player||victim?.ownerSlot==null&&((this.buildings||[]).includes(victim)||(this.tanks||[]).includes(victim));
  const valid=source===this.troll&&!victim?.dead&&['prep','hunt'].includes(this.state)&&(own||(this.allies||[]).includes(victim)||(this.buildings||[]).includes(victim)||(this.tanks||[]).includes(victim));
  const first=valid&&!this.firstDemonAttackSeen545;
  // The global first enemy attack may have been on an ally. Let the original
  // personal indicator (toast, sound, minimap) fire at our first actual hit.
  const personal=valid&&own&&!first&&this.lastDemonAttack560==null;
  const pending=this.pendingDemonFocus545;
  if(personal)this.firstDemonAttackSeen545=false;
  const result=record.call(this,victim,source,...args);
  if(personal){this.firstDemonAttackSeen545=true;this.pendingDemonFocus545=pending;}
  if(first){this.firstDemonAttackSeen545=true;this.pendingDemonFocus545=null;if(!interrupted(this,input))beginGateFocus(this,victim);}
  return result;
 };
 const old=game.updateFirstAttackWarningFocus;
 if(typeof old==='function')game.updateFirstAttackWarningFocus=function(...args){
  if(!enabled())return old.apply(this,args);
  if(this.state!=='hunt'||this.player?.dead||this.endlessOpeningIntro||this.popupActive515?.())return;
  if(raidZoneList!==this.resourceZones){raidZoneList=this.resourceZones;raidSerial=null;}
  const raid=this.troll?.raidPolicyStateAB;
  if(!raid||raid.selectionSerial===raidSerial||raid.owner!=='self'||raid.engaged||raid.purchasePending||raid.healthReturnPending||!(raid.warningLeft>0)||this.troll.dead||this.troll.retreating||this.troll.state==='frozen'||priority.economy(this))return;
  const w=this.incomingAttackWarningStates?.().find(v=>v.raidSerialAB===raid.selectionSerial&&v.seconds>0);
  if(!w||this.attackWarningAvoidanceAZ?.arrived(w))return;
  this.showToast('恶魔正从路口来袭！');
  if(this.toast?.text==='恶魔正从路口来袭！'){this.toast.time=2600;raidSerial=w.raidSerialAB;}
 };
 const camera=game.updateDemonAttackCamera545;if(typeof camera==='function')game.updateDemonAttackCamera545=function(...args){if((enabled()||this.networkGateFocusAB)&&interrupted(this,input)){this.pendingDemonFocus545=null;this.firstGateHintAB=null;if(this.manualCamera394){this.demonAttackFocus545=null;return false;}}return camera.apply(this,args);};const updateCamera=game.updateCamera;if(typeof updateCamera==='function')game.updateCamera=function(...args){if((enabled()||this.networkGateFocusAB)&&interrupted(this,input)){this.pendingDemonFocus545=null;this.firstGateHintAB=null;if(this.manualCamera394)this.demonAttackFocus545=null;}return updateCamera.apply(this,args);};}
module.exports={gateFor,beginGateFocus,consumeGateFocus,interrupted,installOfflineGateFocus};
