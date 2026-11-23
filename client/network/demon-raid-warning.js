'use strict';
function raidGateWarning(game,warning){
 if(!warning||warning.active!==true||!Number.isInteger(warning.remaining)||warning.remaining<0||warning.remaining>50)return null;
 const houses=(game.buildings||[]).filter(b=>!b.dead&&b.type==='house'&&b.ownerSlot==null),home=houses.find(b=>b.isInitialBase)||houses[0];
 if(!home)return null;let zone=null,best=Infinity;for(const z of game.resourceZones||[])if(Number.isFinite(z.gateX)&&Number.isFinite(z.gateY)){const d=Math.hypot(z.x-home.x,z.y-home.y);if(d<best){best=d;zone=z;}}
 if(!zone)return null;
 return {kind:'demon',seconds:warning.remaining,progress:warning.remaining/50,zone,target:home,source:game.troll,compact:true,estimated:true,supplying:false,stacked:false};
}
function mergeRaidWarnings(game,rows,warning,enabled=true){if(!enabled)return rows;const result=(rows||[]).filter(w=>w.kind!=='demon'),gate=raidGateWarning(game,warning),hint=game.firstGateHintAB;if(gate)result.push(gate);else if(hint&&hint.until>(game.supportTime||0))result.push({kind:'demon',seconds:0,progress:0,zone:hint.zone,compact:true,estimated:true,supplying:false,stacked:false,raidContactAB:true});return result;}
function installGateRaidWarning(game,{warning,enabled=()=>true}={}){
 const original=game.incomingAttackWarningStates;
 game.incomingWarningEtaAB=w=>w.raidContactAB?'交战中':w.kind==='demon'&&w.estimated&&w.seconds<=0?'接近中':Math.ceil(w.seconds)+'秒';
 if(typeof original==='function')game.incomingAttackWarningStates=function(...args){
  const rows=original.apply(this,args);if(!enabled())return rows;
  const result=mergeRaidWarnings(this,rows,warning?.());
  const serial=this.troll?.raidPolicyStateAB?.selectionSerial;
  if(Number.isSafeInteger(serial))for(const row of result)if(row.kind==='demon'&&row.estimated&&!row.raidContactAB)row.raidSerialAB=serial;
  return result;
 };
}
module.exports={raidGateWarning,mergeRaidWarnings,installGateRaidWarning};
