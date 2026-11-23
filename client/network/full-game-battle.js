const loadingControlMotion=require('./loading-control-motion');
const {createDeathResultsGate}=require('./death-results');
const {drawSurvivalRanking,rankingLayout}=require('./survival-ranking');
const {fileShareObservation}=require('./native-file-share');
const {capturePoseCache}=require('./pose-cache-diagnostics');
const packetServiceTime=require('./packet-service-time');
'use strict';
const {DrawPhaseTrace}=require('./draw-phase-trace');
const {isTransientRequestError}=require('./request-failures');
const {copyAndViewDiagnostics}=require('./diagnostic-viewer');

const {OriginalUIAdapter}=require('./original-ui-adapter');
const {refreshMenuBackground}=require('./menu-background-refresh');
const {createGameFeedback}=require('./game-feedback');
const {prepareScene}=require('./presentation-scene');
const {validateMap,geometryChecksum}=require('./world-presentation');
const {PlayPerformance}=require('./play-performance');
const {MatchDiagnostics}=require('./match-diagnostics');
const {captureLoadingState}=require('./loading-diagnostics');
const {LongRunDiagnostics}=require('./long-run-diagnostics');
const {LiveMatchHud}=require('./live-match-hud');
const {PresentationPerformance}=require('./presentation-performance');
const {AsyncPresentationQueue}=require('./presentation-queue');
const {mergePresentationFeedback}=require('./merge-presentation-events');
const {warmSceneRendering}=require('./scene-render-warmup');
const {TeamStatusNotices}=require('./team-status-notices');
const {warmInitialView}=require('./initial-view-warmup');
// The client has already reconstructed a full snapshot before enqueueing it.
 // Never replace a view with an event or a change in urgent UI.
