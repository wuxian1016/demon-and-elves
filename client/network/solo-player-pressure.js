'use strict';
const buildingObservers=new WeakMap(),constructionObservers=new WeakMap();
// Offline-only, data-only campaign memory. No map reads or visibility overrides.
function installSoloPlayerPressure(battle,random){
 const g=battle.g,t=g.troll;
 const enabled=()=>battle.soloMultiAi===true&&!g.networkAuthorityPhases627&&battle.policyActive?.()!==false&&!g.tutorial&&!g.superChallenge580&&battle.players.length===1&&((g.allies||[]).length>0||t.soloPlayerPressureBG?.armed===true);
 if(!enabled())return {observeBuildings(){},departed(){},engage(){},repelled(){},eliminated(){},preferred:()=>null,snapshot:()=>null};
 const human=battle.players[0].id,old=t.soloPlayerPressureBG;
 // The roster can empty after the last AI defects; an earned human pursuit survives.
 const s={schema:1,human,engaged:false,armed:false,limit:0,eliminated:[],demolished:[],locked:false,completed:false};
 if(old&&old.schema===1&&old.human===human){s.locked=old.locked===true;s.completed=old.completed===true;s.engaged=old.engaged===true;s.armed=old.armed===true&&(old.limit===1||old.limit===2);s.limit=s.armed?old.limit:0;s.eliminated=Array.isArray(old.eliminated)?[...new Set(old.eliminated.filter(x=>typeof x==='string'&&x!==human&&x.length<=128))]:[];}
 if(old&&old.schema===1&&old.human===human&&Array.isArray(old.demolished))s.demolished=old.demolished.filter(x=>x&&typeof x.owner==='string'&&x.owner!==human&&x.owner.length<=128&&['demon','summoned'].includes(x.source)&&Number.isFinite(x.graceDeaths)&&x.graceDeaths>=0).map(x=>({owner:x.owner,source:x.source,graceDeaths:x.graceDeaths}));
 const clearDemolition=owner=>{s.demolished=s.demolished.filter(x=>x.owner!==owner);};
 const markEliminated=owner=>{if(enabled()&&s.armed&&owner!==human&&typeof owner==='string'&&(g.allies||[]).some(a=>a.dead&&!a.defected&&battle.ownerIdForEngineSlot(a.slot)===owner)&&!s.eliminated.includes(owner))s.eliminated.push(owner);};
 Object.defineProperty(g,'soloPlayerPressureGraceBG',{configurable:true,enumerable:false,value:{restored(e){if(enabled())clearDemolition(battle.ownerIdForEngineSlot(e.slot));},expired(e){if(!enabled()||!e.dead||e===g.player)return;const owner=battle.ownerIdForEngineSlot(e.slot),record=s.demolished.find(x=>x.owner===owner);if(record&&(e.noBuildingGraceDeathsAZ||0)>record.graceDeaths)markEliminated(owner);clearDemolition(owner);}}});
 t.soloPlayerPressureBG=s;
 const humanAlive=()=>{const p=battle.players.find(p=>p.id===human);return !!p?.body&&!p.body.dead&&!battle.offline?.has(human);};
 return {
  observeBuildings({Building,ownerOf,isDemonSource}){
   const proto=Building?.prototype;if(!proto||typeof proto.takeDamage!=='function')return;
   let observer=buildingObservers.get(proto);if(!observer){observer={hurt:proto.takeDamage,current:null};buildingObservers.set(proto,observer);proto.takeDamage=function(amount,source,...args){const wasAlive=!this.dead,result=observer.hurt.call(this,amount,source,...args);if(wasAlive&&this.dead)observer.current?.(this,source);return result;};}
   let construction=constructionObservers.get(g);if(!construction){construction={current:null};constructionObservers.set(g,construction);for(const name of ['finishAllyBuild','buildBuilding','trySellBuilding','restoreShareWallsBF']){const original=g[name];if(typeof original!=='function')continue;Object.defineProperty(g,name,{configurable:true,writable:true,enumerable:false,value:function(...args){const result=original.apply(this,args);if(result)construction.current?.(name,args);return result;}});}}
   construction.current=(name,args)=>{if(!enabled())return;if(name==='trySellBuilding')clearDemolition(ownerOf(args[0]));for(const record of [...s.demolished])if((g.buildings||[]).some(b=>!b.dead&&b.hp>0&&ownerOf(b)===record.owner))clearDemolition(record.owner);};
   observer.current=(building,source)=>{if(!enabled())return;const owner=ownerOf(building),ally=(g.allies||[]).find(a=>!a.dead&&!a.defected&&battle.ownerIdForEngineSlot(a.slot)===owner);if(!ally)return;clearDemolition(owner);if(s.armed&&isDemonSource(source)&&!(g.buildings||[]).some(b=>!b.dead&&b.hp>0&&ownerOf(b)===owner))s.demolished.push({owner,source:source===t?'demon':'summoned',graceDeaths:ally.noBuildingGraceDeathsAZ||0});};
  },
  departed(){s.engaged=false;},
  engage(owner){if(enabled()&&owner===human&&humanAlive())s.engaged=true;},
  repelled(){if(enabled()&&s.engaged&&!s.armed&&humanAlive()){s.armed=true;s.limit=random()<.5?1:2;s.eliminated=[];s.demolished=[];}},
  eliminated:markEliminated,
  preferred(){if(!enabled()||!s.armed||s.completed)return null;if(!humanAlive()){if(s.locked)s.completed=true;return null;}if(s.eliminated.length>=s.limit||!(g.allies||[]).some(a=>!a.dead&&!a.defected))s.locked=true;return s.locked?human:null;},
  snapshot(){return {...s,eliminated:[...s.eliminated],demolished:s.demolished.map(x=>({...x}))};}
 };
}
module.exports={installSoloPlayerPressure};
