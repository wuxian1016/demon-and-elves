'use strict';
const masks={robot:1,tank:2};
const validRound=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
const validMask=n=>Number.isInteger(n)&&n>=0&&n<=3;
const safe=(fn,...args)=>{try{return fn(...args);}catch{return undefined;}};
module.exports=function vehicleRevive({
 video,scope,readLedger,writeLedger,canOffer,canRestore,canRetain=canRestore,restoreVehicle,reserve,notify=()=>{},onChange=()=>{},onPresented=()=>{}
}){
 let match=null,epoch=0,mask=3,enabled=false,queued=[],playing=null;
 const active=()=>enabled&&safe(scope,match)===true;
 const release=row=>{if(row?.release)safe(row.release);};
 function clear(){
  ++epoch;queued=[];const p=playing;playing=null;release(p);safe(video.cancel);safe(onChange);
 }
 function restore(data){
  clear();match=validRound(data?.id)?data.id:null;enabled=false;mask=3;
  if(!match||!validMask(data?.mask))return false;
  try{
   const saved=readLedger(match),old=saved==null?0:saved;if(!validMask(old))return false;
   const result=old|data.mask;
   if(result!==old&&writeLedger(match,result)!==true)return false;
   mask=result;enabled=true;return true;
  }catch{return false;}
 }
 function lost(death){
  const bit=Object.prototype.hasOwnProperty.call(masks,death?.kind)?masks[death.kind]:0;
  if(!active()||!bit||(mask&bit)!==0||death?.own!==true||death.destroyed!==true||
   !death.unit||typeof death.unit!=='object'||!['number','string'].includes(typeof death.eventId)||String(death.eventId)==='')return false;
  // A driver may still be standing on the wreck. Keep the native death
  // receipt while we wait for the site to clear; no use is spent until visible.
  if(video.supported?.()===false||safe(canRetain,death)!==true||queued.some(r=>r.kind===death.kind))return false;
  queued.push({...death,bit,presented:false,loadFailure:video.loadFailure?.()??0});safe(onChange);
  const readyNow=video.ready();if(!readyNow)safe(video.warm);return readyNow;
 }
 function offer(){
  if(!active())return null;
  const failure=video.loadFailure?.()??0;
  for(let i=queued.length-1;i>=0;i--){
   const row=queued[i];
   if(row.loadFailure!==failure||safe(canRetain,row)!==true||!row.presented&&(mask&row.bit)!==0)queued.splice(i,1);
  }
  if(playing||!video.ready()||safe(canOffer)!==true)return null;
  return queued.find(row=>safe(canRestore,row)===true)??null;
 }
 function present(row){
  if(!row||offer()!==row)return false;
  if(row.presented)return true;
  const next=mask|row.bit;
  if(safe(writeLedger,match,next)!==true){enabled=false;mask=3;clear();return false;}
  mask=next;row.presented=true;safe(onPresented);return true;
 }
 function skip(row){
  if(!row||!row.presented||offer()!==row)return false;queued.splice(queued.indexOf(row),1);safe(onChange);return true;
 }
 function watch(row){
  if(!row||!row.presented||offer()!==row)return false;
  queued.splice(queued.indexOf(row),1);const serial=epoch;
  let reservation;
  if(typeof reserve==='function'){
   try{reservation=reserve(row);}catch{reservation=false;}
   if(reservation===false){safe(onChange);return true;}
  }
  const p=playing={release:typeof reservation==='function'?reservation:null};
  const end=result=>{
   if(serial!==epoch||playing!==p)return;
   playing=null;
   try{
    if(result==='ended'&&active()){
     const ok=safe(canRestore,row,p.release)===true&&safe(restoreVehicle,row,p.release)===true;
     safe(notify,ok?(row.kind==='robot'?'机器人已复活':'坦克已复活'):'当前无法安全复活车辆');
    }
   }finally{
    release(p);safe(onChange);if(active()&&(mask<3||queued.length))safe(video.warm);
   }
  };
  if(safe(video.play,end)!==true)end('failed');else safe(onChange);
  return true;
 }
 return {start:id=>restore({id,mask:0}),restore,snapshot:()=>match?{id:match,mask}:null,
  warm(){if(active()&&(mask<3||queued.length))safe(video.warm);},lost,offer,present,skip,watch,cancel:clear,
  labels:row=>({watch:row?.kind==='robot'?'看广告复活机器人':'看广告复活坦克',skip:'继续游戏'})};
};
