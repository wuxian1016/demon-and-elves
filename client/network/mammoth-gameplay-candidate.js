'use strict';
const renderer=require('./mammoth-renderer');
const STAGGER=[1.8,2.15,1.72,2.02,1.78],DEPARTURE_SIDE=[0,-59,59,-47,47],PER_LANE=5,ROUND_WINDOW=29,RECHECK=.3,LANE_CAP=24;
const DIST=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const TOWERS=new Set(['tower','iceTower','manaTower','cannonTower']);
const LEGACY_DAMAGE_FACTOR=.76, DAMAGE_FACTOR=1.40;
const PETRIFY_MS=4200, PETRIFY_RADIUS=560, ATTACK_HIT=390, ATTACK_MS=840;
function isWave(n){return Number.isInteger(n)&&n>=6&&n%10===6;}
function prepareArt({Image,loadPackage}){
 let images,promise,armorPromise;const decoded=Object.create(null);
 function withDeadline(start,ms,reason){
  return new Promise((resolve,reject)=>{let done=false;const finish=(e,v)=>{if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve(v);};const timer=setTimeout(()=>finish(Error(reason)),ms);
   try{start(v=>finish(null,v),e=>finish(e||Error(reason)));}catch(e){finish(e);}
  });
 }
 function warmup(){
  if(images)return Promise.resolve(images);
  if(!promise)promise=(async()=>{
   for(const pkg of ['mammothWalk','mammothAttack']){
    await withDeadline((ok,no)=>Promise.resolve().then(()=>loadPackage(pkg)).then(ok,no),8000,'猛犸分包等待超时');
    const names=(pkg==='mammothWalk'?['shadow',...renderer.names]:renderer.names).filter(n=>(pkg==='mammothAttack')===n.startsWith('attack-')&&!decoded[n]);
    for(let i=0;i<names.length;i+=3)await Promise.all(names.slice(i,i+3).map(name=>withDeadline((ok,no)=>{
     const im=new Image();
     im.onload=()=>{im.onload=im.onerror=null;const sz=name==='shadow'?[128,40]:renderer.trim[name].slice(2);if(im.width!==sz[0]||im.height!==sz[1])no(Error('猛犸图集尺寸无效'));else ok(im);};im.onerror=()=>{im.onload=im.onerror=null;no(Error('猛犸素材读取失败'));};
     im.src=renderer.assetPath(name);
    },8000,'猛犸素材等待超时').then(im=>{decoded[name]=im;}).catch(error=>{if(name!=='shadow')throw error;})));
   }
   images=decoded;return images;
  })().finally(()=>promise=null);
  return promise;
 }
 function warmArmor(){
  if(decoded.armor&&decoded.armorRear)return Promise.resolve(true);
  if(!armorPromise)armorPromise=warmup().then(async()=>{
   const overlays=[['armor','mammoth-walk/w16-armor.png',880,528],['armorRear','mammoth-walk/w16-armor-rear.png',672,336]];
   // Avoid loading W16 extras at startup. This is the same already-loaded
   // mammoth pack; a missing optional overlay never prevents any spawn.
   await Promise.all(overlays.map(([key,path,w,h])=>decoded[key]||withDeadline((ok,no)=>{
    const im=new Image();
    im.onload=()=>{im.onload=im.onerror=null;if(im.width!==w||im.height!==h)no(Error('猛犸岩甲尺寸无效'));else ok(im);};
    im.onerror=()=>{im.onload=im.onerror=null;no(Error('猛犸岩甲素材读取失败'));};
    im.src=path;
   },8000,'猛犸岩甲素材等待超时').then(im=>{decoded[key]=im;}).catch(()=>{})));
   return !!(decoded.armor&&decoded.armorRear);
  }).finally(()=>armorPromise=null);
  return armorPromise;
 }
 return {warmup,warmArmor,get armorReady(){return !!(decoded.armor&&decoded.armorRear);},get images(){return images;},get ready(){return !!images;}};
}
function install(g,{Hound,offline=()=>false,art}){
 if(!Hound||g.mammothCandidate)return;
 const enabled=()=>offline()===true&&!g.tutorial&&!g.superChallenge580;
 const state=()=>g.mammothWaveDataBN||(g.mammothWaveDataBN={last:0,pending:[],retryAt:0});
 let warmTask=null,warmGame=null,warmNext=0,warmTries=0,armorTask=null,armorNext=0,armorTries=0;
 function prewarm(){
  if(!enabled()||g.waveElapsed<8||!['prep','hunt'].includes(g.state))return;
  if(warmGame!==g.troll){warmGame=g.troll;warmNext=0;warmTries=0;armorNext=0;armorTries=0;}
  if(g.waveNumber>=15&&!art.armorReady&&!armorTask&&g.waveElapsed>=armorNext&&armorTries<5&&typeof art.warmArmor==='function'){
   armorTries++;armorNext=g.waveElapsed+Math.min(60,10*armorTries);
   armorTask=Promise.resolve().then(()=>art.warmArmor()).catch(error=>g.wxRuntime?.diagnosticEvent?.('mammoth-armor-fallback',error?.message)).finally(()=>armorTask=null);
  }
  if(art.ready||warmTask||g.waveElapsed<warmNext||warmTries>=5||typeof art.warmup!=='function')return;
  warmTries++;warmNext=g.waveElapsed+Math.min(60,12*warmTries);
  warmTask=Promise.resolve().then(()=>art.warmup()).catch(error=>g.wxRuntime?.diagnosticEvent?.('mammoth-art-fallback',error?.message)).finally(()=>warmTask=null);
 }
 function spawn(H,wave,lanes,pop,slime,solo,previousSlime=g.mammothPreviousSlimeBN?.(wave,solo)){
  if(!enabled()||!isWave(wave))return false;
  const st=state(),now=g.waveElapsed;
  if(st.last>=wave)return true;
  st.last=wave;st.retryAt=now;
  st.pending=lanes.map((lane,i)=>({lane,wave,j:0,next:now+i*.05,until:now+ROUND_WINDOW,
   // Fewer, slower, sturdier units than the ordinary wave, with heavier individual hits.
   hp:Math.ceil(slime.hp*1.9),damage:Math.max(1,slime.damage*DAMAGE_FACTOR),damageScaleBN:DAMAGE_FACTOR,previousSlime,solo,individualPetrifyBN:wave>=16}));
  const locks=g.mammothTowerCastBN||(g.mammothTowerCastBN={});
  // Old routes may retain stragglers across multiple new mammoth waves.
  // Prune only at birth boundaries; a living caster must still see its own reservations.
  const stale=Object.keys(locks).filter(k=>Number(k.split(':')[0])<wave-10);
  if(stale.length){
   const removable=new Set(stale);
   for(const h of g.hounds)if(!h.dead&&h.hp>0&&h.waveMammothBN&&(!h.mammothPetrifySpentBN||h.mammothCastBN&&!h.mammothCastBN.hit))
    removable.delete(h.waveNumber+':'+h.waveZoneIndex);
   for(const k of removable)delete locks[k];
  }
  flush(H,solo,pop);return true;
 }
 function flush(H,solo,pop){
  if(!enabled())return;prewarm();
  const st=g.mammothWaveDataBN,now=g.waveElapsed;
  if(!(st?.pending?.length))return;
  const occupancy=g.completedElfBuildingBitsBN?.()||g.waveLaneOccupancyBN().active;
  for(let i=st.pending.length-1;i>=0;i--){const q=st.pending[i];if(q.j>=PER_LANE||now>q.until||!occupancy[q.lane])st.pending.splice(i,1);}
  if(now<(st.retryAt||0))return;
  st.retryAt=now+RECHECK;
  if(!st.pending.some(q=>q.next<=now))return;
  const p=pop||(g.groundWavePopulationBN?.(g.slimePopulationBudget401(solo))||g.slimePopulationBudget401(solo));let total=p.count;
  // Existing budget omits independent stone bosses. Account for them here.
  for(const h of g.hounds)if(!h.dead&&h.waveStone)total++;
  for(const q of st.pending){
   if(q.next>now||total+1>p.cap||(!solo&&p.counts[q.lane]+1>LANE_CAP))continue;
   const route=g.slimeFixedRoute413(q.lane);if(route.blocked||route.points.length<2)continue;
   const spot=g.findSlimeCentralSpot(q.lane,true,0);if(!spot)continue;
   const ri=g.slimeNearestFixedRoute413(spot,route.points).index;
   const a=route.points[Math.min(route.points.length-1,ri+1)];
   const dx=a.x-spot.x,dy=a.y-spot.y,d=Math.hypot(dx,dy)||1;
   const side=Math.sign(DEPARTURE_SIDE[q.j])*Math.min(Math.abs(DEPARTURE_SIDE[q.j]),Math.max(0,route.clearance-27)),trail=[0,10,7,13,10][q.j];
   const x=spot.x-dy/d*side-dx/d*trail,y=spot.y+dx/d*side-dy/d*trail;
   const radius=22,safe=(x,y)=>!g.terrainCollisionAt(x,y,radius)&&!g.buildings.some(b=>!b.dead&&DIST({x,y},b)<((b.radius||0)+radius+3)**2)
    &&!g.hounds.some(e=>!e.dead&&e.waveMammothBN&&e.waveZoneIndex===q.lane&&DIST({x,y},e)<36**2);
   const at=safe(x,y)?{x,y}:safe(spot.x,spot.y)?spot:null;
   if(!at)continue;
   const h=new H(at.x,at.y,2,false);
   Object.assign(h,{waveMammothBN:true,waveHound:true,enemyKind:'mammoth',soloSlime:q.solo,
    slimeLoadFixed571:true,slimeDragon570:false,slimeEvolved:false,waveNumber:q.wave,waveZoneIndex:q.lane,
    radius,viewRange:260,attackRange:24,maxHp:q.hp,hp:q.hp,waveDamage:q.damage,
    mammothDamageScaleBN:q.damageScaleBN,mammothPreviousSlimeBN:q.previousSlime,
    waveAge:0,waveScanLeft:q.j*80,slimeFixedLane410:q.lane,slimeFixedLaneEntered410:false,
    slimeFixedRouteIndex413:ri,slimeVehicleHunter:q.j%3===1,slimeRage:g.slimeAssaultStarted(),
    mammothWalkBN:q.j*93,mammothFaceBN:dx<0?-1:1,mammothOrdinalBN:q.j,
    mammothIndividualPetrifyBN:q.individualPetrifyBN===true,
    mammothDepartureRouteStartBN:ri,mammothDepartureLaneBN:q.lane,
    mammothCastScanBN:now+4+q.j*.35,mammothSpeedBN:[1,.96,1.025,.945,.985][q.j]});
   g.stampSoloWaveBountyR51?.(h,q.j,'mammoth');g.syncWaveMonsterAtBirthBN?.(h);g.hounds.push(h);q.next=now+STAGGER[q.j];q.j++;total++;p.counts[q.lane]++;
  }
  st.pending=st.pending.filter(q=>q.j<PER_LANE);
 }
 const departurePoints=new WeakMap();
 // Cosmetic only: one brief, merged signal per struck wall, even when healing restores its bar.
 const wallHits=new Map(), WALL_HIT_MS=540, WALL_MERGE_MS=160, WALL_HIT_CAP=24;
 let wallHitWorld=null;
 function noteWallHit(h,w,loss){
  if(!(loss>0)||!Number.isFinite(loss))return;
  if(wallHitWorld!==g.troll){wallHits.clear();wallHitWorld=g.troll;}
  const now=g.supportTime||0,prior=wallHits.get(w),dx=h.x-w.x,dy=h.y-w.y,d=Math.hypot(dx,dy)||1;
  if(!prior&&wallHits.size>=WALL_HIT_CAP)wallHits.delete(wallHits.keys().next().value);
  const within=prior&&now-prior.at<=WALL_MERGE_MS;
  wallHits.set(w,{at:now,amount:(within?prior.amount:0)+loss,ux:dx/d,uy:dy/d});
 }
 function drawWallHits(ctx,inView,steady=(c,draw)=>draw()){
  if(!wallHits.size)return;
  if(wallHitWorld!==g.troll){wallHits.clear();return;}
  const now=g.supportTime||0;
  for(const [w,hit] of wallHits){
   const age=now-hit.at;
   if(w.dead||age<0||age>=WALL_HIT_MS){wallHits.delete(w);continue;}
   if(!inView(w.x,w.y,90))continue;
   const p=age/WALL_HIT_MS,r=Math.max(18,w.radius||0);
   // Uses existing sprite frames; the small warm accent and number are separate UI.
   const amount=hit.amount>=10?String(Math.round(hit.amount)):hit.amount>=.1?String(Math.round(hit.amount*10)/10):'<0.1';
   ctx.save();ctx.globalAlpha=Math.min(1,(1-p)*2.2);
   ctx.strokeStyle='#FFAB68';ctx.lineWidth=2.6;ctx.lineCap='round';
   ctx.beginPath();const a=Math.atan2(hit.uy,hit.ux);ctx.arc(w.x,w.y,r+2,a-.24,a+.24);ctx.stroke();
   steady(ctx,()=>{
    const tx=w.x,ty=w.y-r-33;
    ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';
    ctx.fillStyle='#32190C';ctx.fillText('−'+amount,tx+1,ty+1);ctx.fillStyle='#FFF0C8';ctx.fillText('−'+amount,tx,ty);
   });
   ctx.restore();
  }
 }
 function roadPoint(h,route,i){
  const center=route.points[i],start=h.mammothDepartureRouteStartBN;
  if(!h.waveMammothBN||!Number.isInteger(start)||h.waveZoneIndex!==h.mammothDepartureLaneBN||i<start||i>start+3||i===route.points.length-1)return center;
  const spread=DEPARTURE_SIDE[h.mammothOrdinalBN]||0;
  if(!spread)return center;
  let m=departurePoints.get(h);if(!m||m.route!==route){m={route,points:new Map()};departurePoints.set(h,m);}
  if(m.points.has(i))return m.points.get(i);
  const radius=h.radius||22,available=Math.max(0,route.clearance-radius-5);
  const fade=Math.min(1,(start+4-i)/2),shift=Math.sign(spread)*Math.min(available,Math.abs(spread)*fade);
  let result=center;
  if(Math.abs(shift)>=5){
   let a=route.points[Math.max(0,i-1)],b=route.points[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
   for(const f of [1,.6,.3]){const q={x:center.x-dy/len*shift*f,y:center.y+dx/len*shift*f};
    if(!g.terrainCollisionAt(q.x,q.y,radius+2)&&!g.demonLineBlocked(h,q,radius+2,true)){result=q;break;}}
  }
  m.points.set(i,result);return result;
 }
 function atBlockedOwnGate(h,zone){
  // A standing entrance wall can stop the melee AI just before the route
  // commits its 'entered lane' bit. Only the unit's actual gate-wall target
  // in its own camp may unlock a cast from that last approach.
  const wall=h.slimeCombatTarget539;
  if(h.slimeFixedLane410!==h.waveZoneIndex||wall?.type!=='wall'||wall.dead||wall.hp<=0)return false;
  const x=h.x-zone.gateX,y=h.y-zone.gateY,wx=wall.x-zone.gateX,wy=wall.y-zone.gateY;
  return x*x+y*y<=160**2&&wx*wx+wy*wy<=160**2&&
   DIST(h,wall)<=(h.attackReachFor(wall)+6)**2&&g.resourceZoneIndexFor401(wall)===h.waveZoneIndex;
 }
 function usePetrify(h,dt){
  let cast=h.mammothCastBN;const now=g.waveElapsed,zone=g.resourceZones[h.waveZoneIndex];
  if(cast){
   cast.age+=dt;
   if(!cast.hit&&cast.age>=385){cast.hit=true;const b=cast.target;if(b&&!b.dead&&!(b.mammothPetrifyLeftBN>0)&&DIST(h,b)<=PETRIFY_RADIUS**2){b.stunTimer=Math.max(b.stunTimer||0,PETRIFY_MS);b.mammothPetrifyLeftBN=PETRIFY_MS;}}
   if(cast.age>=770)h.mammothCastBN=null;
   h.setMoveIntent(0,0);return true;
  }
  const k=h.waveNumber+':'+h.waveZoneIndex;
  const locks=g.mammothTowerCastBN||(g.mammothTowerCastBN={});
  // Existing saved units/queues deliberately keep the original shared cast.
  // New waves reserve one distinct tower per mammoth. The native save graph
  // preserves tower identity, including the target of an in-progress cast.
  const individual=h.mammothIndividualPetrifyBN===true,reserved=locks[k];
  if(h.waveNumber<16||h.mammothPetrifySpentBN||reserved===true||
     (!individual&&reserved)||now<h.mammothCastScanBN||!zone||
     (!h.slimeFixedLaneEntered410&&!atBlockedOwnGate(h,zone)))return false;
  h.mammothCastScanBN=now+1.2;
  const candidates=[];
  for(const b of g.buildings)if(!b.dead&&(TOWERS.has(b.type)||b.airDefenseKindBN)&&!(b.mammothPetrifyLeftBN>0)&&!reserved?.includes(b)&&DIST(h,b)<=PETRIFY_RADIUS**2&&g.resourceZoneIndexFor401(b)===h.waveZoneIndex)candidates.push(b);
  if(!candidates.length)return false;
  const target=candidates[Math.floor(Math.random()*candidates.length)];faceTarget(h,target);
  if(individual){(reserved||(locks[k]=[])).push(target);h.mammothPetrifySpentBN=true;}else locks[k]=true;
  h.mammothCastBN={age:0,target,hit:false};h.setMoveIntent(0,0);return true;
 }
 function faceTarget(h,target){const dx=target.x-h.x,dy=target.y-h.y;if(Math.abs(dx)>Math.max(7,Math.abs(dy)*.28)){h.mammothFaceBN=dx<0?-1:1;h.mammothHeadingXBN=undefined;}}
 function startAttack(h,target){
  if(!h.waveMammothBN||!target||target.dead)return false;
  if(!h.mammothAttackBN){h.mammothAttackBN={age:0,target,hit:false};faceTarget(h,target);}
  return true;
 }
 function tickAttack(h,dt,check){
  const a=h.mammothAttackBN;
  a.age+=dt;
  h.attackCd=Math.max(0,h.attackCd-dt);
  h.setMoveIntent(0,0);
  if(!a.hit&&a.age>=ATTACK_HIT){
   a.hit=true;const t=a.target;
   if(t&&!t.dead&&DIST(h,t)<=(h.attackReachFor(t)+6)**2&&(!check||check(h,t))&&(!a.ghostStoneBN||g.ghostStoneContactBN?.(h)===t)){
    if(t.type==='wall'){const before=t.hp;t.takeDamage?.(h.getDamage(),h);noteWallHit(h,t,before-t.hp);}
    else t.takeDamage?.(g.ghostElfAPI?.attackValue(h,t)??h.getDamage(),h);
   }
  }
  if(a.age>=ATTACK_MS)h.mammothAttackBN=null;
 }
 const update=Hound.prototype.update;
 Hound.prototype.update=function(dt,...args){
  if(!this.waveMammothBN||this.dead||!enabled())return update.call(this,dt,...args);
  if(g.groundWaveDwellBN?.(this))return;
  // Upgrade existing save units and pending legacy spawns once, including an in-progress swing.
  if(this.mammothDamageScaleBN!==DAMAGE_FACTOR&&Number.isFinite(this.waveDamage)){
   this.waveDamage=this.waveDamage*DAMAGE_FACTOR/(this.mammothDamageScaleBN||LEGACY_DAMAGE_FACTOR);
   this.mammothDamageScaleBN=DAMAGE_FACTOR;
  }
  if((this.cardStormStunMs||0)>0||this.slimeFlameStun407>0){
   this.mammothMovingBN=false;return update.call(this,dt,...args);
  }
  this.mammothMovingBN=false;
  if(this.mammothAttackBN){if(!this.mammothPreviousSlimeBN)this.mammothPreviousSlimeBN=g.mammothPreviousSlimeBN?.(this.waveNumber,this.soloSlime===true);tickAttack(this,dt);return;}
  if(usePetrify(this,dt))return;
  const x=this.x,y=this.y;update.call(this,dt,...args);
  if(!this.mammothAttackBN)nativeWalk(this,this.x-x,this.y-y,dt);
 };
 const render=Hound.prototype.draw;
 Hound.prototype.draw=function(ctx,...args){
  if(!this.waveMammothBN)return render.call(this,ctx,...args);
  if(this.dead)return;
  const cast=this.mammothCastBN,attack=this.mammothAttackBN||g.ghostCopyBN?.mammothAttack?.(this);
  const visualScale=renderer.phaseVisualScale(this);
  // Missing optional art never blocks waves, battle, or the stone-effect cue.
  if(!art.ready){render.call(this,ctx,false);if(cast)drawCastCue(this,cast,ctx,visualScale);return;}
  const action=cast?'petrify':attack?'attack':this.mammothMovingBN?'walk':'idle';
  const elapsedMs=cast?cast.age:attack?attack.age:this.mammothMovingBN?this.mammothWalkBN:0;
  const rear=!cast&&!attack&&g.monsterRearMotionBN?.drawMammoth(ctx,this,this.x,this.y+16,this.mammothMovingBN?Number(renderer.frameAt('walk',elapsedMs).slice(5)):0,this.mammothMovingBN,art.images?.shadow,visualScale,this.waveNumber>=16?art.images?.armorRear:null);
  if(!rear)renderer.draw(ctx,art.images,{x:this.x,y:this.y+16,action,elapsedMs,facingLeft:this.mammothFaceBN<0,visualScale,armor:this.waveNumber>=16});
  const f=Math.max(0,Math.min(1,this.hp/this.maxHp)),top=this.y+16-118*visualScale;
  if(f<1&&g.ghostElfAPI?.host!==this){ctx.save();ctx.fillStyle='#1B2D20';ctx.fillRect(this.x-24*visualScale,top,48*visualScale,5*visualScale);ctx.fillStyle='#65D981';ctx.fillRect(this.x-23*visualScale,top+visualScale,46*f*visualScale,3*visualScale);ctx.restore();}
  if(cast)drawCastCue(this,cast,ctx,visualScale);
 };
 function castLabel(ctx,x,y,label){
  ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;
  ctx.strokeStyle='#182921';ctx.strokeText(label,x,y);ctx.fillStyle='#f0fbe2';ctx.fillText(label,x,y);
 }
 function ring(ctx,x,y,r,start,end){ctx.beginPath();ctx.ellipse(x,y,r,r*.40,0,start,end);ctx.stroke();}
 function drawCastCue(h,cast,ctx,s){
  // A local spell cue around the unchanged hand-drawn body; no battlefield-wide tint.
  const x=h.x,y=h.y+19,r=30*s,charged=Math.min(1,cast.age/385),fade=1-Math.max(0,(cast.age-385)/385);
  ctx.save();ctx.globalAlpha*=.84*fade;
  ctx.strokeStyle='#233a31';ctx.lineWidth=5;ring(ctx,x,y,r,0,Math.PI*2);
  ctx.strokeStyle='#b9ead6';ctx.lineWidth=2;ring(ctx,x,y,r,0,Math.PI*2);
  ctx.strokeStyle='#f6ffd2';ctx.lineWidth=3;ring(ctx,x,y,r,-Math.PI/2,-Math.PI/2+2*Math.PI*Math.max(.06,charged));
  if(!cast.hit)castLabel(ctx,x,h.y+16-134*s,'石化蓄力');
  drawCastFlight(h,cast,ctx,s);
  ctx.restore();
 }
 // A visual-only stone release spans the latter half of the unchanged
 // 385 ms windup. Native range checks, timing and stun stay authoritative.
 function drawCastFlight(h,cast,ctx,s){
  const t=cast.target;if(cast.age<195||cast.age>=385||!t||t.dead)return;
  const u=Math.min(1,(cast.age-195)/190),sx=h.x+15*s*(h.mammothFaceBN<0?-1:1),sy=h.y-48*s,tx=t.x,ty=t.y-27;
  const x=sx+(tx-sx)*u,y=sy+(ty-sy)*u-38*u*(1-u);
  const a=Math.atan2(ty-sy,tx-sx);
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  ctx.strokeStyle='#c3dcbb';ctx.globalAlpha*=.8;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-15,0);ctx.lineTo(2,0);ctx.stroke();
  ctx.fillStyle='#9c9b89';ctx.strokeStyle='#e9ddaf';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-5,3);ctx.lineTo(-7,-3);ctx.lineTo(-1,-7);ctx.lineTo(6,-4);ctx.lineTo(7,3);ctx.lineTo(1,7);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#e8c478';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-2,-5);ctx.lineTo(0,0);ctx.lineTo(-3,3);ctx.stroke();
  ctx.restore();
 }
 function drawPetrified(b,ctx,steady=(c,draw)=>draw()){
  const left=b.mammothPetrifyLeftBN;
  if(!(left>0)||b.dead)return;
  ctx.save();const r=Math.max(23,Math.min(45,b.radius||28)),x=b.x,y=b.y-10;
  // Local stone facets hug the lower tower so the target silhouette stays visible.
  const impact=Math.max(0,(left-(PETRIFY_MS-250))/250);
  ctx.fillStyle=impact>.45?'rgba(232,232,232,.42)':'rgba(165,165,165,.14)';
  ctx.strokeStyle='#e1e1e1';ctx.lineWidth=2;
  ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3,px=x+Math.sin(a)*r,py=y+Math.cos(a)*r*.45;if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
  ctx.fillStyle='#969696';ctx.strokeStyle='#dddddd';ctx.lineWidth=1;
  for(const side of [-1,1]){
   const px=x+side*(r-3);
   ctx.beginPath();ctx.moveTo(px-6,y+12);ctx.lineTo(px+side*1,y-5);ctx.lineTo(px+side*7,y-1);ctx.lineTo(px+7,y+12);ctx.closePath();ctx.fill();ctx.stroke();
  }
  const label=left>4000?'石化 4.2秒':'石化 '+Math.ceil(left/1000)+'秒';
  steady(ctx,()=>castLabel(ctx,x,b.y+r+13,label));ctx.restore();
 }
 function nativeWalk(h,dx,dy,dt){const before=h.mammothWalkBN;renderer.updateGait(h,dx,dy,dt);if(h.mammothWalkBN!==before)g.monsterRearMotionBN?.observe(h,dx,dy);}
 function possessedWalk(h,x,y,dt){nativeWalk(h,h.x-x,h.y-y,dt);}
 g.mammothCandidate={spawn,flush,isWave,enabled,drawPetrified,drawWallHits,startAttack,tickAttack,possessedWalk,roadPoint,art,damageScale:DAMAGE_FACTOR};
}
module.exports={install,prepareArt,isWave,PER_LANE,PETRIFY_MS};
