'use strict';
const data=require('./placement-geometry-data');
// Camp lattice plus exact original recommendation cells. Recommendation
// world anchors never move; every hint is its actual reserved footprint.
const CELL=90,UNIT=103,BASE_SIZE=193;
const ordinary=type=>!!data.types[type]&&type!=='house'&&!data.types[type].defense;
const gridded=type=>!!data.types[type];
function zoneAt(g,x,y){let best=null,nearest=Infinity;for(const z of g?.resourceZones||[]){const d=Math.hypot(x-z.x,y-z.y);if(!Number.isFinite(z.gateX+z.gateY)||d>(z.radius||1120)||d>=nearest)continue;const dx=z.x-z.gateX,dy=z.y-z.gateY,nx=Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,ny=nx?0:Math.sign(dy);if((x-z.gateX)*nx+(y-z.gateY)*ny>=-1e-6){best=z;nearest=d;}}return best;}
const inFixedArea=(g,x,y)=>!!zoneAt(g,x,y);
const worldOrigins=new WeakMap();
function origin(z,g){if(!z||!g)return{x:z?.gateX||0,y:z?.gateY||0};let map=worldOrigins.get(g);if(!map){map=new WeakMap();worldOrigins.set(g,map);}let o=map.get(z);if(o){if(Object.isExtensible(z)&&!Number.isFinite(z.gridOriginXAQ+z.gridOriginYAQ)){z.gridOriginXAQ=o.x;z.gridOriginYAQ=o.y;}return o;}if(Number.isFinite(z.gridOriginXAQ)&&Number.isFinite(z.gridOriginYAQ)){o=Object.freeze({x:z.gridOriginXAQ,y:z.gridOriginYAQ});map.set(z,o);return o;}
 // Bind the camp lattice to its existing initial base without moving that base.
 // Retain this origin after demolition; a replacement base cannot shift slots.
 const home=(g.buildings||[]).find(b=>b.type==='house'&&zoneAt(g,b.x,b.y)===z);
 o=home?{x:home.x-UNIT/2,y:home.y-79}:{x:z.gateX||0,y:z.gateY||0};if(home||!g.resourceSpacingGeneratingAD&&['prep','hunt'].includes(g.state)){o=Object.freeze(o);map.set(z,o);if(Object.isExtensible(z)){z.gridOriginXAQ=o.x;z.gridOriginYAQ=o.y;}}return o;}
