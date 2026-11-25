'use strict';
const byGame=new WeakMap();
const d2=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
function target(g,p,api,{z,o,S,top,bottom,m},reach,bonus,attackTypes){
 const index=g.buildRecommendationZoneIndexBN?.()??g.playerStartZoneIndex,zone=g.resourceZones?.[index];
 if(!zone)return null;
 const n=g.supportTime||0,old=byGame.get(g),rev=g.groundObstacleRevision,auraRev=g.watchtowerAuraRevision;
 const project=b=>{
  const x=((b.cx??b.x)-o.x)*z,y=((b.cy??b.y)-o.y)*z;
  return x>=S.x+18&&x<=S.right-18&&y>=top&&y<=bottom&&
   !(x>=m.x-18&&x<=m.x+m.w+18&&y<=m.y+m.h+32)?{x,y,watchCell:{x0:(b.x0-o.x)*z,y0:(b.y0-o.y)*z,x1:(b.x1-o.x)*z,y1:(b.y1-o.y)*z,w:(b.x1-b.x0)*z,h:(b.y1-b.y0)*z,cx:x,cy:y}}:null;
 };
 if(old?.p===p&&old.zone===zone&&old.rev===rev&&old.auraRev===auraRev&&old.z===z&&old.top===top&&n>=old.n&&n-old.n<(old.site?200:70)){
  if(!old.site)return null;
  const projected=project(old.site);if(projected)return projected;
 }
 const gate={x:zone.gateX,y:zone.gateY},radius=zone.radius||1120,r2=reach*reach;
 const nearby=g.indexedOwnerBuildings(null).filter(b=>attackTypes.has(b.type)&&!b.airDefenseKindBN&&g.completedElfBuildingBN(b)&&d2(b,zone)<=radius*radius);
 const towers=nearby.map(b=>({b,gain:Math.max(0,bonus-g.watchtowerAuraFor(b))}));
 let best=null,gain=-1,count=-1,dist=Infinity;
 for(const b of api.sites()){
  if(b.type!=='watchtower'||b.recommended||b.built||b.valid===false||!project(b)||g.ordinaryBuildingGridAD?.hintCampAt(b.x,b.y)!==index)continue;
  let coverage=0,added=0,placementDist=0;
  for(const t of towers){
   const d=d2(t.b,b);
   if(d<=r2){coverage++;added+=t.gain;}
   placementDist+=d;
  }
  // Prefer more newly strengthened front towers. When every legal tile
  // covers the same targets, anchor near the group, then toward the gate.
  const merit=(towers.length?placementDist/towers.length:0)+.22*d2(gate,b);
  if(added<gain||added===gain&&(coverage<count||coverage===count&&merit>=dist))continue;
  if(g.buildQueuePlacementReasonBN?.(p.type,b.x,b.y)||!g.canPlaceBuilding(b.x,b.y,p.radius,p.type))continue;
  best=b;gain=added;count=coverage;dist=merit;
 }
 byGame.set(g,{p,zone,rev,auraRev,z,top,n,site:best});
 return best&&project(best);
}
module.exports={target};
