'use strict';
const grid=require('./ordinary-building-grid');
// User-reviewed layout: translate the original three-wall row outward only;
// retain its100-unit side pitch. Towers use the next inner lattice row and103
// side pitch. Original generation and all existing building anchors stay intact.
function install(g){
 if(g.defenseRecommendationGridAW)return g.defenseRecommendationGridAW;
 const original=g.defenseRecommendationLayout;if(typeof original!=='function')return null;const cache=new WeakMap();
 g.defenseRecommendationLayout=function(zone){
  if(!zone||this.resourceSpacingGeneratingAD||this.tutorial)return original.call(this,zone);
  const key=[zone.x,zone.y,zone.gateX,zone.gateY,zone.gridOriginXAQ,zone.gridOriginYAQ],cached=cache.get(zone);
  if(Number.isFinite(key[4]+key[5])&&cached&&key.every((v,i)=>v===cached.key[i]))return cached.rows.map(p=>({...p}));
  const rows=original.call(this,zone);if(rows.length!==6)return rows;
  const dx=zone.x-zone.gateX,dy=zone.y-zone.gateY,ix=Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,iy=ix?0:Math.sign(dy),sx=-iy,sy=ix,middle=rows.find(p=>p.type==='wall'&&p.number===2),q=grid.cell(this,'wall',middle.x,middle.y),wall=ix?{x:q.x,y:middle.y}:{x:middle.x,y:q.y+this.ordinaryBuildingGridAD.anchorOffset('wall')};
  if((wall.x-middle.x)*ix+(wall.y-middle.y)*iy>1e-7){wall.x-=ix*grid.UNIT;wall.y-=iy*grid.UNIT;}
  const oldTower=rows.find(p=>p.type==='tower'&&p.number===2),tq=grid.cell(this,'tower',oldTower.x,oldTower.y);
  // At an exact half-cell tie, keep the lower side column deterministically.
  if(iy&&Math.abs(tq.x-oldTower.x-grid.UNIT/2)<1e-8)tq.x-=grid.UNIT;
  const tower=ix?{x:wall.x+ix*grid.UNIT,y:tq.y+this.ordinaryBuildingGridAD.anchorOffset('tower')}:{x:tq.x,y:wall.y+iy*grid.UNIT-5};
  const aligned=rows.map(p=>p.type==='wall'?{...p,x:wall.x+sx*(p.number-2)*100,y:wall.y+sy*(p.number-2)*100}:{...p,x:tower.x+sx*(p.number-2)*grid.UNIT,y:tower.y+sy*(p.number-2)*grid.UNIT});
  // The reviewed hook-shaped guide adds the upper two cells and lower
  // extension to the original three-tower column. These remain optional:
  // actual terrain/resources decide which projections can be shown/built.
  const first=aligned.find(p=>p.type==='tower'&&p.number===1),last=aligned.find(p=>p.type==='tower'&&p.number===3);
  for(const [number,x,y]of [[4,first.x-sx*grid.UNIT-ix*grid.UNIT,first.y-sy*grid.UNIT-iy*grid.UNIT],[5,first.x-sx*grid.UNIT,first.y-sy*grid.UNIT],[6,last.x+sx*grid.UNIT,last.y+sy*grid.UNIT],[7,last.x+sx*grid.UNIT*2,last.y+sy*grid.UNIT*2]])aligned.push({type:'tower',number,x,y,optionalGuide:true});
  if(Number.isFinite(zone.gridOriginXAQ+zone.gridOriginYAQ))cache.set(zone,{key:[zone.x,zone.y,zone.gateX,zone.gateY,zone.gridOriginXAQ,zone.gridOriginYAQ],rows:aligned.map(p=>Object.freeze({...p}))});
  return aligned;
 };
 g.guideCache621=null;const api={original};Object.defineProperty(g,'defenseRecommendationGridAW',{value:api,configurable:true});return api;
}
module.exports={install};
