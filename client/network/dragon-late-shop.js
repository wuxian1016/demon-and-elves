'use strict';
// Barrier upgrades contribute only their incremental armor, not their total again.
const gear=(name,cost,bonuses)=>Object.freeze({name,cost,damage:0,minLevel:1,dragonOnly:true,postDragonTierBN:true,...bonuses});
const DRAGON_LATE_GEAR=Object.freeze([
 gear('烬牙利爪',28000,{dragonDamage:45}),
 gear('龙王壁垒Ⅱ',40000,{armor:25,barrierArmor:135}),
 gear('裂穹龙刃',56000,{dragonDamage:70}),
 gear('龙王壁垒Ⅲ',76000,{armor:35,barrierArmor:170}),
]);
module.exports={DRAGON_LATE_GEAR};
