'use strict';
// Manual vehicle displacement is atomic and terrain-clipped. It never chooses
// a tangent/route around an obstacle; pressing into a tree keeps position.
function manualVehicleStep(entity,vx,vy,probe){
 if(!Number.isFinite(vx)||!Number.isFinite(vy)||!(vx||vy))return false;
 const point=probe(entity,vx,vy);entity.terrainClearDistance411=0;
 if(!point)return false;
 const moved=point.x!==entity.x||point.y!==entity.y;
 entity.x=point.x;entity.y=point.y;entity.terrainEscape=null;
 return moved;
}
module.exports={manualVehicleStep};
