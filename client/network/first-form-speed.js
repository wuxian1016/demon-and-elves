'use strict';
// A modest10% reduction only for ordinary first-form barefoot demons.
// Applied after patrol policy speed selection; buying boots/evolving takes effect immediately.
const FACTOR=.9,installed=new WeakMap();
function factor(game,troll){return !game.tutorial&&!game.superChallenge580&&!troll.hasBoots&&!troll.evolved&&!troll.dragonEvolved?FACTOR:1;}
function installFirstFormSpeed(game,troll=game.troll,active=()=>true){
 if(!troll)return false;
 const previous=installed.get(troll);if(previous&&['getMoveSpeed','getChaseSpeed'].every(k=>previous[k]===troll[k]))return false;
 if(previous)previous.active=false;const record={active:true};installed.set(troll,record);
 for(const key of ['getMoveSpeed','getChaseSpeed']){const original=troll[key];if(typeof original!=='function')continue;
 const wrapped=function(...args){const speed=original.apply(this,args);return this===troll&&record.active&&active()?speed*factor(game,this):speed;};record[key]=wrapped;Object.defineProperty(troll,key,{configurable:true,writable:true,enumerable:false,value:wrapped});
 }
 return true;
}
module.exports={FACTOR,factor,installFirstFormSpeed};
