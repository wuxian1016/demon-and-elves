'use strict';
// Derived view only: never changes wallets, transport ledgers, animation clocks or stats.
const STATES=new Set(['empty','gold','wood','mixed']);
function cargoState(b){
 if(!b||b.dead||b.batSettledBN)return 'empty';
 let gold=false,wood=false;
 for(const c of Object.values(b.batCargoBN||{})){
  gold=gold||(Number.isFinite(c.gold)&&c.gold>0);
  wood=wood||(Number.isFinite(c.wood)&&c.wood>0);
 }
 return gold?(wood?'mixed':'gold'):(wood?'wood':'empty');
}
function sync(b){return b.batCargoVisualBN=cargoState(b);}
function presentationState(b){return b?.dead?'empty':STATES.has(b?.batCargoVisualBN)?b.batCargoVisualBN:'empty';}
module.exports={cargoState,sync,presentationState};
