'use strict';
// Approved modest AI assistance, supplied only by real harvesting. Native
// resource stocks, cargo/return trips, storage caps and every price stay intact.
const HARVEST_MULTIPLIER=1.2;
function install(game,{active=()=>true}={}){
 if(game.aiEconomySupportAZ)return game.aiEconomySupportAZ;
 const original=game.allyGatherSpeed596;if(typeof original!=='function')return null;
 const counts={nativeQueries:0,boostedQueries:0};
 game.allyGatherSpeed596=function(ally){const speed=original.call(this,ally);counts.nativeQueries++;if(!active()||this.tutorial||!['prep','hunt'].includes(this.state)||!ally||ally.dead||ally.defected||!this.allies?.includes(ally))return speed;counts.boostedQueries++;return speed*HARVEST_MULTIPLIER;};
 const api={multiplier:HARVEST_MULTIPLIER,original,stats:()=>({...counts})};Object.defineProperty(game,'aiEconomySupportAZ',{value:api,configurable:true});return api;
}
module.exports={install,HARVEST_MULTIPLIER};
