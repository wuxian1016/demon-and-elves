'use strict';
const validId=x=>typeof x==='string'&&/^adunit-[a-z0-9]+$/i.test(x);
const safe=(fn,...a)=>{try{return fn(...a);}catch{return undefined;}};
module.exports=function resultsInterstitial({
 wx,id,rewardId,live,warmLive=()=>false,competing=()=>false,later=setTimeout,clear=clearTimeout,
 now=Date.now,showTimeout=8000,closeTimeout=60000,onPresented=()=>{},trace=()=>{}
}){
 let scene=null,lastTapId=null;
 const used=new WeakSet();
 const sdk=safe(()=>wx?.getAppBaseInfo?.()?.SDKVersion||wx?.getSystemInfoSync?.().SDKVersion);
 const parts=typeof sdk==='string'&&/^\d+\.\d+\.\d+$/.test(sdk)?sdk.split('.').map(Number):null;
 const supported=!!(validId(id)&&(!validId(rewardId)||String(rewardId).toLowerCase()!==id.toLowerCase())&&
  typeof wx?.createInterstitialAd==='function'&&parts?.every(Number.isSafeInteger)&&
  (parts[0]>2||parts[0]===2&&parts[1]>=6));
 const current=r=>scene===r&&r.entered&&safe(live,r.id)===true;
 const valid=r=>scene===r&&(r.entered?safe(live,r.id)===true:safe(warmLive,r.id)===true);
 const blocked=()=>safe(competing)!==false;
 function log(step,error){
  const v=error?.errCode;
  const code=Number.isSafeInteger(v)?v:typeof v==='string'&&/^(?:-?\d{1,12}|[A-Z_]{2,24})$/.test(v)?v:undefined;
  safe(trace,step,code);
 }
 function release(r){
  if(r.timer!=null)safe(clear,r.timer);r.timer=null;
  const a=r.ad;r.ad=null;r.phase='retired';
  if(!a)return;
  safe(()=>a.offLoad?.(r.load));safe(()=>a.offError?.(r.error));safe(()=>a.offClose?.(r.close));safe(()=>a.destroy?.());
 }
 function finish(r,possiblyPresented=false){
  if(scene!==r||!r.next)return;
  const next=r.next;r.next=null;release(r);
  if(current(r)){if(possiblyPresented)safe(onPresented,r.id);next();}
 }
 function left(){
  const r=scene;scene=null;
  if(r){r.next=null;release(r);}
 }
 const empty=id=>({id,ad:null,phase:'empty',timer:null,next:null,tapped:false,entered:false,attempts:0,retryAt:0});
 function failedLoad(r,stage,error){log(stage,error);r.retryAt=now()+20000;release(r);}
 function prepare(r){
  if(!supported||r.id===lastTapId||blocked()||r.attempts>=2||now()<r.retryAt||r.ad)return false;
  r.attempts++;
  let a;
  try{a=wx.createInterstitialAd({adUnitId:id});}catch(error){failedLoad(r,'create-rejected',error);return false;}
  if(!a||typeof a!=='object'||used.has(a)||['show','onLoad','onError','onClose','destroy'].some(k=>typeof a[k]!=='function')){
   if(a&&!used.has(a))safe(()=>a.destroy?.());failedLoad(r,'create-unavailable');return false;
  }
  log(r.entered?'created-at-results':'created-in-match');
  used.add(a);r.ad=a;r.phase='loading';
  r.load=()=>{if(!valid(r)||r.ad!==a||r.phase!=='loading')return;
   if(r.timer!=null)safe(clear,r.timer);r.timer=null;r.phase='ready';log('onLoad');};
  r.error=error=>{
   if(!valid(r)||r.ad!==a)return;
   if(r.tapped){log('onError',error);finish(r,r.phase==='shown');}else failedLoad(r,'onError',error);
  };
  r.close=()=>{
   if(!current(r)||r.ad!==a||!['starting','shown'].includes(r.phase))return;
   log('close');finish(r,true);
  };
  r.timer=later(()=>{if(valid(r)&&r.ad===a&&r.phase==='loading')failedLoad(r,'load-timeout');},12000);
  try{a.onError(r.error);if(r.ad!==a)return true;a.onClose(r.close);a.onLoad(r.load);}
  catch(error){failedLoad(r,'listener-rejected',error);}
  return true;
 }
 // WeChat preloads on creation and notifies onLoad. Never call show during prep,
 // ordinary play, failure retry, or entrance to results.
 function warm(matchId){
  if(matchId==null||!supported||safe(warmLive,matchId)!==true||blocked()||matchId===lastTapId)return false;
  if(scene?.id!==matchId){left();scene=empty(matchId);}
  if(scene.entered)return false;
  return prepare(scene);
 }
 function entered(matchId,{noAd=false}={}){
  if(matchId==null||safe(live,matchId)!==true)return false;
  if(scene?.id===matchId&&scene.entered)return true;
  if(scene?.id!==matchId){left();scene=empty(matchId);}
  const r=scene;r.entered=true;log('results-entered');
  if(!supported){log('unsupported');return true;}
  if(noAd||blocked()){log('blocked-by-other-ad');release(r);return true;}
  if(!r.ad)prepare(r);
  return true;
 }
 // No readiness, no fill or error: continue without blocking the original exit.
 function tap(matchId,continueToLobby){
  const r=scene;
  if(!r||r.id!==matchId||!current(r)||typeof continueToLobby!=='function')return false;
  if(r.tapped)return true;
  r.tapped=true;lastTapId=matchId;r.next=continueToLobby;log('return-tap');
  if(r.phase!=='ready'||blocked()){log(r.phase==='ready'?'tap-blocked':'tap-not-ready');finish(r);return true;}
  r.phase='starting';log('show-request');
  const failsafe=()=>{log('show-timeout');finish(r,true);};
  const failed=error=>{if(!current(r)||r.phase!=='starting')return;log('show-rejected',error);finish(r);};
  r.timer=later(failsafe,showTimeout);
  let result;
  try{result=r.ad.show();}catch(error){failed(error);return true;}
  Promise.resolve(result).then(()=>{
   if(!current(r)||r.phase!=='starting')return;
   if(r.timer!=null)safe(clear,r.timer);
   r.phase='shown';log('shown');r.timer=later(()=>{log('close-timeout');finish(r,true);},closeTimeout);
  },failed);
  return true;
 }
 return {entered,warm,tap,left,supported,busy:()=>!!scene&&['starting','shown'].includes(scene.phase)};
};
