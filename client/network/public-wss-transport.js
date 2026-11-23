'use strict';
const {observeSocketFailure}=require('./socket-failure-fields');
const {readRuntimeMode}=require('./runtime-mode-flags');
// Only the Socket carrier changes. HTTP identity/session/room calls stay cloud.
function createPublicWssTransport(wx,cloud,{endpoint}={}){
 if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(endpoint))throw Error('INVALID_PUBLIC_WSS_TARGET');
 const allowed=endpoint.replace(/^https:/,'wss:')+'/api/socket',attempts=[];let serial=0;
 const overrides={cloudSocketReport(){return attempts.map(row=>({...row,runtimeMode:{...row.runtimeMode}}));},connectSocket(options){
  const row={attempt:++serial,carrier:'native-public-wss',startedAtMs:Date.now(),taskBound:false,opened:false,closed:false,openCallbacks:0,messageCallbacks:0,preOpenMessages:0,errorCallbacks:0,closeCallbacks:0,sendCalls:0,preOpenSendRejected:0,runtimeMode:readRuntimeMode()};attempts.push(row);if(attempts.length>8)attempts.shift();
  const handlers={open:[],message:[],error:[],close:[]};let task=null,opened=false,closed=false,notified=false;
  const emit=(kind,value)=>{for(const f of [...handlers[kind]])f(value);};const bump=k=>row[k]=Math.min(1000000,(row[k]||0)+1);
  const closeNative=o=>{try{task?.close?.(o||{});}catch{}};
  const failure=(raw,source)=>{if(closed)return;closed=true;row.closed=true;row.failedAtMs=Date.now();let hint='';try{hint=String(raw?.errMsg||raw?.message||'').slice(0,512);}catch{}
   const errMsg=/denied|forbidden|permission|unauthori[sz]ed|\b40[13]\b/i.test(hint)?'NATIVE_SOCKET_DENIED':/timeout|timed out/i.test(hint)?'NATIVE_SOCKET_TIMEOUT':typeof wx?.connectSocket!=='function'?'NATIVE_SOCKET_UNAVAILABLE':'NATIVE_SOCKET_FAILED';row.failureCode=errMsg;
   const safe={errMsg,...(Number.isSafeInteger(raw?.errCode)?{errCode:raw.errCode}:{}),...observeSocketFailure(source,raw),socketFailureObservedAtMs:Date.now(),...(row.connectCalledAtMs?{socketConnectCalledAtMs:row.connectCalledAtMs}:{})};options.fail?.(safe);emit('error',safe);closeNative();
  };
  const proxy={send(o){bump('sendCalls');if(closed||!opened||!task){bump('preOpenSendRejected');o.fail?.({errMsg:'NATIVE_SOCKET_FAILED',...observeSocketFailure('task-state',null)});return;}task.send(o);},close(o={}){if(closed)return;closed=true;row.closed=true;row.intentionalClose=true;row.closedAtMs=Date.now();if(!notified){notified=true;emit('close',{code:o.code||1000,reason:'CLIENT_CLOSED'});}closeNative(o);},onOpen(f){handlers.open.push(f);if(opened&&!closed)Promise.resolve().then(()=>{if(!closed)f({});});},onMessage(f){handlers.message.push(f);},onError(f){handlers.error.push(f);},onClose(f){handlers.close.push(f);}};
  try{
   if(options.url!==allowed||Object.keys(options.header||{}).length)throw Error('permission denied: PUBLIC_WSS_ROUTE_OR_HEADER');
   if(typeof wx?.connectSocket!=='function')throw Error('API_UNAVAILABLE');
   row.connectCalledAtMs=Date.now();const t=wx.connectSocket({url:allowed,tcpNoDelay:true,timeout:8000,...(typeof options.perMessageDeflate==='boolean'?{perMessageDeflate:options.perMessageDeflate}:{}),fail:e=>failure(e,'sdk-fail')});
   if(!t||['send','close','onOpen','onMessage','onError','onClose'].some(k=>typeof t[k]!=='function'))throw Error('INVALID_CLOUD_SOCKET');
   task=t;row.taskBound=true;row.taskBoundAtMs=Date.now();row.taskSource='return';if(closed){closeNative();return proxy;}
   t.onMessage(e=>{bump('messageCallbacks');if(!opened)bump('preOpenMessages');if(row.firstMessageAtMs===undefined)row.firstMessageAtMs=Date.now();if(!closed)emit('message',e);});
   t.onError(e=>{bump('errorCallbacks');if(row.firstErrorAtMs===undefined)row.firstErrorAtMs=Date.now();failure(e,'native-error');});
   t.onClose(e=>{bump('closeCallbacks');closed=true;row.closed=true;row.closedAtMs=Date.now();if(Number.isSafeInteger(e?.code)&&e.code>=0&&e.code<=65535)row.closeCode=e.code;if(!notified){notified=true;emit('close',{...e,...observeSocketFailure('native-close',{errMsg:e?.reason}),socketFailureObservedAtMs:Date.now(),socketConnectCalledAtMs:row.connectCalledAtMs});}});
   t.onOpen(e=>{bump('openCallbacks');if(row.firstOpenCallbackAtMs===undefined)row.firstOpenCallbackAtMs=Date.now();if(closed)return;opened=true;row.opened=true;row.openedAtMs=Date.now();emit('open',{...e,socketConnectCalledAtMs:row.connectCalledAtMs});});row.listenersBoundAtMs=Date.now();
  }catch(e){failure(e,'sdk-call');}
  return proxy;
 }};
 return new Proxy(cloud,{get(target,key){return Object.hasOwn(overrides,key)?overrides[key]:target[key];}});
}
module.exports={createPublicWssTransport};
