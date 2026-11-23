'use strict';
const levels=[0,2,4,8,14,24],owner=e=>e.ownerSlot??null;
function contribution(b){return b?.type==='houseForPeasants'?levels[Math.max(1,Math.min(5,Math.floor(b.level||1)))]:b?.type==='house'&&b.level>=3?2:0;}
function alive(b){return b&&!b.dead&&!(Number.isFinite(b.hp)&&b.hp<=0);}
function kill(g,p){if(p.dead)return false;p.dead=true;p.hp=0;p.populationLossC3=true;p.task=null;p.moveTarget=null;p.carryWood=p.carryGold=0;if(p.inTank?.crew===p)p.inTank.crew=null;p.inTank=null;g.clearUnitNavigation?.(p);return true;}
// Sale releases the roof, not all of its workers. Cull only the owner's
// excess, preferentially those displaced by this roof, then rebind survivors.
function afterLoss(g,b,sold){
 if(!g||!contribution(b)||!Array.isArray(g.peasants))return 0;
 const k=owner(b);let killed=sold?0:reconcile(g);
 let over=g.getPeasantCount(k)-g.getPeasantCap(k);
 if(over<=0)return killed;
 const roster=g.peasants;
 for(let pass=0;pass<2&&over>0;pass++)for(let i=roster.length-1;i>=0&&over>0;i--){
  const p=roster[i];if(p.dead||owner(p)!==k)continue;
  if(pass===0&&p.populationSourceC3!==b&&p.populationHomeC3!==b&&!p.populationLegacyOverflowC3)continue;
  if(kill(g,p)){killed++;over--;}
 }
 return killed;
}
function guard(g,p){const s=p.populationSourceC3;if(p.populationBoundC3&&s&&!s.populationSoldC3&&(!alive(s)||!(g.buildings||[]).includes(s)||owner(s)!==owner(p)))return kill(g,p);return false;}
const states=new WeakMap();
function changed(g,state){if(!state||state.buildings!==g.buildings||state.peasants!==g.peasants||state.bs.length!==g.buildings.length||state.ps.length!==g.peasants.length)return true;for(let i=0;i<state.bs.length;i++){const b=g.buildings[i],r=state.bs[i];if(r[0]!==b||r[1]!==alive(b)||r[2]!==contribution(b)||r[3]!==owner(b)||r[4]!==b.populationSoldC3)return true;}for(let i=0;i<state.ps.length;i++){const p=g.peasants[i],r=state.ps[i];if(r[0]!==p||r[1]!==p.dead||r[2]!==owner(p)||r[3]!==p.populationBoundC3||r[4]!==p.populationSourceC3)return true;}return false;}
function snapshot(g,state){state=state||{rebuilds:0};state.buildings=g.buildings;state.peasants=g.peasants;state.bs=g.buildings.map(b=>[b,alive(b),contribution(b),owner(b),b.populationSoldC3]);state.ps=g.peasants.map(p=>[p,p.dead,owner(p),p.populationBoundC3,p.populationSourceC3]);state.rebuilds++;states.set(g,state);}
function reconcile(g){
 if(!Array.isArray(g.peasants)||!Array.isArray(g.buildings))return 0;
 const state=states.get(g);if(!changed(g,state))return 0;
 let killed=0;
 const groups=new Map(),present=new Set(g.buildings),lanes=new WeakMap(),homes=new Map();
 function group(k){if(!groups.has(k))groups.set(k,{base:0,used:new Map(),workers:[],sources:[]});return groups.get(k);}
 function lane(o){if(!o||typeof g.resourceZoneIndexFor401!=='function')return -1;if(!lanes.has(o))lanes.set(o,g.resourceZoneIndexFor401(o));return lanes.get(o);}
 for(const ally of g.allies||[])if(Number.isInteger(ally.homeZoneIndex)&&ally.homeZoneIndex>=0)homes.set(ally.slot,ally.homeZoneIndex);
 for(const b of g.buildings){
  if(b.type==='house'&&b.isInitialBase&&owner(b)===null&&!homes.has(null))homes.set(null,lane(b));
  if(alive(b)&&contribution(b))group(owner(b)).sources.push(b);
 }
 if(!homes.has(null)&&Number.isInteger(g.playerStartZoneIndex))homes.set(null,g.playerStartZoneIndex);
 function unbind(p){p.populationBoundC3=false;p.populationSourceC3=null;}
 for(const p of g.peasants){
  if(p.dead)continue;
  const k=owner(p),a=group(k),s=p.populationSourceC3;
  // Record the birthplace independently of the worker's mutable delivery home.
  const actual=p.homeHouse?.type==='house'&&owner(p.homeHouse)===k?p.homeHouse:null;
  if(p.populationHomeC3===undefined&&actual)p.populationHomeC3=actual;
  const home=p.populationHomeC3,at=lane(home),primary=homes.get(k);
  const remote=at>=0&&primary>=0&&at!==primary;
  if(p.populationBoundC3&&s&&owner(s)!==k){killed+=kill(g,p)?1:0;continue;}
  // One-time repair for a legacy remote worker granted a primary free slot or a
  // different camp's building. Matching local references remain authoritative.
  if(remote&&p.populationBoundC3&&(!s||lane(s)!==at))unbind(p);
  if(p.populationBoundC3&&s){
   if(s.populationSoldC3)unbind(p);
   else if(!present.has(s)||!alive(s)){killed+=kill(g,p)?1:0;continue;}
  }
  if(p.populationBoundC3){
   if(s)a.used.set(s,(a.used.get(s)||0)+1);else a.base++;
  }else if(remote&&home&&!home.populationSoldC3&&(!present.has(home)||!alive(home))){
   killed+=kill(g,p)?1:0;
  }else a.workers.push({p,home,at,remote});
 }
 for(const a of groups.values())for(const row of a.workers){
  const {p,home,at,remote}=row;
  const free=b=>(a.used.get(b)||0)<contribution(b);
  let source;
  if(remote&&home&&!home.populationSoldC3){
   // A remote birth uses its own sub-base contribution first, then local
   // roof capacity. Owner-wide training limits/costs remain in native code.
   source=free(home)?home:a.sources.find(b=>lane(b)===at&&free(b))||home;
  }else if(a.base<2){source=null;a.base++;}
  else {
   source=a.sources.find(b=>(at<0||lane(b)===at)&&free(b));
   if(!source)source=a.sources.find(free);
  }
  if(source!==undefined){
   if(source)a.used.set(source,(a.used.get(source)||0)+1);
   p.populationSourceC3=source;p.populationBoundC3=true;p.populationLegacyOverflowC3=false;
  }else p.populationLegacyOverflowC3=true;
 }
 snapshot(g,state);return killed;
}
function install(proto){if(proto.populationBindingInstalledC3)return;Object.defineProperty(proto,'populationBindingInstalledC3',{value:true});for(const name of ['update','tryMakePeasant','serializeProgress','serializeProgressAsync','loadProgress','loadProgressAsync']){const native=proto[name];if(typeof native!=='function')continue;proto[name]=function(...args){reconcile(this);const result=native.apply(this,args);if(result?.then)return result.then(value=>{reconcile(this);return value;});reconcile(this);return result;};}
 const sale=proto.trySellBuilding;if(typeof sale==='function')proto.trySellBuilding=function(b,...args){reconcile(this);const previous=b?.populationSoldC3;if(b)b.populationSoldC3=true;let result;try{result=sale.call(this,b,...args);}finally{if(!result&&b){if(previous===undefined)delete b.populationSoldC3;else b.populationSoldC3=previous;}}reconcile(this);return result;};}
module.exports={contribution,reconcile,guard,afterLoss,install,stats:g=>({rebuilds:states.get(g)?.rebuilds||0})};
