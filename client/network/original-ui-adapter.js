const {createDefaultClock}=require('./default-monotonic-clock');
const {installPlacementGeometry}=require('./placement-geometry');
const {manualVehicleStep}=require('./manual-vehicle-step');
'use strict';
const {CapturedOwnMotion}=require('./captured-own-motion');
const packetServiceTime=require('./packet-service-time');
const {OwnMotionTrace}=require('./own-motion-trace');
const {completeVision,UnfoggedVisionStore}=require('./unfogged-vision');
const {OwnMotionPreview}=require('./own-motion-preview');
const {RenderPoseClock}=require('./render-pose-clock');
const {RenderScalarClock}=require('./render-scalar-clock');
const {RenderEffectClock}=require('./render-effect-clock');
const {AnimationContentTrace}=require('./animation-content-trace');
const {ActorMotionBuffer}=require('./actor-motion-buffer');
const {SaleUiRecovery,restoreLiveSelections}=require('./sale-ui-recovery');
const {mergeRaidWarnings}=require('./demon-raid-warning');
const {consumeGateFocus}=require('./first-demon-gate-focus');

const {prepareFusedPresentation,prepareFusedPresentationAsync,isStagingData}=require('./presentation-hydrator');
const {prepareInitialAsync:prepareFogAsync,preparedFor:preparedFogFor,releasePreparation}=require('./fog-initial-async');
const {PresentationClock}=require('./presentation-clock');
const {StickCommandBudget}=require('./stick-command-budget');
const SCHEMA=require('./presentation-schema');
const {validateTrustedVision:validateVision}=require('./trusted-vision');
const {FogRasterStore}=require('./fog-raster-store');
const {seatColor,peerSeat,seatPortraits}=require('./seat-colors');
const ACTIONS=new Set('move joystick stop collectWood collectGold returnBase build upgrade sell recruit manufactureTank transformRobot exchange researchTank researchRobot installModule board crewIn crewOut exitTank robotSiege robotFlame robotSuper equipRelic pickupRelic shareRescue continueShareRescue cameraGuide'.split(' '));
const BLOCKED_ACTIONS=Object.freeze(['requestShareRescue','grantShareRescue','grantEarlyWallShareRescue','handleShareRescueTap','restart','victoryExit','save','load','new','beginRound','reset','tutorial']);
const SELECTIONS=['selectedBuilding','builtSelectedBuilding','sellConfirmation','builtSaleConfirmation','rangeInspect548'];
const PLOT_INPUTS=[['tree','trees'],['tree','guardTrees'],['mine','goldMines'],['rock','rocks'],['building','buildings']];
const EMPTY_PLOTS=[];
const MOTION_MS=100, TELEPORT_DISTANCE=160;
const VISUAL_TIMERS=['actionAnim','hurtTimer','relicGuardAnim','relicShieldFlash','flameTimer'];
const NEUTRAL_STICK='0.000,0.000';
const VEHICLE_TRANSITIONS=new Set(['board','exitTank','crewIn','crewOut']);
// Adapter instances are replaced on room exit/re-entry. Keep only the last
// committed scope on the game, so same-round reconnects retain camera intent.
const cameraScopes=new WeakMap();
const blend=(now,at,duration=MOTION_MS)=>Math.max(0,Math.min(1,(now-at)/duration));
// Track only coordinates that can change at this commit. Unknown staging slots
// take the conservative path; inspecting their descriptors never invokes getters.
function captureChangedPositions(prior,next,staged){
 const result=new Map();if(!prior||prior.epoch!==next.epoch)return result;
 for(const [id,entity]of prior.entities){
  const incoming=staged.get(id);if(!incoming)continue;
  const x=entity.x,y=entity.y;if(!Number.isFinite(x)||!Number.isFinite(y))continue;
  if(isStagingData(incoming)){if(incoming.x===x&&incoming.y===y)continue;}
  else{const dx=Object.getOwnPropertyDescriptor(incoming,'x'),dy=Object.getOwnPropertyDescriptor(incoming,'y');
   if(dx&&dy&&Object.hasOwn(dx,'value')&&Object.hasOwn(dy,'value')&&dx.value===x&&dy.value===y)continue;}
  result.set(id,{x,y});
 }
 return result;
}

