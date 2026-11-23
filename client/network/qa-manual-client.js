'use strict';
const {WechatRoomClient}=require('./wechat-client');
const {VERIFY_SOCKET_READY}=require('./socket-ready-policy');
const {readCapacityPolicy}=require('./room-capacity');
const {createCloudContainerWx}=require('./cloud-container-transport');
const {createPublicWssTransport}=require('./public-wss-transport');
const socketConfig=require('./qa-socket-config');
const {safeCode,safeError,stageFor,diagnostic,statusText,UNCERTAIN}=require('./qa-connection');
const TARGET=Object.freeze({appId:'wxe6064709895531ce',env:'prod-d9gtpq62w7ccdd3c5',service:'demon-elves-qa',endpoint:'https://demon-elves-qa-prod-d9gtpq62w7ccdd3c5-1527127309.ap-shanghai.run.wxcloudrun.com'});
const LABEL='未验证身份 · 手动停止QA（非正式认证）';
const ASSURANCE='UNVERIFIED_QA_MANUAL_STOP';
const COLD_HEALTH_TIMEOUT_MS=28000;
const HEALTH_RETRY_CODES=new Set(['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_TIMEOUT','CLOUD_REQUEST_FAILED','SERVICE_FAILED','SERVICE_OVERLOADED','SERVER_CLOSING']);
function manualFlags(x){if(x?.verified!==false||x.testOnly!==true||x.identityAssurance!==ASSURANCE||x.expiresAt!==null||x.lifetime!=='manual-stop')throw Error('QA_IDENTITY_MODE_MISMATCH');}
class QaManualClient extends WechatRoomClient {
 constructor(wx){super({wx,endpoint:TARGET.endpoint});this.qaExpired=false;this.state=LABEL;this.qaGeneration=0;this.qaDiagnosticSerial=0;this.connectionDiagnostic=null;this.pendingSessionOp=null;this.pendingRoomCreation=false;this.pendingRoomCreationRoomId=null;this._creationOp=null;this._creationPromise=null;this._joinOp=null;this._connectionFloor=0;}
 available(){return !!this.wx?.request&&!this.qaExpired;}
 checkWindow(){if(this.qaExpired||this.closed)throw Error('QA_MANUAL_STOPPED');}
 expire(){this.qaGeneration++;this.qaExpired=true;for(const cancel of this.pendingApiCalls)cancel();this.pendingApiCalls.clear();this.token=null;this.connected=false;this.pendingSessionOp=null;this._creationOp=null;this._joinOp=null;this.closeBattle();this.state=LABEL+' · 已停止';this.emit({type:'qa-stopped'});}
 connectionStatusText(){return statusText(this.connectionDiagnostic);}
 note(stage,status,code,started=Date.now(),sdkCode){
  const row=diagnostic(stage,status,code,started,sdkCode);
  this.connectionDiagnostic=row;
  if(row.stage==='health'||row.stage==='session'){
   const history=this.coldConnectionHistory||=[];
   history.push(row);
   if(history.length>12)history.shift();
   this.emit({type:'cold-connection',row});
  }
 }
 coldConnectionReport(){return (this.coldConnectionHistory||[]).map(row=>({...row}));}
 lobbyLatency(at=Date.now()){
  const sample=this.lobbyLatencySample;
  return sample&&at>=sample.at&&at-sample.at<6500?sample.ms:null;
 }
 call(method,arg){
  if(this.closed||this.qaExpired)return Promise.reject(Error('QA_MANUAL_STOPPED'));
  const stage=stageFor(typeof arg?.url==='string'?arg.url.slice(TARGET.endpoint.length):''),generation=this.qaGeneration;
  // 15 seconds is a QA candidate setting, not a claim about the official SDK maximum.
  const timeout=stage==='health'?COLD_HEALTH_TIMEOUT_MS:stage==='battle'?8000:15000;
  const watchdog=timeout+1000;
  const op=stage==='session'?this.pendingSessionOp:stage==='create'?this._creationOp:stage==='join'?this._joinOp:null;
  return new Promise((resolve,reject)=>{
   let done=false,task=null;
   const abort=cause=>{try{task?.abort?.(cause);}catch{}};
   const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);this.pendingApiCalls.delete(cancel);fn(value);};
   const cancel=()=>{finish(reject,Error('REQUEST_SUPERSEDED'));abort('lifecycle');};
   this.pendingApiCalls.add(cancel);
   const remember=(result,error)=>{
    if(!op||this.closed||this.qaExpired||(stage==='session'?this.pendingSessionOp!==op:stage==='create'?this._creationOp!==op:this._joinOp!==op))return;
    if(result){op.result=result;op.outcome=result.statusCode>=200&&result.statusCode<300?'success':result.statusCode>=400&&result.statusCode<500?'rejected':'unknown';op.code=safeCode(result.data?.error);
     if((stage==='create'||stage==='join')&&op.outcome==='success'&&typeof result.data?.id==='string'&&result.data.id.length<=128){op.roomId=result.data.id;if(stage==='create')this.pendingRoomCreationRoomId=op.roomId;}
    }else{op.outcome='unknown';op.code=safeCode(error?.message);}
   };
   const timer=setTimeout(()=>{finish(reject,Error('TIMEOUT'));abort('watchdog');},watchdog);
   try{task=this.wx[method]({...arg,timeout,success:r=>{remember(r);if(this.closed||this.qaExpired||generation!==this.qaGeneration)return finish(reject,Error('REQUEST_SUPERSEDED'));finish(resolve,r);},fail:raw=>{const e=Error(safeCode(raw?.errMsg));if(Number.isSafeInteger(raw?.errCode))e.sdkCode=raw.errCode;remember(null,e);if(this.closed||this.qaExpired||generation!==this.qaGeneration)return finish(reject,Error('REQUEST_SUPERSEDED'));finish(reject,e);}});if(this.closed||this.qaExpired)abort();}
   catch(raw){const e=safeError(raw);remember(null,e);finish(reject,e);}
  });
 }
 async request(path,...args){
  this.checkWindow();const stage=stageFor(path),generation=this.qaGeneration,started=Date.now(),serial=++this.qaDiagnosticSerial;
  let joinOp;
  if(stage==='join'){if(this._joinOp){this.note(stage,'failed','QA_JOIN_UNCONFIRMED');throw Error('QA_JOIN_UNCONFIRMED');}joinOp=this._joinOp={token:this.token,invite:args[0]?.code,outcome:'pending',roomId:null};}
  this.note(stage,'pending','OK',started);
  try{const result=await super.request(path,...args);this.checkWindow();if(generation!==this.qaGeneration)throw Error('REQUEST_SUPERSEDED');if(serial===this.qaDiagnosticSerial)this.note(stage,'ok','OK',started);
   if((path==='/api/health'||path==='/api/heartbeat')&&result&&Date.now()>=started){
    this.lobbyLatencySample={ms:Date.now()-started,at:Date.now()};
   }if(joinOp===this._joinOp)this._joinOp=null;return result;}
  catch(raw){const e=safeError(raw);if(joinOp&&joinOp===this._joinOp){this.membershipKnown=false;if(joinOp.outcome==='rejected'||!UNCERTAIN.has(e.message)&&e.message!=='REQUEST_SUPERSEDED')this._joinOp=null;}if(!this.closed&&!this.qaExpired&&generation===this.qaGeneration&&serial===this.qaDiagnosticSerial)this.note(stage,'failed',e.message,started,e.sdkCode);if(e.message==='QA_MANUAL_STOPPED'&&!this.qaExpired)this.expire();throw e;}
 }
 autoJoinPending(options){
  if(this.autoInvitePromise)return this.autoInvitePromise;
  const op=this._joinOp;
  if(!op)return super.autoJoinPending(options);
  if(op.outcome==='rejected'){this._joinOp=null;this.membershipKnown=false;return super.autoJoinPending(options);}
  if(op.token!==this.token||!op.roomId){this.note('join','failed','QA_JOIN_UNCONFIRMED');this.setInvitation('error','QA_JOIN_UNCONFIRMED');return Promise.resolve(null);}
  // The original join supplied this ID; never infer it from an arbitrary membership.
  const sequence=this.inviteSequence,code=this.pendingInvite;
  const promise=Promise.resolve().then(async()=>{try{
   await this.refresh({fresh:true});if(this.closed||this.qaExpired||this._joinOp!==op||op.token!==this.token)throw Error('QA_JOIN_UNCONFIRMED');
   if(this.room?.id!==op.roomId)throw Error(this.room?'ALREADY_IN_ROOM':'QA_JOIN_UNCONFIRMED');
   this.joinedInvites.set(op.invite,op.roomId);this._joinOp=null;
   if(sequence===this.inviteSequence&&code===op.invite){this.pendingInvite=null;this.setInvitation('joined',null,sequence,code);return this.room;}
   this.setInvitation('error','ALREADY_IN_ROOM');return null;
  }catch(e){if(!this.closed&&!this.qaExpired)this.setInvitation('error',safeCode(e.message),sequence,code);return null;}
  finally{if(this.autoInvitePromise===promise)this.autoInvitePromise=null;}});
  this.autoInvitePromise=promise;return promise;
 }
 async probeHealth(){
  // Only the read-only probe is safe to replay. Session creation has a
  // separate late-response guard and must not be submitted twice.
  const generation=this.qaGeneration;
  try{return await this.request('/api/health');}
  catch(e){
   if(!HEALTH_RETRY_CODES.has(e.message))throw e;
   await new Promise(resolve=>setTimeout(resolve,350));
   this.checkWindow();if(generation!==this.qaGeneration)throw Error('REQUEST_SUPERSEDED');
   return this.request('/api/health');
  }
 }
 async login(){
  this.checkWindow();if(this.busy)return this.busy;
  // A lost session response cannot be safely reissued across unknown backend instances.
  const pending=this.pendingSessionOp;
  if(pending&&pending.outcome!=='success'){this.note('session','failed','QA_SESSION_UNCONFIRMED');throw Error('QA_SESSION_UNCONFIRMED');}
  const generation=++this.qaGeneration,initialToken=this.token;this._connectionFloor=this.requestSerial;
  let stage=pending?'session':'health';
  const promise=Promise.resolve().then(async()=>{try{
   let s;
   if(pending){s=pending.result?.data;}
   else{
    const h=await this.probeHealth();manualFlags(h);if(h.ok!==true||h.fullGame!==true||h.presentationSchema!==1||h.storage!=='memory'||h.wechatAuthConfigured!==false)throw Error('QA_HEALTH_INVALID');
    this.capacityPolicy=readCapacityPolicy(h);
    stage='session';this.pendingSessionOp={generation,outcome:'pending',result:null,code:null};
    s=await this.request('/api/qa-manual/session',{protocol:this.protocol,compat:this.compat});
   }
   manualFlags(s);if(s.protocol!==this.protocol||s.compat!==this.compat||typeof s.token!=='string'||!s.token||typeof s.playerId!=='string'||!s.playerId)throw Error('QA_SESSION_INVALID');
   this.checkWindow();if(generation!==this.qaGeneration||this.token!==initialToken)throw Error('REQUEST_SUPERSEDED');
   if(this.playerId&&this.playerId!==s.playerId){this.setRoom(null);this.joinedInvites.clear();this.retiredInvites.clear();}
   this.closeBattle();this.socketBlockedError=null;this.socketFailureCount=0;this.socketFallbackUntil=0;this.token=s.token;this.playerId=s.playerId;this.connected=true;this.lobbyRules=s.lobbyRules||null;this.membershipKnown=Object.prototype.hasOwnProperty.call(s,'room');if(this.membershipKnown)this.setRoom(s.room);this.pendingSessionOp=null;this.state=LABEL;
   // A quarantined late session is consumed only by this explicit retry, then refreshed.
   if(pending){stage='recover';await this.refresh({fresh:true});}
   if(this.pendingInvite&&!this.autoInvitePromise)void this.autoJoinPending({retry:true});return s;
  }catch(raw){const e=safeError(raw);if(!this.closed&&!this.qaExpired&&generation===this.qaGeneration){
    if(this.pendingSessionOp?.outcome==='rejected')this.pendingSessionOp=null;
    this.closeBattle();this.connected=false;if(this.token===initialToken)this.token=null;this.state=LABEL+' · 连接未完成';
    if(this.connectionDiagnostic?.status!=='failed'||this.connectionDiagnostic.code!==e.message)this.note(stage,'failed',e.message);
   }throw e;
  }finally{if(this.busy===promise)this.busy=null;}});
  this.busy=promise;return promise;
 }
 clearCreation(){this.pendingRoomCreation=false;this.pendingRoomCreationRoomId=null;this._creationOp=null;}
 async recoverCreation(){
  const op=this._creationOp;
  if(!op||!this.token||this.token!==op.token){this.note('recover','failed','ROOM_CREATION_UNCONFIRMED');throw Error('ROOM_CREATION_UNCONFIRMED');}
  if(op.outcome==='rejected'&&op.code!=='ALREADY_IN_ROOM'){this.clearCreation();throw Error(op.code);}
  try{await this.refresh({fresh:true});}catch(e){if(e.message!=='AUTH_REQUIRED')throw e;this.note('recover','failed','ROOM_CREATION_UNCONFIRMED');throw Error('ROOM_CREATION_UNCONFIRMED');}
  if(op!==this._creationOp||this.token!==op.token)throw Error('ROOM_CREATION_UNCONFIRMED');
  if(op.roomId&&this.room?.id===op.roomId){this.clearCreation();return this.room;}
  if(op.outcome==='rejected'){this.clearCreation();if(this.room)return this.room;}
  // A heartbeat alone does not prove which request created a room. Keep the guard.
  this.note('recover','failed','ROOM_CREATION_UNCONFIRMED');throw Error('ROOM_CREATION_UNCONFIRMED');
 }
 async recoverInviteCreation(){
  const code=this._creationOp?.inviteCode;if(!code)return;
  const recovered=await (this._creationPromise||this.recoverCreation());
  if(recovered?.host===this.playerId)this.retiredInvites.set(code,recovered.id);
 }
 ensureLobby(){if(this.pendingInvite&&!this.autoInvitePromise)return super.ensureLobby();if(this.pendingRoomCreation){if(this._creationPromise)return this._creationPromise;const p=this.recoverCreation();this._creationPromise=p;p.finally(()=>{if(this._creationPromise===p)this._creationPromise=null;}).catch(()=>{});return p;}return super.ensureLobby();}
 createRoom({inviteSequence}={}){
  if(this.pendingRoomCreation)return this._creationPromise||this.recoverCreation();
  if(!this.token){if(this.room)this.recordAuthFailure({source:'local',code:'LOGIN_REQUIRED',requestKind:'room-create'});return Promise.reject(Error('LOGIN_REQUIRED'));}
  if(this.autoInvitePromise&&!this.inviteMayCreate(inviteSequence)||this.writePromise)return Promise.reject(Error('ROOM_OPERATION_BUSY'));
  const token=this.token,generation=this.qaGeneration,op={token,generation,inviteCode:this.inviteMayCreate(inviteSequence)?this.pendingInvite:null,outcome:'pending',result:null,roomId:null,code:null};
  this._creationOp=op;this.pendingRoomCreation=true;this.pendingRoomCreationRoomId=null;this.roomVersion++;
  const promise=Promise.resolve().then(async()=>{try{
   const room=await this.request('/api/rooms',{});this.checkWindow();if(generation!==this.qaGeneration||token!==this.token||op!==this._creationOp)throw Error('REQUEST_SUPERSEDED');
   this.setRoom(room);this.clearCreation();return this.room;
  }catch(e){if(!this.closed&&!this.qaExpired&&op===this._creationOp){
    if(e.message==='ALREADY_IN_ROOM'){await this.refresh({fresh:true});if(this.room){this.clearCreation();return this.room;}}
    else if(op.outcome==='rejected'||!UNCERTAIN.has(e.message)&&e.message!=='REQUEST_SUPERSEDED')this.clearCreation();
   }throw e;
  }finally{if(this._creationPromise===promise)this._creationPromise=null;}});
  this._creationPromise=promise;return promise;
 }
 connectionResult(serial,...args){if(this.closed||this.qaExpired||serial<=this._connectionFloor)return;super.connectionResult(serial,...args);this.state=LABEL+(this.connected?' · 已连接':' · 未连接');}
 view(){return {...super.view(),status:this.connected&&!this.confirmedLobbyRoom()?LABEL+' · 云会话已响应，尚未进入房间':this.state,qaWarning:LABEL,testOnly:true,verified:false,identityAssurance:ASSURANCE,expiresAt:null,lifetime:'manual-stop'};}
 dispose(){this.expire();super.dispose();}
}
function createQaManualClient(wx,{socketTransport=socketConfig.mode}={}){
 if(!['cloud','public-wss'].includes(socketTransport))throw Error('INVALID_QA_SOCKET_TRANSPORT');
 if(wx?.getAccountInfoSync?.()?.miniProgram?.appId!==TARGET.appId)throw Error('QA_APPID_MISMATCH');
 const httpCloud=createCloudContainerWx(wx,TARGET),cloud=socketTransport==='public-wss'?createPublicWssTransport(wx,httpCloud,TARGET):httpCloud;let client;
 const guarded=new Proxy(cloud,{get(target,key){if(key===VERIFY_SOCKET_READY)return m=>{client.checkWindow();manualFlags(m);};if(key==='login')return undefined;if(key==='request')return options=>{if(Object.keys(options.header||{}).some(k=>/^x-wx-(openid|appid|unionid|source)$/i.test(k))){options.fail?.({errMsg:'CLOUD_HEADER_DENIED'});return;}return target.request({...options,success:r=>{if(options.url===TARGET.endpoint+'/api/qa-manual/session'&&r.statusCode!==201&&r.statusCode>=200&&r.statusCode<300)options.success?.({statusCode:502,data:{error:'QA_SESSION_STATUS_INVALID'}});else options.success?.(r);}});};if(key!=='connectSocket')return target[key];return options=>{
  client.checkWindow();if(options[VERIFY_SOCKET_READY]!==true)throw Error('QA_SOCKET_POLICY_REQUIRED');const nativeOptions={...options};delete nativeOptions[VERIFY_SOCKET_READY];const socket=target.connectSocket(nativeOptions);
  return {send:o=>{try{client.checkWindow();socket.send(o);}catch{socket.close({});o.fail?.({errMsg:'QA_MANUAL_STOPPED'});}},close:o=>socket.close(o),onOpen:fn=>socket.onOpen(fn),onError:fn=>socket.onError(fn),onClose:fn=>socket.onClose(fn),onMessage:fn=>socket.onMessage(e=>{try{client.checkWindow();}catch{try{fn({data:JSON.stringify({type:'error',error:'QA_MANUAL_STOPPED'})});}finally{socket.close({});}return;}fn(e);})};
 };}});
 client=new QaManualClient(guarded);client.socketTransportKind=socketTransport==='public-wss'?'native':'cloud';return client;
}
module.exports={createQaManualClient,TARGET,LABEL};
