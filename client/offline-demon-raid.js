
'use strict';
const {installFirstFormSpeed}=require('./network/first-form-speed');
const {installMultiplayerDemonRaid}=require('./network/demon-raid-policy');
const {installOpeningPatrolLottery}=require('./network/opening-patrol-lottery');
function installOfflineDemonRaid(game,offline){
 let demon=null,policy=null;
 const ensure=()=>{
  if(!offline()||game.networkAuthorityPhases627||!game.troll||!game.player)return null;
  if(!(game.allies||[]).length&&!game.troll.soloPlayerPressureBG?.armed){
   installFirstFormSpeed(game,game.troll,offline);
   if(['medium','crazy'].includes(game.trollDifficulty)&&game.state==='prep'&&!game.troll.openingPatrolLotteryBF){
    installOpeningPatrolLottery({g:game,players:[{body:game.player}],soloMultiAi:true},Math.random);
   }
   return null;
  }
  if(demon===game.troll)return policy;
  demon=game.troll;
  const Building=game.buildings?.find(b=>b.type)?.constructor;
  if(!Building||Building===Object)return null;
  const battle={id:'offline-raid',soloMultiAi:true,g:game,get players(){return [{id:'self',body:game.player}];},types:{Building},owners:new WeakMap(),policyActive:offline,
   contexts:{playerForBody:e=>e===game.player?{id:'self'}:null,canonicalSlot:s=>s},ownerIdForEngineSlot:s=>s==null?'self':'ai-'+s};
  policy=installMultiplayerDemonRaid(battle);return policy;
 };
 const update=game.update;
 game.update=function(...args){ensure();return update.apply(this,args);};
 return {ensure,warning:()=>offline()?ensure()?.warningFor('self')||null:null};
}
module.exports={installOfflineDemonRaid};
