'use strict';
const labels=Object.freeze({watch:'看广告重建这段城墙',skip:'继续游戏'});
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
const BASE_USES=2,MAX_USES=BASE_USES+1;
const valid=d=>!!d&&Number.isSafeInteger(d.used)&&d.used>=0&&d.used<=MAX_USES&&typeof d.unlocked==='boolean'&&
 Number.isSafeInteger(d.ordinal)&&d.ordinal>=d.used;
// Older 3+1 test candidates are read once without refunding any consumed
// opportunity or discarding their replay cursor. Written state always fits 2+1.
const validStored=d=>valid(d)||d?.used===4&&d.unlocked===true&&Number.isSafeInteger(d.ordinal)&&d.ordinal>=4;
const safe=(fn,...args)=>{try{return fn(...args);}catch{return undefined;}};
const key=id=>'wall_reward_wipeout_v2:'+id;
// Keep the wipeout ledger outside old game snapshots: rewinding a save cannot
// reroll a consumed event or undo a previously reached level-10 unlock.
module.exports=function create({video,wx,scope,canOffer,canRetain,canRebuild,rebuild,notify,onChange,onPresented}){
 let id=null,ordinal=0,stored=null,armed=false,queue=[],pending=null,epoch=0;
 const active=()=>armed&&scope(id)===true;
 function clear(){++epoch;queue=[];pending=null;safe(video.cancel);safe(onChange);}
 function persist(next){
  try{wx.setStorageSync(key(id),next);const value=wx.getStorageSync(key(id));if(!valid(value)||value.used!==next.used||value.unlocked!==next.unlocked||value.ordinal!==next.ordinal)throw Error();
   stored=next;return true;
  }catch{armed=false;clear();return false;}
 }
 function restore(data){
  clear();id=idOK(data?.id)?data.id:null;ordinal=0;stored=null;armed=false;
  const savedOrdinal=data?.committed??data?.ordinal;
  if(!id||!Number.isSafeInteger(data?.ordinal)||data.ordinal<0||!validStored({...data,ordinal:savedOrdinal}))return false;
  try{
   const raw=wx.getStorageSync(key(id));
   if(raw!==''&&raw!=null&&!validStored(raw))return false;
   ordinal=data.ordinal;
   const merged={used:Math.min(MAX_USES,Math.max(raw?.used??0,data.used)),unlocked:raw?.unlocked===true||data.unlocked===true,ordinal:Math.max(raw?.ordinal??0,savedOrdinal)};
   if(!valid(merged))return false;
   armed=true;
   if(raw&&raw.used===merged.used&&raw.unlocked===merged.unlocked&&raw.ordinal===merged.ordinal){stored=merged;return true;}
   return persist(merged);
  }catch{armed=false;return false;}
 }
 function unlock(){
  return active()&&(!stored.unlocked?persist({...stored,unlocked:true}):true);
 }
 const totalRemaining=()=>stored&&(stored.used<(stored.unlocked?MAX_USES:BASE_USES));
 const remainingFor=row=>row.kind==='base'?stored.used<BASE_USES:stored.used===BASE_USES&&stored.unlocked;
 function retire(n,unavailable=false){
  if(!armed||!stored||n<=stored.ordinal)return;
  if(!persist({...stored,ordinal:n}))return;
  safe(onPresented);
  if(unavailable&&active())safe(notify,'当前没有可用广告，本次未扣城墙重建次数');
 }
 function prune(){
  if(!active())return;
  const loadFailure=video.loadFailure?.()??0;
  while(queue.length){
   const row=queue[0],unavailable=row.loadFailure!==loadFailure;
   if(!unavailable&&canRetain(row.wall)&&(row.presented||row.n>stored.ordinal&&remainingFor(row)))break;
   queue.shift();if(!row.presented)retire(row.n,unavailable);
   if(!armed)return;
  }
 }
 function baseAvailable(){
  prune();if(!active())return false;
  let reservations=0;
  for(const row of queue)if(row.kind==='base'&&!row.presented)reservations++;
  return stored.used+reservations<BASE_USES;
 }
 function enqueue(wall,kind){
  if(!active()||!wall||ordinal>=Number.MAX_SAFE_INTEGER)return false;
  const n=++ordinal;
  if(n<=stored.ordinal)return false;
  if(video.supported?.()===false){retire(n,true);return false;}
  if(!canRetain(wall)){if(!queue.length)retire(n);return false;}
  if(queue.length>=MAX_USES)return false;
  queue.push({wall,n,kind,presented:false,loadFailure:video.loadFailure?.()??0});
  safe(onChange);warm();return true;
 }
 function lost(wall){
  if(baseAvailable())return enqueue(wall,'base');
  // The bonus belongs to this native destroyed wall's degree, not to a
  // historical upgrade elsewhere or the number of surviving walls.
  if(!active()||!Number.isInteger(wall?.level)||wall.level<10||
     !stored.unlocked||stored.used>=MAX_USES||queue.some(r=>r.kind==='bonus'))return false;
  return enqueue(wall,'bonus');
 }
 function warm(){if(active()&&(totalRemaining()||queue.length))safe(video.warm);}
 function offer(){
  prune();if(!active()||pending||!video.ready()||!canOffer())return null;
  // With two not-yet-shown early rows queued, a later Lv10+ loss can wait behind
  // them; it never spends the bonus before both early offers are truly shown.
  const row=queue[0];return row&&canRebuild(row.wall)?row:null;
 }
 function present(row){
  if(!row||offer()!==row)return false;
  if(row.presented)return true;
  if(!persist({used:stored.used+1,unlocked:stored.unlocked,ordinal:row.n}))return false;
  row.presented=true;safe(onPresented);return true;
 }
 function dismiss(row){if(!row||!row.presented||offer()!==row)return false;queue.splice(queue.indexOf(row),1);safe(onChange);return true;}
 function watch(row){
  if(!row||!row.presented||offer()!==row)return false;
  queue.splice(queue.indexOf(row),1);
  const sameEpoch=epoch,sameId=id;pending=row;
  const done=result=>{
   if(sameEpoch!==epoch||sameId!==id||pending!==row)return;
   pending=null;
   if(result==='ended'&&active()){
    const ok=safe(canRebuild,row.wall)===true&&safe(rebuild,row.wall)===true;
    safe(notify,ok?'这段城墙已原地重建':'原位置不可用，本次城墙未重建');
   }
   safe(onChange);warm();
  };
  if(safe(video.play,done)!==true)done('failed');
  else if(pending===row)safe(onChange);
  return true;
 }
 return {start:id=>restore({id,used:0,unlocked:false,ordinal:0}),restore,lost,unlock,offer,present,warm,dismiss,watch,labels,cancel:clear,
  snapshot:()=>stored?{used:stored.used,unlocked:stored.unlocked,ordinal,committed:stored.ordinal}:null};
};
