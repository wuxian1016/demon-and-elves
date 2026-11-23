'use strict';
// Seat 1 is the main player; seats 2–9 match the eight home teammate swatches.
const {SEAT_COLORS,seatColor}=require('./ownership-palette');
const peerSeat=ownerSlot=>ownerSlot===-2?0:Number.isInteger(ownerSlot)&&ownerSlot>=0&&ownerSlot<8?ownerSlot+1:null;
function seatPortraits(game,roster,viewerOwnerId,Player){
 const selfSeat=roster.find(row=>row.ownerId===viewerOwnerId)?.seat??0;
 const humanSeats=new Set(roster.filter(row=>row.kind==='human').map(row=>row.seat));
 const markers=[{entity:game.player,color:seatColor(selfSeat),self:true}];
 // Only hydrated friendly Player bodies already sent to this viewer are used.
 if(Player?.prototype)for(const entity of game.allies||[]){const seat=peerSeat(entity.ownerSlot);if(seat!==selfSeat&&humanSeats.has(seat)&&Object.getPrototypeOf(entity)===Player.prototype)markers.push({entity,color:seatColor(seat),self:false});}
 return {selfSeat,markers};
}
module.exports={SEAT_COLORS,seatColor,peerSeat,seatPortraits};
