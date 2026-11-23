'use strict';
// Exact original native catalogue; regression compares these values to vendor source.
const TROLL_SHOP_ITEMS=[
    { name: '木棍', cost: 50, damage: 5 },
    { name: '铁斧', cost: 120, damage: 12 },
    { name: '战锤', cost: 250, damage: 25 },
    { name: '魔剑', cost: 500, damage: 50 },
    { name: '屠龙刀', cost: 1000, damage: 100 },
    { name: '裂城巨斧', cost: 700, damage: 65, minLevel: 4, hp: 400 },
    { name: '炼狱重锤', cost: 1200, damage: 110, minLevel: 6, armor: 10 },
    { name: '深渊战刃', cost: 2000, damage: 170, minLevel: 8, hp: 800 },
    { name: '灭城魔戟', cost: 3200, damage: 240, minLevel: 10, armor: 15 },
    { name: '末日王者战斧', cost: 4800, damage: 320, minLevel: 12, hp: 1500, armor: 20 },
    { name: '龙血护符', cost: 2400, damage: 0, dragonDamage: 20, minLevel: 1, dragonOnly: true, hp: 6000 },
    { name: '黑曜护腕', cost: 4000, damage: 0, minLevel: 1, dragonOnly: true, armor: 40 },
    { name: '熔火之心', cost: 6500, damage: 0, dragonDamage: 30, minLevel: 1, dragonOnly: true, hp: 12000 },
    { name: '古龙战甲', cost: 9500, damage: 0, minLevel: 1, dragonOnly: true, armor: 70 },
    { name: '不灭龙心', cost: 14000, damage: 0, minLevel: 1, dragonOnly: true, hp: 20000 },
    { name: '龙王壁垒', cost: 20000, damage: 0, minLevel: 1, dragonOnly: true, armor: 110 },
    ...require('./dragon-late-shop').DRAGON_LATE_GEAR
  ];
const TROLL_ARMOR_ITEMS=[
    { name: '皮甲', cost: 80, armor: 8 },
    { name: '锁甲', cost: 220, armor: 18 },
    { name: '板甲', cost: 480, armor: 32 },
    { name: '龙鳞甲', cost: 950, armor: 50 }
  ];
const TROLL_SPEED_SLOWDOWN=.5;
const TROLL_BOOTS={ name: '疾行靴', cost: 200, speedMul: 1 + (1 / TROLL_SPEED_SLOWDOWN - 1) * .3 };
module.exports={TROLL_SHOP_ITEMS,TROLL_ARMOR_ITEMS,TROLL_BOOTS};
