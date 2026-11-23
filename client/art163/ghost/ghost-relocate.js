'use strict';
const escape=require('./ghost-relocate-path');
const NO_EXIT='此处无路返回恶魔基地，不能传送';
const CD_MS=100000, SLOW_MS=10000, CAST_MS=380, SLOW_MULT=.2;
const alive=u=>!!u&&!u.dead&&!u.downed&&Number.isFinite(u.x)&&Number.isFinite(u.y)&&(!Number.isFinite(u.hp)||u.hp>0);
const n=(v,d)=>Number.isFinite(v)?v:d;
const radius=u=>Math.max(1,n(u.radius,12));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const PLOT=90, LAKE_DISTRICT_SCALE=2;
function lakeDistrict(pool,r){
 const rx=n(pool.rx,0),ry=n(pool.ry,0);
 if(rx<=0||ry<=0)return null;
 // No native biome is stored: make the whole lake scene one basin, scaled from each authored outline.
 // The homothetic extra factor ensures the entire Dragon ground disk stays outside at every angle.
 const k=LAKE_DISTRICT_SCALE+r/Math.min(rx,ry);
 return {rx:rx*k,ry:ry*k};
}
const rectHit=(p,r,left,top,right,bottom)=>Math.hypot(p.x-clamp(p.x,left,right),p.y-clamp(p.y,top,bottom))<=r;
function lakeHit(g,world,p,r){
 for(const pool of g.waterPools||[]){
  const region=lakeDistrict(pool,r);
  if(region&&((p.x-pool.x)/region.rx)**2+((p.y-pool.y)/region.ry)**2<=1)return true;
  const reach=r+PLOT*2, data=pool.collision;
  if(data&&!rectHit(p,reach,pool.x+data.minX,pool.y+data.minY,pool.x+data.maxX,pool.y+data.maxY))continue;
  // These are the same water runs the game draws, including the shore layer.
  const cells=pool.cells||[], rowH=world?.lakes?.some(l=>l.cells===cells)?3:6;
  let lo=0,hi=cells.length;while(lo<hi){const mid=(lo+hi)>>>1;if(pool.y+cells[mid].dy+rowH<p.y-reach)lo=mid+1;else hi=mid;}
  for(let i=lo;i<cells.length;i++){const c=cells[i],x=pool.x+c.dx,y=pool.y+c.dy;
   if(y>p.y+reach)break;
   if(rectHit(p,reach,x,y,x+c.w,y+rowH))return true;
  }
 }
 return false;
}
function forestHit(world,p,r){
 if(!world?.buckets)return false;
 const size=128,pad=r+120;
 for(let y=Math.floor((p.y-pad)/size);y<=Math.floor((p.y+pad)/size);y++)
 for(let x=Math.floor((p.x-pad)/size);x<=Math.floor((p.x+pad)/size);x++)
 for(const t of world.buckets.get(x+','+y)||[]){
  const w=t.size/2,bottom=t.y+14;
  if(rectHit(p,r,t.x-w,bottom-t.size*1.03,t.x+w,bottom))return true;
 }
 return false;
}
function buildingHit(g,p,r){
 const hit=(b,type,minPlot=false)=>{
  if(!b||b.dead||!Number.isFinite(b.x)||!Number.isFinite(b.y))return false;
  const form=g.defensePlacementSize?.(type==='netTowerBN'||type==='antiAirTowerBN'?'tower':type);
  if(form&&rectHit(p,r,b.x-form.w/2,b.y-form.h,b.x+form.w/2,b.y))return true;
  const br=Math.max(minPlot?PLOT/2:0,g.placementRadiusAC?.(type,radius(b))||radius(b));
  return rectHit(p,r,b.x-br,b.y-br,b.x+br,b.y+br);
 };
 for(const b of g.buildings||[])if(hit(b,b.type))return true;
 if(hit(g.trollBase,g.trollBase?.type))return true;
 for(const order of g.getPlayerBuildQueueBN?.()||[g.player?.task])if(order?.type==='build'&&hit(order.spot,order.buildType,true))return true;
 for(const a of g.allies||[])if(!a.dead&&a.task?.type==='build'&&hit(a.task.spot,a.task.buildType,true))return true;
 const grid=g.plots;
 if(grid?.ownerAt)for(let y=Math.floor((p.y-r)/PLOT)*PLOT;y<=p.y+r;y+=PLOT)
 for(let x=Math.floor((p.x-r)/PLOT)*PLOT;x<=p.x+r;x+=PLOT){
  const o=grid.ownerAt(x+PLOT/2,y+PLOT/2);
  if(o?.kind==='building'&&(!o.ref||(o.refs||[o.ref]).some(b=>b&&!b.dead))&&rectHit(p,r,x,y,x+PLOT,y+PLOT))return true;
 }
 return false;
}
const circle=(p,u,r)=>Math.hypot(p.x-u.x,p.y-u.y)<r;
function create(game,options={}){
 const set=new Set();let selection=null,flight=null,approach=null,rift=null,slowed=null,slowMs=0,receipt=null,projection=null;
 const notify=(text,bad=false)=>{receipt={text,bad,left:bad?2300:1700};};
 const enabled=()=>!game.networkAuthorityPhases627&&!game.networkMode&&!game.onlineMode&&options.enabled?.(game)===true;
 const playable=()=>enabled()&&game.state==='hunt'&&!game.sessionMenuOpen&&!game.demonPanel&&!game.tutorial&&!game.endlessOpeningIntro;
 const driverOf=v=>v?.driver||v?.crew||null;
 const isActor=a=>alive(game.player)&&alive(a)&&a.isRobot===true&&a.ghostMechBN===true&&game.player?.drivingTank===a&&driverOf(a)===game.player&&(game.tanks?.includes(a)||game.robots?.includes(a));
 // The original main Demon is the only target in every evolution stage.
 const revealed=p=>!game.fogStateAtWorld||game.fogStateAtWorld(p.x,p.y)>1;
 const valid=body=>body===game.troll&&alive(body);
 function legal(body,p){
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  const b=options.bounds?.(game);if(!b||!Number.isFinite(b.width)||!Number.isFinite(b.height)||typeof game.terrainCollisionAt!=='function')return false;
  const r=radius(body);if(p.x<r||p.y<r||p.x>b.width-r||p.y>b.height-r||circle(p,body,Math.max(r,16))||game.terrainCollisionAt(p.x,p.y,r))return false;
  if(options.legalPoint&&options.legalPoint(body,p,game)!==true)return false;
  for(const list of [game.buildings,game.tanks,game.robots,game.trees,game.goldMines,game.allies,game.hounds,game.miniTrolls,[game.player,game.troll,game.trollBase]]){
   if(!list)continue;
   for(const o of list){if(o===body||!alive(o))continue;if(circle(p,o,r+Math.max(o.type==='wall'?46:0,radius(o))))return false;}
  }
  return true;
 }
 function landingReason(body,p){
  const b=options.bounds?.(game),r=radius(body),world=options.terrain?.();
  if(!b||p.x<r||p.y<r||p.x>b.width-r||p.y>b.height-r)return '超出地图边界';
  if(lakeHit(game,world,p,r))return '湖泊及外围区域不能传送恶魔';
  if(forestHit(world,p,r))return '树林不能传送恶魔';
  if(buildingHit(game,p,r))return '此处有建筑或正在建造，不能传送恶魔';
  const kind=game.terrainCollisionAt?.(p.x,p.y,r)?.kind;
  if(kind==='water')return '湖泊及外围区域不能传送恶魔';
  if(kind==='guardTree')return '树林不能传送恶魔';
  return legal(body,p)?'':'此处不能落地，请换个位置';
 }
 // One bounded visible-space search per skill press. Never predicts or reveals the source.
 const previewX=[.50,.36,.64,.22,.78,.12,.88],previewY=[.54,.58,.47,.65];
 const HINT_TAP=22;
 function findHint(target,actor){
  const s=game.uiSafeRect396?.(),z=game.zoom?.();if(!s||!(z>0)||!game.screenToWorld)return null;
  let fallback=null;
  for(const u of previewY)for(const v of previewX){
   const p=game.screenToWorld(s.x+s.w*v,s.y+s.h*u);
   if(p&&revealed(p)&&options.markerFits?.(p.x,p.y,HINT_TAP/z)!==false&&!landingReason(target,p)){if(!circle(p,actor,175))return p;fallback??=p;}
  }
  return fallback;
 }
 const route=(p,t)=>escape.make(game,p,t,options.bounds?.(game));
 const routeOK=(q,t)=>escape.current(game,q,t)&&q.ok===true;
 function useHint(s,p){
  const h=s.hint,z=game.zoom?.();
  return h&&routeOK(s.hintProof,s.target)&&z>0&&revealed(h)&&options.markerFits?.(h.x,h.y,HINT_TAP/z)!==false&&circle(p,h,HINT_TAP/z)?h:null;
 }
 function updateLocation(u,p,allowNet=false){
  const x=u.x,y=u.y;if(allowNet&&u.groundNetLockedBN){if(!options.moveLocked?.(u,p.x,p.y))return false;}else{u.x=p.x;u.y=p.y;}
  if(u.x!==p.x||u.y!==p.y){u.x=x;u.y=y;return false;}
  u._animX=p.x;u._animY=p.y;u.setMoveIntent?.(0,0);u.moving=false;
  game.clearUnitNavigation?.(u);game.chaseRouteWatches?.delete(u);game.demonBuildingWatches?.delete(u);
  u.terrainAvoidObstacle=null;u.terrainAvoidNormal=null;u.terrainAvoidSign=0;u.terrainEscape=null;u.terrainClearDistance411=0;
  if('navProgressAnchor' in u)u.navProgressAnchor=null;
  if('buildingApproachWatch' in u)u.buildingApproachWatch=null;
  if('moveTarget' in u)u.moveTarget=null;
  return true;
 }
 const unlocked=a=>game.ghostRobotSkillBN?game.ghostRobotSkillBN('ghostRelocate',a):game.robotTech?.laser>=10;
 const canSelect=a=>playable()&&isActor(a)&&unlocked(a)&&game.ghostRobotAimUIBN?.()!==false;
 function canBegin(a){return canSelect(a)&&valid(game.troll)&&!flight&&!(n(a.ghostRelocateCdBN,0)>0);}
 function begin(a){
  if(!canSelect(a))return false;
  if(approach){stopApproach();return true;}
  if(flight||n(a.ghostRelocateCdBN,0)>0)return false;
  if(selection?.actor===a){selection=null;return true;}
  const target=game.troll;
  if(!valid(target)){notify('恶魔尚未出现或已倒下',true);return false;}
  options.warm?.();game.cardVisuals?.warmBolt?.();selection={actor:a,target,hint:findHint(target,a)};if(selection.hint)selection.hintProof=route(selection.hint,target);
  notify('请选择落点');return true;
 }
 function tapWorld(x,y){
  if(!selection)return false;
  const {actor,target}=selection;
  if(!canSelect(actor)){selection=null;receipt=null;return false;}
  if(!Number.isFinite(x)||!Number.isFinite(y))return true;
  if(!valid(target)){selection=null;notify('恶魔已不在场，未消耗冷却',true);return true;}
  const raw={x,y},hint=useHint(selection,raw),p=hint||raw,centerReason=landingReason(target,p),reason=centerReason||(hint?landingReason(target,raw):'');
  if(hint&&centerReason)selection.hint=null;
  const proof=reason?null:hint?selection.hintProof:route(p,target);
  selection.choice={p,valid:routeOK(proof,target),proof};
  notify(reason||(proof.ok?'位置定好了，点确认传送':'正在检查能否返回基地…'),!!reason);
  return true;
 }
 function placement(){
  if(selection)return {relocate:true,stage:selection.choice?'confirm':'aim',valid:selection.choice?.valid===true&&routeOK(selection.choice.proof,selection.target)};
  return approach?{relocate:true,stage:'approach',valid:false}:null;
 }
 function stopApproach(){
  const a=approach;approach=null;
  if(!a)return false;
  if(game.player?.moveTarget===a.goal){
   game.player.moveTarget=null;a.actor.setMoveIntent?.(0,0);a.actor.moving=false;game.clearUnitNavigation?.(a.actor);
  }
  return true;
 }
 function cancel(){
  const had=!!selection||!!approach||!!flight;
  selection=null;stopApproach();
  if(flight){flight.actor.ghostRelocateCastBN=0;set.delete(flight.actor);flight=null;rift=null;}
  if(had)receipt=null;
  return had;
 }
 function cast(actor,target,p,proof){
  set.add(actor);actor.ghostRelocateCastBN=CAST_MS+180;flight={actor,target,p,proof,left:CAST_MS};
  rift={from:revealed(target)?{x:target.x,y:target.y}:null,to:p,left:850,end:'pending'};
  notify('传送中…');options.onCast?.(actor,target,p);
 }
 function tapButton(id){
  if(!placement())return false;
  if(id==='placeCancel'){cancel();notify('已取消传送');return true;}
  if(id!=='placeConfirm'||!selection?.choice)return false;
  const s=selection,p=s.choice.p;
  if(!canSelect(s.actor)||!valid(s.target)){cancel();notify('目标已失效，未消耗冷却',true);return true;}
  if(!routeOK(s.choice.proof,s.target))return true;
  const reason=landingReason(s.target,p);
  if(reason){s.choice.valid=false;notify(reason,true);return true;}
  selection=null;
  game.player.takeOverManual?.();game.clearUnitNavigation?.(s.actor);
  if(circle(p,s.actor,n(options.castReach,900)+.001)){s.actor.setMoveIntent?.(0,0);s.actor.moving=false;cast(s.actor,s.target,p,s.choice.proof);return true;}
  game.manualCamera394=false;
  const goal={x:p.x,y:p.y};
  game.player.moveTarget=goal;
  approach={actor:s.actor,target:s.target,p,proof:s.choice.proof,goal,x:s.actor.x,y:s.actor.y,stuck:0};
  notify('正在前往落点附近');return true;
 }
 function reset(){
  cancel();flight=null;rift=null;slowed=null;slowMs=0;receipt=null;projection=null;for(const a of set){a.ghostRelocateCdBN=0;a.ghostRelocateCastBN=0;}set.clear();
 }
 function tick(dt){
  if(!enabled()){if(selection||approach||flight||rift||slowed||receipt||set.size)reset();return;}
  if(selection&&!canSelect(selection.actor))cancel();
  if(canSelect(game.player?.drivingTank))game.cardVisuals?.warmBolt?.();
  if(!playable()||!Number.isFinite(dt)||dt<=0)return;
  if(selection){
   const {target,choice,hint,hintProof}=selection;
   if(!choice&&hint&&escape.current(game,hintProof,target))escape.work(hintProof);
   if(choice?.proof){
    if(!escape.current(game,choice.proof,target)){choice.valid=false;choice.proof=route(choice.p,target);notify('地形变化，重新检查返程…');}
    const proof=choice.proof;if(proof.ok===undefined){escape.work(proof);if(proof.ok!==undefined){const reason=landingReason(target,choice.p)||(proof.ok?'':proof.ok===null?'无法确认返程路线，换一个落点':NO_EXIT);choice.valid=!reason;notify(reason||'位置定好了，点确认传送',!!reason);}}
   }
  }
  if(slowMs>0){slowMs=Math.max(0,slowMs-dt);if(slowed)slowed.ghostRelocateSlowBN=slowMs;if(!slowMs||!alive(slowed)||slowed!==game.troll){slowMs=0;slowed=null;}}
  if(receipt&&(receipt.left-=dt)<=0)receipt=null;
  if(rift){rift.left-=dt;if(rift.left<=0)rift=null;}
  for(const a of set){
   a.ghostRelocateCdBN=Math.max(0,n(a.ghostRelocateCdBN,0)-dt);
   a.ghostRelocateCastBN=Math.max(0,n(a.ghostRelocateCastBN,0)-dt);
   if(!a.ghostRelocateCdBN&&!a.ghostRelocateCastBN)set.delete(a);
  }
  if(approach){
   const a=approach,player=game.player;
   if(!canSelect(a.actor)||!valid(a.target)||player.moveTarget!==a.goal){stopApproach();notify('已取消传送，未消耗冷却',true);}
   else if(circle(a.p,a.actor,n(options.castReach,900)+.001)){
    const reason=landingReason(a.target,a.p)||(routeOK(a.proof,a.target)?'':NO_EXIT);stopApproach();
    if(reason)notify(reason+'，未消耗冷却',true);else cast(a.actor,a.target,a.p,a.proof);
    return; // Keep a true full-length cast after reaching the range.
   }else if(Math.hypot(a.actor.x-a.x,a.actor.y-a.y)>.5){a.x=a.actor.x;a.y=a.actor.y;a.stuck=0;}
   else if((a.stuck+=dt)>2500){stopApproach();notify('暂时无法靠近落点，未消耗冷却',true);}
  }
  if(!flight)return;
  flight.left-=dt;if(flight.left>0)return;
  const f=flight;flight=null;
  const reason=isActor(f.actor)&&valid(f.target)?(landingReason(f.target,f.p)||(routeOK(f.proof,f.target)?'':NO_EXIT)):'目标已失效';
  const from=revealed(f.target)?{x:f.target.x,y:f.target.y}:null;
  if(reason||!updateLocation(f.target,f.p,true)){
   f.actor.ghostRelocateCdBN=0;f.actor.ghostRelocateCastBN=0;set.delete(f.actor);rift=null;notify((reason||'目标受限无法移动')+'，未消耗冷却',true);return;
  }
  f.actor.ghostRelocateCdBN=CD_MS;set.add(f.actor);
  if(rift){rift.from=rift.from&&from;rift.end='landed';rift.demon=f.target;}
  game.demonMoveBlocker=null;slowed=f.target;slowMs=slowed.ghostRelocateSlowBN=SLOW_MS;
  notify('恶魔已到达 · 减速 10 秒');
  options.onLanding?.(f.actor,f.target,f.p);
 }
 function restore(){if(!enabled())return;for(const a of game.tanks||[]){if(!a?.isRobot)continue;if(a.ghostRelocateCastBN>180)a.ghostRelocateCdBN=0;if(a.ghostRelocateCastBN)a.ghostRelocateCastBN=0;if(n(a.ghostRelocateCdBN,0)>0)set.add(a);}const t=game.troll;if(valid(t)&&t.ghostRelocateSlowBN>0){slowed=t;slowMs=Math.min(SLOW_MS,t.ghostRelocateSlowBN);}}
 function state(a){return {selection:selection?.actor===a?(selection.choice?'confirm':'destination'):approach?.actor===a?'approach':null,cooldownMs:n(a?.ghostRelocateCdBN,0),castPose:castPose(a),slowMs};}
 function castPose(a){const left=n(a?.ghostRelocateCastBN,0);return !left?0:left>465||left<115?1:2;}
 function moveMultiplier(u,m=1){return enabled()&&u===slowed&&slowMs>0?Math.min(m,SLOW_MULT):m;}
 // Storm cadence: overlap adjacent branch poses, then let a small contact glow outlive the bolt.
 let purpleStamp;
 function groundGlow(c,x,y,rx,ry,a){
  if(!purpleStamp&&options.createCanvas){
   purpleStamp=options.createCanvas();purpleStamp.width=purpleStamp.height=96;
   const q=purpleStamp.getContext('2d'),g=q.createRadialGradient(48,48,0,48,48,48);
   g.addColorStop(0,'rgba(107,28,237,.41)');g.addColorStop(.40,'rgba(125,29,244,.41)');
   g.addColorStop(.62,'rgba(173,52,255,.96)');g.addColorStop(.83,'rgba(151,39,252,.52)');g.addColorStop(1,'rgba(127,25,244,0)');
   q.fillStyle=g;q.fillRect(0,0,96,96);
  }
  if(purpleStamp){c.save();c.globalCompositeOperation='screen';c.globalAlpha=a;rx*=1.28;ry*=1.28;c.drawImage(purpleStamp,x-rx,y-ry,rx*2,ry*2);c.restore();}
 }
 function ease(v){v=clamp(v,0,1);return v*v*(3-2*v);}
 function bolt(c,x,y,source=false){
  const u=flight?1-clamp(flight.left/CAST_MS,0,1):0;
  const age=rift?.end==='landed'?SLOW_MS-slowMs:-1;
  if(!flight&&(source||age<0||age>460))return;
  const rise=source?ease(u/.34):ease((u-.13)/.68);
  const gain=flight?rise*(source?.88*(1-ease((u-.69)/.31)):.86):1-ease(age/295);
  if(source)y+=4;
  game.cardVisuals?.drawBolt?.(c,x,y,source?97:145,gain,flight?u*.42:.42+age/490);
  if(age>=0){
   const a=(1-ease(age/460))*ease((age+36)/116),r=19+ease(age/460)*18;
   c.beginPath();c.ellipse(x,y+8,r,r*.32,0,0,Math.PI*2);
   c.globalAlpha=a*.45;c.fillStyle='#AA6CD6';c.fill();
   c.globalAlpha=a*.72;c.lineWidth=2;c.strokeStyle='#AC73D1';c.stroke();
  }
  c.globalAlpha=1;
 }
 function drawWorld(c,inView){
  if(!playable()||(!rift&&!slowMs))return;
  const visible=typeof inView==='function'?inView:()=>true;
  const ring=(p,r,a,arc)=>{if(!visible(p.x,p.y,r+15))return;c.globalAlpha=a;c.lineWidth=3;c.strokeStyle='#965DBE';c.beginPath();c.ellipse(p.x,p.y,r,r*.31,0,arc,arc+4.7);c.stroke();c.lineWidth=2;c.strokeStyle='#714790';c.beginPath();c.ellipse(p.x,p.y,r*.82,r*.25,0,-arc,-arc+4.2);c.stroke();};
  c.save();
  if(flight&&visible(flight.actor.x,flight.actor.y,130))bolt(c,flight.actor.x,flight.actor.y,true);
  if(rift){const k=clamp(rift.left/850,0,1);if(rift.from&&revealed(rift.from))ring(rift.from,60,.82*k,k*5);if(revealed(rift.to)){if(flight&&visible(rift.to.x,rift.to.y,95))groundGlow(c,rift.to.x,rift.to.y,75,25,.48+.5*ease(1-flight.left/CAST_MS));ring(rift.to,59,.87*k,-k*5);if(visible(rift.to.x,rift.to.y,120))bolt(c,rift.to.x,rift.to.y);}}
  if(slowMs>0&&alive(slowed)&&revealed(slowed)&&visible(slowed.x,slowed.y,120)){
   const {x,y}=slowed,r=slowed.dragonEvolved?68:45,ry=r*.33,remaining=clamp(slowMs/SLOW_MS,0,1);
   const arc=(dr,start,end)=>{c.beginPath();c.ellipse(x,y+20,r+dr,ry+dr*.33,0,start,end);};
   groundGlow(c,x,y+20,r*1.27,ry*1.27,.62+.33*(1-ease((SLOW_MS-slowMs)/540)));
   c.globalAlpha=.95;
   arc(0,0,Math.PI*2);c.fillStyle='rgba(86,36,132,.33)';c.fill();
   c.strokeStyle='rgba(105,48,155,.54)';c.lineWidth=8;c.stroke();
   c.strokeStyle='#65358B';c.lineWidth=2.4;c.stroke();
   arc(7,-Math.PI/2,-Math.PI/2+Math.PI*2*remaining);c.strokeStyle='#A579C7';c.lineWidth=2.5;c.stroke();
   c.font='bold 21px sans-serif';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#322041';c.fillStyle='#D5B4E7';
   const label='减速 · '+Math.ceil(slowMs/1000)+' 秒',ly=y+ry+47;
   c.strokeText(label,x,ly);c.fillText(label,x,ly);
  }
  c.restore();
 }
 function drawFeedback(c){
  if(!playable()||game.ghostRobotAimUIBN?.()===false||(!receipt&&!selection&&!approach))return;
  const s=game.uiSafeRect396?.();if(!s)return;
  const label=receipt?.text||(approach?'正在前往落点附近':selection.choice?'位置定好了，点确认传送':'请选择落点');
  c.save();try{
   c.font='bold 13px sans-serif';c.textAlign='center';c.textBaseline='middle';
   const btn=placement()&&game.getPlacementButtons?.()[0];
   const w=Math.min(s.w-20,c.measureText(label).width+24),x=s.x+s.w/2,y=btn?btn.y-17:s.y+Math.round(s.h*(s.landscape?.70:.73));
   if(!receipt?.bad){c.lineWidth=3;c.strokeStyle='rgba(37,26,48,.88)';c.fillStyle='#E2C3EE';c.strokeText(label,x,y,w-8);c.fillText(label,x,y,w-8);return;}
   c.fillStyle=receipt?.bad?'rgba(56,22,22,.94)':'rgba(21,32,44,.94)';c.fillRect(x-w/2,y-12,w,24);
   c.lineWidth=1;c.strokeStyle=receipt?.bad?'#ffb38e':'#b4e7ec';c.strokeRect(x-w/2+.5,y-11.5,w-1,23);
   c.fillStyle=receipt?.bad?'#ffd1b0':'#e5f9f7';c.fillText(label,x,y,w-12);
  }finally{c.restore();}
 }
 // Match drawPlacementPreview material. A circular plot changes its shape, not the placement grammar.
 function drawRoundPlot(c,x,y,r,z,safe,chosen){
  const circle=(d)=>{c.beginPath();c.arc(x,y,d,0,Math.PI*2);};
  circle(r);
  c.globalAlpha=safe?(chosen?.66:.59):(chosen?.65:.45);
  c.fillStyle=safe?'#8752B8':'#F44336';c.fill();
  c.globalAlpha=1;
  if(safe){groundGlow(c,x,y,r*1.27,r*1.27,chosen?.86:.65);circle(r);}
  c.lineWidth=Math.max(chosen?2.4:1.65,2*z);c.strokeStyle=safe?(chosen?'#704397':'#654186'):(chosen?'#FFB0A7':'#FFC4BD');c.stroke();
  if(safe){
   const t=((game.supportTime||0)%1120)/1120,k=t*t*(3-2*t);
   circle(r);c.lineWidth=(chosen?7:6)+Math.sin(t*Math.PI)*1.2;c.strokeStyle='rgba(129, 71, 173, 0.29)';c.stroke();
   c.beginPath();c.arc(x,y,r,-2.7,-.85);c.lineWidth=chosen?2.5:1.9;c.strokeStyle=chosen?'#AA77CA':'#9A6ABA';c.stroke();
   circle(r+3+k*(chosen?9:7));c.lineWidth=1.5;c.globalAlpha=.48*Math.sin(t*Math.PI);c.strokeStyle='#9565B8';c.stroke();c.globalAlpha=1;
  }else if(chosen){circle(r+10*z);c.strokeStyle='rgba(255, 155, 146, 0.40)';c.stroke();}
 }
 function drawHint(c,w,h,q){
  const p=!selection?.choice&&selection?.hint;
  if(!p||!routeOK(selection.hintProof,selection.target)||!playable()||game.ghostRobotAimUIBN?.()===false||!revealed(p))return;
  const z=game.zoom(),x=(p.x-game.camera.x)*z+q.x,y=(p.y-game.camera.y)*z+q.y;
  if(x<26||x>w-26||y<28||y>h-24||options.markerFits?.(p.x,p.y,HINT_TAP/z)===false)return;
  c.save();try{
   drawRoundPlot(c,x,y,Math.max(18,Math.min(HINT_TAP,radius(selection.target)*z*1.33)),z,true,false);
   c.font='bold 11px sans-serif';c.textAlign='center';c.lineWidth=3;c.strokeStyle='#392543';c.fillStyle='#DFC1EC';
   c.strokeText('恶魔落点',x,y-32);c.fillText('恶魔落点',x,y-32);
  }finally{c.restore();}
 }
 function drawProjection(c,w,h,q){
  const state=selection?.choice||approach;
  if(!state||!playable())return;
  const t=selection?.target||approach?.target,p=state.p,z=game.zoom();
  const x=(p.x-game.camera.x)*z+q.x,y=(p.y-game.camera.y)*z+q.y;
  if(x<-130||x>w+130||y<-90||y>h+230)return;
  const safe=selection?state.valid||!!state.proof&&state.proof.ok===undefined:routeOK(state.proof,t),r=Math.max(22,Math.min(51,radius(t)*z+.4))*(safe?1.35:1);
  c.save();try{
   drawRoundPlot(c,x,y,r,z,safe,true);
   if(valid(t)){
    const key=t.dragonEvolved?2:t.evolved?1:0;
    const now=game.supportTime||0;
    if(options.createCanvas&&(projection?.key!==key||(!projection.image&&projection.retryAt<=now))){
     const image=options.createCanvas();image.width=352;image.height=304;
     const paint=image.getContext('2d'),pose=Object.assign(Object.create(t),{x:176,y:229,_animX:176,_animY:229,actionKind:null,actionAnim:0,moving:false,facing:1,facingV:1,sideways:false});
     projection=options.drawDragon?.(paint,pose)?{key,image}:{key,retryAt:now+350};
    }
    if(projection?.key===key&&projection.image){c.globalAlpha=safe?.57:.38;c.drawImage(projection.image,x-176*z,y-229*z,352*z,304*z);}
   }
  }finally{c.restore();}
 }
 function fogReceipt(c,w,h,q){
  if(!playable()||!rift||revealed(rift.to))return;
  const z=game.zoom(),p=rift.to,sx=(p.x-game.camera.x)*z+q.x,sy=(p.y-game.camera.y)*z+q.y;
  if(sx< -105||sx>w+105||sy< -80||sy>h+215)return;
  const k=clamp(rift.left/850,0,1),a=-k*5;
  c.save();try{
   c.translate(sx,sy);c.scale(z,z);
   c.globalAlpha=Math.min(1,k*2.6);c.strokeStyle='#965DBE';c.lineWidth=4;c.beginPath();c.ellipse(0,0,59,18,0,a,a+5.35);c.stroke();
   c.strokeStyle='#714790';c.lineWidth=2;c.beginPath();c.ellipse(0,0,48,13,0,-a,-a+4.7);c.stroke();
    if(flight)bolt(c,0,0);
  }finally{c.restore();}
  const t=rift.demon;
  // Draw only the actual arriving actor, not a vision source or any terrain. No source revelation.
  if(!alive(t)||t!==game.troll||Math.hypot(t.x-p.x,t.y-p.y)>120||revealed(t))return;
  c.save();try{
   c.translate(-game.camera.x*z+q.x,-game.camera.y*z+q.y);c.scale(z,z);
   c.globalAlpha=Math.min(1,rift.left/150);
   options.drawDragon?.(c,t);bolt(c,p.x,p.y);
  }finally{c.restore();}
 }
 if(typeof game.drawFogOfWar==='function'){
  const base=game.drawFogOfWar;
  game.drawFogOfWar=function(c,w,h,q){base.apply(this,arguments);q=q||{x:0,y:0};drawHint(c,w,h,q);drawProjection(c,w,h,q);fogReceipt(c,w,h,q);};
 }
 return{drawFeedback,placement,tapButton,warm:options.warm,begin,canBegin,restore,busy:a=>selection?.actor===a||approach?.actor===a||flight?.actor===a||a?.ghostRelocateCastBN>0,drawCaster(c,a,pose=castPose(a),x=a?.x,y=(a?.y??0)+31,h=110){if(!pose)return false;return drawCastPose(c,options.castImage?.(),pose,x,y,h);},tapWorld,pending:()=>!!selection,aimPhase:()=>selection?(selection.choice?'confirm':'landing'):null,cancel,tick,reset,drawWorld,state,castPose,moveMultiplier};
}
// True independent hand poses; use identical world-space character height and foot anchor.
function drawCastPose(c,image,pose,x,footY,height){if(!image||!(image.width>0)||!(pose===1||pose===2)||!(height>0))return false;
 const k=height/110,w=112*k;c.drawImage(image,112*(pose-1),0,112,120,x-w*.5,footY-115*k,w,120*k);return true;
}
module.exports={create,drawCastPose,CD_MS,SLOW_MS,CAST_MS,SLOW_MULT};
