'use strict';
const {drawStoneWarningAvatar}=require('./stone-warning-avatar');
// Isolated SOLO candidate. Balance ratios below are test proposals, not user-approved numbers.
const live=o=>o&&!o.dead&&o.hp>0;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const MAGIC_TOWER_DAMAGE_MULTIPLIER=20;
const TOWERS=new Set(['tower','iceTower','manaTower','cannonTower']);
const positive=(x,f)=>Number.isFinite(x)&&x>0?x:f;
// Runtime terrain uses a 90-unit wall tile (collision radius at least .51 tile).
// Keep ordinary throw targets local, and use an even shorter range at breached sites.
const WALL_COLLISION_FLOOR=90*.51, THROW_RANGE_MAX=400, BREACHED_THROW_RANGE=180, WALL_EDGE_GAP=14;
const distanceSquared=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const STONE_LANE_LIMIT=2, STONE_RETRY_SECONDS=.5, STONE_RADIUS=28, STONE_DEPARTURE_GAP=8;
const hpBoost=h=>Math.round(h*1.1);
// Change hostile march/ETA only; the stored base speed still drives Ghost possession.
const marchSpeed=b=>b.stoneStats.speed*1.4;
// Late-wave defense grows without adding raw attack or changing the magic counter.
const LATE_DEFENSE=[[1.45,35],[1.75,60],[2,85],[2.2,110]];
function lateDefense(row,wave){
 const band=LATE_DEFENSE[Math.min(LATE_DEFENSE.length-1,Math.floor(wave/10)-3)];if(!band)return row;
 const hp=Math.round(row.hp*band[0]);
 return {...row,hp,armor:row.armor+band[1],gapLimited:hp<row.slimeHp*3,lateDefenseBN:true};
}
function stats(g,wave,slime,boost,lateDef=false,lateBite=false){const t=g.troll,stage=t.dragonEvolved?2:t.evolved?1:0;
 // Caps keep this boss materially weaker than the current demon. Expose unmet slime gap.
 const tier=Math.max(1,Math.floor(wave/10)),capRatio=.25+.08*(1-Math.exp(-(tier-1)/3));let hp=Math.round(Math.min(t.maxHp*capRatio,slime.hp*6));if(boost)hp=hpBoost(hp);
 // Escalate a boss attack by wave while retaining a strict per-hit ceiling
 // below the main demon. HP, cooldowns and attack costs are independent.
 const late=Math.min(1,(tier-1)/4),demonDamage=t.getDamage();
 const damage=Math.max(1,Math.min(Math.floor(demonDamage*(.76+.08*late)),Math.round(slime.damage*(4.2+2.3*late))));
 const row={hp:Math.max(1,hp),capRatio,damage,armor:Math.max(0,Math.floor((t.totalArmor?.()||0)*.15)),speed:30,vision:850,range:1100,stage,slimeHp:slime.hp,slimeDamage:slime.damage,gapLimited:hp<slime.hp*3,proposal:true};
 // Throw damage (and the self-paid HP for it) continues to use row.damage.
 if(lateBite&&tier>=3){
  row.biteDamageBN=Math.max(1,Math.min(Math.ceil(demonDamage)-1,Math.round(damage*(tier===3?1.20:tier===4?1.30:1.40))));
  // A separate late siege floor lets a wild Stone threaten late wall armor
  // without passing the siege bonus to elves, other buildings or possession.
  const siege=tier===3?145:tier===4?235:tier===5?350:460;
  const difficulty=g.trollDifficulty==='crazy'?1:g.trollDifficulty==='easy'?.78:.90;
  row.biteWallDamageBN=Math.max(row.biteDamageBN,Math.round(siege*difficulty));
 }
 return lateDef?lateDefense(row,wave):row;}
