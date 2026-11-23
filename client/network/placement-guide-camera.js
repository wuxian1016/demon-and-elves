'use strict';
// Local presentation only: no simulation speed, authority anchor or zoom change.
function install(g,{viewport,active=()=>true,input=()=>null,clock=()=>Date.now(),duration=720,prime=()=>{},advisory=null}={}){
 if(g.placementGuideCameraAX)return g.placementGuideCameraAX;
 const camp=()=>require('./placement-current-camp').index(g);
 const original={start:g.startPlacement,update:g.updateCamera,cancel:g.cancelPlacement,frame:g.drawFrame398};let generation=null,generationCamp=null,seenByCamp=new Map(),seen=new Set(),motion=null,lastMotion=null,pending=null,baselinePan={x:0,y:0};
 const stop=(reason='interrupted')=>{pending=null;if(motion)motion.doneReason=reason;motion=null;};
 const syncCamp=()=>{const q=motion||pending;if(q&&q.camp!==camp()){stop('camp-changed');if(g.placement)g.placement.cameraOrigin={...g.camera};g.placementSitesAC?.clear();g.placementRecommendationCacheAZ?.clear();g.guideCache621=null;}};
 const originalInput=()=>typeof input==='function'?input():input;
 const interrupted=()=>{const i=originalInput();return!!(i?.panning||i?.minimapPeek||i?.stick?.active||i?.pinch?.active||g.cameraPeek||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.allyDataPanel||g.buildMenu||g.selectedBuilding||g.demonAttackFocus545||g.firstAttackCameraFocus||Math.abs((g.cameraPan?.x||0)-baselinePan.x)+Math.abs((g.cameraPan?.y||0)-baselinePan.y)>1e-6);};
 const begin=function(p,group,rows){
  const v=viewport(),z=this.zoom(),mm=this.getMinimapRect?.(),hud=this.topHudLayout?.(),buttons=this.getPlacementButtons?.()||[],top=Math.min(v.height*.55,Math.max((hud?.bottom||0)+50,mm?mm.y+mm.h+20:0)),bottom=Math.max(top+60,Math.min(v.height-70,...buttons.map(b=>b.y-28))),cx=(Math.min(...rows.map(s=>s.x))+Math.max(...rows.map(s=>s.x)))/2,cy=(Math.min(...rows.map(s=>s.y))+Math.max(...rows.map(s=>s.y)))/2;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),target={x:clamp(cx-v.width/2/z,0,Math.max(0,10000-v.width/z)),y:clamp(cy-(top+bottom)/2/z,0,Math.max(0,8000-v.height/z))};seen.add(group);const from={...this.camera};this.placement.cameraOrigin={...from};if(this.cameraPan)this.cameraPan.x=this.cameraPan.y=0;baselinePan={x:0,y:0};if(!group.startsWith('resource:'))prime(from,target);motion={camp:camp(),placement:p,createdAt:clock(),start:typeof original.frame==='function'?null:clock(),warmupMs:0,from,target,group,steps:0,intermediateSteps:0,lastElapsed:null,lastPosition:{...this.camera}};lastMotion=motion;
 };
 const resolvePending=()=>{syncCamp();const q=pending;if(!q)return;if(camp()!==q.camp||g.placement!==q.p||q.p.stage!=='aim'||!active()||interrupted()){stop();return;}const rows=advisory.rows(q.p.type);if(rows===null)return;pending=null;if(rows.length)begin.call(g,q.p,q.group,rows);};
 g.startPlacement=function(...args){stop('new-placement');original.start.apply(this,args);baselinePan={x:this.cameraPan?.x||0,y:this.cameraPan?.y||0};const p=this.placement;if(camp()<0)return;if(!p||!active()||this.tutorial||!['prep','hunt'].includes(this.state))return;
  if(generation!==this.troll){generation=this.troll;generationCamp=null;seenByCamp=new Map();}
  if(generationCamp!==camp()){generationCamp=camp();if(!seenByCamp.has(generationCamp))seenByCamp.set(generationCamp,new Set());seen=seenByCamp.get(generationCamp);motion=null;lastMotion=null;}
  const resource=advisory?.accepts(p.type),group=resource?'resource:'+p.type:p.type==='wall'?'wall':this.isDefenseGuideTowerType(p.type)?'tower':null;if(!group||seen.has(group))return;
  if(resource){if(!advisory.prepare(p.type))return;pending={p,group,camp:camp()};resolvePending();return;}
  const rows=this.defenseRecommendationSpots().filter(s=>s.type===group&&!s.built&&s.valid!==false);if(!rows.length)return;
  if(this.ownerBuildings().some(b=>!b.dead&&(group==='wall'?b.type==='wall':this.isDefenseGuideTowerType(b.type)))){seen.add(group);return;}begin.call(this,p,group,rows);
 };
 g.updateCamera=function(...args){syncCamp();if(pending&&typeof original.frame!=='function')resolvePending();const m=motion;if(m&&(camp()!==m.camp||!active()||this.placement!==m.placement||this.placement.stage!=='aim'||interrupted()))stop();const result=original.update.apply(this,args);if(!motion||m.start===null)return result;const t=Math.max(0,Math.min(1,(clock()-m.start)/duration)),k=t*t*(3-2*t),x=m.from.x+(m.target.x-m.from.x)*k,y=m.from.y+(m.target.y-m.from.y)*k;this.camera.x=x;this.camera.y=y;this.placement.cameraOrigin={x,y};if(this.cameraFollow){this.cameraFollow.x=x;this.cameraFollow.y=y;}const elapsed=Math.max(0,Math.min(duration,clock()-m.start));if(m.lastElapsed!==elapsed){m.steps++;if(t>0&&t<1)m.intermediateSteps++;m.lastElapsed=elapsed;m.lastPosition={x,y};}if(t===1)stop('completed');return result;};
 g.cancelPlacement=function(...args){stop();return original.cancel.apply(this,args);};
 // Interpolated online/native frames skip the engine's fixed-update camera
 // call. Advance this local UI animation on those render frames as well.
 if(typeof original.frame==='function')g.drawFrame398=function(interpolated,...args){syncCamp();resolvePending();if(motion&&(camp()!==motion.camp||!active()||this.placement!==motion.placement||this.placement.stage!=='aim'||interrupted()))stop();const m=motion;if(m&&m.start===null){const result=original.frame.call(this,interpolated,...args);if(motion===m){m.start=clock();m.warmupMs=m.start-m.createdAt;}return result;}if(interpolated&&motion)this.updateCamera();return original.frame.call(this,interpolated,...args);};
 const api={cancel:stop,original,report:()=>({moving:!!motion,pending:!!pending,group:motion?.group||null,seen:[...seen],last:lastMotion?{group:lastMotion.group,warmupMs:lastMotion.warmupMs,steps:lastMotion.steps,intermediateSteps:lastMotion.intermediateSteps,elapsed:lastMotion.lastElapsed,doneReason:lastMotion.doneReason||null,from:{...lastMotion.from},target:{...lastMotion.target},position:{...lastMotion.lastPosition}}:null})};Object.defineProperty(g,'placementGuideCameraAX',{value:api,configurable:true});return api;
}
module.exports={install};
