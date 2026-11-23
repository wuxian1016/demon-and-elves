'use strict';
module.exports=function createResourceSpacing(geometry,normal,footTerrain){
const GAP=6,indices=new WeakMap(),reservedCaches=new WeakMap();
function invalidate(g){indices.delete(g);}
function nearby(g,box){let index=indices.get(g);if(!index||index.trees!==g.trees||index.mines!==g.goldMines||index.nt!==g.trees.length||index.nm!==g.goldMines.length){index={trees:g.trees,mines:g.goldMines,nt:g.trees.length,nm:g.goldMines.length,buckets:new Map()};for(const [kind,list]of [['tree',g.trees],['mine',g.goldMines]])for(const o of list){if(o.isGuard)continue;const key=Math.floor(o.x/180)+','+Math.floor(o.y/180);if(!index.buckets.has(key))index.buckets.set(key,[]);index.buckets.get(key).push({kind,o});}indices.set(g,index);}const out=[];for(let y=Math.floor((box.y0-50)/180);y<=Math.floor((box.y1+110)/180);y++)for(let x=Math.floor((box.x0-60)/180);x<=Math.floor((box.x1+60)/180);x++)for(const row of index.buckets.get(x+','+y)||[])out.push(row);return out;}
function reserved(g){let r=reservedCaches.get(g);if(r?.zones===g.resourceZones&&r.revision===g.terrainRevision&&r.recommendations===g.defenseRecommendationLayout&&r.generating===g.resourceSpacingGeneratingAD)return r.boxes;const boxes=[];for(const z of g.resourceZones||[])for(const s of g.defenseRecommendationLayout(z)){if(s.optionalGuide)continue;const w=s.type==='wall'?90:106,h=s.type==='wall'?90:107,bottom=s.type==='wall'?0:26;boxes.push({x0:s.x-w/2,x1:s.x+w/2,y0:s.y+bottom-h,y1:s.y+bottom});}reservedCaches.set(g,{zones:g.resourceZones,revision:g.terrainRevision,recommendations:g.defenseRecommendationLayout,generating:g.resourceSpacingGeneratingAD,boxes});return boxes;}

function bounds(kind,p){const w=kind==='tree'?80+Math.abs(Math.round(p.x*7+p.y*3))%10:94,h=kind==='tree'?w*1.1:79,bottom=kind==='tree'?23:26;return {x0:p.x-w/2,x1:p.x+w/2,y0:p.y+bottom-h,y1:p.y+bottom};}
const overlaps=(a,b,gap=GAP)=>a.x0<b.x1+gap&&a.x1>b.x0-gap&&a.y0<b.y1+gap&&a.y1>b.y0-gap;
function buildingBounds(b,g=null){const d=geometry.types[b.type];if(!d)return {x0:b.x-b.radius,x1:b.x+b.radius,y0:b.y-b.radius,y1:b.y+b.radius};const v=geometry.visualShape(d,b.type==='house'?2:Math.min(13,Math.max(1,b.level||1))-1);const art={x0:b.x-v.w/2,x1:b.x+v.w/2,y0:b.y+26-v.h,y1:b.y+26},foot=normal.footprint(b.type,b.x,b.y,g);return foot?{x0:Math.min(art.x0,foot.x0),x1:Math.max(art.x1,foot.x1),y0:Math.min(art.y0,foot.y0),y1:Math.max(art.y1,foot.y1)}:art;}
function canOccupy(g,kind,p,ignore=null){const occupied=g.plots.ownerAt(p.x,p.y);if(occupied&&occupied.ref!==ignore)return false;if(p.x<80||p.y<80||p.x>9920||p.y>7920||g.inSpawnClearRing(p.x,p.y)||g.terrainCollisionAt(p.x,p.y,kind==='tree'?36:40))return false;
 const box=bounds(kind,p),radius=kind==='tree'?24:28;
 // Reserve only the real existing entrance wall/tower slots; never shift them.
 for(const r of reserved(g))if(overlaps(box,r))return false;
 // Native resource plots may have overlapping foliage/ore silhouettes. Keep
 // their original compact distribution; only real plot ownership separates them.
 // Keep natural canopy/ore overhang as in the old map. Initial camps only
 // need their true resource trunk/body outside the reserved building ground.
 const body={x0:p.x-radius,x1:p.x+radius,y0:p.y-radius,y1:p.y+radius};
 for(const b of g.buildings||[])if(!b.dead){const foot=normal.footprint(b.type,b.x,b.y,g)||buildingBounds(b,g);if(overlaps(body,foot,0))return false;}
 const base=g.trollBase;if(base&&!base.dead&&Math.hypot(p.x-base.x,p.y-base.y)<base.radius+radius+40)return false;
 return true;
}
function find(g,kind,obj){let zone=null,d=850**2;for(const z of g.resourceZones||[]){const q=(z.x-obj.x)**2+(z.y-obj.y)**2;if(q<d){zone=z;d=q;}}const center=g.plots.centerOfKey(g.plots.keyOf(obj.x,obj.y));
 // Prefer a small correction inside the resource's existing native plot.
 // Most canopy/trunk conflicts do not require moving to a different90-cell.
 const ownKey=g.plots.keyOf(obj.x,obj.y);if(g.plots.ownerAt(obj.x,obj.y)?.ref===obj)for(const radius of [8,16,24,32,40])for(const [dx,dy]of [[0,-radius],[-radius,0],[radius,0],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){const p={x:obj.x+dx,y:obj.y+dy};if(g.plots.keyOf(p.x,p.y)===ownKey&&canOccupy(g,kind,p,obj))return{...p,key:ownKey};}

 // A nine-cell base can fill the compact rear patch. Keep its original720
 // search first, then use reachable space inside the same1120-unit camp;
 // never discard resources or relocate across the gate into a different camp.

 for(const localRadius of zone?[720,960]:[540])for(let ring=0;ring<=13;ring++)for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==ring)continue;const p={x:center.x+dx*90,y:center.y+dy*90};if(zone){const fromZone=Math.hypot(p.x-zone.x,p.y-zone.y);if(fromZone>localRadius||localRadius>720&&fromZone<=720)continue;const gx=zone.x-zone.gateX,gy=zone.y-zone.gateY;if(Number.isFinite(gx+gy)&&(p.x-zone.gateX)*gx+(p.y-zone.gateY)*gy<0)continue;if(Number.isFinite(gx+gy)){const vx=Math.abs(gx)>Math.abs(gy)?Math.sign(gx):0,vy=vx?0:Math.sign(gy);if((p.x-zone.x)*vx+(p.y-zone.y)*vy<-90)continue;}}else if(Math.hypot(p.x-obj.x,p.y-obj.y)>540)continue;
  if(!canOccupy(g,kind,p,obj))continue;const owner=g.plots.ownerAt(p.x,p.y);if(owner?.ref===obj)return {...p,key:g.plots.keyOf(p.x,p.y)};const spot=g.plots.claim(p.x,p.y,kind);if(spot){g.plots.setRef(spot.key,obj);return spot;}
 }return null;
}
function move(g,kind,obj){const old={x:obj.x,y:obj.y},spot=find(g,kind,obj);if(!spot)return false;if(g.plots.keyOf(old.x,old.y)!==spot.key&&g.plots.ownerAt(old.x,old.y)?.ref===obj)g.plots.release(old.x,old.y);obj.x=spot.x;obj.y=spot.y;invalidate(g);return true;}
function reconcile(g){normal.install(g);invalidate(g);let moved=0,blocked=0;for(const [kind,list] of [['mine',g.goldMines||[]],['tree',g.trees||[]]])for(const o of list){if(o.isGuard||kind==='mine'&&o.dead)continue;if(!canOccupy(g,kind,o,o)||g.plots.ownerAt(o.x,o.y)?.ref!==o){if(move(g,kind,o))moved++;else blocked++;}}
 if(moved){g.workerTreeCaches=new WeakMap();g.workerTreeFailures=new WeakMap();g.workerLoadFrame=null;g.terrainObstacleGrid=null;g.navTerrainCache=null;g.terrainClearEpoch411=(g.terrainClearEpoch411||0)+1;}return {moved,blocked};}
