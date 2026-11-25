'use strict';
const soft=require('./soft-hint'),priority=require('../../network/notice-priority');
const WORKER_PRICE={wood:15,gold:5}, TOWERS=new Set(['tower','iceTower','manaTower','cannonTower']);
const STOCK_EXPAND='houseForPeasants',PRODUCTION='goldMine',BAZAAR='exchange',MAX_MINES=20,MAX_WORKERS=50;
const resources=['wood','gold'],name={wood:'木材',gold:'金币'};
const GOLD_TIP='金矿等级越高，采金越快。',WOOD_TIP='伐木工越多，采木越快。';
const persistent=new Set(['buildMine','upgradeMine2','upgradeMine3','worker','mineWait','workerWait']);
const defenseReady=s=>s.baseLevel>=3&&s.wallLevel>=8&&s.defenseTowers>=7;

const affordable=(wallet,c)=>!!c&&resources.every(k=>Number.isFinite(c[k])&&c[k]>=0&&wallet[k]>=c[k]);
function chooseEconomicGuide(s){
 if(!s.active||!defenseReady(s)||s.redWall||s.higherGuide)return null;
 const next=(list)=>list.find(a=>a?.allowed&&affordable(s.wallet,a.cost));
 const {mines,housing,actions:a,workers,cap,pop}=s;
 const needsHousing=cap<MAX_WORKERS||workers<MAX_WORKERS&&pop>=cap;
 if(cap<MAX_WORKERS){const x=next([...a.housing2,a.house]);if(x)return {...x,guide:'population'};}
 if(mines.length>=10&&a.trade)return {...a.trade,guide:'exchange'};
 if(mines.length<MAX_MINES){const x=next([a.mine]);if(x)return {...x,guide:'buildMine'};}
 else{
  if(!mines.every(b=>b.level>=2)){const x=next(a.mine2);if(x)return {...x,guide:'upgradeMine2'};}
  else if(!mines.some(b=>b.level>=3)){const x=next(a.mine3);if(x)return {...x,guide:'upgradeMine3'};}
 }
 if(cap>=MAX_WORKERS&&!s.pendingHousing&&!housing.some(b=>b.level>=3)){
  const x=next(a.housing3);if(x)return {...x,guide:'finishHouse3'};
 }
 if(needsHousing&&cap>=MAX_WORKERS){const x=next([...a.housing2,a.house]);if(x)return {...x,guide:'population'};}
 if(workers<MAX_WORKERS&&pop<cap){const x=next([a.worker]);if(x)return {...x,guide:'worker'};}
 return null;
}
function install(g,runtime,catalog,Building,offline){
 if(g.midEconomyGuideR13)return;
 const entries=new Map(catalog.map(x=>[x.type,x]));
 const radii=new Map();for(const type of [STOCK_EXPAND,PRODUCTION,BAZAAR])radii.set(type,new Building(0,0,type).radius);
 const inScope=()=>offline()===true&&g.state==='hunt'&&g.player&&!g.player.dead&&!g.player.defected&&!g.tutorial&&!g.superChallenge580&&!g.networkDrawCamera627&&!g.networkAuthorityPhases627;
 const now=()=>g.supportTime||0;
 const built=b=>b?.ownerSlot==null&&g.completedElfBuildingBN(b),cash=()=>g.buildQueueAvailableBN?.()||g.player;
 const text=s=>runtime.nativeText(s);
 let memo,failed,shown,lastShow=-Infinity,p,scanAt=0,world,teach=null,seenGold=false,seenWood=false,higherBusy=false;
 const sites=new Map();
 function scan(){
  const player=g.player,t=now();
  if(p!==player||world!==g.troll){p=player;world=g.troll;memo=failed=shown=presented=teach=null;seenGold=seenWood=false;evaluatedAt=-Infinity;lastShow=-Infinity;sites.clear();}
  if(memo&&memo.buildings===g.buildings&&memo.len===g.buildings.length&&t>=scanAt&&t-scanAt<440)return memo;
  const owners=g.indexedOwnerBuildings(null),houses=[],mines=[],housing=[],shops=[];
  let pendingHousing=false,minesAt2=0,mineAt3=false;
  for(const b of owners){if(!built(b)){
   if(b&&!b.dead&&b.ownerSlot==null&&(b.type===STOCK_EXPAND||b.type==='house'&&b.level>=3))pendingHousing=true;
   continue;
  }
   if(b.type===PRODUCTION){mines.push(b);if(b.level>=2)minesAt2++;if(b.level>=3)mineAt3=true;}
   else if(b.type===STOCK_EXPAND)housing.push(b);
   else if(b.type===BAZAAR)shops.push(b);
   else if(b.type==='house')houses.push(b);

  }
  // A completed starting base (or surviving replacement if lost) and its native
  // zone count; an unrelated secondary site or AA-only towers do not protect it.
  const home=houses.find(b=>b.isInitialBase)||houses.reduce((best,b)=>!best||b.level>best.level?b:best,null);
  const baseLevel=home?.level||0,camp=home?g.resourceZoneIndexFor401(home):-1;
  let wallLevel=0,defenseTowers=0;
  if(baseLevel>=3&&camp>=0)for(const b of owners){
   const wall=b.type==='wall',ground=TOWERS.has(b.type)&&!b.airDefenseKindBN;
   if(!(wall||ground)||!built(b)||g.resourceZoneIndexFor401(b)!==camp)continue;
   if(wall)wallLevel=Math.max(wallLevel,b.level);else defenseTowers++;
  }
  let workers=0;for(const w of g.peasants||[])if(w&&!w.dead&&w.ownerSlot==null&&(!w.inTank||w.inTank.dead)&&w.task?.type!=='board')workers++;
  scanAt=t;return memo={buildings:g.buildings,len:g.buildings.length,houses,mines,minesAt2,goldDone:mines.length>=MAX_MINES&&minesAt2===mines.length&&mineAt3,housing,shops,baseLevel,wallLevel,defenseTowers,pendingHousing,
    cap:g.getPeasantCap(),pop:g.getPeasantCount(),workers};
 }
 function legalSite(type,houses){
  const grid=g.ordinaryBuildingGridAD,t=now(),old=sites.get(type),n=g.buildings.length;
  if(old?.n===n&&t>=old.at&&t-old.at<1750)return old.ok;
  const mark={n,at:t,ok:false};sites.set(type,mark);
  const u=grid?.unit||100,geom=g.placementGeometry621;if(!geom)g.placementGeometry621=new Map();
  try{for(const base of houses.slice(0,3))for(const depth of [2,3,4])for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const x=base.x+dx*depth*u,y=base.y+dy*depth*u,q=grid?.nearest(x,y,type)||{x,y};
   if(!g.buildQueuePlacementReasonBN?.(type,q.x,q.y)&&g.canPlaceBuilding(q.x,q.y,radii.get(type),type)){mark.ok=true;return true;}
  }}finally{if(!geom)g.placementGeometry621=null;}
  return false;
 }
 const canStart=type=>{const entry=entries.get(type);return entry&&!g.buildingCountBlockReason(type)&&g.isBuildUnlocked(entry)&&g.easyOpeningGuideAllowsBuild(type)!==false;};
 const canRaise=b=>built(b)&&b.canUpgrade?.()&&!g.buildingUpgradeBlockReason(b)&&g.easyOpeningGuideAllowsUpgrade(b)!==false;
 const build=(type,s,w)=>canStart(type)&&affordable(w,entries.get(type))&&!g.getPlayerBuildQueueBN?.().some(x=>x.buildType===type)&&legalSite(type,s.houses)?
   {allowed:true,kind:'build',type,cost:entries.get(type)}:null;
 const upgrades=(list,level)=>list.filter(b=>b.level===level&&canRaise(b)).map(target=>({allowed:true,kind:'upgrade',target,from:level,cost:target.upgradeCost()}));
 function redWall(){return priority.economy(g)||!!g.criticalPlayerWall399?.()||!!g.firstAttackCameraFocus||!!g.demonAttackFocus545;}
 function occupied(includeGuides=true){
  return runtime.hidden||redWall()||g.roundStarting||g.roundLoading591||g.endlessOpeningIntro||g.sessionMenuOpen||g.saveSlotsPanel||
   g.demonPanel||g.relicPanel||g.allyDataPanel||g.ceremony||g.placement||g.cameraScenesR7?.active?.()||g.rotationInputBlocked398?.()||
   g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.cardPresentation?.modal?.()||g.cardPresentation?.blocksDock?.()||
   g.rewardAdBN?.pausesLive?.()||g.player.drivingTank||g.ghostElfAPI?.host||g.resourceCapPreview?.busy?.()||includeGuides&&(
   g.demonTowerGuidePreview?.view?.()||g.antiAirGuidePreview?.view?.(true)||g.goldMineGuidePreview?.view?.(true)||
   g.woodWorkforcePreview?.view?.(true)||g.tankEconomyGuidePreview?.view?.()||g.vehicleDriveGuidePreview?.view?.()||g.vehicleLabGuidePF?.view?.());
 }
 function eligible(){return inScope()&&defenseReady(scan());}
 function stillFailed(q){
  if(!q||q.player!==g.player||now()>=q.ends)return false;
  if(q.action==='build')return canStart(q.args?.type);
  if(q.action==='upgrade')return canRaise(q.target)&&q.target.level===q.level;
  return !q.target||!q.target.dead&&q.target.ownerSlot==null;
 }
 function trade(s,w){
  const q=failed;if(s.mines.length<10||!stillFailed(q))return null;
  const short=resources.filter(k=>w[k]<q.cost[k]);if(short.length!==1)return null;
  const out=short[0],src=out==='gold'?'wood':'gold',direction=out==='gold'?'woodToGold':'goldToWood';
  const room=out==='gold'?g.player.maxGold:g.player.maxWood,rates={wood:1,gold:1},missing=q.cost[out]-w[out];
  if(q.cost[out]>room)return null;
  const permits=(wallet,batches,shop,actualOutputBalance)=>{
   const cap=Math.floor((room-actualOutputBalance)/rates[out]),spare=Math.floor((wallet[src]-q.cost[src])/rates[src]);
   return spare>=batches&&cap>=batches&&Math.floor(Math.min(spare,cap)/batches)*batches*rates[out]>=q.cost[out]-wallet[out]&&
    (!shop||!g.exchangeBlockReason(shop,direction,batches));
  };
  for(const b of s.shops){if(!built(b))continue;
   const batches=g.exchangeSelectedBatches(direction,b);
   if(Number.isInteger(batches)&&batches>0&&permits(w,batches,b,g.player[out]))return {kind:'trade',target:b,direction,batches,out,missing,cost:{[src]:batches,[out]:0}};
  }
  if(s.shops.length)return null;
  const shop=build(BAZAAR,s,w);if(!shop)return null;
  const remainder={wood:w.wood-shop.cost.wood,gold:w.gold-shop.cost.gold};
  return permits(remainder,10,null,g.player[out]-shop.cost[out])?{...shop,out,missing}:null;
 }
 function noteFailure(s,cost){
  if(!s||s.player!==g.player||s.action==='exchange'||!eligible()||scan().mines.length<10||!cost||!resources.every(k=>Number.isFinite(cost[k])&&cost[k]>=0))return false;
  if(g.state!=='hunt'||redWall())return false;
  // Retain only a native failure with an actionable one-sided exchange.
  failed={...s,cost,level:s.target?.level,ends:now()+12000};
  if(!trade(scan(),cash())){failed=shown=presented=null;evaluatedAt=-Infinity;return false;}
  shown=presented=null;evaluatedAt=-Infinity;lastShow=-Infinity;return true;
 }
 function pick(checkHigher=true){
  if(!eligible())return null;
  const s=scan(),w=cash(),actionTrade=trade(s,w);
  if(occupied(checkHigher))return null;
  const home=s.houses.find(b=>b.level>=3&&!g.peasantBlockReason(b)&&g.easyOpeningGuideAllowsAction('makePeasantBtn',b)!==false);
  const a={trade:actionTrade,mine:s.mines.length<MAX_MINES?build(PRODUCTION,s,w):null,mine2:[],mine3:[],house:null,housing2:[],housing3:[],
   worker:home?{kind:'worker',target:home,allowed:true,cost:WORKER_PRICE}:null};
  if(s.mines.length>=MAX_MINES){if(s.mines.some(b=>b.level<2))a.mine2=upgrades(s.mines,1);else if(!s.mines.some(b=>b.level>=3))a.mine3=upgrades(s.mines,2);}
  const wantsCapacity=s.cap<50||s.workers<50&&s.pop>=s.cap;
  const finish=s.cap>=50&&!s.pendingHousing&&!s.housing.some(b=>b.level>=3);
  if(wantsCapacity||finish){a.house=build(STOCK_EXPAND,s,w);a.housing2=upgrades(s.housing,1);if(finish)a.housing3=upgrades(s.housing,2);}
  return chooseEconomicGuide({...s,active:true,wallet:w,actions:a});
 }
 function prompt(a){
  const s=scan(),kind=a.kind;
  const copy=a.guide==='exchange'?kind==='trade'?'还缺'+Math.ceil(a.missing)+name[a.out]+'，可到交易所兑换。':'资源不够，可建交易所，用富余资源兑换。':
   a.guide==='population'?'先把人口容量补到至少 50（当前 '+s.cap+'）。':
   a.guide==='worker'?'招募伐木工（'+s.workers+'/50）。'+WOOD_TIP:
   a.guide==='finishHouse3'?'人口容量已达 50，可选一座房屋升到三级。':
   a.guide==='buildMine'?'先把金矿厂建到 20 座（'+s.mines.length+'/20）。':
   a.guide==='upgradeMine2'?'金矿厂全部升二级（'+s.minesAt2+'/'+s.mines.length+'）。':
   a.guide==='upgradeMine3'?'再把一座金矿厂升到三级。'+GOLD_TIP:
   a.guide==='mineWait'?s.mines.length<MAX_MINES?'金矿厂 '+s.mines.length+'/20，条件满足后继续建造。':s.minesAt2<s.mines.length?
    '金矿厂还没全部二级，条件满足后继续升级。':'条件满足后，把一座金矿厂升到三级。'+GOLD_TIP:
   a.guide==='workerWait'?'伐木工 '+s.workers+'/50，条件满足后继续招募。'+WOOD_TIP:
   a.guide==='goldReady'?'金矿厂目标达成。'+GOLD_TIP:'已招满 50 名伐木工。'+WOOD_TIP;
  if(kind==='text')return {copy,target:null};
  if(kind==='build'){
   if(a.guide==='exchange'&&!trade(s,cash()))return null;
   if(g.selectedBuilding)return {copy,target:g.getUpgradePanelLayout().closeBtn};
   if(!g.buildMenu)return {copy,target:g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false)};
   const L=g.getBuildMenuLayout(),entry=entries.get(a.type);
   return {copy,target:g.buildMenuPage===entry.page?soft.catalogRow(g,L,L.rows.find(r=>r.entry.type===a.type)?.rect,a.type):soft.catalogTab(g,L,entry.page)};
  }
  const b=a.target;
  if(!built(b)||kind==='upgrade'&&(!canRaise(b)||b.level!==a.from||!affordable(cash(),b.upgradeCost()))||
    kind==='worker'&&(g.peasantBlockReason(b)||!affordable(cash(),WORKER_PRICE))||
    kind==='trade'&&(!trade(s,cash())||g.exchangeBlockReason(b,a.direction,a.batches)))return null;
  if(g.buildMenu)return {copy,target:g.getBuildMenuLayout().closeBtn};
  if(g.selectedBuilding){
   const L=g.getUpgradePanelLayout();
   return {copy,target:g.selectedBuilding!==b?L.closeBtn:kind==='upgrade'?L.upgradeBtn:kind==='worker'?L.makePeasantBtn:
    a.direction==='goldToWood'?L.exchangeGoldToWoodBtn:L.exchangeWoodToGoldBtn};
  }
  const S=g.uiSafeRect396(),z=g.zoom(),p=g.screenToWorld(0,0),x=(b.x-p.x)*z,y=(b.y-p.y)*z-40;
  // Do not move the camera to create a suggestion. Off-screen targets show only text.
  const m=g.getMinimapRect(),visible=x>S.x+25&&x<S.right-25&&y>g.topHudLayout().bottom+32&&y<S.bottom-115&&
    !(x>=m.x-20&&x<=m.x+m.w+20&&y>=m.y-15&&y<=m.y+m.h+25)&&(!g.fogEnabled||g.fogStateAtWorld(b.x,b.y)===2);
  return {copy,target:visible?{x,y,w:0,h:0}:null};
 }
 let evaluatedAt=-Infinity,presented=null;
 const same=(q,a)=>q&&a&&q.guide===a.guide&&q.kind===a.kind&&q.target===a.target&&q.type===a.type&&q.from===a.from&&q.direction===a.direction;
 function view(){
  if(!eligible()||runtime.hidden||redWall()){shown=teach=null;return null;}
  const t=now();if(t<evaluatedAt||t-evaluatedAt>=300){higherBusy=!!occupied();presented=higherBusy?null:pick(false);evaluatedAt=t;}
  if(higherBusy||occupied(false)){shown=teach=null;return null;}
  const s=scan(),goldDone=s.goldDone,woodDone=s.workers>=MAX_WORKERS;
  if(teach&&((teach.guide==='goldReady'&&!goldDone)||(teach.guide==='woodReady'&&!woodDone)))teach=null;
  if(teach&&t>=teach.until)teach=null;
  if(presented?.guide!=='exchange'&&!teach){
   if(goldDone&&!seenGold)teach={guide:'goldReady',kind:'text',until:t+4200};
   else if(woodDone&&!seenWood)teach={guide:'woodReady',kind:'text',until:t+4200};
  }
  if(teach&&presented?.guide!=='exchange')return {...prompt(teach),teaching:teach.guide};
  const a=presented||(!goldDone?{kind:'text',guide:'mineWait'}:!woodDone?{kind:'text',guide:'workerWait'}:null);
  if(!a){shown=null;return null;}
  if(persistent.has(a.guide)){
   shown=null;
   if(a.kind==='build'&&(!canStart(a.type)||!affordable(cash(),a.cost)))return null;
   const p=prompt(a);return p&&{...p,tradeSupplyFor:null};
  }
  if(shown&&!same(shown.action,a)){shown=null;lastShow=t-18000;}
  if(!shown){if(t-lastShow<18000)return null;shown={action:a,until:t+6200};lastShow=t;}
  if(t>=shown.until)return null;
  if(a.kind==='build'&&(!canStart(a.type)||!affordable(cash(),a.cost)))return null;
  const p=prompt(a);return p&&{...p,tradeSupplyFor:a.guide==='exchange'?a.out:null};
 }
 function prepare(){
  if(g.passiveHintsR13?.quiet())return;
  const a=view();if(!a)return null;
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const tip=a.copy.endsWith(GOLD_TIP)?GOLD_TIP:a.copy.endsWith(WOOD_TIP)?WOOD_TIP:null;
  const segments=tip?[[text(a.copy.slice(0,-tip.length))],[text(tip),13,'#CDEED5','']]:[[text(a.copy)]];
  const box=soft.layout(C,Math.min(282,S.w-34),segments),x=S.x+(S.w-box.w)/2;
  let y=Math.max(g.topHudLayout().bottom+20,(M.y+M.h+18));
  if(L)y=L.y+L.h+box.h+9<S.bottom-62?L.y+L.h+6:Math.max(S.y+5,L.y-box.h-6);
  if(y+box.h>S.bottom-48)return null;
  return {a,C,x,y,box};
 }
 function draw({a,C,x,y,box}){
  if(a.target&&!a.target.scrollDown)soft.buildArrow(g,C,a.target,1.1,box);
  else if(a.target)soft.buildArrow(g,C,a.target,1.1);
  else soft.paint(C,x,y,box);
  if(a.teaching==='goldReady')seenGold=true;else if(a.teaching==='woodReady')seenWood=true;
 }
 const nativeDraw=g.draw;
 g.draw=function(...args){
  const plan=prepare(),prev=g.midTradePaintSupplyR13;
  // Existing precise rejection toasts remain untouched. Only a visible and actionable
  // alternative claims its corresponding ordinary collect prompt, and only this frame.
  g.midTradePaintSupplyR13=plan?.a.target&&plan.a.target.visible!==false?plan.a.tradeSupplyFor:null;
  try{const out=nativeDraw.apply(this,args);if(plan)draw(plan);return out;}
  finally{g.midTradePaintSupplyR13=prev;}
 };
 g.midEconomyGuideR13={noteFailure,view,choose:pick,ownsLatePlan:eligible,managesExchange:()=>eligible()&&scan().mines.length>=10};
}
module.exports={install,chooseEconomicGuide};
