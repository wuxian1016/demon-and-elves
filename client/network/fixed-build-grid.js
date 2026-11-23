'use strict';
const {candidates,latticePoint,nearestCandidate}=require('./fixed-build-grid-core');
const SPACING=100,EPS=1e-5;
// 100 vs reference96 is a deliberate4.17% density compromise: existing90-wide
// walls retain their10 gap; original16 minimum wall/tower spacing still decides
// whether each fixed anchor is legal. Nothing nudges a blocked anchor.
function installFixedBuildGrid(g,{Building,catalog=[],viewport=()=>null,active=()=>true,artRevision=()=>0}={}){
 if(g.fixedBuildGridAB)return g.fixedBuildGridAB;
 if(typeof Building!=='function')throw Error('GRID_BUILDING_TYPE_REQUIRED');
 const original={};for(const key of ['placementBlockReason','findPlacementSpot621','compactDefenseSnapSpot','defenseRecommendationSpots','drawDefenseRecommendationGuides','handlePlacementTap','drawPlacementPreview','buildBuilding','finishAllyBuild'])original[key]=g[key];
 const shapeByType=new Map(),geometry=new WeakMap(),legalCache=new Map();let legacyDepth=0,rebuilds=0,signatureScans=0;
 const enabled=()=>active()&&!g.tutorial&&!g.roundStarting&&['prep','hunt'].includes(g.state);
 const shape=type=>{let value=shapeByType.get(type);if(!value){const b=new Building(0,0,type);value={radius:b.radius};shapeByType.set(type,value);}return value;};
 const frameFor=zone=>{
  if(!zone||![zone.x,zone.y,zone.gateX,zone.gateY].every(Number.isFinite))return null;
  const radius=Number.isFinite(zone.radius)&&zone.radius>0?zone.radius:1120;
  const key=[zone.x,zone.y,zone.gateX,zone.gateY,radius].join(':');let old=geometry.get(zone);if(old?.key===key)return old;
  const config={origin:{x:zone.gateX,y:zone.gateY},spacing:SPACING,angle:0,bounds:{minX:Math.max(0,zone.x-radius),maxX:Math.min(10000,zone.x+radius),minY:Math.max(0,zone.y-radius),maxY:Math.min(8000,zone.y+radius)}};
  old={key,config,zone,radius,points:Object.freeze(candidates(config).filter(p=>Math.hypot(p.x-zone.x,p.y-zone.y)<=radius+EPS))};geometry.set(zone,old);return old;
 };
 const regionAt=(x,y)=>{let chosen=null,best=Infinity;for(const zone of g.resourceZones||[]){const f=frameFor(zone);if(!f)continue;const d=Math.hypot(x-zone.x,y-zone.y);if(d<=f.radius+EPS&&d<best){chosen=f;best=d;}}return chosen;};
 const isGridPoint=(x,y,type=null)=>{const f=regionAt(x,y);return !f||!!latticePoint(f.config,x,y);};
 const reason=(x,y,radius,type,rebuildOwner=null,receiver=g)=>{
  if(enabled()&&!legacyDepth&&type&&!isGridPoint(x,y,type))return '请选择固定格位建造';
  return original.placementBlockReason.call(receiver,x,y,radius,type,rebuildOwner);
 };
 g.placementBlockReason=function(x,y,radius,type,rebuildOwner){return reason(x,y,radius,type,rebuildOwner,this);};
 const sameValues=(old,next)=>old&&old.length===next.length&&next.every((v,i)=>v===old[i]);
 const visibleRegions=()=>{
  const v=viewport(),z=g.zoom?.()||1,c=g.camera;
  if(!v||!c)return (g.resourceZones||[]).map(frameFor).filter(Boolean);
  const right=c.x+v.width/z,bottom=c.y+(v.fullHeight||v.height)/z;
  return (g.resourceZones||[]).map(frameFor).filter(f=>f&&f.config.bounds.maxX>=c.x&&f.config.bounds.minX<=right&&f.config.bounds.maxY>=c.y&&f.config.bounds.minY<=bottom);
 };
 const legalFor=(f,type)=>{
  signatureScans++;const radius=shape(type).radius,key=(g.resourceZones||[]).indexOf(f.zone)+':'+type,old=legalCache.get(key),values=old?.values||[];let cursor=0,changed=!old;
  const record=value=>{if(values[cursor]!==value){changed=true;values[cursor]=value;}cursor++;};
  for(const value of [f,g.plots,g.terrainCollisionEnabled,g.terrainRevision,g.navTerrainCache,g.terrainClearEpoch411,artRevision(),g.trollBase,g.trollBase?.x,g.trollBase?.y,g.trollBase?.radius,g.trollBase?.dead,g.waterPools,g.mountainRanges,g.guardTreeBuckets])record(value);
  record(g.placement?.wallAxisAB);record(g.wallOrientationAB?.scope);
  for(const b of g.buildings||[]){record(b);record(b.x);record(b.y);record(b.radius);record(b.level);record(b.type);record(b.dead);record(b.ownerSlot);record(b.wallAxisAB);}
  const guards=g.nearbyGuardTrees?.(f.zone.x,f.zone.y,f.radius+180)||[];for(const t of guards){record(t);record(t.x);record(t.y);record(t.radius);record(t.dead);}
  const left=f.config.bounds.minX,right=f.config.bounds.maxX,top=f.config.bounds.minY,bottom=f.config.bounds.maxY;
  for(let y=Math.max(0,top-180);y<=Math.min(8000,bottom+180)+90;y+=90)for(let x=Math.max(0,left-180);x<=Math.min(10000,right+180)+90;x+=90){const o=g.plots.ownerAt(x,y);record(o);record(o?.kind);record(o?.ref);record(o?.ref?.dead);if(o?.refs)for(const b of o.refs){record(b);record(b.dead);}}
  if(values.length!==cursor){changed=true;values.length=cursor;}
  if(old&&!changed){legalCache.delete(key);legalCache.set(key,old);return old.points;}
  const previousGeometry=g.placementGeometry621;g.placementGeometry621=new Map();
  try{
   const visual=g.placementVisual621(type,radius,1),nearby=[];
   for(const b of g.buildings||[]){if(b.dead)continue;const other=g.placementVisual621(b.type,b.radius,b.level||1,b.visualLevel?.()??b.level),rangeX=Math.max(radius+b.radius+16,((visual.w||0)+(other.w||0))/2+16),above=Math.max(radius+b.radius+16,(other.h||0)+16),below=Math.max(radius+b.radius+16,(visual.h||0)+16);
    if(b.x+rangeX>=left&&b.x-rangeX<=right&&b.y+below>=top&&b.y-above<=bottom)nearby.push(b);
   }
   const view=Object.create(g);view.buildings=nearby;
   const points=Object.freeze(f.points.filter(p=>original.placementBlockReason.call(view,p.x,p.y,radius,type)===null).map(p=>Object.freeze({...p,type,buildType:type,valid:true,reason:null})));
   rebuilds++;legalCache.delete(key);legalCache.set(key,{values,points});while(legalCache.size>2)legalCache.delete(legalCache.keys().next().value);return points;
  }catch(error){legalCache.delete(key);throw error;}finally{g.placementGeometry621=previousGeometry;}
 };
 const nearbySpot=(x,y,radius,type,maxDistance=Math.max(80,radius*3))=>{
  const f=regionAt(x,y);if(!f)return null;
  const sorted=f.points.filter(p=>Math.hypot(p.x-x,p.y-y)<=maxDistance).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y)||a.row-b.row||a.col-b.col);
  for(const p of sorted)if(original.placementBlockReason.call(g,p.x,p.y,radius,type)===null)return {x:p.x,y:p.y};return null;
 };
 g.findPlacementSpot621=function(x,y,radius,type){if(!enabled()||legacyDepth||!type||!regionAt(x,y))return original.findPlacementSpot621.call(this,x,y,radius,type);return nearbySpot(x,y,radius,type);};
 g.compactDefenseSnapSpot=function(x,y,radius,type){if(!enabled()||legacyDepth||!type||!regionAt(x,y))return original.compactDefenseSnapSpot.call(this,x,y,radius,type);const f=regionAt(x,y);return nearestCandidate(f.points,x,y,SPACING/Math.SQRT2+EPS);};
 let suppressGuides=false;
 g.defenseRecommendationSpots=function(){if(!enabled()||legacyDepth)return original.defenseRecommendationSpots.call(this);if(suppressGuides||!this.placement){legalCache.clear();return [];}const type=this.placement.type;if(this.buildingCountBlockReason(type))return [];return visibleRegions().flatMap(f=>legalFor(f,type));};
 g.handlePlacementTap=function(x,y){
  if(!enabled()||!this.placement||this.placementButtonAt(x,y))return original.handlePlacementTap.call(this,x,y);
  const p=this.placement,w=this.screenToWorld(x,y);
  if(this.findUpgradeTargetAt(p.type,w.x,w.y)){suppressGuides=true;try{return original.handlePlacementTap.call(this,x,y);}finally{suppressGuides=false;}}
  const hit=nearestCandidate(this.defenseRecommendationSpots(),w.x,w.y,58);
  if(hit){Object.assign(p,{x:hit.x,y:hit.y,stage:'confirm'});p.reason=this.buildingCountBlockReason(p.type)||this.placementBlockReason(p.x,p.y,p.radius,p.type);p.valid=p.reason===null;this.showToast(p.valid?'已选中合法格位，点击确认建造':'该格位已被占用，请重新选择');return;}
  return original.handlePlacementTap.call(this,x,y);
 };
 g.drawDefenseRecommendationGuides=function(ctx,spots=this.defenseRecommendationSpots()){
  if(!enabled())return original.drawDefenseRecommendationGuides.call(this,ctx,spots);
  if(!this.placement||!spots.length)return;
  const v=viewport(),zoom=this.zoom?.()||1,c=this.camera,margin=100;
  ctx.save();try{ctx.lineWidth=1.5/zoom;ctx.fillStyle='rgba(134,220,178,.09)';ctx.strokeStyle='rgba(177,237,195,.6)';for(const p of spots){if(v&&c&&(p.x<c.x-margin||p.y<c.y-margin||p.x>c.x+v.width/zoom+margin||p.y>c.y+(v.fullHeight||v.height)/zoom+margin))continue;
   const wall=p.type==='wall'&&g.wallOrientationAB,axis=wall?wall.requested(p.x,p.y):null,width=wall?(axis==='v'?wall.depth:wall.length):64,height=wall?(axis==='v'?wall.length:wall.depth):64,top=wall?p.y-height/2:p.y-64;ctx.fillRect(p.x-width/2,top,width,height);const d=10;ctx.beginPath();for(const [sx,sy]of [[-1,0],[1,0],[-1,1],[1,1]]){const x=p.x+sx*width/2,y=top+sy*height;ctx.moveTo(x-sx*d,y);ctx.lineTo(x,y);ctx.lineTo(x,y+(sy?-d:d));}ctx.stroke();ctx.fillRect(p.x-1.5,wall?p.y-1.5:p.y-33.5,3,3);
  }}finally{ctx.restore();}
 };
 g.drawPlacementPreview=function(ctx){const result=original.drawPlacementPreview.call(this,ctx);if(enabled()&&this.placement&&this.placement.type!=='wall'){const p=this.placement,s=this.placementVisual621(p.type,p.radius,1);ctx.save();try{ctx.lineWidth=2/(this.zoom?.()||1);ctx.strokeStyle=p.valid?'rgba(242,216,140,.8)':'rgba(242,126,112,.8)';ctx.strokeRect(p.x-s.w/2,p.y+(this.defensePlacementSize(p.type)?0:26)-s.h,s.w,s.h);}finally{ctx.restore();}}return result;};
 g.buildBuilding=function(type,wood,gold,x,y){if(enabled()&&!legacyDepth&&type&&!this.findUpgradeTargetAt(type,x,y)&&!isGridPoint(x,y,type)){this.showToast('请选择固定格位建造');return false;}return original.buildBuilding.call(this,type,wood,gold,x,y);};
 // AI planners keep their original strategy, costs, safety and routes. Their
 // proposed site is selected from the SAME fixed anchors, not shifted geometry.
 const normalizePlanImpl=(plan,ally)=>{
  if(!enabled()||!plan||plan.type!=='build'||!plan.spot||plan.fixedGridAB)return plan;
  const f=regionAt(plan.spot.x,plan.spot.y);if(!f)return plan;const type=plan.buildType,radius=shape(type).radius;
  const points=f.points.filter(p=>Math.hypot(p.x-plan.spot.x,p.y-plan.spot.y)<=Math.max(120,radius*3)).sort((a,b)=>Math.hypot(a.x-plan.spot.x,a.y-plan.spot.y)-Math.hypot(b.x-plan.spot.x,b.y-plan.spot.y));
  for(const p of points){if(g.demonLineBlocked?.(plan.spot,p,ally.radius)||original.placementBlockReason.call(g,p.x,p.y,radius,type)!==null||g.allySpotAlreadyPlanned(ally,p)||g.isAllyWalkPointDeferred(ally,p)||!g.allyWorkPointSafe(ally,p))continue;
   if(g.isDefenseGuideTowerType(type)&&!g.allyBuildings(ally,'wall').some(w=>g.allyWallProtectsTower(ally,w,{...p,dead:false})))continue;
   return {...plan,spot:{x:p.x,y:p.y},...(type==='wall'&&g.wallOrientationAB?{wallAxisAB:g.wallOrientationAB.axis({x:p.x,y:p.y})}:{}),fixedGridAB:true};
  }return null;
 };
 const fixedDefensePlan=(ally,type)=>{
  if(!enabled()||!g.wallOrientationAB||!g.isDefenseGuideTowerType(type))return null;
  const home=g.allyHome(ally)||ally.homeZone,f=home&&regionAt(home.x,home.y);if(!f)return null;
  const walls=g.allyBuildings(ally,'wall').filter(w=>!w.dead),guns=g.allyBuildings(ally).filter(b=>!b.dead&&g.isDefenseGuideTowerType(b.type));
  if(!walls.length)return null;const prototype=new Building(0,0,type),range=prototype.range||prototype.healRange||260,radius=shape(type).radius;
  const approaches=g.allyDefenseApproachSamples(ally,walls),limit=g.allyDefenseRadius(ally),ranked=[];
  for(const p of f.points){if(Math.hypot(p.x-home.x,p.y-home.y)>=limit||!walls.some(w=>g.allyWallProtectsTower(ally,w,p)))continue;
   if(guns.length&&!guns.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<=Math.min(range,t.range||260)))continue;
   const coverage=approaches.reduce((n,q)=>n+(Math.hypot(p.x-q.x,p.y-q.y)<=range?1:0),0);if(!coverage)continue;
   if(original.placementBlockReason.call(g,p.x,p.y,radius,type)!==null||g.allySpotAlreadyPlanned(ally,p)||g.isAllyWalkPointDeferred(ally,p)||!g.allyWorkPointSafe(ally,p))continue;
   ranked.push({p,coverage,near:walls.reduce((d,w)=>Math.min(d,Math.hypot(w.x-p.x,w.y-p.y)),Infinity)});
  }
  ranked.sort((a,b)=>b.coverage-a.coverage||a.near-b.near||Math.hypot(a.p.x-home.x,a.p.y-home.y)-Math.hypot(b.p.x-home.x,b.p.y-home.y));
  if(ranked.length)return {type:'build',buildType:type,spot:{x:ranked[0].p.x,y:ranked[0].p.y},fixedGridAB:true};
  // A100-grid lane can run out of protected gun sites even though its old90
  // planner keeps returning the same connector. Find a REAL paid wall+gun
  // pair; never widen protection rules or place a gun outside its screen.
  if(walls.length>=g.allyWallExpansionLimit(ally))return null;
  const wr=shape('wall').radius;
  for(const p of f.points){if(Math.hypot(p.x-home.x,p.y-home.y)>=limit||!walls.some(w=>Math.hypot(p.x-w.x,p.y-w.y)<=201))continue;
   if(original.placementBlockReason.call(g,p.x,p.y,wr,'wall')!==null||g.allySpotAlreadyPlanned(ally,p)||g.isAllyWalkPointDeferred(ally,p)||!g.allyWorkPointSafe(ally,p))continue;
   const wall={...p,type:'wall',ownerSlot:ally.slot,dead:false},checks=g.allyDefenseApproachSamples(ally,[wall]);
   const future=f.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<=230&&g.allyWallProtectsTower(ally,wall,q)&&original.placementBlockReason.call(g,q.x,q.y,radius,type)===null&&g.wallPlacementPairAB(q.x,q.y,radius,type,wall)===null&&checks.some(a=>Math.hypot(q.x-a.x,q.y-a.y)<=range)&&(!guns.length||guns.some(t=>Math.hypot(q.x-t.x,q.y-t.y)<=Math.min(range,t.range||260)))&&!g.allySpotAlreadyPlanned(ally,q)&&!g.isAllyWalkPointDeferred(ally,q)&&g.allyWorkPointSafe(ally,q));
   if(future)return {type:'build',buildType:'wall',spot:{x:p.x,y:p.y},wallAxisAB:g.wallOrientationAB.axis(p),fixedGridAB:true};
  }
  return null;
 };
 const normalizePlan=(plan,ally,wanted)=>{const work=()=>{const normalized=normalizePlanImpl(plan,ally);return wanted&&(!normalized||normalized.buildType!==wanted)?fixedDefensePlan(ally,wanted)||normalized:normalized;};return g.wallOrientationAB?g.wallOrientationAB.withAxis('auto',work):work();};
 for(const key of ['planAllyBuildSteps','planAllyDefenseBuildSteps','planAllyOutpostMineSteps']){const method=g[key];if(typeof method!=='function')continue;g[key]=function(...args){const iterator=method.apply(this,args),ally=args[0];const guarded=kind=>value=>{legacyDepth++;try{const result=iterator[kind](value);if(result.done)result.value=normalizePlan(result.value,ally,typeof args[1]==='string'?args[1]:args[1]?.type);return result;}finally{legacyDepth--;}};return {next:guarded('next'),return:guarded('return'),throw:guarded('throw'),[Symbol.iterator](){return this;}};};}
 g.finishAllyBuild=function(ally,task){
  if(!task?.fixedGridAB){legacyDepth++;try{return original.finishAllyBuild.call(this,ally,task);}finally{legacyDepth--;}}
  if(!task.spot||!isGridPoint(task.spot.x,task.spot.y,task.buildType))return false;
  const plots=this.plots,center=plots.centerOfKey,key=plots.keyOf(task.spot.x,task.spot.y);let used=false;
  // Original economy commit normally re-centres on the90resource grid. Only
  // that first site lookup is kept at its already validated100-grid anchor;
  // all plot keys/ownership, travel, funds, threat and final checks stay original.
  if(!this.defensePlacementSize(task.buildType))plots.centerOfKey=function(k){if(!used&&k===key){used=true;return {x:task.spot.x,y:task.spot.y};}return center.call(this,k);};
  try{return original.finishAllyBuild.call(this,ally,task);}finally{plots.centerOfKey=center;}
 };
 const api={spacing:SPACING,regionAt,isGridPoint,legalFor,shape,normalizePlan,stats:()=>({rebuilds,signatureScans,cachedSelections:legalCache.size,legacyDepth}),clear:()=>{legalCache.clear();shapeByType.clear();}};
 g.fixedBuildGridAB=api;return api;
}
module.exports={installFixedBuildGrid,SPACING};