// Defense ground and natural trunk/body use the same physical footprint as canOccupy.
// Foliage, barrels and transparent art overhang must not forbid an otherwise legal tile.
// Native forest/water, plot ownership and building separation still run unchanged.
function buildingBlock(g,type,x,y,radius){if(!type||!g.resourceSpacingAD||g.resourceSpacingGeneratingAD)return null;const defense=geometry.types[type]?.defense,box=defense?normal.footprint(type,x,y,g):buildingBounds({type,x,y,radius,level:1},g);if(!box)return null;for(const {kind,o}of nearby(g,box)){const r=kind==='tree'?24:28,resource=defense?{x0:o.x-r,x1:o.x+r,y0:o.y-r,y1:o.y+r}:bounds(kind,o);if(!o.dead&&overlaps(box,resource))return kind==='tree'?'这里与树木轮廓重叠，请稍微移开':'这里与金矿轮廓重叠，请稍微移开';}return null;}
function install(g){if(g.resourceSpacingAD)return g.resourceSpacingAD;const originals={findTreeSpot:g.findTreeSpot,findNaturalSpot:g.findNaturalSpot,relocateTreeIfBlocked:g.relocateTreeIfBlocked,tryUpgradeBuilding:g.tryUpgradeBuilding,applySavedWorld:g.applySavedWorld};const patch=(k,v)=>Object.defineProperty(g,k,{value:v,writable:true,configurable:true,enumerable:false});
 patch('findTreeSpot',function(tree){return this.resourceSpacingGeneratingAD?originals.findTreeSpot.call(this,tree):find(this,'tree',tree);});
 patch('findNaturalSpot',function(kind,obj){return !this.resourceSpacingGeneratingAD&&(kind==='tree'||kind==='mine')?find(this,kind,obj):originals.findNaturalSpot.call(this,kind,obj);});
 patch('relocateTreeIfBlocked',function(tree){if(canOccupy(this,'tree',tree,tree)&&this.plots.ownerAt(tree.x,tree.y)?.ref===tree)return false;if(move(this,'tree',tree)){this.workerTreeCaches=new WeakMap();this.spawnParticles(tree.x,tree.y,'#81C784',6);return true;}tree.dead=true;tree.respawnTimer=1000;return false;});
 patch('tryUpgradeBuilding',function(...args){const result=originals.tryUpgradeBuilding.apply(this,args);if(result&&args[0]){const b=args[0];for(const {kind,o}of nearby(this,buildingBounds(b,this)))if(!o.dead&&!canOccupy(this,kind,o,o))move(this,kind,o);this.workerTreeCaches=new WeakMap();}return result;});
 patch('applySavedWorld',function(...args){const result=originals.applySavedWorld.apply(this,args);if(result)reconcile(this);return result;});
 const api={reconcile:()=>reconcile(g),originals};patch('resourceSpacingAD',api);return api;
}
function footprintBlock(g,type,x,y,world){if(g.resourceSpacingGeneratingAD||geometry.types[type]?.defense)return null;const box=normal.footprint(type,x,y,g);return box?footTerrain.block(g,box,world):null;}
return {footprintBlock,bounds,buildingBounds,overlaps,canOccupy,find,move,reconcile,buildingBlock,install};
};
