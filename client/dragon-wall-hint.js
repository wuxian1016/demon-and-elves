'use strict';
// Read-only advice: never changes the dragon, navigation, resources or building lists.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function allowed(g,offline){return offline()&&g.operationGuideModeR13?.()!==false&&g.state==='hunt'&&!g.player?.dead&&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.shareRewardPending&&!g.buildMenu&&!g.relicPanel&&!g.demonPanel&&!g.roundLoading591&&!g.roundStarting&&!g.tutorial&&!g.superChallenge580&&!g.ceremony&&g.troll?.dragonEvolved&&!g.troll.dead&&g.troll.hp>0&&g.trollBase&&!g.trollBase.dead;}
function eligible(g,offline){return allowed(g,offline)&&g.troll.hp<g.troll.maxHp*.5;}
function route(g){const t=g.troll;if(!t.retreating||t.navGoalId!==g.trollBase)return[];const c=g.navMotionCaches?.get(t);if(['pending','failed'].includes(c?.mode)||t.unstuckTarget)return[];const path=(t.navPath||[]).slice(t.navPathIndex||0).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(path.length)return[{x:t.x,y:t.y},...path];if(c?.wp)return[{x:t.x,y:t.y},c.wp];if(g.demonLineBlocked?.(t,g.trollBase,t.radius)===false)return[{x:t.x,y:t.y},g.trollBase];return[];}
function selectSpot(g,radius,visible,path=route(g)){let travel=0;for(let i=1;i<path.length&&travel<720;i++){const a=path[i-1],b=path[i],len=distance(a,b);if(!len)continue;for(let d=Math.max(0,160-travel);d<=len&&travel+d<=720;d+=48){const q={x:a.x+(b.x-a.x)*d/len,y:a.y+(b.y-a.y)*d/len};const p=g.compactDefenseSnapSpot?.(q.x,q.y,radius,'wall')||q;if(distance(p,q)>radius*.75||distance(p,g.troll)<160||!visible(p))continue;if(g.canPlaceBuilding(p.x,p.y,radius,'wall')&&!g.findUpgradeTargetAt('wall',p.x,p.y))return{x:p.x,y:p.y};}travel+=len;}return null;}
function layout(g,env,spot,previous){
 const v=env.runtime.viewport(),S=g.uiSafeRect396?.()||{x:0,y:0,w:v.width,bottom:v.height},top=g.topHudLayout?.().bottom||70,mm=g.getMinimapRect?.(),menu=g.sessionMenuRect?.(),h=38,w=Math.min(330,S.w-24),z=g.zoom();
 const obstacles=[{x:S.x,y:S.y||0,w:S.w,h:top-(S.y||0)+8},mm,menu,...(g.buttons||[]).filter(b=>b.visible!==false&&(!b.scene||b.scene.includes(g.state)))].filter(Boolean);
 const joy=g.getJoystickRect?.();if(joy)obstacles.push({x:joy.x-joy.r-12,y:joy.y-joy.r-12,w:joy.r*2+24,h:joy.r*2+24});
 for(const e of [g.troll,g.player,...(g.tanks||[]),...(g.hounds||[])]){if(!e||e.dead)continue;const r=e===g.troll?90:42;obstacles.push({x:(e.x-g.camera.x)*z-r,y:(e.y-g.camera.y)*z-r*1.4,w:r*2,h:r*2.2});}
 if(spot)obstacles.push({x:(spot.x-g.camera.x)*z-44,y:(spot.y-g.camera.y)*z-65,w:88,h:85});
 if(mm){const rw=Math.min(v.width>v.height?390:330,S.w-24),ry=v.width>v.height?top+44:Math.min((g.buttonAreaTop||v.height-120)-56,mm.y+mm.h+44);obstacles.push({x:S.x+(S.w-rw)/2,y:ry,w:rw,h:48});}
 const overlaps=(a,b)=>a.x<b.x+b.w+8&&b.x<a.x+a.w+8&&a.y<b.y+b.h+8&&b.y<a.y+a.h+8;
 const good=r=>r&&r.x>=S.x+8&&r.x+r.w<=S.x+S.w-8&&r.y>=top+10&&r.y+r.h<=S.bottom-12&&!obstacles.some(o=>overlaps(r,o));
 if(good(previous))return previous;
 const x=S.x+(S.w-w)/2,preferred=Math.min(v.height*.63,(g.buttonAreaTop||S.bottom-100)-h-14),rows=[];for(let y=top+12;y<=S.bottom-h-12;y+=16)rows.push(y);rows.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));
 for(const y of rows)for(const px of[x,S.x+10,S.x+S.w-w-10]){const r={x:px,y,w,h};if(good(r))return r;}return null;
}
function createPredictor(g){let work=null,origin=null,path=[],terrain=null;return {step(){
 const t=g.troll,base=g.trollBase;if(!t||!base)return[];
 const actual=route(g);if(actual.length)return actual;
 if(g.demonLineBlocked?.(t,base,t.radius)===false)return[{x:t.x,y:t.y},{x:base.x,y:base.y}];
 const stamp=g.terrainClearEpoch411;
 if(!origin||distance(origin,t)>100||terrain!==stamp){origin={x:t.x,y:t.y};terrain=stamp;path=[];work=g.demonReturnPathSteps?.({...origin},{x:base.x,y:base.y},t.radius||34)||null;}
 if(work){const start=Date.now();for(let i=0;i<32;i++){const r=work.next();if(r.done){path=r.value||[];work=null;break;}if(Date.now()-start>=1)break;}}
 if(!path.length||g.demonLineBlocked?.(t,path[0],t.radius,!!path[0].precise)!==false)return[];
 return[{x:t.x,y:t.y},...path];
 },reset(){work=origin=null;path=[];}};}
