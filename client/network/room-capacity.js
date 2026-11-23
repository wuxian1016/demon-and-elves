'use strict';
const MAX_PLAYERS=6,MAX_GUESTS=5,CAPACITY_RULES='six-total-v1',LEGACY_MAX_SEATS=9;
function capacityPolicy(health){
 const n=health?.maxPlayers,g=health?.maxGuests;
 if(health?.capacityRules!==CAPACITY_RULES||!Number.isInteger(n)||n<1||n>MAX_PLAYERS||!Number.isInteger(g)||g<0||g>MAX_GUESTS||g>=n)throw Error('CAPACITY_BACKEND_UPDATE_REQUIRED');
 return Object.freeze({maxPlayers:n,maxGuests:g,capacityRules:CAPACITY_RULES});
}
function readCapacityPolicy(health){try{return capacityPolicy(health);}catch(error){if(error.message!=='CAPACITY_BACKEND_UPDATE_REQUIRED')throw error;return null;}}
function roomSeatCount(room){return room?.slots?.length?Math.min(LEGACY_MAX_SEATS,room.slots.length):MAX_PLAYERS;}
function legacyRoom(room){return !!room&&(room.legacyCapacity===true||room.slots?.length>MAX_PLAYERS);}
module.exports={MAX_PLAYERS,MAX_GUESTS,CAPACITY_RULES,LEGACY_MAX_SEATS,capacityPolicy,readCapacityPolicy,roomSeatCount,legacyRoom};