// Ground centres align: wall90 and tower80 have a five-unit anchor offset.
// Immutable recommendation aliases still return their exact original x/y.
const anchorOffset=type=>data.types[type]?.defense?(type==='wall'?-24:-29):-24;const columnOffset=type=>type==='house'?.5:0;
function recommendation(g,type,x,y){if(!data.types[type]?.defense)return null;const z=zoneAt(g,x,y);if(!z)return null;return g.defenseRecommendationLayout(z).find(p=>(type==='wall'?p.type==='wall':p.type==='tower')&&Math.hypot(p.x-x,p.y-y)<1e-6)||null;}
// A tower can use its native five-unit margin inside the SAME reserved90 cell.
// Only permanent forest edge rejects are eligible. All native terrain/trunk,
// resource and building collision checks still decide the final placement.
const towerAnchorCachesBA=new WeakMap();
function towerAnchor(g,type,p){
 if(!g||g.resourceSpacingGeneratingAD||g.tutorial||!data.types[type]?.defense||type==='wall'||typeof g.terrainCollisionAt!=='function')return p;
 const rec=recommendation(g,type,p.x,p.y);if(rec&&!rec.optionalGuide)return p;
 // Match native WORLD_WIDTH/HEIGHT placement bounds before attempting an edge recovery.
 const radius=data.types[type].radius,inBounds=q=>q.x>=radius&&q.x<=10000-radius&&q.y>=radius&&q.y<=8000-radius;if(!inBounds(p))return p;
 const hit=g.terrainCollisionAt(p.x,p.y,radius);if(hit?.kind!=='guardTree')return p;
 const region=require('./camp-hint-region');if(!region.contains(g,p.x,p.y))return p;
 let c=towerAnchorCachesBA.get(g);const key=[g.resourceZones,g.terrainRevision,g.terrainClearEpoch411,g.guardTreeBuckets,g.waterPools,g.rocks,g.mountainRanges,g.terrainCollisionEnabled];if(!c||!key.every((v,i)=>v===c.key[i])){c={key,rows:new Map()};towerAnchorCachesBA.set(g,c);}const id=type+':'+p.x+':'+p.y;if(c.rows.has(id))return c.rows.get(id);
 const box=footprint(type,p.x,p.y,g);let result=p;
 for(const[dx,dy]of[[0,5],[0,-5],[-5,0],[5,0],[-5,5],[5,5],[-5,-5],[5,-5]]){const q={x:p.x+dx,y:p.y+dy},b=footprint(type,q.x,q.y,g);if(!inBounds(q)||!b||['x0','x1','y0','y1'].some(k=>b[k]!==box[k])||!region.contains(g,q.x,q.y)||g.terrainCollisionAt(q.x,q.y,radius))continue;if((g.nearbyGuardTrees?.(q.x,q.y,radius+70)||[]).some(t=>Math.hypot(q.x-t.x,q.y-t.y)<radius+t.radius+10))continue;result=q;break;}
 if(c.rows.size>=4096)c.rows.delete(c.rows.keys().next().value);c.rows.set(id,result);return result;
}
function aligned(x,y,g=null,type='goldMine'){if(g&&recommendation(g,type,x,y))return true;const o=origin(g?zoneAt(g,x,y):null,g),offset=anchorOffset(type),column=(x-o.x)/UNIT-columnOffset(type);if(Math.abs(column-Math.round(column))<1e-8&&Math.abs((y-offset-o.y)/UNIT-Math.round((y-offset-o.y)/UNIT))<1e-8)return true;if(!g||!data.types[type]?.defense||type==='wall')return false;const q=cell(g,type,x,y),z=zoneAt(g,x,y),alias=z&&g.defenseRecommendationLayout(z).find(p=>p.type==='tower'&&cell(g,type,p.x,p.y).c===q.c&&cell(g,type,p.x,p.y).r===q.r),canonical=alias||{x:q.x,y:q.y+offset};if(Math.abs(x-canonical.x)>5.00000001||Math.abs(y-canonical.y)>5.00000001)return false;const adjusted=towerAnchor(g,type,canonical);return Math.abs(x-adjusted.x)<1e-8&&Math.abs(y-adjusted.y)<1e-8;}
function cell(g,type,x,y){const o=origin(zoneAt(g,x,y),g),c=Math.round((x-o.x)/UNIT-columnOffset(type)),r=Math.round((y-anchorOffset(type)-o.y)/UNIT);return {c,r,x:o.x+(c+columnOffset(type))*UNIT,y:o.y+r*UNIT};}
function bounds(c,r,o){const x=o.x+c*UNIT,y=o.y+r*UNIT;return {w:CELL,h:CELL,x0:x-CELL/2,x1:x+CELL/2,y0:y-88,y1:y+2};}
function footprint(type,x,y,g=null){if(!gridded(type))return null;if(recommendation(g,type,x,y)){const bottom=type==='wall'?26:31;return {w:CELL,h:CELL,bottom,x0:x-CELL/2,x1:x+CELL/2,y0:y+bottom-CELL,y1:y+bottom,columns:1,rows:1};}const z=zoneAt(g,x,y),q=cell(g,type,x,y),o=origin(z,g);if(!z&&type==='house'){const x0=x-BASE_SIZE/2,y0=y+26-BASE_SIZE,cells=[];for(let r=0;r<2;r++)for(let c=0;c<2;c++)cells.push({w:CELL,h:CELL,x0:x0+c*UNIT,x1:x0+c*UNIT+CELL,y0:y0+r*UNIT,y1:y0+r*UNIT+CELL});return{w:BASE_SIZE,h:BASE_SIZE,bottom:26,x0,x1:x0+BASE_SIZE,y0,y1:y+26,cells,columns:2,rows:2};}if(!z&&type!=='house'){const bottom=data.types[type].defense&&type!=='wall'?31:26;return {w:CELL,h:CELL,bottom,x0:x-CELL/2,x1:x+CELL/2,y0:y+bottom-CELL,y1:y+bottom};}// Compute a cell envelope for legacy off-grid buildings as well; never
 // move saved world anchors or let their true silhouette escape occupancy.
 let w,h,bottom;if(type==='house'){const rows=[0,1,2].map(i=>data.visualShape(data.types.house,i));w=Math.max(...rows.map(v=>v.visibleW??v.w));h=Math.max(...rows.map(v=>v.visibleH??v.h));bottom=26;}else if(data.types[type].defense){w=h=type==='wall'?90:80;bottom=26;}else{w=h=90;bottom=26;}
 const x0=x-w/2,x1=x+w/2,y0=y+bottom-h,y1=y+bottom;
 const c0=Math.floor((x0-o.x+CELL/2)/UNIT),c1=Math.ceil((x1-o.x-CELL/2)/UNIT),r0=Math.floor((y0-o.y+88)/UNIT),r1=Math.ceil((y1-o.y-2)/UNIT),a=bounds(c0,r0,o),b=bounds(c1,r1,o),cells=[];for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)cells.push(bounds(c,r,o));return {w:b.x1-a.x0,h:b.y1-a.y0,x0:a.x0,x1:b.x1,y0:a.y0,y1:b.y1,bottom:b.y1-y,...(cells.length>1||type==='house'?{cells}:{}),columns:c1-c0+1,rows:r1-r0+1};}