// A warning's countdown/progress is replaceable full-state display data. Keep
// identity, stage, direction reversals and every event/urgent-state boundary.
// The authority emits remaining progress (seconds/60 or seconds/45), so
// normal countdown seconds AND progress decrease, rather than filling up.
function sameWarningProgress(a,b){
 if(a===undefined||b===undefined)return a===b;
 if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length||a.length>8)return false;
 const keys=['kind','seconds','progress','zoneIndex','compact','supplying','estimated','stacked','targetId','sourceId'];
 const valid=r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>keys.includes(k))&&['slime','demon'].includes(r.kind)&&Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<=86400&&Number.isFinite(r.progress)&&r.progress>=0&&r.progress<=1&&Number.isInteger(r.zoneIndex)&&r.zoneIndex>=0&&r.zoneIndex<=8&&['compact','supplying','estimated','stacked'].every(k=>typeof r[k]==='boolean')&&['targetId','sourceId'].every(k=>r[k]===undefined||typeof r[k]==='string'&&r[k].length<=128);
 const band=v=>v===0?0:v===1?2:1;
 return a.every((old,i)=>{const next=b[i];if(!valid(old)||!valid(next))return false;
  if(next.seconds>old.seconds||next.progress>old.progress||(old.seconds===0)!==(next.seconds===0)||band(old.progress)!==band(next.progress))return false;
  return ['kind','zoneIndex','compact','supplying','estimated','stacked','targetId','sourceId'].every(k=>Object.is(old[k],next[k]));
 });
}
// Warning rows are a current full-state HUD, not one-shot authority events.
// Keep the newest validated state while the independent event/focus/rescue/
// terminal barriers stay ordered. Rebuilding every obsolete forecast target can
// otherwise turn normal warning churn into an unbounded presentation delay.
function validWarningState162(rows){if(rows===undefined)return true;if(!Array.isArray(rows)||rows.length>8)return false;const keys=['kind','seconds','progress','zoneIndex','compact','supplying','estimated','stacked','targetId','sourceId'];return rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(k=>keys.includes(k))&&['slime','demon'].includes(r.kind)&&Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<=86400&&Number.isFinite(r.progress)&&r.progress>=0&&r.progress<=1&&Number.isInteger(r.zoneIndex)&&r.zoneIndex>=0&&r.zoneIndex<=8&&['compact','supplying','estimated','stacked'].every(k=>typeof r[k]==='boolean')&&['targetId','sourceId'].every(k=>r[k]===undefined||typeof r[k]==='string'&&r[k].length<=128));}
function presentationReplacementDecision(older,newer,appliedEventId=0,eventApplied=null){
 const no=reason=>({allowed:false,reason}),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(older.worldView?.state!==newer.worldView?.state)return no('state');
 if(![older.events,newer.events].every(rows=>Array.isArray(rows)&&rows.every(e=>e&&Number.isSafeInteger(e.id)&&e.id>0)))return no('events-invalid');
 const events=new Map(newer.events.map(e=>[e.id,JSON.stringify(e)]));
 if(events.size!==newer.events.length)return no('events-invalid');
 const applied=Number.isSafeInteger(appliedEventId)&&appliedEventId>=0?appliedEventId:0;
 if(older.events.some(e=>e.id>applied&&!(typeof eventApplied==='function'&&eventApplied(older,e)===true)&&events.get(e.id)!==JSON.stringify(e)))return no('feedback-not-retained');
 if(!same(older.publicDemonFocusEvent,newer.publicDemonFocusEvent))return no('focus');
 if(!validWarningState162(older.publicWarnings)||!validWarningState162(newer.publicWarnings))return no('warning-boundary');
 if(!same(older.rescueOffer,newer.rescueOffer))return no('rescue');
 if(!same(older.worldView?.toast?.text,newer.worldView?.toast?.text))return no('toast');
 const ceremony=p=>[p.worldView?.ceremony?.kind,p.worldView?.ceremony?.x,p.worldView?.ceremony?.y];
 if(!same(ceremony(older),ceremony(newer)))return no('ceremony');
 return {allowed:true,reason:same(older.publicWarnings,newer.publicWarnings)?'replaceable':'latest-warning-state'};
}
function canReplaceQueuedPresentation(older,newer,appliedEventId=0){return presentationReplacementDecision(older,newer,appliedEventId).allowed;}
class FullGameBattle{
 constructor({game,runtime,topology,client,team,gate,wx,hooks,art=null,cooperativePresentation=false,monotonic,requestTimeoutMs=15000,terrainTimeoutMs=30000,traceContent=false}){Object.assign(this,{game,runtime,topology,client,team,gate,wx,hooks,art,traceContent});const origin=Date.now();let last=0;this.monotonic=typeof monotonic==='function'?monotonic:()=>last=Math.max(last,Date.now()-origin);this.drawPhaseTrace=new DrawPhaseTrace({clock:this.monotonic});this.matchDiagnostics=new MatchDiagnostics();this.longRunDiagnostics=new LongRunDiagnostics({clock:this.monotonic,wx});this.longRunDiagnostics.onConfirmedView=(command,at)=>this.client.observeInputView?.(command,at);this.liveMatchHud=new LiveMatchHud();this.previousNetworkObserver=client.onNetworkMetric;this.previousTransportObserver=client.room.battleTransportObserver;this.previousHeartbeatObserver=client.room.battleHeartbeatObserver;this.previousBattleMeasureClock=client.room.battleMeasureClock;client.room.battleMeasureClock=this.monotonic;this.previousServiceObserver=client.room.battleServiceObserver;client.room.battleServiceObserver=this.serviceObserver=sample=>{if(this.active&&sample.method==='serverInputSend'){client.observeServerInputSend?.(sample);return;}if(this.active&&sample.method==='input'){client.observeServerElapsed?.(sample);client.recordNetwork?.('inputServerElapsedMs',sample.serverElapsedMs);for(const [source,key]of [['workerQueueMs','inputServerWorkerQueueMs'],['workerWorkMs','inputServerWorkerWorkMs'],['workerReturnMs','inputServerWorkerReturnMs']])if(Number.isFinite(sample.serverPhases?.[source]))client.recordNetwork?.(key,sample.serverPhases[source]);}};client.room.battleHeartbeatObserver=this.heartbeatObserver=ms=>client.recordNetwork?.('heartbeatMs',ms);client.onNetworkMetric=this.networkMetricObserver=(key,value)=>{if(!this.active)return;this.longRunDiagnostics.recordMetric(key,value);if(key==='overload')this.matchDiagnostics.overload++;else this.matchDiagnostics.record(key,value);if(key==='heartbeatWarning'&&!this.client.hidden&&!this.game.sessionMenuOpen)this.liveMatchHud.heartbeatWarning(this.monotonic());if(!this.client.hidden&&!this.game.sessionMenuOpen&&!this.client.resyncing&&['heartbeatMs','socketRttMs'].includes(key))this.liveMatchHud.receipt(value,this.monotonic(),key);};client.room.battleTransportObserver=this.transportObserver=(transport,sample)=>{if(this.active&&(transport==='socket'||transport==='http')){this.matchDiagnostics.transport[transport]++;this.longRunDiagnostics.transport(transport);client.observeInputTransport?.(transport,sample);}};this.teamNotices=new TeamStatusNotices({clock:this.monotonic});this.playPerformance=new PlayPerformance({clock:this.monotonic,emit:report=>{this.matchDiagnostics.window('draw',report);this.runtime.diagnosticEvent?.('network-play',JSON.stringify(report));},context:()=>({role:this.client.room?.room?.host===this.client.room?.playerId?'host':'guest',phase:this.game.state,intro:!!this.game.endlessOpeningIntro,menu:!!this.game.sessionMenuOpen,gameReady:this.ready(),hidden:this.client.hidden,resyncing:this.client.resyncing,entities:this.adapter?.view?.entities.size||0,players:this.adapter?.view?.roster?.length||0,queue:this.client.queue?.length||0,snapshotAgeMs:Math.max(0,Math.round((this.client.clock||Date.now)()-(this.client.lastSnapshotAt||0)))})});this.previousPacketObserver=client.onPacketWork;this.previousPacketClock=client.measureClock;this.packetWorkObserver=ms=>{try{this.previousPacketObserver?.call(client,ms);}catch(_){}if(this.active){this.playPerformance.packet(ms);this.longRunDiagnostics.recordMetric('packetJsMs',ms);if(this.client.fatal||this.client.error)this.playPerformance.flush('error');}};client.measureClock=this.monotonic;client.onPacketWork=this.packetWorkObserver;this.cooperativePresentation=cooperativePresentation;this.uiPerformance=new PresentationPerformance({clock:this.monotonic,emit:report=>{this.matchDiagnostics.window('ui',report);this.runtime.diagnosticEvent?.('network-ui',JSON.stringify(report));}});this.uiProgress=null;this.terrainViewRetryTimer=null;this.terrainViewBusy=false;this.terrainViewProgress=null;this.initPresentationQueue();this.requestTimeoutMs=requestTimeoutMs;this.terrainTimeoutMs=terrainTimeoutMs;this.loadCancels=new Set();this.syncing=false;this.loadStarted=this.monotonic();this.active=false;this.mapGeneration=0;this.mapBusy=false;this.animationTimer=null;this.animationPhase=0;this.parent=gate.controller;gate.controller=this;this.unsubscribe=client.subscribe(()=>{if(this.active){this.sync();this.wakeForState();}});this.unsubscribeInvite=client.room?.subscribe?.(event=>{if(!this.active)return;if(event.type==='invite-left'&&event.roomId===this.activeRoomId)this.back({suspend:false,openRoom:true});else if(event.type==='invitation'&&event.invitation?.status==='error'){this.game.toast={text:this.team.statusText(),time:4500};this.runtime.wake?.();}});this.hide=()=>{this.loadingControlMotionBN?.cancel();this.longRunDiagnostics.boundary('hidden');this.liveMatchHud.reset();this.cancelTerrainViewWarmup();this.uiQueue?.pause();this.uiPerformance.flush('hidden');this.playPerformance.flush('hidden');if(this.active)this.adapter?.suspend();client.hide();this.stopLoadingAnimation();};this.show=()=>{if(this.active){this.longRunDiagnostics.boundary('shown');client.show();this.sync();this.updateLoadingAnimation();}};wx.onHide?.(this.hide);wx.onShow?.(this.show);}
 // Entity/context hooks are opt-in animation instrumentation. Control/performance
 // runs keep them off; original draw-stage, HUD and authority metrics remain on.
 async start(){if(this.active)return;if(!this.team.home()||!this.hooks?.types||typeof this.hooks.makePlotGrid!=='function')throw Error('ORIGINAL_UI_UNAVAILABLE');this.drawPhaseTrace.dispose();this.drawPhaseTrace.rows=[];this.drawPhaseTrace.serial=0;this.drawPhaseTrace.lastEnd=null;this.snapshotFloor=Number.isSafeInteger(this.client.snapshotSerial)?this.client.snapshotSerial+1:null;this.client.loading=null;this.liveMatchHud.reset();this.matchDiagnostics.reset();this.longRunDiagnostics.reset();this.playPerformance.reset();this.uiPerformance.reset();this.uiProgress=null;this.loadBarrierView=null;this.loadBarrierLastSuccessAt=null;this.loadBarrierPoll=null;this.loadBarrierPollAt=-Infinity;this.loadBarrierError=false;this.offlineDraw=this.game.draw;this.active=true;this.activeRoomId=this.client.room?.room?.id;this.team.open=false;this.team.networkBattleActive=true;this.team.stopPoll();this.mapWorld=null;this.scene=null;this.renderWorld=null;this.renderProgress=null;this.terrainViewDone=null;this.terrainViewResult=null;this.terrainViewScopeSeen=null;this.terrainViewGuardFailures=0;this.mapError=null;this.mapProgress=0;this.mapStage='snapshot';this.loadingFailure=null;this.loadingCause=null;this.client.loadingFailure=null;this.firstFrameDrawn=false;this.presentationGeneration=null;this.seen=null;this.failedSnapshot=null;this.loadStarted=this.monotonic();this.mapGeneration++;this.cancelLoads();this.uiQueue?.resetObservations();this.adapter=new OriginalUIAdapter({game:this.game,traceContent:this.traceContent===true,captureTransport:{socket:()=>this.client.room.socket,ownerId:()=>this.client.room.playerId,roomId:()=>this.client.room.room?.id},monotonic:this.monotonic,types:this.hooks.types,input:this.hooks.input,
 fogEnabled:()=>this.client.room.room?.fogEnabled!==false,
 manualVehicleBlock:()=>this.client.room.socket?.capabilities?.manualVehicleBlock===true,
 onPerformance:(key,value)=>{this.matchDiagnostics.record(key,value);this.longRunDiagnostics.recordMetric(key,value);},
 // Keep the small, terrain-clipped visual response between normal cloud pushes.
 serverClock:()=>{const socket=this.client.room.socket;return socket?.capabilities?.clockPulse?socket.serverClockTimeline?.sample(socket.rttClock()):null;},
 canPredict:()=>this.ready()&&this.client.room.connected&&!this.client.resyncing&&this.client.clock()-this.client.lastSnapshotAt<1200,
 sound:this.hooks.gameSound,createPlotGrid:this.hooks.makePlotGrid,send:command=>{if(this.client.loadingBarrierEnabled&&!this.ready())return false;const sent=this.monotonic(),diagnosticRun=this.longRunDiagnostics.runId,adapter=this.adapter,feedback=this.feedback,rescue=command.action==='shareRescue'||command.action==='continueShareRescue',promise=this.client.input(command);if(promise===false)return false;this.longRunDiagnostics.queuedInput(command,sent,diagnosticRun);if(rescue)feedback?.trackCommand?.(command);this.playPerformance.input(command);return promise.then(receipt=>{this.client.observeInputReceipt?.(command,this.monotonic());this.playPerformance.receipt(this.monotonic()-sent,receipt.accepted);this.longRunDiagnostics.inputReceipt(receipt.accepted,this.monotonic()-sent,diagnosticRun);this.longRunDiagnostics.confirmedInput(command,receipt,diagnosticRun);this.client.recordNetwork?.('commandAckMs',this.monotonic()-sent);adapter?.acknowledge({epoch:receipt.epoch,seq:receipt.seq,ok:receipt.accepted,error:receipt.error,moveMarker:receipt.moveMarker,tick:receipt.tick});if(rescue)feedback?.acknowledge?.(command,receipt);return receipt;},error=>{this.longRunDiagnostics.inputFailed(diagnosticRun);this.longRunDiagnostics.failedInput(command,diagnosticRun);if(rescue)feedback?.acknowledgeFailure?.(command,error);throw error;});},onBlocked:code=>{this.lastBlocked=code;},onExit:()=>this.game.player?.dead?this.showPersonalResultsAD():this.back(),onRestart:()=>{if(!this.client.room.playerId||this.client.room.room?.host!==this.client.room.playerId)return this.back();void this.nextRound().catch(e=>{this.game.toast={text:e.message,time:3000};});}});this.adapter.activate();this.drawPhaseTrace.install(this.game,this.art);this.adapter.patch('networkRestartLabel627',()=>this.client.room.playerId&&this.client.room.room?.host===this.client.room.playerId?'再开一局':'返回队伍房间');for(const b of this.game.buttons||[])if(b.id==='restart')b.text=this.game.networkRestartLabel627();this.feedback=createGameFeedback({game:this.game,sound:this.hooks.gameSound,send:(action,args)=>this.adapter.command(action,args),shareBridge:!this.wx.__demonElvesShareUnavailable&&typeof this.wx.__demonElvesShareReward==='function'?data=>this.wx.__demonElvesShareReward(data):null,cancelShare:()=>this.wx.__demonElvesCancelShareReward?.()});this.installRescueUi();this.networkDraw=this.game.draw;
 const originalMenu=this.adapter.saved.get('sessionMenuButtons')?.value,filtered=this.game.sessionMenuButtons,tap=this.game.handleTap;this.adapter.patch('sessionMenuButtons',(...args)=>{const buttons=filtered.apply(this.game,args),original=originalMenu?.apply(this.game,args)||[],diagnostic=original.find(b=>b.id==='superChallenge'),exit=original.find(b=>b.id==='exit');if(diagnostic)return [...buttons,{...diagnostic,id:'networkDiagnostics',text:'导出联机诊断'}];if(!exit)return buttons;const spare=original.find(b=>b.id==='new'),gap=8,half=(exit.w-gap)/2,back=spare||{...exit,w:half},leave=spare?exit:{...exit,x:exit.x+half+gap,w:half};return[...buttons,{...back,id:'networkBack',text:'返回联机房间'},{...leave,id:'networkExit',text:this.exitStage==='leaving'?'正在退出':this.exitReplay?'重试退出':'退出游戏'}];});this.adapter.patch('handleTap',(x,y)=>{if(this.game.sessionMenuOpen){const b=this.game.sessionMenuButtons().find(b=>['networkBack','networkExit','networkDiagnostics'].includes(b.id)&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(b){if(b.id==='networkDiagnostics'){this.copyMatchDiagnostics();return;}if(b.id==='networkBack'){if(!this.exitPromise)this.back();}else void this.requestExit();return;}}return tap.call(this.game,x,y);});
 this.wrapper=(...args)=>this.draw(args);this.game.draw=this.wrapper;this.updateLoadingAnimation();this.runtime.wake?.();const generation=this.mapGeneration;try{await this.client.start();}catch(e){if(this.active&&generation===this.mapGeneration)this.failLoading(e,'server');}if(this.active&&generation===this.mapGeneration)this.sync();}
 copyMatchDiagnostics(){
  const role=this.client.room?.room?.host===this.client.room?.playerId?'host':'guest';
  const room=this.client.room,failure=room.lastSocketFailureDiagnostic;const baseData=this.matchDiagnostics.export(role,{cloudResponseFailures:room.wx?.cloudFailureReport?.(),requestFailures:this.client.requestFailures,lastHeartbeatFailureCode:this.client.lastHeartbeatFailure?.code,lastHeartbeatFailureAtMs:this.client.lastHeartbeatFailure?.at,transportKind:room.transportKind,httpTransportKind:room.transportKind,socketTransportKind:room.socketTransportKind||room.transportKind,failureTransportKind:failure?.failureTransportKind,socketReady:room.socket?.ready===true,socketBound:!!room.socket?.boundRoomId&&room.socket.boundRoomId===room.room?.id,fallbackRemainingMs:Math.max(0,(room.socketFallbackUntil||0)-Date.now()),snapshotAgeMs:Math.max(0,this.client.clock()-this.client.lastSnapshotAt),diagnosticExportedAtMs:Date.now(),failureRecordedAtMs:failure?.failureRecordedAtMs,socketAttemptStartedAtMs:failure?.socketAttemptStartedAtMs,socketConnectCalledAtMs:failure?.socketConnectCalledAtMs,socketFailureObservedAtMs:failure?.socketFailureObservedAtMs,socketFailureSource:failure?.socketFailureSource,socketFailureClass:failure?.socketFailureClass,failureStage:failure?.stage,failureCode:failure?.code,sdkCode:failure?.sdkCode,closeCode:failure?.closeCode,closeReasonClass:failure?.closeReasonClass,gameReady:this.ready(),menuOpen:!!this.game.sessionMenuOpen,clientHidden:!!this.client.hidden,resyncing:!!this.client.resyncing,fatal:!!this.client.fatal,loadStep:this.loadStep(),errorCode:this.mapError||this.client.error,loadFailureStage:this.loadingFailure?.stage});
  let startupDiagnostics=null,runtimeDiagnostics=null;try{startupDiagnostics=this.wx.getStorageSync?.('forest-startup-diagnostics-v1')??null;}catch(_){}try{runtimeDiagnostics=this.runtime?.diagnosticReport?.()??null;}catch(_){}
  const knownSlots=Array.isArray(room.room?.slots),slots=(room.room?.slots||[]).filter(p=>p.kind==='human'||p.kind==='ai');let device={};try{device=this.wx.getDeviceInfo?.()||this.wx.getSystemInfoSync?.()||{};}catch(_){}const summaryContext={deviceModel:device.model||null,system:device.system||null,playerCount:slots.length||null,humanCount:knownSlots?slots.filter(p=>p.kind==='human').length:null,aiCount:knownSlots?slots.filter(p=>p.kind==='ai').length:null,difficulty:this.game.trollDifficulty||null,huntSeconds:Number.isFinite(this.game.huntElapsed)?this.game.huntElapsed:null};
  const data={...JSON.parse(baseData),summaryContext,startupDiagnostics,runtimeDiagnostics,nativeFileShare:fileShareObservation(this.wx),loadingState:captureLoadingState(this),lobbyEntry:this.team?.entryReport?.()??null,cloudPreconnect:this.client.room?.preconnectObservation??null,socketCarrier:room.wx?.cloudSocketReport?.()??[],recoveryState:this.client.recoveryStatus?.()??null,presentationQueue:this.uiQueue?.report?.()??null,inputTimeline:this.client.inputStageReport?.()??null,saleUiTimeline:this.adapter?.saleUI?.report?.()??null,clientVisualSampling:{groundCacheBounds:this.game?.terrainTiles200?.cacheStats162?.()??null,groundShadowCache:this.art?.privateShadowRecoveryStats?.()??null,capturedOwnMotion:this.adapter?.capturedMotion?.report()??null,actualAnimationContent:this.adapter?.contentTrace?.report()??null,poseCache:capturePoseCache(this.art),poseSmoothing:this.adapter?.smoothActorPoses===true,remoteMotion:this.adapter?.smoothRemoteMotion?this.adapter.actorMotionBuffer?.report?.()??null:null,ownPredictionActive:!!this.adapter?.ownMotion?.state&&!this.adapter?.predictionBlockedReason,ownPredictionTrace:this.adapter?.ownMotionTrace?.report()??null},heartbeatTimeline:room.wx?.heartbeatStageReport?.()??null,readScheduling:this.client.readScheduleReport?.()??null,drawPhaseTrace:this.drawPhaseTrace?.report?.()??null,socketProbe:this.client.socketProbeReport?.()??null,socketRuntime:this.client.room.socket?.runtimeReport?.()??null,authFailures:room.authFailureReport?.()??[],authFailureContext:{battleGeneration:room.battleGeneration||0,qaGeneration:Number.isSafeInteger(room.qaGeneration)?room.qaGeneration:null},membershipHeartbeatTransport:{counts:{...(room.membershipHeartbeatCounts||{})},last:room.membershipHeartbeatTransport||null,scope:'Room heartbeatMs may use negotiatedSocket orHTTP; SDK heartbeatTimeline remainsHTTP-only. Actual application ping RTT unchanged.'},routing:room.routingReport?.()??null,serverFeatures:room.socket?.capabilities?{...room.socket.capabilities}:null,hudNetworkSource:this.liveMatchHud?.networkSource||'heartbeatMs',...(this.longRunDiagnostics?{longRun:this.longRunDiagnostics.export(this.longRunConnection())}:{})};
  copyAndViewDiagnostics(this.wx,data,{relay:this.runtime?.diagnosticRelay?.enabled===true?{...this.runtime.diagnosticRelay,request:(route,body)=>this.client.room.request(route,body)}:null});
 }
 longRunConnection(){const room=this.client.room;return {socketReady:room.socket?.ready===true,socketBound:!!room.socket?.boundRoomId&&room.socket.boundRoomId===room.room?.id,closeCode:room.lastSocketFailureDiagnostic?.closeCode,failureRecordedAtMs:room.lastSocketFailureDiagnostic?.failureRecordedAtMs};}
 installRescueUi(){
  const game=this.game,feedback=this.feedback,adapter=this.adapter;
  adapter.patch('shareRescueOffer',()=>feedback.offer());
  adapter.patch('requestShareRescue',(kind,serial)=>feedback.requestShareRescue(kind,serial));
  adapter.patch('handleShareRescueTap',(x,y)=>feedback.handleShareRescueTap(x,y));
  const layout=game.spectatorLayout587,tap=game.handleSpectatorTap587;
  if(typeof layout!=='function'||typeof tap!=='function')return;
  adapter.patch('spectatorLayout587',(...args)=>{
   const result=layout.apply(game,args),status=feedback.status?.();
   if(!status||feedback.offer()?.kind!=='player')return result;
   return {...result,buttons:result.buttons.map(button=>button.id==='share'?{...button,text:status.pending?'取消分享等待':status.action,disabled:status.pending?false:button.disabled}:button)};
  });
  adapter.patch('handleSpectatorTap587',(x,y)=>{
   if(feedback.status?.()?.pending){const button=game.spectatorLayout587().buttons.find(b=>b.id==='share'&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(button){const offer=feedback.offer();if(offer?.kind==='player')void feedback.requestShareRescue(offer.kind,offer.serial);return;}}
   return tap.call(game,x,y);
  });
 }
 sync(){
  if(!this.active||this.syncing)return;
  this.syncing=true;
  try{
    if(this.client.roundReset){this.back();return;}
    if(this.awaitingSnapshot()){this.firstFrameDrawn=false;this.uiQueue?.pause();this.updateLoadingAnimation();return;}
    if(this.cooperativePresentation){if(this.client.fatal)this.uiQueue.cancel('fatal');else if(this.client.hidden||this.client.error||this.client.resyncing)this.uiQueue.pause();else this.uiQueue.resume();}
    void this.ensureTerrain();void this.ensureScene();void this.ensureRenderWarmup();
    const snapshot=this.client.state;
    this.runtime.onlineBatArtBN?.warmOnlineWave(snapshot?.worldView);
    if(!this.mapError&&!this.client.error&&!this.client.fatal&&this.mapWorld&&this.scene&&snapshot&&this.scene.sceneRevision===snapshot.sceneRevision&&this.seen!==snapshot&&this.failedSnapshot!==snapshot){
      this.mapStage='ui';
      this.adapter.seq=Math.max(this.adapter.seq,this.client.acceptedSeq||0);
      if(this.cooperativePresentation){this.feedback?.preplay?.(snapshot,Math.max(snapshot.tick,this.client.state.tick));this.uiQueue.enqueue(snapshot,this.scene);}
      else{
       const applyStarted=this.monotonic();
       try{const applied=this.adapter.apply(snapshot,this.scene);this.feedback?.apply(snapshot);if(applied){this.observeTeamStatus(snapshot);this.longRunDiagnostics.appliedView(snapshot);}this.seen=snapshot;this.presentationGeneration=this.mapGeneration;this.terrainViewCommittedScope=this.terrainViewScope(snapshot,this.scene);this.playPerformance.apply(this.monotonic()-applyStarted);}
       catch(e){this.failedSnapshot=snapshot;this.failLoading(e,'ui');}
      }
    }
    void this.ensureTerrainViewWarmup();
    this.updateLoadingAnimation();
  }finally{this.syncing=false;}
 }
 recordPresentationWork(event){this.uiPerformance.slice(event);this.longRunDiagnostics.recordMetric('uiTaskMs',event.durationMs);try{this.onPresentationWork?.(event);}catch(_){} }
 initPresentationQueue(){
  if(!this.cooperativePresentation)return;
  this.uiQueue=new AsyncPresentationQueue({clock:this.monotonic,
   // Warm captured packets get a bounded4ms preparation slice immediately;
   // large/cold packets keep the rendering/touch macrotask boundary.
   mayStartInline:job=>!!this.adapter?.view&&job.captureMs<=1,
   coalesce:(older,newer)=>{const applied=this.feedback?.appliedEventId?.(older)||0,eventApplied=(packet,event)=>this.feedback?.eventApplied?.(packet,event)===true,merged=mergePresentationFeedback(older,newer,applied,presentationReplacementDecision,eventApplied);if(merged)packetServiceTime.transfer(newer,merged);if(!merged)this.uiQueue?.observeReplacementBlock(presentationReplacementDecision(older,newer,applied,eventApplied).reason);return merged;},
   onReplace:()=>this.uiPerformance.replaced(),
   isCurrent:job=>this.active&&!this.client.hidden&&!this.client.fatal&&!this.mapError&&this.adapter?.active&&this.scene===job.scene&&['roomId','viewerOwnerId','epoch','sceneRevision','mapChecksum'].every(k=>this.client.state?.[k]===job.packet[k]),
   onCapture:durationMs=>this.recordPresentationWork({phase:'capture',durationMs,work:1}),
   prepare:(packet,scene,keepGoing)=>this.adapter.prepareAsync(packet,scene,{clock:this.monotonic,keepGoing,batchSize:32,sliceMs:4,maxBatchesPerSlice:24,onSlice:event=>this.recordPresentationWork(event),onProgress:progress=>{if(keepGoing()){this.uiProgress=progress;if(!this.adapter.view)this.wakeForState();}}}),
   commit:(prepared,packet,scene,source)=>{
    const started=this.monotonic();
    try{const result=this.adapter.apply(packet,scene,prepared);this.feedback?.apply(packet,Math.max(packet.tick,this.client.state.tick));if(result){this.observeTeamStatus(packet);this.longRunDiagnostics.appliedView(packet);}this.seen=source;this.presentationGeneration=this.mapGeneration;this.terrainViewCommittedScope=this.terrainViewScope(packet,scene);this.adapter.seq=Math.max(this.adapter.seq,this.client.acceptedSeq||0);return result;}
    finally{const durationMs=Math.max(0,this.monotonic()-started);this.playPerformance.apply(durationMs);this.recordPresentationWork({phase:'commit',durationMs,work:1});}
   },
   onCommit:(_packet,_result,job)=>{this.uiProgress=null;void this.ensureTerrainViewWarmup();this.uiPerformance.committed(this.monotonic()-job.enqueuedAt,this.uiQueue.size);this.longRunDiagnostics.recordMetric('uiCommitLatencyMs',this.monotonic()-job.enqueuedAt);this.updateLoadingAnimation();this.wakeForState();},
   onDiscard:prepared=>prepared.dispose?.(),
   onError:error=>{this.failedSnapshot=this.client.state;this.failLoading(error,'ui');}
  });
 }
 renderPrepared(){return !this.art||this.renderWorld===this.mapWorld;}
 awaitingSnapshot(){return !this.client.state||this.client.hidden||this.client.resyncing||this.snapshotFloor!=null&&this.client.snapshotSerial<this.snapshotFloor;}
 presentable(){return !!(!this.awaitingSnapshot()&&this.presentationGeneration===this.mapGeneration&&this.renderPrepared()&&this.terrainViewPrepared()&&this.adapter?.view&&this.mapWorld&&this.scene&&this.scene.sceneRevision===this.client.state?.sceneRevision&&!this.mapError&&!this.client.error&&!this.client.fatal&&!this.client.resyncing);}
 loadingReleased(){
  if(this.client.requireLoadingBarrier)return this.loadBarrierView?.enabled===true&&this.loadBarrierView.started===true;
  if(!this.client.loadingBarrierEnabled||this.loadBarrierView?.enabled===false||this.loadBarrierView?.started===true)return true;
  // The backend never advances a gated world before all players are ready.
  const tick=this.client.state?.tick;
  return !!this.firstFrameDrawn&&Number.isSafeInteger(tick)&&tick>0;
 }
 ready(presentable=this.presentable()){return presentable&&this.loadingReleased();}
 loadStep(){if(this.awaitingSnapshot())return 0;if(!this.mapWorld||!this.scene)return 1;if(!this.renderPrepared())return 2;if(!this.terrainViewPrepared()||!this.adapter?.view)return 3;return this.firstFrameDrawn?5:4;}
 loadRows(){return this.loadBarrierView?.players||this.client.room?.room?.slots?.flatMap((p,seat)=>p.kind==='human'?[{seat,step:0,state:p.connection==='connected'?'loading':'offline'}]:[])||[];}
 pollLoadBarrier(force=false){
  const c=this.client,room=c.room?.room,epoch=c.state?.epoch;
  if(!this.active||!c.loadingBarrierEnabled||!room||!Number.isSafeInteger(epoch)||c.hidden||this.loadBarrierView?.started||this.loadBarrierView?.enabled===false||this.loadBarrierPoll)return;
  const now=this.monotonic();if(!force&&now-this.loadBarrierPollAt<900)return;
  this.loadBarrierPollAt=now;const generation=this.mapGeneration,scope=room.id,failed=!!(this.mapError||c.error||c.fatal),step=Math.min(this.loadStep(),failed?4:5);
  const serial=this.loadBarrierSerial=Math.max((this.loadBarrierSerial||0)+1,Date.now()*1000);
  const current=()=>this.active&&generation===this.mapGeneration&&c.room?.room?.id===scope&&c.state?.epoch===epoch&&!c.hidden;
  const job=Promise.resolve().then(()=>current()?c.room.request(c.path('/load'),{epoch,serial,step,failed}):null).then(v=>{
   if(!current())return;
   const rows=v?.players;
   if(v?.epoch!==epoch||!(v.enabled===false||v.enabled===true&&typeof v.started==='boolean'&&Array.isArray(rows)&&rows.length<=9&&new Set(rows.map(p=>p?.seat)).size===rows.length&&rows.every(p=>Number.isInteger(p?.seat)&&p.seat>=0&&p.seat<=8&&Number.isInteger(p.step)&&p.step>=0&&p.step<=5&&['ready','loading','offline','failed'].includes(p.state))))throw Error('INVALID_LOAD_STATUS');
   this.loadBarrierError=false;this.loadBarrierView=v;this.loadBarrierLastSuccessAt=this.monotonic();
   if(c.requireLoadingBarrier&&!v.enabled)this.failLoading(Error('FULLGAME_BACKEND_UPDATE_REQUIRED'),'server');
  }).catch(()=>{if(current())this.loadBarrierError=true;}).finally(()=>{
   if(this.loadBarrierPoll===job)this.loadBarrierPoll=null;if(!current())return;
   if(!failed&&(this.mapError||c.error||c.fatal))this.pollLoadBarrier(true);
   else {this.updateLoadingAnimation();this.runtime.wake?.();}
  });this.loadBarrierPoll=job;
 }
 wakeForState(){
  if(!this.active)return;
  if(this.ready()){this.waitingViewKey=null;this.runtime.wake?.();return;}
  const status=this.loadingStatus(),failure=this.loadingFailure,code=this.mapError||this.client.error||'';
  // Snapshot revisions can advance while the same loading panel stays visible.
  // Compare only displayed fields; never stringify the large world snapshot.
  const key=[this.mapGeneration,status.index,status.stages[status.index].label,code,code?'':status.elapsedSeconds,status.count?.done,status.count?.total,failure?.name,failure?.message,failure?.source,failure?.presentationReason,failure?.presentationPath].join('|');
  if(key===this.waitingViewKey)return;this.waitingViewKey=key;this.runtime.wake?.();
 }
 draw(args=[]){try{return this.drawQaOriginal(args);}finally{require('./qa-badge').drawQaBadge(this.runtime);}}
 drawQaOriginal(args=[]){if(!this.active)return this.offlineDraw?.apply(this.game,args);const presentable=this.presentable(),allowed=presentable&&this.ready(presentable);if(!allowed)this.longRunDiagnostics.frame(this.monotonic(),{...this.longRunConnection(),eligible:false});if(presentable&&(allowed||!this.firstFrameDrawn)){const previous=this.topology.world;let renderEndedMs,diagnosticsEndedMs,drawFailed=false;try{this.topology.world=this.mapWorld;if(allowed)this.drawPhaseTrace.begin({menu:this.game.sessionMenuOpen,hidden:this.client.hidden,intro:!!this.game.endlessOpeningIntro});if(allowed&&this.loadingBackdropDirty&&!this.game.saveSlotsPanel){refreshMenuBackground(this.game);this.loadingBackdropDirty=false;}const frameStarted=allowed?this.playPerformance.beginFrame():null,result=this.adapter?.drawWithMoveFeedback?this.adapter.drawWithMoveFeedback(this.networkDraw,args):this.networkDraw.apply(this.game,args);if(allowed){this.drawTeamStatus();renderEndedMs=this.monotonic();this.playPerformance.endFrame(frameStarted);this.longRunDiagnostics.frame(this.monotonic(),{...this.longRunConnection(),eligible:!this.game.endlessOpeningIntro&&!this.game.sessionMenuOpen&&!this.client.hidden&&!this.client.resyncing&&!this.client.error&&!this.client.fatal,viewEpoch:this.adapter?.view?.epoch,viewRevision:this.adapter?.view?.revision,drawJsMs:this.monotonic()-frameStarted,snapshotAgeMs:Math.max(0,this.client.clock()-this.client.lastSnapshotAt)});diagnosticsEndedMs=this.monotonic();this.drawLiveMatchHud();this.personalResultsGateAD?.refresh(this.adapter?.view?.personalDeathResults);this.personalResultsGateAD?.draw(this.game.ctx,this.game.canvas);if(!this.personalResultsGateAD?.visible&&!this.game.ceremony&&!this.game.sessionMenuOpen&&!this.game.saveSlotsPanel)drawSurvivalRanking(this.game.ctx,this.game.canvas,this.runtime.viewport(),this.adapter?.view?.publicSurvivalRanking,value=>this.runtime.nativeText(value));}if(!this.firstFrameDrawn){const p=this.game.player;try{this.runtime.diagnosticEvent?.('network-first-frame',JSON.stringify({tick:this.adapter?.view?.tick??this.client.state?.tick,elapsedMs:Math.round(this.monotonic()-this.loadStarted),wood:p?.wood,maxWood:p?.maxWood,gold:p?.gold,maxGold:p?.maxGold,waitingForTeam:!allowed}));}catch(_){}}this.firstFrameDrawn=true;this.mapStage='ready';if(allowed)return result;this.pollLoadBarrier(true);}catch(e){drawFailed=true;this.failLoading(e,'frame');}finally{this.drawPhaseTrace.end({renderEndedMs,diagnosticsEndedMs,error:drawFailed});this.topology.world=previous;}}this.drawLoading();}
 drawLiveMatchHud(){
  const hud=this.liveMatchHud;
  if(!hud)return;
  if(this.game.sessionMenuOpen||this.client.hidden){
   if(hud.frameStart!==null||hud.rttAt!==null)hud.reset();
   return;
  }
  const at=this.monotonic(),connected=this.client.room.connected&&!this.client.resyncing&&!this.client.error&&!this.client.fatal;
  hud.completedFrame(at);
  // A diagnostic footer must never turn a successful battle frame into a
  // load failure on a canvas implementation that cannot render the footer.
  try{hud.draw(this.game.ctx,this.game.canvas,this.runtime.viewport?.()||{},at,connected,this.game.hudGeometry504?.(),this.runtime.nativeText||String,this.game.toastRect?[this.game.toastRect]:[],this.runtime.hudPreferences?.value);}
  catch(_){hud.reset();}
 }
 observeTeamStatus(packet){this.teamNotices.observe(packet,this.adapter.view.roster,Math.max(packet.tick,this.client.state?.tick??packet.tick));}
 drawTeamStatus(){if(!this.teamNotices?.notices.size)return;try{this.teamNotices.draw(this.game.ctx,this.game.canvas,this.runtime.viewport());}catch(error){this.teamNotices.clearDisplay();if(!this.noticeRenderFailed){this.noticeRenderFailed=true;try{this.runtime.diagnosticEvent?.('network-notice-error','NOTICE_RENDER_FAILED');}catch(_){}}}}
 layout(){
  const v=this.runtime.viewport(),w=Math.min(440,v.width-32),x=(v.width-w)/2;
  const y=(v.fullHeight||v.height)-Math.max(70,(v.safeBottom||0)+60)-50;
  const actions=[['retry','重试连接'],['diagnostics','查看联机诊断'],['back','返回房间']];
  if(this.client.room?.room)actions.push(['exit',this.exitStage==='leaving'?'正在退出':this.exitReplay?'重试退出':'退出游戏']);
  const gap=8,buttonWidth=(w-gap)/2;
  return {v,x,w,y,buttons:actions.map(([id,label],i)=>({id,label,x:x+(i%2)*(buttonWidth+gap),y:y+Math.floor(i/2)*50,w:buttonWidth,h:42}))};
 }
 loadingStatus(){
  const client=this.client,error=this.mapError||client.error,waiting=this.awaitingSnapshot();
  const mapDone=!!this.mapWorld,sceneDone=!!(this.scene&&this.scene.sceneRevision===client.state?.sceneRevision);
  const failureIndex={server:0,map:1,scene:2,render:3,ui:3,frame:3}[this.loadingFailure?.stage];
  const index=error?(failureIndex??0):waiting?0:!mapDone?1:!sceneDone?2:3;
  const warming=index===3&&!this.renderPrepared();
  const viewWarming=index===3&&!warming&&this.terrainViewCommitted()&&!this.terrainViewPrepared();
  const serverLabels={connection:'连接服务器',worker:'启动对局',source:'读取游戏规则',terrain:'生成地图',snapshot:'同步对局'};
  const uiLabels={identity:'实体索引',fields:'实体数据',finalize:'界面检查',allocation:'视野内存',visible:'当前视野',explored:'已探索视野',sources:'视野来源'};
  const framePending=!!(this.presentationGeneration===this.mapGeneration&&this.adapter?.view&&!this.uiProgress&&this.renderPrepared()&&this.terrainViewPrepared());
  const labels=[client.resyncing?'重新同步对局':serverLabels[client.loading?.stage]||'服务器准备',this.mapStage==='prepare'?'生成并校验地图':'地图校验','场景载入',warming?(this.renderProgress?.label||'画面准备'):viewWarming?(this.terrainViewProgress?.label||'画面视区准备'):this.uiProgress?(uiLabels[this.uiProgress.stage]||'界面恢复'):framePending?'绘制首帧':'界面恢复'];
  // These counts describe only the named operation. Terrain's estimated ratio
  // and elapsed time never contribute to a loading percentage.
  const p=index===0?client.loading?.stageProgress:index===3?(warming?this.renderProgress:viewWarming?this.terrainViewProgress:this.uiProgress):null;
  const blocked=!!(error||client.hidden||client.resyncing||this.snapshotFloor!=null&&client.snapshotSerial<this.snapshotFloor&&client.state);
  const count=!blocked&&p&&!p.skipped&&Number.isSafeInteger(p.done)&&Number.isSafeInteger(p.total)&&p.total>0&&p.done>=0&&p.done<=p.total?{done:p.done,total:p.total}:null;
  const completed=[!!client.state&&!waiting,mapDone,sceneDone,!!this.firstFrameDrawn&&this.ready()];
  return{index,stages:labels.map((label,i)=>({label,state:i===index&&!completed[3]?(error?'failed':'current'):completed[i]&&i<=index?'done':'pending'})),count,elapsedSeconds:Math.max(0,Math.floor((this.monotonic()-this.loadStarted)/1000))};
 }
 loadingProgress(){const count=this.loadingStatus().count;return count?count.done/count.total:null;}
 drawLoading(){
  this.loadingBackdropDirty=true;
  const c=this.game.ctx,L=this.layout(),{v,x,w}=L,status=this.loadingStatus(),code=this.mapError||this.client.error,compact=(v.fullHeight||v.height)<500,top=Math.max(compact?42:90,(v.safeTop||0)+(compact?30:70));
  c.save();c.setTransform(this.game.canvas.width/v.width,0,0,this.game.canvas.height/(v.fullHeight||v.height),0,0);c.fillStyle='#102a20';c.fillRect(0,0,v.width,v.fullHeight||v.height);c.textAlign='center';c.fillStyle='#f6eac7';c.font=compact?'bold 20px sans-serif':'bold 22px sans-serif';c.fillText(code?(this.client.state?(this.client.recoveryPaused?'自动恢复已暂停 · 请点击重试':this.client.fatal?'联机连接中断':'联机连接中断 · 正在重试'):'联机对局尚未就绪'):'正在加载联机对局',v.width/2,top,w);c.font='14px sans-serif';
  const barrierWaiting=this.client.loadingBarrierEnabled&&this.presentable()&&this.firstFrameDrawn&&!this.ready();
  const detail=code?(this.loadingFailure?this.loadingFailure.name+': '+this.loadingFailure.message:String(code)):barrierWaiting?(this.loadBarrierError?'同步加载状态失败，正在重试':'已完成本机加载 · 等待队友'):'正在'+status.stages[status.index].label+' · 已等待 '+status.elapsedSeconds+' 秒';c.fillText(detail,v.width/2,top+(compact?28:34),w);
  c.font='12px sans-serif';if(this.loadingFailure?.source){const failure=this.loadingFailure,location=failure.presentationReason?failure.presentationReason+' · '+failure.presentationPath:failure.source;c.fillText(location,v.width/2,top+(compact?48:55),w);}
  for(let i=0;i<status.stages.length;i++){const stage=status.stages[i];c.fillStyle=stage.state==='done'?'#b3d28b':stage.state==='current'?'#fff':'#8ba397';c.font='14px sans-serif';c.fillText((stage.state==='done'?'已完成 · ':stage.state==='current'?'正在 · ':stage.state==='failed'?'未完成 · ':'待开始 · ')+stage.label,compact?x+w*(i%2?.75:.25):v.width/2,top+(compact?78+Math.floor(i/2)*30:90+i*30),compact?(w-16)/2:w);}
  if(!code&&status.count){const ratio=status.count.done/status.count.total;c.fillStyle='#284e3f';c.fillRect(x,top+(compact?140:212),w,10);c.fillStyle='#b3d28b';c.fillRect(x,top+(compact?140:212),w*ratio,10);c.font='12px sans-serif';c.fillText('当前步骤 '+status.count.done+' / '+status.count.total,v.width/2,top+(compact?170:242),w);}
  c.fillStyle='#f6eac7';c.font='12px sans-serif';c.fillText('返回房间不会退出队伍；可重新进入继续对局',v.width/2,Math.min(top+(compact?204:280),L.y-24),w);
  if(this.client.loadingBarrierEnabled&&this.loadBarrierView?.enabled!==false){
   const rows=this.loadRows(),rh=compact?13:19,base=L.y-30-Math.ceil(rows.length/3)*rh;
   for(const [i,p]of rows.entries()){const xx=x+(i%3)*w/3,yy=base+Math.floor(i/3)*rh;c.fillStyle=p.state==='ready'?'#b3d28b':p.state==='offline'||p.state==='failed'?'#ffc7a7':'#f6eac7';c.font=compact?'9px sans-serif':'11px sans-serif';c.fillText(`玩家${p.seat+1} ${p.state==='offline'?'离线':p.state==='failed'?'失败':p.state==='ready'?'就绪':p.step+'/5'}`,xx+w/6,yy,w/3-4);}
  }
  for(const originalButton of L.buttons){const b=loadingControlMotion(this).pose(originalButton),s=b.motionScale||1;c.fillStyle='#37654c';c.fillRect(b.x,b.y,b.w,b.h);c.fillStyle='#fff';c.font=(16*s)+'px sans-serif';c.fillText(b.label,b.x+b.w/2,b.y+27*s,b.w-8*s);}c.restore();
 }
 failLoading(value,stage){
  // A temporary start request failure is not a corrupt map/render/authority.
  // Active clients retain the existing single-flight retry timer; health-probe
  // failures before start remain available to explicit retry without a new login.
  if(this.active&&stage==='server'&&isTransientRequestError(value)&&!this.client.fatal){
   // FullGameClient has already classified this request (including the scoped
   // live-Socket heartbeat grace). Do not relabel it as a server failure here.
   this.updateLoadingAnimation();this.runtime.wake?.();return;
  }
  if(this.loadingFailure||!this.active)return;this.cancelTerrainViewWarmup();this.uiQueue?.cancel('error');this.uiPerformance.flush('error');this.playPerformance.flush('error');
  const error=value&&typeof value.message==='string'?value:Error(String(value));
  const source=String(error.stack||'').split('\n').map(line=>line.match(/([A-Za-z0-9_-]+\.js):(\d+)(?::\d+)?/)).find(Boolean);
  const name=/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(error.name)?error.name:'Error';
  const message=String(error.message||'LOAD_FAILED').replace(/https?:\/\/\S+/g,'[address]').slice(0,160);
  const presentationReason=/^[A-Z][A-Z0-9_]{0,63}$/.test(error.presentationReason||'')?error.presentationReason:null;
  const presentationPath=typeof error.presentationPath==='string'&&/^[A-Za-z0-9_.\[\]-]{1,180}$/.test(error.presentationPath)?error.presentationPath:null;
  this.loadingCause=error;this.loadingFailure={name,message,stage,source:source?source[1]+':'+source[2]:stage,...(presentationReason&&presentationPath?{presentationReason,presentationPath}:{})};this.client.loadingFailure=this.loadingFailure;
  this.mapError=message;this.client.fatal=true;this.stopLoadingAnimation();try{this.runtime.diagnosticEvent?.('network-loading-error',JSON.stringify(this.loadingFailure));}catch(_){}this.client.fail(error);this.pollLoadBarrier(true);
 }
 async waitForLoad(task,timeoutMs,code){
  let timer,cancel;const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(code)),timeoutMs);cancel=()=>reject(Error('LOAD_CANCELLED'));});this.loadCancels.add(cancel);
  try{return await Promise.race([task,timeout]);}finally{clearTimeout(timer);this.loadCancels.delete(cancel);}
 }
 cancelLoads(){this.cancelTerrainViewWarmup();this.terrainViewScopeSeen=null;this.terrainViewGuardFailures=0;this.terrainViewDone=null;this.terrainViewResult=null;this.terrainViewCommittedScope=null;this.uiQueue?.cancel('loads');this.uiProgress=null;if(this.mapOperation)this.mapOperation.cancelled=true;if(this.sceneOperation)this.sceneOperation.cancelled=true;if(this.renderOperation)this.renderOperation.cancelled=true;for(const cancel of this.loadCancels)cancel();this.mapOperation=this.sceneOperation=this.renderOperation=null;this.mapBusy=this.sceneBusy=this.renderBusy=false;}
 touch(kind,e){if(!this.active)return this.parent?.touch(kind,e)||false;if(this.personalResultsGateAD?.touch(kind,e))return true;
  const ranking=!this.game.ceremony&&!this.game.sessionMenuOpen&&!this.game.saveSlotsPanel?this.adapter?.view?.publicSurvivalRanking:null;if(!ranking)this.survivalPanelTouch=false;if(ranking){const r=rankingLayout(this.runtime.viewport(),ranking.rows.length),p=(kind==='end'?e.changedTouches:e.touches)?.[0],inside=p&&(p.clientX??p.x)>=r.x&&(p.clientX??p.x)<=r.x+r.w&&(p.clientY??p.y)>=r.y&&(p.clientY??p.y)<=r.y+r.h;if(kind==='start'&&inside){this.survivalPanelTouch=true;return true;}if(this.survivalPanelTouch){if(kind==='end'||kind==='cancel')this.survivalPanelTouch=false;return true;}if(inside)return true;}
  if(this.ready()){this.loadingControlMotionBN?.cancel();return false;}
  try{loadingControlMotion(this).input(kind,e);}catch(_){}
  // Loading consumes touches before the original gesture handlers. Finish
  // an existing minimap peek if readiness changed while the finger was down.
  if((kind==='end'||kind==='cancel')&&this.game.cameraPeek)this.runtime.cancelInput?.();
  const p=(kind==='end'?e.changedTouches:e.touches)?.[0],point=p?{x:p.clientX??p.x,y:p.clientY??p.y}:null;if(kind==='cancel'||e.touches?.length>1){this.down=null;return true;}if(kind==='start')this.down=point;if(kind==='move'&&this.down&&point&&Math.hypot(point.x-this.down.x,point.y-this.down.y)>8)this.down=null;if(kind==='end'){const d=this.down;this.down=null;const b=d&&point&&this.layout().buttons.find(b=>point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h);if(b){if(b.id==='diagnostics'){this.copyMatchDiagnostics();}else if(b.id==='back'){if(!this.exitPromise)this.back();}else if(b.id==='exit')void this.requestExit();else if(!this.exitPromise)void this.retry();}}return true;}
 async ensureScene(){
  if(!this.active||this.awaitingSnapshot()||!this.client.state||this.client.fatal||this.client.error||this.sceneBusy||this.mapError||this.scene?.sceneRevision===this.client.state.sceneRevision)return;
  const generation=this.mapGeneration,snapshot=this.client.state,operation={cancelled:false};this.sceneOperation=operation;this.sceneBusy=true;this.mapStage='scene';
  try{const scene=await this.waitForLoad(this.client.room.request(this.client.path('/scene')),this.requestTimeoutMs,'SCENE_TIMEOUT');if(generation!==this.mapGeneration||!this.active||operation.cancelled)return;this.scene=prepareScene(scene,snapshot);this.sync();}
  catch(e){if(generation===this.mapGeneration&&this.active&&!operation.cancelled)this.failLoading(e,'scene');}
  finally{if(this.sceneOperation===operation){this.sceneOperation=null;this.sceneBusy=false;}this.runtime.wake?.();}
 }
 async ensureRenderWarmup(){
  if(!this.art||!this.active||this.client.hidden||!this.mapWorld||!this.scene||this.scene.sceneRevision!==this.client.state?.sceneRevision||this.renderPrepared()||this.renderBusy||this.mapError||this.client.error||this.client.fatal)return;
  const generation=this.mapGeneration,world=this.mapWorld,operation={cancelled:false};this.renderOperation=operation;this.renderBusy=true;this.mapStage='render';
  const current=()=>!operation.cancelled&&this.active&&!this.client.hidden&&generation===this.mapGeneration&&world===this.mapWorld;
  try{const work=async()=>{for(let attempt=0;attempt<2&&current();attempt++){
    if(attempt===0)await this.runtime.onlineBatArtBN?.prepareOnlineEntry(this.client.state);
    if(await warmSceneRendering({art:this.art,world,includeCollectPoses:false,keepGoing:current,onProgress:progress=>{if(current()){this.renderProgress=progress;this.wakeForState();}}}))return true;
    if(current())this.runtime.diagnosticEvent?.('network-render-interrupted',this.renderProgress?.phase||'unknown');
   }if(current())throw Error('SCENE_RENDER_INTERRUPTED');return false;};
   const done=await this.waitForLoad(work(),this.terrainTimeoutMs,'SCENE_RENDER_TIMEOUT');if(done&&current()){this.renderWorld=world;this.sync();}}
  catch(e){if(current())this.failLoading(e,'render');}
  finally{operation.cancelled=true;if(this.renderOperation===operation){this.renderOperation=null;this.renderBusy=false;}this.updateLoadingAnimation();if(this.active)this.runtime.wake?.();}
 }
 terrainViewScope(packet=this.client.state,scene=this.scene){return{generation:this.mapGeneration,world:this.mapWorld,scene,sceneRevision:scene?.sceneRevision,roomId:packet?.roomId,viewerOwnerId:packet?.viewerOwnerId,epoch:packet?.epoch};}
 terrainViewScopeCurrent(scope){if(!scope)return false;const next=this.terrainViewScope();return['generation','world','scene','sceneRevision','roomId','viewerOwnerId','epoch'].every(key=>scope[key]===next[key]);}
 terrainViewCommitted(){return this.presentationGeneration===this.mapGeneration&&!!this.adapter?.view&&this.terrainViewScopeCurrent(this.terrainViewCommittedScope);}
 initialViewSupported(){return ['prepareTerrainTilesViewAsync','prepareFogCachesViewAsync','prepareHudCachesViewAsync'].some(method=>typeof this.game[method]==='function');}
 terrainViewPrepared(){return !this.initialViewSupported()||this.terrainViewScopeCurrent(this.terrainViewDone);}
 cancelTerrainViewWarmup(){
  if(this.terrainViewRetryTimer!=null)clearTimeout(this.terrainViewRetryTimer);this.terrainViewRetryTimer=null;
  const operation=this.terrainViewOperation;if(operation){operation.cancelled=true;operation.cancel?.();}
  this.terrainViewOperation=null;this.terrainViewBusy=false;this.terrainViewProgress=null;
 }
 planTerrainViewRetry(){
  if(this.terrainViewRetryTimer!=null||!this.active||this.client.hidden||this.client.error||this.client.fatal||this.mapError||this.terrainViewPrepared())return;
  this.terrainViewRetryTimer=setTimeout(()=>{this.terrainViewRetryTimer=null;if(this.active&&!this.client.hidden){this.sync();this.wakeForState();}},0);
 }
 async ensureTerrainViewWarmup(){
  if(!this.initialViewSupported()||!this.active||this.awaitingSnapshot()||this.client.error||this.client.fatal||this.mapError||!this.renderPrepared()||!this.mapWorld||!this.scene||this.scene.sceneRevision!==this.client.state?.sceneRevision||!this.terrainViewCommitted()||this.terrainViewPrepared()||this.terrainViewBusy)return;
  if(this.terrainViewRetryTimer!=null)clearTimeout(this.terrainViewRetryTimer);this.terrainViewRetryTimer=null;
  const scope=this.terrainViewScope(),operation={cancelled:false};this.terrainViewOperation=operation;this.terrainViewBusy=true;this.terrainViewProgress=null;
  if(!this.terrainViewScopeCurrent(this.terrainViewScopeSeen)){this.terrainViewScopeSeen=scope;this.terrainViewGuardFailures=0;}
  const current=()=>!operation.cancelled&&this.terrainViewOperation===operation&&this.active&&!this.awaitingSnapshot()&&!this.client.error&&!this.client.fatal&&!this.mapError&&this.presentationGeneration===scope.generation&&this.terrainViewScopeCurrent(scope);
  const count=value=>Number.isSafeInteger(value?.done)&&Number.isSafeInteger(value?.total)&&value.total>=0&&value.done>=0&&value.done<=value.total?{done:value.done,total:value.total}:{};
  const finish=(value,skipped,reason)=>{
   if(!current())return;
   this.terrainViewResult={complete:!skipped,skipped,reason,...count(value),published:value?.published===true,guardFailures:this.terrainViewGuardFailures,stages:value?.stages};
   this.terrainViewProgress={...count(value),skipped,label:value?.label||'画面视区准备'};this.terrainViewDone=scope;
  };
  let retry=false;
  try{
   let rejectCancellation;const cancelled=new Promise((_,reject)=>{rejectCancellation=reject;});operation.cancel=()=>rejectCancellation(Error('TERRAIN_VIEW_CANCELLED'));
   const task=warmInitialView({game:this.game,world:scope.world,keepGoing:current,onProgress:progress=>{if(current()){this.terrainViewProgress={...count(progress),stage:progress.stage,label:progress.label};this.wakeForState();}},sliceMs:2});
   const result=await this.waitForLoad(Promise.race([task,cancelled]),Math.min(this.terrainTimeoutMs,this.game.localActorPoseWarmupSupported?.()?6000:3000),'TERRAIN_VIEW_TIMEOUT');
   if(!current()){retry=true;return;}
   if(result?.complete===true)finish(result,false,result.reason||'ready');
   else if(['cancelled','superseded','world-changed','artwork-changed','water-changed','cache-changed','view-changed','scene-changed','buildings-changed','vision-changed','state-changed','text-mode-changed','snapshot-changed'].includes(result?.reason)){
    this.terrainViewGuardFailures++;
    if(this.terrainViewGuardFailures>=3)finish(result,true,'unstable-view');else retry=true;
   }else finish(result,true,['cache-budget','scene-unavailable','view-unavailable','memory-constrained','unsupported'].includes(result?.reason)?result.reason:'unsupported-result');
  }catch(error){
   if(current()){
    finish(this.terrainViewProgress,true,error?.message==='TERRAIN_VIEW_TIMEOUT'?'timeout':'warmup-error');
    try{this.runtime.diagnosticEvent?.('network-view-warmup',error?.message==='TERRAIN_VIEW_TIMEOUT'?'TERRAIN_VIEW_TIMEOUT':'TERRAIN_VIEW_FAILED');}catch(_){}
   }else retry=true;
  }finally{
   operation.cancelled=true;
   if(this.terrainViewOperation===operation){this.terrainViewOperation=null;this.terrainViewBusy=false;}
   this.updateLoadingAnimation();if(this.active)this.wakeForState();
   if(retry)this.planTerrainViewRetry();
  }
 }
 async nextRound(){if(this.nextRoundBusy)return;const room=this.client.room;if(!room.playerId||room.room?.host!==room.playerId)throw Error('HOST_ONLY');this.nextRoundBusy=true;try{const snapshot=this.client.state||await room.request(this.client.path());if(!snapshot||!['win','lose'].includes(snapshot.worldView?.state)||!Number.isSafeInteger(snapshot.epoch))throw Error('MATCH_NOT_ENDED');const result=await room.request(this.client.path('/next-round'),{epoch:snapshot.epoch});if(result.previousEpoch!==snapshot.epoch||result.room?.id!==room.room.id||result.room.phase!=='lobby')throw Error('INVALID_SNAPSHOT');room.setRoom(result.room);if(this.active)this.back();this.team.lastEnteredAttemptKey=null;this.team.open=true;this.team.planPoll(0);return result;}finally{this.nextRoundBusy=false;}}
 async retry(){
  if(!this.active||this.retryBusy)return;this.retryBusy=true;this.loadBarrierView=null;this.loadBarrierLastSuccessAt=null;this.loadBarrierPoll=null;this.loadBarrierPollAt=-Infinity;this.loadBarrierError=false;this.snapshotFloor=Number.isSafeInteger(this.client.snapshotSerial)?this.client.snapshotSerial+1:null;this.client.loading=null;const generation=++this.mapGeneration;this.cancelLoads();this.mapError=null;this.loadingFailure=null;this.loadingCause=null;this.client.loadingFailure=null;this.mapWorld=null;this.scene=null;this.renderWorld=null;this.renderProgress=null;this.seen=null;this.failedSnapshot=null;this.firstFrameDrawn=false;this.presentationGeneration=null;this.mapStage='snapshot';this.loadStarted=this.monotonic();
  try{if(!this.client.active)await this.client.start();else await this.client.retry();if(this.active&&generation===this.mapGeneration)this.sync();}
  catch(e){if(this.active&&generation===this.mapGeneration)this.failLoading(e,'server');}
  finally{this.retryBusy=false;}
 }
 exitFeedback(text){
  this.game.saveNotice=text;
  this.game.toast={text,time:text?4500:0};
  this.game.wxUiDirty=true;this.waitingViewKey=null;
  this.runtime.wake?.();
 }
 showPersonalResultsAD(){
  if(!this.active||!this.game.player?.dead||this.exitPromise||this.exitReplay)return false;
  const results=this.adapter?.view?.personalDeathResults??null;
  if(!this.personalResultsGateAD)this.personalResultsGateAD=createDeathResultsGate({
   current:()=>({dead:this.active&&!!this.game.player?.dead,body:this.game.player?.networkId,epoch:this.adapter?.view?.epoch,ownerId:this.client?.state?.viewerOwnerId}),view:()=>this.runtime.viewport(),online:true,text:s=>this.runtime.nativeText(s),wake:()=>this.runtime.wake?.(),
   onAction:(id,scope)=>{if(id==='home'&&this.active&&this.game.player?.dead&&this.game.player.networkId===scope.body&&this.adapter?.view?.epoch===scope.epoch)void this.requestExit({afterResults:true,requireDead:true});}
  });
  const opened=this.personalResultsGateAD.open(results);if(opened)this.runtime.cancelInput?.();return opened;
 }
 requestExit({afterResults=false,requireDead=false}={}){
  if(this.exitPromise)return this.exitPromise;
  if(!afterResults&&!this.exitReplay&&this.active&&this.game.player?.dead){this.showPersonalResultsAD();return Promise.resolve(false);}
  return this.requestExitConfirmedAD(requireDead);
 }
 requestExitConfirmedAD(requireDead=false){
  if(this.exitPromise)return this.exitPromise;
  if(!this.active||this.team.dead||typeof this.team.confirmMatchExit!=='function')return Promise.resolve(false);
  const room=this.client.room,token=room.token,generation=this.mapGeneration,deathScope=requireDead?{id:this.game.player?.networkId,epoch:this.adapter?.view?.epoch}:null;
  const stored=this.exitReplay,expected=stored?.expected||room.room;
  const sessionCurrent=()=>this.active&&!this.team.dead&&generation===this.mapGeneration&&room.token===token;
  const current=()=>sessionCurrent()&&room.room?.id===expected?.id&&room.room?.battleAttempt===expected?.battleAttempt&&(!deathScope||this.game.player?.dead&&this.game.player.networkId===deathScope.id&&this.adapter?.view?.epoch===deathScope.epoch);
  const finish=()=>{
   if(!sessionCurrent()||room.room)throw Error('ROOM_EXIT_UNCONFIRMED');
   this.exitReplay=null;this.exitFeedback('');this.back({suspend:false,openRoom:false});
   this.team.open=false;this.team.seatChoice=null;this.team.stopPoll();this.team.lastEnteredRoom=null;this.team.lastEnteredAttemptKey=null;
   return true;
  };
  const promise=Promise.resolve().then(async()=>{
   if(!expected||!token){this.exitFeedback('还没连上房间，请稍后重试退出');return false;}
   if(stored&&(stored.playerId!==room.playerId||stored.generation!==generation)){this.exitFeedback('房间连接已变化，请重试连接');return false;}
   if(!stored){
    this.exitStage='confirming';this.exitFeedback('请确认是否退出对局');
    if(!await this.team.confirmMatchExit(expected,current)||!current()){
     const reason=this.team.errorCode==='HOST_LEAVE_HANDOFF_REQUIRED'?'测试服无法安全移交房主，原对局仍在进行':'';
     this.exitFeedback(reason);return false;
    }
   }
   this.exitStage='leaving';this.team.exitRequested=true;this.team.busy=true;this.team.stopPoll();
   this.exitFeedback('正在确认退出，请稍候');
   try{
    if(stored){
     await room.refresh({fresh:true});
     if(!sessionCurrent())throw Error('ROOM_CHANGED_NO_ACTION');
     if(!room.room)return finish();
     if(!current())throw Error('ROOM_CHANGED_NO_ACTION');
     const result=await room.request('/api/rooms/'+encodeURIComponent(expected.id),stored.payload);
     if(!sessionCurrent()||!result?.left&&!result?.closed)throw Error('ROOM_EXIT_UNCONFIRMED');
     room.setRoom(null);
    }else{
     await this.team.finishExit(expected,current,{sessionCurrent,onIntent:payload=>{
      this.exitReplay={playerId:room.playerId,generation,expected,payload};
     }});
    }
    return finish();
   }catch(error){
    const code=String(error?.message||'ROOM_EXIT_UNCONFIRMED');
    if(['STALE_REVISION','HOST_LEAVE_HANDOFF_REQUIRED','RECONNECT_REQUIRED','INVALID_COMMAND','INVALID_REQUEST_ID','REQUEST_ID_REUSED'].includes(code)||
       code==='ROOM_CHANGED_NO_ACTION'&&room.room&&!current())this.exitReplay=null;
    if(sessionCurrent()&&this.exitReplay){
     try{await room.refresh({fresh:true});if(sessionCurrent()&&!room.room)return finish();}catch(_){}
    }
    if(sessionCurrent())this.exitFeedback(this.exitReplay?'退出结果待确认，点重试退出查询':'退出未完成，请重试');
    return false;
   }finally{this.team.exitRequested=false;this.team.busy=false;this.team.wake?.();}
  }).finally(()=>{
   if(this.exitPromise===promise){this.exitPromise=null;this.exitStage=null;if(this.active){this.game.wxUiDirty=true;this.waitingViewKey=null;this.runtime.wake?.();}}
  });
  this.exitPromise=promise;return promise;
 }
 back({suspend=true,openRoom=true}={}){this.loadingControlMotionBN?.cancel();if(!this.active)return;this.personalResultsGateAD?.close();this.uiPerformance.flush('back');this.playPerformance.flush('back');this.team.exitConfirming?.cancel();if(suspend)this.adapter?.suspend();this.active=false;this.exitReplay=null;this.exitStage=null;this.teamNotices.clearDisplay();this.runtime.setNetworkWaiting?.(false);this.waitingViewKey=null;this.mapGeneration++;this.cancelLoads();this.stopLoadingAnimation();this.client.dispose();this.drawPhaseTrace.dispose();this.adapter?.dispose();this.feedback?.reset();this.feedback=null;this.adapter=null;this.game.draw=this.offlineDraw;this.team.networkBattleActive=false;this.game.state='start';this.game.sessionMenuOpen=false;this.team.open=openRoom;if(openRoom)this.team.planPoll(0);else this.team.stopPoll();this.runtime.cancelInput?.();this.runtime.wake?.();}
 stopLoadingAnimation(){if(this.animationTimer!==null)clearTimeout(this.animationTimer);this.animationTimer=null;}
 updateLoadingAnimation(){this.pollLoadBarrier();if(!this.ready()){if(this.adapter)this.adapter.localLead=null;this.playPerformance.flush('waiting');}this.runtime.setNetworkWaiting?.(this.active&&!this.ready());if(!this.active||this.client.hidden||this.client.error||this.client.fatal||this.mapError||this.ready()){this.stopLoadingAnimation();return;}if(this.animationTimer!==null)return;this.animationTimer=setTimeout(()=>{this.animationTimer=null;this.runtime.wake?.();this.updateLoadingAnimation();},1000);}
 dispose(){this.loadingControlMotionBN?.cancel();this.cancelTerrainViewWarmup();this.back();this.teamNotices.reset();this.uiQueue?.dispose();if(this.client.onPacketWork===this.packetWorkObserver){this.client.onPacketWork=this.previousPacketObserver;this.client.measureClock=this.previousPacketClock;}if(this.client.onNetworkMetric===this.networkMetricObserver)this.client.onNetworkMetric=this.previousNetworkObserver;if(this.client.room.battleTransportObserver===this.transportObserver)this.client.room.battleTransportObserver=this.previousTransportObserver;if(this.client.room.battleServiceObserver===this.serviceObserver)this.client.room.battleServiceObserver=this.previousServiceObserver;if(this.client.room.battleHeartbeatObserver===this.heartbeatObserver){this.client.room.battleHeartbeatObserver=this.previousHeartbeatObserver;this.client.room.battleMeasureClock=this.previousBattleMeasureClock;}this.unsubscribe?.();this.unsubscribeInvite?.();this.wx.offHide?.(this.hide);this.wx.offShow?.(this.show);if(this.gate.controller===this)this.gate.controller=this.parent;}
