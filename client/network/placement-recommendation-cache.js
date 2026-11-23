'use strict';
const types=require('./placement-geometry-data').types;
// UI memoization only: keep the native legal search, completion flags and exact
// anchor choices. A remote AI building cannot block this camp's entrance.
function install(g,{active=()=>true}={}){
 if(g.placementRecommendationCacheAZ)return g.placementRecommendationCacheAZ;
 const original=g.defenseRecommendationSpots;let prior=null,rows=null,rebuilds=0,hits=0;
 // Plot containers/terrain memo epochs are rebuilt for remote AI construction.
 // Compare local semantic occupants and clear-ring membership, not those derived identities.
 const signature=()=>{const z=g.resourceZones?.[require('./placement-current-camp').index(g)],type=g.placement?.type,a=[type,g.player,g.player?.dead,require('./placement-current-camp').index(g),z,z?.x,z?.y,z?.gateX,z?.gateY,z?.gridOriginXAQ,z?.gridOriginYAQ,g.defenseWallGuideComplete,g.defenseTowerGuideComplete,g.troll,g.terrainRevision,g.terrainCollisionEnabled,g.tutorial,g.trollBase?.x,g.trollBase?.y,g.trollBase?.radius,g.trollBase?.dead];if(!z)return a;
  // Native candidates/search are within512 of the gate;320 additionally
  // covers every known building envelope. Track all owned bodies for limits.
  for(const b of g.buildings||[])if(!types[b.type]||(b.radius||0)>320||b.ownerSlot==null||Math.abs(b.x-z.gateX)<=832&&Math.abs(b.y-z.gateY)<=832)a.push(b,b.x,b.y,b.type,b.radius,b.level,b.dead,b.ownerSlot);
  for(const t of g.nearbyGuardTrees?.(z.gateX,z.gateY,1250)||[])a.push(t,t.x,t.y,t.radius,t.dead);
  for(const r of g.rocks||[])if(Math.abs(r.x-z.gateX)<=832&&Math.abs(r.y-z.gateY)<=832)a.push(r,r.x,r.y,r.radius,r.dead);
  for(const list of[g.waterPools||[],g.mountainRanges||[]])for(const r of list)a.push(r,r.x,r.y,r.radius,r.w,r.h);
  for(const t of['wall',g.isDefenseGuideTowerType(type)?type:'tower'])a.push(g.buildingCountBlockReason(t));
  require('./placement-plot-samples').append(g,a,z.gateX-832,z.gateY-832,z.gateX+832,z.gateY+832);
  return a;
 };
 const get=()=>{if(!active()||!g.placement)return original.call(g);const type=g.placement.type;if(type!=='wall'&&!g.isDefenseGuideTowerType(type)||type==='wall'&&g.defenseWallGuideComplete||g.isDefenseGuideTowerType(type)&&g.defenseTowerGuideComplete)return [];const values=signature();if(prior&&values.length===prior.length&&values.every((v,i)=>v===prior[i])){hits++;return rows.map(r=>({...r}));}rows=original.call(g).map(r=>({...r}));prior=signature();rebuilds++;return rows.map(r=>({...r}));};
 g.defenseRecommendationSpots=function(){return get();};
 const api={get,original,clear:()=>{prior=null;rows=null;},stats:()=>({rebuilds,hits})};Object.defineProperty(g,'placementRecommendationCacheAZ',{value:api,configurable:true});return api;
}
module.exports={install};