class OriginalUIAdapter{
 constructor({game,types,input,send,sound=null,createPlotGrid=null,clock=Date.now,monotonic=createDefaultClock(),canPredict=()=>false,fogEnabled=()=>true,engineHash=SCHEMA.ENGINE_HASH,worldFields=SCHEMA.WORLD_FIELDS,entityFields=SCHEMA.ENTITY_FIELDS,onBlocked=()=>{},onExit=null,onRestart=null,onPerformance=null,manualVehicleBlock=()=>false,smoothActorPoses=true,smoothRemoteMotion=true,serverClock=()=>null,motionOptions={},traceContent=false,captureTransport=null,resourceTierVersion=require('./resource-three-tier-config').enabled?1:0}){if(!game||typeof send!=='function')throw Error('INVALID_UI_ADAPTER');Object.assign(this,{game,types,input,send,sound,createPlotGrid,clock,monotonic,canPredict,fogEnabled,engineHash,worldFields,entityFields,onBlocked,onExit,onRestart,onPerformance});this.expectedResourceTierAZ=resourceTierVersion;this.manualVehicleBlock=manualVehicleBlock;this.effectClock=new PresentationClock(clock,monotonic);this.poseClock=new RenderPoseClock();this.capturedMotion=captureTransport?new CapturedOwnMotion({game,types,view:()=>this.view,...captureTransport,clock:monotonic,canPredict,retireInterpolation:body=>{this.renderFrom?.delete(body.networkId);if(body!==this.game.player)this.renderFrom?.delete(this.game.player?.networkId);this.ownMotion?.reset();}}):null;this.scalarClock=new RenderScalarClock();this.effectScalars=new RenderEffectClock(types);this.contentTrace=traceContent?new AnimationContentTrace():null;this.contentTrace?.install(game,types);this.ownMotionTrace=new OwnMotionTrace();this.poseActors=[];this.posePrototypes=new Set(['Player','Ally','Peasant','Troll','Hound','MiniTroll','Tank','Robot'].map(name=>types?.[name]?.prototype).filter(Boolean));this.isPoseActor=e=>!!e&&this.posePrototypes.has(Object.getPrototypeOf(e));this.smoothActorPoses=smoothActorPoses;this.smoothRemoteMotion=smoothRemoteMotion;this.serverClock=serverClock;this.actorClockMode=null;this.actorMotionBuffer=new ActorMotionBuffer(motionOptions);this.saved=new Map();this.active=false;this.seq=0;this.lastStick='0.000,0.000';this.lastStickAt=-Infinity;this.unsentStickIntent=false;this.stickCommandBudget=new StickCommandBudget();this.appliedKeys=new Set();this.worldBackup=new Map();this.uiBackup=new Map();this.visualTracks=new Map();this.visualTimers=[];this.pending=new Map();this.vehicleTransition=null;this.saleUI=new SaleUiRecovery(game,monotonic);}
 patch(name,fn){if(!this.saved.has(name))this.saved.set(name,{own:Object.hasOwn(this.game,name),value:this.game[name]});this.game[name]=fn;}
 block(name){this.onBlocked(name);this.game.showToast?.('联机功能尚未接入：'+name);return false;}
 command(action,args={},target=null){if(!this.active||!this.view||!ACTIONS.has(action))return false;if(action==='build'&&this.game.singleBuildPendingBN?.()){this.game.showToast?.('请等待当前建筑建造完成');return false;}const targetId=target?.networkId;if(target&&!this.view.entities.has(targetId))return this.block('stale target');if(action==='sell'&&this.saleUI.waiting(targetId,this.view.epoch)){this.game.showToast?.('出售已提交，请稍候');return false;}if(action==='joystick'&&!this.stickCommandBudget.allows(this.clock(),!!(args.dx||args.dy)))return false;const transition=VEHICLE_TRANSITIONS.has(action),waiting=this.vehicleTransition;
 if(transition&&waiting&&waiting.epoch===this.view.epoch&&(this.view.lastSeq??-1)<waiting.seq){if(!waiting.noticeShown){waiting.noticeShown=true;this.game.showToast?.('载具切换中，请稍候');}return false;}
 const command={epoch:this.view.epoch,seq:++this.seq,action,args};if(targetId)command.targetId=targetId;const placement=this.game.placement;if(action==='build'&&placement?.pending627){this.seq--;return false;}if(transition)this.vehicleTransition={epoch:command.epoch,seq:command.seq,noticeShown:false};if(action==='sell')this.saleUI.begin(command);this.pending.set(command.seq,{action,placement,args,targetId,selectedId:this.game.selectedBuilding?.networkId,goldGuide:this.game.goldShortageGuideBN?.capture(action,args,target),buildReceipt:action==='build'?{epoch:command.epoch,seq:command.seq,type:args.type,x:args.x,y:args.y,existingIds:(this.game.buildings||[]).map(b=>b.networkId).filter(Boolean)}:null});if(this.pending.size>256)this.pending.delete(this.pending.keys().next().value);try{const result=this.send(command);if(result&&typeof result.catch==='function')result.catch(error=>{if(action==='sell'&&this.view?.epoch===command.epoch){this.saleUI.failed(command.seq,'transport-rejected');this.pending.delete(command.seq);}if(action==='build'&&placement&&this.pending.has(command.seq)&&this.view?.epoch===command.epoch)placement.uncertain627=true;this.onBlocked('command rejected: '+String(error?.message||error));});if(result===false){if(action==='sell')this.saleUI.failed(command.seq);if(this.vehicleTransition?.seq===command.seq)this.vehicleTransition=null;this.pending.delete(command.seq);if(this.seq===command.seq)this.seq--;return false;}if(action==='sell')this.saleUI.submitted(command.seq);this.saleUI.input(command);this.capturedMotion?.semantic(command);if(['move','collectWood','collectGold','returnBase','board','exitTank'].includes(action))this.ownMotion?.retireForAuthorityAction(command,this.clock());if(action==='stop')this.ownMotion?.command({...command,args:{dx:0,dy:0}});if(action==='joystick'){this.stickCommandBudget.record(this.clock());(this.ownMotion||(this.ownMotion=new OwnMotionPreview())).command(command);}if(action==='build'){this.singleBuildReceiptBN={epoch:command.epoch,seq:command.seq};if(placement)placement.pending627=true;}return true;}catch(error){if(action==='sell')this.saleUI.failed(command.seq);if(this.vehicleTransition?.seq===command.seq)this.vehicleTransition=null;this.pending.delete(command.seq);if(this.seq===command.seq)this.seq--;this.onBlocked('command rejected: '+String(error?.message||error));return false;}}
 acknowledge({epoch,seq,ok,error,moveMarker,tick}){if(!this.view||epoch!==this.view.epoch)return false;this.saleUI.acknowledge({epoch,seq,ok});const p=this.pending.get(seq);if(!p)return false;this.ownMotion?.acknowledge({epoch,seq,ok,tick});if(this.vehicleTransition?.epoch===epoch&&this.vehicleTransition.seq===seq&&(!ok||(this.view.lastSeq??-1)>=seq))this.vehicleTransition=null;this.pending.delete(seq);if(p.action==='build'&&p.placement){p.placement.pending627=p.placement.uncertain627=false;if(!ok)p.placement.rejected627={x:p.args.x,y:p.args.y,message:error||'服务器未接受建造'};}if(!ok){if(p.action==='build'&&this.singleBuildReceiptBN?.seq===seq)this.singleBuildReceiptBN=null;if(p.action==='build'&&p.placement&&this.game.placement===p.placement&&/资源不足|金币不足|木材不足/.test(error||''))this.game.rejectInsufficientBuildBN?.(p.placement);this.game.toast={text:error||'服务器未接受此操作',time:/资源不足|金币不足|木材不足/.test(error||'')?1500:3000};this.game.goldShortageGuideBN?.failure(p.goldGuide,error,{online:true});return true;}if(p.goldGuide)this.game.goldShortageGuideBN?.success();if(p.action==='build'&&p.placement&&this.game.placement===p.placement){this.game.placement={...p.placement,stage:'aim',pending627:false,uncertain627:false,rejected627:null,buildQueueContinuationBN:true,buildQueueReceiptBN:p.buildReceipt};this.game.finishPlacementCamera?.(p.placement);this.game.updatePlacement?.();this.game.buildResourceGateBN?.authority(this.view);}if(p.action==='upgrade'&&this.game.selectedBuilding?.networkId===p.selectedId)this.game.selectedBuilding=null;
  if(['move','joystick','stop'].includes(p.action)){
   const held=this.input?.stick;
   if((p.action==='stop'||p.action==='joystick'&&!(p.args?.dx||p.args?.dy))&&!(held?.active&&(held.dx||held.dy)))this.unsentStickIntent=false;
   this.confirmedMoveMarker=null;
   if(p.action==='move'&&moveMarker&&[moveMarker.x,moveMarker.y,moveMarker.time].every(Number.isFinite)&&moveMarker.time>0&&moveMarker.time<=700){
    this.confirmedMoveMarker={epoch,x:moveMarker.x,y:moveMarker.y,until:this.monotonic()+moveMarker.time};
   }
  }
  this.game.wxUiDirty=true;
  // Once an ordered command drains, sample current intent now rather than
  // waiting for another drawing frame. Never replay a captured old vector.
  if(this.unsentStickIntent)this.sendStick();
  return true;
 }
 drawWithMoveFeedback(draw,args){
  const marker=this.confirmedMoveMarker,game=this.game;
  if(!marker)return draw.apply(game,args);
  const remaining=marker.until-this.monotonic();
  if(!this.active||marker.epoch!==this.view?.epoch||remaining<=0){
   this.confirmedMoveMarker=null;
   return draw.apply(game,args);
  }
  const authoritative=game.moveMarker;
  if(authoritative?.x===marker.x&&authoritative?.y===marker.y){
   this.confirmedMoveMarker=null;
   return draw.apply(game,args);
  }
  game.moveMarker={x:marker.x,y:marker.y,time:remaining};
  try{return draw.apply(game,args);}
  finally{game.moveMarker=authoritative;}
 }
 activate(){if(this.active)return;this.active=true;const g=this.game;installPlacementGeometry(g);g.setNetworkRenderDensity627?.(true);this.patch('toast',{text:'',time:0});for(const k of [...SELECTIONS,'placement','buildMenu','relicPanel','buttons','returnActivityTask586','firstAttackGuideActive','warningCardShownAt449','warningCardSlots448','warningCardMotions448','tutorial','endlessOpeningIntro','buildingMapFocus','firstAttackCameraFocus','demonAttackFocus545','pendingDemonFocus545','demonRetreatBannerUntil','firstGateHintAB'])this.uiBackup.set(k,{own:Object.hasOwn(g,k),value:g[k]});g.tutorial=null;g.endlessOpeningIntro=null;g.firstAttackCameraFocus=g.demonAttackFocus545=g.buildingMapFocus=null;g.warningCardShownAt449=g.warningCardSlots448=g.warningCardMotions448=null;if(Array.isArray(g.buttons))g.buttons=g.buttons.map(b=>['restart','victoryExit'].includes(b.id)?{...b,text:'返回队伍房间'}:b);this.patch('networkRestartLabel627',()=> '返回队伍房间');this.patch('networkGateFocusAB',true);g.firstGateHintAB=null;
 this.patch('openSaveSlots',()=>{g.showToast?.('联机对局由房间服务器管理，暂不支持保存为单机档案');return Promise.resolve(false);});
 // No original gameplay update, AI, projectile update, rescue, rewards, or economy
 // executes here. Rendering and the original input/menu layout remain local.
 this.patch('networkOwnerLabel627',(slot,ownerId)=>{const roster=this.view?.roster||[],row=ownerId?roster.find(r=>r.ownerId===ownerId):slot==null?roster.find(r=>r.ownerId===this.view?.viewerOwnerId):roster.find(r=>r.seat===(slot===-2?0:slot+1));if(!row)return '队友';return((row.kind==='ai'?'电脑':'玩家')+(row.seat+1))+(row.ownerId===this.view?.viewerOwnerId?'（你）':'');});
 this.patch('update',dt=>{const start=this.monotonic();try{return this.presentationStep(dt);}finally{this.onPerformance?.('logicJsMs',this.monotonic()-start);}});this.patch('easyOpeningGuideAdvance',()=>{});
 for(const name of ['openingGuideAdvice','easyOpeningGuideAdvice','developmentAdvice396','easyOpeningEconomyAdvice','easyOpeningAttackAdvice'])this.patch(name,()=>this.view?.publicGuideAdvice||null);
 this.patch('easyOpeningEconomyPending',()=>!!g.easyOpeningGuideEnabled?.()&&g.easyOpeningGuideStage===10&&!g.easyEconomyReady);
 this.patch('guidedRepairMission399',()=>{const m=g.developmentGuide396?.repair399?.active,v=m?.vehicle;return g.easyOpeningGuideEnabled?.()&&(g.easyOpeningGuideStage||0)>=10&&v&&!v.dead&&v.hp>0&&v.ownerSlot==null&&g.tanks?.includes(v)?m:null;});
 // Camera follows the same local foot intent as the positional preview.
 // Awaiting the server's stickDriven flag creates an initial dead-zone then
 // an abrupt recenter. The authoritative flag is restored even on failure.
 const updateCamera=g.updateCamera;
 if(typeof updateCamera==='function')this.patch('updateCamera',(...args)=>{
  const p=g.player,stick=this.input?.stick,hasPreview=this.ownMotion?.state?.entity===(p?.drivingTank||p)||this.capturedMotion?.hasPreviewFor(p?.drivingTank||p);
  const local=p&&!p.dead&&!p.inTank&&(!p.drivingTank||p.drivingTank.driver===p&&!p.drivingTank.dead)&&(stick?.active||hasPreview)&&(!p.task||stick?.active||this.capturedMotion?.hasPreviewFor(p.drivingTank||p))&&!g.sessionMenuOpen&&!g.demonPanel&&!g.relicPanel&&!g.placement&&!g.buildMenu&&!g.cameraPeek&&this.canPredict();
  if(!local)return updateCamera.apply(g,args);
  const own=Object.hasOwn(p,'stickDriven'),saved=p.stickDriven;p.stickDriven=hasPreview||!!(stick?.active&&(stick.dx||stick.dy));
  try{return updateCamera.apply(g,args);}finally{if(own)p.stickDriven=saved;else delete p.stickDriven;}
 });
 const drawEndScreen=g.drawEndScreen;if(typeof drawEndScreen==='function')this.patch('drawEndScreen',(title,color)=>drawEndScreen.call(g,g.state==='lose'&&g.loseReason==='teamDestroyed587'?'失败！队员已全部倒下':title,color));
 const draw=g.draw;
 this.patch('draw',(...args)=>{
  this.presentationStep(0);
  const now=this.clock(),depth=this.renderRestoreDepth||0;
  const pool=this.renderRestorePool||(this.renderRestorePool=[]),restore=pool[depth]||(pool[depth]=[]);
  restore.length=0;this.renderRestoreDepth=depth+1;
  const place=(entity,x,y)=>{restore.push(entity,entity.x,entity.y);entity.x=x;entity.y=y;};
  try{
   const ownAuthority=this.game.player?{x:this.game.player.x,y:this.game.player.y}:null;const preview=this.previewPlayerPosition(now);
   if(now<this.motionUntil)for(const [id,from] of this.renderFrom||[]){
    const alpha=blend(now,from.at??this.interpolationAt,from.duration),entity=this.view?.entities.get(id);
    if(preview&&(entity===g.player||entity===preview.vehicle))continue;
    if(this.smoothRemoteMotion&&this.actorMotionBuffer.has(id))continue;
    if(alpha>=1||!entity||!Number.isFinite(entity.x)||!Number.isFinite(entity.y)||
       Math.hypot(entity.x-from.x,entity.y-from.y)>TELEPORT_DISTANCE)continue;
    place(entity,from.x+(entity.x-from.x)*alpha,from.y+(entity.y-from.y)*alpha);
   }
   if(this.smoothRemoteMotion&&this.view)this.actorMotionBuffer.forEach(this.view.entities,this.actorClockMode==='service'?(this.serverClock()??this.actorMotionBuffer.lastAt):now,place,(e,dx,dy)=>g.networkPreviewPosition627?.(e,dx,dy,true));
   if(preview){
    if(preview.vehicle)place(preview.vehicle,preview.x,preview.y);
    place(g.player,preview.x,preview.y);
   }
   let result,scalarRestore=null,poseRestore=null,effectRestore=null,contentStarted=false,contentComplete=false;const previewStarted=this.monotonic();try{scalarRestore=this.scalarClock.begin(g,this.view,this.monotonic(),e=>this.smoothRemoteMotion?this.actorMotionBuffer.renderTick(e.networkId,this.actorClockMode==='service'?(this.serverClock()??this.actorMotionBuffer.lastAt):now):null);poseRestore=this.smoothActorPoses?this.poseClock.begin(this.poseActors,this.view?.epoch,this.monotonic(),preview?{entity:preview.vehicle||g.player,animate:this.types.Entity?.prototype?.animTrack,fromX:ownAuthority?.x,fromY:ownAuthority?.y,intentX:preview.intentX,intentY:preview.intentY,manualStop:preview.manualStop===true}:null):null;effectRestore=this.effectScalars.begin(g,this.view,this.monotonic(),this.scalarClock.renderTime);contentStarted=this.contentTrace?.begin(this.view,this.monotonic())===true;result=draw.apply(g,args);contentComplete=true;this.saleUI.drawn();}finally{if(contentStarted)this.contentTrace.end(this.monotonic(),!contentComplete);if(effectRestore)this.effectScalars.end(effectRestore);if(poseRestore)this.poseClock.end(poseRestore);if(scalarRestore)this.scalarClock.end(scalarRestore);}
   if(ownAuthority&&g.player&&this.view)this.ownMotionTrace.record(this.view.roomId+':'+this.view.viewerOwnerId+':'+this.view.epoch,{atMs:now,tick:this.view.tick,confirmedSeq:this.predictionLastSeq,intentSeq:this.ownMotion?.intentSeq,handoffSeq:this.ownMotion?.handoffSeq,handoffAction:this.ownMotion?.handoffAction,authorityX:ownAuthority.x,authorityY:ownAuthority.y,displayX:g.player.x,displayY:g.player.y,cameraX:g.camera?.x,cameraY:g.camera?.y,pendingFrames:this.ownMotion?.state?.frames?.length||0,recoveryKind:this.ownMotion?.state?.authorityRecovery,manualStopRecovery:preview?.manualStop===true,moving:!!(this.input?.stick?.active&&(this.input.stick.dx||this.input.stick.dy)),predictionActive:!!preview&&!preview.frozen,identityMatches:this.view.entities.get(g.player.networkId)===g.player,blockedReason:this.predictionBlockedReason});
   // Keep the legacy grab-to-preview interval distinct from movement intent.
   // Record only after a successful canvas draw, not after a failed frame.
   if(preview&&Number.isFinite(this.stickGrabAt)){
    this.onPerformance?.('localFeedbackMs',previewStarted-this.stickGrabAt);
    if(Number.isFinite(this.stickIntentAt))this.onPerformance?.('stickIntentToDrawMs',this.monotonic()-this.stickIntentAt);
    this.stickGrabAt=this.stickIntentAt=null;
   }
   return result;
  }finally{
   try{for(let i=restore.length-3;i>=0;i-=3){const entity=restore[i];entity.x=restore[i+1];entity.y=restore[i+2];}}
   finally{restore.length=0;this.renderRestoreDepth=depth;}
  }
 });
 this.patch('drawSmoothFrame',(_alpha,time)=>g.draw(false,time));
 // Online draw blends authoritative targets; the solo snapshot and camera pass are redundant.
 this.patch('captureRenderPrevious',()=>{});this.patch('networkDrawCamera627',true);
 // Static minimap inputs change on authority commits. If a map object is
 // interpolating, let the original signature run until the motion ends.
 this.patch('networkMinimapCheck627',null);
 this.patch('networkMinimapStateKey627',()=>this.clock()<this.minimapMotionUntil?null:this.view);
 this.patch('networkMiniPortraits627',()=>this.miniPortraits);
 this.patch('networkElfColor627',entity=>this.elfColors?.get(entity)||(Number.isInteger(entity?.ownerSlot??entity?.slot)?seatColor(peerSeat(entity.ownerSlot??entity.slot)):null));
 this.patch('networkSeatColor627',slot=>{const seat=slot==null?this.selfSeat:peerSeat(slot);return seat==null?null:seatColor(seat);});
 this.patch('onStickGrab',()=>{
  g.rotationHold396=0;g.manualCamera394=false;
  this.observeStickFeedback(true);this.sendStick({grab:true});
 });
 this.patch('onStickVectorChange627',()=>{this.observeStickFeedback();this.sendStick();});
 this.patch('setMoveTarget',(x,y)=>this.command('move',{x,y}));
 this.patch('singleBuildPendingBN',()=>!!this.singleBuildReceiptBN||[...this.pending.values()].some(p=>p.action==='build')||(g.getPlayerBuildQueueBN?.().length||0)>0);
 this.patch('requestPlayerBuild506',(type,_w,_g,x,y)=>{const kind=g.placement?.airDefenseKindBN;const buildType=type==='tower'&&kind?(kind==='antiAir'?'antiAirTowerBN':'netTowerBN'):type;if(!this.command('build',{type:buildType,x,y,siteIdAC:g.placementGeometryAC.site(type,x,y).id}))g.showToast?.('暂时无法提交建造，请重试');return false;});
 for(const[name,action]of Object.entries({tryUpgradeBuilding:'upgrade',trySellBuilding:'sell',tryMakePeasant:'recruit',tryManufactureTank:'manufactureTank',tryTransformTankToRobot:'transformRobot',tryCallCrew:'crewIn',tryCrewOut:'crewOut',pickupDragonDrop:'pickupRelic'}))this.patch(name,target=>{if(action==='upgrade'){const reason=g.buildingUpgradeBlockReason(target);const cost=target?.upgradeCost?.();if(reason||!target?.canUpgrade?.()||!cost){if(reason)g.showToast?.(reason);return false;}if(g.player.wood<cost.wood||g.player.gold<cost.gold){g.showToast?.(`升级需要 木${cost.wood} 金${cost.gold}`);return false;}}this.command(action,{},target);return false;});
 for(const[name,action]of Object.entries({tryResearchTankTech:'researchTank',tryResearchRobotTech:'researchRobot',tryInstallTankModule:'installModule'}))this.patch(name,(kind,target)=>{const reason=action==='researchRobot'?g.robotTechBlockReason(kind,target):action==='researchTank'?g.tankTechBlockReason(kind,target):null;if(reason){g.showToast?.(reason);return false;}if(action==='installModule'&&g.tankModules?.[kind])return false;this.command(action,{kind},target);return false;});
 this.patch('tryExchange',(target,direction,batches)=>{this.command('exchange',{direction,...(batches===undefined?{}:{batches})},target);return false;});
 this.patch('equipDragonRelic',(target,kind)=>{this.command('equipRelic',{kind},target);return '等待服务器确认';});
 this.patch('onButtonClick',id=>this.button(id));this.patch('incomingAttackWarningStates',()=>mergeRaidWarnings(g,this.view?.publicWarnings.map(w=>{const zone=g.resourceZones?.[w.zoneIndex];return zone?{...w,zone,target:this.view.entities.get(w.targetId)||{x:zone.gateX,y:zone.gateY},source:this.view.entities.get(w.sourceId)}:null;}).filter(Boolean)||[],this.view?.worldView?.demonRaidWarning,!g.superChallenge580&&(this.view?.roster?.length||0)>1));
 this.patch('allyEconomyInfo',b=>{const seat=b?.ownerSlot===-2?0:b?.ownerSlot+1,owner=this.view?.roster.find(r=>r.seat===seat),data=this.view?.publicTeamData.find(r=>r.ownerId===owner?.ownerId);return data?{title:g.networkOwnerLabel627(b.ownerSlot)+' · 经济信息',subtitle:data.profile+' · '+data.status,rows:data.rows.economy}:null;});
 this.patch('openAllyDataPanel',()=>{g.allyDataPanel={slot:this.view?.publicTeamData[0]?.slot??0,tab:'economy',page:0,data:this.view?.publicTeamData||[]};g.sessionMenuOpen=true;g.demonPanel=g.selectedBuilding=g.placement=null;g.relicPanel=g.buildMenu=false;this.suspend();g.wxUiDirty=true;});
 for(const[name,layout,title,color]of [['drawAllyDataPanel','allyDataLayout','队友数据 · 对局继续进行','#203B31'],['drawDemonPanel','demonPanelLayout','恶魔 / 龙信息 · 对局继续进行','#243B33']]){const original=g[name];if(typeof original==='function')this.patch(name,(...args)=>{const result=original.apply(g,args);if(name==='drawAllyDataPanel'?!g.allyDataPanel:!g.demonPanel)return result;const L=g[layout](),c=g.ctx;c.save();c.fillStyle=color;c.fillRect(L.x+6,L.y+15,L.w-12,28);c.fillStyle='#eef4dd';c.textAlign='center';c.font='bold 15px sans-serif';c.fillText(title,L.x+L.w/2,L.y+36,L.w-20);c.restore();return result;});}
 const menu=g.sessionMenuButtons;if(typeof menu==='function')this.patch('sessionMenuButtons',(...args)=>menu.apply(g,args).filter(b=>!['save','load','new','superChallenge'].includes(b.id)));
 for(const name of ['requestShareRescue','grantShareRescue','grantEarlyWallShareRescue','handleShareRescueTap','beginRound','reset','startEasyAfterTutorial','beginTutorialBattle'])this.patch(name,()=>this.block(name));
 const tap=g.handleTap;this.patch('handleTap',(x,y)=>{if(!this.view)return false;if(g.tutorial)return this.block('tutorial');if(g.state==='start')return false;return tap.call(g,x,y);});
 // Ordinary session-menu exit has an inline reset branch. Filter all actions not
 // explicitly local so it cannot restart/leave authority from a display tap.
 const safe=new Set(['showFps','showNetwork','sound','soundBack','joystickMode','orientationPortrait','orientationLandscape','orientationMode','soundToggle','volume','volumeDown','volumeUp','demonInfo','allyInfo','resume']);
 const filtered=g.sessionMenuButtons;if(typeof filtered==='function')this.patch('sessionMenuButtons',(...args)=>filtered.apply(g,args).filter(b=>safe.has(b.id)));
 }
 button(id){const g=this.game,ended=g.state==='win'||g.state==='lose',endAction=ended&&['restart','victoryExit','victoryShare'].includes(id);if(!endAction&&(g.endlessOpeningIntro||g.player?.dead&&id!=='restart'))return false;this.sound?.play?.('ui',null,{ui:true,world:g});if(['collectWood','collectGold','returnBase','exitTank','robotSiege','robotFlame','robotSuper'].includes(id))return this.command(id);if(id==='driveTank'){const target=g.availablePlayerVehicle512();return target?this.command('board',{},target):false;}if(id==='callCrew'||id==='crewOut'){const target=g.nearbyTank();return target?this.command(id==='callCrew'?'crewIn':'crewOut',{},target):false;}if(id==='moreBuilds'){if(g.buildMenu)g.buildMenu=false;else g.openBuildMenu();return true;}if(typeof id==='string'&&id.startsWith('build:'))return g.startBuildFromCatalog(id.slice(6));if(id==='equipDragonRelic'){g.relicPanel=true;g.selectedBuilding=g.placement=null;g.buildMenu=false;return true;}if(id==='victoryShare')return g.shareVictory559();if(['win','lose'].includes(g.state)){if(id==='restart'&&this.onRestart)return this.onRestart();if(['victoryExit','restart'].includes(id)&&this.onExit)return this.onExit();}return this.block(id);}
 async prepareAsync(packet,scene=null,options={}){
  if(typeof this.createPlotGrid!=='function')throw Error('MISSING_ORIGINAL_PLOT_FACTORY');
  const keepGoing=options.keepGoing||(()=>this.active),settings={...options,clock:options.clock||this.monotonic,keepGoing};
  validateVision(packet.vision,packet.tick);
  const plan=await prepareFusedPresentationAsync(packet,this.types,this,this.view,settings);
  const scope={roomId:packet.roomId,epoch:packet.epoch,viewerOwnerId:packet.viewerOwnerId};
  let fogStore=null;
  try{
   const prior=this.fogStore?.identity;
   if((this.fogEnabled()||!completeVision(packet.vision))&&(!prior||this.fogStore?.unfogged||['roomId','epoch','viewerOwnerId'].some(k=>prior[k]!==scope[k])))fogStore=await prepareFogAsync(packet.vision,scope,settings);
   if(!keepGoing()){const error=Error('PRESENTATION_PREPARATION_CANCELLED');error.cancelled=true;throw error;}
   return {plan,fogStore,packet,scene,dispose(){this.fogStore?.dispose();this.fogStore=null;}};
  }catch(error){fogStore?.dispose();throw error;}
 }
 apply(packet,scene=null,prepared=null){if((packet?.worldView?.resourceThreeTierVersionAZ||0)!==this.expectedResourceTierAZ)throw Error('RESOURCE_TIER_BACKEND_UPDATE_REQUIRED');if(typeof this.createPlotGrid!=='function')throw Error('MISSING_ORIGINAL_PLOT_FACTORY');if(prepared&&(prepared.packet!==packet||prepared.scene!==scene))throw Error('PRESENTATION_PLAN_STALE');const plan=prepared?.plan||prepareFusedPresentation(packet,this.types,this,this.view),next=plan.view;next.roomId=packet.roomId;next.lastSeq=packet.lastSeq;if(scene)Object.assign(next.worldView,require('./presentation-scene').sceneWorld(scene,packet));validateVision(next.vision,next.tick);if(this.view&&(next.viewerOwnerId!==this.view.viewerOwnerId||next.epoch<this.view.epoch))throw Error('PRESENTATION_IDENTITY_MISMATCH');if(this.view&&next.epoch===this.view.epoch&&next.revision<=this.view.revision)return false;
 const preparedFog=prepared?.fogStore,scope={roomId:packet.roomId,epoch:next.epoch,viewerOwnerId:next.viewerOwnerId};
 if(preparedFog){const target=preparedFogFor(preparedFog);if(!target||target.vision!==next.vision||['roomId','epoch','viewerOwnerId'].some(k=>target.scope[k]!==scope[k]))throw Error('FOG_PREPARATION_STALE');}
 const commitClock=this.effectClock.prepare(plan.clockView);const g=this.game,prior=this.view,selections=Object.fromEntries(SELECTIONS.map(k=>[k,g[k]?.networkId]));const oldPositions=captureChangedPositions(prior,next,plan.clockView.entities),rebindDemonPanel=!!g.demonPanel&&g.demonPanel.target===g.troll;
 for(const k of Object.keys(next.worldView))if(typeof g[k]==='function')throw Error('PRESENTATION_METHOD_OVERWRITE');
 if(!next.worldView.player)throw Error('PRESENTATION_PLAYER_MISSING');this.saleUI.applying();plan.commit();commitClock();
 const wireRocks=packet.worldView.rocks;
 if(prior&&next.epoch===prior.epoch&&next.worldView.rocks!==prior.worldView.rocks&&
    (wireRocks&&Object.isFrozen(wireRocks)&&wireRocks===this.wireRocks||
     JSON.stringify(next.worldView.rocks)===JSON.stringify(prior.worldView.rocks))){
  next.worldView.rocks=prior.worldView.rocks;
 }
 this.wireRocks=wireRocks;
  for(const k of [...this.worldFields,'plots','clues','spawnClearCells','troll','trollBase','fogVisible','fogExplored','fogCols','fogRows','fogEnabled','fogRevision','fogVisionRevision','fogFixedCoverage'])if(!this.worldBackup.has(k))this.worldBackup.set(k,{own:Object.hasOwn(g,k),value:g[k]});
 for(const k of this.worldFields)if(!Object.hasOwn(next.worldView,k))delete g[k];
 const localPending=prior?.epoch===next.epoch?g.pendingDemonFocus545:null;Object.assign(g,next.worldView);g.pendingDemonFocus545=localPending;const focus=next.publicDemonFocusEvent,focusNew=focus&&(this.demonFocusEpoch!==next.epoch||focus.serial>(this.demonFocusSerial||0));if(focusNew){this.demonFocusEpoch=next.epoch;this.demonFocusSerial=focus.serial;}g.returnActivityTask586=next.worldView.returnActivityMatchesTask?g.player.task:null;g.endlessOpeningIntro=null;if(!Object.hasOwn(next.worldView,'clues'))g.clues=[];
 this.predictionLastSeq=Number.isSafeInteger(packet.lastSeq)?packet.lastSeq:0;this.packetServiceTime=packetServiceTime.get(packet)?.serverTimeMs??null;
 this.refreshPlotIndex(next.epoch);
 this.retargetMotion(prior,next,oldPositions,this.clock());
 this.appliedKeys=new Set(Object.keys(next.worldView));this.view=next;if(this.vehicleTransition&&(this.vehicleTransition.epoch!==next.epoch||next.lastSeq>=this.vehicleTransition.seq))this.vehicleTransition=null;this.trackVisualTimers(next);this.scalarClock.commit(next,this.monotonic(),this.poseActors,this.visualTimers);this.effectScalars.commit(next,this.monotonic(),this.motionInterval??100);if(!prior||next.epoch!==prior.epoch){this.localLead=null;this.unsentStickIntent=false;this.seq=Number.isSafeInteger(packet.lastSeq)?packet.lastSeq:0;if(this.game.placement){this.game.placement.pending627=false;this.game.placement.uncertain627=false;this.game.placement.rejected627=null;}this.pending.clear();this.hiddenViews?.clear();this.localFirstAttackFocusShown=false;g.placement=null;g.buildMenu=false;g.relicPanel=false;}
 if(g.allyDataPanel)g.allyDataPanel.data=next.publicTeamData;this.syncVisuals(next);this.seq=Math.max(this.seq,Number.isSafeInteger(packet.lastSeq)?packet.lastSeq:0);
 restoreLiveSelections(g,next.entities,selections);if(this.singleBuildReceiptBN&&(this.singleBuildReceiptBN.epoch!==next.epoch||(next.lastSeq>=this.singleBuildReceiptBN.seq&&!(g.getPlayerBuildQueueBN?.().length||0))))this.singleBuildReceiptBN=null;g.buildResourceGateBN?.authority(next);
 for(const k of ['buildingMapFocus','firstAttackCameraFocus','demonAttackFocus545']){const focus=g[k];if(focus?.building){const building=next.entities.get(focus.building.networkId);g[k]=building?{...focus,building}:null;}else if(focus?.networkId)g[k]=next.entities.get(focus.networkId)||null;else if(!focus||k==='buildingMapFocus'||!Number.isFinite(focus.x)||!Number.isFinite(focus.y))g[k]=null;}
 for(const e of next.entities.values())if(e instanceof this.types.MiniTroll)e.syncProgression402=()=>{};
 // Missing enemies are not dead: a local neutral view cannot signal victory.
 for(const[k,type]of [['troll','Troll'],['trollBase','TrollBase']])if(!g[k])g[k]=this.hidden(type);
 if(rebindDemonPanel)g.demonPanel.target=g.troll;
 if(next.publicCombatHud){const hud=next.publicCombatHud;g.demonRetreatBannerUntil=this.clock()+(hud.retreatBannerRemainingMs||0);Object.assign(g.troll,hud.troll);g.troll.getDamage=()=>hud.troll.damage;Object.assign(g.trollBase,hud.base);this.patch('enemyCombatHud',()=>hud.details);if(hud.infoEquipment&&hud.infoSkills)this.patch('demonInfoRows',(tab=g.demonPanel?.tab)=>tab==='skills'?hud.infoSkills:hud.infoEquipment);}
 for(const k of ['frameHostiles','allyEconomyCache','renderPrevious'])g[k]=null;
 // Do not run the local cinematic over a live match: it suppresses movement.
 g.endlessOpeningIntro=null;
 const portraits=seatPortraits(g,next.roster,next.viewerOwnerId,this.types.Player);this.selfSeat=portraits.selfSeat;this.miniPortraits=portraits.markers;this.elfColors=new Map(portraits.markers.map(({entity,color})=>[entity,color]));
 // Keep native raster identity across snapshots. Only actual visibility changes
 // invalidate the original main-view/minimap pixels; source motion has its own revision.
 const previousFog=this.fogStore,useUnfogged=!this.fogEnabled()&&completeVision(next.vision),fog=useUnfogged?(previousFog?.unfogged?previousFog:new UnfoggedVisionStore()):(preparedFog||(!previousFog?.unfogged&&previousFog)||new FogRasterStore());if(fog!==preparedFog)fog.applyValidated(next.vision,scope);this.fogStore=fog;if(preparedFog){prepared.fogStore=null;if(fog===preparedFog)releasePreparation(fog);else preparedFog.dispose();}if(previousFog&&previousFog!==fog)previousFog.dispose();
 this.patch('fogStateAtWorld',(x,y)=>fog.stateAt(x,y));this.patch('fogVisionSources',()=>fog.sources);
 const {fogVisionSources,...fogBindings}=fog.bindings();Object.assign(g,fogBindings);g.fogEnabled=this.fogEnabled();
 const cameraScope=cameraScopes.get(g),changed=!cameraScope||['roomId','epoch','viewerOwnerId'].some(k=>cameraScope[k]!==scope[k]);
 if(changed&&['prep','hunt'].includes(g.state)&&!g.player.dead){
  g.stopSpectator587?.();g.manualCamera394=false;g.cameraPeek=null;
  for(const key of ['buildingMapFocus','firstAttackCameraFocus','demonAttackFocus545'])g[key]=null;
  for(const key of ['cameraPan','cameraRecenter'])if(g[key])g[key].x=g[key].y=0;
  const input=this.input;if(input){
   for(const key of ['active','panning','spectatorDrag588','minimapPeek','panCandidate396','panMoved396','wxMenuTap','savePanelTap','roundLoading591','volumeDrag514','buildMenuScrollMoved'])input[key]=false;
   input.dx=input.dy=0;input.buildMenuGesture=input.placementButtonGesture=null;
   if(input.stick){input.stick.active=false;input.stick.dx=input.stick.dy=0;input.stick.originX=input.stick.originY=null;}
   if(input.pinch){input.pinch.active=false;input.pinch.id0=input.pinch.id1=null;}
  }
  g.centerCameraOnPlayer?.();
 }
 cameraScopes.set(g,scope);if(focusNew)consumeGateFocus(g,focus,scope,next.tick,this.input);g.wxUiDirty=true;this.saleUI.commit(next);return true;}
 refreshPlotIndex(epoch){
  const g=this.game,cache=this.plotIndex,lists=PLOT_INPUTS.map(([,key])=>g[key]||EMPTY_PLOTS);
  // Hydration can reuse an entity and mutate it in place; retain its previous
  // geometry separately so a move, death, or replacement invalidates the index.
  if(cache?.epoch===epoch&&cache.plots===g.plots&&cache.guards===g.guardTreeBuckets&&cache.clear===g.spawnClearCells&&lists.every((list,n)=>{
   const old=cache.geometry[n],building=n===4;
   return list.length*4===old.length&&list.every((e,i)=>{const k=i*4;return e===old[k]&&e.x===old[k+1]&&e.y===old[k+2]&&(!building||((e.dead?1:0)|(e.isInitialBase?2:0))===old[k+3]);});
  }))return false;
  const plots=this.createPlotGrid(),clear=new Set(),geometry=[];
  for(let n=0;n<lists.length;n++){
   const rows=[],kind=PLOT_INPUTS[n][0];geometry.push(rows);
   for(const e of lists[n]){
    rows.push(e,e.x,e.y,n===4?((e.dead?1:0)|(e.isInitialBase?2:0)):0);
    if(n===4){if(!e.dead)plots.addBuilding(e.x,e.y,e);if(e.isInitialBase)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)clear.add(plots.keyOf(e.x+dx*90,e.y+dy*90));}
    else{const spot=plots.claim(e.x,e.y,kind);if(spot)plots.setRef(spot.key,e);}
   }
  }
  // Buildings/resources can invalidate plots without changing forest geometry.
  // Keep all original navigation/cache resets; skip only identical forest bucketing.
  const oldGuards=cache?.geometry?.[1],guards=lists[1];
  const reuseGuards=cache?.epoch===epoch&&cache.guards===g.guardTreeBuckets&&!!oldGuards
   &&guards.length*4===oldGuards.length&&guards.every((e,i)=>e===oldGuards[i*4]&&e.x===oldGuards[i*4+1]&&e.y===oldGuards[i*4+2]);
  g.plots=plots;g.spawnClearCells=clear;g.rebuildGuardTreeBuckets?.(reuseGuards);
  this.plotIndex={epoch,plots,clear,guards:g.guardTreeBuckets,geometry};return true;
 }
 retargetMotion(prior,next,oldPositions,now){
  const clockMode=Number.isFinite(this.packetServiceTime)&&Number.isFinite(this.serverClock())?'service':'receipt';if(this.actorClockMode!==clockMode){this.actorMotionBuffer.reset();this.actorClockMode=clockMode;}const actorAt=clockMode==='service'?this.packetServiceTime:now;
  const old=this.renderFrom,at=this.interpolationAt,result=new Map();let newest=-Infinity,until=-Infinity;
  if(this.smoothRemoteMotion)this.actorMotionBuffer.update(prior,next,oldPositions,actorAt,new Set([this.game.player,this.game.player?.drivingTank,next.worldView?.player,next.worldView?.player?.drivingTank]),this.isPoseActor);else if(this.actorMotionBuffer.epoch!==null)this.actorMotionBuffer.reset();
  const same=prior&&prior.epoch===next.epoch;
  if(!same){this.motionSnapshotAt=null;this.motionInterval=null;}
  // Match the cadence of advancing snapshots, not receipts at the same tick.
  // Reaching each point long before the next one arrives looks like a brief stop.
  if(Number.isSafeInteger(next.tick)&&(!same||next.tick>prior.tick)){
   if(this.motionSnapshotAt!=null){
    const interval=now-this.motionSnapshotAt;
    if(interval>=35&&interval<=1000){const sample=Math.max(90,Math.min(320,interval));
     this.motionInterval=this.motionInterval==null?sample:this.motionInterval*.75+sample*.25;}
   }
   this.motionSnapshotAt=now;
  }
  const duration=this.motionInterval??MOTION_MS;
  if(prior&&prior.epoch===next.epoch){
   for(const [id,from]of old||[]){
    const start=from.at??at,e=next.entities.get(id);
    const end=start+(from.duration??MOTION_MS);
    if(e&&!oldPositions.has(id)&&now<end){result.set(id,from.at===undefined?{...from,at:start}:from);newest=Math.max(newest,start);until=Math.max(until,end);}
   }
   for(const [id,p]of oldPositions){
    const e=next.entities.get(id);if(!e||!Number.isFinite(e.x)||!Number.isFinite(e.y)||(p.x===e.x&&p.y===e.y)||Math.hypot(e.x-p.x,e.y-p.y)>TELEPORT_DISTANCE)continue;
    const from=old?.get(id),alpha=from?blend(now,from.at??at,from.duration):1;
    const x=alpha<1?from.x+(p.x-from.x)*alpha:p.x,y=alpha<1?from.y+(p.y-from.y)*alpha:p.y;
    if(Math.hypot(e.x-x,e.y-y)>TELEPORT_DISTANCE)continue;
    result.set(id,{x,y,at:now,duration});newest=now;until=Math.max(until,now+duration);
   }
  }
  this.renderFrom=result;this.interpolationAt=newest;this.motionUntil=until;
  const g=this.game;
  this.minimapMotionUntil=result.size&&
   (result.has(g.trollBase?.networkId)||[g.buildings,g.goldMines,g.trees].some(list=>list?.some(entity=>result.has(entity.networkId))))?until:-Infinity;
 }
 hidden(type){this.hiddenViews ||= new Map();if(this.hiddenViews.has(type))return this.hiddenViews.get(type);const o=Object.create(this.types[type].prototype);Object.assign(o,{networkHidden:true,x:-1000000,y:-1000000,radius:0,dead:false,hp:0,maxHp:1,level:1,state:'frozen',equipment:{},getDamage:()=>0,mana:0,gold:0,draw(){},lootedWood:0,lootedGold:0});this.hiddenViews.set(type,o);return o;}
 syncVisuals(next){const g=this.game;for(const[key,duration]of [['ceremony',null],['endlessOpeningIntro',7000],['dragonStorm',3000]]){const value=g[key];if(!value||!Number.isFinite(value.elapsed)){this.visualTracks.delete(key);continue;}const id=[next.epoch,value.kind||key,value.x||0,value.y||0].join(':'),previous=this.visualTracks.get(key),same=previous&&previous.id===id&&value.elapsed>=previous.serverElapsed;const track={id,serverElapsed:value.elapsed,elapsed:same?Math.max(previous.elapsed,value.elapsed):value.elapsed,duration:duration||value.duration||6700};value.elapsed=track.elapsed;if(key==='ceremony'&&!same){value.cameraX=g.camera.x;value.cameraY=g.camera.y;}if(key==='endlessOpeningIntro'){track.lastMono=same&&Number.isFinite(previous.lastMono)?previous.lastMono:this.monotonic();if(!same){value.fromX=g.camera.x;value.fromY=g.camera.y;}}this.visualTracks.set(key,track);if(track.elapsed>=track.duration)g[key]=null;}if(Number.isFinite(g.evolveShow)){const p=this.visualTracks.get('evolveShow'),same=p&&g.evolveShow>=p.serverElapsed;const t={serverElapsed:g.evolveShow,elapsed:same?Math.max(p.elapsed,g.evolveShow):g.evolveShow,duration:2600};this.visualTracks.set('evolveShow',t);g.evolveShow=t.elapsed>=t.duration?null:t.elapsed;}else this.visualTracks.delete('evolveShow');}
 presentationStep(dt){if(!this.active||!this.view)return;const g=this.game,nowVisual=this.clock();const guideStep=this.view.worldView.easyControlGuideStep401;if(Number.isInteger(guideStep)&&g.easyControlGuideStep401!==guideStep){const localStep=g.easyControlGuideStep401;g.easyControlGuideStep401=guideStep;if(guideStep===1&&localStep===2&&![...this.pending.values()].some(p=>p.action==='cameraGuide'))this.command('cameraGuide',{});}dt=this.lastVisualAt===undefined?0:Math.max(0,Math.min(250,nowVisual-this.lastVisualAt));this.lastVisualAt=nowVisual;for(const[key,t]of this.visualTracks){if(g[key]==null)continue;let advance=dt;if(key==='endlessOpeningIntro'){const now=this.monotonic(),last=Number.isFinite(t.lastMono)?t.lastMono:now;advance=Math.max(0,now-last);t.lastMono=Math.max(last,now);}t.elapsed=Math.max(t.elapsed,Number(key==='evolveShow'?g[key]:g[key].elapsed)||0)+advance;if(t.elapsed>=t.duration){if(key==='endlessOpeningIntro'&&g.cameraFollow){g.cameraFollow.x=g[key].fromX;g.cameraFollow.y=g[key].fromY;if(this.input?.stick){this.input.stick.active=false;this.input.stick.dx=this.input.stick.dy=0;}}g[key]=null;g.wxUiDirty=true;}else if(key==='evolveShow')g[key]=t.elapsed;else g[key].elapsed=t.elapsed;}if(dt>0)this.advanceVisualTimers(dt);if(g.placement)g.updatePlacement?.();if(g.toast)g.toast.time=Math.max(0,g.toast.time-dt);if(g.moveMarker){g.moveMarker.time-=dt;if(g.moveMarker.time<=0)g.moveMarker=null;}
 this.sendStick();}
 trackVisualTimers(view){
  const timers=this.visualTimers;timers.length=0;this.poseActors.length=0;
  for(const entity of view.entities.values()){
   if(this.isPoseActor(entity))this.poseActors.push(entity);
   for(const key of VISUAL_TIMERS){
    if(Number.isFinite(entity[key])&&entity[key]>0)timers.push({entity,key});
   }
  }
 }
 advanceVisualTimers(dt){
  const timers=this.visualTimers;let kept=0;
  for(const item of timers){
   const {entity,key}=item,value=entity[key];
   if(!Number.isFinite(value)||value<=0)continue;
   entity[key]=Math.max(0,value-dt);
   if(entity[key]>0)timers[kept++]=item;
  }
  timers.length=kept;
 }
 observeStickFeedback(grab=false){
  const stick=this.input?.stick;
  if(grab){this.stickGrabAt=this.monotonic();this.stickIntentAt=null;}
  if(!stick?.active){this.stickGrabAt=this.stickIntentAt=null;return;}
  if((stick.dx||stick.dy)&&Number.isFinite(this.stickGrabAt)&&!Number.isFinite(this.stickIntentAt))this.stickIntentAt=this.monotonic();
 }
 previewPlayerPosition(now){
  const captured=this.capturedMotion?.point();if(captured){this.predictionBlockedReason=null;return captured;}if(this.capturedMotion?.handles()){this.predictionBlockedReason='captured-basis-unavailable';this.ownMotion?.reset();return null;}
  const g=this.game,p=g.player,vehicle=p?.drivingTank;
  const identityMatches=!!p?.networkId&&this.view?.entities.get(p.networkId)===p,predictable=this.canPredict();
  const menuBlocked=g.sessionMenuOpen||g.demonPanel||g.relicPanel||g.placement||g.buildMenu||g.cameraPeek;
  const poseEligible=identityMatches&&!p.dead&&!(p.stunTimer>0||p.stunLeft>0)&&!p.inTank&&(!vehicle||!vehicle.dead&&vehicle.driver===p&&typeof vehicle.getMoveSpeed==='function'&&vehicle instanceof this.types.Tank&&this.view?.entities.get(vehicle.networkId)===vehicle&&!(vehicle.robotStun>0))&&this.view&&
   !menuBlocked;const valid=poseEligible&&predictable;
  this.predictionBlockedReason=!identityMatches?'identity-mismatch':p.dead?'dead':p.stunTimer>0||p.stunLeft>0?'stunned':p.inTank?'vehicle':vehicle?.robotStun>0?'stunned':menuBlocked?'menu':!predictable?'authority-unavailable':!valid?'unavailable':null;
  if(!valid){
   // Loss of fresh authority disables movement prediction, not the last drawn
   // position. Falling back to an older interpolation here causes rollback.
   const state=this.ownMotion?.state;
   if(this.predictionBlockedReason==='authority-unavailable'&&poseEligible){
    const frozenPoint=state?.entity===(vehicle||p)&&state.epoch===this.view?.epoch&&state.display?state.display:(vehicle||p);
    // Keep the legal frozen position and its existing stale-authority status.
    // Local held-input pose is independent of positional extrapolation. A
    // stale packet must not replace it with an old facing/idle/walk phase.
    const held=this.input?.stick,dx=Number.isFinite(held?.dx)?held.dx:0,dy=Number.isFinite(held?.dy)?held.dy:0,active=!!held?.active&&!!(dx||dy),length=Math.max(1,Math.hypot(dx,dy));
    const poseSpeed=vehicle?Math.max(0,vehicle.getMoveSpeed()):Math.max(0,p.speed||0);
    return {x:frozenPoint.x,y:frozenPoint.y,frozen:true,intentX:active?dx/length*poseSpeed:0,intentY:active?dy/length*poseSpeed:0,...(vehicle?{vehicle}:{})};
   }
   this.ownMotion?.reset();return null;
  }
  const entity=vehicle||p,speed=vehicle?Math.max(0,vehicle.getMoveSpeed()):entity.speed,stick=this.input?.stick,moving=!!(stick?.active&&(stick.dx||stick.dy));
  const from=this.renderFrom?.get(entity.networkId),alpha=from?blend(now,from.at??this.interpolationAt,from.duration):1;
  const base=from&&alpha<1?{x:from.x+(entity.x-from.x)*alpha,y:from.y+(entity.y-from.y)*alpha}:{x:entity.x,y:entity.y};
  const motion=this.ownMotion||(this.ownMotion=new OwnMotionPreview());
  const hadPrediction=!!motion.state;
  const point=motion.sample({entity,speed,authoritativeMoving:!!p.stickDriven,epoch:this.view.epoch,tick:this.view.tick,lastSeq:this.view.lastSeq??this.predictionLastSeq??0,now,moving,dx:moving?stick.dx:0,dy:moving?stick.dy:0,base,
   // Shelter is an authority damage flag, not a foot locomotion boundary.
   // The positional shadow uses the original movement path without changing
   // the live actor, shelter membership, resources or combat.
   step:(shadow,dx,dy)=>vehicle?(shadow.radius=entity.radius,this.manualVehicleBlock()&&!g.terrainCollisionAt(shadow.x,shadow.y,shadow.radius)?manualVehicleStep(shadow,dx*speed,dy*speed,(from,vx,vy)=>g.networkPreviewPosition627(from,vx,vy,true)):g.moveEntityAroundTerrain(shadow,dx*speed,dy*speed)):g.networkPredictionStep627?.(entity.inHouse?{dead:entity.dead,inHouse:null,inTank:entity.inTank,drivingTank:entity.drivingTank,speed:entity.speed,radius:entity.radius,tankEscapeTime:entity.tankEscapeTime}:entity,shadow,dx,dy),
   clip:(dx,dy)=>g.networkPreviewPosition627?.(entity,dx,dy,true),
   clipFrom:(from,to)=>g.networkPreviewPosition627?.({x:from.x,y:from.y,radius:entity.radius},to.x-from.x,to.y-from.y,true),
   routeStep:vehicle&&!this.manualVehicleBlock()?(shadow,to,limit)=>{shadow.radius=entity.radius;const dx=to.x-shadow.x,dy=to.y-shadow.y,distance=Math.hypot(dx,dy);if(distance>0)g.moveEntityAroundTerrain(shadow,dx/distance*Math.min(distance,limit),dy/distance*Math.min(distance,limit));}:null});
  // A settled, confirmed stop has reached authority. Do not hand its next
  // frame back to an older unfinished interpolation segment behind that point.
  if(hadPrediction&&!motion.state&&!moving&&!entity.stickDriven&&Number.isSafeInteger(motion.intentSeq??motion.handoffSeq)&&(this.view.lastSeq??this.predictionLastSeq??0)>=(motion.intentSeq??motion.handoffSeq))this.renderFrom?.delete(entity.networkId);
  const intentLength=moving?Math.max(1,Math.hypot(stick.dx,stick.dy)):1;
  return point?{...point,...(vehicle?{vehicle}:{}),manualStop:motion.state?.recoveryStopHold===true&&!moving,intentX:moving?stick.dx/intentLength*speed:0,intentY:moving?stick.dy/intentLength*speed:0}:null;
 }
 sendStick({grab=false}={}){
  if(this.capturedMotion?.handle(this.input?.stick)){this.ownMotion?.reset();return;}
  const g=this.game,stick=this.input?.stick;
  const allowed=!g.endlessOpeningIntro&&!g.sessionMenuOpen&&!g.demonPanel&&!g.relicPanel&&!g.player?.dead&&stick?.active;
  const dx=allowed?stick.dx||0:0,dy=allowed?stick.dy||0:0;
  const key=dx.toFixed(3)+','+dy.toFixed(3),now=this.clock();
  const moving=key!==NEUTRAL_STICK,changed=key!==this.lastStick;
  const initial=grab||this.lastStick===NEUTRAL_STICK;
  const due=moving?(grab||changed&&(initial||now-this.lastStickAt>=50)||now-this.lastStickAt>=200):changed||this.unsentStickIntent||grab&&!!g.player?.task;
  if(due){if(this.command('joystick',{dx,dy})){this.lastStick=key;this.lastStickAt=now;this.unsentStickIntent=false;}else this.unsentStickIntent=true;}
 }
 suspend(){this.capturedMotion?.suspend();this.ownMotion?.reset();this.stickGrabAt=this.stickIntentAt=null;this.localLead=null;if(this.input?.stick){this.input.stick.active=false;this.input.stick.dx=this.input.stick.dy=0;}const accepted=this.command('joystick',{dx:0,dy:0});if(accepted){this.lastStick='0.000,0.000';this.lastStickAt=this.clock();this.unsentStickIntent=false;}return accepted;}
 dispose(){this.capturedMotion?.dispose();this.actorClockMode=null;this.packetServiceTime=null;this.ownMotionTrace?.reset();this.actorMotionBuffer?.reset();this.poseClock?.reset();this.scalarClock?.reset();this.effectScalars?.reset();this.contentTrace?.dispose();this.poseActors.length=0;this.ownMotion?.reset();this.stickGrabAt=this.stickIntentAt=null;this.active=false;this.singleBuildReceiptBN=null;this.unsentStickIntent=false;this.renderRestorePool=null;this.renderRestoreDepth=0;this.miniPortraits=null;this.elfColors=null;this.plotIndex=null;this.wireRocks=null;this.renderFrom=null;this.motionSnapshotAt=this.motionInterval=null;this.motionUntil=-Infinity;if(typeof this.game.releaseSceneCaches==='function')this.game.releaseSceneCaches();else this.game.releaseFogCaches?.();this.fogStore?.dispose();this.fogStore=null;this.game.resourceBodyLayer=this.game.buildingBodyLayer=null;for(const[k,{own,value}]of this.worldBackup){if(own)this.game[k]=value;else delete this.game[k];}this.worldBackup.clear();for(const[k,{own,value}]of this.uiBackup){if(own)this.game[k]=value;else delete this.game[k];}this.uiBackup.clear();for(const[name,{own,value}]of this.saved){if(own)this.game[name]=value;else delete this.game[name];}this.saved.clear();this.pending.clear();this.saleUI.reset();this.vehicleTransition=null;this.visualTracks.clear();this.visualTimers.length=0;this.hiddenViews?.clear();this.effectClock.reset();this.demonFocusEpoch=this.demonFocusSerial=null;this.lastVisualAt=undefined;this.game.rebuildGuardTreeBuckets?.();this.view=null;this.game.setNetworkRenderDensity627?.(false);}
}
module.exports={OriginalUIAdapter,ACTIONS,BLOCKED_ACTIONS,captureChangedPositions};
