'use strict';
// Isolated candidate only; disabled unless BOTH the offline authority and QA flag agree.
const WAREHOUSE_DAMAGE_MULTIPLIER=2.5, WAREHOUSE_TRIP_HITS=3;
const TIERS=[{hp:675,damage:8,steal:3,cap:10,reward:12},{hp:1013,damage:12,steal:5,cap:15,reward:16},{hp:1463,damage:16,steal:7,cap:20,reward:20}];
const batch=require('./bat-wave-roster');
const cargoVisual=require('./bat-cargo-visual');
const frameDraw=require('./bat-frame-draw');
const boostMonsterRewardBN=require('./monster-rewards');
const key=slot=>slot==null?'player':'ally:'+slot;
function isBatWave(wave){return Number.isInteger(wave)&&wave>=8&&(wave-8)%10===0;}
function waveTier(wave,schedule){return schedule===2&&isBatWave(wave)?1+(wave-8)/10:Math.max(1,Math.floor(wave/6));} // Legacy pending saves retain their original encounter tier.
function tierBounty(tier){return tier>=4?Math.min(40,22+2*(tier-4)):TIERS[tier-1].reward;}
function amount(v){return Number.isFinite(v)?Math.max(0,v):0;}
module.exports=function create({offline=()=>false,Image=null,imagePath=value=>value,healPerSecond=null,healFractionPerSecond=null,nativeText=x=>x,onlinePresentation=()=>false,scope=()=>true,isStormSource=()=>false}={}){
 const hitFeedback=require('./bat-hit-feedback')({nativeText});
 const laneFlight=require('./bat-fixed-route')(b=>b.batFlightOrdinalBN??((Number(String(b.batIdBN).split(':').pop())-1)&3),[-96,-32,32,96,-157,157,-218,218]),mobilePursuit=new WeakMap(),recentEscape=new WeakMap();
 const MOBILE_LEASH=340, LANE_RETIRE_MS=60000, CARGO_STALL_MS=30000, CARGO_MAX_RETURN_MS=240000;
 const legacyLaneSnapshot=new WeakMap(), overflowTargetRetry=new WeakMap();
 const art=[],attackArt=[];let flightReady=false,flightTask=null,flightRetryAfter=0,rear;const cargoOverlay=require('./bat-cargo-overlay')({Image,imagePath});
 function enabled(g){return g?.batWaveCandidateBN===true&&offline()===true&&scope(g)===true;}
 function menuEnabled(g){return enabled(g)||(g?.batOnlineCandidateUIBN===true&&g?.batAuthorityVersionBN==='bat-server-1'&&onlinePresentation()===true);}
 function log(g,type,data={}){const a=g.batWaveEventsBN||(g.batWaveEventsBN=[]);a.push({type,t:g.supportTime||0,...data});if(a.length>512)a.shift();}
 function owner(g,slot){return g.ownerWallet(slot);}
 function pending(g,slot,k,n){if(n<=0)return;const ledger=g.batResourceCreditsBN||(g.batResourceCreditsBN={}),id=key(slot);const e=ledger[id]||(ledger[id]={slot,gold:0,wood:0});e[k]+=n;}
 function drain(g){for(const e of Object.values(g.batResourceCreditsBN||{})){const w=owner(g,e.slot);if(!w)continue;for(const k of ['gold','wood']){const cap=k==='gold'?'maxGold':'maxWood',n=Math.min(e[k],Math.max(0,amount(w[cap])-amount(w[k])));w[k]+=n;e[k]-=n;}}}
 function laneOpen(g,lane){
  if(typeof g.waveLaneHasCompletedElfBuildingsBN==='function')return g.waveLaneHasCompletedElfBuildingsBN(lane);
  if(typeof g.waveLaneOccupancyBN==='function'&&Number.isFinite(g.navigationFrame)){
   let snapshot=legacyLaneSnapshot.get(g);
   if(!snapshot||snapshot.frame!==g.navigationFrame||snapshot.zones!==g.resourceZones){
    snapshot={frame:g.navigationFrame,zones:g.resourceZones,active:g.waveLaneOccupancyBN().active};legacyLaneSnapshot.set(g,snapshot);
   }
   return snapshot.active[lane]===true;
  }
  return typeof g.batLaneActiveBN!=='function'||g.batLaneActiveBN(lane);
 }
 function prunePending(g,clearedLane=null){
  const queue=g.batPendingWavesBN;if(!Array.isArray(queue))return;
  for(let k=queue.length-1;k>=0;k--){
   const q=queue[k];
   if(!q.countsBN){q.countsBN=q.lanes.map((_,i)=>i<q.cursor?0:i===q.cursor?4-q.inLane:4);q.cursor=0;q.inLane=0;}
   for(let i=0;i<q.lanes.length;i++)if(q.countsBN[i]&&(q.lanes[i]===clearedLane||!laneOpen(g,q.lanes[i])))q.countsBN[i]=0;
   if(q.countsBN.every(n=>n===0))queue.splice(k,1);
  }
 }
 function flushPending(g,Hound,population){
  if(!enabled(g))return 0;
  // Use the shared active-wave roster (including active return carriers),
  // not the still-visible bodies waiting out either lane-retirement delay.
  const admitted=Number.isFinite(population.count)?population.count:g.hounds.reduce((n,h)=>{
   if(h.dead||(!h.waveHound&&!h.waveBat)||(h.waveBat?Number.isFinite(h.batRetireAtBN):Number.isFinite(h.groundWaveRetireAtBN)))return n;
   return n+(h.slimeFragment575?.5:1);
  },0);
  let slots=Math.max(0,population.cap-admitted),made=0;
  const queue=g.batPendingWavesBN||(g.batPendingWavesBN=[]);
  prunePending(g);
  while(queue.length&&slots>=1){const q=queue[0];
   let checked=0;while(checked<q.lanes.length&&!q.countsBN[q.cursor]){q.cursor=(q.cursor+1)%q.lanes.length;checked++;}
   if(checked===q.lanes.length){queue.shift();continue;}
   const lane=q.lanes[q.cursor],roster=batch.pending(q),j=roster-q.countsBN[q.cursor];
   const tier=waveTier(q.wave,q.batScheduleBN),stats=tier>=4?{hp:Math.ceil((1350+180*(tier-4))*1.25),damage:2*(9+tier-4),steal:Math.min(12,7+tier-3),cap:20,reward:tierBounty(tier)}:TIERS[tier-1];
   const b=new Hound(g.trollBase.x+(j<4?j-1.5:((j-4)%2?1:-1)*(2.5+Math.floor((j-4)/2)))*90,g.trollBase.y+60+q.cursor*86,2,false),serial=(g.batWaveSerialBN||0)+1;
   Object.assign(b,{waveBat:true,enemyKind:'bat',airborne:true,waveHound:false,waveNumber:q.wave,waveZoneIndex:lane,batIdBN:`bat:${serial}`,batStatsBN:{...stats},maxHp:stats.hp,hp:stats.hp,batStateBN:'seek',batCargoBN:{},batDeliveredBN:{},batTimeBN:0,batNextHitBN:0,batSettledBN:false,batCargoVisualBN:'empty'});if(roster>batch.LEGACY)b.batFlightOrdinalBN=j;laneFlight.spawned(b,j);g.stampSoloWaveBountyR51?.(b,j,'bat',roster);g.syncWaveMonsterAtBirthBN?.(b);g.hounds.push(b);g.batWaveSerialBN=serial;slots--;made++;
   q.countsBN[q.cursor]--;q.cursor=(q.cursor+1)%q.lanes.length;if(q.countsBN.every(n=>n===0))queue.shift();
  }
  return made;
 }
 function spawn(g,Hound,wave,lanes,population){
  if(!enabled(g)||!isBatWave(wave))return false;
  const queue=g.batPendingWavesBN||(g.batPendingWavesBN=[]);
  if(wave>(g.batQueuedThroughBN||0)){const roster=batch.scheduled(wave);if(lanes.length){const row={wave,batScheduleBN:2,lanes:[...lanes],cursor:0,inLane:0,countsBN:lanes.map(()=>roster)};if(roster>batch.LEGACY)row.rosterBN=roster;queue.push(row);}g.batQueuedThroughBN=wave;}
  const made=flushPending(g,Hound,population);log(g,'wave-spawn',{wave,count:made,lanes:[...lanes],pending:queue.length,replacesCurrentSlimeWave:true});return true;
 }
 function target(g,b,openSlotOnly=false){
  const laneOf=x=>g.resourceZoneIndexFor401(x),lane=b.waveZoneIndex;
  const eligible=x=>x&&x!==g.trollBase&&!x.dead&&x.hp>0&&typeof x.takeDamage==='function';
  const buildings=g.buildings.filter(x=>eligible(x)&&laneOf(x)===lane);
  const rank=x=>x.type==='warehouse'?0:x.type==='goldMine'?1:2;
  const occupancy=new Map(),activeSlots=openSlotOnly?new Map():null;
  for(const h of g.hounds)if(!h.dead&&h.waveBat&&h.target){
   occupancy.set(h.target,(occupancy.get(h.target)||0)+1);
   if(activeSlots&&h!==b&&(h.batStateBN==='fly'||h.batStateBN==='attack')&&Number.isSafeInteger(h.batAttackSlotBN)&&h.batAttackSlotBN>=0&&h.batAttackSlotBN<6)activeSlots.set(h.target,(activeSlots.get(h.target)||0)|(1<<h.batAttackSlotBN));
  }
  let best=null,bestRank=Infinity,bestScore=Infinity;
  for(const w of buildings){if(activeSlots?.get(w)===63)continue;const priority=rank(w),score=(occupancy.get(w)||0)*180+Math.hypot(w.x-b.x,w.y-b.y);if(priority<bestRank||(priority===bestRank&&score<bestScore)){best=w;bestRank=priority;bestScore=score;}}
  if(best||openSlotOnly)return best;
  const escaped=recentEscape.get(b);
  for(const elf of [g.player,...(g.allies||[])]){if(!(escaped?.target===elf&&b.batTimeBN<escaped.until)&&eligible(elf)&&!elf.defected&&!elf.inHouse&&!elf.drivingTank&&!elf.inTank&&!elf.invincibleTime&&laneOf(elf)===lane){const score=Math.hypot(elf.x-b.x,elf.y-b.y);if(score<bestScore){best=elf;bestScore=score;}}}
  return best;
 }
 function canFollowMobile(g,b){
  const t=b.target;if(t.type)return true;
  if(t.defected||t.inHouse||t.inTank||t.drivingTank||t.invincibleTime)return false;
  let guard=mobilePursuit.get(b);if(!guard||guard.target!==t){guard={target:t,x:t.x,y:t.y,nextLaneCheck:0};mobilePursuit.set(b,guard);}
  if((t.x-guard.x)**2+(t.y-guard.y)**2>MOBILE_LEASH**2)return false;
  if(b.batTimeBN>=guard.nextLaneCheck){guard.nextLaneCheck=b.batTimeBN+350;return g.resourceZoneIndexFor401(t)===b.waveZoneIndex;}
  return true;
 }
 function abandonMobile(g,b){mobilePursuit.set(b,{rejoining:true,target:b.target});b.target=null;b.batStateBN='seek';laneFlight.rejoin(g,b);}
 function hasCargo(b){for(const c of Object.values(b.batCargoBN||{}))if(amount(c.gold)>0||amount(c.wood)>0)return true;return false;}
 function attackSpot(g,b){
  if(!Number.isSafeInteger(b.batAttackSlotBN)||b.batAttackSlotBN<0||b.batAttackSlotBN>=6){
   const used=new Set();
   for(const h of g.hounds)if(h!==b&&!h.dead&&h.waveBat&&h.target===b.target&&(h.batStateBN==='fly'||h.batStateBN==='attack'))used.add(h.batAttackSlotBN);
   let slot=0;while(used.has(slot))slot++;b.batAttackSlotBN=slot;
  }
  const slot=b.batAttackSlotBN,angle=slot<6?-Math.PI+(slot%6)*Math.PI/3:(slot%12)*Math.PI/6,radius=slot<6?100:210+Math.floor((slot-6)/12)*90;
  return {x:b.target.x+Math.cos(angle)*radius,y:b.target.y-12+Math.sin(angle)*radius};
 }
 function face(b,dx,dy){const x=Math.abs(dx),y=Math.abs(dy);if(x+y<.01)return;if(x>y*.15)b.batFacingBN=dx<0?-1:1;b.batRearBN=dy<-x*(b.batRearBN?.72:.95);}
 function move(b,p,dt,g){const ox=b.x,oy=b.y,dx=p.x-ox,dy=p.y-oy,d=Math.hypot(dx,dy),step=Math.min(d,71.5*dt/1000*b.movementSlowMultiplier());if(d){b.x+=dx/d*step;b.y+=dy/d*step;}
  // Local flight separation only; no graphic stretching and no ground collision.
  if(g&&d>180){let sx=0,sy=0;for(const h of g.hounds){if(h===b||h.dead||!h.waveBat)continue;let x=b.x-h.x,y=b.y-h.y;if(Math.abs(x)>=84||Math.abs(y)>=84)continue;let n=Math.hypot(x,y);if(n<84){if(n<.01){x=String(b.batIdBN)>String(h.batIdBN)?1:-1;y=0;n=1;}const push=(84-n)*.5;sx+=x/n*push;sy+=y/n*push;}}
   // Bound the total separation, not each neighbour: crowded waves must still
   // advance instead of forming an invisible wall around the attack slots.
   const size=Math.hypot(sx,sy),limit=step*.4;if(size>0){const ratio=Math.min(1,limit/size);b.x+=sx*ratio;b.y+=sy*ratio;}}
  face(b,b.x-ox,b.y-oy);return Math.hypot(p.x-b.x,p.y-b.y)<2;
 }
 function refundCargo(g,b){for(const c of Object.values(b.batCargoBN||{}))for(const k of ['gold','wood'])pending(g,c.slot,k,c[k]);b.batCargoBN={};delete b.batWarehouseTripHitsBN;}
 function retire(g,b,now){
  delete b.batCargoStallAtBN;delete b.batCargoReturnUntilBN;
  b.target=null;b.batStateBN='idle';b.batAttackSlotBN=undefined;
  if(b.batRetireAtBN===undefined)b.batRetireAtBN=now+LANE_RETIRE_MS;
  if(now+1e-6>=b.batRetireAtBN){
   refundCargo(g,b);drain(g);
   b.hp=0;b.dead=true;b.batSettledBN=true;b.resourceBountyPaid=true;
  }
 }
 function holdClearedLane(g,b,now){
  if(!b.batRetireOnEmptyBN&&!laneOpen(g,b.waveZoneIndex))b.batRetireOnEmptyBN=true;
  if(!b.batRetireOnEmptyBN)return false;
  // A carrier owes only its already-stolen cargo delivery. Once the ledgers
  // settle it must stop at the depot, never heal/relaunch into this old wave.
  if(b.batRetireAtBN===undefined&&hasCargo(b)&&g.trollBase&&!g.trollBase.dead&&g.troll){
   b.target=null;b.batStateBN='return';
   if(b.batCargoReturnUntilBN===undefined)b.batCargoReturnUntilBN=now+CARGO_MAX_RETURN_MS;
   if(b.batCargoStallAtBN===undefined)b.batCargoStallAtBN=now+CARGO_STALL_MS;
   if(now<b.batCargoReturnUntilBN&&now<b.batCargoStallAtBN)return false;
   refundCargo(g,b);drain(g);

  }
  retire(g,b,now);return true;
 }
 function onLaneCleared(g,lane){
  if(!enabled(g))return;
  prunePending(g,lane);
  const now=Number.isFinite(g.supportTime)?g.supportTime:0;
  for(const b of g.hounds)if(!b.dead&&b.waveBat&&b.waveZoneIndex===lane){
   b.batRetireOnEmptyBN=true;holdClearedLane(g,b,now);
  }
 }
 function update(g,b,dt){updateState(g,b,dt);if(enabled(g))cargoVisual.sync(b);}
 function updateState(g,b,dt){
  if(!enabled(g)||b.dead)return;drain(g);b.batNetImmuneBN=Math.max(0,(b.batNetImmuneBN||0)-dt);b.batNetVisualBN=Math.max(0,(b.batNetVisualBN||0)-dt);b.moveSlowTimer=Math.max(0,(b.moveSlowTimer||0)-dt);b.attackSlowTimer=Math.max(0,(b.attackSlowTimer||0)-dt);b.batRootBN=Math.max(0,(b.batRootBN||0)-dt);b.batGroundedBN=b.batRootBN>0;const now=Number.isFinite(g.supportTime)?g.supportTime:b.batTimeBN+dt;if(holdClearedLane(g,b,now)){b.batTimeBN+=dt;return;}if(g.cardsCandidate?.consumeStormStun(b,dt))return;b.batTimeBN+=dt;if(b.batGroundedBN)return;
  if(mobilePursuit.get(b)?.rejoining){if(laneFlight.step(g,b,false,dt,move))return;recentEscape.set(b,{target:mobilePursuit.get(b).target,until:b.batTimeBN+2000});mobilePursuit.delete(b);}
  if(b.batStateBN==='seek'||b.batStateBN==='idle'){b.target=target(g,b);b.batAttackSlotBN=undefined;b.batStateBN=b.target?'fly':'idle';if(!b.target)return;}
  if(b.batStateBN==='fly'){if(!b.target||b.target.dead){b.batStateBN=hasCargo(b)?'return':'seek';b.target=null;return;}const beforeX=b.x,beforeY=b.y;const cruising=laneFlight.step(g,b,false,dt,move);if(!cruising&&!canFollowMobile(g,b)){abandonMobile(g,b);return;}const arrived=!cruising&&move(b,attackSpot(g,b),dt,g);
   // Spawning/queued waves are not departure; a warehouse or gold mine is required.
   // Fire only after a living bat has actually moved toward a real target.
   if(b.x!==beforeX||b.y!==beforeY)g.batIntroCardBN?.onDeparture(b);
   if(arrived&&b.batAttackSlotBN<6){b.batStateBN='attack';b.batNextHitBN=b.batTimeBN+330+(b.batAttackSlotBN%6)*170;b.batAttackStartBN=b.batTimeBN;}
   else if(arrived&&b.batAttackSlotBN>=6&&b.batTimeBN>=(overflowTargetRetry.get(b)||0)){
    // Same-lane overflow may use another building, but never increase the
    // per-building six-attacker limit or reroute to a different camp.
    overflowTargetRetry.set(b,b.batTimeBN+400);
    const alternate=target(g,b,true);
    if(alternate&&alternate!==b.target){b.target=alternate;b.batAttackSlotBN=undefined;attackSpot(g,b);}
   }
   return;}
  if(b.batStateBN==='attack'){
   const w=b.target;if(!w||w.dead||w.hp<=0||w.inHouse||w.drivingTank||w.inTank){b.batStateBN=hasCargo(b)?'return':'seek';b.target=null;return;}
   if(!canFollowMobile(g,b)){abandonMobile(g,b);return;}
   laneFlight.arrived(g,b);const spot=attackSpot(g,b);if(b.batAttackSlotBN>=6||Math.hypot(w.x-b.x,w.y-b.y)>114||Math.hypot(spot.x-b.x,spot.y-b.y)>8){b.batStateBN='fly';return;}
   if(b.batTimeBN<b.batNextHitBN)return;b.batAttackStartBN=b.batNextHitBN-330;b.batNextHitBN=b.batTimeBN+1500*(b.attackSlowTimer>0?(b.attackSlowFactor||1.8):1);const wallet=owner(g,w.ownerSlot??null),id=key(w.ownerSlot),c=b.batCargoBN[id]||(b.batCargoBN[id]={slot:w.ownerSlot??null,gold:0,wood:0}),before=w.hp,stolen={gold:0,wood:0};
   // Warehouses expose the owner's shared spendable wallet, never prepaid build escrow.
   // Actual theft and HP damage occur on the same landed hit.
   const hasResources=wallet&&['gold','wood'].some(k=>amount(wallet[k])>0);
   if(w.type==='warehouse'&&hasResources){
    const tripHits=b.batWarehouseTripHitsBN??(hasCargo(b)?1:0);
    if(tripHits<WAREHOUSE_TRIP_HITS){
     const perHit=b.batStatsBN.steal;
     for(const k of ['gold','wood']){const total=Object.values(b.batCargoBN).reduce((n,e)=>n+amount(e[k]),0),n=Math.min(perHit,amount(wallet[k]),Math.max(0,perHit*WAREHOUSE_TRIP_HITS-total));wallet[k]-=n;c[k]+=n;stolen[k]=n;}
     if(stolen.gold>0||stolen.wood>0)b.batWarehouseTripHitsBN=tripHits+1;
    }
   }
   // Economy buildings keep ordinary damage except the bats' primary raid target.
   const damage=w.type==='warehouse'?b.batStatsBN.damage*WAREHOUSE_DAMAGE_MULTIPLIER:b.batStatsBN.damage;
   w.takeDamage(damage,b);
   hitFeedback.record(g,w,stolen,before,w.hp);
   b.batLastHitBN=b.batTimeBN;log(g,w.type==='warehouse'?'warehouse-hit':w.type==='goldMine'?'goldmine-hit':'other-target-hit',{bat:b.batIdBN,targetType:w.type,hpBefore:before,hpAfter:w.hp,gold:stolen.gold,wood:stolen.wood});
   if(b.batRetireOnEmptyBN)return;
   const raidDone=w.type!=='warehouse'||w.dead||w.hp<=0||(b.batWarehouseTripHitsBN||0)>=WAREHOUSE_TRIP_HITS||!wallet||!(amount(wallet.gold)>0||amount(wallet.wood)>0);
   if(raidDone&&hasCargo(b)&&g.trollBase&&!g.trollBase.dead){b.batStateBN='return';b.target=null;}
   else if(w.dead||w.hp<=0){b.batStateBN='seek';b.target=null;}return;
  }
  if(b.batStateBN==='return'){
   if(!g.trollBase||g.trollBase.dead){b.batStateBN='idle';return;}
   const px=b.x,py=b.y;
   if(laneFlight.step(g,b,true,dt,move)||!move(b,{x:g.trollBase.x,y:g.trollBase.y+50},dt)){
    if(b.batRetireOnEmptyBN&&(b.x-px)**2+(b.y-py)**2>.05**2)b.batCargoStallAtBN=now+CARGO_STALL_MS;
    return;
   }
   // Confirmed: delivered cargo belongs permanently to demon; only carried cargo refunds.
   if(!g.troll){log(g,'delivery-no-demon',{bat:b.batIdBN});return;}
   const ledger=g.batDeliveriesBN||(g.batDeliveriesBN={});const cycle=b.batDeliveryCycleBN||0,id=b.batIdBN+':'+cycle;
   if(!ledger[id]){const cargo=JSON.parse(JSON.stringify(b.batCargoBN)),sum={gold:0,wood:0};for(const c of Object.values(cargo))for(const k of ['gold','wood'])sum[k]+=amount(c[k]);
    // One synchronous authority transaction. Gold enters real shop wallet; wood is held, never converted.
    g.troll.gold=amount(g.troll.gold)+sum.gold;g.troll.wood=amount(g.troll.wood)+sum.wood;
    g.troll.lootedGold=amount(g.troll.lootedGold)+sum.gold;g.troll.lootedWood=amount(g.troll.lootedWood)+sum.wood;
    ledger[id]={cargo,gold:sum.gold,wood:sum.wood};b.batDeliveredBN={gold:amount(b.batDeliveredBN?.gold)+sum.gold,wood:amount(b.batDeliveredBN?.wood)+sum.wood};b.batCargoBN={};delete b.batWarehouseTripHitsBN;log(g,'delivered',{bat:b.batIdBN,cycle,...sum});
   }
   if(b.batRetireOnEmptyBN)retire(g,b,now);
   else b.batStateBN='heal';return;
  }
  if(b.batStateBN==='heal'){
   if(!g.trollBase||g.trollBase.dead){b.batStateBN='idle';return;}
   if(Math.hypot(b.x-g.trollBase.x,b.y-(g.trollBase.y+50))>2){b.batStateBN='return';return;}
   const healRate=Number.isFinite(healFractionPerSecond)&&healFractionPerSecond>0?b.maxHp*healFractionPerSecond:healPerSecond;
   if(b.hp<b.maxHp){if(!(Number.isFinite(healRate)&&healRate>0)){b.batHealBlockedBN='unconfirmed-heal-rate';return;}b.hp=Math.min(b.maxHp,b.hp+healRate*dt/1000);}
   if(b.hp>=b.maxHp){b.batHealBlockedBN=null;delete b.batWarehouseTripHitsBN;b.batDeliveryCycleBN=(b.batDeliveryCycleBN||0)+1;b.batStateBN='seek';b.target=null;log(g,'healed-relaunch',{bat:b.batIdBN,cycle:b.batDeliveryCycleBN});}

  }
 }
 function death(g,b,source){if(b.batSettledBN)return;b.batSettledBN=true;b.resourceBountyPaid=true;
  refundCargo(g,b);cargoVisual.sync(b);
  // Previously delivered resources stay with demon, with no debt or recall.
  const slot=g.elfRewardOwnerSlot(source);if(slot!==undefined){const stored=b.batWaveBountyShareBN,bounty=batch.validShare(stored)?stored:boostMonsterRewardBN(b.batStatsBN.reward)+(g.scheduledWaveBountyExtraR51?.(b)||0);for(const k of ['gold','wood'])pending(g,slot,k,bounty);}drain(g);log(g,'bat-killed',{bat:b.batIdBN});
 }
 function canDamage(source,b){return !!source&&(source.cardStorm===true&&isStormSource(source)||source.kind==='arrow'||source.kind==='ice'||source.batAntiAirBN===true||source.isRobot===true||source.batRobotSourceBN===true||((b?.batRootBN||0)>0&&source.batTowerSourceBN===true));}
 function canTowerTarget(b,h){if(!h||h.dead)return false;if(!h.airborne)return !b.airDefenseKindBN;if(h.waveBat&&(h.batRootBN||0)>0)return true;return b.airDefenseKindBN==='antiAir'||b.airDefenseKindBN==='net'||['tower','iceTower'].includes(b.type);}
 function activeWarehouseAttacks(g){const result=new Map();if(!menuEnabled(g))return result;for(const b of g.hounds||[]){const w=b.target;if(b.dead||!b.waveBat||b.batStateBN!=='attack'||(b.batRootBN||0)>0||!w||w.dead||w.hp<=0||w.type!=='warehouse'||b.batAttackSlotBN>=6||Math.hypot(w.x-b.x,w.y-b.y)>114||Math.hypot(attackSpot(g,b).x-b.x,attackSpot(g,b).y-b.y)>8)continue;result.set(w,(result.get(w)||0)+1);}return result;}
 function drawWarehouseOverlays(g,c,inView=()=>true,steady=(ctx,draw)=>draw()){
  if(menuEnabled(g))hitFeedback.draw(g,c,inView);
  // The obstructive black warehouse panel is intentionally removed. Normal
  // building HP remains in the game renderer; this is a per-building alert.
  for(const [w] of activeWarehouseAttacks(g)){
   if(!inView(w.x,w.y,260))continue;
   require('./resource-guidance-arrow').draw(c,{tipX:w.x,tipY:w.y-225,direction:'down',color:'red',scale:1.3,travel:1.2,timeMs:g.supportTime||0});
   // Preserve the previously approved attacked-only resource information, below
   // the building instead of across the bats. No opaque panel/background.
   const wallet=owner(g,w.ownerSlot??null),gold=amount(wallet?.gold),wood=amount(wallet?.wood),cap=amount(wallet?.maxGold)+amount(wallet?.maxWood);
   steady(c,()=>{c.save();c.font='bold 10px sans-serif';c.textAlign='center';c.lineWidth=2;c.strokeStyle='rgba(25,40,25,.65)';c.fillStyle='#fff1b5';const label=nativeText('金 '+Math.floor(gold)+'  木 '+Math.floor(wood));c.strokeText?.(label,w.x,w.y+86);c.fillText(label,w.x,w.y+86);c.fillStyle='rgba(241,189,98,.25)';c.fillRect(w.x-45,w.y+91,90,3);c.fillStyle='#f1bd62';c.fillRect(w.x-45,w.y+91,90*Math.min(1,cap>0?(gold+wood)/cap:0),3);c.restore();});
  }
 }
 // Owner-approved V4: independently drawn, original pixel frames.
 const readImage=require('./native-image-decode');
 const netArt=[];let netWarmup,rearWarmup;
 function prepareNetFrames(){
  if(!Image)return Promise.resolve();
  if(netWarmup)return netWarmup;
  netWarmup=(async()=>{
   for(let i=0;i<24;i++){
    if(netArt[i])continue;
    const frame=new Image();
    await readImage(frame,imagePath(`art-bat-preview/v4/netCapture/netCapture-${String(i).padStart(2,'0')}.png`));
    netArt[i]=frame;
   }
  })().catch(error=>{netWarmup=null;throw error;});
  return netWarmup;
 }
 // Frame zero is the authored folded rope, not an open net scaled to fake closing.
 const foldedX=.56,foldedY=.57,netSize=(b,ground)=>(ground?Math.max(96,Math.min(180,Number(b.radius||16)*4.5)):160)*1.2;
 function netFlightTarget(b,ground){const s=netSize(b,ground);return{x:b.x+(foldedX-.5)*s,y:b.y+(foldedY-.75)*s,size:s};}
 function drawNetFlight(c,x,y,s){const f=netArt[0];if(f?.width)frameDraw.draw(c,f,'net',0,x-s*foldedX,y-s*foldedY,s);}
 function netDrawBN(c,b,groundLeft,groundDuration){
  const onGround=groundLeft!==undefined;
  const remaining=onGround?groundLeft:(b.batNetVisualBN||0);if(remaining<=0)return;
  const duration=Math.max(1560,onGround?groundDuration:(b.batNetVisualDurationBN||remaining));
  const age=Math.max(0,duration-remaining);
  // Unfold, cover, cinch, hold, release. Stay at the authored hold pose
  // during extra grounding time on upgraded towers.
  const index=age<1430?Math.min(21,Math.floor(age/65)):remaining<=130?(remaining>65?22:23):21;
  const frame=netArt[index],size=netSize(b,onGround);if(frame?.width)frameDraw.draw(c,frame,'net',index,b.x-size/2,b.y-size*.75+(onGround?0:Math.min(27,age*.103)),size);
 }
 function warmRear(){
  if(!Image)return Promise.resolve();
  if(!rearWarmup){
   const im=new Image();
   rearWarmup=readImage(im,'art-bat-preview/rear.webp.bin').then(()=>{rear=im;},error=>{rearWarmup=null;throw error;});
  }
  return rearWarmup;
 }
 function prepareFlight(){
  if(!Image||flightReady)return Promise.resolve();
  if(flightTask)return flightTask;
  flightTask=(async()=>{
   await warmRear();
   await cargoOverlay.preload();
   for(let i=0;i<12;i++){
    const number=String(i).padStart(2,'0');
    if(!art[i])art[i]=await readImage(new Image(),imagePath(`art-bat-preview/v2/bat/bat-${number}.png`));
    if(!attackArt[i])attackArt[i]=await readImage(new Image(),imagePath(`art-bat-preview/v4/attack/attack-${number}.png`));
   }
   flightReady=true;
  })().finally(()=>{flightTask=null;});
  return flightTask;
 }
 function warmFlight(){
  if(Image&&!flightReady&&!flightTask&&Date.now()>=flightRetryAfter)
   prepareFlight().catch(()=>{flightRetryAfter=Date.now()+1000;});
  return flightReady;
 }
 function prepareOnlineEntry(packet){
  if(packet?.entities?.some(row=>row.type==='Hound'&&row.fields?.waveBat&&!row.fields.dead))return prepareFlight();
 }
 function warmOnlineWave(world){
  if(!flightReady&&world?.batAuthorityVersionBN==='bat-server-1'&&isBatWave(world.waveNumber+1))warmFlight();
 }
 function draw(g,b,c){if(!flightReady)warmFlight();
  const time=b.batTimeBN||0,slot=b.batAttackSlotBN,angle=-Math.PI+slot*Math.PI/3;const spot=b.target&&!b.target.dead&&Number.isSafeInteger(slot)&&slot>=0&&slot<6?attackSpot(g,b):null;const eligible=b.batStateBN==='attack'&&spot&&b.batAttackSlotBN<6&&Math.hypot(b.target.x-b.x,b.target.y-b.y)<=114&&Math.hypot(spot.x-b.x,spot.y-b.y)<=8&&(b.batRootBN||0)<=0;const preparing=eligible&&time>=b.batNextHitBN-330;const start=preparing?b.batNextHitBN-330:b.batAttackStartBN;const age=time-(start??-Infinity);const attacking=(eligible||b.batGhostStrikingBN===true)&&age>=0&&age<780;
  const index=attacking?Math.min(11,Math.floor(age/65)):Math.floor(time/65)%12;if(!attacking&&!b.batGroundedBN&&b.batRearBN&&rear?.width===336){
   let i=Math.floor(index/3);if(i===3)i=1;
   (c.ghostHostBodyImageBN||c.drawImage).call(c,rear,i*112,0,112,86,b.x-56,b.y-71,112,86);netDrawBN(c,b);return;
  }const a=attacking?attackArt[index]:art[index];if(a?.width){const size=attacking?130:120;const netAge=Math.max(0,(b.batNetVisualDurationBN||(b.batNetVisualBN||0)+480)-(b.batNetVisualBN||0));const drop=b.batGroundedBN?Math.min(27,netAge*.103):0;const top=b.y-size*.8+drop,dx=attacking&&eligible?b.target.x-b.x:0,flip=(Math.abs(dx)>2&&Math.abs(dx)>Math.abs(b.target.y-b.y)*.15?dx:b.batFacingBN)<0;
   if(flip){c.save();c.translate(2*b.x,0);c.scale(-1,1);}
   frameDraw.draw(c,a,attacking?'attack':'flight',index,b.x-size/2,top,size);cargoOverlay.draw(c,b,index,attacking,b.x-size/2,top,size);if(flip)c.restore();}netDrawBN(c,b); // Independent approved action frames, fixed size, no deformation.
 }

 return {warmFlight,prepareFlight,prepareOnlineEntry,warmOnlineWave,preloadCargo:async(...args)=>{await warmRear();const cargo=await cargoOverlay.preload(...args);await prepareNetFrames();return cargo;},enabled,menuEnabled,spawn,flushPending,prunePending,onLaneCleared,update,death,canDamage,canTowerTarget,draw,drawGroundNet:netDrawBN,drawNetFlight,netFlightTarget,drawWarehouseOverlays,activeWarehouseAttacks,attackSpot,face,isBatWave,drain,TIERS};
};

module.exports.scheduledWaveBaseBounty=wave=>tierBounty(waveTier(wave,2));
