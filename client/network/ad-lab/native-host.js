'use strict';
const bridge=require('./ad-surfaces'),ledger=require('./wx-wall-reward-ledger'),footer=require('./wall-reward-footer'),nativeVehicle=require('./r93-vehicle-revive-native');
module.exports=function install(game,{runtime,types,offline,sdk,config}){
 if(config?.enabled!==true||sdk!==globalThis.wx||!types?.Building)return null;
 let version;try{version=sdk?.getAccountInfoSync?.()?.miniProgram?.envVersion;}catch(_){return null;}
 if(version!=='develop'&&version!=='trial')return null;
 const ids=[config.rewardId,config.interstitialId,config.lobbyId];
 if(ids.some(id=>typeof id!=='string'||!/^adunit-[a-z0-9]+$/i.test(id))||new Set(ids.map(id=>id.toLowerCase())).size!==3)return null;
 const losses=new WeakMap(),defenseTypes=new Set(['tower','iceTower','manaTower','cannonTower','watchtower']);
 let seq=0,visit=0,lobby=null,result=null,match=null,wallMatch=null,press=null,manualPanel=null;
 const solo=()=>offline()&&!game.networkDrawCamera627&&!game.networkAuthorityPhases627&&!game.tutorial&&!game.superChallenge580;
 const roundLive=()=>solo()&&!game.roundStarting&&!game.roundLoading591&&!game.player?.dead&&['prep','hunt'].includes(game.state);
 const noModal=()=>!game.popupActive515()&&!game.placement&&!game.endlessOpeningIntro&&!game.ceremony&&!game.rotationInputBlocked398()&&
  !game.shareRescueVisible616()&&!game.cardPresentation?.modal()&&!game.robotGuideBN?.playing?.()&&!game.dragonTutorialBL?.active;
 const canOffer=()=>!runtime.hidden&&roundLive()&&noModal();
 const validKind=(b,kind)=>kind==='wall'?b.type==='wall':config.towerRecovery===true&&defenseTypes.has(b.type);
 const canRetain=r=>{
  const b=r?.unit;
  if(!(b instanceof types.Building)||!b.dead||b.ownerSlot!=null||!validKind(b,r.kind)||losses.get(b)!==r.eventId||
   b.x!==r.x||b.y!==r.y||b.type!==r.type||b.level!==r.level||b.airDefenseKindBN!==r.air||!roundLive()||
   !game.canPlaceBuilding(r.x,r.y,b.radius,b.type))return false;
  const o=game.plots.ownerAt(r.x,r.y);return !o||o.kind==='building';
 };
 const canSite=r=>{
  if(!canRetain(r))return false;
  const b=r.unit;
  const groups=[game.getElves(),game.tanks,game.hounds,game.miniTrolls,game.peasants,[game.troll]];
  return groups.every(a=>a.every(e=>!e||e.dead||Math.hypot(e.x-r.x,e.y-r.y)>b.radius+(e.radius||0)+2));
 };
 function ownWall(b){return b instanceof types.Building&&b.type==='wall'&&b.ownerSlot==null&&!b.preview&&!b.isPreview&&!b.underConstruction&&!(b.buildTime>0&&b.buildProgress<b.buildTime);}
 const lv=typeof config.vehicleHealth==='function'?nativeVehicle({Tank:types.Tank,Robot:types.Robot,width:10000,height:8000,
  game:()=>game,match:()=>match,solo:roundLive,health:config.vehicleHealth}):null;
 const isLobby=()=>solo()&&game.state==='start'&&!game.roundStarting&&!game.roundLoading591&&!game.sessionMenuOpen&&!game.saveSlotsPanel&&noModal();
 const isResult=()=>match&&result&&solo()&&game.player===result.player&&!game.roundStarting&&!game.roundLoading591&&
  !game.ceremony&&(result.kind==='win'?game.state==='win':!!game.player.dead&&(game.playerDeathSerial||0)===result.serial);
 const adTrace=[],settlementKey='test_settlement_ad_trace_v1';
 function resultsTrace(step,code){
  if(adTrace.length>=24)adTrace.shift();
  adTrace.push(code===undefined?{step}:{step,code});
  // Test-only diagnostic, no ad unit or match/player identity, timestamp,
  // SDK message, or network request. Never halt a match for diagnostics.
  try{sdk.setStorage?.({key:settlementKey,data:adTrace.slice(),fail:()=>{}});}catch{}
 }
 const ad=bridge({wx:sdk,rewardId:config.rewardId,interstitialId:config.interstitialId,lobbyId:config.lobbyId,
  wallHost:{wx:sdk,scope:id=>id===wallMatch&&roundLive(),canOffer,canRetain,canRebuild:canSite,
   rebuild:r=>canSite(r)&&game.restoreShareWallsBF([r.unit])===1,notify:s=>game.showToast(s),onChange:()=>runtime.wake?.(),onPresented:save},
  towerHost:config.towerRecovery===true?{...ledger(sdk,'tower'),scope:id=>id===match&&roundLive(),canOffer,canRetain,canRebuild:canSite,
   rebuild:r=>canSite(r)&&game.restoreShareWallsBF([r.unit])===1,notify:s=>game.showToast(s),onChange:()=>runtime.wake?.()}:null,
  vehicleHost:lv?{...ledger(sdk,'vehicle'),scope:id=>id===match&&roundLive(),canOffer,canRetain:lv.canRetain,canRestore:lv.canRestore,
   restoreVehicle:lv.restore,notify:s=>game.showToast(s),onChange:()=>runtime.wake?.(),onPresented:save}:null,
  manualHost:config.manualSaveGate===true?{live:(panel,slot,id)=>id===match&&roundLive()&&game.saveSlotsPanel===panel&&
   panel.adManualBN===true&&panel.mode==='save'&&panel.selected===slot,notice:(panel,text)=>{
    if(game.saveSlotsPanel===panel){panel.notice=text;game.wxUiDirty=true;runtime.wake?.();}
   }}:null,
  resultsLive:id=>id===match&&isResult()===true,
  resultsWarmLive:id=>id===match&&solo()&&!game.roundStarting&&!game.roundLoading591&&['hunt','win','lose'].includes(game.state),
  resultsTrace,
  lobbyLive:id=>id===lobby&&id!==null&&isLobby(),lobbyLayout:()=>config.lobbyLayout?.(game,runtime.viewport()),lobbyPolicy:config.lobbyPolicy,
  lobbyMeasure:config.lobbyMeasure,otherAd:()=>!!game.shareRewardPending
 });
 const wallFooter=footer(ad.wall,()=>runtime.wake?.(),{title:()=> '一段城墙已被摧毁 · 可原地重建'});
 const towerFooter=ad.tower?footer(ad.tower,()=>runtime.wake?.(),{title:r=>game.buildingName(r.unit)+'已被摧毁，可选择原地重建'}):null;
 const vehicleFooter=ad.vehicle?footer({...ad.vehicle,dismiss:ad.vehicle.skip},()=>runtime.wake?.(),{
  title:r=>r.kind==='robot'?'机器人已被摧毁，可选择复活':'坦克已被摧毁，可选择复活'}):null;
 let currentFooter=null;
 function legacyWallId(stable){
  // Native card identities contain three base36 components; replacing only
  // these fixed separators is reversible and cannot collide with new IDs.
  const m=typeof stable==='string'&&/^solo:([0-9a-z]{1,13}):([0-9a-z]{1,13}):([0-9a-z]{1,13})$/.exec(stable);
  return m?'reward-legacy-wall-'+m[1]+'-'+m[2]+'-'+m[3]:null;
 }
 function save(){
  const wallWipesV2=ad.wall.snapshot();
  if(!wallMatch||!game.player||!wallWipesV2)return;
  const d={id:wallMatch,wall:wallWipesV2.used,wallWipesV2};
  if(match){d.tower=ad.tower?.snapshot()?.used??0;d.vehicles=ad.vehicle?.snapshot()?.mask??0;}
  else d.wallOnly=true;
  game.player.rewardAdV1=d;
 }
 function reset(saved,persistedMatch=null){
  ad.reset();match=null;wallMatch=null;result=null;lobby=null;press=null;manualPanel=null;
  if(!solo())return;
  if(saved){
   const d=game.player.rewardAdV1;
   if(d==null||d.wallOnly===true){
    const id=legacyWallId(persistedMatch);
    if(!id||d&&d.id!==id)return;
    const ok=d?ad.wall.restore({...d.wallWipesV2,id}):ad.wall.start(id);
    if(!ok)return;wallMatch=id;
   }else{
    if(!ad.wall.restore({id:d.id,...(d.wallWipesV2??{used:0,unlocked:false,ordinal:0})}))return;
    match=wallMatch=d.id;ad.tower?.restore({id:d.id,used:d.tower??0});if(lv)ad.vehicle.restore({id:d.id,mask:d.vehicles});
   }
   // Never reoffer pre-save destruction or migrate the old whole-wall journal.
   if(game.buildings.some(b=>ownWall(b)&&b.level>=10))ad.wall.unlock();
  }else{
   match='reward-v1-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e14).toString(36)+'-'+(++seq);
   if(!ad.wall.start(match)){match=null;return;}
   wallMatch=match;ad.vehicle?.start(match);ad.tower?.start(match);
  }
  save();
 }
 function enterResult(kind){
  if(!match||!solo()||!game.player||game.roundStarting||game.roundLoading591||game.ceremony||
   (kind==='win'?game.state!=='win':!game.player.dead))return false;
  const serial=game.playerDeathSerial||0;
  if(result&&result.kind===kind&&result.player===game.player&&result.serial===serial)return true;
  result={kind,serial,player:game.player};ad.enterResults(match);return true;
 }
 function updateLobby(){
  if(!isLobby()){if(lobby!==null){ad.leaveLobby();lobby=null;}return;}
  if(lobby===null){lobby='lobby-'+(++visit);ad.enterLobby(lobby);}
  else ad.lobbyLayoutChanged();
 }
 function returnResult(kind,next){
  if(!enterResult(kind))return false;
  return ad.results.tap(match,()=>{result=null;next();updateLobby();});
 }
 function draw(){
  if(result&&isResult()!==true){ad.leaveResults();result=null;}
  if(game.deathResultsAD?.visible)enterResult('lose');else if(game.state==='win')enterResult('win');
  updateLobby();
  if(manualPanel&&game.saveSlotsPanel!==manualPanel){ad.leaveManual();manualPanel=null;}
  currentFooter=null;wallFooter.invalidate();vehicleFooter?.invalidate();towerFooter?.invalidate();
  if(runtime.hidden)return;
  if(match&&roundLive()&&game.state==='hunt'&&game.huntElapsed>=20&&noModal())ad.warmResults(match);
  const next=ad.wall.offer()?wallFooter:ad.vehicle?.offer()?vehicleFooter:ad.tower?.offer()?towerFooter:null;
  if(roundLive()&&!next){ad.wall.warm();ad.vehicle?.warm();ad.tower?.warm();}
  if(!next)return;
  const blockers=game.buttons.filter(b=>b.visible!==false).concat([game.toastRect,game.getMinimapRect?.()]).filter(b=>b?.w>0&&b?.h>0);
  const j=game.getJoystickRect()?.r,joystick=game.getJoystickRect();if(j)blockers.push({x:joystick.x-j,y:joystick.y-j,w:j*2,h:j*2});
  game.ctx.save();try{game.displayTransform398(game.ctx);if(next.draw(game.ctx,game.uiSafeRect396(),blockers))currentFooter=next;}
  finally{game.ctx.restore();}
 }
 function touch(kind,points){
  const p=points?.length===1?points[0]:null;
  if(kind==='cancel'){press=null;return false;}
  if(kind==='start'){
   if(press){press=null;return true;}
   if(!canOffer()||!p||!currentFooter?.hit(p.clientX,p.clientY))return false;
   press={which:currentFooter,button:currentFooter.hit(p.clientX,p.clientY),x:p.clientX,y:p.clientY,id:p.identifier,bad:false};return true;
  }
  const r=press;if(!r)return false;
  const moved=!p||p.identifier!==r.id||Math.hypot(p.clientX-r.x,p.clientY-r.y)>8;
  if(kind==='move'){r.bad||=moved;return true;}
  press=null;
  if(!r.bad&&!moved&&canOffer()&&r.which===currentFooter&&r.button===r.which.hit(p.clientX,p.clientY))r.which.tap(p.clientX,p.clientY);
  return true;
 }
 function receipt(b,kind){
  const eventId=++seq;losses.set(b,eventId);
  return {unit:b,kind,eventId,own:true,destroyed:true,x:b.x,y:b.y,type:b.type,level:b.level,air:b.airDefenseKindBN};
 }
 function wallLoss(b){
  if(!wallMatch||!roundLive()||!ownWall(b)||!b.dead)return false;
  if(b.level>=10)ad.wall.unlock();
  const offered=ad.wall.lost(receipt(b,'wall'));save();return offered;
 }
 function towerLoss(b){
  if(!match||!roundLive()||!(b instanceof types.Building)||b.ownerSlot!=null||!b.dead||!validKind(b,'tower')||
   b.preview||b.isPreview||b.underConstruction||b.buildTime>0&&b.buildProgress<b.buildTime)return false;
  const offered=ad.tower?.lost(receipt(b,'tower'))??false;save();return offered;
 }

 return {reset,draw,touch,returnResult,enterResult,settlementDiagnostic:()=>adTrace.map(e=>({...e})),dispose(){ad.reset();},
  setupManual(panel){if(config.manualSaveGate!==true||!match||!roundLive())return false;
   manualPanel=panel;panel.adManualBN=true;ad.prepareManual(panel,panel.selected,match);return true;},
  watchManual:(panel,slot,next)=>ad.watchManual(panel,slot,match,next),
  interruptManual:panel=>ad.interruptManual(panel),
  leaveLobby(){if(lobby!==null){ad.leaveLobby();lobby=null;}},
  usesRewardedWalls:()=>!!wallMatch&&solo(),wall:wallLoss,tower:towerLoss,
  wallLevel(b){if(wallMatch&&roundLive()&&ownWall(b)&&!b.dead&&b.level>=10&&ad.wall.unlock())save();},
  wallRemoved(){}, // Native recycling must never create a rewarded destruction.
  vehicle(v){if(!match)return;const receipt=lv?.capture(game,v);if(receipt){ad.vehicle.lost(receipt);save();}}
 };
};
