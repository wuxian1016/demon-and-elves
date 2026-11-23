'use strict';
const START_MS=360000,GRACE_MS=60000;
// Round simulation time includes preparation, matching the existing survival
// ledger. Paused/loading/background time never advances this clock.
function install(g,{active=()=>true,elves=()=>g.getElves?.()||[g.player,...g.allies||[]],keyFor=e=>e===g.player?null:e.slot,buildingKey=b=>b.ownerSlot??null,onDeath=null}={}){
 if(g.noBuildingGraceAZ)return g.noBuildingGraceAZ;const update=g.update,counts=new Map();
 const clear=e=>{e.noBuildingGraceDeadlineAZ=null;e.noBuildingGraceAbsentAtAZ=null;e.noBuildingGraceRemainingAZ=null;};
 const check=clock=>{counts.clear();for(const b of g.buildings||[])if(!b.dead&&b.hp>0){const key=buildingKey(b);counts.set(key,(counts.get(key)||0)+1);}for(const e of elves()){
  if(!e)continue;e.noBuildingRoundClockAZ=clock;if(e.dead||e.defected){clear(e);continue;}
  if(counts.get(keyFor(e))>0){g.soloPlayerPressureGraceBG?.restored(e);clear(e);continue;}
  if(!Number.isFinite(e.noBuildingGraceAbsentAtAZ))e.noBuildingGraceAbsentAtAZ=clock;
  if(clock<START_MS){e.noBuildingGraceRemainingAZ=null;continue;}
  if(!Number.isFinite(e.noBuildingGraceDeadlineAZ))e.noBuildingGraceDeadlineAZ=Math.max(START_MS,e.noBuildingGraceAbsentAtAZ)+GRACE_MS;
  e.noBuildingGraceRemainingAZ=Math.max(0,e.noBuildingGraceDeadlineAZ-clock);
  if(clock+1e-6<e.noBuildingGraceDeadlineAZ)continue;
  // Rule elimination is not combat damage: shields/invulnerability cannot
  // turn an expired rebuilding grace into indefinite survival or a kill reward.
  e.dead=true;e.hp=0;e.task=e.moveTarget=null;e.moving=false;e.stickDriven=false;e.setMoveIntent?.(0,0);g.clearUnitNavigation?.(e);
  if(e.drivingTank){e.drivingTank.driver=null;g.clearUnitNavigation?.(e.drivingTank);e.drivingTank=null;}e.inHouse=null;e.corpseX=e.x;e.corpseY=e.y;e.downedTimer=30000;e.rescueProgress=0;e.noBuildingGraceDeathsAZ=(e.noBuildingGraceDeathsAZ||0)+1;clear(e);
  g.soloPlayerPressureGraceBG?.expired(e);
  if(onDeath)onDeath(e);else if(e===g.player)g.playerDeathSerial=(g.playerDeathSerial||0)+1;
  if(e===g.player)g.showToast?.('重建时间已结束，精灵倒下');
 }};
 g.update=function(...args){const body=this.player,tracking=active()&&!this.roundStarting&&!this.tutorial&&['prep','hunt'].includes(this.state),before=this.supportTime||0,history=body?.roundResultsAD,initialClock=Number.isFinite(body?.noBuildingRoundClockAZ)?body.noBuildingRoundClockAZ:history?.scope==='round'&&Number.isFinite(history.elapsedMs)?history.elapsedMs:this.state==='prep'?Math.max(0,60000-(this.prepTimeLeft||0)*1000):Math.max(0,(this.huntElapsed||0)*1000+60000);const result=update.apply(this,args);if(!tracking||this.player!==body||!['prep','hunt'].includes(this.state))return result;
  body.noBuildingRoundClockAZ=initialClock+Math.max(0,(this.supportTime||0)-before);check(body.noBuildingRoundClockAZ);return result;
 };
 const api={check,clear,clock:()=>g.player?.noBuildingRoundClockAZ??null,START_MS,GRACE_MS};Object.defineProperty(g,'noBuildingGraceAZ',{value:api,configurable:true});return api;
}
module.exports={install,START_MS,GRACE_MS};
