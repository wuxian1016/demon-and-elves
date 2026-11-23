'use strict';
const {TROLL_SHOP_ITEMS:weapons,TROLL_ARMOR_ITEMS:armor,TROLL_BOOTS:boots}=require('./demon-equipment-data');
function equipmentBenefit(t,base,{target=null,defenses=[],attacking=false,depth=0,allowDragonSurvival=true}={}){
 if(!base||base.dead||t.dead||!Number.isFinite(t.gold)||typeof t.affordableEquipmentCost!=='function')return null;
 const shop=Object.create(base);Object.defineProperties(shop,{upgradeCost:{value:()=>null},tryUpgrade:{value:()=>false}});
 const cost=t.affordableEquipmentCost(shop);if(!Number.isFinite(cost)||cost<=0||t.gold<cost)return null;
 let item,kind;
 if(!t.hasBoots&&t.aiBootsAllowedBH?.()!==false&&cost===(t.aiBootsCostBH?.()??boots.cost)){item=boots;kind='boots';}
 if(!item){item=armor.find(x=>x.cost===cost&&(t.armor||0)<x.armor);if(item)kind='armor';}
 if(!item){item=weapons.find(x=>x.cost===cost&&(!x.minLevel||(t.level||1)>=x.minLevel)&&(!x.minLevel||!t.ownedAdvancedWeapons?.has(x.name))&&(!x.dragonOnly||t.nextSurvivalItem?.()?.name===x.name)&&(!x.minLevel?(t.equipmentDamage||0)<x.damage*2:true));if(item)kind='weapon';}
 if(!item&&t.lateUpgradeCost?.(shop)===cost&&(t.lateUpgradeCd||0)<=0){item={damage:40,hp:1200};kind='late';}
 if(!item)return null;
 const before=typeof t.getDamage==='function'?t.getDamage():Math.max(1,(t.baseDamage||18)+(t.equipmentDamage||0)+((t.level||1)-1)*10);
 const probe=Object.create(t);probe.equipmentDamage=(t.equipmentDamage||0)+(kind==='late'?0:item.damage||0);if(kind==='late')probe.lateUpgradeLevel=(t.lateUpgradeLevel||0)+1;if(item.dragonDamage)probe.ownedAdvancedWeapons=new Set([...(t.ownedAdvancedWeapons||[]),item.name]);
 const after=typeof t.getDamage==='function'?t.getDamage.call(probe):before+(item.damage||0),gain=Math.max(0,after-before)/Math.max(1,before);
 // Finish a household already within three landed hits instead of abandoning
 // a nearly completed attack just because the purse crossed a price threshold.
 if(attacking&&target&&!target.dead&&Number.isFinite(target.hp)&&target.hp<=before*3)return null;
 const hitReduction=target&&Number.isFinite(target.hp)?Math.ceil(target.hp/Math.max(1,before))-Math.ceil(target.hp/Math.max(1,after)):0;
 const towers=defenses.filter(b=>!b.dead&&['tower','cannonTower','iceTower','manaTower'].includes(b.type));
 const armorGain=kind==='armor'?item.armor-(t.armor||0):(item.armor||0),healthGain=(item.hp||0)*(t.dragonModeHealthMultiplier?.()||1)/Math.max(1,t.maxHp||1);
 const pursuit=kind==='boots'&&!attacking&&target&&Math.hypot(target.x-t.x,target.y-t.y)>300;
 // Dragon survival tiers have zero attack damage but are permanent useful gear,
 // including against tanks or the next household; no current tower is required.
 const dragonSurvival=allowDragonSurvival&&!!t.dragonEvolved&&!!item.dragonOnly&&((item.hp||0)>0||armorGain>0||(item.dragonDamage||0)>0);
 if(!(dragonSurvival||gain>=.12||gain>=.03&&hitReduction>=2||towers.length>0&&(armorGain>=8||healthGain>=.12)||pursuit)){
  // Native shopping buys boots/armor before weapons. Check a finite affordable
  // bundle rather than rejecting a useful weapon hidden behind that prerequisite.
  if(depth>=3||!['boots','armor'].includes(kind))return null;
  const next=Object.create(t);next.gold=t.gold-cost;if(kind==='boots')next.hasBoots=true;else next.armor=item.armor;
  const more=equipmentBenefit(next,base,{target,defenses,attacking,depth:depth+1,allowDragonSurvival});return more?{...more,cost:cost+more.cost,kind:'bundle'}:null;
 }
 return {cost,kind,damageGain:gain,armorGain,healthGain,hitReduction};
}
module.exports={equipmentBenefit};
