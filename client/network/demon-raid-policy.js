const {install:installAiBootsProgression}=require('./ai-boots-progression.js');
const {installSoloPlayerPressure}=require('./solo-player-pressure.js');
const {defenseStrength}=require('./defense-strength.js');
const {installFirstFormSpeed}=require('./first-form-speed.js');
const {installOpeningPatrolLottery,openingDraw}=require('./opening-patrol-lottery.js');
// First-sortie blind random exploration, then LOCAL discovered raid, then GLOBAL knowledge only after completed supply. Shared online/offline AI; player fog remains unchanged.
const {equipmentBenefit}=require('./demon-equipment-benefit');
const DEFENSE=new Set(['tower','cannonTower','iceTower','manaTower','watchtower']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const seedOf=text=>{let s=2166136261;for(const c of String(text))s=Math.imul(s^c.charCodeAt(0),16777619);return s>>>0;};
function installMultiplayerDemonRaid(battle,{random}={}){
 const g=battle.g,t=g.troll;let rng=seedOf(battle.id);
 // This entry is the computer-demon authority; never installed on a human-controlled demon.
 installAiBootsProgression(g,{active:()=>battle.policyActive?.()!==false});
 const draw=random||(()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;state.rng=rng;return rng/4294967296;});
 const threshold=()=>110000+Math.floor(Math.max(0,Math.min(.999999999,draw()))*20001);
 const state={schema:1,rng,knownFirstEntity:null,needsRespawnDeparture:false,firstRaidEngaged:false,everEngaged:false,dragonKnowledge:false,phase:'search',reviewed:false,reviews:0,lastReview:null,globalComparisons:0,globalUnlockedAt:null,omniscient:false,owner:null,first:true,elapsed:0,limit:0,engaged:false,idleCombatMs:0,purchasePending:false,purchaseStay:0,forcedTrips:0,rotations:0,healthReturnPending:false,clock:0,selectedAt:0,actionAt:null,movedAt:null,warningLeft:0,selectionSerial:0,cleanupSelection:0,cleanupZoneIndex:0,equipmentChecks:0,equipmentNextCheckAt:0,equipmentLastTripAt:null,equipmentTrips:0,equipmentTrip:false,equipmentBaselineDamage:0,equipmentBaselineArmor:0,equipmentBaselineBoots:false,equipmentBaselineHealth:0,equipmentFailedTrips:0,equipmentRequiresCombatGain:false,nextRaidReviewAt:0,lastDestructionAt:0,ownerActiveMs:0,escapeOwner:null,escapeUntil:0};
 // Persist data only. Runtime methods remain non-enumerable and are reattached
 // after a load; the native save graph must never encounter closures.
 const saved=t.raidPolicyStateAB;
 if(saved&&saved.schema===1){
  for(const key of Object.keys(state)){
   if(['schema','knownFirstEntity','phase','owner','escapeOwner','lastReview'].includes(key)||!Object.hasOwn(saved,key))continue;
   const value=saved[key],kind=typeof state[key];
   if(kind==='boolean'&&typeof value==='boolean'||kind==='number'&&Number.isFinite(value)&&value>=0||state[key]===null&&(value===null||Number.isFinite(value)&&value>=0))state[key]=value;
  }
  if(['search','local','global','return'].includes(saved.phase))state.phase=saved.phase;
  if(saved.owner===null||typeof saved.owner==='string'&&saved.owner.length<=128)state.owner=saved.owner;
  if(saved.escapeOwner===null||typeof saved.escapeOwner==='string'&&saved.escapeOwner.length<=128)state.escapeOwner=saved.escapeOwner;
  if(saved.knownFirstEntity instanceof battle.types.Building||(g.allies||[]).includes(saved.knownFirstEntity)||battle.players.some(p=>p.body===saved.knownFirstEntity))state.knownFirstEntity=saved.knownFirstEntity;
  if(saved.lastReview&&Number.isFinite(saved.lastReview.at)&&typeof saved.lastReview.needsPurchase==='boolean')state.lastReview={at:saved.lastReview.at,owner:typeof saved.lastReview.owner==='string'?saved.lastReview.owner:null,nextOwner:typeof saved.lastReview.nextOwner==='string'?saved.lastReview.nextOwner:null,needsPurchase:saved.lastReview.needsPurchase};
  state.everEngaged=state.everEngaged||state.firstRaidEngaged||state.engaged||!state.first;
  rng=Number.isInteger(state.rng)&&state.rng<=4294967295?state.rng:seedOf(battle.id);state.rng=rng;
 }
 t.raidPolicyStateAB=state;
 const soloPressure=installSoloPlayerPressure(battle,random||(()=>openingDraw(battle)));
 const collectParticipants=()=>{const ids=new Set([...battle.players.filter(p=>!battle.offline?.has(p.id)).map(p=>p.id),...(g.allies||[]).filter(a=>!a.defected).map(a=>battle.ownerIdForEngineSlot(a.slot))]);if(t.dragonEvolved)for(const b of g.buildings||[])if(!b.dead&&b instanceof battle.types.Building){const owner=ownerOf(b);if(owner)ids.add(owner);}return ids;};
 let frameParticipants=null;const participants=()=>frameParticipants||collectParticipants();
 const multiplayerRoster=battle.players.length+(g.allies||[]).length>1||battle.soloMultiAi===true&&t.soloPlayerPressureBG?.armed===true;
 const enabled=()=>battle.policyActive?.()!==false&&!g.tutorial&&(!g.superChallenge580||t.dragonEvolved)&&multiplayerRoster;
 const ownerOf=e=>{
  if(!e)return null;const human=battle.contexts.playerForBody(e);if(human)return human.id;
  const known=battle.owners.get(e);if(known)return known;
  if((g.allies||[]).includes(e))return battle.ownerIdForEngineSlot(e.slot);
  if(!(e instanceof battle.types.Building))return null;
  return battle.ownerIdForEngineSlot(battle.contexts.canonicalSlot(e.ownerSlot??null));
 };
 const livingElf=owner=>{const human=battle.players.find(p=>p.id===owner&&!battle.offline?.has(p.id));if(human?.body&&!human.body.dead)return human.body;return (g.allies||[]).find(a=>!a.dead&&!a.defected&&battle.ownerIdForEngineSlot(a.slot)===owner)||null;};
 const groups=()=>{
  const result=new Map();if(!state.omniscient)return result;state.globalComparisons++;const active=participants();
  for(const building of g.buildings){if(building.dead)continue;const owner=ownerOf(building);if(!active.has(owner))continue;
   let group=result.get(owner);if(!group)result.set(owner,group={owner,buildings:[],score:0,towerCount:0,totalLevel:0,wallLevel:0,wallCount:0,anchor:building});
   group.buildings.push(building);if(building.type==='house'&&(group.anchor.type!=='house'||building.isInitialBase))group.anchor=building;
   if(DEFENSE.has(building.type)){const level=Number.isFinite(building.level)?Math.max(1,Math.floor(building.level)):1;group.score+=1+level*level;group.towerCount++;group.totalLevel+=level;}else if(building.type==='wall'){group.wallCount++;group.wallLevel+=Number.isFinite(building.level)?Math.max(1,Math.floor(building.level)):1;}
  }
  // A household is unfinished until BOTH its buildings and elf are gone.
  // Global permission is already checked above; never exposes these bodies on first sortie.
  for(const owner of active)if(!result.has(owner)){const elf=livingElf(owner);if(elf)result.set(owner,{owner,buildings:[],score:0,towerCount:0,totalLevel:0,wallLevel:0,wallCount:0,anchor:elf});}
  return result;
 };
 const clearCombat=()=>{g.demonMoveBlocker=null;g.clearUnitNavigation?.(t);t.target=null;t.lastSeen=null;t.searchPoint=null;t.trackClue=null;t.memoryTimer=0;t.patrolTarget=null;};
 const resetTimer=()=>{state.elapsed=0;state.engaged=false;state.idleCombatMs=0;state.reviewed=false;state.limit=state.first?threshold():120000;};
 const assign=(group,forceClear=false)=>{
  const changed=state.owner!==(group?.owner??null);state.owner=group?.owner??null;resetTimer();if(changed){soloPressure.departed();state.ownerActiveMs=0;state.nextRaidReviewAt=g.superChallenge580?120000:90000;state.lastDestructionAt=state.clock;}
  if(changed||forceClear)clearCombat();if(changed)state.rotations++;
  if(group&&(changed||forceClear)){state.selectedAt=state.clock;state.actionAt=null;state.movedAt=null;state.warningLeft=50000;state.selectionSerial++;}
  if(group){if(!t.raidAnchor||t.raidAnchor.x!==group.anchor.x||t.raidAnchor.y!==group.anchor.y)t.raidAnchor={x:group.anchor.x,y:group.anchor.y};}else t.raidAnchor=null;
  if(group&&(changed||forceClear)&&!t.dead&&t.state!=='frozen'){const target=raid.call(t,group.buildings);if(target){t.target=target;t.state='attack';t.navGoalId=target;const approach=g.demonAttackApproach?.(t,target);if(approach)g.demonRouteWaypoint?.(t,approach,target);}}
 };
 // Ordinary known camps use composite defenses; challenge preserves the legacy ordering.
 // A dispersed household remains alive, but a far-away survivor without a
 // home is not an undefended base to raid repeatedly after every supply trip.
 // This comparison is legal only after global knowledge was already unlocked.
 // All-dispersed rosters fall back to the normal rank; coming back into view
 // immediately makes the household eligible at the next scheduled selection.
 const dispersed=group=>{if(g.superChallenge580||!state.omniscient)return false;const elf=livingElf(group.owner);if(!elf||distance(t,elf)<=Math.max(500,t.viewRange||0))return false;return !group.buildings.some(b=>b.type==='house'&&!b.dead)||(group.owner===state.escapeOwner&&state.clock<state.escapeUntil);};
 const weakest=(all=groups())=>{const preferred=soloPressure.preferred();if(preferred&&all.has(preferred))return all.get(preferred);if(!g.superChallenge580)for(const group of all.values())group.strength=defenseStrength(group.buildings);return [...all.values()].sort((a,b)=>Number(dispersed(a))-Number(dispersed(b))||(!g.superChallenge580?((a.strength?.score||0)-(b.strength?.score||0)||(Number(b.owner===state.owner)-Number(a.owner===state.owner))):0)||a.towerCount-b.towerCount||a.totalLevel-b.totalLevel||a.wallLevel-b.wallLevel||a.wallCount-b.wallCount||(Number(b.owner===state.owner)-Number(a.owner===state.owner))||distance(t,a.anchor)-distance(t,b.anchor)||(a.owner<b.owner?-1:a.owner>b.owner?1:0))[0]||null;};
 const abandonLocal=()=>{state.equipmentTrip=false;state.knownFirstEntity=null;if(state.first)state.firstRaidEngaged=false;clearCombat();t.raidAnchor=null;state.owner=null;state.elapsed=0;state.engaged=false;state.warningLeft=0;state.purchasePending=false;state.purchaseStay=0;state.healthReturnPending=false;state.phase=state.omniscient?'global':'search';};
 const unlockAfterSupply=()=>{soloPressure.departed();if(state.equipmentTrip)state.equipmentLastTripAt=state.clock;state.equipmentTrip=false;state.needsRespawnDeparture=false;if(state.first&&!state.firstRaidEngaged){abandonLocal();return;}state.purchasePending=false;state.purchaseStay=0;state.healthReturnPending=false;t.shopping=false;t.shopProgress=null;if(!state.omniscient){state.omniscient=true;state.globalUnlockedAt=state.clock;}state.first=false;state.phase='global';assign(weakest(),true);};
 const equipmentPlan=(base)=>{
  // Every procurement entry point, including the 90s strategic review, uses
  // the same dragon combat protection and existing trip cooldown.
  if(t.dragonEvolved&&!g.superChallenge580&&!g.tutorial){
   if(state.clock-state.selectedAt<45000)return null;
   if(state.equipmentLastTripAt!=null&&state.clock-state.equipmentLastTripAt<90000)return null;
   if(typeof t.canStartDragonShoppingBN==='function'&&!t.canStartDragonShoppingBN(base,g))return null;
  }
  return equipmentBenefit(t,base,{allowDragonSurvival:!g.superChallenge580&&!g.tutorial,target:t.target,defenses:g.buildings.filter(b=>!b.dead&&ownerOf(b)===state.owner),attacking:['attack','chase'].includes(t.state)&&!!t.target});
 };
 const beginEquipmentTrip=(plan)=>{state.equipmentRequiresCombatGain=plan?.kind==='bundle';state.equipmentTrip=typeof t.autoBuyEquipment==='function';state.equipmentTrips++;state.equipmentLastTripAt=state.clock;state.equipmentBaselineDamage=typeof t.getDamage==='function'?t.getDamage():0;state.equipmentBaselineArmor=(t.armor||0)+(t.weaponArmor||0);state.equipmentBaselineBoots=!!t.hasBoots;state.equipmentBaselineHealth=t.maxHp||0;state.phase='return';state.elapsed=0;state.engaged=false;state.warningLeft=0;state.purchasePending=true;state.purchaseStay=0;state.forcedTrips++;clearCombat();t.shopping=false;t.shopProgress=null;};
 const equipmentImproved=()=>typeof t.getDamage==='function'&&t.getDamage()>state.equipmentBaselineDamage||(t.armor||0)+(t.weaponArmor||0)>state.equipmentBaselineArmor||!!t.hasBoots&&!state.equipmentBaselineBoots&&!state.equipmentRequiresCombatGain||(t.maxHp||0)>state.equipmentBaselineHealth;
 // A deliberate equipment trip reserves native gold for actual gear. Only
 // while physically at the living base, skip base-only upgrades in this
 // purchase pass; the original equipment method still checks/spends every coin.
 const buy=t.autoBuyEquipment;if(typeof buy==='function')t.autoBuyEquipment=function(base,...args){if(this!==t||!enabled()||!state.equipmentTrip)return buy.call(this,base,...args);if(!base||base.dead||!base.inSupplyRange(this))return null;const gearBase=Object.create(base);Object.defineProperties(gearBase,{upgradeCost:{value:()=>null},tryUpgrade:{value:()=>false}});return buy.call(this,gearBase,...args);};
 const retargetMissing=()=>{if(!state.omniscient){
  const survivor=livingElf(state.owner);
  if(!g.superChallenge580&&survivor&&!survivor.inHouse&&distance(t,survivor)<=Math.max(500,t.viewRange||0))return null;
  // Finishing/losing the discovered camp after combat must not erase the
  // first sortie forever. Return through the real supply path before learning
  // other camps; do not grant hidden knowledge here.
  const base=g.trollBase;
  if(!g.superChallenge580&&state.firstRaidEngaged&&base&&!base.dead){state.escapeOwner=state.owner;state.escapeUntil=state.clock+120000;state.phase='return';state.owner=null;state.elapsed=0;state.engaged=false;state.warningLeft=0;state.purchasePending=true;state.purchaseStay=0;state.forcedTrips++;clearCombat();t.shopping=false;t.shopProgress=null;}
  else abandonLocal();return null;}const all=groups();if(all.has(state.owner))return all.get(state.owner);assign(weakest(all),true);return all.get(state.owner)||null;};
 const remember=t.rememberPossibleElfBase;
 t.rememberPossibleElfBase=function(building,...args){if(this===t&&enabled()&&state.owner)return;const result=remember.call(this,building,...args);
  if(this===t&&enabled()&&!state.owner&&!building?.dead){const owner=ownerOf(building);if(owner&&participants().has(owner)){state.knownFirstEntity=building;state.phase=state.omniscient?'global':'local';assign({owner,anchor:building,buildings:[building]});}}
  return result;
 };
 const raid=t.raidBuildingTarget;
 t.raidBuildingTarget=function(buildings){
  if(this!==t||!enabled())return raid.call(this,buildings);
  if(!state.owner){const discovered=raid.call(this,buildings);if(discovered&&!discovered.dead)this.rememberPossibleElfBase(discovered);return discovered;}
  if(state.purchasePending)return null;
  if(state.omniscient&&soloPressure.preferred()===state.owner){
   const elf=livingElf(state.owner),shelter=elf?.inHouse;
   // The occupied shelter/vehicle is the legal way to reach its hidden driver.
   if(elf?.drivingTank&&!elf.drivingTank.dead)return null;
   if(shelter instanceof battle.types.Building&&!shelter.dead&&(buildings||[]).includes(shelter)&&!g.isDemonBuildingDeferred?.(this,shelter))return raid.call(this,[shelter])||shelter;
  }
  const active=participants();let owned=(buildings||[]).filter(b=>!b.dead&&ownerOf(b)===state.owner&&active.has(state.owner));
  if(!owned.length&&!state.omniscient&&state.knownFirstEntity&&!state.knownFirstEntity.dead)return null;
  if(!owned.length){retargetMissing();owned=(buildings||[]).filter(b=>!b.dead&&ownerOf(b)===state.owner);}
  if(!owned.length)return null;
  if(!state.omniscient)return raid.call(this,owned);
  const anchor=owned.find(b=>b.type==='house')||owned[0];if(!this.raidAnchor||this.raidAnchor.x!==anchor.x||this.raidAnchor.y!==anchor.y)this.raidAnchor={x:anchor.x,y:anchor.y};
  return raid.call(this,owned)||owned.filter(b=>!g.isDemonBuildingDeferred?.(this,b)).sort((a,b)=>distance(this,a)-distance(this,b))[0]||null;
 };
 const seen=t.nearestElfBySmartVision;
 t.nearestElfBySmartVision=function(elves){
  if(this!==t||!enabled())return seen.call(this,elves);
  if(state.omniscient&&state.owner){const elf=livingElf(state.owner);return elf&&!elf.inHouse&&!elf.drivingTank&&!g.isChaseTargetDeferred?.(this,elf)?{elf,d:distance(this,elf)}:null;}
  const result=seen.call(this,state.owner?(elves||[]).filter(e=>distance(this,e)<=Math.max(500,this.viewRange||0)):elves);
  if(!state.owner&&result?.elf){const owner=ownerOf(result.elf);if(owner&&participants().has(owner)){state.knownFirstEntity=result.elf;state.phase=state.omniscient?'global':'local';assign({owner,anchor:result.elf,buildings:[]});}}
  return result;
 };
 // Preserve wall-first movement and contact locks. Only an immediately
 // legal melee hit may beat an unrelated side wall at final arbitration.
 const nearby=t.nearbyPriorityTarget;
 if(typeof nearby==='function')t.nearbyPriorityTarget=function(buildings,characters,vehicles=[],rejected=null){
  const chosen=nearby.call(this,buildings,characters,vehicles,rejected);
  if(this!==t||!enabled()||g.superChallenge580||this.dragonEvolved||!state.omniscient||!state.owner||this.dead||this.retreating||state.purchasePending||state.healthReturnPending||this.attackCd>0)return chosen;
  if(g.demonMoveBlocker&&!g.demonMoveBlocker.dead)return chosen;
  if(chosen===this.target&&chosen instanceof battle.types.Building&&chosen.type==='wall'&&distance(this,chosen)<=this.attackReachFor(chosen)+24)return chosen;
  if(typeof g.demonLineBlocked!=='function'||typeof g.demonBlockingBuilding!=='function')return chosen;
  const immediate=(characters||[]).filter(e=>e&&!e.dead&&!e.inHouse&&!e.drivingTank&&!(e.invincibleTime>0)&&!g.isChaseTargetDeferred?.(this,e)&&distance(this,e)<this.attackReachFor(e)-4);
  const visible=seen.call(this,immediate),elf=visible?.elf;
  if(!elf||!immediate.includes(elf)||g.demonLineBlocked(this,elf,0,true)||g.demonBlockingBuilding(this,this,elf))return chosen;
  return elf;
 };
 const retreat=t.shouldRetreat;
 t.shouldRetreat=function(base){const wasRetreating=!!this.retreating,normal=retreat.call(this,base);
  // A real low-health defense still counts during an already pending shopping trip.
  // Procurement alone is not a repel: native retreat and prior human engagement are required.
  if(this===t&&enabled()&&normal&&this.hp<this.maxHp*.3)soloPressure.repelled();
  if(this===t&&enabled()&&state.owner&&!state.purchasePending){if(normal){state.healthReturnPending=true;state.phase='return';state.warningLeft=0;}else if((wasRetreating||state.healthReturnPending)&&base&&!base.dead&&base.inSupplyRange(this)&&this.hp>=this.maxHp)unlockAfterSupply();else if(state.healthReturnPending&&(!base||base.dead))abandonLocal();}
  return normal||this===t&&enabled()&&state.purchasePending&&!!base&&!base.dead;};
 const shopping=t.updateShopping;
 t.updateShopping=function(...args){return this===t&&enabled()?false:shopping.apply(this,args);};
 // Keep the original RANDOM map survey. No public-seat priority, hidden
 // target list, defense lookup or global selection before first supply completion.
 // Initial travel pace ends at contact; combat/retreat retain original speed.
 for(const key of ['getMoveSpeed','getChaseSpeed']){const original=t[key];if(typeof original==='function')t[key]=function(...args){const speed=original.apply(this,args);return enabled()&&state.first&&!state.everEngaged&&!state.purchasePending&&!this.retreating?Math.max(speed,!state.owner&&['patrol','search','track'].includes(this.state)?Math.min(24,6+18*state.clock/10000):2.4):speed;};}
 let frameAttackWorld=null;
 const attack=t.applyAttackDamage;if(typeof attack==='function')t.applyAttackDamage=function(target,...args){if(enabled()&&state.owner&&ownerOf(target)===state.owner){state.engaged=true;state.everEngaged=true;if(state.first)state.firstRaidEngaged=true;state.warningLeft=0;}const alive=target&&!target.dead,beforeHp=target?.hp,damageArgs=frameAttackWorld?[frameAttackWorld.elves,frameAttackWorld.buildings,frameAttackWorld.tanks,...args.slice(3)]:args,result=attack.call(this,target,...damageArgs);if(enabled()&&alive){if(target.dead||Number.isFinite(beforeHp)&&target.hp<beforeHp)soloPressure.engage(ownerOf(target));if(target.dead&&!(target instanceof battle.types.Building))soloPressure.eliminated(ownerOf(target));}if(enabled()&&alive&&target.dead&&ownerOf(target)===state.owner)state.lastDestructionAt=state.clock;return result;};
 // Use native source ownership for tower projectiles/tanks as well as direct hits.
 const hurt=t.takeDamage;if(typeof hurt==='function')t.takeDamage=function(amount,source,...args){const hp=this.hp,result=hurt.call(this,amount,source,...args);if(this===t&&enabled()&&this.hp<hp){const slot=g.elfRewardOwnerSlot?.(source),owner=slot!==undefined?battle.ownerIdForEngineSlot(slot):ownerOf(source);if(owner===state.owner){soloPressure.engage(owner);if(soloPressure.snapshot()?.engaged){state.everEngaged=true;if(state.first)state.firstRaidEngaged=true;}}if(this.dead){soloPressure.repelled();if(soloPressure.snapshot()?.armed){state.needsRespawnDeparture=true;state.firstRaidEngaged=true;state.everEngaged=true;}}}return result;};
 // Summoned hounds/mini-demons and dragon projectiles can deliver the final hit.
 // Wave slimes never consume the demon's household allowance.
 const isDemonPressureSource=source=>source===t||!source?.waveHound&&((g.hounds||[]).includes(source)||(g.miniTrolls||[]).includes(source))||source?.kind==='dragonFire'&&(g.projectiles||[]).includes(source);
 soloPressure.observeBuildings({Building:battle.types.Building,ownerOf,isDemonSource:isDemonPressureSource});
 const pressureObserved=new WeakSet();
 const observePressureAllies=()=>{if(!battle.soloMultiAi||g.superChallenge580||g.tutorial)return;for(const ally of g.allies||[]){if(pressureObserved.has(ally)||typeof ally.takeDamage!=='function')continue;pressureObserved.add(ally);const hurt=ally.takeDamage;Object.defineProperty(ally,'takeDamage',{configurable:true,writable:true,enumerable:false,value:function(amount,source,...args){const alive=!this.dead,result=hurt.call(this,amount,source,...args);if(alive&&this.dead&&isDemonPressureSource(source))soloPressure.eliminated(ownerOf(this));return result;}});}};
 observePressureAllies();
 const gain=t.gainGold;
 if(typeof gain==='function')t.gainGold=function(amount){return gain.call(this,enabled()&&this.level===1&&!this.evolved&&!this.dragonEvolved?amount*1.15:amount);};
 const healers=new WeakSet();
 const fasterHeal=base=>{if(!base||healers.has(base)||typeof base.supplyHealPerSecond!=='function')return;healers.add(base);const heal=base.supplyHealPerSecond;base.supplyHealPerSecond=function(unit){const value=heal.call(this,unit);return enabled()&&unit===t?value*2:value;};Object.defineProperty(base,'supplyHealPerSecond',{enumerable:false});};
 const move=t.moveSmartToward;
 if(typeof move==='function')t.moveSmartToward=function(goal,...args){if(enabled()&&state.owner&&goal&&state.actionAt===null&&!state.purchasePending&&!this.retreating){state.actionAt=state.clock;}const x=this.x,y=this.y,result=move.call(this,goal,...args);if(enabled()&&state.owner&&state.movedAt===null&&distance(this,{x,y})>.001)state.movedAt=state.clock;return result;};
 // If native obstacle backoff temporarily hides the last building, stay on
 // the selected household's ORIGINAL gate route instead of surveying an
 // unrelated camp for a full backoff minute. Never bypass collision/defer,
 // change speed, or grant this knowledge before dragon evolution.
 const holdDragonCleanupRoute=()=>{
  if((!state.dragonKnowledge&&soloPressure.preferred()!==state.owner)||!state.owner||state.purchasePending||state.healthReturnPending||t.retreating||t.dead||t.state!=='patrol'||t.target)return;
  if(state.cleanupSelection===state.selectionSerial&&t.patrolTarget?.zoneIndex===state.cleanupZoneIndex)return;
  const anchor=g.buildings.find(b=>!b.dead&&ownerOf(b)===state.owner)||(soloPressure.preferred()===state.owner?livingElf(state.owner):null);
  if(!anchor||!t.searchZones?.length||typeof t.patrolWaypoints!=='function')return;
  let index=0;for(let i=1;i<t.searchZones.length;i++)if(distance(anchor,t.searchZones[i])<distance(anchor,t.searchZones[index]))index=i;
  const zone={...t.searchZones[index],zoneIndex:index};
  t.patrolTarget={...zone,waypoints:t.patrolWaypoints(zone),waypointIndex:0};state.cleanupSelection=state.selectionSerial;state.cleanupZoneIndex=index;
 };
 installOpeningPatrolLottery(battle,()=>openingDraw(battle));
 const update=t.update;
 t.update=function(dt,elves,buildings,hounds,tanks,base,clues){
  installOpeningPatrolLottery(battle,()=>openingDraw(battle));
  const previousParticipants=frameParticipants;frameParticipants=collectParticipants();try{
  if(this!==t||!enabled())return update.call(this,dt,elves,buildings,hounds,tanks,base,clues);
  // Let the native offline stun consume this frame before raid timers,
  // target reassignment or supply transitions can advance.
  if(battle.soloMultiAi===true&&!g.networkAuthorityPhases627&&!this.dead&&this.cardStormStunMs>0&&g.cardsCandidate?.consumeStormStun(this,dt))return;

  const step=Number.isFinite(dt)&&dt>0?dt:0;
  if(this.state!=='frozen'&&!this.dead){state.clock+=step;state.warningLeft=Math.max(0,state.warningLeft-step);}
  fasterHeal(base);observePressureAllies();
  if(!state.purchasePending&&state.owner&&!participants().has(state.owner))retargetMissing();
  if(state.needsRespawnDeparture&&!this.dead&&this.state!=='frozen'&&base&&!base.dead&&base.inSupplyRange(this)&&this.hp>=this.maxHp){state.needsRespawnDeparture=false;if(state.first)unlockAfterSupply();else{state.phase='global';assign(weakest(),true);}}
  if(this.dragonEvolved&&!state.dragonKnowledge){state.dragonKnowledge=true;state.omniscient=true;state.first=false;state.everEngaged=true;state.globalUnlockedAt??=state.clock;if(!state.owner&&!state.purchasePending&&!this.retreating&&!state.healthReturnPending)assign(weakest(),true);}
  const priority=soloPressure.preferred();
  if(state.omniscient&&priority&&state.owner!==priority&&!this.dead&&!this.retreating&&!state.purchasePending&&!state.healthReturnPending){const all=groups();if(all.has(priority))assign(all.get(priority),true);}
  // Once earned, pursue the human through native movement/combat arbitration,
  // rather than merely naming their owner while a nearby AI camp wins again.
  // Navigation still sees the complete world; a real foreign path blocker is
  // included so this never attacks through walls or disables collision.
  const pursuingHuman=state.omniscient&&priority===state.owner&&priority&&!this.dead&&!this.retreating&&!state.purchasePending&&!state.healthReturnPending;
  const humanBody=pursuingHuman?livingElf(priority):null;
  const blocker=pursuingHuman?g.demonMoveBlocker:null;
  const pursuitBuildings=pursuingHuman?(buildings||[]).filter(b=>ownerOf(b)===priority||b===blocker||b===humanBody?.inHouse):buildings;
  const pursuitElves=pursuingHuman?(elves||[]).filter(e=>e===humanBody):elves;
  const pursuitTanks=pursuingHuman?(tanks||[]).filter(v=>v.driver===humanBody||v.crew===humanBody||v.ownerSlot===null):tanks;
  // Primary-target filtering must not narrow native dragon splash victims.
  const previousAttackWorld=frameAttackWorld;frameAttackWorld=pursuingHuman?{elves,buildings,tanks}:null;
  let result;try{result=update.call(this,dt,pursuitElves,pursuitBuildings,hounds,pursuitTanks,base,clues);}finally{frameAttackWorld=previousAttackWorld;}
  holdDragonCleanupRoute();
  if(!Number.isFinite(dt)||dt<=0)return result;
  if(this.dead){soloPressure.repelled();if(!state.omniscient&&!(state.needsRespawnDeparture&&soloPressure.snapshot()?.armed))abandonLocal();else{state.needsRespawnDeparture=true;state.elapsed=0;state.engaged=false;state.warningLeft=0;state.purchasePending=false;state.purchaseStay=0;state.healthReturnPending=false;}return result;}
  if(state.purchasePending){
   if(!base||base.dead){if(state.omniscient){state.purchasePending=false;assign(weakest(),true);}else abandonLocal();return result;}
   if(base.inSupplyRange(this)){this.setMoveIntent?.(0,0);state.purchaseStay+=dt;if(state.purchaseStay>=3000&&this.hp>=this.maxHp&&(!state.equipmentTrip||equipmentImproved()))unlockAfterSupply();else if(state.equipmentTrip&&state.purchaseStay>=35000&&this.hp>=this.maxHp){state.equipmentFailedTrips++;unlockAfterSupply();}}
   else state.purchaseStay=0;
   return result;
  }
  if(!state.owner)return result;
  const target=this.target,owner=ownerOf(target),attacking=['attack','chase'].includes(this.state)&&owner===state.owner&&!target?.dead;
  if(this.retreating||this.state==='retreat'||this.state==='shopping'){state.phase='return';state.warningLeft=0;state.healthReturnPending=true;state.elapsed=0;state.engaged=false;return result;}
  if(state.healthReturnPending){if(base&&!base.dead&&base.inSupplyRange(this)&&this.hp>=this.maxHp)unlockAfterSupply();else if(!base||base.dead)abandonLocal();return result;}
  if(attacking&&target&&distance(this,target)<=this.attackReachFor(target)+8){state.engaged=true;state.everEngaged=true;if(state.first)state.firstRaidEngaged=true;state.warningLeft=0;}
  if(state.engaged)state.elapsed+=step;
  // Include committed approach/blocker combat, not just owner-matched hits.
  // Supply/retreat returned above; neither travel nor a foreign gate may lock forever.
  state.ownerActiveMs+=step;
  if(!state.first&&(g.superChallenge580?state.elapsed>120000&&!state.reviewed:state.ownerActiveMs>=Math.max(90000,state.nextRaidReviewAt||0))){
   state.nextRaidReviewAt=state.ownerActiveMs+30000;
   const walls=g.buildings.some(b=>!b.dead&&b.type==='wall'&&ownerOf(b)===state.owner);
   if(walls||(!g.superChallenge580&&state.clock-state.lastDestructionAt>=60000)){
    state.reviewed=true;state.reviews++;const all=groups();let next=weakest(all);
    // A stubborn weakest household is not an eternal lock. After ninety seconds
    // with no recent structure kill, try the next weakest known household.
    if(!g.superChallenge580&&soloPressure.preferred()!==state.owner&&next?.owner===state.owner&&state.clock-state.lastDestructionAt>=60000){const alternatives=new Map(all);alternatives.delete(state.owner);next=weakest(alternatives)||next;}
    // Read the original paid procurement eligibility. Purchases still execute
    // only through the engine at an alive base, never at the remote household.
    // A base-only upgrade is not an equipment need and cannot force this trip.
    const purchasePlan=equipmentPlan(base),needsPurchase=!!purchasePlan;
    state.lastReview={at:state.clock,owner:state.owner,nextOwner:next?.owner??null,needsPurchase};
    if(needsPurchase)beginEquipmentTrip(purchasePlan);
    else if(next&&next.owner!==state.owner)assign(next,true);
   }
  }
  // The first sortie keeps its original random/110–130s rules. Later,
  // re-evaluate newly affordable useful gear every5s with a90s return cooldown
  // and at least45s on the selected target. A live wall fight keeps its
  // existing120s review before this exception can interrupt it.
  if(!state.first&&!state.purchasePending&&state.owner&&state.clock>=state.equipmentNextCheckAt){
   state.equipmentNextCheckAt=state.clock+5000;
   const walls=g.buildings.some(b=>!b.dead&&b.type==='wall'&&ownerOf(b)===state.owner);
   if(state.clock-state.selectedAt>=45000&&(state.equipmentLastTripAt===null||state.clock-state.equipmentLastTripAt>=90000)&&(!attacking||!walls||state.reviewed)){
    state.equipmentChecks++;const plan=equipmentPlan(base);if(plan)beginEquipmentTrip(plan);
   }
  }
  if(state.first&&state.elapsed>=state.limit){
   state.phase='return';state.elapsed=0;state.engaged=false;state.warningLeft=0;state.purchasePending=!!base&&!base.dead;state.purchaseStay=0;
   if(state.purchasePending){state.forcedTrips++;clearCombat();this.shopping=false;this.shopProgress=null;}else if(state.omniscient)assign(weakest(),true);else abandonLocal();
  }
  return result;
  }finally{frameParticipants=previousParticipants;}
 };
 installFirstFormSpeed(g,t,()=>battle.policyActive?.()!==false);
 for(const key of ['takeDamage','rememberPossibleElfBase','raidBuildingTarget','nearestElfBySmartVision','nearbyPriorityTarget','shouldRetreat','updateShopping','getMoveSpeed','getChaseSpeed','applyAttackDamage','gainGold','moveSmartToward','autoBuyEquipment','update'])if(Object.hasOwn(t,key)&&typeof t[key]==='function')Object.defineProperty(t,key,{enumerable:false});
 // Runtime controller stays private; its plain data record is included only in native saves/checkpoints, never player projection.
 return {warningFor:owner=>enabled()&&state.owner===owner&&!t.dead&&!t.retreating&&!state.purchasePending&&!state.healthReturnPending&&!state.engaged?{active:true,remaining:Math.ceil(state.warningLeft/1000)}:null,snapshot:()=>{const {knownFirstEntity,rng,...row}=state;return {...row,soloPlayerPressure:soloPressure.snapshot()};},defenseScores:()=>!state.omniscient?[]:[...groups().values()].map(v=>({owner:v.owner,score:v.score,strength:g.superChallenge580?null:defenseStrength(v.buildings),totalLevel:v.totalLevel,towers:v.buildings.filter(b=>DEFENSE.has(b.type)).length})),enabled};
}

module.exports={installMultiplayerDemonRaid};