async ensureTerrain(){
  if(!this.active||this.awaitingSnapshot()||this.client.hidden||!this.client.state||this.mapWorld||this.mapBusy||this.mapError||this.client.error||this.client.fatal)return;
  const operation={cancelled:false};this.mapOperation=operation;this.mapBusy=true;this.mapProgress=0;this.mapStage='request';
  const generation=this.mapGeneration,api=this.topology,prior=api?.prepared,expected=this.client.state.mapChecksum,clock=this.client.clock||Date.now;
  const cancelled=()=>operation.cancelled||generation!==this.mapGeneration||!this.active;
  const loadStarted=clock();let touched=false;this.runtime.wake?.();
  try{
    if(!api)throw Error('MAP_MISMATCH');
    const m=validateMap(await this.waitForLoad(this.client.room.request(this.client.path('/map')),this.requestTimeoutMs,'MAP_TIMEOUT'));
    if(cancelled())return;if(m.checksum!==expected)throw Error('MAP_MISMATCH');
    const loadMs=clock()-loadStarted,started=clock();let world=null,actual=null;
    for(const candidate of new Set([this.cachedTerrain,api.prepared,api.world])){
      if(!candidate||candidate.width!==m.width||candidate.height!==m.height)continue;
      try{const checksum=geometryChecksum(candidate);if(checksum===m.checksum){world=candidate;actual=checksum;break;}}catch(_){}
    }
    const cacheHit=!!world;
    if(!world){
      this.mapStage='prepare';touched=true;
      await this.waitForLoad(api.prepareAsync(m.zones.map(z=>({...z})),m.width,m.height,()=>{if(cancelled())throw Error('MAP_CANCELLED');},null,m.revision,cancelled),this.terrainTimeoutMs,'MAP_TIMEOUT');
      world=api.prepared||api.world;
    }
    if(cancelled())return;
    if(actual===null)actual=geometryChecksum(world);this.mapDebug={expected:m.checksum,actual,zones:world.zones.length,trees:world.trees.length,lakes:world.lakes.length,loadMs,prepareMs:clock()-started,totalMs:clock()-loadStarted,cacheHit};
    if(actual!==m.checksum)throw Error('MAP_MISMATCH');
    this.cachedTerrain=this.mapWorld=world;this.mapProgress=1;this.mapStage='scene';this.sync();
  }catch(e){if(!cancelled()){this.mapDebug={...this.mapDebug,error:e.message};this.failLoading(e,'map');}}
  finally{operation.cancelled=true;if(this.mapOperation===operation){if(touched)api.prepared=prior;this.mapOperation=null;this.mapBusy=false;}this.updateLoadingAnimation();if(this.active)this.runtime.wake?.();}
}
}
module.exports={FullGameBattle,canReplaceQueuedPresentation,presentationReplacementDecision};
