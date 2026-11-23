'use strict';
const {seatColor}=require('./ownership-palette');
function installOwnershipColors(game,{seatForSlot=slot=>slot==null?0:slot===-2?0:slot+1,seatForEntity=null,Building=null,bodies=()=>[]}={}){
 if(game.ownershipColorsAB)return game.ownershipColorsAB;
 const entitySeat=e=>seatForEntity?seatForEntity(e):e===game.player?0:seatForSlot(e?.slot??e?.ownerSlot??null);
 const sync=()=>{if(game.player)game.player.markColor=seatColor(entitySeat(game.player));for(const ally of [...(game.allies||[]),...bodies()])ally.markColor=seatColor(entitySeat(ally));};
 game.networkSeatColor627=slot=>seatColor(seatForSlot(slot));
 game.networkElfColor627=e=>e?seatColor(entitySeat(e)):null;
 for(const method of ['spawnAllies','applySavedWorld','update']){const original=game[method];if(typeof original==='function')game[method]=function(...args){const result=original.apply(this,args);sync();return result;};}
 const teamColor=Building?.prototype?.teamColor;if(typeof teamColor==='function')Building.prototype.teamColor=function(){return game.networkSeatColor627?.(this.ownerSlot)||teamColor.call(this);};
 const buttons=game.getAllySlotButtons;if(typeof buttons==='function')game.getAllySlotButtons=function(...args){return buttons.apply(this,args).map(b=>Number.isInteger(b.slot)?{...b,accentColor:seatColor(b.slot+1)}:b);};
 sync();return game.ownershipColorsAB={sync,entitySeat};
}
module.exports={installOwnershipColors};
