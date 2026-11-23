'use strict';
// One prepared/current native object at a time. Recreate after retirement so a native
// event from an earlier show cannot be delivered to a newer playback's listeners.
module.exports=function rewardVideo(wx,id,clock=Date.now,after=setTimeout,cancel=clearTimeout){
 let current=null,retry=0,disabled=false,loadFailure=0;
 const used=new WeakSet();
 let sdk;
 try{sdk=(wx?.getAppBaseInfo?.().SDKVersion||wx?.getSystemInfoSync?.().SDKVersion||'').split('.').map(Number);}catch{}
 const supported=typeof wx?.createRewardedVideoAd==='function'&&typeof id==='string'&&/^adunit-[a-z0-9]+$/i.test(id)&&sdk?.length>=3&&sdk.every(Number.isSafeInteger)
 &&(sdk[0]>3||sdk[0]===3&&(sdk[1]>7||sdk[1]===7&&sdk[2]>=1));
 const cleanup=r=>{
  if(current===r)current=null;
  if(r.timer!=null)cancel(r.timer);r.timer=null;
  if(r.phase==='closed')return;
  r.phase='closed';
  try{r.ad.offClose?.(r.close);}catch{}
  try{r.ad.offError?.(r.error);}catch{}
  try{r.ad.destroy?.();}catch{}
 };
 const settle=(r,result)=>{
  if(r.phase==='closed')return;
  const done=r.done;if(result==='failed'&&r.phase==='loading'&&!done)loadFailure++;r.done=null;cleanup(r);if(result==='failed')retry=clock()+5000;
  if(done)done(result);
 };
 const timer=(r,n,fn)=>{if(r.timer!=null)cancel(r.timer);r.timer=after(fn,n);};
 function prepare(onReady,done=null){
  if(!supported||disabled||current||clock()<retry)return false;
  let ad;try{ad=wx.createRewardedVideoAd({adUnitId:id,multiton:true,disableFallbackSharePage:true});}catch{loadFailure++;retry=clock()+5000;return false;}
  if(!ad||typeof ad.load!=='function'||typeof ad.show!=='function'||typeof ad.onClose!=='function'||typeof ad.onError!=='function'){disabled=true;loadFailure++;return false;}
  if(used.has(ad)){disabled=true;loadFailure++;return false;}used.add(ad);
  const r={ad,phase:'loading',timer:null,done,early:null};current=r;
  r.close=res=>{
   if(current!==r||!['showing','shown'].includes(r.phase))return;
   const result=res?.isEnded===true?'ended':'closed';
   if(r.phase==='showing'){if(r.early===null)r.early=result;return;}
   settle(r,result);
  };
  r.error=()=>{
   if(current!==r)return;
   if(r.phase==='showing')return; // Promise rejection is authoritative for retrying native show().
   settle(r,'failed');
  };
  try{
   ad.onClose(r.close);ad.onError(r.error);
   timer(r,9000,()=>settle(r,'failed'));
   Promise.resolve(ad.load()).then(()=>{
    if(current===r&&r.phase==='loading'){if(r.timer!=null)cancel(r.timer);r.timer=null;r.phase='ready';onReady?.(r);}
   },()=>settle(r,'failed'));
  }catch{settle(r,'failed');}
  return true;
 }
 function play(done){
  const first=current;if(first?.phase!=='ready'||typeof done!=='function')return false;
  function show(r,again){
   if(current!==r||r.phase!=='ready')return;
   r.done=done;r.early=null;r.phase='showing';
   const fail=()=>settle(r,'failed');
   timer(r,10000,fail);
   function rejected(){
    if(current!==r||r.phase!=='showing')return;
    if(again)return fail();
    // Exactly one load/show retry. Use a fresh SDK identity even on a rejected
    // show, so delayed callbacks from that failed playback cannot credit it.
    r.done=null;cleanup(r);
    if(!prepare(replacement=>show(replacement,true),done))done('failed');
   }
   try{Promise.resolve(r.ad.show()).then(()=>{
    if(current!==r||r.phase!=='showing')return;
    r.phase='shown';timer(r,180000,fail);
    if(r.early!==null)settle(r,r.early);
   },rejected);}catch{rejected();}
  }
  show(first,false);return true;
 }
 return {warm:()=>prepare(),ready:()=>current?.phase==='ready',play,cancel(){if(current){current.done=null;cleanup(current);}},supported,loadFailure:()=>loadFailure};
};