function install(g){if(g.ordinaryBuildingGridAD){for(const z of g.resourceZones||[])origin(z,g);return g.ordinaryBuildingGridAD;}const find=g.findPlacementSpot,snap=g.compactDefenseSnapSpot;
 const nearest=(x,y,type)=>{const q=cell(g,type,x,y),z=zoneAt(g,x,y);if(data.types[type]?.defense&&z){const p=g.defenseRecommendationLayout(z).find(p=>(type==='wall'?p.type==='wall':p.type==='tower')&&cell(g,type,p.x,p.y).c===q.c&&cell(g,type,p.x,p.y).r===q.r);if(p)return towerAnchor(g,type,{x:p.x,y:p.y});}return towerAnchor(g,type,{x:q.x,y:q.y+anchorOffset(type)});};
 const spot=(x,y,radius,type)=>{const c=nearest(x,y,type);for(let ring=0;ring<=2;ring++){const choices=[];for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===ring)choices.push(nearest(c.x+dx*UNIT,c.y+dy*UNIT,type));choices.sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2));for(const p of choices)if(inFixedArea(g,p.x,p.y)&&aligned(p.x,p.y,g,type)&&g.canPlaceBuilding(p.x,p.y,radius,type))return p;}return null;};
 const patch=(k,v)=>Object.defineProperty(g,k,{value:v,enumerable:false,configurable:true,writable:true});
 patch('findPlacementSpot',function(x,y,radius,type){if(!this.resourceSpacingGeneratingAD&&gridded(type)&&inFixedArea(this,x,y))return spot(x,y,radius,type);const p=find.call(this,x,y,radius,type);return !this.resourceSpacingGeneratingAD&&gridded(type)&&p&&inFixedArea(this,p.x,p.y)?spot(p.x,p.y,radius,type):p;});
 patch('compactDefenseSnapSpot',function(x,y,radius,type){return !this.resourceSpacingGeneratingAD&&gridded(type)&&inFixedArea(this,x,y)?spot(x,y,radius,type)||nearest(x,y,type):snap.call(this,x,y,radius,type);});
 for(const z of g.resourceZones||[])origin(z,g);
 const hintCampAt=(x,y)=>{let index=-1,best=Infinity;for(let i=0;i<(g.resourceZones||[]).length;i++){const z=g.resourceZones[i],d=(x-z.x)**2+(y-z.y)**2;if(d<best){index=i;best=d;}}return index;};
 const api={hintCampAt,hintOrigins:()=>(g.resourceZones||[]).map((z,camp)=>({...origin(z,g),camp})),unit:UNIT,cell:CELL,ordinary,gridded,anchorOffset,columnOffset,nearest,aligned:(x,y,type)=>aligned(x,y,g,type),origins:box=>(g.resourceZones||[]).filter(z=>!box||z.x+(z.radius||1120)>=box[0]&&z.x-(z.radius||1120)<=box[2]&&z.y+(z.radius||1120)>=box[1]&&z.y-(z.radius||1120)<=box[3]).map(z=>origin(z,g)),inFixedArea:(x,y)=>inFixedArea(g,x,y),reason:(type,x,y)=>!g.resourceSpacingGeneratingAD&&gridded(type)&&inFixedArea(g,x,y)&&!aligned(x,y,g,type)?'请在当前区域的建造格位上选择位置':null,originalFind:find,originalSnap:snap};patch('ordinaryBuildingGridAD',api);require('./defense-recommendation-grid').install(g);return api;
}
module.exports={CELL,UNIT,BASE_SIZE,ordinary,gridded,aligned,inFixedArea,footprint,install,zoneAt,cell,towerAnchor};