function prepareArt({Image,runtime=null,loadPackage=null,offline=()=>false,timeoutMs=10000}={}){
 let sheets=[],walks=[],rock=null,artReady=!runtime?.loadPreparedPackage,artPromise=null,packageReady=false,packagePromise=null;
 const failure=(message,cause)=>{const error=new Error(message);error.code='STONE_RESOURCE_RETRY';if(cause!==undefined)error.cause=cause;return error;};
 function ensurePackage(){if(packageReady||!loadPackage)return Promise.resolve();if(packagePromise)return packagePromise;
  const attempt=new Promise((resolve,reject)=>{let settled=false;const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve();};
   const timer=setTimeout(()=>finish(failure('石头人分包加载超时，请重试')),timeoutMs);
   Promise.resolve().then(loadPackage).then(()=>finish(),cause=>finish(failure('石头人分包加载失败，请重试',cause)));
  });
  packagePromise=attempt.then(()=>{packageReady=true;packagePromise=null;},error=>{packagePromise=null;throw error;});return packagePromise;
 }
 function warmup(){if(sheets.length===3&&walks.length===3&&rock)return Promise.resolve();if(artPromise)return artPromise;
  const cleanups=[];
  const load=path=>new Promise((resolve,reject)=>{const im=new Image();let settled=false;const clear=()=>{clearTimeout(timer);im.onload=im.onerror=null;};const finish=(error)=>{if(settled)return;settled=true;clear();error?reject(error):resolve(im);};
   const timer=setTimeout(()=>finish(failure('石头人素材加载超时，请重试')),timeoutMs);cleanups.push(()=>{settled=true;clear();});
   im.onload=()=>finish();im.onerror=cause=>finish(failure('石头人素材加载失败，请重试',cause));try{im.src=path;}catch(cause){finish(failure('石头人素材读取失败，请重试',cause));}});
  const paths=[...['attack','walk'].flatMap(kind=>[1,2,3].map(stage=>'stone-art/'+kind+'-phase'+stage+'.webp.bin')),'stone-art/stone-rock.webp.bin'];
  const read=async()=>{if(!runtime?.deferStoneStartupBN)return Promise.all(paths.map(load));
   const decoded=[];for(const path of paths){while(runtime.hidden)await new Promise(r=>setTimeout(r,120));await new Promise(r=>setTimeout(r,0));decoded.push(await load(path));}return decoded;};
  artPromise=read().then(images=>{sheets=images.slice(0,3);walks=images.slice(3,6);rock=images[6];artReady=true;}).catch(error=>{for(const cleanup of cleanups)cleanup();artPromise=null;throw error;});return artPromise;
 }
 if(runtime?.loadPreparedPackage&&!runtime.deferStoneStartupBN){const prepared=runtime.loadPreparedPackage;runtime.loadPreparedPackage=async function(...args){const result=await prepared.apply(this,args);if(offline()){await ensurePackage();await warmup();}return result;};}
 return {warmup:()=>ensurePackage().then(warmup),get sheets(){return sheets;},get walks(){return walks;},get rock(){return rock;},get ready(){return artReady;},ensurePackage};
}
function install(g,{Hound,Projectile,Image,runtime=null,loadPackage=null,offline=()=>false,art=null}={}){
 if(!Hound||!Projectile||g.stoneBossCandidate)return;
 art=art||prepareArt({Image,runtime,loadPackage,offline});
 const enabled=()=>offline()&&!g.tutorial&&!g.superChallenge580;
 const cardSafe=require('./stone-card-safe-host')(g);
 const finish=(b,source)=>{if(b.stoneDeathRecorded)return;const record=g.stoneCardHandoff?cardSafe.enqueue(b,source):null;b.hp=0;b.dead=true;b.stoneDeathRecorded=true;b.stoneAction=null;
  g.awardHostileKill?.(b,source);
  if(record){cardSafe.attempt(record);cardSafe.drain();return;}
  const events=g.stoneDefeatEvents||(g.stoneDefeatEvents=[]);events.push({id:b.stoneId,wave:b.waveNumber,lane:b.waveZoneIndex,sourceOwner:source?.rewardOwnerSlot??null});if(events.length>64)events.shift();};
 const laneOpen=(lane,bits)=>Number.isInteger(lane)&&lane>=0&&lane<g.resourceZones.length&&(bits?bits[lane]===1:(typeof g.batLaneActiveBN!=='function'||g.batLaneActiveBN(lane)));
 function onLaneCleared(lane){const q=g.stonePending;if(q?.length)g.stonePending=q.filter(e=>e.lane!==lane);}
 function repairSavedWatermark(){
  const wave=g.waveNumber,guard=g.stoneQueuedThrough;
  // Native spawn only increments this after committing the world wave. An
  // impossibly future marker comes from the older non-reset staged new game.
  if(!enabled()||!Number.isSafeInteger(wave)||wave<0||!Number.isSafeInteger(guard)||guard%10!==0||guard<=wave)return;
  g.stoneQueuedThrough=Math.floor(wave/10)*10;
  g.stonePending=[];
  // Do not mint historical encounters or touch the player's card or reward inbox.
  if(Array.isArray(g.stoneDefeatEvents))g.stoneDefeatEvents=g.stoneDefeatEvents.filter(e=>e?.wave<=wave);
 }
 const stoneBank=runtime?.deferStoneStartupBN&&require('./stone-action-banks').create(Image,runtime,art.ensurePackage);
 const stageNow=()=>g.waveMonsterStageBN?.()??0;
 const bankPhase=()=>!!stoneBank&&!art.ready;
 let retryQueue=null,retryAt=0,artWarmWork=null,artRetry=0,bankWorld=null,transitionStage=-1;
 function runStoneBanks(){
  if(!stoneBank)return;
  if(!enabled()||!['prep','hunt'].includes(g.state)){stoneBank.park();return;}
  if(bankWorld!==g.troll){bankWorld=g.troll;transitionStage=-1;stoneBank.clear();}
  if(!bankPhase()||g.sessionMenuOpen){stoneBank.park();return;}
  stoneBank.restart();
  const phase=stageNow();
  if(g.stonePending?.length)stoneBank.queueFirst(phase);
  else if(g.waveNumber>=10&&stoneBank.visiblePhase(phase)!==phase){
   if(transitionStage!==phase){transitionStage=phase;const live=g.hounds.filter(b=>b.waveStone&&!b.dead);if(live.length)stoneBank.queueFirst(phase,live);}
  }else stoneBank.stopFirst();
  stoneBank.pump();
 }
 function prewarm(){runStoneBanks();if(bankPhase()||!runtime?.deferStoneStartupBN||!enabled()||art.ready||artWarmWork||runtime.hidden||runtime.memoryConstrained?.()||!['prep','hunt'].includes(g.state)||g.waveNumber<8||Date.now()<artRetry)return;
  artWarmWork=art.warmup().catch(e=>{artRetry=Date.now()+7000;runtime.diagnosticEvent?.('phase','stone-wave-art-retry:'+String(e?.code||''));}).finally(()=>artWarmWork=null);
 }
 function spawn(H,wave,lanes,population,slime){if(!enabled()||wave%10!==0)return false;
  if(wave<=(g.stoneQueuedThrough||0))return true;g.stoneQueuedThrough=wave;
  // Latest boss wave only, one reservation per occupied route. A living older
  // boss is never despawned just to satisfy a new reservation.
  const eligible=g.completedElfBuildingBitsBN?.(),entries=[],seen=new Set();
  for(const lane of lanes){
   if(seen.has(lane)||!laneOpen(lane,eligible))continue;seen.add(lane);
   const row=stats(g,wave,slime,false,false,true);entries.push({wave,lane,stats:row,rewardPhase:row.stage,...(wave>=30?{lateDefenseBN:true}:null)});
  }
  g.stonePending=entries;flush(H,wave);return true;
 }
 function flush(H,due=g.waveNumber||0){const q=g.stonePending;if(!q?.length||!enabled())return;
  const eligible=g.completedElfBuildingBitsBN?.(),latest=Math.floor(due/10)*10;
  let write=0;for(const e of q)if(e.wave===latest&&laneOpen(e.lane,eligible))q[write++]=e;q.length=write;
  if(!q.length||!art.ready&&!(bankPhase()&&stoneBank.ready(stageNow())))return; // Do not introduce an invisible combat boss.
  const now=g.waveElapsed||0;
  if(retryQueue===q&&now<retryAt&&now>=retryAt-STONE_RETRY_SECONDS)return;
  retryQueue=q;retryAt=now+STONE_RETRY_SECONDS;
  const occupied=Array.from({length:g.resourceZones.length},()=>[]);
  let live=0;for(const h of g.hounds)if(!h.dead&&h.waveStone){live++;const lane=h.waveZoneIndex;if(Number.isInteger(lane)&&lane>=0&&lane<occupied.length)occupied[lane].push(h);}
  let available=Math.max(0,STONE_LANE_LIMIT*occupied.length-live),attempts=q.length;
  while(q.length&&available>0&&attempts-->0){
   const e=q.shift(),laneBosses=occupied[e.lane];if(laneBosses.length>=STONE_LANE_LIMIT){q.push(e);continue;}
   let spot=null;
   for(let j=0;j<(laneBosses.length?4:1);j++){
    const candidate=g.findSlimeCentralSpot(e.lane,true,j);
    if(!candidate)break; // Native route is unavailable. Retry on the next budget.
    if(!laneBosses.some(b=>distanceSquared(b,candidate)<(Math.max(STONE_RADIUS,b.radius||0)+STONE_RADIUS+STONE_DEPARTURE_GAP)**2)){spot=candidate;break;}
   }
   if(!spot){q.push(e);continue;}
   const b=new H(spot.x,spot.y,2,false),baseHp=hpBoost(e.stats.hp),row={...e.stats,hp:baseHp,gapLimited:baseHp<e.stats.slimeHp*3},stoneStats=e.lateDefenseBN===true?lateDefense(row,e.wave):row,hp=stoneStats.hp;Object.assign(b,{stoneHp11:true,waveStone:true,waveHound:false,waveBat:false,enemyKind:'stone',waveNumber:e.wave,waveZoneIndex:e.lane,stoneStats,maxHp:hp,hp,radius:STONE_RADIUS,stoneId:'stone:'+e.wave+':'+e.lane,stoneThrowLeft:7000+Math.random()*3000,stoneMeleeLeft:0,stoneElapsed:0,stoneAction:null});
   cardSafe.assign(b);g.stampSoloWaveBountyR51?.(b,0,'stone',undefined,{wave:e.wave,phase:e.rewardPhase??e.stats.stage});g.syncWaveMonsterAtBirthBN?.(b);g.hounds.push(b);laneBosses.push(b);available--;
   if(e.wave===10&&g.resourceZones[e.lane]===g.playerWarningZone431?.())g.batIntroCardBN?.onStoneArrival(b);
  }
 }
 function faceStone(b,dx){if(Number.isFinite(dx)&&Math.abs(dx)>.08){b.stoneFacing=dx<0?-1:1;}}
 function faceStrike(b,target){faceStone(b,target.x-b.x);b.stoneAttackFacing=b.stoneFacing||1;}
 function possessedWalk(b,dx,dy,dt){b.stoneWalking=Math.hypot(dx,dy)>.001;if(b.stoneWalking){faceStone(b,dx);b.stoneWalkElapsed=(b.stoneWalkElapsed||0)+dt;g.monsterRearMotionBN?.observe(b,dx,dy);}}
 function clearPossession(b){b.stoneAction=null;b.stoneWalking=false;b.stoneLocalWallBN=null;b.stoneWallTrackBN=null;}
 function biteBlocked(b,t){return g.demonLineBlocked?.(b,t,2,true)||g.slimeBlockingBuilding410?.({radius:2},b,t);}
 function possessedAttack(b,t){
  const close=distance(b,t)<=reach(b,t),bite=close&&!biteBlocked(b,t);
  if(close&&!bite)return '咬击路径被挡住';
  if(!bite&&distance(b,t)>Math.min(b.stoneStats.range,THROW_RANGE_MAX))return '超出投石范围，请靠近';
  if((bite?b.stoneMeleeLeft:b.stoneThrowLeft)>0)return bite?'咬击正在冷却':'投石正在冷却';
  // Same independent timers, action windows, and pose sheets as the hostile boss.
  b.target=t;b.stoneWalking=false;faceStrike(b,t);
  b.stoneAction={kind:bite?'bite':'throw',age:0,hitAt:bite?750:15/16*1000,fired:false};
  if(bite)b.stoneMeleeLeft=1800*(b.attackSlowTimer>0?b.attackSlowFactor:1);else b.stoneThrowLeft=7000+Math.random()*3000;
  return null;
 }
 function launchRock(b,t,damage,possessed=false){
  const p=new Projectile(b.x,b.y-60,t,{kind:'stone',damage,speed:1});
  Object.assign(p,{stoneRock:true,stoneAge:0,stoneStartX:b.x,stoneStartY:b.y-60,stoneEndX:t.x,stoneEndY:t.y-40,stoneFlightMs:950});
  if(possessed)p.stonePossessedSource=b;g.projectiles.push(p);
 }
 function possessedTick(b,dt,ready,isEnemy){
  b.stoneThrowLeft=Math.max(0,b.stoneThrowLeft-dt);b.stoneMeleeLeft=Math.max(0,b.stoneMeleeLeft-dt);
  if(!ready){b.stoneAction=null;b.stoneWalking=false;return;}
  const a=b.stoneAction;if(!a)return;
  a.age+=dt;
  if(!a.fired&&a.age>=a.hitAt){a.fired=true;const t=b.target;
   if(isEnemy(t)){
    const damage=g.ghostElfAPI.attackValue(b,t);
    if(a.kind==='bite'){
     if(distance(b,t)<=reach(b,t)&&!biteBlocked(b,t))t.takeDamage(b.stoneStats.biteDamageBN===undefined?damage:Math.round(damage*b.stoneStats.biteDamageBN/b.stoneStats.damage),b);
    }else if(distance(b,t)<=Math.min(b.stoneStats.range,THROW_RANGE_MAX)){
     launchRock(b,t,damage,true);
     // Keep the native nonlethal throw cost on the borrowed body.
     if(b.hp>1)b.hp=Math.max(1,b.hp-b.stoneStats.damage);
    }
   }
  }
  if(a.age>=1500){b.stoneAction=null;b.target=null;}
 }
 function move(b,target,dt,direct=null){const beforeX=b.x,beforeY=b.y;const waypoint=direct||g.demonRouteWaypoint?.(b,target,'stone-approach')||target;if(!direct&&['pending','failed'].includes(g.navMotionCaches?.get(b)?.mode))return;const d=distance(b,waypoint)||1,step=Math.min(d,marchSpeed(b)*dt/1000*b.movementSlowMultiplier());b.setMoveIntent?.((waypoint.x-b.x)/d*step,(waypoint.y-b.y)/d*step);b.moveByTerrain((waypoint.x-b.x)/d*step,(waypoint.y-b.y)/d*step);b.stoneWalking=Math.hypot(b.x-beforeX,b.y-beforeY)>.001;if(b.stoneWalking){faceStone(b,b.x-beforeX);b.stoneWalkElapsed=(b.stoneWalkElapsed||0)+dt;g.monsterRearMotionBN?.observe(b,b.x-beforeX,b.y-beforeY);}}
 const inLane=o=>g.resourceZoneIndexFor401(o);
 // Bite must reach the actual wall collider, not only its rendered sprite radius.
 const reach=(b,t)=>b.radius+(t.type==='wall'?Math.max(WALL_COLLISION_FLOOR,t.radius||0):(t.radius||30))+14;
 function blockedWall(b,t,dt){
  if(b.stoneWallTrackBN!==t||Math.hypot(b.x-(b.stoneWallTrackXBN??b.x),b.y-(b.stoneWallTrackYBN??b.y))>=5){
   b.stoneWallTrackBN=t;b.stoneWallTrackXBN=b.x;b.stoneWallTrackYBN=b.y;b.stoneWallStallBN=0;
  }else b.stoneWallStallBN+=Math.min(dt,50);
  return b.stoneWallStallBN>=550;
 }
 function stoneWallAlternative(b,wall,dt){
  if(!g.findLocalWaveWallBN||!g.slimeTargetIndex396)return null;
  let local=b.stoneLocalWallBN;
  const revision=g.groundObstacleRevision,now=g.supportTime||0;
  if(local&&(local.lane!==b.waveZoneIndex||local.revision!==revision||!live(local.wall)||local.wx!==local.wall.x||local.wy!==local.wall.y||(local.entered?distance(b,local.wall)>reach(b,local.wall):now>=local.until))){
   b.stoneLocalWallBN=null;local=null;
  }
  const stalled=wall&&distance(b,wall)>reach(b,wall)&&blockedWall(b,wall,dt);
  if(!local&&stalled&&now>=(b.localWaveWallProbeBN||0)){
   // Hound wall reach is collision radius + max(attackRange, stone radius + 6).
   // The stone bite's existing offset is radius + 14, so adjust the shared probe by 8.
   local=b.stoneLocalWallBN=g.findLocalWaveWallBN(b,g.slimeTargetIndex396(),wall,null,8,32);
   if(local)local.until=now+2000;
  }
  return local;
 }
 function update(b,dt,elves){if(!enabled()||b.dead)return;b.stoneWalking=false;const gate=g.resourceZones[b.waveZoneIndex];if(b.stoneAction||(gate&&Math.hypot(b.x-gate.gateX,b.y-gate.gateY)<=90))b.stoneArrived=true;b.stoneElapsed+=dt;b.moveSlowTimer=Math.max(0,(b.moveSlowTimer||0)-dt);b.attackSlowTimer=Math.max(0,(b.attackSlowTimer||0)-dt);b.stoneThrowLeft=Math.max(0,b.stoneThrowLeft-dt);b.stoneMeleeLeft=Math.max(0,b.stoneMeleeLeft-dt);
  if((b.stoneStunLeft||0)>0){b.stoneStunLeft=Math.max(0,b.stoneStunLeft-dt);b.setMoveIntent?.(0,0);return;}
  if(b.stoneAction){const a=b.stoneAction;a.age+=dt;if(!a.fired&&a.age>=a.hitAt){a.fired=true;const t=b.target;if(t&&!t.dead&&(t.hp===undefined||t.hp>0)){if(a.kind==='bite'&&distance(b,t)<=reach(b,t)){const before=t.hp;if(t.takeDamage)t.takeDamage((t.type==='wall'?b.stoneStats.biteWallDamageBN:undefined)??b.stoneStats.biteDamageBN??b.stoneStats.damage,b);else t.dead=true;const lost=Math.max(0,before-Math.max(0,t.hp||0));if(t.type==='wall')b.hp=Math.min(b.maxHp,b.hp+lost);}else if(a.kind==='throw'){
    launchRock(b,t,b.stoneStats.damage);/* Keep the throw health cost, but only hostile damage may finish this boss. */if(b.hp>1)b.hp=Math.max(1,b.hp-b.stoneStats.damage);}}}
   if(a.age>=1500)b.stoneAction=null;return;}
  let wall=null,wallD2=b.stoneStats.vision**2,laneWall=null,laneWallD2=Infinity;
  const throwReady=b.stoneThrowLeft<=0,z=gate,nx=(z?.gateX??0)-(z?.x??0),ny=(z?.gateY??0)-(z?.y??0);
  const outside=(from,anchor)=>(from.x-anchor.x)*nx+(from.y-anchor.y)*ny;
  // Leave existing melee wall priority in place; ranged eligibility uses only the
  // closest wall in the charged lane, not a nearby wall at a different base.
  for(const t of g.buildings){if(t?.type!=='wall'||!live(t))continue;const d2=distanceSquared(b,t);
   if((!wall&&d2===wallD2)||d2<wallD2){wall=t;wallD2=d2;}
   if(throwReady&&d2<laneWallD2&&inLane(t)===b.waveZoneIndex){laneWall=t;laneWallD2=d2;}
  }
  const wallR=laneWall?Math.max(WALL_COLLISION_FLOOR,laneWall.radius||0):0;
  const nearWall=laneWall&&laneWallD2>=wallR*wallR&&laneWallD2<=(wallR+b.radius+WALL_EDGE_GAP)**2&&outside(b,laneWall)>=0;
  if(throwReady&&z&&(nearWall||!laneWall)){
   const throwD2=Math.min(b.stoneStats.range,nearWall?THROW_RANGE_MAX:BREACHED_THROW_RANGE)**2;
   const towers=[],other=[];
   for(const t of g.buildings){if(!live(t)||t.type==='wall'||distanceSquared(b,t)>throwD2||((t.x-z.gateX)*nx+(t.y-z.gateY)*ny)>0||(nearWall&&outside(t,laneWall)>0)||inLane(t)!==b.waveZoneIndex)continue;
    if(TOWERS.has(t.type)||t.airDefenseKindBN)towers.push(t);else if(nearWall)other.push(t);
   }
   const choices=towers.length?towers:other;
   if(choices.length){b.target=choices[Math.floor(Math.random()*choices.length)];faceStrike(b,b.target);b.stoneAction={kind:'throw',age:0,hitAt:15/16*1000,fired:false};b.stoneThrowLeft=7000+Math.random()*3000;return;}
  }
  const local=stoneWallAlternative(b,wall,dt);
  let target=local?.wall||wall;
  if(!target){let bestD2=b.stoneStats.vision**2;
   for(const e of elves||[]){if(!e||e.dead||e.defected)continue;const d2=distanceSquared(b,e);if((!target&&d2===bestD2)||d2<bestD2){target=e;bestD2=d2;}}
   if(!target){bestD2=Infinity;for(const t of g.buildings){if(!live(t))continue;const d2=distanceSquared(b,t);if(d2<bestD2&&inLane(t)===b.waveZoneIndex){target=t;bestD2=d2;}}}
  }
  b.target=target||null;
  if(target&&distance(b,target)<=reach(b,target)){if(local)local.entered=true;if(b.stoneMeleeLeft<=0){faceStrike(b,target);b.stoneAction={kind:'bite',age:0,hitAt:750,fired:false};b.stoneMeleeLeft=1800*(b.attackSlowTimer>0?b.attackSlowFactor:1);}}
  else if(local){
   // The point was checked against local walls and terrain; never call the
   // route solver for this brief alternative and discard it if movement stalls.
   move(b,target,dt,local);if(!b.stoneWalking&&b.movementSlowMultiplier()>0)b.stoneLocalWallBN=null;
  }else if(target)move(b,target,dt);else {const z=g.resourceZones[b.waveZoneIndex];if(z)move(b,z,dt);}
 }
 function draw(b,c){const stage=Math.min(2,Math.max(0,b.stoneStats.stage||0)),a=b.stoneAction,walking=!a&&b.stoneWalking;if(b.dead)return;const f=walking?Math.floor((b.stoneWalkElapsed||0)/62.5)%24:a?(a.kind==='throw'?24:0)+Math.min(23,Math.floor(a.age/62.5)):0,cell=walking?256:181;
 const bank=bankPhase()?stoneBank.frame(b,stoneBank.visiblePhase(stage),walking,f,!a&&!walking):null;
 let sheet=bank?bank[0]:(walking?art.walks[stage]:art.sheets[stage]);if(!sheet?.width)return;
 const sampleCell=bank?.[2]??cell,sx=bank?bank[1]*sampleCell:f%8*cell,sy=bank?0:Math.floor(f/8)*cell;c.save();for(let i=0;i<3;i++){c.fillStyle='rgba(24,31,20,'+(.045+i*.025)+')';c.beginPath();c.ellipse(b.x,b.y+8,38-i*7,11-i*2,0,0,Math.PI*2);c.fill();}const top=b.y-(walking?136:132),face=a?b.stoneAttackFacing:b.stoneFacing;const rear=!a&&g.monsterRearMotionBN?.drawStone(c,b,stage,f,walking);if(!rear&&face<0){c.save();c.translate(b.x,0);c.scale(-1,1);c.drawImage(sheet,sx,sy,sampleCell,sampleCell,-80,top,160,160);c.restore();}else if(!rear)c.drawImage(sheet,sx,sy,sampleCell,sampleCell,b.x-80,top,160,160);if(g.ghostElfAPI?.host!==b){c.fillStyle='#15231b';c.fillRect(b.x-31,b.y-131,62,7);c.fillStyle='#65d981';c.fillRect(b.x-30,b.y-130,60*Math.max(0,b.hp/b.maxHp),5);}c.restore();}
 const hu=Hound.prototype.update,hd=Hound.prototype.draw,hh=Hound.prototype.takeDamage;
 Hound.prototype.update=function(dt,elves,...rest){if(this.waveStone){update(this,dt,elves);return;}return hu.call(this,dt,elves,...rest);};
 Hound.prototype.draw=function(c,...rest){if(this.waveStone){draw(this,c);return;}return hd.call(this,c,...rest);};
 Hound.prototype.takeDamage=function(n,source){if(!this.waveStone)return hh.call(this,n,source);if(this.dead||!Number.isFinite(n)||n<=0)return;if(g.ghostElfAPI?.receive(this,n,source))return;const magic=source?.kind==='mana'&&source?.batTowerSourceBN===true;this.hp-=n*(magic?MAGIC_TOWER_DAMAGE_MULTIPLIER:1)*100/(100+this.stoneStats.armor);if(this.hp<=0)finish(this,source);};
 const pu=Projectile.prototype.update,pd=Projectile.prototype.draw;
 Projectile.prototype.update=function(...args){if(!this.stoneRock)return pu.apply(this,args);if(this.stonePossessedSource&&g.ghostElfAPI?.host!==this.stonePossessedSource){this.dead=true;return;}this.stoneAge+=Number.isFinite(g.stoneStepDt)?Math.max(0,g.stoneStepDt):1000/60;const p=Math.min(1,this.stoneAge/this.stoneFlightMs);this.x=this.stoneStartX+(this.stoneEndX-this.stoneStartX)*p;this.y=this.stoneStartY+(this.stoneEndY-this.stoneStartY)*p-80*4*p*(1-p);if(p>=1){if(live(this.target)&&(!this.stonePossessedSource||Math.hypot(this.target.x-this.stoneEndX,this.target.y-40-this.stoneEndY)<=this.target.radius))this.target.takeDamage?.(this.damage,this.stonePossessedSource||this);this.dead=true;}};
 Projectile.prototype.draw=function(c,...args){if(!this.stoneRock)return pd.call(this,c,...args);const rock=bankPhase()?stoneBank.rock:art.rock;if(rock?.width)c.drawImage(rock,this.x-30,this.y-23,60,46);};
 const warnings=g.incomingAttackWarningStates,avatar=g.batWarningAvatarBN;
 g.incomingAttackWarningStates=function(...args){const rows=warnings.apply(this,args);if(!enabled()||!['prep','hunt'].includes(g.state))return rows;const zone=g.playerWarningZone431();if(!zone)return rows;const lane=g.resourceZones.indexOf(zone),boss=g.hounds.find(b=>!b.dead&&b!==g.ghostElfAPI?.host&&b.waveStone&&b.waveZoneIndex===lane);if(!boss)return rows;const d=Math.hypot(boss.x-zone.gateX,boss.y-zone.gateY);if(d<=90||boss.stoneAction||boss.stoneArrived)return rows;const seconds=Math.ceil(d/marchSpeed(boss));const out=rows.filter(w=>w.kind!=='slime');out.push({kind:'slime',enemyKind:'stone',waveNumber:boss.waveNumber,source:boss,zone,target:{x:zone.gateX,y:zone.gateY},seconds,progress:Math.min(1,seconds/60)});if(out.length>1)for(const w of out)w.stacked=true;return out;};
 g.batWarningAvatarBN=function(c,w,x,y,compact){if(w.enemyKind!=='stone')return avatar?.call(this,c,w,x,y,compact)||false;drawStoneWarningAvatar(c,x,y,compact);return true;};
 async function prepareRestore(world){if(!stoneBank)return art.warmup();const phase=world.troll?.dragonEvolved?2:world.troll?.evolved?1:0;const live=world.hounds.filter(b=>b.waveStone&&!b.dead);if(live.length)await stoneBank.restore(phase,live);bankWorld=world.troll;}
 const gu=g.update;g.update=function(dt,...args){g.stoneStepDt=dt;const result=gu.call(this,dt,...args);prewarm();if(g.stoneCardHandoff){this.stoneRewardRetryMs=(this.stoneRewardRetryMs||0)+dt;if(this.stoneRewardRetryMs>=500){this.stoneRewardRetryMs=0;cardSafe.retry();}}return result;};
 g.stoneBossCandidate={spawn,flush,onLaneCleared,possessedWalk,possessedAttack,possessedMeleeReach:reach,possessedTick,clearPossession,repairSavedWatermark,enabled,stats,bankReport:()=>stoneBank?.report(),prepareRestore,warmup:art.warmup,artReady:()=>art.ready||!!(bankPhase()&&stoneBank.ready(stageNow()))};
}
module.exports={install,stats,prepareArt,MAGIC_TOWER_DAMAGE_MULTIPLIER};
