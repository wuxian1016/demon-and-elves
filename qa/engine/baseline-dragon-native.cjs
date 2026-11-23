'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),a=require('node:assert/strict');
const {makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const root=process.argv[2];
const W=fs.mkdtempSync(path.join(os.tmpdir(),'cow8c-baseline-dragon-'));
fs.writeFileSync(path.join(W,'keys.json'),'{}');
const h=makeHost(root,W,false,{width:390,height:844,seed:150});
(async()=>{
 h.start();
 await until(()=>h.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','native pending Home',25000);
 const {window:w}=h.env(),g=w.game,types=w.originalNetwork627.types;
 g.state='hunt';g.tutorial=null;g.superChallenge580=false;g.trollDifficulty='medium';g.allySlots.fill(false);
 const t=g.troll,gold=3500;g.huntElapsed=1600;g.supportTime=1600000;g.trollBase.level=5;
 Object.assign(t,{level:16,gold,evolved:true,dragonEvolved:true,hasBoots:true,armor:50,x:g.trollBase.x,y:g.trollBase.y+g.trollBase.radius+40,
 state:'patrol',attackCd:1e8,equipmentDamage:900,survivalPurchaseCd:0});
 const prior=['裂城巨斧','炼狱重锤','深渊战刃','灭城魔戟','末日王者战斧','暮蚀巨刃'];
 const dragon=['龙血护符','黑曜护腕','熔火之心','古龙战甲','龙焰尖牙','不灭龙心','赤焰龙爪','龙王壁垒','烬牙利爪','龙王壁垒Ⅱ','裂穹龙刃','龙王壁垒Ⅲ'];
 t.ownedAdvancedWeapons.clear();for(const k of prior)t.ownedAdvancedWeapons.add(k);
 const take=()=>t.dragonEquipmentDamageBN();const baseline=take(),counts=[],dmg1=t.getDamage();
 for(const k of dragon){t.ownedAdvancedWeapons.add(k);counts.push([k,take()]);}
 a.equal(baseline,0);a.equal(counts.at(-1)[1],1530);a.equal(counts[0][1],35);a.equal(counts[2][1]-counts[1][1],55);a.equal(counts[10][1]-counts[9][1],165);
 const dmg2=t.getDamage();a(dmg2>dmg1);
 const range=t.breathRange,half=t.breathHalfAngle;
 a(range>0&&half>0);
 const stroke=(building,angle=0)=>{
  const C=building?types.Building:types.Player;
  const d=Math.min(range*.55,Math.max(35,t.radius*1.1)),target=new C(t.x+Math.cos(angle)*d,t.y+Math.sin(angle)*d,building?'wall':null);
  target.hp=target.maxHp=1e5;target.invincibleTime=0;target.doubleZapBN=false;
  t.playAttack(target);t.applyAttackDamage(target,building?[]:[target],building?[target]:[],[],false);
  return target.maxHp-target.hp;
 };
 const damage={player:stroke(false),wall:stroke(true)};a(damage.player>0&&damage.wall>0);
 const snap=g.serializeProgress();a(g.loadProgress(snap));a.equal(g.troll.gold,gold);a.equal(g.troll.dragonEquipmentDamageBN(),1530);
 const t2=g.troll;g.superChallenge580=true;a.equal(t2.dragonEquipmentDamageBN(),165);g.superChallenge580=false;
 w.networkDefenseModeBN=()=>true;a.equal(t2.dragonEquipmentDamageBN(),165);
 t2.dragonEvolved=false;a.equal(t2.dragonEquipmentDamageBN(),0);
 console.log(JSON.stringify({equipmentNative:counts,mediumSoloAttackBefore:dmg1,mediumSoloAttackAfter:dmg2,attackDamageShapes:damage,range,half,
 saveRoundTripGold:gold,challengeOrOnlineGearBonus:165,nonDragonBonus:0,method:'live R93-derived COW8C native game in fake wx, normal ground terrain and gear functions'}));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>h.close());
