'use strict';
// Keep native AI strategy, funds, travel and final legality checks. Only its
// proposed coordinates follow the same103-grid/recommendation anchors as UI.
function installAiGridPlanning(g,{active=()=>true}={}){
 if(g.aiGridPlanningAZ)return g.aiGridPlanningAZ;
 const original={},counts={centres:0,plans:0,commits:0,recommendedWallPairs:0,recommendedGuns:0};
 const enabled=()=>active()&&!g.tutorial&&!!g.ordinaryBuildingGridAD;
 const point=(p,type)=>p&&enabled()&&g.ordinaryBuildingGridAD.inFixedArea(p.x,p.y)?g.ordinaryBuildingGridAD.nearest(p.x,p.y,type):p;
 const run=(type,fn)=>{if(!enabled()||!type||!g.plots?.centerOfKey)return fn();const plots=g.plots,center=plots.centerOfKey;plots.centerOfKey=function(...args){const p=center.apply(this,args),q=point(p,type);if(p!==q)counts.centres++;return q;};try{return fn();}finally{plots.centerOfKey=center;}};
 // The reviewed103-grid puts a tower centre up to~53 units sideways from
 // its100-pitch wall; the old45-unit lane rejected those actual legal pairs.
 if(typeof g.allyWallProtectsTower==='function'){const method=original.allyWallProtectsTower=g.allyWallProtectsTower;g.allyWallProtectsTower=function(ally,wall,tower){if(method.call(this,ally,wall,tower))return true;if(!enabled()||!wall||wall.dead||wall.ownerSlot!==ally.slot||!tower||tower.dead)return false;const grid=this.ordinaryBuildingGridAD,zone=this.resourceZones[ally.homeZoneIndex]||ally.homeZone;if(!zone)return false;const guide=this.defenseRecommendationLayout(zone);if(!grid.aligned(wall.x,wall.y,'wall')&&!guide.some(p=>p.type==='wall'&&Math.hypot(p.x-wall.x,p.y-wall.y)<1))return false;if(!grid.aligned(tower.x,tower.y,'tower')&&!guide.some(p=>p.type==='tower'&&Math.hypot(p.x-tower.x,p.y-tower.y)<1))return false;const angle=zone.gateAngle??Math.atan2((this.trollBase?.y||4000)-zone.y,(this.trollBase?.x||5000)-zone.x),horizontal=Math.abs(Math.sin(angle))>=Math.abs(Math.cos(angle)),ux=horizontal?0:Math.sign(Math.cos(angle)),uy=horizontal?Math.sign(Math.sin(angle)):0,dx=wall.x-tower.x,dy=wall.y-tower.y,forward=dx*ux+dy*uy,side=Math.abs(horizontal?dx:dy),complete=this.defenseRecommendationLayout(zone).filter(p=>p.type==='wall').every(p=>this.allyBuildings(ally,'wall').some(w=>!w.dead&&Math.hypot(w.x-p.x,w.y-p.y)<1));if(complete)return Math.hypot(dx,dy)<=945&&forward>=31.5&&side<=364.5;return Math.hypot(dx,dy)<=(ally.developmentProfile==='fortress'?585:207)&&forward>=31.5&&side<=(ally.developmentProfile==='fortress'?94.5:66.95);};}
 for(const [name,type]of [['allyTowerSlotsBehindWall','tower'],['allyTowerProtectionSpots','wall'],['defenseNeighborSpots',null]])if(typeof g[name]==='function'){const method=original[name]=g[name];g[name]=function(...args){return method.apply(this,args).map(p=>point(p,type||args[1]));};}
 // The original wall/tower search may miss usable public pairs and find no gun
 // behind its raw old-grid rows. Fall back to actual public recommended pairs;
 // never invent cells, move resources, build remotely or bypass native funding.
 if(typeof g.planAllyDefenseBuildSteps==='function'){
  const nativeDefense=original.migrationDefenseSteps=g.planAllyDefenseBuildSteps;
  g.planAllyDefenseBuildSteps=function*(ally,entry,...args){
   const plan=yield* nativeDefense.call(this,ally,entry,...args);
   if(plan||!enabled()||!ally||!['wall','tower','iceTower','manaTower','cannonTower'].includes(entry?.type))return plan;
   const home=this.allyHome(ally),zone=this.resourceZones?.[ally.homeZoneIndex];
   if(!home||!zone)return null;
   const layout=this.defenseRecommendationLayout(zone),walls=layout.filter(p=>p.type==='wall'),towers=layout.filter(p=>p.type==='tower');
   if(entry.type!=='wall'){
    const ownedWalls=this.allyBuildings(ally,'wall').filter(w=>!w.dead&&w.hp>0);
    for(const p of towers){yield;
     const gun={...p,type:entry.type,ownerSlot:ally.slot};
     if(this.isAllyWalkPointDeferred(ally,p)||this.allySpotAlreadyPlanned(ally,p)||!this.allyWorkPointSafe(ally,p)||!ownedWalls.some(w=>this.allyWallProtectsTower(ally,w,gun))||!this.canPlaceBuilding(p.x,p.y,entry.type==='cannonTower'?32:30,entry.type))continue;
     counts.recommendedGuns++;return{type:'build',buildType:entry.type,spot:{x:p.x,y:p.y}};
    }
    return null;
   }
   for(const p of walls){yield;
    if(this.isAllyWalkPointDeferred(ally,p)||this.allySpotAlreadyPlanned(ally,p)||!this.allyWorkPointSafe(ally,p)||!this.canPlaceBuilding(p.x,p.y,28,'wall'))continue;
    const wall={...p,type:'wall',ownerSlot:ally.slot};
    for(const t of towers){yield;
     const gun={...t,type:'cannonTower',ownerSlot:ally.slot};
     if(this.isAllyWalkPointDeferred(ally,t)||this.allySpotAlreadyPlanned(ally,t)||!this.allyWorkPointSafe(ally,t)||!this.allyWallProtectsTower(ally,wall,gun)||!this.canPlaceBuilding(t.x,t.y,32,'cannonTower'))continue;
     counts.recommendedWallPairs++;return{type:'build',buildType:'wall',spot:{x:p.x,y:p.y}};
    }
   }
   return null;
  };
 }
 for(const name of ['planAllyBuildSteps','planAllyDefenseBuildSteps','allyDefenseSpotSteps','allyCompactDefenseSpotSteps','planAllyOutpostMineSteps'])if(typeof g[name]==='function'){const method=original[name]=g[name];g[name]=function(...args){const it=method.apply(this,args),type=name==='planAllyOutpostMineSteps'?'goldMine':typeof args[1]==='string'?args[1]:args[1]?.type;const step=kind=>value=>run(type,()=>{const result=it[kind](value),p=result.value;if(result.done&&p?.type==='build'&&p.spot&&enabled()&&g.ordinaryBuildingGridAD.aligned(p.spot.x,p.spot.y,p.buildType)){result.value={...p,fixedGridAZ:true};counts.plans++;}return result;});return{next:step('next'),return:step('return'),throw:step('throw'),[Symbol.iterator](){return this;}};};}
 if(typeof g.finishAllyBuild==='function'){const method=original.finishAllyBuild=g.finishAllyBuild;g.finishAllyBuild=function(ally,task){if(!enabled()||!task?.fixedGridAZ)return method.call(this,ally,task);return run(task.buildType,()=>{const ok=method.call(this,ally,task);if(ok)counts.commits++;return ok;});};}
 return Object.defineProperty(g,'aiGridPlanningAZ',{value:{original,stats:()=>({...counts})},configurable:true}).aiGridPlanningAZ;
}
module.exports={installAiGridPlanning};
