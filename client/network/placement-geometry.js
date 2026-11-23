'use strict';
const data=require('./placement-geometry-data'),core=require('./placement-site-core'),normal=require('./ordinary-building-grid');
function installPlacementGeometry(g){if(g.placementGeometryAC)return g.placementGeometryAC;const ground=g.defensePlacementSize,visual=g.placementVisual621;
 const house=data.types.house,baseRadius=house.radii?.[2]??house.radius,groundSize=type=>{const d=data.types[type];return d?.defense?(type==='wall'?d.defense:{w:80,h:80}):null;};
 // Gameplay/combat radii and native recommendation anchors stay unchanged.
 // All slot boundaries share the camp lattice; a base reserves its actual maximum level3
 // native-art envelope; unreachable level13 artwork does not reserve land.
 g.placementRadiusAC=(type,radius)=>g.resourceSpacingGeneratingAD?radius:type==='house'?baseRadius:normal.ordinary(type)?Math.min(radius,48):radius;
 g.defensePlacementSize=function(type){if(this.resourceSpacingGeneratingAD)return ground.call(this,type);const d=data.types[type];return d?groundSize(type):ground.call(this,type);};
 g.placementVisual621=function(type,radius,level,visualLevel=level){if(this.resourceSpacingGeneratingAD)return visual.call(this,type,radius,level,visualLevel);const d=data.types[type];if(!d)return visual.call(this,type,radius,level,visualLevel);if(type==='house')return {w:normal.BASE_SIZE,h:normal.BASE_SIZE};const footprint=normal.footprint(type,0,0,this);if(footprint)return {w:footprint.w,h:footprint.h};const row=data.matchVisual(d,radius,Math.min(13,Math.max(1,visualLevel||1)));return groundSize(type)||row||visual.call(this,type,radius,level,visualLevel);};
 normal.install(g);
 let pairQuery=null,pairBuildings=new WeakMap(),pairZones=null,pairTroll=null,pairTutorial=null;
 const site=(type,x,y,level=1)=>{if(type==='antiAirTowerBN'||type==='netTowerBN')type='tower';const d=data.types[type];if(!d)throw Error('UNKNOWN_PLACEMENT_TYPE');const art=data.visualShape(d,Math.min(13,Math.max(1,Math.floor(level)))-1),fixed=normal.footprint(type,x,y,g),size=fixed||groundSize(type)||art,bottom=fixed?fixed.bottom:d.defense?0:26,raw=core.site(type,x,y,size.w,size.h,bottom),reservation=fixed?{...raw,...fixed,cx:(fixed.x0+fixed.x1)/2,cy:(fixed.y0+fixed.y1)/2}:raw,k=normal.ordinary(type)?Math.min(1,90/Math.max(art.visibleW??art.w,art.visibleH??art.h)):1,artBounds=core.site(type,x,y,(art.visibleW??art.w)*k,(art.visibleH??art.h)*k,26),cells=fixed?.cells?.map(c=>({...core.site(type,(c.x0+c.x1)/2,c.y1,c.w,c.h),...c}));return {...reservation,reservation,artBounds,...(cells?{cells,columns:fixed.columns,rows:fixed.rows}:{} )};};
 Object.defineProperty(g,'placementBlockPairAD',{enumerable:false,configurable:true,writable:true,value:function(type,x,y,b){if(this.resourceSpacingGeneratingAD||!data.types[type]||!data.types[b.type]||!normal.gridded(type)&&!normal.gridded(b.type))return undefined;
 // Conservative broad phase for known native footprints. Their envelopes
 // extend at most320 units from each anchor (including legacy off-grid
 // rounding). Distant camps cannot collide; avoid constructing both full
 // grid envelopes for every unrelated building and every hint cell.
 if(Math.abs(x-b.x)>640||Math.abs(y-b.y)>640)return null;
 // Reuse identical envelopes inside the synchronous native collision pass.
 // Weak building keys do not keep removed buildings alive. Scene/tutorial,
 // position, type and level changes invalidate their exact bounds.
 if(pairZones!==this.resourceZones||pairTroll!==this.troll||pairTutorial!==this.tutorial){pairZones=this.resourceZones;pairTroll=this.troll;pairTutorial=this.tutorial;pairQuery=null;pairBuildings=new WeakMap();}
 if(!pairQuery||pairQuery.type!==type||pairQuery.x!==x||pairQuery.y!==y)pairQuery={type,x,y,box:site(type,x,y).reservation};
 let prior=pairBuildings.get(b);if(!prior||prior.x!==b.x||prior.y!==b.y||prior.type!==b.type||prior.level!==b.level){prior={x:b.x,y:b.y,type:b.type,level:b.level,box:site(b.type,b.x,b.y,b.level||1).reservation};pairBuildings.set(b,prior);}
 const overlap=core.overlap(pairQuery.box,prior.box);if(overlap)return '建筑占地格已经被占用';if(data.types[type].defense&&data.types[b.type].defense)return undefined;return null;}});
 return g.placementGeometryAC={site,data,originalGround:ground,originalVisual:visual};
}
module.exports={installPlacementGeometry};
