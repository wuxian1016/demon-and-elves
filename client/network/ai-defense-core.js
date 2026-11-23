'use strict';
function installAiDefenseCore(game,{catalog=[],active=()=>true}={}){
 if(game.aiDefenseCoreAB)return game.aiDefenseCoreAB;
 require('./ai-economy-support').install(game,{active});
 require('./ai-grid-planning').installAiGridPlanning(game,{active});
 const original=game.planAllyDevelopment;if(typeof original!=='function')return null;
 const counts={upgradeOrders:0,buildOrders:0,savingTurns:0,workerOrders:0,legacyTurns:0};
 const cannon=Array.isArray(catalog)?catalog.find(e=>e.type==='cannonTower'):catalog.cannonTower;
 const migration=game.allyMigrationTarget,computeFlee=game.computeAllyFleeTarget;let migrationBypass=false,migrationHeldAlly=null;
 if(typeof migration==='function')Object.defineProperty(game,'allyMigrationTarget',{configurable:true,writable:true,enumerable:false,value:function(ally,enemy){
  if(!migrationBypass&&active()&&!this.tutorial&&!this.superChallenge580&&this.state==='hunt'&&ally&&!ally.dead&&!ally.defected&&ally.developmentProfile!=='fortress'&&enemy&&enemy===this.troll&&!enemy.dead&&!ally.evacuateTarget){
   const home=this.allyHome(ally),nearMinion=(this.hostileMinions?.()||[]).some(e=>e&&!e.dead&&Math.hypot(e.x-ally.x,e.y-ally.y)<=560);
   // Healthy ordinary camps first use the unchanged local escape planner.
   // A breached home, low HP, close demon or other near enemy keeps full evacuation.
   if(home&&home.hp>home.maxHp*.65&&ally.hp>=ally.maxHp*.55&&Math.hypot(enemy.x-ally.x,enemy.y-ally.y)>480&&!nearMinion){counts.migrationHeld=(counts.migrationHeld||0)+1;migrationHeldAlly=ally;return null;}
  }
  return migration.call(this,ally,enemy);
 }});
 if(typeof computeFlee==='function')Object.defineProperty(game,'computeAllyFleeTarget',{configurable:true,writable:true,enumerable:false,value:function(ally){
  const previousHeld=migrationHeldAlly,previousBypass=migrationBypass;migrationHeldAlly=null;
  try{let point=computeFlee.call(this,ally);if(!point&&migrationHeldAlly===ally){migrationBypass=true;point=computeFlee.call(this,ally);}return point;}
  finally{migrationHeldAlly=previousHeld;migrationBypass=previousBypass;}
 }});
 const emergency=game.tryAllyEmergencyDefense;
 if(typeof emergency==='function')game.tryAllyEmergencyDefense=function(ally){
  if(active()&&!this.tutorial&&['prep','hunt'].includes(this.state)&&ally&&!ally.dead&&!ally.defected){
   const home=this.allyHome(ally);
   if(home&&home.level>=3&&this.allyLumberjackCount(ally)<2&&this.allyPeasantCount(ally)<this.allyPeasantCap(ally)){
    const defenses=this.allyBuildings(ally).filter(b=>!b.dead),enemies=[this.troll,...(this.hostileMinions?.()||[])].filter(e=>e&&!e.dead);
    const imminent=defenses.some(b=>enemies.some(e=>e.target===b&&Math.hypot(e.x-b.x,e.y-b.y)<(e.attackReachFor?.(b)||((e.attackRange||22)+(b.radius||30)))+24&&b.hp<=2*(typeof e.getDamage==='function'?e.getDamage():e.damage||0)));
    // Original emergency upgrades use a broad65% health threshold. Only an
    // actual two-hit breach preempts the first two PAID wood workers here.
    if(!imminent&&this.tryAllyWorkforce(ally)){counts.workerOrders++;return true;}
   }
  }
  return emergency.call(this,ally);
 };

 game.planAllyDevelopment=function(ally,deferPlacement=false){
  const legacy=()=>{counts.legacyTurns++;return original.call(this,ally,deferPlacement);};
  if(!active()||this.tutorial||!ally||ally.dead||ally.defected||ally.evacuateTarget||!['prep','hunt'].includes(this.state))return legacy();
  // Match native migration: surviving old-camp guns do not defend the new home.
  const owned=this.allyBuildings(ally).filter(b=>!ally.resettled267||Math.hypot(b.x-ally.homeZone.x,b.y-ally.homeZone.y)<760),home=this.allyHome(ally),walls=owned.filter(b=>b.type==='wall'&&!b.dead);
  // Bootstrap income and a living screen remain prerequisites. A critical
  // breach/unsafe work point retains the original escape/repair priority.
  if(!home)return legacy();
  // A migrated camp needs a real paid screen before optional economy bodies.
  // Surviving abandoned walls cannot protect the replacement home.
  if(ally.resettled267&&!walls.length){
   const wallEntry=Array.isArray(catalog)?catalog.find(e=>e.type==='wall'):catalog.wall;
   if(wallEntry&&this.allyBuildUnlocked(ally,wallEntry)&&!this.allyDefenseSiteBlocked(ally,'wall')){
    if(!this.canAllySpend(ally,wallEntry,{wood:0,gold:0}))this.tryAllyTradeFor?.(ally,wallEntry);
    if(!this.canAllySpend(ally,wallEntry,{wood:0,gold:0})){ally.aiResourceGoal={wood:wallEntry.wood||0,gold:wallEntry.gold||0};counts.savingTurns++;return null;}
    ally.aiResourceGoal=null;if(deferPlacement)return{type:'planBuild',buildType:'wall'};
    const plan=this.planAllyBuild(ally,'wall',{wood:0,gold:0});if(plan){counts.buildOrders++;return plan;}
   }
  }
  const guns=owned.filter(b=>!b.dead&&!b.airDefenseKindBN&&['tower','iceTower','manaTower','cannonTower'].includes(b.type));
  const opening=(this.huntElapsed||0)<300,entry=Array.isArray(catalog)?catalog.find(e=>e.type==='cannonTower'):catalog.cannonTower;
  // Every profile first buys a firing line; watchtowers cannot replace a gun.
  // Uses native unlocks/planner/actual costs, without grants or free upgrades.
  if((opening||ally.resettled267)&&walls.length&&entry&&this.allyBuildUnlocked(ally,entry)&&!this.allyDefenseSiteBlocked(ally,entry.type)&&!guns.some(b=>b.type==='cannonTower')){
   if(!this.canAllySpend(ally,entry,{wood:0,gold:0}))this.tryAllyTradeFor?.(ally,entry);
   if(!this.canAllySpend(ally,entry,{wood:0,gold:0})){ally.aiResourceGoal={wood:entry.wood||0,gold:entry.gold||0};counts.savingTurns++;return null;}
   ally.aiResourceGoal=null;if(deferPlacement)return{type:'planBuild',buildType:entry.type};const plan=this.planAllyBuild(ally,entry.type,{wood:0,gold:0});if(plan)return plan;
  }
  if(home.level<2)return legacy();
  if(!owned.some(b=>b.type==='goldMine')||!walls.length||walls.some(b=>b.hp/b.maxHp<=.3))return legacy();
  const elapsed=this.huntElapsed||0,difficulty=this.trollDifficulty;
  const baseQuality=difficulty==='easy'?(elapsed<180?1:2):elapsed<120?2:elapsed<360?3:elapsed<600?4:6;
  const quality=(difficulty==='crazy'||this.superChallenge580)&&elapsed>=480?(elapsed<600?6:elapsed<900?8:10):baseQuality;
  const fortress=ally.developmentProfile==='fortress'||this.superChallenge580;
  const desired=fortress?(elapsed<180?1:elapsed<300?2:elapsed<480?4:6):(elapsed<180?1:elapsed<480?2:elapsed<960?3:4),cannons=owned.filter(b=>b.type==='cannonTower'&&!b.dead);
  // Ordinary paid camps complete a modest level3 gate row before optional
  // economy. Do not leave two sides at level1 while upgrading only the centre.
  if(!fortress&&elapsed>=180&&home.level>=3&&cannons.filter(b=>b.level>=3).length>=2){
   const gate=walls.filter(b=>b.level<Math.min(3,b.maxUpgradeLevel())&&!this.buildingUpgradeBlockReason(b,ally.slot)).sort((a,b)=>a.level-b.level||a.hp/a.maxHp-b.hp/b.maxHp)[0];
   if(gate&&this.allyWorkPointSafe(ally,gate)){
    const cost=gate.upgradeCost(),capacity=this.ownerStorageCapacity(ally.slot);
    if(cost&&cost.wood<=capacity.wood&&cost.gold<=capacity.gold){
     if(!this.canAllySpend(ally,cost,{wood:0,gold:0}))this.tryAllyTradeFor?.(ally,cost);
     if(!this.canAllySpend(ally,cost,{wood:0,gold:0})){ally.aiResourceGoal={wood:cost.wood||0,gold:cost.gold||0};counts.savingTurns++;return null;}
     ally.aiResourceGoal=null;counts.upgradeOrders++;return{type:'upgrade',target:gate};
    }
   }
  }
  // Two functioning guns need one finite late-game screen, before buying
  // fifth/sixth gun levels. Native emergency repair/unlocks/payment still run.
  if((difficulty==='crazy'||this.superChallenge580)&&elapsed>=600&&home.level>=3&&guns.filter(b=>b.level>=3).length>=2&&!walls.some(b=>b.level>=10)){
   const screen=walls.filter(b=>Number.isFinite(b.level)&&b.level<Math.min(10,b.maxUpgradeLevel())&&!this.buildingUpgradeBlockReason(b,ally.slot)).sort((a,b)=>b.level-a.level||a.hp/a.maxHp-b.hp/b.maxHp)[0];
   if(screen&&this.allyWorkPointSafe(ally,screen)){
    const cost=screen.upgradeCost(),capacity=this.ownerStorageCapacity(ally.slot);
    if(cost&&cost.wood<=capacity.wood&&cost.gold<=capacity.gold){
     if(!this.canAllySpend(ally,cost,{wood:0,gold:0}))this.tryAllyTradeFor?.(ally,cost);
     if(!this.canAllySpend(ally,cost,{wood:0,gold:0})){ally.aiResourceGoal={wood:cost.wood||0,gold:cost.gold||0};counts.savingTurns++;return null;}
     ally.aiResourceGoal=null;counts.upgradeOrders++;return{type:'upgrade',target:screen};
    }
   }
  }
  // Finish a modest firing line before repeatedly raising only two/three guns.
  const profileQuality=fortress?quality:Math.min(quality,elapsed<600?3:elapsed<960?6:8);
  const purchaseQuality=cannons.length<desired?Math.min(profileQuality,elapsed<300?3:4):profileQuality;
  let target=cannons.filter(b=>b.level<purchaseQuality&&b.level<b.maxUpgradeLevel()&&!this.buildingUpgradeBlockReason(b,ally.slot)).sort((a,b)=>a.level-b.level)[0];
  const build=!target&&cannons.length<desired&&cannon&&this.allyBuildUnlocked(ally,cannon)&&!this.allyDefenseSiteBlocked(ally,'cannonTower');
  if(!target&&!build)return legacy();
  if(target&&!this.allyWorkPointSafe(ally,target))return legacy();
  const cost=target?target.upgradeCost():cannon,capacity=this.ownerStorageCapacity(ally.slot);
  if(!cost||cost.wood>capacity.wood||cost.gold>capacity.gold)return legacy();
  if(!this.canAllySpend(ally,cost,{wood:0,gold:0}))this.tryAllyTradeFor?.(ally,cost);
  if(!this.canAllySpend(ally,cost,{wood:0,gold:0})){
   // Reserve a finite DPS milestone rather than letting every cheap optional
   // wall upgrade consume its funds. Gathering/trade and eventual payment are
   // the original real-resource jobs; this never grants currency/buildings.
   ally.aiResourceGoal={wood:cost.wood||0,gold:cost.gold||0};counts.savingTurns++;return null;
  }
  ally.aiResourceGoal=null;
  if(target){counts.upgradeOrders++;return {type:'upgrade',target};}
  if(deferPlacement){counts.buildOrders++;return {type:'planBuild',buildType:'cannonTower'};}
  const plan=this.planAllyBuild(ally,'cannonTower',{wood:0,gold:0});if(!plan)return legacy();counts.buildOrders++;return plan;
 };
 return game.aiDefenseCoreAB={original,originalEmergency:emergency,stats:()=>({...counts})};
}
module.exports={installAiDefenseCore};
