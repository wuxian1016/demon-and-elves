'use strict';
// Only the live principal demon in an ordinary offline Crazy run participates.
// Leave the existing economy (difficulty scaling, evolution discount and XP) alone.
const killed=new WeakMap();
function multiplier(world,window,demon){
 if(!world||demon!==world.troll||world.trollDifficulty!=='crazy'||world.tutorial||world.superChallenge580
 ||world.networkAuthorityPhases627||window.networkDefenseModeBN?.()===true||window.batSoloPolicyBN?.allows?.(world)!==true)return 1;
 return demon.dragonEvolved?2:demon.evolved?1.35:1.2;
}
function reportKill(world,window,building,source,actualDamage){
 if(source!==world?.troll||!Number.isFinite(actualDamage)||actualDamage<=0)return;
 const value=multiplier(world,window,source);if(value>1)killed.set(building,value);
}
function takeKill(building){
 const value=killed.get(building)??1;killed.delete(building);return value;
}
module.exports={multiplier,reportKill,takeKill};
