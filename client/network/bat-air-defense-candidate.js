'use strict';
const groundNetBN=require('./ground-net-control');
const griffin=require('./griffin-wave');
// User-approved tower progression, 2026-11-18. Pure specs; mode unlock enforced by Building cap.
const AA=[{hp:400,damage:18},{hp:750,damage:34},{hp:1100,damage:52},{hp:1450,damage:70},{hp:1800,damage:90},{hp:2150,damage:112}];
const ROOT=[1200,1800,2400,2700,3000,3200];
const APPROVED={approved:true,antiAir:{levels:[{cost:{wood:90,gold:60},range:320},{cost:{wood:110,gold:75},range:390},{cost:{wood:180,gold:120},range:460},{cost:{wood:270,gold:180},range:510},{cost:{wood:390,gold:260},range:560},{cost:{wood:540,gold:360},range:600}]},net:{levels:[{cost:{wood:70,gold:50},range:290,hp:360,damage:0},{cost:{wood:90,gold:65},range:345,hp:600,damage:0},{cost:{wood:140,gold:100},range:400,hp:840,damage:0},{cost:{wood:210,gold:150},range:440,hp:1080,damage:0},{cost:{wood:300,gold:220},range:480,hp:1320,damage:0},{cost:{wood:420,gold:310},range:520,hp:1560,damage:0}]}};
const validCost=c=>c&&['gold','wood'].every(k=>Number.isInteger(c[k])&&c[k]>=0);
module.exports=function create({enabled=()=>false,config=APPROVED,onAction=null}={}){
 const netFlights=new WeakMap();
 function flightBucket(g,create=false){
  let s=netFlights.get(g);
  if(s&&(s.player!==g.player||s.buildings!==g.buildings)){netFlights.delete(g);s=null;}
  if(!s&&create){s={player:g.player,buildings:g.buildings,active:new Map()};netFlights.set(g,s);}
  return s?.active;
 }
 function clearFlights(g){netFlights.delete(g);}
 function validNetTarget(g,t,air){
  return t&&!t.dead&&!(t.hp<=0)&&(air
   ?(griffin.sky(t)?!groundNetBN.immune(g,t):t.waveBat&&t.airborne&&!(t.batRootBN>0)&&!(t.batNetImmuneBN>0))
   :groundNetBN.trackable(g,t));
 }
 function launchNet(g,b,target,s,Projectile,muzzle){
  const air=!!target.waveBat||griffin.sky(target);if(!validNetTarget(g,target,air))return false;
  const pending=flightBucket(g,true);if(pending.has(target))return false;
  const origin=muzzle?.(b)||{x:b.x,y:b.y-58},distance=Math.hypot(target.x-b.x,target.y-b.y);
  pending.set(target,{origin,air,s,Projectile,source:b,age:0,duration:Math.min(325,175+distance*.32),arc:Math.min(32,14+distance*.035)});
  return true;
 }
 function tickFlights(g,dt){
  const pending=flightBucket(g);if(!pending?.size)return;
  if(!enabled(g)){clearFlights(g);return;}
  if(!(dt>0))return;
  for(const [t,f] of pending){
   if(!validNetTarget(g,t,f.air)){pending.delete(t);continue;}
   f.age+=dt;if(f.age<f.duration)continue;
   pending.delete(t);
   const {s,Projectile,source:b}=f;
   if(!f.air){groundNetBN.lock(g,t,s.root);continue;}
   if(t.waveGriffinBN){griffin.hold(g,t,s.root);continue;}
   t.batRootBN=s.root;t.batGroundedBN=true;t.batNetImmuneBN=s.root+2000;
   t.batNetVisualBN=Math.max(1560,s.root);t.batNetVisualDurationBN=t.batNetVisualBN;
   if(s.damage>0){const shot=new Projectile(b.x,b.y,t,{kind:'arrow',damage:s.damage,soundSource:b});shot.batAntiAirBN=true;t.takeDamage(s.damage,shot);}
  }
 }
 function drawFlights(g,c,inView,visuals,offset){
  const pending=flightBucket(g);
  if(!pending?.size||!enabled(g)||!visuals?.drawNetFlight)return;
  for(const [target,f] of pending){
   if(target.dead)continue;
   const o=f.air?null:offset?.(target),goal=visuals.netFlightTarget(target,!f.air),t=Math.min(1,f.age/f.duration);
   const x=f.origin.x+(goal.x+(o?.x||0)-f.origin.x)*t,y=f.origin.y+(goal.y+(o?.y||0)-(f.air&&target.waveGriffinBN?target.griffinAltitudeBN:0)-f.origin.y)*t-4*f.arc*t*(1-t);
   if(inView(x,y,64))visuals.drawNetFlight(c,x,y,goal.size);
  }
 }
 function spec(kind,lv){const c=config?.[kind];if(config?.approved!==true||!['antiAir','net'].includes(kind)||!Number.isSafeInteger(lv)||lv<1||(kind==='net'&&lv>6)||!c)return null;let v=c.levels?.[Math.min(6,lv)-1];if(kind==='antiAir'&&lv>6&&v){const n=lv-6,factor=1+.25*n+.02*n*n;v={...v,cost:{wood:Math.min(10000,Math.ceil(v.cost.wood*factor)),gold:Math.min(10000,Math.ceil(v.cost.gold*factor))}};}if(!v||!validCost(v.cost)||!Number.isFinite(v.range)||v.range<=0)return null;
  if(kind==='net'&&(!Number.isFinite(v.hp)||v.hp<=0||!Number.isFinite(v.damage)||v.damage<0))return null;
  return {...v,...(kind==='antiAir'?(lv<=6?AA[lv-1]:(()=>{const n=lv-6,g=1+.12*n+.004*n*n;return{hp:Math.ceil(2150*g),damage:Math.ceil(112*g)};})()):{}),interval:kind==='antiAir'?400:4000,root:kind==='net'?ROOT[lv-1]:0};}
 function apply(b,kind,lv){const s=spec(kind,lv);if(!s)return false;const old=b.maxHp||s.hp,ratio=Math.max(0,Math.min(1,b.hp/old));Object.assign(b,{airDefenseKindBN:kind,level:lv,maxHp:s.hp*(b.cardHpFactor||1),hp:s.hp*(b.cardHpFactor||1)*ratio,damage:s.damage,range:s.range,attackCd:0});return true;}
 function build(g,kind,x,y,nativeBuild){if(!enabled(g)||!Number.isFinite(x)||!Number.isFinite(y)||g.player.dead||!['prep','hunt'].includes(g.state))return false;const s=spec(kind,1);if(!s){g.airDefenseBlockedBN='unconfirmed-economy-or-range';return false;}
  // Native construction supplies resource, sight, terrain, footprint, ownership and occupancy checks.
  // Never accidentally upgrade an existing ordinary tower through native same-type reuse.
  if(g.findUpgradeTargetAt('tower',x,y))return false;
  const n=g.buildings.length;if(!nativeBuild('tower',s.cost.wood,s.cost.gold,x,y))return false;const b=g.buildings[n];if(!b||b.type!=='tower')throw Error('Native build contract violated');apply(b,kind,1);b.hp=b.maxHp;return true;
 }
 function upgrade(g,b){if(!enabled(g)||!b||b.dead||!g.buildings.includes(b)||(b.ownerSlot??null)!==null||g.player.dead||!['prep','hunt'].includes(g.state)||!g.easyOpeningGuideAllowsUpgrade(b)||g.buildingUpgradeBlockReason(b))return false;
  const s=spec(b.airDefenseKindBN,b.level+1);if(!s||(typeof b.maxUpgradeLevel==='function'&&b.level>=b.maxUpgradeLevel())){g.airDefenseBlockedBN='level-cap-or-unconfirmed-upgrade';return false;}const w=g.player;if(w.gold<s.cost.gold||w.wood<s.cost.wood)return false;w.gold-=s.cost.gold;w.wood-=s.cost.wood;const paid=b.paidCost||{gold:0,wood:0};b.paidCost={gold:paid.gold+s.cost.gold,wood:paid.wood+s.cost.wood};apply(b,b.airDefenseKindBN,b.level+1);return true;
 }
 function action(g,b,t,s){const a={kind:b.airDefenseKindBN,phase:'fire',source:b,target:t,level:b.level,visualDurationMs:b.airDefenseKindBN==='net'?s.root:400,controlDurationMs:s.root};const list=g.airDefenseActionsBN||(g.airDefenseActionsBN=[]);list.push(a);if(list.length>64)list.shift();if(onAction)onAction(a);}
 function tick(g,b,hostiles,Projectile,muzzle){if(!b.airDefenseKindBN)return false; // true claims tower even when offline gate stops it
  if(!enabled(g)||b.dead||b.stunTimer>0||b.attackCd>0)return true;const raw=spec(b.airDefenseKindBN,b.level);if(!raw)return true;const m=g.cardsCandidate?.mods(b),s=m?{...raw,damage:raw.damage*m.attack,interval:raw.interval/m.attackSpeed}:raw;
  const maxDistance=s.range*s.range,net=b.airDefenseKindBN==='net',pending=net?flightBucket(g):null;
  let sky=null,ground=null,skyDistance=maxDistance,groundDistance=maxDistance;
  function consider(h){
   if(!h||h.dead||h.hp<=0||pending?.has(h))return;
   const d=(h.x-b.x)**2+(h.y-b.y)**2;
   if(griffin.sky(h)||h.waveBat&&h.airborne){
    if(d<skyDistance&&(!net||(griffin.sky(h)?!groundNetBN.immune(g,h):!(h.batRootBN>0)&&!(h.batNetImmuneBN>0)))){sky=h;skyDistance=d;}
   }else if(net&&!h.airborne&&!h.waveBat&&d<groundDistance&&!groundNetBN.immune(g,h)){ground=h;groundDistance=d;}
  }
  for(const h of hostiles)consider(h);
  if(net)consider(g.troll);
  const target=sky||ground;
  if(!target)return true;
  if(b.airDefenseKindBN==='antiAir'){const shot=new Projectile(b.x,b.y-22,target,{kind:'arrow',damage:s.damage,speed:8,soundSource:b});shot.batAntiAirBN=true;shot.airVisualTierBN=b.level;g.projectiles.push(shot);}
  else if(!launchNet(g,b,target,s,Projectile,muzzle))return true;
  b.attackCd=s.interval;action(g,b,target,s);return true;
 }
 return {spec,build,upgrade,tick,tickFlights,drawFlights,clearFlights,apply,AA,ROOT,APPROVED};
};
