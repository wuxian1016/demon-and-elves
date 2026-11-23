'use strict';
// Scope only the human's automatic foot gathering; never constrain manual or build motion.
const region=require('./camp-hint-region');
const reentry=require('./player-gather-reentry');
function enabled(g,win){return !g.networkAuthorityPhases627&&win.networkDefenseModeBN?.()!==true&&win.batSoloPolicyBN?.allows?.(g)===true;}
function at(g,x,y){const info=region.campAt(g,x,y);return info&&(!region.inOutsideRoad(g,info.zone,x,y)||region.contains(g,x,y))?info.camp:-1;}
function inside(g,lane,x,y){const z=g.resourceZones?.[lane];return !!z&&((x-z.x)**2+(y-z.y)**2)<=(z.radius||1120)**2&&at(g,x,y)===lane;}
function usable(g,t,item){return !!item&&!item.dead&&!item.isGuard&&item[t.type]>0&&inside(g,t.gatherCampBN,item.x,item.y)&&(t.type!=='gold'||(item.x-t.originX)**2+(item.y-t.originY)**2<=t.localRadius**2);}
function nearest(g,t){const p=g.player,list=t.type==='wood'?g.trees:g.goldMines;let best=null,range=Infinity;for(const item of list){if(!usable(g,t,item))continue;const d=(item.x-p.x)**2+(item.y-p.y)**2;if(d<range){range=d;best=item;}}return best;}
function home(g,t){const p=g.player;let best=null,range=Infinity;for(const b of g.buildings){if(b.dead||b.type!=='house'||b.ownerSlot!=null||!inside(g,t.gatherCampBN,b.x,b.y))continue;const d=(b.x-p.x)**2+(b.y-p.y)**2;if(d<range){range=d;best=b;}}return best;}
function make(g,type){const p=g.player,lane=at(g,p.x,p.y);return {type,zoneIndex:lane,gatherCampBN:lane,originX:p.x,originY:p.y,localRadius:1200,phase:'goto',target:null};}
function stop(g,message){const p=g.player;p.task=null;p.moveTarget=null;p.setMoveIntent(0,0);g.clearUnitNavigation(p);if(message)g.showToast(message);}
function start(g,type){const p=g.player,t=make(g,type);if(p.drivingTank)return false;if(t.gatherCampBN<0){g.showToast('请先回到据点内再自动采集');return false;}const target=nearest(g,t);if(!target){g.showToast(type==='wood'?'据点内暂无可采树木':'据点内暂无可采金矿');return false;}p.takeOverManual();g.clearUnitNavigation(p);p.collectTimer=0;p.task=t;t.target=target;return true;}
function wait(g,t){const p=g.player;t.target={x:p.x,y:p.y,radius:24,resourceWait401:true};t.phase='wait';t.retryAt401=(g.supportTime||0)+700;p.setMoveIntent(0,0);}
function prepare(g,t){const p=g.player,lane=at(g,p.x,p.y);if(lane<0)return false;if(!Number.isInteger(t.gatherCampBN)){t.gatherCampBN=t.zoneIndex=lane;t.originX=p.x;t.originY=p.y;t.localRadius=1200;}return t.gatherCampBN===lane;}
function tick(g,t,dt){const p=g.player;if(p.drivingTank){stop(g);return;}if(reentry.has(t)){
 const status=reentry.advance(g,t,dt,inside);if(status==='moving')return;
 if(status==='blocked'){stop(g,'无法安全返回原采集据点，请手动返回');return;}
 }if(!prepare(g,t)){stop(g);return;}const wood=t.type==='wood',carry=wood?p.carryWood:p.carryGold,capacity=wood?p.maxCarryWood:p.maxCarryGold,full=wood?p.wood>=p.maxWood:p.gold>=p.maxGold;
 if(carry>=capacity||(full&&carry))t.phase='return';
 if(full&&!carry){stop(g,'采集任务完成');return;}
 if(t.phase==='return'){
  const base=home(g,t);if(!base){stop(g,'当前据点没有自己的基地可交回资源');return;}
  if(p.moveToward(base,p.speed,t.gatherCampBN)){g.depositToHouse(base);if(t.returnOnlyAfterBuildBN){stop(g);return;}const room=wood?p.carryWood===0&&p.wood<p.maxWood:p.carryGold===0&&p.gold<p.maxGold;if(room)t.phase='goto';else stop(g,'采集任务完成');}
  return;
 }
 if(t.phase==='wait'){p.setMoveIntent(0,0);if((t.retryAt401||0)>(g.supportTime||0))return;}
 if(t.phase==='wait'||!usable(g,t,t.target)){const next=nearest(g,t);if(next){t.target=next;t.phase='goto';}else if(p.carryWood||p.carryGold)t.phase='return';else if(wood)wait(g,t);else stop(g,'据点内金矿已采尽');return;}
 if(t.phase==='goto'){if(p.moveToward(t.target,p.speed,t.gatherCampBN)){t.phase='collect';p.collectTimer=0;}return;}
 if(t.phase==='collect'){const target=t.target;if(Math.hypot(p.x-target.x,p.y-target.y)>p.radius+target.radius+14){t.phase='goto';return;}p.collectTimer+=dt*(g.cardsCandidate?.mods(p).harvest||1);if(p.collectTimer>=p.collectInterval){p.collectTimer=0;const got=wood?g.doCollectWood(target):g.doCollectGold(target);if(got<=0)t.phase='return';}}
}
function resume(g,t,afterBuild=false){
 const local=prepare(g,t),route=!local&&afterBuild?reentry.route(g,t,inside):null;
 if(!local&&!route)return null;
 const p=g.player,same=usable(g,t,t.target)?t.target:nearest(g,t);
 if(same)return {target:same,route};
 if(p.carryWood||p.carryGold){const base=home(g,t);return base?{target:base,phase:'return',returnOnly:true,route}:null;}
 if(t.type!=='wood')return null;
 const start=route?.points[0].q||p;
 return {target:{x:start.x,y:start.y,radius:24,resourceWait401:true},phase:'wait',route};
}
module.exports={enabled,inside,start,tick,resume,attachReentry:reentry.attach,reentering:reentry.has};
