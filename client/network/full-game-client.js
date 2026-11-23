const packetServiceTime=require('./packet-service-time');
const {InputStageTiming}=require('./input-stage-timing');
const {ApplicationHeartbeat}=require('./application-heartbeat');
'use strict';
const {recordRequestFailure}=require('./request-failures');
const {AuthoritativeClient}=require('./authoritative-client');
const {isBattleBackpressure,isSocketAdmissionBusy}=require('./battle-socket');
const {ENGINE_HASH}=require('./presentation-schema');
const {prepareTrustedVision,applyTrustedVisionPatch}=require('./trusted-vision');
const {applyPresentationDelta}=require('./presentation-delta');
// Private capture is synchronous inside applySnapshot and included in packetJsMs.
const {capturePresentationPacket}=require('./presentation-queue');
class FullGameClient extends AuthoritativeClient{
 constructor(room,options={}){super(room,options);this.inputStageTiming=new InputStageTiming();this.requireLoadingBarrier=options.requireLoadingBarrier===true;this.queue=[];this.flushing=false;this.acceptedSeq=0;this.bases=new Map();this.snapshotSerial=0;this.inputRetryAt=0;this.admissionRetryAt=0;this.heartbeatRetryAt=0;this.heartbeatFailures=0;this.snapshotRetryAt=0;this.snapshotFailures=0;this.readOutageSince=null;this.recoveryPaused=false;this.recoveryBudgetMs=Number.isFinite(options.recoveryBudgetMs)&&options.recoveryBudgetMs>0?options.recoveryBudgetMs:60000;}
 heartbeatContext(){const room=this.room,socket=room.socket,roomId=room.room?.id;let unavailable=null;if(!this.active)unavailable='inactive';else if(this.hidden)unavailable='hidden';else if(this.fatal)unavailable='fatal';else if(this.resyncing)unavailable='resyncing';else if(!room.connected)unavailable='disconnected';else if(!roomId)unavailable='no-room';else if(!socket?.ready||socket.boundRoomId!==roomId)unavailable='socket-not-ready';else if(!socket.capabilities?.applicationPing)unavailable='unsupported';else if(socket.pending?.size>=8)unavailable='control-busy';return{socket,roomId,token:room.token,generation:this.generation,epoch:this.epoch,startAttempt:this.startAttempt,roomBattleGeneration:room.battleGeneration||0,unavailable};}
 heartbeatCurrent(ctx){const current=this.heartbeatContext();return ['socket','roomId','token','generation','epoch','startAttempt','roomBattleGeneration'].every(k=>current[k]===ctx[k]);}
 socketProbeReport(){return this.applicationHeartbeat?.report()??{supported:false,count:0,failed:0,samples:[],scope:'No application heartbeat has been started; not evidence of zero latency or loss.'};}
 runSocketProbe(){
  this.socketProbeRequested=false;if(!this.active||this.hidden||this.fatal){this.applicationHeartbeat?.stop(this.hidden?'hidden':'inactive');return;}
  if(!this.applicationHeartbeat)this.applicationHeartbeat=new ApplicationHeartbeat({context:()=>this.heartbeatContext(),onAttempt:promise=>{this.socketProbePromise=promise;const clear=()=>{if(this.socketProbePromise===promise)this.socketProbePromise=null;};promise.then(clear,clear);},onSample:(sample,info)=>{if(info.current&&this.active&&!this.hidden&&!this.fatal){this.recordNetwork('socketRttMs',sample.rttMs);this.recordNetwork('socketProbeServerWorkMs',sample.serverWorkMs);}},onFailure:(error,ctx)=>{
   if(!this.heartbeatCurrent(ctx))return;const authReject=(error?.serverMessage||error?.rpcReply)&&['AUTH_REQUIRED','LOGIN_REQUIRED','NOT_MEMBER','ROOM_UNAVAILABLE','FORBIDDEN','VERIFIED_IDENTITY_REQUIRED'].includes(error.message);let recoverable;if(authReject||ctx.socket.closed||!ctx.socket.ready||['rpc-send','rpc-send-throw'].includes(error?.socketFailureSource))recoverable=this.room.handleSocketFailure?.(error,this.room.requestSerial||0,ctx.token);if(authReject||recoverable===false){if(error.message==='VERIFIED_IDENTITY_REQUIRED')this.fatal=true;this.fail(error,'socket-probe');if(this.fatal)this.applicationHeartbeat?.stop('fatal');}
  },onStale:(error,ctx)=>{if(!this.heartbeatCurrent(ctx))return;let recoverable;if(typeof this.room.handleSocketFailure==='function')recoverable=this.room.handleSocketFailure(error,this.room.requestSerial||0,ctx.token);else{this.room.closeBattle?.();if(!ctx.socket.closed)ctx.socket.close();this.room.connected=false;}if(recoverable===false)this.fail(error,'socket-probe');if(this.active&&!this.hidden&&!this.fatal)this.plan();}});
  this.applicationHeartbeat.start();
 }
 readScheduleReport(){return {...(this.readScheduleStats||{pushRearms:0,wakes:0,watchdogWakes:0,heartbeatWakes:0,snapshotReads:0,heartbeatReads:0})};}
 countReadSchedule(key){const s=this.readScheduleStats||(this.readScheduleStats={pushRearms:0,wakes:0,watchdogWakes:0,heartbeatWakes:0,snapshotReads:0,heartbeatReads:0});s[key]++;}
 bindPush(gen){
  this.room.openBattle?.((packet,source)=>{
   if(!this.active||this.hidden||this.fatal||gen!==this.generation)return;
   if(source&&(source.socket!==this.room.socket||!source.socket?.ready||source.token!==this.room.token||source.roomId!==this.room.room?.id||source.battleGeneration!==(this.room.battleGeneration||0)))return;
   const serial=this.snapshotSerial,priorRevision=this.state?.revision??-1;
   try{this.apply(packet);
    // Only an accepted authorized view can postpone the stale-view watchdog.
    // Keep the independent heartbeat deadline; malformed/old traffic cannot
    // keep a member alive or starve fallback polling.
    if(this.snapshotSerial!==serial&&!this.roundReset){const socket=source?.socket;if(this.state?.revision>priorRevision&&socket&&socket===this.room.socket&&socket.ready&&source.token===this.room.token&&source.roomId===this.room.room?.id&&source.battleGeneration===(this.room.battleGeneration||0)&&socket.boundRoomId===source.roomId){const at=socket.rttClock?.();if(Number.isFinite(at))socket.lastAuthenticatedViewMonoAt=at;}this.pushDrivenAt=this.clock();if(!this.polling){this.countReadSchedule('pushRearms');this.plan();}}
   }catch(error){this.fail(error,'push');}
  });
 }
 async start(){this.applicationHeartbeat?.stop('new-match');this.applicationHeartbeat=null;this.readScheduleStats=null;this.pushDrivenAt=null;this.socketProbeStats=null;this.socketProbeRequested=false;this.probeStatsSocket=null;this.lastSocketProbeAt=null;const attempt=this.startAttempt=(this.startAttempt||0)+1;let health;try{health=await (this.room.probeHealth?.()??this.room.request('/api/health'));}catch(e){if(attempt===this.startAttempt)this.fail(e,'health');throw e;}if(attempt!==this.startAttempt)return;if(health.fullGame!==true||health.presentationSchema!==1)throw Error('FULLGAME_BACKEND_UPDATE_REQUIRED');this.readOutageSince=null;this.recoveryPaused=false;this.inputRetryAt=0;this.admissionRetryAt=0;this.heartbeatRetryAt=0;this.heartbeatFailures=0;this.snapshotRetryAt=0;this.snapshotFailures=0;this.lastAcceptedAt=undefined;this.lastSnapshotPollAt=undefined;this.lastHeartbeatFailure=null;this.loadingBarrierEnabled=health.loadingBarrier===1;if(this.requireLoadingBarrier&&!this.loadingBarrierEnabled)throw Error('FULLGAME_BACKEND_UPDATE_REQUIRED');this.inputStageTiming.reset();try{this.room.wx?.resetHeartbeatStages?.();}catch(_){}this.queue=[];this.roundReset=false;this.acceptedSeq=0;this.bases.clear();return super.start();}
 notify(){if(this.inputSnapshotNotifyDepth>0)return;return super.notify();}
 applyInputSnapshot(snapshot){this.inputSnapshotNotifyDepth=(this.inputSnapshotNotifyDepth||0)+1;try{return this.apply(snapshot);}finally{this.inputSnapshotNotifyDepth--;}}
 deferRead(stage,error){if(!this.state||!['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT','SOCKET_TIMEOUT'].includes(error?.message))return;const key=stage==='heartbeat'?'heartbeat':'snapshot';const n=this[key+'Failures']=(this[key+'Failures']||0)+1;this[key+'RetryAt']=this.clock()+Math.min(30000,2000*2**Math.min(4,n-1));}
 resetReadBackoff(stage){this[stage+'Failures']=0;this[stage+'RetryAt']=0;}
 recordNetwork(key,value){try{this.onNetworkMetric?.(key,value);}catch(_){}}
 startOptions(){return this.loadingBarrierEnabled?{loadingBarrier:1}:{};}
 apply(s,receivedAt){const clock=this.measureClock,measure=typeof clock==='function'&&s?.schema===1&&!['loading','failed','round-reset'].includes(s.status),started=measure?clock():0;try{return this.applySnapshot(s,receivedAt);}finally{if(measure)try{this.onPacketWork?.(Math.max(0,clock()-started));}catch(_){}}}
 applySnapshot(s,receivedAt){const incomingServiceTime=packetServiceTime.get(s);if(s?.status==='round-reset'){if(s.roomId===this.room.room?.id&&s.previousEpoch===this.epoch){this.roundReset=true;this.stopTimer();this.notify();}return false;}if(s?.delta===1){if(s.engineHash!==ENGINE_HASH||s.viewerOwnerId!==this.room.playerId||s.roomId!==this.room.room?.id||this.epoch!==null&&s.epoch!==this.epoch)throw Error('BATTLE_SESSION_MISMATCH');const stale=this.state&&Number.isSafeInteger(s.revision)&&s.revision<=this.state.revision;if(stale&&s.revision<this.state.revision&&!this.resyncing&&!this.forceKeyframe){this.rememberHistoricalDelta(s);return false;}try{s=applyPresentationDelta(this.bases.get(s.baseRevision)||this.state,s,applyTrustedVisionPatch);}catch(e){if(e.message!=='PRESENTATION_REBASE_REQUIRED')throw e;if(stale)return false;this.rebaseDiagnostic={baseRevision:s.baseRevision,revision:s.revision,currentRevision:this.state?.revision,cachedRevisions:[...this.bases.keys()]};this.resyncing=true;this.forceKeyframe=true;this.room.closeBattle?.();this.status='正在重新同步完整视图';this.notify();return false;}}if(s?.status==='loading'||s?.status==='failed')return super.apply(s);if(!s||s.schema!==1||s.engineHash!==ENGINE_HASH)throw Error('FULLGAME_BACKEND_UPDATE_REQUIRED');if(s.roomId!==this.room.room?.id||s.viewerOwnerId!==this.room.playerId||this.epoch!==null&&s.epoch!==this.epoch)throw Error('BATTLE_SESSION_MISMATCH');for(const k of ['epoch','revision','tick','lastSeq'])if(!Number.isSafeInteger(s[k])||s[k]<(k==='epoch'?1:0))throw Error('INVALID_SNAPSHOT');if(typeof s.sceneRevision!=='string'||!/^scene1-[0-9a-f]{8}$/.test(s.sceneRevision))throw Error('INVALID_SNAPSHOT');if(!/^[0-9a-f]{16}-\d{1,8}$/.test(s.mapChecksum)||!Array.isArray(s.entities)||!s.worldView)throw Error('INVALID_SNAPSHOT');if(this.state&&s.revision<this.state.revision&&!this.resyncing&&!this.forceKeyframe)return false;s={...s,vision:prepareTrustedVision(s.vision,s.tick,s)};if(this.state&&(s.mapChecksum!==this.state.mapChecksum||s.tick<this.state.tick&&s.revision>this.state.revision))throw Error('INVALID_SNAPSHOT');s=capturePresentationPacket(s);if(incomingServiceTime)packetServiceTime.mark(s,incomingServiceTime);const recoveredFromPause=this.recoveryPaused;this.snapshotSerial++;this.readOutageSince=null;this.recoveryPaused=false;this.resetReadBackoff('snapshot');this.lastSnapshotAt=Number.isFinite(receivedAt)?Math.max(this.lastSnapshotAt||0,Math.min(this.clock(),receivedAt)):this.clock();this.room.connected=true;this.resyncing=false;this.forceKeyframe=false;this.acceptedSeq=Math.max(this.acceptedSeq,s.lastSeq);this.bases.set(s.revision,s);while(this.bases.size>8)this.bases.delete(Math.min(...this.bases.keys()));if(this.state&&s.revision<=this.state.revision){this.error=null;this.status=this.connectedStatus();this.notify();this.resumeRecoveredReads(recoveredFromPause);return false;}if(this.state){const at=this.measureClock?.();if(Number.isFinite(at)&&Number.isFinite(this.lastAcceptedAt))this.recordNetwork('snapshotGapMs',at-this.lastAcceptedAt);if(Number.isFinite(at))this.lastAcceptedAt=at;this.recordNetwork('snapshotTicks',s.tick-this.state.tick);}else this.lastAcceptedAt=this.measureClock?.();this.previous=this.state;this.state=s;this.epoch=s.epoch;this.loading=null;this.error=null;this.status=this.connectedStatus();this.notify();this.resumeRecoveredReads(recoveredFromPause);return true;}
 rememberHistoricalDelta(delta){
  // A newer authenticated HTTP full view can overtake an ordered push chain.
  // Reconstruct only from an already captured same-scope base. Keep this
  // immutable historical base; never apply it to live state or notify gameplay.
  const base=this.bases.get(delta.baseRevision),current=this.state;if(!base||!current)return;
  try{let value=applyPresentationDelta(base,delta,applyTrustedVisionPatch);
   for(const k of ['epoch','revision','tick','lastSeq'])if(!Number.isSafeInteger(value[k])||value[k]<(k==='epoch'?1:0))return;
   if(value.schema!==1||value.engineHash!==ENGINE_HASH||value.roomId!==this.room.room?.id||value.viewerOwnerId!==this.room.playerId||value.epoch!==this.epoch||value.sceneRevision!==current.sceneRevision||value.mapChecksum!==current.mapChecksum||value.revision>=current.revision||value.tick<base.tick||value.tick>current.tick||value.lastSeq<base.lastSeq||!Array.isArray(value.entities)||!value.worldView)return;
   value=capturePresentationPacket({...value,vision:prepareTrustedVision(value.vision,value.tick,value)});
   this.bases.set(value.revision,value);while(this.bases.size>8)this.bases.delete(Math.min(...this.bases.keys()));
  }catch(_){/* Malformed stale packets remain ignored, as before; no partial base. */}
 }
 observeServerElapsed(sample){const item=this.queue.find(x=>x.command.epoch===sample.epoch&&x.command.seq===sample.seq);if(item){this.inputStageTiming.serverElapsed(item.command,sample.serverElapsedMs,sample.serverPhases);this.inputStageTiming.socketRpc(item.command,sample.clientRpc);}}
 observeServerInputSend(sample){const timing=sample?.timing;if(!timing||this.room.socket?.socketInstance!==sample.socketInstance)return;const item=this.queue.find(x=>x.command.epoch===timing.epoch&&x.command.seq===timing.seq);if(item)this.inputStageTiming.serverInputSend(item.command,sample);this.inputStageTiming.completedServerInputSend(sample);}
 observeInputTransport(transport,sample){if(!sample||!Number.isSafeInteger(sample.epoch)||!Number.isSafeInteger(sample.seq))return;const item=this.queue.find(x=>x.command.epoch===sample.epoch&&x.command.seq===sample.seq);if(item)this.inputStageTiming.transport(item.command,transport,sample);}
 inputStageReport(){const atMs=this.measureClock?.();return {...this.inputStageTiming.report(),clockAnchor:{atMs:Number.isFinite(atMs)?atMs:null,atWallMs:Date.now(),scope:'battle-local monotonic position anchored at export only; not server clock synchronization or wire timing'}};}
 observeInputView(command,at){this.inputStageTiming.confirmedView(command,at);}
 observeInputReceipt(command,at){this.inputStageTiming.observedReceipt(command,at);}
 connectedStatus(){return this.state?.worldView?.state==='win'?'全队胜利':this.state?.worldView?.state==='lose'?'全队失败':'已连接权威世界';}
 liveSocketFresh(){return !!(this.active&&!this.hidden&&!this.fatal&&!this.resyncing&&!this.forceKeyframe&&this.state?.tick>0&&this.state.roomId===this.room.room?.id&&this.state.viewerOwnerId===this.room.playerId&&this.state.epoch===this.epoch&&this.room.socket?.ready&&this.room.socket.boundRoomId===this.room.room?.id&&this.clock()-this.lastSnapshotAt>=0&&this.clock()-this.lastSnapshotAt<600);}
 resumeRecoveredReads(wasPaused){if(wasPaused&&this.active&&!this.hidden&&!this.fatal){this.plan();void this.flush();}}
 recoveryStatus(){return {paused:this.recoveryPaused,startedAtMs:this.readOutageSince,elapsedMs:Number.isFinite(this.readOutageSince)?Math.max(0,this.clock()-this.readOutageSince):0,budgetMs:this.recoveryBudgetMs};}
 pauseExpiredRecovery(stage='snapshot'){
  if(this.recoveryPaused)return true;
  if(!Number.isFinite(this.readOutageSince)||this.clock()-this.readOutageSince<this.recoveryBudgetMs)return false;
  this.recoveryPaused=true;this.stopTimer();super.fail(Error('RECOVERY_PAUSED'),stage);this.status='自动恢复已暂停，请点击重试；本地会话和待确认操作仍保留';return true;
 }
 async retry(){if(!this.active||this.hidden||this.polling||this.busy||this.retrying)return;this.readOutageSince=null;this.recoveryPaused=false;this.resetReadBackoff('heartbeat');this.resetReadBackoff('snapshot');return super.retry();}
 fail(e,sourceStage=this.requestStage){
  recordRequestFailure(this,e,sourceStage);
  if(this.state&&['heartbeat','snapshot','input'].includes(sourceStage)&&['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT','SOCKET_TIMEOUT'].includes(e.message)&&!this.liveSocketFresh()){if(!Number.isFinite(this.readOutageSince))this.readOutageSince=this.clock();if(this.pauseExpiredRecovery(sourceStage))return;}
  // A failed HTTP heartbeat is not proof that a still-authenticated Socket
  // stopped delivering this member's authoritative world. Never apply this
  // grace to membership/auth rejection, stale views, or other request stages.
  if(sourceStage==='heartbeat'&&['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT'].includes(e.message)&&this.liveSocketFresh()){
   this.lastHeartbeatFailure={code:e.message,at:this.clock()};this.recordNetwork('heartbeatWarning',1);this.room.connected=true;
   this.status='连接波动 · 对局同步正常';this.notify();return;
  }
  if(/DENIED|FORBIDDEN|FULLGAME_BACKEND|INVALID_PRESENTATION|PRESENTATION_|ENGINE_HASH|INVALID_GAME_FEEDBACK|FEEDBACK_|RENDER_UNAVAILABLE|SCENE_MISMATCH|SCENE_DYNAMIC/.test(e.message)){this.fatal=true;this.stopTimer();}super.fail(e,sourceStage);if(this.fatal){this.recoveryPaused=false;this.room.closeBattle?.();for(const p of this.queue)p.reject(e);this.queue=[];}}
 input(command){if(!this.active||this.fatal||this.recoveryPaused||this.hidden||this.resyncing||!this.state||!this.room.connected)throw Error('INPUT_UNAVAILABLE');if(this.queue.length>=16)return false;
 if(command.action==='joystick'){
  const moving=!!(command.args.dx||command.args.dy);
  // Unsent moving intent must not sit behind a different action and later
  // restart motion after release. Returning false reserves no sequence; the
  // adapter samples the latest stick again after the accepted queue drains.
  const queuedSticks=this.queue.filter(item=>item.command.action==='joystick');
  if(moving&&this.queue.length||!moving&&queuedSticks.some(item=>!(item.command.args.dx||item.command.args.dy)))return false;
 }const expected=this.queue.length?this.queue[this.queue.length-1].command.seq+1:this.acceptedSeq+1;if(command.epoch!==this.epoch||command.seq!==expected)throw Error('INVALID_SEQUENCE');const queuedAt=this.measureClock?.();this.inputStageTiming.queued(command,queuedAt);const promise=new Promise((resolve,reject)=>this.queue.push({command,resolve,reject,queuedAt}));this.tryOrderedNeutral();void this.flush();return promise;}
 tryOrderedNeutral(){
  if(!this.flushing||this.hidden||this.fatal||this.resyncing||this.recoveryPaused||this.queue.length!==2||typeof this.room.beginOrderedNeutral!=='function')return;
  const [previous,item]=this.queue,a=previous.command,b=item.command;
  if(!previous.attempted||a.action!=='joystick'||!(a.args.dx||a.args.dy)||b.action!=='joystick'||b.args.dx||b.args.dy||a.epoch!==b.epoch||b.seq!==a.seq+1||item.earlyControl)return;
  const sentAt=this.measureClock?.(),headers=this.state&&!this.forceKeyframe?{'X-Presentation-Revision':String(this.state.revision),'X-Presentation-Vision':'2'}:{};
  const pending=this.room.beginOrderedNeutral(this.path('/input'),b,headers,a);if(!pending||typeof pending.then!=='function')return;
  if(!item.attempted){this.recordNetwork('inputQueueMs',sentAt-item.queuedAt);item.attempted=true;}
  this.inputStageTiming.attempt(b,sentAt);
  item.earlyControl={sentAt,result:pending.then(value=>({value}),error=>({error}))};
 }

