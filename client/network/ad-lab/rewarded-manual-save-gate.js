'use strict';
const safe=(f,...a)=>{try{return f(...a);}catch{return undefined;}};
const valid=(p,s)=>p&&typeof p==='object'&&Number.isSafeInteger(s)&&s>=1&&s<=10;
module.exports=function manualSaveGate({video,live,notice=()=>{}}){
 let current=null;
 const same=r=>current===r&&safe(live,r.panel,r.slot,r.match)===true;
 function cancel(panel){
  if(!current||panel&&current.panel!==panel)return;
  const r=current;current=null;if(r.phase==='playing')safe(video.cancel);r.resolve?.();
 }
 function prepare(panel,slot,match){
  if(!valid(panel,slot)||!match||safe(live,panel,slot,match)!==true)return false;
  return safe(video.warm)===true;
 }
 function start(panel,slot,match,confirmedWrite){
  if(!valid(panel,slot)||!match||typeof confirmedWrite!=='function'||safe(live,panel,slot,match)!==true)return false;
  if(current){if(same(current))return true;cancel();}
  if(safe(video.ready)!==true){
   safe(notice,panel,'广告暂不可用，本次未保存');safe(video.warm);return true;
  }
  let finish;
  const row=current={panel,slot,match,phase:'playing'};
  const promise=new Promise(resolve=>{finish=resolve;});
  const end=result=>{
   if(row.phase!=='playing')return;
   if(!same(row)){if(current===row)current=null;finish();return;}
   if(result!=='ended'){
    current=null;safe(notice,panel,result==='closed'?'广告未看完，本次未保存':'广告暂不可用，本次未保存');
    safe(video.warm);finish();return;
   }
   row.phase='writing';
   // Validate before native serialization and again before native write. UI
   // remains cancellable while waiting for the ad; real writes retain native lock.
   Promise.resolve().then(()=>{
    if(same(row))return confirmedWrite(()=>same(row)&&row.phase==='writing');
   }).catch(()=>{if(same(row))safe(notice,panel,'保存失败，原档案未删除');}).finally(()=>{
    if(current===row)current=null;
    finish();
   });
  };
  row.resolve=finish;
  safe(notice,panel,'完整观看后才会保存；可返回');
  if(safe(video.play,end)!==true)end('failed');
  // No caller must await this to leave; cancellation settles at once.
  return promise;
 }
 return {prepare,start,cancel,pending:()=>current?.phase==='playing'};
};
