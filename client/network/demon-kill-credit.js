'use strict';
// Count only the native, successfully attributed final hit. The original
// bounty guard owns deduplication, including zero rewards at full capacity.
function installDemonKillCredit(game,{Troll,enabled=()=>true,onKill}){
 const descriptor=Object.getOwnPropertyDescriptor(game,'awardHostileKill'),original=game.awardHostileKill;
 if(typeof original!=='function'||typeof Troll!=='function')return null;
 const wrapped=function(victim,source){
  const eligible=enabled()&&victim instanceof Troll&&victim.dead&&!victim.resourceBountyPaid;
  const result=original.call(this,victim,source);
  if(eligible&&result&&victim.resourceBountyPaid){
   const body=this.ownerWallet(result.ownerSlot);
   if(body&&!body.defected)onKill(body,victim);
  }
  return result;
 };
 Object.defineProperty(game,'awardHostileKill',{value:wrapped,writable:true,configurable:true,enumerable:false});
 return {dispose(){if(game.awardHostileKill===wrapped){if(descriptor)Object.defineProperty(game,'awardHostileKill',descriptor);else delete game.awardHostileKill;}}};
}
module.exports={installDemonKillCredit};
