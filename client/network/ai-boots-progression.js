"use strict";
// AI-only equipment gate. Caller must exclude a human-controlled demon.
// Count combat sorties, never elapsed time, slime waves or shopping visits.
const PRICE=400,REQUIRED=2;
function install(game,{active=()=>false}={}){
 if(game.aiBootsProgressionBH)return game.aiBootsProgressionBH;
 const installed=new WeakSet();
 const enabled=()=>active()&&!game.tutorial&&!game.superChallenge580;
 const atHome=t=>!!game.trollBase&&!game.trollBase.dead&&game.trollBase.inSupplyRange(t);
 const state=t=>{
  let s=t.aiBootsStateBH;
  if(!s||s.schema!==1)s=t.aiBootsStateBH={schema:1,completed:0,away:false,engaged:false};
  s.completed=Number.isFinite(s.completed)?Math.max(0,Math.min(REQUIRED,Math.floor(s.completed))):0;
  s.away=s.away===true;s.engaged=s.engaged===true;return s;
 };
 const complete=t=>{const s=state(t);if(s.away&&s.engaged)s.completed=Math.min(REQUIRED,s.completed+1);s.away=false;s.engaged=false;};
 const sync=t=>{if(!enabled()||!t||t.dead||game.state!=='hunt')return;const s=state(t);if(atHome(t)){if(s.away)complete(t);}else s.away=true;};
 const engaged=t=>{if(!enabled()||game.state!=='hunt'||!t)return;const s=state(t);if(!atHome(t))s.away=true;if(s.away)s.engaged=true;};
 const friendlyTarget=e=>e===game.player||(game.allies||[]).includes(e)||(game.buildings||[]).includes(e)||(game.tanks||[]).includes(e);
 const ensure=()=>{const t=game.troll;if(!t||installed.has(t))return;installed.add(t);
  const define=(k,v)=>Object.defineProperty(t,k,{configurable:true,writable:true,enumerable:false,value:v});
  define('aiBootsCostBH',()=>enabled()?PRICE:200);
  define('aiBootsAllowedBH',()=>{if(!enabled())return true;sync(t);return state(t).completed>=REQUIRED;});
  const attack=t.applyAttackDamage;if(typeof attack==='function')define('applyAttackDamage',function(target,...args){const hp=target?.hp,alive=target&&!target.dead,result=attack.call(this,target,...args);if(this===t&&alive&&friendlyTarget(target)&&(target.dead||Number.isFinite(hp)&&target.hp<hp))engaged(t);return result;});
  const hurt=t.takeDamage;if(typeof hurt==='function')define('takeDamage',function(amount,source,...args){const hp=this.hp,result=hurt.call(this,amount,source,...args);if(this===t&&this.hp<hp&&(friendlyTarget(source)||game.elfRewardOwnerSlot?.(source)!==undefined))engaged(t);return result;});
  sync(t);
 };
 const update=game.update;game.update=function(...args){ensure();sync(this.troll);const result=update.apply(this,args);ensure();sync(this.troll);return result;};
 const respawn=game.respawnTroll;if(typeof respawn==='function')Object.defineProperty(game,'respawnTroll',{configurable:true,writable:true,enumerable:false,value:function(...args){const t=this.troll,dead=!!t?.dead,result=respawn.apply(this,args);if(enabled()&&dead&&this.troll===t&&!t.dead&&atHome(t))complete(t);ensure();return result;}});
 const api={ensure,price:PRICE,required:REQUIRED,snapshot:()=>game.troll?.aiBootsStateBH?{...game.troll.aiBootsStateBH}:null};
 Object.defineProperty(game,'aiBootsProgressionBH',{configurable:true,enumerable:false,value:api});ensure();return api;
}
module.exports={install,PRICE,REQUIRED};