function createHint({game:g,env,offline,types}){let card=null,spot=null,ghost=null,left=0,check=0,player=g.player,predictor=createPredictor(g);
 const visible=p=>{const v=env.runtime.viewport(),z=g.zoom(),x=(p.x-g.camera.x)*z,y=(p.y-g.camera.y)*z;return x>36&&x<v.width-36&&y>110&&y<v.height-130;};
 const clear=()=>{spot=ghost=card=null;};
 const hint={update(dt){
 if(player!==g.player){player=g.player;left=0;check=0;clear();predictor.reset();}
 if(left>0){left=Math.max(0,left-dt);if(!left){clear();predictor.reset();return;}}
 if(!allowed(g,offline)){clear();return;}
 if(left<=0){if(g.dragonWallHintSeenBN||!eligible(g,offline))return;const near=distance(g.player,g.troll)<1200||(g.buildings||[]).some(b=>!b.dead&&b.ownerSlot==null&&distance(b,g.troll)<1000);if(!near)return;g.dragonWallHintSeenBN=true;left=10000;check=0;}
 const path=predictor.step();check-=dt;if(check>0)return;check=350;
 const probe=new types.Building(0,0,'wall',1);
 // The planner is the same native return-path generator on position copies,
 // never queued on the dragon and never writes its AI/navigation properties.
 let keep=false;if(spot&&visible(spot)&&g.canPlaceBuilding(spot.x,spot.y,probe.radius,'wall')&&distance(spot,g.troll)>130){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,u=l?Math.max(0,Math.min(1,((spot.x-a.x)*dx+(spot.y-a.y)*dy)/l)):0;if(Math.hypot(spot.x-a.x-u*dx,spot.y-a.y-u*dy)<=probe.radius*.75)keep=true;}}
 if(!keep)spot=selectSpot(g,probe.radius,visible,path);ghost=spot?new types.Building(spot.x,spot.y,'wall',1):null;
 },
 drawWorld(ctx){if(!ghost||left<=0||!allowed(g,offline)||!visible(spot)||!g.canPlaceBuilding(spot.x,spot.y,ghost.radius,'wall'))return;
 ctx.save();ctx.globalAlpha=.72;env.window.woodlandArt?.building(ctx,ghost);ctx.globalAlpha=1;ctx.strokeStyle='#FFD28A';ctx.lineWidth=1.5/g.zoom();ctx.strokeRect(spot.x-ghost.radius,spot.y-ghost.radius,ghost.radius*2,ghost.radius*2);ctx.restore();},
 drawHUD(ctx){if(left<=0||!allowed(g,offline))return;card=layout(g,env,spot,card);if(!card)return;const {x,y,w}=card;ctx.save();ctx.fillStyle='rgba(21,30,25,.94)';ctx.fillRect(x,y,w,38);ctx.strokeStyle='#E2B76B';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,37);ctx.textAlign='left';ctx.fillStyle='#FFE2A7';ctx.font='bold 13px sans-serif';ctx.fillText(env.runtime.nativeText(ghost?'残血龙会逃跑，在退路建墙拦截':'退路暂无可见空位，留意残血龙逃跑'),x+10,y+24,w-20);ctx.restore();},
 report:()=>({spot,left,seen:!!g.dragonWallHintSeenBN,active:left>0,card})};return hint;}
function install(env,{offline}){const attach=env.runtime.attach;env.runtime.attach=function(g){attach.call(this,g);const types=env.window.originalNetwork627?.types;if(!types?.Building)return;const h=createHint({game:g,env,offline,types});g.dragonWallHintBN=h;const update=g.update,drawWorld=g.drawPlayerBuildGhost506,drawHUD=g.drawHUD;g.update=function(dt,...args){const r=update.call(this,dt,...args);h.update(dt);return r;};g.drawPlayerBuildGhost506=function(ctx,...args){const r=drawWorld.call(this,ctx,...args);h.drawWorld(ctx);return r;};g.drawHUD=function(...args){const r=drawHUD.apply(this,args);h.drawHUD(this.ctx);return r;};};}
module.exports={allowed,eligible,route,selectSpot,layout,createPredictor,createHint,install};
