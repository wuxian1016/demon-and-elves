'use strict';const{manifest,config}=require('./asset-config');const{createManualOrientation}=require('./auto-orientation');const{createMemoryCollector}=require('./memory-collection');const{createHudPreferences}=require('./performance-hud-preferences');const assetEntries=new Map(Object.entries(manifest));if(!Object.hasOwn)Object.defineProperty(Object,'hasOwn',{value:(o,k)=>Object.prototype.hasOwnProperty.call(o,k),configurable:true,writable:true});if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(n){n=Math.trunc(n)||0;return this[n<0?this.length+n:n];},configurable:true,writable:true});const fs=wx.getFileSystemManager();const root=wx.env.USER_DATA_PATH;const assetRoot=root+'/forest-assets-v1';const saveRoot=root+'/forest-saves-v1';for(const dir of[assetRoot,saveRoot]){try{fs.mkdirSync(dir,true);} catch(_){}}
const canvas=require('./startup-guard').canvas(wx);const window={};const nativeTextCache=new Map();let nativeTextUnits=0;function nativeText(value){
 const text=String(value);
 if(text.length>4096)return text.split('').join('');
 const hit=nativeTextCache.get(text);
 if(hit!==undefined)return hit;
 // Keep the flattened copy as the key as well as the value. A transient
 // input string can reference a much larger backing string.
 const units=new Array(text.length);
 for(let i=0;i<text.length;i++)units[i]=text.charCodeAt(i);
 const flat=String.fromCharCode(...units);
 nativeTextCache.set(flat,flat);
 nativeTextUnits+=flat.length;
 while(nativeTextCache.size>512||nativeTextUnits>65536){
  const oldest=nativeTextCache.keys().next().value;
  nativeTextUnits-=oldest.length;
  nativeTextCache.delete(oldest);
 }
 return flat;
}
function clearNativeText(){nativeTextCache.clear();nativeTextUnits=0;}
function nativeKey(value){return typeof value==='string'?nativeText(value):value;}
let lowMemoryUntil=0,lastMemoryRelease=-Infinity;function createRuntimeDiagnostics615(storage,version,clock=Date.now,schedule=setTimeout,cancel=clearTimeout){const key='forest-runtime-diagnostics-v615',limit=32768;let prior=null;try{prior=storage.getStorageSync(key);}catch(_){}
const clean=r=>({kind:String(r.kind||'').slice(0,32),time:Number(r.time)||0,detail:String(r.detail||'').slice(0,800),metrics:String(r.metrics||'').slice(0,1200)});const session=(old)=>old&&typeof old==='object'?{id:String(old.id||'').slice(0,48),version:String(old.version||'').slice(0,32),started:Number(old.started)||0,errors:(Array.isArray(old.errors)?old.errors:[]).slice(-16).map(clean),events:(Array.isArray(old.events)?old.events:[]).slice(-24).map(clean),health:(Array.isArray(old.health)?old.health:[]).slice(-8).map(clean)}:null;let previous=null;try{if(prior?.schema===615)previous=session(prior.current);}catch(_){}
const started=clock(),current={id:started.toString(36)+'-'+((Number(prior?.sequence)||0)+1),version:String(version).slice(0,32),started,errors:[],events:[],health:[]};const data={schema:615,sequence:((Number(prior?.sequence)||0)%1000000)+1,previous,current,writeFailures:0,dropped:0};prior=null;let dirty=false,timer=null,lastWrite=-Infinity,lastCritical=-Infinity;function bounded(){let text=JSON.stringify(data);while(text.length>limit){const lists=[previous?.health,current.health,previous?.events,current.events,previous?.errors,current.errors];const list=lists.find(a=>a?.length);if(!list)break;list.shift();data.dropped++;text=JSON.stringify(data);}
return text;}
let writing=false;
function flush(){
 if(timer!==null)cancel(timer);
 timer=null;
 if(!dirty||writing)return;
 dirty=false;lastWrite=clock();
 const fail=()=>{data.writeFailures=Math.min(999999,data.writeFailures+1);};
 const complete=()=>{
  writing=false;
  if(dirty&&timer===null)timer=schedule(flush,Math.max(1,5000-(clock()-lastWrite)));
 };
 try{
  const value=JSON.parse(bounded());
  if(typeof storage.setStorage==='function'){
   writing=true;storage.setStorage({key,data:value,fail,complete});
  }else storage.setStorageSync(key,value);
 }catch(_){fail();complete();}
}
function record(kind,detail,metrics){try{const now=clock(),critical=['error','rejection','frame-error','memory','dragon-error'].includes(kind);const row={kind:String(kind).slice(0,32),time:now,detail:String(detail?.stack||detail?.message||detail||'').slice(0,800),metrics:''};if(metrics){const text=JSON.stringify(metrics);row.metrics=text.length<=1200?text:JSON.stringify({truncated:true});}
const list=critical?current.errors:kind==='health'?current.health:current.events,cap=critical?16:kind==='health'?8:24;list.push(row);if(list.length>cap){list.shift();data.dropped++;}dirty=true;if(critical&&now-lastCritical>=1000){lastCritical=now;flush();}
else if(now-lastWrite>=5000)flush();else if(timer===null)timer=schedule(flush,Math.max(1,5000-(now-lastWrite)));}catch(_){}}
record('boot','runtime-start');return{record,read:()=>JSON.parse(bounded()),key};}
const diagnostics615=createRuntimeDiagnostics615(wx,config.diagnosticBuild||config.version);try{const d=wx.getDeviceInfo?.()||{},a=wx.getAppBaseInfo?.()||{};diagnostics615.record('runtime-mode',JSON.stringify({diagnosticBuild:config.diagnosticBuild||null,platform:d.platform||null,model:d.model||null,system:d.system||null,wechatVersion:a.version||null,SDKVersion:a.SDKVersion||null,highPerformance:typeof GameGlobal!=='undefined'&&typeof GameGlobal.isIOSHighPerformanceMode==='boolean'?GameGlobal.isIOSHighPerformanceMode:null,highPerformancePlus:typeof GameGlobal!=='undefined'&&typeof GameGlobal.isIOSHighPerformanceModePlus==='boolean'?GameGlobal.isIOSHighPerformanceModePlus:null,framePolicy:'original-native-continuous-v6-early-frame',frameApi:typeof requestAnimationFrame==='function'?'native-raf':'timer-fallback',renderer:'canvas2d'}));}catch(_){}const diagnosticKey='forest-runtime-diagnostics-v203';let frameCount566=0,frameTotal566=0,frameMax566=0;function sceneCanvasStats627(g){const seen=new Set();let bytes=0;const add=art=>{if(!art||seen.has(art)||typeof art.getContext!=='function')return;seen.add(art);bytes+=Math.max(0,Number(art.width)||0)*Math.max(0,Number(art.height)||0)*4;};for(const cache of[g?.terrainTiles200,g?.buildingTiles200]){if(cache?.tiles)for(const tile of cache.tiles.values())add(tile.art);add(cache?.front?.art);}for(const key of['resourceBodyLayer','buildingBodyLayer','buildingStatusLayer','hudStatusLayer','pauseBackdrop','hudLayer504','minimapLayer','minimapPaintLayer','playerAuraLight','homeStatic514','fogMask','fogSoftMask','fogBaseMask','fogCoverProbe','fogBrush146','minimapFogArt']){const layer=g?.[key];add(layer?.art||layer);}for(const layer of g?.landscapeLayers||[])add(layer.art);for(const cache of[g?.buttonArt411,g?.staticUi514])if(cache?.values)for(const art of cache.values())add(art);if(g?.fogMobileRender)for(const key of['base','fixed','mask','soft'])add(g.fogMobileRender[key]);return{canvases:seen.size,estimatedRgbaBytes:bytes,excludesDecoderGpuCopiesAndHeap:true};}
function cacheDiagnostic566(){const a=window.woodlandArt,g=game;return{frameCount:frameCount566,frameMeanMs:frameCount566?Math.round(frameTotal566/frameCount566*10)/10:0,frameMaxMs:frameMax566,dragon:a?.dragonCacheStats200?.(),pose:a?.poseCacheStats215?.(),visual:a?.visualCacheStats566?.(),terrainBytes:g?.terrainTiles200?.bytes||0,buildingBytes:g?.buildingTiles200?.bytes||0,frameHealth:['prep','hunt'].includes(g?.state)&&!g?.sessionMenuOpen?g?.frameHealth?.last||null:null,sceneCanvases:sceneCanvasStats627(g)};}
function recordRuntimeDiagnostic(kind,detail){try{let metrics;if(['health','error','rejection','frame-error','memory'].includes(kind))metrics={elapsed:game?.huntElapsed||0,buildings:game?.buildings?.length||0,projectiles:game?.projectiles?.length||0,workers:game?.peasants?.length||0,allies:game?.allies?.length||0,form:game?.troll?.dragonEvolved?'dragon':game?.troll?.evolved?'evolved':'initial',performance:cacheDiagnostic566()};diagnostics615.record(kind,detail,metrics);}catch(_){}}
const document={hidden:false,createElement(type){if(type!=='canvas') throw new Error('Unsupported mini-game element: '+type);return wx.createCanvas();}};let view=null;const landscapeSafe435=new Map(),portraitSafe514=new Map();let viewportListener397=null,viewportHint397=null,viewportTimers397=[];function deviceForm428(i){let d={};try{d=wx.getDeviceInfo?.()||{};}catch(_){}
const identity=String(d.model||'')+' '+String(d.deviceType||'');if(/ipad|tablet|\bpad\b/i.test(identity))return 'tablet';if(/iphone|\bphone\b/i.test(identity))return 'phone';return Math.min(i.windowWidth||0,i.windowHeight||0)>=700?'tablet':'phone';}
function validSafe429(s,w,h){if(!s)return true;const l=s.left??0,r=s.right??w,t=s.top??0,b=s.bottom??h;return[l,r,t,b].every(Number.isFinite)&&l>=0&&t>=0&&r<=w&&b<=h&&l<=r&&t<=b;}
function readCapsule429(w,h){let c;try{c=wx.getMenuButtonBoundingClientRect?.();}catch(_){}
if(!c||!Number.isFinite(c.bottom))return;const right=c.right??w-8,left=c.left??right-(c.width||124),bottom=c.bottom,top=c.top??bottom-(c.height||32);return[left,right,top,bottom].every(Number.isFinite)&&left>=0&&top>=0&&right<=w&&bottom<=h&&left<right&&top<bottom&&w-right<=Math.max(64,w*.08)?{...c,left,right,top,bottom}:undefined;}
function refreshViewport(sizeOverride,i){i=i||(wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync());const override=sizeOverride&&Number.isFinite(sizeOverride.windowWidth)&&Number.isFinite(sizeOverride.windowHeight)&&sizeOverride.windowWidth>0&&sizeOverride.windowHeight>0;const width=override?sizeOverride.windowWidth:i.windowWidth,height=override?sizeOverride.windowHeight:i.windowHeight;const fresh=i.windowWidth===width&&i.windowHeight===height;let capsule=fresh?readCapsule429(width,height):undefined;let safe=fresh&&validSafe429(i.safeArea,width,height)?i.safeArea:null;const current=view?.width===width&&view?.height===height?view:null;if(fresh&&!capsule&&current?.capsule)capsule=current.capsule;if(fresh&&!safe&&current)safe={left:current.safeLeft,right:width-current.safeRight,top:current.safeTop,bottom:height-current.safeBottom};if(!fresh&&view){const turned=(width>height)!==(view.width>view.height);if(turned)safe=width>height
?{left:Math.max(view.safeTop,view.safeLeft),right:width-Math.max(view.safeBottom,view.safeRight),top:0,bottom:height}
:{left:0,right:width,top:Math.max(view.safeLeft,view.safeTop),bottom:height-Math.max(view.safeRight,view.safeBottom)};const cw=view.capsule?.width||(view.capsule?.right-view.capsule?.left)||124,ch=view.capsule?.height||(view.capsule?.bottom-view.capsule?.top)||32;const top=width>height?8:Math.max(8,safe?.top||0),right=width-8;capsule={left:right-cw,right,top,bottom:top+ch,width:cw,height:ch};}
if(safe){const rawLeft=Math.max(0,safe.left||0),rawRight=Math.max(0,width-(safe.right??width));const capsuleGap=Math.max(capsule?capsule.right-(safe.right??width):0,capsule?rawLeft-capsule.left:0);const outsideCapsule=capsuleGap>Math.max(64,width*.08);const stalePortraitWidth=width>height&&Math.max(rawLeft,rawRight)>Math.max(96,width*.15)&&Math.min(rawLeft,rawRight)<24;if((outsideCapsule||stalePortraitWidth)&&current)safe={...safe,left:current.safeLeft,right:width-current.safeRight};else if(outsideCapsule||stalePortraitWidth)safe={...safe,left:0,right:width};}
let safeTop=Math.max(0,Math.min(height*.2,safe?.top||0));let safeBottom=Math.max(0,Math.min(height*.2,height-(safe?.bottom||height)));let safeLeft=Math.max(0,Math.min(width*.2,safe?.left||0)),safeRight=Math.max(0,Math.min(width*.2,width-(safe?.right||width)));const formFactor=deviceForm428(i),safeKey=width+'x'+height,stable=landscapeSafe435.get(safeKey);if(width>height&&formFactor==='phone'){const side=Math.max(safeLeft,safeRight,stable?.[0]||0,stable?.[1]||0);const fixed=side>=20?side:44;safeLeft=safeRight=fixed;landscapeSafe435.set(safeKey,[fixed,fixed]);}
if(width<height){const old=portraitSafe514.get(safeKey);if(old){safeTop=old.top;safeBottom=old.bottom;capsule=old.capsule;}else if(fresh&&safe&&capsule){portraitSafe514.set(safeKey,{top:safeTop,bottom:safeBottom,capsule:{...capsule}});}}
view={width,height,pixelRatio:i.pixelRatio||1,fullHeight:height,top:0,bottom:0,safeTop,safeBottom,safeLeft,safeRight,capsule,formFactor};return view;}
function viewport(){return view||refreshViewport();}
function sameViewport397(a,b){if(!a||!b)return false;for(const key of['width','height','pixelRatio','safeTop','safeBottom','safeLeft','safeRight','formFactor'])if(a[key]!==b[key])return false;for(const key of['left','right','top','bottom','width','height'])if((a.capsule?.[key]||0)!==(b.capsule?.[key]||0))return false;return true;}
function cancelViewportTimers397(){for(const timer of viewportTimers397)clearTimeout(timer);viewportTimers397.length=0;}
function syncViewport397(){if(suspended)return false;const before=view,info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync();if(viewportHint397&&(info.windowWidth!==viewportHint397.windowWidth||info.windowHeight!==viewportHint397.windowHeight))return false;viewportHint397=null;const next=refreshViewport(null,info);if(sameViewport397(before,next))return false;viewportListener397?.();return true;}
function scheduleViewport397(size){if(suspended)return;cancelViewportTimers397();if(size&&Number.isFinite(size.windowWidth)&&Number.isFinite(size.windowHeight)&&size.windowWidth>0&&size.windowHeight>0){viewportHint397={windowWidth:size.windowWidth,windowHeight:size.windowHeight};const before=view,next=refreshViewport(viewportHint397);if(!sameViewport397(before,next))viewportListener397?.();}
syncViewport397();for(const delay of[60,140,280,520,900,1500,2500])viewportTimers397.push(setTimeout(syncViewport397,delay));}
function bindViewport397(listener){if(viewportListener397)throw Error('Viewport listener already bound');viewportListener397=listener;wx.onWindowResize?.(event=>{scheduleViewport397(event?.size);});wx.onDeviceOrientationChange?.(event=>{manualOrientation415.sync(event?.value);scheduleViewport397();});}
function resyncViewport415(){if(suspended)return false;viewportHint397=null;scheduleViewport397();return true;}
let freezeTrace=null;const clockOrigin=Date.now();let clockRaw=clockOrigin,clockLast=0;const performance={now(){const raw=Date.now();if(!Number.isFinite(raw))return clockLast;clockLast+=Math.max(0,raw-clockRaw);clockRaw=raw;return clockLast;}};let suspended=false,pendingFrame=null,frameId=null,lastHealthCheckpoint=0,networkWaiting=false,networkFrameRequested=false,networkWaitStarted=null,networkWaitEnded=null,networkWaitFrames=0,networkWaitWorkMs=0,networkWaitMaxMs=0;const nativeRAF=typeof requestAnimationFrame==='function'?requestAnimationFrame:cb=>setTimeout(()=>cb(performance.now()),16);const nativeCancel=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:clearTimeout;
// Reserve a playing frame before current work, retaining one pending callback.
// Slow work, menus, loading and lifecycle transitions keep the existing path.
let lastFrameWorkAD=0,frameFaultStopBN=null,frameDrawFaultBN=false,autoFrameFaultWorldBN=null,autoFrameFaultAtBN=-Infinity;
function localFrameFaultRunBN(){return game&&window.batSoloPolicyBN?.allows?.(game)===true&&['prep','hunt'].includes(game.state)&&!networkWaiting&&!game.networkDrawCamera627&&!game.roundStarting&&!game.roundLoading591;}
// A late callback from a cancelled reservation cannot own a later playing or foreground frame.
let visibilityEpoch=0, resumeImagesAfterFrame=false;
function frameDispatchFor(epoch){
 return ()=>{if(epoch===visibilityEpoch)runNativeFrameAD(epoch);};
}
let currentFrameDispatch=frameDispatchFor(visibilityEpoch);
function retireFrameReservation(){
 currentFrameDispatch=frameDispatchFor(++visibilityEpoch);
 const old=frameId;frameId=null;
 if(old!==null)nativeCancel(old);
}
let idleTimerBN=null;function schedule(){if(frameFaultStopBN||suspended||!pendingFrame||frameId!==null||networkWaiting&&!networkFrameRequested)return;if(idleTimerBN!==null){clearTimeout(idleTimerBN);idleTimerBN=null;}frameId=nativeRAF(currentFrameDispatch);}
// PERF-H2: a static menu/pause/result screen parks its next frame instead of waking 60 times a second.
// Any input wake(), any wxUiDirty=true, or a 150 ms safety tick resumes it; play keeps the normal RAF.
function frameIdle(cb,ms){if(frameFaultStopBN)return;pendingFrame=cb;if(frameId!==null||idleTimerBN!==null)return;idleTimerBN=setTimeout(()=>{idleTimerBN=null;schedule();},ms||150);}
function runNativeFrameAD(epoch){frameId=null;if(!pendingFrame)return;const cb=pendingFrame;pendingFrame=null;if(suspended){pendingFrame=cb;return;}networkFrameRequested=false;
const started566=performance.now(),wasNetworkWaiting=networkWaiting;let dispatched=false;frameDrawFaultBN=false;
try{if(game&&['prep','hunt'].includes(game.state)&&!game.sessionMenuOpen&&!game.roundStarting&&!networkWaiting&&lastFrameWorkAD<12)frameId=nativeRAF(currentFrameDispatch);dispatched=true;cb?.(started566);}
catch(error){
 // A native bridge can hide and show synchronously while the game callback runs.
 // Surface its original error without changing the newer foreground reservation.
 if(epoch!==visibilityEpoch){recordRuntimeDiagnostic('frame-error',error?.stack||error);throw error;}
 resumePendingImages();
 const phase=!dispatched?'host-reserve':frameDrawFaultBN?'draw':'simulation-or-unknown';
 try{freezeTrace?.fault('game-frame:'+phase,error,true);}catch(_){}
 if(frameId!==null){try{retireFrameReservation();}catch(_){}}
 try{game?.invalidateExitConfirmation627?.();}catch(_){}
 recordRuntimeDiagnostic('frame-error',error?.stack||error);
 if(prepareSafeSoloFramePauseBN(cb,phase))return;
 pendingFrame=null;networkFrameRequested=false;throw error;
}
if(epoch!==visibilityEpoch)return;
if(!suspended){awaitingForegroundFrame=false;resumePendingImages();}const cost566=performance.now()-started566;lastFrameWorkAD=cost566;if(frameId!==null&&(suspended||!pendingFrame||networkWaiting&&!networkFrameRequested))retireFrameReservation();if(wasNetworkWaiting){networkWaitFrames++;networkWaitWorkMs+=cost566;networkWaitMaxMs=Math.max(networkWaitMaxMs,cost566);}frameCount566++;frameTotal566+=cost566;frameMax566=Math.max(frameMax566,cost566);const now=Date.now();if(game&&['prep','hunt'].includes(game.state)&&!game.sessionMenuOpen&&now-lastHealthCheckpoint>=30000){lastHealthCheckpoint=now;recordRuntimeDiagnostic('health','frame-complete');frameCount566=frameTotal566=frameMax566=0;}}
// Draw-only recovery is an empty simulation frame. Do not replay or save a partly applied update.
function notifyPausedFrameBN(text){try{wx.showToast?.({title:text,icon:'none',duration:1800});}catch(_){}}
function continueFrameFaultBN(fault){
 if(frameFaultStopBN!==fault||suspended)return;
 if(!fault.safe||fault.manualRedrawUsed||!localFrameFaultRunBN()){notifyPausedFrameBN('暂不能安全继续本局');return;}
 fault.manualRedrawUsed=true;requestFrameRedrawBN(fault);
}
function presentFrameFaultBN(fault,first=false){
 if(frameFaultStopBN!==fault||suspended||fault.redrawRequested||fault.dialogOpen)return;
 const options=()=>{
  if(frameFaultStopBN!==fault||suspended)return;
  const rows=[['继续游戏',()=>continueFrameFaultBN(fault)]];
  if(runtime.copyFreezeEvidence)rows.push(['复制故障记录',()=>runtime.copyFreezeEvidence(true)]);
  rows.push(['返回首页',()=>leaveFrameFaultBN(fault)]);
  if(typeof wx.showActionSheet!=='function'){
   if(typeof wx.showModal==='function'){
    fault.dialogOpen=true;
    try{wx.showModal({title:'本局保持暂停',content:'之前的存档没有被覆盖。你可以留在本局，或自行返回首页读档。',confirmText:'返回首页',cancelText:'留在本局',success:r=>{fault.dialogOpen=false;if(r?.confirm)leaveFrameFaultBN(fault);},fail:()=>{fault.dialogOpen=false;}});}catch(_){fault.dialogOpen=false;}
   }
   return;
  }
  fault.dialogOpen=true;
  try{wx.showActionSheet({itemList:rows.map(row=>row[0]),success:r=>{
   fault.dialogOpen=false;if(frameFaultStopBN===fault&&!suspended)rows[r?.tapIndex]?.[1]();
  },fail:()=>{fault.dialogOpen=false;}});}catch(_){fault.dialogOpen=false;}
 };
 if((!first&&typeof wx.showActionSheet==='function')||typeof wx.showModal!=='function'){options();return;}
 fault.dialogOpen=true;
 try{wx.showModal({title:'本局已暂停',content:fault.safe
  ?'画面暂未恢复。你可以再试继续本局，或复制故障记录。已有存档未被覆盖。'
  :'本帧可能未完整结算，不能直接继续。已有存档未被覆盖，你可留在本局复制记录，或自行返回读档。',
  confirmText:'继续游戏',cancelText:'其他选项',success:r=>{fault.dialogOpen=false;if(r?.confirm)continueFrameFaultBN(fault);else if(r?.cancel)options();},fail:()=>{fault.dialogOpen=false;}});}catch(_){fault.dialogOpen=false;}
}
function leaveFrameFaultBN(fault){
 if(frameFaultStopBN!==fault||suspended||typeof game?.returnToStartAfterFrameFaultBN!=='function')return;
 try{game.returnToStartAfterFrameFaultBN();frameFaultStopBN=null;pendingFrame=fault.callback;networkFrameRequested=true;schedule();}
 catch(error){recordRuntimeDiagnostic('fault-return-error',error?.stack||error);notifyPausedFrameBN('未能返回首页');}
}
function armFrameRedrawBN(){
 const fault=frameFaultStopBN;
 if(!fault?.redrawRequested||suspended||frameId!==null)return;
 const epoch=visibilityEpoch;
 const redraw=()=>{
  if(epoch!==visibilityEpoch)return;
  frameId=null;
  if(frameFaultStopBN!==fault||suspended)return;
  fault.redrawRequested=false;
  if(game!==fault.game||!fault.safe||!localFrameFaultRunBN()){presentFrameFaultBN(fault,true);return;}
  try{
   // Reset failed Canvas2D graphics state, not the world, and commit a render without time advance.
   if(typeof game.ctx?.reset==='function')game.ctx.reset();
   else if(game.canvas===canvas&&canvas.width>0)canvas.width=canvas.width;
   game.draw(false,performance.now());
   game.loopClock=null;game.simulationDebt=0;game.nextRenderTime=null;game.renderPrevious=[];game.framePacer?.reset?.();
   recordRuntimeDiagnostic('frame-resumed',fault.phase);
  }catch(error){
   recordRuntimeDiagnostic('frame-redraw-error',error?.stack||error);presentFrameFaultBN(fault,true);return;
  }
  frameFaultStopBN=null;pendingFrame=fault.callback;networkFrameRequested=true;schedule();
 };
 try{frameId=nativeRAF(redraw);}catch(error){
  fault.redrawRequested=false;recordRuntimeDiagnostic('fault-redraw-schedule',error?.stack||error);presentFrameFaultBN(fault,true);
 }
}
function requestFrameRedrawBN(fault){
 if(frameFaultStopBN!==fault||!fault.safe||fault.redrawRequested)return;
 fault.redrawRequested=true;armFrameRedrawBN();
}
function prepareSafeSoloFramePauseBN(cb,phase){
 if(frameFaultStopBN||!localFrameFaultRunBN())return false;
 const now=performance.now(),world=game.troll;
 const safe=phase==='draw'||phase==='host-reserve';
 const fault=frameFaultStopBN={game,callback:cb,phase,safe,dialogOpen:false,redrawRequested:false,manualRedrawUsed:false};
 pendingFrame=null;
 try{runtime.cancelInput?.();}catch(error){recordRuntimeDiagnostic('fault-input-reset',error?.stack||error);}
 if(safe&&(autoFrameFaultWorldBN!==world||now-autoFrameFaultAtBN>=60000)){
  autoFrameFaultWorldBN=world;autoFrameFaultAtBN=now;requestFrameRedrawBN(fault);
 }else presentFrameFaultBN(fault,true);
 return true;
}
function frame(cb){if(frameFaultStopBN)return;pendingFrame=cb;schedule();}
// Loading has no animated world: retain the game's next frame callback and only
// request a native frame when status, input or its measured elapsed time changes.
// Returning to play/home restores the original continuous frame scheduler.
function networkWaitingReport(){return{active:networkWaiting,elapsedMs:networkWaitStarted===null?0:Math.max(0,(networkWaitEnded??performance.now())-networkWaitStarted),frames:networkWaitFrames,frameWorkMs:networkWaitWorkMs,maxFrameWorkMs:networkWaitMaxMs};}
function setNetworkWaiting(value){const next=value===true;if(networkWaiting===next)return;if(next){networkWaitStarted=performance.now();networkWaitEnded=null;networkWaitFrames=networkWaitWorkMs=networkWaitMaxMs=0;}else networkWaitEnded=performance.now();networkWaiting=next;if(!next&&networkWaitStarted!==null)recordRuntimeDiagnostic('network-wait',JSON.stringify(networkWaitingReport()));networkFrameRequested=next;schedule();}
function wake(){if(game)game.wxUiDirty=true;if(networkWaiting)networkFrameRequested=true;schedule();}
function call(method,args){return new Promise((resolve,reject)=>fs[nativeKey(method)]({...args,success:resolve,fail:reject}));}
function read(filePath){return call('readFile',{filePath,encoding:'utf8'}).then(r=>r.data);}
function unlink(filePath){if(filePath)fs.unlink({filePath,fail(){}});}
const legacyKey='demon-and-elves.save.v1.slot.';const indexKey='demon-and-elves.wx.slots.v1';let saving=Promise.resolve(),sequence=0;function index(){const value=wx.getStorageSync(indexKey);return value&&typeof value==='object'?value:{};}
function checkSlot(slot){if(!Number.isInteger(slot)||slot<1||slot>10)throw new Error('存档位置必须为1至10');}
async function decodeEnvelope(text){return runtime.decodeSaveEnvelope?runtime.decodeSaveEnvelope(text):JSON.parse(text);}
async function legacy(slot){const t=wx.getStorageSync(legacyKey+slot);return t?decodeEnvelope(t):null;}
const slots={async get(slot){checkSlot(slot);const row=index()[slot];if(!row)return legacy(slot);const content=await read(saveRoot+'/'+row.file);if(row.raw)return{slot,text:content,meta:row.meta};const record=await decodeEnvelope(content);if(record.slot!==slot||typeof record.text!=='string')throw new Error('存档损坏，请选择其他档案');return record;},async list(){const rows=index(),result=[];for(let i=1;i<=10;i++)result.push(rows[i]?.meta||(await legacy(i))?.meta||null);return result;},put(slot,text,meta,overwrite=false){const job=saving.catch(()=>{}).then(async()=>{checkSlot(slot);const rows=index(),old=rows[slot];if(!overwrite&&(old||wx.getStorageSync(legacyKey+slot)))throw new Error('档位已有记录，请确认覆盖');if(typeof text!=='string'||text.length>12000000)throw new Error('存档过大，原档案未覆盖');const file='slot-'+slot+'-'+Date.now()+'-'+(++sequence)+'.json';try{await call('writeFile',{filePath:saveRoot+'/'+file,data:text,encoding:'utf8'});wx.setStorageSync(indexKey,{...rows,[slot]:{file,meta,raw:true}});} catch(e){unlink(saveRoot+'/'+file);throw new Error('保存失败，请检查微信存储空间；原存档未覆盖');}
if(old)unlink(saveRoot+'/'+old.file);});saving=job;return job;}};const queue=[],decodeQueue=[],completed=new Set(),available=new Set();const totalBytes=Object.values(manifest).reduce((n,e)=>n+e.bytes,0);const deferred=new Set(Object.keys(manifest).filter(name=>/^dragon-(front|back|side)(Walk|Attack)-p[0-3]-v118\.webp$/.test(name)));const initialNames=Object.keys(manifest).filter(name=>!deferred.has(name));const initialBytes=initialNames.reduce((n,name)=>n+manifest[nativeKey(name)].bytes,0);let active=0,decoding=0,loaded=0,failed=null,availableBytes=0,loadedBytes=0,cacheHits=0;let initialLoaded=0,initialAvailableBytes=0,initialCached=0,initialError=null;const startedAt=Date.now();let assetWakeTimer=null;const assetNetworkSafe=()=>!game||game.state!=='hunt'||game.troll?.dead||game.sessionMenuOpen||!!game.demonPanel;function retryAssetPump(){if(!assetWakeTimer&&!suspended)assetWakeTimer=setTimeout(()=>{assetWakeTimer=null;pump();},1000);}
function failAsset(name,message){failed=message;if(!deferred.has(name))initialError=message;}
function pump(){const playing=game&&['prep','hunt'].includes(game.state);while(!suspended&&active<(playing?1:4)&&queue.length){const startup=initialLoaded<initialNames.length&&!initialError;const index=queue.findIndex(job=>(!startup||!job.deferred)&&(!job.canStart||job.canStart()));if(index<0){retryAssetPump();break;}
active++;queue.splice(index,1)[0]().finally(()=>{active--;pump();});}
while(!suspended&&decoding<(playing?1:2)&&decodeQueue.length){const index=initialLoaded<initialNames.length&&!initialError?decodeQueue.findIndex(job=>!job.deferred):0;if(index<0)break;const job=decodeQueue.splice(index,1)[0];decoding++;setTimeout(()=>{if(suspended){decodeQueue.unshift(job);decoding--;return;}
job().finally(()=>{decoding--;pump();});},0);}}
function decoded(job,isDeferred=false){return new Promise((resolve,reject)=>{const run=()=>job().then(resolve,reject);run.deferred=isDeferred;decodeQueue.push(run);pump();});}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function exists(path,bytes){try{return fs.statSync(path).size===bytes;}catch(_){return false;}}
// Deferred dragon atlas probes must not perform synchronous native IO in draw.
function existsAsync(path,bytes){if(typeof fs.stat!=='function')return new Promise(resolve=>setTimeout(()=>resolve(exists(path,bytes)),0));return new Promise(resolve=>{let settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>finish(false),8000);try{fs.stat({path,success:r=>finish(r?.stats?.size===bytes),fail:()=>finish(false)});}catch(_){finish(false);}});}
async function download(name,entry,path){const result=await new Promise((resolve,reject)=>wx.downloadFile({url:config.assetBase+name,timeout:60000,success:resolve,fail:reject}));if(result.statusCode!==200){unlink(result.tempFilePath);throw new Error('素材下载失败 HTTP '+result.statusCode);}
const temp=result.tempFilePath;try{if(!(deferred.has(name)?await existsAsync(temp,entry.bytes):exists(temp,entry.bytes)))throw new Error('素材不完整：'+name);await call('copyFile',{srcPath:temp,destPath:path});} finally{unlink(temp);}}
const readNativeImage = require('./network/native-image-decode');
function decode(img,path,timeout=60000,isCurrent){
 const src=/^(?:[a-z]+:|\/)/i.test(path)?path:'/'+path;
 return readNativeImage(img,src,timeout,isCurrent);
}
function loadImage(img,name,decodeAttempt=0,isCurrent){const ready=img.onload,error=img.onerror;const canceled=()=>isCurrent&&!isCurrent();const entry=assetEntries.get(name);const path=entry&&(entry.local?'assets/'+name:assetRoot+'/'+entry.hash+'-'+name);const enqueue=cached=>{if(canceled()){img.onload=img.onerror=null;return;}const job=async()=>{if(canceled()){img.onload=img.onerror=null;return;}
if(!entry){failAsset(name,'素材清单缺失：'+name);error?.(new Error(failed));return;}
try{if(cached){cacheHits++;if(!deferred.has(name))initialCached++;}
if(!cached)for(let attempt=0;;attempt++){if(canceled()){img.onload=img.onerror=null;return;}
while(deferred.has(name)&&(!assetNetworkSafe()||suspended)){if(canceled()){img.onload=img.onerror=null;return;}if(suspended)await readNativeImage.whenVisible(()=>{});else await sleep(1000);}
try{await download(name,entry,path);break;}
catch(e){if(attempt>=2)throw e;await sleep((attempt+1)*1000);}}
if(!available.has(name)){available.add(name);availableBytes+=entry.bytes;if(!deferred.has(name))initialAvailableBytes+=entry.bytes;}
let imageDecoded=false;decoded(async()=>{if(canceled()){img.onload=img.onerror=null;return;}
try{if(!await decode(img,path,60000,isCurrent))return;}
catch(e){if(!entry.local)unlink(path);throw e;}
imageDecoded=true;img.onload=img.onerror=null;if(canceled()){img.src='';return;}
await sleep(0);await readNativeImage.whenVisible(()=>{if(canceled()){img.src='';return;}
ready?.call(img);if(!completed.has(name)){completed.add(name);loaded++;loadedBytes+=entry.bytes;if(!deferred.has(name))initialLoaded++;}});},deferred.has(name)).catch(async e=>{if(canceled()){img.onload=img.onerror=null;return;}
if(!imageDecoded&&!entry.local&&decodeAttempt<1){await sleep((decodeAttempt+1)*300);img.onload=ready;img.onerror=error;loadImage(img,name,decodeAttempt+1,isCurrent);return;}
failAsset(name,'素材加载失败：'+name);console.warn(failed,e);error?.call(img,e);});} catch(e){if(canceled()){img.onload=img.onerror=null;return;}failAsset(name,'素材加载失败：'+name);console.warn(failed,e);error?.call(img,e);}};job.deferred=deferred.has(name);job.canStart=()=>canceled()||cached||!job.deferred||assetNetworkSafe();queue.push(job);pump();};if(entry&&!entry.local&&decodeAttempt===0&&deferred.has(name)){existsAsync(path,entry.bytes).then(enqueue);}else enqueue(!!entry&&(entry.local||(decodeAttempt===0&&exists(path,entry.bytes))));}
const imagePath=require('./network/extra-image-aliases').resolve;
let game=null;const memoryCollector627=createMemoryCollector(wx,{canCollect:()=>!game||!['prep','hunt'].includes(game.state)||game.sessionMenuOpen||game.roundStarting,onResult:(status,detail)=>recordRuntimeDiagnostic('gc-'+status,detail)});const manualOrientation415=createManualOrientation(wx,{initialOrientation:viewport().width>viewport().height?'landscape':'portrait',onResult:result=>{if(!suspended)scheduleViewport397();if(!result.reapplied)game?.orientationResult415?.(result);}});const hudPreferences627=createHudPreferences(wx);const runtime={diagnosticRelay:config.diagnosticRelay?.enabled===true?{enabled:true,approvedOrigin:config.diagnosticRelay.approvedOrigin}:null,hudPreferences:hudPreferences627,canvas,viewport,refreshViewport,bindViewport397,resyncViewport415,setGameOrientation415:value=>manualOrientation415.set(value),gameOrientationState415:()=>manualOrientation415.state(),slots,loadImage,imagePath,hidden:false,preparedArt:!!config.preparedArt,releaseLabel:'测试版'+String(config.version||'').replace(/^wechat/,''),nativeText,nativeKey,nativeTextStats:()=>({entries:nativeTextCache.size,units:nativeTextUnits}),preparedLayout:null,async loadPreparedPackage(progress){if(runtime.preparedLayout&&runtime.matchSpritesAReady&&runtime.matchSpritesBReady&&runtime.batArtReadyBN){await (runtime.ensureBatCargoReadyBN?.()||runtime.batCargoReadyPromiseBN);return runtime.preparedLayout;}
const load=require('./network/startup-subpackages');
await load(wx,runtime,progress);
if(!runtime.preparedLayout||!runtime.batArtReadyBN)throw Error('画面分包内容缺失');return runtime.preparedLayout;},setImageWorkHiddenBN:readNativeImage.setHidden,whenImageWorkVisibleBN:readNativeImage.whenVisible,discardObsoleteImageWorkBN:readNativeImage.discardObsolete,readPreparedPage:(img,name,isCurrent)=>decode(img,require('./network/prepared-page-path')(name),8000,isCurrent),finishPrepared(){for(const name of initialNames){completed.add(name);available.add(name);}
initialLoaded=initialNames.length;initialAvailableBytes=initialBytes;loaded=initialLoaded;availableBytes=loadedBytes=initialBytes;pump();},readSoundBank:()=>call('readFile',{filePath:config.preparedArt?'art163/sound-bank-v161.bin':'assets/sound-bank-v161.bin'}).then(result=>result.data),status:()=>({loaded,total:Object.keys(manifest).length,error:failed,totalBytes,availableBytes,loadedBytes,cacheHits,elapsedMs:Date.now()-startedAt,stage:available.size<Object.keys(manifest).length?'download':'decode'}),startupStatus:()=>({loaded:initialLoaded,total:initialNames.length,error:initialError,totalBytes:initialBytes,availableBytes:initialAvailableBytes,cacheHits:initialCached,stage:initialAvailableBytes<initialBytes?'download':'decode'}),touches:ts=>Array.from(ts||[],t=>({...t,clientX:t.clientX??t.x,clientY:(t.clientY??t.y)-viewport().top})),memoryConstrained:()=>Date.now()<lowMemoryUntil,diagnostics:()=>{try{return wx.getStorageSync(diagnosticKey)||[];}catch(_){return[];}},diagnosticReport:()=>diagnostics615.read(),diagnosticEvent:(kind,detail)=>recordRuntimeDiagnostic(kind,detail),checkpoint:phase=>recordRuntimeDiagnostic('phase',phase),attach(value){game=value;if(value&&!Object.getOwnPropertyDescriptor(value,"wxUiDirty")?.get){let dirty=value.wxUiDirty;Object.defineProperty(value,"wxUiDirty",{configurable:true,enumerable:true,get(){return dirty;},set(v){dirty=v;if(v===true&&idleTimerBN!==null&&game===value)schedule();}});}},frameIdle,resized(){if(game){game.releasePauseBackdrop627?.();if(game.sessionMenuOpen||game.demonPanel)game.pauseNeedsFreshScene=true;game.setupButtons();game.nextRenderTime=null;wake();}},start(){game?.loop();},requestMemoryCollection:reason=>memoryCollector627.request(reason),frame,wake,setNetworkWaiting,networkWaitingReport,markDrawFrameFaultBN(){frameDrawFaultBN=true;},get frameFaultPausedBN(){return !!frameFaultStopBN;},openFrameFaultOptionsBN(){if(frameFaultStopBN)presentFrameFaultBN(frameFaultStopBN);}};manualOrientation415.set('portrait');window.__wxRuntime=runtime;if(wx.createWebAudioContext)window.AudioContext=function(){return wx.createWebAudioContext();};wx.setPreferredFramesPerSecond?.(60);
const longBackgroundMs=10000;
let hiddenAt=0, backgroundTimer=null, loadingResumeTimer=null, backgroundLevel=0, awaitingForegroundFrame=false;
function cancelLoadingResume(){if(loadingResumeTimer!==null){clearTimeout(loadingResumeTimer);loadingResumeTimer=null;}}
function resumePendingImages(){
 if(suspended || !resumeImagesAfterFrame)return;
 cancelLoadingResume();resumeImagesAfterFrame=false;
 runtime.setImageWorkHiddenBN?.(false);pump();
}
function clearBackgroundTimer(){
 if(backgroundTimer!==null){clearTimeout(backgroundTimer);backgroundTimer=null;}
}
function trimBackground(level){
 if(level<=backgroundLevel)return;
 backgroundLevel=level;
 game?.trimBackgroundRenderBN?.(['','short','long','warning'][level]);
 if(level>=2){
  clearNativeText();
  memoryCollector627.request(level===3?'background-memory-warning':'long-background',{urgent:level===3});
 }
}
wx.onHide(()=>{
 if(suspended)return;
 suspended=runtime.hidden=document.hidden=true;
 cancelLoadingResume();hiddenAt=Date.now();backgroundLevel=0;awaitingForegroundFrame=false;resumeImagesAfterFrame=false;
 retireFrameReservation();
 runtime.setImageWorkHiddenBN?.(true);
 recordRuntimeDiagnostic('hide','background');
 window.woodlandArt?.cancelPendingDragonMotion?.();
 if(game?.roundLoading591)game.roundLoading591.pausedAt=hiddenAt;
 cancelViewportTimers397();
 if(assetWakeTimer){clearTimeout(assetWakeTimer);assetWakeTimer=null;}
 game?.invalidateExitConfirmation627?.();game?.cancelDisplayRotation398?.();runtime.cancelInput?.();
 if(game){
  game.loopClock=null;game.simulationDebt=0;game.nextRenderTime=null;game.framePacer?.reset();
  if(['prep','hunt'].includes(game.state))game.sessionMenuOpen=true;
 }
 trimBackground(1);
 backgroundTimer=setTimeout(()=>{backgroundTimer=null;if(suspended)trimBackground(2);},longBackgroundMs);
});
wx.onShow(()=>{
 if(!suspended)return;
 clearBackgroundTimer();
 const now=Date.now();
 // iOS can freeze timers for the entire background interval.
 if(now-hiddenAt>=longBackgroundMs)trimBackground(2);
 const job=game?.roundLoading591;
 if(job?.pausedAt!=null){
  const elapsed=Math.max(0,now-job.pausedAt);
  job.started+=elapsed;job.lastProgress+=elapsed;job.pausedAt=null;
 }
 awaitingForegroundFrame=true;
 suspended=runtime.hidden=document.hidden=false;
 recordRuntimeDiagnostic('show','foreground');
 if(game){game.loopClock=null;game.simulationDebt=0;game.nextRenderTime=null;}
 manualOrientation415.reapply();resyncViewport415();
 // Existing play can present its paused frame before pending decodes continue.
 // A startup awaiting its first image has no frame yet and must resume immediately.
 resumeImagesAfterFrame=true;
 if(!game || !pendingFrame || frameFaultStopBN)resumePendingImages();
 else if(game.roundStarting||game.roundLoading591||runtime.preparing){
  // The loading UI can retain a frame while the engine waits for preparation.
  // Prefer that frame on normal return, but keep preparation independent of RAF.
  loadingResumeTimer=setTimeout(()=>{loadingResumeTimer=null;resumePendingImages();},100);
 }
 if(frameFaultStopBN?.redrawRequested)armFrameRedrawBN();
 wake();
});
wx.onMemoryWarning?.(event=>{
 freezeTrace?.memoryWarning(event?.level);
 const now=Date.now();lowMemoryUntil=now+300000;
 if(suspended){
  if(backgroundLevel<3){recordRuntimeDiagnostic('memory',event?.level);lastMemoryRelease=now;trimBackground(3);}
  return;
 }
 if(now-lastMemoryRelease<10000)return;
 lastMemoryRelease=now;recordRuntimeDiagnostic('memory',event?.level);
 if((awaitingForegroundFrame||game?.sessionMenuOpen||game?.saveSlotsPanel||game?.cardPresentation?.modal?.())&&game?.trimBackgroundRenderBN){
  game.trimBackgroundRenderBN('warning');
 }else{
  const released=window.woodlandArt?.releaseTransientCaches?.({keepMinimap:true});
  game?.releaseSceneCaches?.({keepVisibleTerrain:true,terrainCacheReset:released?.terrainCacheReset});
 }
 clearNativeText();memoryCollector627.request('memory-warning',{urgent:true});wake();
});
wx.onError?.(error=>{freezeTrace?.fault('wx-error',error);game?.invalidateExitConfirmation627?.();recordRuntimeDiagnostic('error',error);});wx.onUnhandledRejection?.(event=>{freezeTrace?.fault('wx-rejection',event?.reason);game?.invalidateExitConfirmation627?.();recordRuntimeDiagnostic('rejection',event?.reason?.stack||event?.reason);});// Enabled only for the standalone diagnostic build.
if(config.diagnosticFreezeTrace===true)freezeTrace=installFreezeTrace();
function installFreezeTrace(){
 const{createFreezeTrace,Flags}=require('./network/freeze-trace');
 const flags=()=>((game?.state==='prep'||game?.state==='hunt')?Flags.activeGame:0)
  |(suspended?Flags.hidden:0)|(game?.sessionMenuOpen?Flags.menu:0)
  |(game?.roundStarting||game?.roundLoading591?Flags.loading:0)
  |(networkWaiting?Flags.waitingNetwork:0)|(pendingFrame?Flags.pendingGameCallback:0)
  |(frameId!==null?Flags.pendingHostCallback:0);
 const journal=require('./network/freeze-journal').createFreezeJournal(wx,{
  build:config.diagnosticBuild,started:clockOrigin
 });
 const context=()=>{
  const pose=window.woodlandArt?.poseCacheStats215?.();
  const front=game?.terrainTiles200?.front?.art;
  return {
   hunt:Math.floor(game?.huntElapsed||0), hounds:game?.hounds?.length||0,
   buildings:game?.buildings?.length||0, workers:game?.peasants?.length||0,
   terrainBytes:game?.terrainTiles200?.bytes||0, buildingBytes:game?.buildingTiles200?.bytes||0,
   terrainFrontBytes:front?front.width*front.height*4:0,
   poseBytes:(pose?.frameBytes||0)+(pose?.bodyBytes||0), poseEvictions:pose?.evictions||0
  };
 };
 const trace=createFreezeTrace({clock:performance.now,flags,schedule:setTimeout,cancel:clearTimeout,journal,context});
 runtime.copyFreezeEvidence=(pausedFrame=false)=>{
  const evidence=trace.persisted(),current=evidence.current,committed=evidence.committed,previous=evidence.previous,older=evidence.previousIncident;
  const sameBoot=record=>record?.boot===clockOrigin;
  const olderIncident=[previous,older,committed].find(record=>record&&!sameBoot(record)&&(record.kind==='fault'||record.kind==='gap'));
  const last=(current?.kind==='fault'?current:null)||(sameBoot(committed)&&committed?.kind==='fault'?committed:null)
   ||olderIncident||(current?.kind==='gap'?current:null)||current||committed||previous;
  const report=message=>pausedFrame?notifyPausedFrameBN(message):game?.showToast?.(message);
  if(!last){report('暂无已保存的故障记录');return false;}
  const {utf8Bytes}=require('./network/diagnostic-file-export');
  const incident=last.kind==='fault'||last.kind==='gap';
  const source=sameBoot(last)?'current-run':'previous-run';
  const payload={schema:1,record:last,source,reportKind:incident?'incident':'health-only',phaseIds:require('./network/freeze-ring').Phase,flagBits:Flags};
  let data=JSON.stringify(payload);
  if(utf8Bytes(data)>4096)data=JSON.stringify({...payload,record:{...last,trail:[]} });
  if(typeof wx.setClipboardData!=='function'){report('当前环境无法复制诊断');return false;}
  const rejected=()=>report('复制失败，请重试');
  try{
   wx.setClipboardData({data,success:()=>report(!incident?'已复制运行记录（非卡死现场）':source==='current-run'?'已复制本次故障记录':'已复制上次故障记录'),fail:rejected});
   return true;
  }catch(_){rejected();return false;}
 };
 runNativeFrameAD=trace.wrapFrame(runNativeFrameAD);
 const start=runtime.start;
 runtime.start=function(){trace.instrument(game);return start.call(this);};
 wx.onHide?.(()=>trace.lifecycle('hide'));
 wx.onShow?.(()=>trace.lifecycle('show'));
 runtime.freezeTrace=trace;
 return trace;
}
module.exports={window,document,Image:function(){return wx.createImage();},location:{protocol:'wx:',search:'',hostname:''},performance,requestAnimationFrame:frame,runtime};