 async flush(){if(this.recoveryPaused||this.flushing||!this.queue.length||!this.active||this.hidden||this.fatal||this.clock()<this.inputRetryAt)return;this.flushing=true;this.admissionRetryAt=0;const gen=this.generation;let admissionBusy=false;try{while(this.queue.length&&this.active&&!this.hidden&&!this.fatal&&!this.recoveryPaused&&gen===this.generation){const item=this.queue[0];this.requestStage='input';const sentAt=item.earlyControl?.sentAt??this.measureClock?.();if(!item.attempted&&Number.isFinite(sentAt)){this.recordNetwork('inputQueueMs',sentAt-item.queuedAt);item.attempted=true;}let result;if(!item.earlyControl)this.inputStageTiming.attempt(item.command,sentAt);try{if(item.earlyControl){const early=await item.earlyControl.result;if(early.error){item.earlyControl=null;throw early.error;}result=early.value;}else result=await this.room.request(this.path('/input'),item.command,this.state&&!this.forceKeyframe?{'X-Presentation-Revision':String(this.state.revision),'X-Presentation-Vision':'2'}:{});}catch(e){
 if(gen!==this.generation)return;
 // A retired transport cannot invalidate the current room or drop ordered input.
 if(e.message==='REQUEST_SUPERSEDED')break;
 this.recordNetwork('inputFailureMs',this.measureClock?.()-sentAt);
 if(isSocketAdmissionBusy(e)){
  // No wire send occurred. Keep the exact command/sequence and permit
  // existing pending replies to drain without disconnecting the room.
  this.inputRetryAt=this.admissionRetryAt=this.clock()+50;admissionBusy=true;break;
 }
 if(isBattleBackpressure(e)&&this.state&&!this.resyncing){
  // Preserve input order and sequence. Refresh resumes the same command.
  this.recordNetwork('overload',1);this.inputRetryAt=this.clock()+300;break;
 }
 this.fail(e,'input');if(this.fatal){for(const p of this.queue)p.reject(e);this.queue=[];}break;
 }if(gen!==this.generation)return;const r=result.receipt;if(!r||r.seq!==item.command.seq||r.epoch!==item.command.epoch||typeof r.accepted!=='boolean'){this.fail(Error('INVALID_SNAPSHOT'),'input');break;}const responseObservedAt=this.measureClock?.();this.inputStageTiming.response(item.command,responseObservedAt);this.recordNetwork('inputRequestMs',responseObservedAt-sentAt);const inputCommitStarted=responseObservedAt;if(result.snapshotOmitted===true){if(result.snapshot!==undefined||!['joystick','stop','cameraGuide','move'].includes(item.command.action))throw Error('INVALID_SNAPSHOT');}else this.applyInputSnapshot(result.snapshot);this.queue.shift();this.acceptedSeq=Math.max(this.acceptedSeq,r.seq);item.resolve(r);this.notify();this.recordNetwork('inputCommitJsMs',this.measureClock?.()-inputCommitStarted);this.inputStageTiming.completedReceipt(item.command,r,this.measureClock?.());}}catch(e){this.fail(e,'input');}finally{if(gen===this.generation){this.flushing=false;if(this.socketProbeRequested)this.runSocketProbe();if(admissionBusy)this.plan();}}}
 async refresh(){
  if(!this.active||this.hidden||this.fatal||this.polling)return;
  if(this.pauseExpiredRecovery())return;
  this.polling=true;const gen=this.generation;let snapshotDeadline=null,refreshStage='snapshot',heartbeatFailure=null,heartbeatDeferred=false;
  const readSnapshot=async()=>{
   const roomId=this.room.room?.id;if(!roomId)throw Error('BATTLE_SESSION_MISMATCH');
   const headers=this.state&&!this.forceKeyframe?{'X-Presentation-Revision':String(this.state.revision),'X-Presentation-Vision':'2'}:{};
   const pollStarted=this.clock(),measuredStart=this.measureClock?.();
   if(Number.isFinite(measuredStart)&&Number.isFinite(this.lastSnapshotPollAt))this.recordNetwork('snapshotPollStartGapMs',measuredStart-this.lastSnapshotPollAt);
   this.lastSnapshotPollAt=measuredStart;
   const socket=this.room.socket,token=this.room.token,battleGeneration=this.room.battleGeneration||0;
   const fromSocket=!!(socket?.ready&&socket.boundRoomId===roomId&&!(this.room.socketFallbackUntil>Date.now()));
   this.countReadSchedule('snapshotReads');const packet=await this.room.request(this.path(),undefined,headers),completedAt=this.clock();
   const socketProof=fromSocket&&this.room.socket===socket&&socket.ready&&socket.boundRoomId===roomId&&this.room.token===token&&(this.room.battleGeneration||0)===battleGeneration&&this.room.room?.id===roomId;
   if(gen===this.generation)this.recordNetwork('snapshotRequestMs',this.measureClock?.()-measuredStart);
   return {packet,pollStarted,completedAt,roomId,socketProof};
  };
  try{
   if(!this.state&&this.clock()-this.loadingSince>=this.loadingTimeoutMs)throw Error('INITIALIZATION_TIMEOUT');
   const knownMember=this.room.membershipKnown===true&&!!this.room.token&&this.state?.roomId===this.room.room?.id&&this.state?.viewerOwnerId===this.room.playerId&&this.state?.epoch===this.epoch;
   const staleReady=knownMember&&this.state.tick>0&&this.room.socket?.ready===true&&this.room.socket.boundRoomId===this.room.room.id&&this.clock()-this.lastSnapshotAt>=600;
   const heartbeatDue=(this.clock()-this.lastHeartbeat>=3000||!this.room.connected)&&this.clock()>=(this.heartbeatRetryAt||0);if(heartbeatDue){this.socketProbeRequested=true;this.runSocketProbe();}
   // Only overlap two authorized reads in an already-connected active match.
   // Initial login, unknown membership and lobby transitions remain serial.
   // A known existing member may start two authenticated reads together while
   // recovering. A transient HTTP failure may instead use a fresh reply from
   // the same authenticated Socket; auth denial always wins.
   const knownRecovery=this.room.membershipKnown===true&&!!this.room.token&&(this.resyncing||!this.room.connected);
   const overlap=heartbeatDue&&this.clock()>=(this.snapshotRetryAt||0)&&this.state&&((this.room.connected&&!this.resyncing)||knownRecovery)&&
    ['development-slice','finished'].includes(this.room.room?.phase)&&(this.room.socket?.ready!==true||staleReady);
   let snapshotResult=null;
   if(overlap){
    const scope=this.room.room.id;this.requestStage='heartbeat-snapshot';
    const results=await Promise.allSettled([Promise.resolve().then(()=>{this.countReadSchedule('heartbeatReads');return this.room.refresh();}),Promise.resolve().then(readSnapshot)]);
    if(gen!==this.generation||this.hidden||!this.active)return;
    if(results[0].status==='rejected'){
     heartbeatFailure=results[0].reason;refreshStage='heartbeat';this.deferRead('heartbeat',heartbeatFailure);heartbeatDeferred=true;
     if(results[1].status==='rejected'){
      const snapshotError=results[1].reason;
      if(!['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT','SOCKET_TIMEOUT'].includes(snapshotError?.message)){refreshStage='snapshot';throw snapshotError;}
      recordRequestFailure(this,snapshotError,'snapshot');this.deferRead('snapshot',snapshotError);
     }
     if(knownMember&&['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT'].includes(heartbeatFailure?.message)&&results[1].status==='fulfilled'){
      let probe=results[1].value;
      // A flag is not liveness. Only an actual reply on the still-owned,
      // authenticated bound Socket can supply the independent membership proof.
      if(probe.socketProof&&this.clock()-probe.completedAt>500){refreshStage='snapshot';probe=await readSnapshot();}
      if(probe.socketProof&&this.room.room?.id===scope&&gen===this.generation&&!this.hidden&&this.active&&this.clock()-probe.completedAt>=0&&this.clock()-probe.completedAt<=500){
       refreshStage='snapshot';this.requestStage='snapshot';
       this.apply(probe.packet,probe.completedAt);
       this.fail(heartbeatFailure,'heartbeat');
       if(!this.error&&!this.fatal&&this.liveSocketFresh())void this.flush();
       return;
      }
     }
     refreshStage='heartbeat';throw heartbeatFailure;
    }
    this.resetReadBackoff('heartbeat');this.lastHeartbeat=this.clock();
    if(this.room.room?.id!==scope)throw Error('BATTLE_SESSION_MISMATCH');
    snapshotResult=results[1];
   }else if(heartbeatDue){refreshStage='heartbeat';this.requestStage='heartbeat';this.countReadSchedule('heartbeatReads');await this.room.refresh();this.resetReadBackoff('heartbeat');this.lastHeartbeat=this.clock();refreshStage='snapshot';}
   if(gen!==this.generation||this.hidden||!this.active)return;
   if(!this.room.room)throw Error('BATTLE_SESSION_MISMATCH');
   if(this.state&&this.room.room.phase==='lobby'){this.roundReset=true;this.stopTimer();this.notify();return;}
   const fresh=this.room.socket?.ready&&this.room.socket.boundRoomId===this.room.room.id&&this.state&&!this.forceKeyframe&&this.clock()-this.lastSnapshotAt<2000;
   if((snapshotResult||!fresh||staleReady)&&this.clock()>=(this.snapshotRetryAt||0)){
    this.requestStage='snapshot';let result;
    if(snapshotResult){if(snapshotResult.status==='rejected')throw snapshotResult.reason;result=snapshotResult.value;}
    else result=await readSnapshot();
    if(gen!==this.generation||this.hidden||!this.active)return;
    // Membership succeeded before applying any parallel response. Present the
    // already-returned authoritative packet with its actual receive age, then
    // fetch at most one fresher packet instead of withholding both updates.
    if(snapshotResult&&this.clock()-result.completedAt>500){
     if(this.room.room?.id!==result.roomId)throw Error('BATTLE_SESSION_MISMATCH');
     this.apply(result.packet,result.completedAt);
     if(gen!==this.generation||this.hidden||!this.active||this.fatal||this.roundReset)return;
     result=await readSnapshot();
    }
    if(gen!==this.generation||this.hidden||!this.active)return;
    if(this.room.room?.id!==result.roomId)throw Error('BATTLE_SESSION_MISMATCH');
    this.apply(result.packet);
    if(this.state&&!this.resyncing&&this.room.socket?.ready!==true)snapshotDeadline=result.pollStarted+500;
   }
   if(!this.resyncing&&!this.error&&this.room.connected)void this.flush();
  }catch(e){if(gen===this.generation&&isSocketAdmissionBusy(e)&&this.admissionRetryAt&&this.queue.length)this.admissionRetryAt=this.clock()+50;if(gen===this.generation&&e.message!=='REQUEST_SUPERSEDED'&&!isSocketAdmissionBusy(e)&&!(this.state&&!this.resyncing&&isBattleBackpressure(e))){if(heartbeatFailure&&e!==heartbeatFailure)recordRequestFailure(this,heartbeatFailure,'heartbeat');if(refreshStage==='heartbeat'&&!heartbeatDeferred)this.deferRead('heartbeat',e);else if(refreshStage==='snapshot')this.deferRead('snapshot',e);this.fail(e,refreshStage);if(!this.error&&!this.fatal&&this.liveSocketFresh())void this.flush();}}
  finally{if(gen===this.generation){this.polling=false;this.plan(snapshotDeadline);}}
 }
 hide(){this.applicationHeartbeat?.stop('hidden');super.hide();}
 show(){this.forceKeyframe=true;this.resyncing=true;super.show();this.applicationHeartbeat?.start();}

