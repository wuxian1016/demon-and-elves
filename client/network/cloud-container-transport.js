const {readRuntimeMode}=require('./runtime-mode-flags');
const {stageOf,safeRows,responseFields}=require('./cloud-response-diagnostics');
const {observeSocketFailure}=require('./socket-failure-fields');
// Isolated Mini Game Cloud Hosting transport. No secrets and no public fallback.
function createCloudContainerWx(wx,{env,service,endpoint,perMessageDeflate,initTimeoutMs=8000,measureClock}={}){
 if(!/^[-a-z0-9]+$/.test(env||'')||!/^[-a-z0-9]+$/.test(service||''))throw Error('INVALID_CLOUD_TARGET');
 if(typeof endpoint!=='string'||!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(endpoint))throw Error('INVALID_CLOUD_ORIGIN');const origin=endpoint;
 const now=typeof measureClock==='function'?measureClock:()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
 const heartbeatSamples=[];let heartbeatCount=0,heartbeatGeneration=0,heartbeatSerial=0;const heartbeatAwait=new WeakMap();
 const rankSamples=()=>{heartbeatSamples.sort((a,b)=>(b.totalThroughAwaitMs??b.totalMs)-(a.totalThroughAwaitMs??a.totalMs));if(heartbeatSamples.length>8)heartbeatSamples.length=8;};
 let initialization=null;const responseFailures=[],socketAttempts=[];let socketAttemptSerial=0;
 const recordResponse=(stage,phase,response)=>{try{const fields={...responseFields(response),stage,phase},at=Date.now(),last=responseFailures[responseFailures.length-1];if(last&&Object.keys(fields).every(k=>last[k]===fields[k])){last.lastAtMs=at;last.count=Math.min(1000000,last.count+1);}else{responseFailures.push({...fields,firstAtMs:at,lastAtMs:at,count:1});if(responseFailures.length>8)responseFailures.shift();}}catch{}};
 const init=()=>{
  if(!wx?.cloud?.init||!wx.cloud.callContainer)throw Error('CLOUD_API_UNAVAILABLE');
  if(!initialization){
   let next;
   const attempt=new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
    const timer=setTimeout(()=>finish(reject,Error('CLOUD_INIT_TIMEOUT')),Number.isFinite(initTimeoutMs)&&initTimeoutMs>0?initTimeoutMs:8000);
    Promise.resolve().then(()=>wx.cloud.init({env})).then(value=>finish(resolve,value),error=>finish(reject,error));
   });
   next=attempt.catch(error=>{if(initialization===next)initialization=null;throw error;});
   initialization=next;
  }
  return initialization;
 };
 const route=url=>{if(typeof url!=='string')throw Error('CLOUD_ROUTE_DENIED');const base=url.startsWith(origin+'/')?origin:url.startsWith(origin.replace(/^https:/,'wss:')+'/')?origin.replace(/^https:/,'wss:'):null;if(!base)throw Error('CLOUD_ROUTE_DENIED');const path=url.slice(base.length);if(!/^\/api\/[A-Za-z0-9_/-]+$/.test(path))throw Error('CLOUD_ROUTE_DENIED');return path;};
 const headers=input=>{const h={};for(const [k,v]of Object.entries(input||{})){if(['host','origin','x-wx-service','x-forwarded-host','x-forwarded-for'].includes(k.toLowerCase()))throw Error('CLOUD_HEADER_DENIED');h[k]=v;}return h;};
 const category=(e,prefix)=>{const text=String(e?.errMsg||e?.message||'');return /denied|forbidden|permission|unauthori[sz]ed|\b40[13]\b/i.test(text)?prefix+'_DENIED':/timeout|timed out/i.test(text)?prefix+'_TIMEOUT':prefix+'_FAILED';};
 const sdkCode=e=>Number.isSafeInteger(e?.errCode)?{errCode:e.errCode}:{};
 const overrides={
 cloudFailureReport(){return safeRows(responseFailures);},
 resetHeartbeatStages(){heartbeatGeneration++;heartbeatCount=0;heartbeatSerial=0;heartbeatSamples.length=0;},
 observeHeartbeatAwaited(value){const pending=value&&typeof value==='object'?heartbeatAwait.get(value):null;if(!pending||pending.generation!==heartbeatGeneration||pending.observed)return;pending.observed=true;pending.row.awaitResumeMs=Math.max(0,now()-pending.deliveredAt);pending.row.totalThroughAwaitMs=pending.row.totalMs+pending.row.awaitResumeMs;if(!heartbeatSamples.includes(pending.row))heartbeatSamples.push(pending.row);rankSamples();},
 heartbeatStageReport(){return {schema:1,count:heartbeatCount,samples:heartbeatSamples.map(r=>({...r})),wireRttMs:null,serverProcessingMs:null};},
 cloudSocketReport(){return socketAttempts.map(row=>({...row}));},
 request(options){
  let done=false,task=null,phase='route-check',failureRecorded=false;const stage=stageOf(options.url);
  const measured=options.url===origin+'/api/heartbeat',started=measured?now():null,generation=heartbeatGeneration,sample=measured?++heartbeatSerial:0;let sdkAt=null,callbackAt=null,probe=null,probeDue=null,probeCount=0,maxLoopDelay=null,jsonParseMs=0;
  const probeLoop=()=>{const due=now()+64;probeDue=due;probe=setTimeout(()=>{if(done)return;probeCount++;maxLoopDelay=Math.max(maxLoopDelay??0,Math.max(0,now()-due));probeLoop();},64);};
  if(measured)probeLoop();
  const markCallback=()=>{if(measured&&callbackAt===null)callbackAt=now();};
  const recordTiming=(kind,value)=>{if(!measured||generation!==heartbeatGeneration)return;const end=now(),row={sample,httpStatus:Number.isInteger(value?.statusCode)?value.statusCode:null,pendingProbeDelayMs:probeDue===null?null:Math.max(0,end-probeDue),jsonParseMs,awaitResumeMs:null,totalThroughAwaitMs:null,outcome:kind==='success'?(value?.statusCode>=200&&value?.statusCode<300?'success':'http-error'):'failed',totalMs:Math.max(0,end-started),initAndDispatchMs:sdkAt===null?null:Math.max(0,sdkAt-started),sdkAwaitMs:sdkAt===null||callbackAt===null?null:Math.max(0,callbackAt-sdkAt),parseAndDeliveryMs:callbackAt===null?null:Math.max(0,end-callbackAt),maxEventLoopDelayMs:maxLoopDelay,probeCount};heartbeatCount++;heartbeatSamples.push(row);rankSamples();if(kind==='success'&&value?.data&&typeof value.data==='object')heartbeatAwait.set(value.data,{row,deliveredAt:end,generation,observed:false});};
  const record=(where,response)=>{if(done||failureRecorded)return;failureRecorded=true;recordResponse(stage,where,response);};
  const duration=Number.isFinite(options.timeout)&&options.timeout>0?options.timeout:8000,deadline=Date.now()+duration;
  const finish=(kind,value)=>{if(done)return;done=true;clearTimeout(timer);if(probe!==null)clearTimeout(probe);recordTiming(kind,value);options[kind]?.(value);};
  const fail=e=>{record(phase,null);finish('fail',{errMsg:['INVALID_CLOUD_RESPONSE','CLOUD_API_UNAVAILABLE','CLOUD_ROUTE_DENIED','CLOUD_HEADER_DENIED'].includes(e?.message)?e.message:category(e,'CLOUD_REQUEST'),...sdkCode(e)});};
  const abortNative=()=>{try{task?.abort?.();}catch(_){}};
  const timer=setTimeout(()=>{record('request-timeout',null);finish('fail',{errMsg:'CLOUD_REQUEST_TIMEOUT'});abortNative();},duration);
  Promise.resolve().then(async()=>{
   const path=route(options.url),header={...headers(options.header),'X-WX-SERVICE':service};
   phase='cloud-init';await init();
   if(done||Date.now()>=deadline){if(!done)fail(Error('TIMEOUT'));return null;}
   phase='sdk-fail';if(measured)sdkAt=now();return new Promise((resolve,reject)=>{
    task=wx.cloud.callContainer({config:{env},service,path,method:options.method||'GET',header,data:options.data,dataType:'text',timeout:Math.max(1,deadline-Date.now()),followRedirect:false,success:r=>{markCallback();resolve(r);},fail:e=>{markCallback();reject(e);}});
    const accept=response=>{if(Number.isInteger(response?.statusCode)){markCallback();resolve(response);}};
    if(typeof task?.then==='function')task.then(accept,e=>{markCallback();reject(e);});else accept(task);
   });
  }).then(r=>{if(done)return;if(!r||!Number.isInteger(r.statusCode)){record('response-status',r);throw Error('INVALID_CLOUD_RESPONSE');}if(typeof r.data==='string'){const parseStarted=measured?now():null;try{r={...r,data:JSON.parse(r.data)};}catch{record('response-json',r);throw Error('INVALID_CLOUD_RESPONSE');}finally{if(measured)jsonParseMs+=Math.max(0,now()-parseStarted);}}finish('success',r);}).catch(fail);
  return{abort(cause){if(done)return;record(cause==='watchdog'?'request-watchdog-abort':cause==='lifecycle'?'request-lifecycle-abort':'request-abort',null);finish('fail',{errMsg:'CLOUD_REQUEST_ABORTED'});abortNative();}};
 },
 connectSocket(options){const attempt={attempt:++socketAttemptSerial,startedAtMs:Date.now(),callbacks:0,promiseCompletions:0,statusOnlyCompletions:0,duplicateCompletions:0,differentTaskWrappers:0,taskBound:false,opened:false,closed:false,messageCallbacks:0,preOpenMessages:0,errorCallbacks:0,closeCallbacks:0,openCallbacks:0,sendCalls:0,preOpenSendRejected:0,runtimeMode:readRuntimeMode()};socketAttempts.push(attempt);if(socketAttempts.length>8)socketAttempts.shift();const safelyClose=(native,o={})=>{try{native?.close?.(o);}catch(_){}};let failureSource='cloud-init',connectCalledAtMs=null;let task=null,closed=false,closeOptions={},opened=false,closeEmitted=false;const handlers={open:[],message:[],error:[],close:[]};
 const bump=key=>{attempt[key]=Math.min(1000000,(attempt[key]||0)+1);};
 const emit=(name,event)=>{for(const fn of [...handlers[name]])fn(event);};const notifyClose=e=>{if(closeEmitted)return;closeEmitted=true;emit('close',e);};
 const fail=(e,source=failureSource)=>{if(closed)return;closed=true;attempt.closed=true;attempt.failedAtMs=Date.now();const errMsg=e?.message==='CLOUD_SOCKET_UNAVAILABLE'?'CLOUD_SOCKET_UNAVAILABLE':category(e,'CLOUD_SOCKET');attempt.failureCode=errMsg;const observation={errMsg,...sdkCode(e),...observeSocketFailure(source,e),socketFailureObservedAtMs:Date.now(),...(Number.isSafeInteger(connectCalledAtMs)?{socketConnectCalledAtMs:connectCalledAtMs}:{})};options.fail?.(observation);emit('error',observation);safelyClose(task);};
 const proxy={send(o){bump('sendCalls');if(closed||!task||!opened){bump('preOpenSendRejected');o.fail?.({errMsg:'CLOUD_SOCKET_NOT_READY',...observeSocketFailure('task-state',null),socketFailureObservedAtMs:Date.now()});return;}task.send(o);},close(o={}){if(closed)return;closed=true;attempt.closed=true;attempt.intentionalClose=true;attempt.closedAtMs=Date.now();closeOptions=o;notifyClose({code:o.code||1000,reason:o.reason||'CLIENT_CLOSED'});if(task)safelyClose(task,o);},onOpen(fn){handlers.open.push(fn);if(opened&&!closed)Promise.resolve().then(()=>{if(!closed)fn({});});},onMessage(fn){handlers.message.push(fn);},onError(fn){handlers.error.push(fn);},onClose(fn){handlers.close.push(fn);}};
 // Bind synchronously when callback-style SDK exposes the task. A promise
 // fallback supports promise-only SDKs; callback+promise results bind once.
 // Both completions belong to one connect call. A second JS task wrapper may
 // alias the same native connection: never close it or rebind its listeners.
 // Status-only callbacks wait for the task-bearing completion; the existing
 // BattleSocket opening deadline still bounds missing task/open results.
 const accept=(result,source)=>{if(source==='callback')attempt.callbacks++;if(source==='promise')attempt.promiseCompletions++;if(!result)return;if(task){attempt.duplicateCompletions++;if(result.socketTask&&result.socketTask!==task)attempt.differentTaskWrappers++;return;}try{const t=result.socketTask;if(!t){attempt.statusOnlyCompletions++;return;}if(['send','close','onOpen','onMessage','onError','onClose'].some(k=>typeof t[k]!=='function'))throw Error('INVALID_CLOUD_SOCKET');task=t;attempt.taskBound=true;attempt.taskBoundAtMs=Date.now();attempt.taskSource=source;if(closed){safelyClose(t,closeOptions);return;}
 // Message/error/close listeners precede onOpen: replayed open may send auth
 // immediately, and its reply must already have a receiver.
 t.onMessage(e=>{bump('messageCallbacks');if(!opened)bump('preOpenMessages');if(attempt.firstMessageAtMs===undefined)attempt.firstMessageAtMs=Date.now();if(!closed)emit('message',e);});t.onError(e=>{bump('errorCallbacks');if(attempt.firstErrorAtMs===undefined)attempt.firstErrorAtMs=Date.now();fail(e,'native-error');});t.onClose(e=>{bump('closeCallbacks');closed=true;attempt.closed=true;attempt.closedAtMs=Date.now();if(Number.isSafeInteger(e?.code)&&e.code>=0&&e.code<=65535)attempt.closeCode=e.code;notifyClose({...e,...observeSocketFailure('native-close',{errMsg:e?.reason}),socketFailureObservedAtMs:Date.now(),...(Number.isSafeInteger(connectCalledAtMs)?{socketConnectCalledAtMs:connectCalledAtMs}:{})});});t.onOpen(e=>{bump('openCallbacks');if(attempt.firstOpenCallbackAtMs===undefined)attempt.firstOpenCallbackAtMs=Date.now();if(closed)return;opened=true;attempt.opened=true;attempt.openedAtMs=Date.now();emit('open',{...e,...(Number.isSafeInteger(connectCalledAtMs)?{socketConnectCalledAtMs:connectCalledAtMs}:{})});});attempt.listenersBoundAtMs=Date.now();
 }catch(e){fail(e,'task-result');}};
 Promise.resolve().then(async()=>{if(closed)return;await init();if(closed)return;failureSource='sdk-call';if(typeof wx.cloud.connectContainer!=='function')throw Error('CLOUD_SOCKET_UNAVAILABLE');failureSource='route-check';const path=route(options.url);if(path!=='/api/socket')throw Error('CLOUD_SOCKET_PATH_DENIED');const header=headers(options.header);failureSource='sdk-call';connectCalledAtMs=Date.now();attempt.connectCalledAtMs=connectCalledAtMs;const result=wx.cloud.connectContainer({...(typeof options.perMessageDeflate==='boolean'?{perMessageDeflate:options.perMessageDeflate}:typeof perMessageDeflate==='boolean'?{perMessageDeflate}:{}),config:{env},service,path,header,tcpNoDelay:true,timeout:8000,success:r=>accept(r,'callback'),fail:e=>fail(e,'sdk-fail')});if(result&&typeof result.then==='function')result.then(r=>accept(r,'promise'),e=>fail(e,'sdk-fail'));else accept(result,'return');
 }).catch(fail);return proxy;}
 };
 return new Proxy(wx,{get(target,key){if(key in overrides)return overrides[key];const v=target[key];return typeof v==='function'?v.bind(target):v;}});
}

module.exports={createCloudContainerWx};
