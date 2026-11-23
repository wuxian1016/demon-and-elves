'use strict';
const grid=require('./ordinary-building-grid');
const {campAt}=require('./camp-hint-region');
function enabled(g,win){return !!g&&!g.tutorial&&!g.superChallenge580&&!g.networkAuthorityPhases627&&!g.networkDrawCamera627&&win.networkDefenseModeBN?.()!==true;}
function index(g,x,y){return campAt(g,x,y)?.camp??-1;}
function lateHome(g,zone,slot,radius,Building){
 const api=g.ordinaryBuildingGridAD;if(!api)return null;
 const camp=g.resourceZones.indexOf(zone),step=grid.UNIT,anchor=api.nearest(zone.x,zone.y,'house');
 for(let r=0;r<=7;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
  if(r&&Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
  const x=anchor.x+dx*step,y=anchor.y+dy*step;
  if(Math.hypot(x-zone.x,y-zone.y)>720||grid.zoneAt(g,x,y)!==zone||index(g,x,y)!==camp||g.plots.ownerAt(x,y)||!g.canPlaceBuilding(x,y,radius,'house'))continue;
  const p=g.plots.takeOver(x,y,'building');
  const home=new Building(x,y,'house');home.ownerSlot=slot;g.plots.setRef(p.key,home);return home;
 }
 return null;
}
function reserved(g,ally,camp){
 if(camp===g.playerStartZoneIndex||!g.resourceZones[camp])return true;
 if(g.allies.some(a=>a!==ally&&!a.dead&&!a.defected&&a.homeZoneIndex===camp))return true;
 const out=new Set();addReservations(g,ally,out);return out.has(camp);
}
function addReservations(g,ally,out){
 for(const a of g.allies)if(a!==ally&&!a.dead&&!a.defected&&a.evacuateTarget&&a.evacuateZoneIndex>=0)out.add(a.evacuateZoneIndex);
 for(const b of g.buildings)if(!b.dead&&b.type==='house'&&(b.ownerSlot??null)!==ally.slot){const lane=index(g,b.x,b.y);if(lane>=0)out.add(lane);}
}
function allowNewHome(g,ally,point,existingHome){
 const camp=ally.homeZoneIndex;if(index(g,point.x,point.y)!==camp)return false;
 return existingHome||!reserved(g,ally,camp);
}
module.exports={enabled,index,lateHome,reserved,addReservations,allowNewHome};
