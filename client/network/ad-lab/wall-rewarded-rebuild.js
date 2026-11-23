'use strict';
const labels=Object.freeze({watch:'看广告重建城墙',skip:'继续游戏'});
const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=2?n:null;
// Native host supplies authoritative wall ownership, destruction semantics, liveness,
// safe UI placement, and an atomic fresh tile validation+rebuild. No paused game flag.
module.exports=function create({video,readLedger,writeLedger,scope,canOffer,canRebuild,rebuild,reserve,kind='wall',canRetain=canRebuild,notify=()=>{},onChange=()=>{}}){
 const tower=kind==='tower',words=tower?Object.freeze({watch:'看广告重建防御塔',skip:'继续游戏'}):labels;
 let round=null,epoch=0,used=2,ready=false,queue=[],pending=null,seen=new Set();
 const clear=()=>{
  ++epoch;queue=[];const row=pending;pending=null;
  if(row){try{row.release?.();}catch{}}
  try{video.cancel();}catch{}onChange();
 };
 function restore(data){
  clear();seen.clear();round=validId(data?.id)?data.id:null;const saved=count(data?.used);ready=false;used=2;
  if(!round||saved===null)return false;
  try{const raw=readLedger(round),stored=raw==null?0:count(raw);if(stored===null)return false;
   used=Math.max(saved,stored);if(used!==stored&&writeLedger(round,used)!==true){used=2;return false;}
   ready=true;return true;
  }catch{used=2;return false;}
 }
 const active=()=>ready&&scope(round)===true;
 const snapshot=()=>round?{id:round,used}:null;
 function warm(){if(active()&&(used<2||queue.length))video.warm();}
 function lost(site){
  if(!active()||used>=2||site?.kind!==kind||site.own!==true||site.destroyed!==true||!Number.isFinite(site.x)||!Number.isFinite(site.y))return false;
  if((typeof site.eventId!=='string'&& !Number.isSafeInteger(site.eventId))||site.eventId===''||seen.has(site.eventId))return false;
  seen.add(site.eventId);
  // Count actual eligible destructions, not opportunities presented/accepted. Native
  // calls this exactly once each death, after live→dead and obstacle state update.
  const n=used+1;used=n;
  try{if(writeLedger(round,n)!==true){used=2;ready=false;clear();return false;}}catch{used=2;ready=false;clear();return false;}
  if(video.supported?.()===false||!canRetain(site))return false;
  const wall=Object.freeze({...site,loadFailure:video.loadFailure?.()??0});queue.push(wall);onChange();
  // Keep the qualifying death while the native video is still warming. No
  // prompt or playback before SDK readiness, and no ad gates the battle.
  const readyNow=video.ready()&&canRebuild(site);
  if(!readyNow)video.warm();
  return readyNow;
 }
 function discardBlocked(){for(let i=queue.length-1;i>=0;i--)if(queue[i].loadFailure!==(video.loadFailure?.()??0)||!canRetain(queue[i]))queue.splice(i,1);}
 function offer(){
  if(!active())return null;discardBlocked();
  if(pending||!video.ready()||!canOffer())return null;
  return queue.find(canRebuild)||null;
 }
 function dismiss(wall){
  if(!wall||offer()!==wall)return false;
  queue.splice(queue.indexOf(wall),1);onChange();return true;
 }
 function watch(wall){
  if(!wall||offer()!==wall)return false;
  queue.splice(queue.indexOf(wall),1);const id=round,stamp=epoch;let release;
  try{release=reserve?.(wall);}catch{onChange();return true;}
  if(release===false){onChange();return true;}
  const row=pending={wall,release:typeof release==='function'?release:null};
  const done=outcome=>{
   if(pending!==row||id!==round||stamp!==epoch)return;
   pending=null;try{
    if(outcome==='ended'&&active()){
     let rebuilt=false;try{rebuilt=canRebuild(wall,row.release)&&rebuild(wall,row.release)===true;}catch{}
     notify(rebuilt?(tower?'防御塔已原地重建':'城墙已原地重建'):(tower?'原位置已不可用，未重建防御塔':'原位置已不可用，未重建城墙'));
    }
   }finally{
    try{row.release?.();}catch{}
    onChange();if(active()&&(used<2||queue.length>0))video.warm();
   }
  };
  let started=false;try{started=video.play(done)===true;}catch{}
  if(!started)done('failed');else if(pending===row)onChange();return true;
 }
 return {restore,start:id=>restore({id,used:0}),snapshot,warm,lost,offer,watch,dismiss,cancel:clear,labels:words};
};
