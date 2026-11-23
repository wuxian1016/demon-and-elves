'use strict';
// Authority-side range damage; flying enemies can be stunned but aren't grounded.
function create({game:g,authority,stunPolicy=null,getStunPolicy=()=>stunPolicy,getDamagePolicy=()=>null}){
 const source=Object.freeze({cardStorm:true,rewardOwnerSlot:null});let hits=0,stuns=0,pendingStuns=0;
 const isSource=s=>authority()===true&&s===source;
 function consumeStun(e,dt){if(!authority()||!e||!Number.isFinite(dt)||dt<0||!(e.cardStormStunMs>0))return false;e.cardStormStunMs=Math.max(0,e.cardStormStunMs-dt);e.setMoveIntent?.(0,0);return true;}
 function apply(pulse){
  const area=pulse?.area;
  if(!authority()||!Number.isFinite(pulse?.damage)||pulse.damage<0||!Number.isFinite(area?.x)||!Number.isFinite(area?.y)||!Number.isFinite(area?.radius)||area.radius<=0)return false;
  const stun=getStunPolicy(),damage=getDamagePolicy();
  const hit=e=>{
   if(!e||e.dead||typeof e.takeDamage!=='function')return;
   const dx=e.x-area.x,dy=e.y-area.y,r=area.radius+Math.max(0,e.radius||0);
   if(!(dx*dx+dy*dy<=r*r))return;
   const amount=typeof damage==='function'?damage(e,pulse):pulse.damage;
   if(amount>0&&Number.isFinite(amount)){e.takeDamage(amount,source);hits++;}
   if(e.dead)return;
   if(typeof stun!=='function'){pendingStuns++;return;}
   const decision=stun(e,pulse);if(!decision?.allowed||!Number.isFinite(decision.durationMs)||decision.durationMs<=0)return;
   const duration=Math.min(6000,decision.durationMs);
   if(e.waveStone)e.stoneStunLeft=Math.max(e.stoneStunLeft||0,duration);else e.cardStormStunMs=Math.max(e.cardStormStunMs||0,duration);
   stuns++;
  };
  hit(g.troll);
  // A slime may split during takeDamage. New children join the next pulse.
  const minions=typeof g.hostileMinions==='function'?g.hostileMinions():[];
  for(let i=0,n=minions.length;i<n;i++)if(minions[i]!==g.troll)hit(minions[i]);
  return true;
 }
 return{apply,isSource,consumeStun,stats:()=>({hits,stuns,pendingStuns,immunityPolicyReady:typeof getStunPolicy()==='function'})};
}
module.exports={create};
