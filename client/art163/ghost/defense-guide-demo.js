'use strict';
const soft=require('./soft-hint');
exports.install=function(g,catalog,text,Building){
 let player,started,stage,done,site,lastIntro,wallMemo,idleOwns=false;
 const priority=require('../../network/notice-priority'),store=catalog.find(e=>e.type==='warehouse');
 const ordinary=require('./ordinary-guides').install(g,catalog);
 const storeRadius=new Building(0,0,'warehouse').radius;
 // Per-new-round, not a device flag written before the player can see it.
 let openingThisRound=false,resourceIntro=0,hudLast=null;
 const startIntro=g.startEndlessOpeningIntro;
 g.startEndlessOpeningIntro=function(...a){
  if(!this.tutorial){this.scrollGuideSeenR12=false;this.demonMapLessonR12=0;soft.clearCatalog(this);openingThisRound=this.operationGuideModeR13();resourceIntro=0;hudLast=null;}
  return startIntro.apply(this,a);
 };
 const restore=g.applySavedWorld;
 g.applySavedWorld=function(...a){const ok=restore.apply(this,a);if(ok){soft.clearCatalog(this);openingThisRound=false;resourceIntro=0;hudLast=null;}return ok;};
 function wallCue(){
  const n=g.supportTime||0,z=g.zoom(),o=g.screenToWorld(0,0),S=g.uiSafeRect396(),site=g.placementSitesAC,camp=g.buildRecommendationZoneIndexBN?.(),r=g.groundObstacleRevision,p=g.placement;
  if(!wallMemo||wallMemo.p!==p||wallMemo.camp!==camp||wallMemo.rev!==r||n<wallMemo.n||n-wallMemo.n>=120){
   const rows=(site?.isActive?.()?site.recommendationRows():g.defenseRecommendationSpots()).filter(b=>b.type==='wall'&&b.valid!==false&&!b.built);
   wallMemo={p,n,camp,rev:r,rows};
  }
  let best,score=Infinity;
  for(const b of wallMemo.rows){
   const x=((b.cx??b.x)-o.x)*z,y=((b.cy??b.y)-o.y)*z;
   if(x<S.x||x>S.right||y<S.y||y>S.bottom)continue;
   const rank=b.number===2?-2:b.number===5?-1:0,d=rank<0?rank:Math.hypot(x-(S.x+S.w/2),y-(S.y+S.h/2));
   if(d<score){score=d;best={x,y,w:0,h:0,wallSpot:b};}
  }
  return best;
 }
 const price=(p,e)=>g.isBuildUnlocked(e)&&p.wood>=e.wood&&p.gold>=e.gold;
 const ready=()=>own('goldMine')&&own('wall')&&own('cannonTower');
 function legalSite(){
  const now=g.supportTime||0,count=g.buildings.length, home=g.indexedOwnerBuildings(null).find(b=>b.isInitialBase&&g.completedElfBuildingBN(b));
  if(!home)return false;
  const old=site;if(old&&old.home===home&&old.count===count&&now>=old.when&&now-old.when<1800)return old.ok;
  const grid=g.ordinaryBuildingGridAD,u=grid?.unit||100,geom=g.placementGeometry621;
  if(!geom)g.placementGeometry621=new Map();
  site={when:now,count,home,ok:false};
  try{
   for(const r of [2,3,4])for(const [x,y] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
    const a=home.x+x*r*u,b=home.y+y*r*u,at=grid?.nearest(a,b,'warehouse')||{x:a,y:b};
    if(!g.buildQueuePlacementReasonBN?.('warehouse',at.x,at.y)&&g.canPlaceBuilding(at.x,at.y,storeRadius,'warehouse')){site.ok=true;return true;}
   }
  }finally{if(!geom)g.placementGeometry621=null;}
  return false;
 }
 const alive=b=>b.ownerSlot==null&&g.completedElfBuildingBN(b);
 function ledger(){
  let n=g.warehouseGuideStepPreview|0;if(n===14)return n;
  if(!(n&8)&&ready())n|=8;
  let count=0,u=0;
  for(const b of g.indexedOwnerBuildings(null))if(b.type==='warehouse'&&alive(b)){count++;if(b.level>1)u=4;if(u&&count>=2)break;}
  n=(n&12)|u|Math.max(n&3,Math.min(2,count));
  g.warehouseGuideStepPreview=n;return n;
 }
 function warehouse(L,record){
  const W='warehouse',p=g.player,n=record&3,w=g.buildQueueAvailableBN?.()||p;
  if(!(record&8)||record===14||g.placement)return null;
  if(g.getPlayerBuildQueueBN?.().some(o=>o.buildType===W)||g.resourceCapPreview?.busy?.()||g.goldShortageGuideBN?.busy?.()||priority.economy(g)||g.criticalPlayerWall399?.())return null;
  const cap=g.ownerStorageCapacity();
  const wood=p.maxWood>0&&cap.wood<10000?p.wood/p.maxWood:0,gold=p.maxGold>0&&cap.gold<10000?p.gold/p.maxGold:0;
  const fill=Math.max(wood,gold);
  if(n>0&&fill<1)return null;
  let target,mode,label=fill>=1?'资源已满，建个仓库扩大容量。':fill>=.88?'资源快满了，建仓库扩容。':'建造仓库，扩大资源容量。';
  if(n===1)label='资源已满，再建一个仓库扩大容量。';
  if(n===2){
   label='资源已满，升级仓库扩大容量。';
   const viable=b=>b.type===W&&alive(b)&&b.canUpgrade()&&!g.buildingUpgradeBlockReason(b)&&((c)=>c&&w.wood>=c.wood&&w.gold>=c.gold)(b.upgradeCost());
   const q=g.selectedBuilding;
   if(q){if(!viable(q))return null;target=g.getUpgradePanelLayout().upgradeBtn;mode='confirm';}
   else if(!L){
    const S=g.uiSafeRect396(), m=g.getMinimapRect(), top=g.topHudLayout().bottom+30,z=g.zoom();
    let cost=Infinity;for(const b of g.indexedOwnerBuildings(null)){if(!viable(b))continue;const x=(b.x-g.camera.x)*z,y=(b.y-g.camera.y)*z-24,d=(x-(S.x+S.w/2))**2+(y-(S.y+S.h/2))**2;
     if(x>S.x+25&&x<S.right-25&&y>top&&y<S.bottom-112&&!(x>m.x-26&&x<m.x+m.w+26&&y<m.y+m.h+35)&&d<cost){target={x:x-1,w:2,y,h:0};cost=d;}
    }mode='world';
   }
  }else{
   if(g.selectedBuilding||g.buildingCountBlockReason(W)||!g.isBuildUnlocked(store)||g.easyOpeningGuideAllowsBuild(W)===false)return null;
   if(n===0&&fill>=.88&&!L&&(g.warehouseGuideIntroPreview||0)<2000)return{stage:4,step:1,kind:W,mode:'resource',target:null,resource:wood>=gold?0:1,near:fill<1};
   if(!price(w,store)||!legalSite())return null;
   if(!L){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';}
   else if(g.buildMenuPage!==store.page){target=soft.catalogTab(g,L,store.page);mode='tab';label=soft.catalogHint(g,store.page)+'建造仓库';}
   else{
    const t=L.rows.find(r=>r.entry.type===W)?.rect;
    target=soft.catalogRow(g,L,t,W);mode=target?.scrollDown?'scroll':'row';
    if(target?.scrollDown)label=soft.scrollCopy('仓库');
   }
  }
  return target?{stage:4,step:n+1,kind:W,mode,target,label}:null;
 }
 const own=kind=>g.indexedOwnerBuildings(null).some(b=>b.type===kind&&b.ownerSlot==null&&g.completedElfBuildingBN(b));
 const kindFor=()=>stage===0?'goldMine':stage===3?'cannonTower':'wall';
 function primaryView(){
  if(g.cameraScenesR7?.mapCueVisible?.())return null;
  if(player!==g.player){player=g.player;started=null;stage=0;done=false;site=lastIntro=wallMemo=null;}
  const prep=g.state==='prep';
  if(g.wallHalfGuideDemo?.urgent?.()||g.roundStarting||g.roundLoading591||g.baseUpgradeGuideBN||g.batIntroCardBN?.visible?.()||g.wallHalfGuideDemo?.active()||!prep&&g.state!=='hunt'||!player||player.dead||g.tutorial||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.rewardAdBN?.pausesLive?.()||g.rotationInputBlocked398()||g.cardPresentation?.modal()||g.cameraScenesR7?.active())return null;
  const L=g.buildMenu?g.getBuildMenuLayout():null;
  if(own('goldMine'))g.openingMineGuideR8=true;
  const waitingIntro=openingThisRound&&!g.openingMineGuideR8&&resourceIntro<4300;
  if(waitingIntro&&!L&&!g.selectedBuilding&&!g.placement&&!priority.active(g))return {mode:'resourceIntro',label:'先认识资源区'};
  if(g.endlessOpeningIntro&&!openingThisRound)return null;
  const record=ledger();
  if(record&8){done=true;const store=!waitingIntro&&warehouse(L,record);if(store)return store;}
  if(!waitingIntro&&(record&3)>0){const next=ordinary.afterWarehouse();if(next)return next;}
  if(g.demonTowerGuidePreview?.view()||g.antiAirGuidePreview?.view()||g.goldMineGuidePreview?.view()||g.woodWorkforcePreview?.view()||g.tankEconomyGuidePreview?.view())return null;
  const blocked=ordinary.pendingView();if(blocked)return blocked;
  if(!waitingIntro&&record&8){const b=ordinary.view({allowBase:ready});if(b)return b;}
  if(done)return null;
  if(g.selectedBuilding)return null;
  if(!prep&&started==null)started=g.huntElapsed;
  if(stage===0&&g.openingMineGuideR8)stage=1;
  if(stage===1&&g.buildMenuPage===1&&L)stage=2;
  if(stage>=1&&own('wall'))stage=3;
  if(stage===3&&own('cannonTower'))return null;
  const kind=kindFor(),entry=catalog.find(e=>e.type===kind),affordable=price(g.player,entry)&&g.easyOpeningGuideAllowsBuild(kind)!==false&&!g.buildingCountBlockReason(kind);
  let target=null,mode=null,label=stage===0&&!g.placement?'先建造金矿厂':null;
  if(stage===0&&!affordable&&!L&&!g.placement&&!g.getPlayerBuildQueueBN?.().some(q=>q.buildType===kind)){
   const p=g.player,task=p.task,active=p.drivingTank||g.ghostElfAPI?.host?null:task;
   const shortGold=p.gold<entry.gold,shortWood=p.wood<entry.wood;
   if(shortGold||shortWood){
    if(shortGold&&active?.type==='gold'){
     label=active.phase==='return'?'正在把金币运回基地':'正在采矿，攒够金币再建金矿厂';
    }else if(shortWood&&active?.type==='wood'){
     label=active.phase==='return'?'把木材运回基地':'正在伐木，准备建金矿厂';
    }else{
     if(p.ghostElf||p.drivingTank||g.ghostElfAPI?.host)return null;
     target=g.buttons.find(b=>b.id===(shortGold?'collectGold':'collectWood')&&b.w>0&&b.h>0&&b.visible!==false);
     if(target)mode='gather';
     label=shortGold?'点「采矿」，为金矿厂攒金币':'金币够了，点「伐木」攒木材';
    }
   }
  }
  if(stage>0&&!affordable&&!L&&!g.placement&&g.isBuildUnlocked(entry)&&!g.buildingCountBlockReason(kind)){
   const b=ordinary.view({defenseCost:entry});if(b)return {...b,stage,kind,buildCost:entry};
   if(g.player.wood<entry.wood||g.player.gold<entry.gold)label='攒够资源，再建造'+g.buildingName(kind);
  }
  if(affordable&&!g.getPlayerBuildQueueBN?.().some(q=>q.buildType===kind)){
   if(g.placement){
    if(g.placement.type===kind){
     if(g.placement.stage==='confirm'){target=g.getPlacementButtons().find(b=>b.id==='placeConfirm');mode='confirm';label='点「确认建造」';}
     else if(kind==='wall'){target=wallCue();if(target){mode='world';label='在入口放一面城墙';}}
    }
   }else if(!L){
    target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';label=stage===0?'先建造金矿厂':'建造'+g.buildingName(kind);
   }else if(g.buildMenuPage!==entry.page){
    target=soft.catalogTab(g,L,entry.page);mode='tab';label=soft.catalogHint(g,entry.page)+'建造'+g.buildingName(kind);
   }else if(stage!==1){
    const box=L.rows.find(r=>r.entry.type===kind)?.rect,name=g.buildingName(kind);
    target=soft.catalogRow(g,L,box,kind);
    if(target){mode=target.scrollDown?'scroll':'row';label=target.scrollDown?soft.scrollCopy(name):'建造'+name;}
   }
  }
  return{stage,kind,label,mode,target,buildCost:affordable?null:entry,welcome:stage>0&&!waitingIntro&&!prep&&started!=null&&g.huntElapsed-started<4.7};
 }
 function view(){
  if(!g.operationGuideModeR13())return null;
  const explicit=ordinary.wallPrerequisite();if(explicit)return explicit;
  if(g.cameraScenesR7?.mapCueVisible?.())return null;
  const row=primaryView();
  if(!ordinary.hasIdle())return row;
  const paused=openingThisRound&&!g.openingMineGuideR8&&resourceIntro<4300;
  if(row)return row.stage===4?row:ordinary.idleView(row,row.buildCost,paused,true)||row;
  const other=g.demonTowerGuidePreview?.view()||g.antiAirGuidePreview?.view()||g.goldMineGuidePreview?.view()||g.woodWorkforcePreview?.view();
  return ordinary.idleView(null,other?.target?null:other?.buildCost,paused,!other);
 }
 function round(c,x,y,w,h){
  const r=8;c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
 }
 function banner(c,ss,label){
  const S=g.uiSafeRect396(),L=g.buildMenu?g.getBuildMenuLayout():null,m=g.getMinimapRect(),hud=g.topHudLayout();
  const max=Math.min(ss?310:label?.startsWith('资源')?272:250,S.w-44);
  const contents=ss?[[text('趁恶魔还没发现你，抓紧发展经济、'),16],[text('筑起防线，守住你的基地！'),16]]:[[text(label),13]];
  const plan=soft.layout(c,max,contents),{w,h}=plan,x=S.x+(S.w-w)/2,top=Math.max(hud.bottom+12,m.y+m.h+32);
  let y=L?L.y-h-12:top;
  if(!ss&&g.selectedBuilding){
   const U=g.getUpgradePanelLayout();
   y=U.y+U.h+h+7<S.bottom-56?U.y+U.h+7:U.y-h-6;
  }
  soft.paint(c,x,Math.min(S.bottom-h-6,Math.max(S.y+4,y)),plan);
 }
 function resourceBubble(c,kind,near){
  const r=g.resourceValueRectR13(c,kind);if(!r)return;
  const copy=text((kind?'金币':'木材')+(near?'快满':'已满')),font='bold 12px sans-serif';
  c.save();c.font=font;const w=Math.max(46,Math.ceil(c.measureText(copy).width)+10);c.restore();
  soft.buildArrow(g,c,{...r,hudValue:true},.97,{w,h:19,rows:[[copy,font,'#F0FFF0',9.5]]});
 }
 function paintResourceIntro(c){
  const G=g.hudGeometry504(),H=G.resource,S=g.uiSafeRect396(),M=g.getMinimapRect(),land=G.land;
  const R=land?H:{x:H.x,y:H.y+10*G.k,w:H.w*.315,h:84*G.k};
  c.save();c.strokeStyle='rgba(117,255,166,.86)';c.lineWidth=1.5;round(c,R.x-2,R.y-2,R.w+4,R.h+4);c.stroke();c.restore();
  const textRows=[['先认识资源区',15],['木材、金币：用于建造和升级',13],['人口：已用人数 / 人口上限',13]];
  const panel=soft.layout(c,Math.min(252,S.w-28),textRows.map(([copy,size])=>[text(copy),size]));
  // This original top-HUD resource highlight is too high for a down-arrow.
  // Keep the same green bounce below the actual source rectangle; keep copy still.
  const ax=land?R.x+R.w*.44:Math.min(R.x+R.w-15,Math.max(R.x+R.w*.62,G.menu.x+G.menu.w+16));
  const ay=Math.max(G.bottom,R.y+R.h)+3;
  soft.cardinal(g,c,{x:ax,y:ay,direction:'up',scale:1.15});
  const right=ax+21,left=ax-21-panel.w,by=ay+23;
  const fit=(x)=>x>=S.x+4&&x+panel.w<=S.right-4&&!(x<M.x+M.w&&x+panel.w>M.x&&by<M.y+M.h&&by+panel.h>M.y);
  if(fit(right)||fit(left))soft.paint(c,fit(right)?right:left,by,panel);
  else soft.paint(c,Math.max(S.x+4,Math.min(S.right-panel.w-4,ax-panel.w*.5)),Math.min(S.bottom-panel.h-6,ay+63),panel);
 }
 function draw(){
  if(!g.operationGuideModeR13()||g.passiveHintsR13?.quiet()&&!ordinary.wallPrerequisite()){hudLast=lastIntro=null;idleOwns=false;return;}
  const row=view(),now=g.supportTime||0;idleOwns=!!(row?.idleBuild||row?.stage===4||row?.progress||row?.wallPrerequisite);
  ordinary.drawIdleSleep(g.ctx,openingThisRound&&!g.openingMineGuideR8&&resourceIntro<4300);
  if(row?.mode==='resourceIntro'){
   if(hudLast!==null&&now>=hudLast)resourceIntro=Math.min(4300,resourceIntro+Math.min(100,now-hudLast));
   hudLast=now;lastIntro=null;paintResourceIntro(g.ctx);return;
  }
  hudLast=null;
  if(row?.mode==='resource'){if(lastIntro!=null&&now>=lastIntro)g.warehouseGuideIntroPreview=Math.min(2000,(g.warehouseGuideIntroPreview||0)+Math.min(100,now-lastIntro));lastIntro=now;resourceBubble(g.ctx,row.resource,row.near);return;}
  lastIntro=null;if(!row||g.placement)return;const c=g.ctx,t=row.target;
  if(!t||t.scrollDown){
   if(!t&&(row.welcome||row.mode==='ordinary'||row.label&&!g.buildMenu))banner(c,row.welcome,row.label);
   if(t)soft.buildArrow(g,c,t,1.33);
   return;
  }
  soft.buildArrow(g,c,t,1.33,soft.layout(c,Math.min(250,g.uiSafeRect396().w-44),[[text(row.label),13]]));
 }
 const upgrade=g.tryUpgradeBuilding;
 g.tryUpgradeBuilding=function(b,...a){const lv=b?.level,out=upgrade.call(this,b,...a);if(out&&b?.type==='warehouse'&&b.level>lv){if((g.warehouseGuideStepPreview&3)===2)g.passiveHintsR13?.earned();ledger();}return out;};
 const commit=g.updatePlayerBuild506;
 g.updatePlayerBuild506=function(...a){
  const k=g.player.task?.buildType,n=g.buildings.length,out=commit.apply(this,a);
  if(k&&g.buildings.length>n){
   const b=g.buildings[g.buildings.length-1];
   if(k==='warehouse'||k==='goldMine'||k==='wall'||k==='cannonTower'){if(b?.type===k&&b.ownerSlot==null&&g.completedElfBuildingBN(b)&&(k===kindFor()||k==='warehouse'&&(g.warehouseGuideStepPreview&8)))g.passiveHintsR13?.earned();if(k==='goldMine'&&own('goldMine'))g.openingMineGuideR8=true;ledger();}
  }
  return out;
 };
 const openMenu=g.openBuildMenu,menuTap=g.handleBuildMenuTap;
 g.openBuildMenu=function(...a){soft.clearCatalog(this);return openMenu.apply(this,a);};
 g.handleBuildMenuTap=function(...a){const before=this.buildMenuPage,out=menuTap.apply(this,a);
  if(!this.buildMenu||this.buildMenuPage!==before)soft.clearCatalog(this);
  return out;
 };
 const orig=g.draw;g.draw=function(...args){const out=orig.apply(this,args);draw();return out;};
 function warehouseAhead(){
  if(!g.operationGuideModeR13())return false;
  const record=ledger();
  if(record===14||!(record&8))return false;
  if(g.wallHalfGuideDemo?.active()||priority.economy(g)||g.cameraScenesR7?.active()||g.batIntroCardBN?.visible?.()||!['prep','hunt'].includes(g.state)||g.player.dead||g.tutorial||g.sessionMenuOpen||g.saveSlotsPanel||g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.rewardAdBN?.pausesLive?.()||g.rotationInputBlocked398()||g.cardPresentation?.modal())return false;
  return !!warehouse(g.buildMenu?g.getBuildMenuLayout():null,record);
 }
 let clockHud,clockSecond,clockDigits;
 const clockTitle=text('恶魔苏醒倒计时');
 g.prepDemonTimerR10=function(c,G,n,x,y,w){
  if(g.state!=='prep'){
   if(g.state==='hunt'&&G.land){
    const k=G.k;c.save();c.textAlign='center';c.textBaseline='middle';c.font='bold '+Math.round(10*k)+'px sans-serif';
    c.fillStyle='#FFE294';c.fillText(text('目标：摧毁恶魔老巢'),x,y+16*k,w-4*k);c.restore();
   }
   return false;
  }
  const k=G.k,land=G.land,guide=g.operationGuideModeR13();
  clockHud={k,land,x,y,w};
  c.save();c.textAlign='center';c.textBaseline='middle';
  function line(str,dy,size,color,dx=0,width=w){
   c.font='bold '+Math.round(size*k)+'px sans-serif';c.fillStyle=color;c.fillText(text(str),x+dx,y+dy*k,width-4*k);
  }
  if(land){
   const a=Math.min(w,310*k);c.fillStyle='rgba(29,14,14,.83)';round(c,x-a/2,y-20*k,a,39*k);c.fill();
   if(guide)line('趁恶魔苏醒前，抓紧布防',5,12,'#FFE58A',a*.20,a*.56);
   line('目标：摧毁恶魔老巢',15,10,'#FFE294',a*.20,a*.56);
  }else{
   if(guide){line('趁恶魔苏醒前，',28,11,'#FFD99B');
   line('抓紧布防',43,14,'#FFF18C');}
   line('目标：摧毁恶魔老巢',63,11,'#FFE294');
  }
  c.restore();return true;
 };
 const drawStatus=g.drawStatusCached504;
 g.drawStatusCached504=function(c,...args){
  const out=drawStatus.call(this,c,...args),t=clockHud;
  if(!c||this!==g||g.state!=='prep'||!t)return out;
  const {k,land,x,y,w}=t,a=Math.min(w,310*k),now=g.supportTime||0,n=Math.ceil(g.prepTimeLeft);
  if(n!==clockSecond){clockSecond=n;clockDigits=text(Math.max(0,n)+' 秒');}
  const phase=Math.PI*2*(now%1380)/1380,size=1+.15*Math.sin(phase);
  c.save();c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';c.strokeStyle='#4E1018';c.lineWidth=2*k;
  const pulse=(str,dx,dy,base,width,red)=>{
   c.font='900 '+(base*k*size).toFixed(1)+'px sans-serif';c.fillStyle=red;
   c.strokeText(str,x+dx,y+dy*k,width);c.fillText(str,x+dx,y+dy*k,width);
  };
  if(land){
   pulse(clockTitle,a*.20,-10,13,a*.54,'#FF958B');pulse(clockDigits,-a*.26,0,28,a*.43,'#FF6E63');
  }else{
   pulse(clockTitle,0,-21,12,w-4*k,'#FF958B');pulse(clockDigits,0,3,28,w-4*k,'#FF6E63');
  }
  c.restore();return out;
 };
 const placementCaption=g.drawPlacementLessonR8;
 g.drawPlacementLessonR8=function(...a){
  if(!g.wallHalfGuideDemo?.urgent?.()||!this.placementLessonR8()?.guide)return placementCaption.apply(this,a);
 };
 g.rangeTagR12=function(w,h,top,bottom,tx,ty){
  const S=g.uiSafeRect396(),G=g.hudGeometry504(),M=g.getMinimapRect(),V=g.resourceCapViewport?.();
  const avoid=[M,g.sessionMenuRect(),{x:tx-46,y:ty-43,w:92,h:86}],fps=V&&g.singlePlayerHud627?.layout(V,G,[g.toastRect]);
  if(fps)avoid.push(fps);
  const z=g.zoom(),o=g.screenToWorld(0,0),zone=g.resourceZones?.[g.buildRecommendationZoneIndexBN?.()??g.playerStartZoneIndex];
  for(const r of g.defenseRecommendationLayout(zone))avoid.push({x:(r.x-o.x)*z-41,y:(r.y-o.y)*z-37,w:82,h:74});
  const y0=Math.max(top,(fps&&fps.y<top+60?fps.y+fps.h+7:0));
  for(const y of [y0,y0+36,y0+69])for(const x of [S.x+(S.w-w)/2,S.x+9,S.right-w-9]){
   if(y+h<=bottom&&!avoid.some(r=>r&&x-5<r.x+r.w&&x+w+5>r.x&&y-4<r.y+r.h&&y+h+4>r.y))return {x:x+w/2,y};
  }
  // In a compressed view use HUD-side whitespace, never a caption anchored over the cannon.
  return {x:S.x+Math.min(S.w-w/2-9,Math.max(w/2+9,tx<S.x+S.w/2?S.w-w/2-9:w/2+9)),y:Math.max(top,Math.min(y0,bottom-h))};
 };
 g.defenseGuideDemo={view,warehouseAhead,resourceIntroActive:()=>openingThisRound&&!g.openingMineGuideR8&&resourceIntro<4300,idleOwns:()=>idleOwns,ownsFull:()=>{const p=g.player;return !!p&&(p.wood>=p.maxWood||p.gold>=p.maxGold)&&view()?.stage===4;}};
};
