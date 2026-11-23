'use strict';
const {WechatRoomClient}=require('./wechat-client');
const {readCapacityPolicy}=require('./room-capacity');
const {createCloudContainerWx}=require('./cloud-container-transport');
const TARGET=Object.freeze({appId:'wxe6064709895531ce',env:'prod-d9gtpq62w7ccdd3c5',service:'demon-elves-qa',endpoint:'https://demon-elves-qa-prod-d9gtpq62w7ccdd3c5-1527127309.ap-shanghai.run.wxcloudrun.com'});
const LABEL='未验证身份 · 临时QA测试（非正式认证）';
const ASSURANCE='UNVERIFIED_QA_WINDOW';
function expiryOf(x){if(x?.verified!==false||x.testOnly!==true||x.identityAssurance!==ASSURANCE||typeof x.expiresAt!=='string')throw Error('QA_IDENTITY_MODE_MISMATCH');const t=Date.parse(x.expiresAt);if(!Number.isFinite(t)||new Date(t).toISOString()!==x.expiresAt)throw Error('QA_EXPIRY_INVALID');return t;}
class QaRoomClient extends WechatRoomClient {
 constructor(wx){super({wx,endpoint:TARGET.endpoint});this.qaExpiresAt=null;this.qaExpired=false;this.state=LABEL;}
 available(){return !!this.wx?.request&&!this.qaExpired;}
 checkWindow(){if(this.qaExpired||(this.qaExpiresAt!==null&&Date.now()>=this.qaExpiresAt)){this.expire();throw Error('QA_WINDOW_EXPIRED');}}
 expire(){this.qaExpired=true;clearTimeout(this.qaTimer);this.token=null;this.connected=false;this.closeBattle();this.state=LABEL+' · 已到期';this.emit({type:'qa-expired'});}
 bindWindow(iso){const time=Date.parse(iso);if(time<=Date.now()||time-Date.now()>1800000)throw Error('QA_WINDOW_EXPIRED');if(this.qaExpiresAt!==null&&time!==this.qaExpiresAt)throw Error('QA_EXPIRY_CHANGED');this.qaExpiresAt=time;clearTimeout(this.qaTimer);this.qaTimer=setTimeout(()=>this.expire(),Math.max(0,time-Date.now()));}
 async request(...args){this.checkWindow();try{const result=await super.request(...args);this.checkWindow();return result;}catch(e){if(e.message==='QA_WINDOW_EXPIRED')this.expire();throw e;}}
 async login(){this.checkWindow();if(this.closed)throw Error('CLIENT_DISPOSED');if(this.busy)return this.busy;
  this.busy=(async()=>{try{
   const h=await this.request('/api/health');expiryOf(h);if(h.ok!==true||h.fullGame!==true||h.presentationSchema!==1||h.storage!=='memory'||h.wechatAuthConfigured!==false)throw Error('QA_HEALTH_INVALID');this.capacityPolicy=readCapacityPolicy(h);this.bindWindow(h.expiresAt);
   const s=await this.request('/api/qa-window/session',{protocol:this.protocol,compat:this.compat});expiryOf(s);
   if(s.expiresAt!==h.expiresAt||s.protocol!==this.protocol||s.compat!==this.compat||typeof s.token!=='string'||!s.token||typeof s.playerId!=='string'||!s.playerId)throw Error('QA_SESSION_INVALID');this.bindWindow(s.expiresAt);this.checkWindow();
   if(this.playerId&&this.playerId!==s.playerId){this.setRoom(null);this.joinedInvites.clear();}
   this.closeBattle();this.socketBlockedError=null;this.token=s.token;this.playerId=s.playerId;this.connected=true;this.lobbyRules=s.lobbyRules||null;this.membershipKnown=Object.prototype.hasOwnProperty.call(s,'room');if(this.membershipKnown)this.setRoom(s.room);this.state=LABEL;
   if(this.pendingInvite&&!this.autoInvitePromise)void this.autoJoinPending({retry:true});return s;
  }catch(e){this.closeBattle();this.connected=false;this.token=null;this.state=LABEL+' · 连接拒绝';throw e;}finally{this.busy=null;}})();return this.busy;
 }
 connectionResult(...args){super.connectionResult(...args);if(!this.qaExpired)this.state=LABEL+(this.connected?' · 已连接':' · 未连接');}
 view(){return {...super.view(),status:this.state,qaWarning:LABEL,testOnly:true,verified:false,identityAssurance:ASSURANCE,expiresAt:this.qaExpiresAt===null?null:new Date(this.qaExpiresAt).toISOString()};}
 dispose(){clearTimeout(this.qaTimer);super.dispose();}
}
function createQaWindowClient(wx){
 if(wx?.getAccountInfoSync?.()?.miniProgram?.appId!==TARGET.appId)throw Error('QA_APPID_MISMATCH');
 const cloud=createCloudContainerWx(wx,TARGET);let client;
 const guarded=new Proxy(cloud,{get(target,key){if(key==='login')return undefined;if(key==='request')return options=>{if(Object.keys(options.header||{}).some(k=>/^x-wx-(openid|appid|unionid|source)$/i.test(k))){options.fail?.({errMsg:'CLOUD_HEADER_DENIED'});return;}return target.request({...options,success:r=>{if(options.url===TARGET.endpoint+'/api/qa-window/session'&&r.statusCode!==201&&r.statusCode>=200&&r.statusCode<300)options.success?.({statusCode:502,data:{error:'QA_SESSION_STATUS_INVALID'}});else options.success?.(r);}});};if(key!=='connectSocket')return target[key];return options=>{
  client.checkWindow();const socket=target.connectSocket(options);
  return {send:o=>{try{client.checkWindow();socket.send(o);}catch{socket.close({});o.fail?.({errMsg:'QA_WINDOW_EXPIRED'});}},close:o=>socket.close(o),onOpen:fn=>socket.onOpen(fn),onError:fn=>socket.onError(fn),onClose:fn=>socket.onClose(fn),onMessage:fn=>socket.onMessage(e=>{try{client.checkWindow();if(typeof e.data==='string'){const m=JSON.parse(e.data);if(m.type==='ready'){expiryOf(m);if(Date.parse(m.expiresAt)!==client.qaExpiresAt)throw Error('QA_EXPIRY_CHANGED');}}fn(e);}catch{fn({data:JSON.stringify({type:'error',error:client.qaExpired?'QA_WINDOW_EXPIRED':'QA_IDENTITY_MODE_MISMATCH'})});socket.close({});}})};
 };}});
 client=new QaRoomClient(guarded);return client;
}
module.exports={createQaWindowClient,TARGET,LABEL};
