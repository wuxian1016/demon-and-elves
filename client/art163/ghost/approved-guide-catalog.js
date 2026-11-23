'use strict';
const ordinary=require('./guide-ordinary-native'),mech=require('./guide-mech-bind');
const {createRole:role,prime}=require('./make-native-role');
const build={robotSiege:ordinary,robotFlame:ordinary,robotSuper:ordinary,ghostRelocate:mech,ghostCopy:mech,ghostFlame:mech,ghostStealth:role,ghostPossess:role,batRaid:role};
module.exports=function catalog(makeShadow,env){
 const w=env.window;
 return (key,live)=>{
  const factory=Object.hasOwn(build,key)&&build[key];if(!factory)return null;
  return {ready(){
   if(!w.woodlandArt?.ready)return false;
   if(factory===role){const sprite=prime(w);return key==='ghostStealth'?sprite:w.batWaveCandidateBN?.warmFlight?.()===true&&sprite;}
   if(factory!==mech)return true;
   live.factoryModelsBN?.warm?.();
   if(!live.factoryModelsBN?.artReady?.())return false;
   if(key==='ghostCopy'){live.ghostCopyBN?.warm();return !!live.ghostCopyBN?.castArt();}
   if(key==='ghostRelocate'){w.warmGhostHandPoseBN?.();live.cardVisuals?.warmBolt?.();return !!w.ghostHandPoseBN&&live.cardVisuals?.boltReady===true;}
   return true;
  },create(){
   const sh=makeShadow();
   try{const scene=factory(key,sh,env);if(!scene)sh.close();return scene;}
   catch(e){sh.close();throw e;}
  }};
 };
};