 // A successful HTTP snapshot targets a500ms start-to-start cadence, rather
 // than adding500ms after its network/worker cost. Still one refresh in flight;
 // slow requests cannot overlap, failed reads use bounded backoff, and fresh WSS
 // pushes do not trigger extra snapshots. This does not reduce physical RTT.
 plan(snapshotDeadline=null){
  if(this.recoveryPaused||this.roundReset){this.stopTimer();return;}
  if(this.fatal)return super.plan();
  this.stopTimer();if(!this.active||this.hidden)return;
  let delay=Number.isFinite(snapshotDeadline)?Math.max(0,Math.min(500,snapshotDeadline-this.clock())):500,reason='fallback';
  // This is a read watchdog, not a game tick or a heartbeat frequency change.
  // Healthy pushes drive state; timers wake at the first actual stale-view or
  // heartbeat deadline. Missing pushes still recover within the existing600ms
  // freshness bound, rather than waiting for the next500ms polling bucket.
  if(!Number.isFinite(snapshotDeadline)&&!this.error&&this.room.connected&&this.room.membershipKnown===true&&this.room.token&&['development-slice','finished'].includes(this.room.room?.phase)&&this.liveSocketFresh()&&Number.isFinite(this.pushDrivenAt)&&this.clock()-this.pushDrivenAt>=0&&this.clock()-this.pushDrivenAt<600&&Number.isFinite(this.lastHeartbeat)){
   const now=this.clock(),staleAt=this.lastSnapshotAt+600,heartbeatAt=Math.max(this.lastHeartbeat+3000,this.heartbeatRetryAt||0);
   const deadline=Math.min(staleAt,heartbeatAt);delay=Math.max(0,deadline-now);reason=heartbeatAt<=staleAt?'heartbeat':'watchdog';
  }
  // Reuse the existing lifecycle-owned timer for unsent local-capacity retry;
  // healthy pushes must not postpone the retained command until membership is due.
  if(this.admissionRetryAt&&this.queue.length&&!this.flushing&&!this.resyncing&&!this.error&&this.room.connected){const retryDelay=Math.max(0,this.admissionRetryAt-this.clock());if(retryDelay<delay){delay=retryDelay;reason='input';}}
  this.timer=this.schedule(()=>{this.timer=null;this.countReadSchedule('wakes');if(reason==='watchdog')this.countReadSchedule('watchdogWakes');if(reason==='heartbeat')this.countReadSchedule('heartbeatWakes');void this.refresh();},delay);
 }
 dispose(){this.flushing=false;this.applicationHeartbeat?.stop('disposed');this.startAttempt=(this.startAttempt||0)+1;for(const p of this.queue)p.reject(Error('CLIENT_DISPOSED'));this.queue=[];this.bases.clear();super.dispose();}
}
module.exports={FullGameClient};
