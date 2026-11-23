// Only data crosses the wire. Audio is played by the original local mixer, with
// its existing preferences, assets, mute/hide handling and attenuation.
const SOUND_NAMES='ui error wood mine step demonStep dragonStep melee hit arrow cannon laser charge heavyLaser demonStrike bite demonBuildingHit ice magic fire roar summon stun shield shieldBreak destroy death demonDeath dragonDeath warning thunder build upgrade pickup repair victory lose save'.split(' ');
const sounds=new Set(SOUND_NAMES),kinds=new Set(['player','walls','earlyWalls']);
const terminal=g=>g.state==='win'||g.state==='lose'||g.loseReason==='allTeamDown'||g.loseReason==='teamDestroyed587';
const {isPlainRecord:plain,plainRecordIssue}=require('./plain-record');
function validOffer(o){return o===null||plain(o)&&Object.keys(o).every(k=>['kind','serial','title','detail','action'].includes(k))&&kinds.has(o.kind)&&Number.isSafeInteger(o.serial)&&o.serial>0&&typeof o.title==='string'&&o.title.length<=128&&typeof o.detail==='string'&&o.detail.length<=256&&typeof o.action==='string'&&o.action.length<=128;}
function eventIssue(e,maxTick){
 const record=plainRecordIssue(e);if(record)return{reason:'EVENT_RECORD_'+record,field:''};
 if(!Number.isSafeInteger(e.id)||e.id<=0)return{reason:'EVENT_ID',field:'id'};
 if(!Number.isSafeInteger(e.tick)||e.tick<0)return{reason:'EVENT_TICK',field:'tick'};
 if(maxTick!==undefined&&e.tick>maxTick)return{reason:'EVENT_FUTURE_TICK',field:'tick'};
 if(e.type==='sound'){
  if(Object.keys(e).some(k=>!['id','tick','type','name','ui','x','y'].includes(k)))return{reason:'EVENT_FIELD',field:'[unknown-field]'};
  if(!sounds.has(e.name))return{reason:'EVENT_SOUND_NAME',field:'name'};
  if(typeof e.ui!=='boolean')return{reason:'EVENT_SOUND_UI',field:'ui'};
  if(!((e.x===undefined&&e.y===undefined)||(Number.isFinite(e.x)&&Number.isFinite(e.y))))return{reason:'EVENT_SOUND_POSITION',field:'position'};
  return null;
 }
 if(e.type!=='toast')return{reason:'EVENT_TYPE',field:'type'};
 if(Object.keys(e).some(k=>!['id','tick','type','text','duration'].includes(k)))return{reason:'EVENT_FIELD',field:'[unknown-field]'};
 if(typeof e.text!=='string'||e.text.length>512)return{reason:'EVENT_TOAST_TEXT',field:'text'};
 if(!Number.isInteger(e.duration)||e.duration<0||e.duration>10000)return{reason:'EVENT_TOAST_DURATION',field:'duration'};
 return null;
}
function validEvent(e){return eventIssue(e)===null;}
function createGameFeedback({game,sound,send,shareBridge,cancelShare,schedule=setTimeout,cancel=clearTimeout,waitTimeoutMs=15000}){
 let current=null,epoch=null,owner=null,roomId=null,last=0,pending=false,pendingOffer=null,nonce=0,generation=0,unsent=null,sentIntent=null,notice=null;
 const scope=()=>JSON.stringify([roomId,epoch,owner]);
 const audioLedger=new Map(),audioLimit=4096,audioStats={attempted:0,duplicateSkips:0,capacityDeferred:0,peak:0};
 const earlySounds=new Set('wood mine step demonStep dragonStep melee hit arrow cannon laser bite ice magic'.split(' '));
 const audioKey=e=>JSON.stringify([e.id,e.tick,e.name,e.ui,e.x,e.y]);
 const sameScope=p=>p?.epoch===epoch&&(p.roomId??null)===roomId&&p.viewerOwnerId===owner;
 const validateEarly=p=>{if(!plain(p)||!Number.isSafeInteger(p.epoch)||!Number.isSafeInteger(p.tick)||typeof p.viewerOwnerId!=='string'||!Array.isArray(p.events)||p.events.length>128||p.events.some(e=>eventIssue(e,p.tick))||new Set(p.events.map(e=>e.id)).size!==p.events.length)throw Error('INVALID_GAME_FEEDBACK');};
 const matches=o=>o&&o.scope===scope()&&current&&o.kind===current.kind&&o.serial===current.serial&&!terminal(game);
 const toast=(text,action)=>{game.toast={text,time:3000};game.wxUiDirty=true;if(current&&!terminal(game))notice={scope:scope(),kind:current.kind,serial:current.serial,detail:text,action};};
 const nextNonce=()=>`rescue_${epoch}_${++nonce}_${Date.now().toString(36)}`;
 const clearUnsent=()=>{if(unsent?.timer!=null)cancel(unsent.timer);unsent=null;};
 const invalidate=()=>{const hadBridge=pending;generation++;pending=false;pendingOffer=null;sentIntent=null;notice=null;game.shareRewardPending=false;clearUnsent();if(hadBridge&&typeof cancelShare==='function'){try{cancelShare();}catch(_){}}};
 const waitingText=(intent,expired=false)=>intent.action==='continueShareRescue'?(expired?'连接未恢复，可再点继续游戏':'连接恢复中，继续请求尚未发送'):(expired?'连接未恢复，请点击重试':'连接恢复中，请稍候或重试');
 const waitForSync=intent=>{
  const action=intent.action==='shareRescue'?'重试救援请求':undefined;
  if(intent.timer==null&&!intent.expired)intent.timer=schedule(()=>{if(unsent!==intent)return;intent.timer=null;intent.expired=true;toast(waitingText(intent,true),action);},waitTimeoutMs);
  toast(waitingText(intent,intent.expired),action);
 };
 const finishReceipt=(intent,receipt)=>{
  if(sentIntent!==intent||!matches(intent)||typeof receipt?.accepted!=='boolean')return false;
  if(receipt.accepted){intent.acknowledged=true;toast('服务器已确认，正在更新对局','等待对局更新');}
  else{sentIntent=null;toast('服务器未接受，请稍后重试','重新尝试救援');}
  return true;
 };
 const commandMatches=(intent,command)=>matches(intent)&&command?.epoch===epoch&&command.action===intent.action&&command.args?.kind===intent.kind&&command.args?.serial===intent.serial&&command.args?.nonce===intent.nonce&&Number.isSafeInteger(command.seq)&&command.seq>0;
 const findTracked=command=>{const intent=sentIntent||unsent;return commandMatches(intent,command)&&intent.seq===command.seq?intent:null;};
 const submit=intent=>{
  if(unsent!==intent||!matches(intent)){if(unsent===intent)clearUnsent();return false;}
  let result;
  try{result=send(intent.action,{kind:intent.kind,serial:intent.serial,nonce:intent.nonce});}
  catch(error){
   intent.seq=null;intent.earlyReceipt=null;
   if(error?.message==='INPUT_UNAVAILABLE'){waitForSync(intent);return false;}
   clearUnsent();toast('救援请求未完成，请稍后重试');return false;
  }
  // False is explicitly not enqueued. Accepted or uncertain async sends are never replayed.
  if(result===false){intent.seq=null;intent.earlyReceipt=null;waitForSync(intent);return false;}
  sentIntent=intent;clearUnsent();toast('请求已发送，等待服务器确认','等待服务器确认');
  if(intent.earlyReceipt){const receipt=intent.earlyReceipt;intent.earlyReceipt=null;finishReceipt(intent,receipt);}
  if(result&&typeof result.then==='function')Promise.resolve(result).then(receipt=>finishReceipt(intent,receipt),()=>{if(sentIntent===intent&&matches(intent)){intent.unknown=true;toast('请求结果待确认，请等待连接恢复','等待连接恢复');}});
  return true;
 };
 const createIntent=(action,kind,serial)=>({action,kind,serial,scope:scope(),nonce:nextNonce(),timer:null,expired:false,seq:null,earlyReceipt:null});
 const retry=intent=>{if(intent.timer!=null)cancel(intent.timer);intent.timer=null;intent.expired=false;return submit(intent);};
 const api={
  // Cosmetic spatial sounds may be consumed before expensive world preparation.
  // Gameplay, rescue offers, toasts and terminal cues remain commit ordered.
  preplay(packet,currentTick=packet?.tick){
   validateEarly(packet);if(!Number.isSafeInteger(currentTick)||currentTick<packet.tick)throw Error('INVALID_GAME_FEEDBACK');
   if(!sameScope(packet)||!['hunt','prep'].includes(game.state)||packet.worldView?.state!==game.state||game.sessionMenuOpen||game.demonPanel)return 0;
   for(const e of packet.events)if(audioLedger.has(e.id)&&audioLedger.get(e.id)!==audioKey(e))throw Error('INVALID_GAME_FEEDBACK');
   let count=0;for(const e of packet.events){
    if(e.type!=='sound'||e.ui||!earlySounds.has(e.name)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.id<=last||currentTick-e.tick>120)continue;
    const key=audioKey(e);if(audioLedger.get(e.id)===key)continue;
    if(audioLedger.has(e.id))throw Error('INVALID_GAME_FEEDBACK');
    if(audioLedger.size>=audioLimit){audioStats.capacityDeferred++;continue;}
    if(sound&&typeof sound.play==='function')sound.play(e.name,{x:e.x,y:e.y},{ui:false,world:game});
    audioLedger.set(e.id,key);audioStats.attempted++;audioStats.peak=Math.max(audioStats.peak,audioLedger.size);count++;
   }return count;
  },
  eventApplied(packet,event){return sameScope(packet)&&event?.type==='sound'&&audioLedger.get(event.id)===audioKey(event);},
  audioLaneReport(){return{...audioStats,pending:audioLedger.size,limit:audioLimit,scope:'Actual local mixer attempts only; no input ACK, entity sample, authority age or draw confirmation.'};},
  offer(){if(terminal(game))return null;return matches(notice)?{...current,detail:notice.detail,action:notice.action||current.action}:current;},
  status(){const offer=api.offer();return offer?{pending,waiting:!!unsent,submitted:!!sentIntent,kind:offer.kind,serial:offer.serial,roomId,epoch,viewerOwnerId:owner,detail:offer.detail,action:pending?'取消分享等待':offer.action}:null;},
  trackCommand(command){const intent=unsent;if(!commandMatches(intent,command))return false;intent.seq=command.seq;return true;},
  acknowledge(command,receipt){const intent=findTracked(command);if(!intent||receipt?.epoch!==command.epoch||receipt?.seq!==command.seq||typeof receipt.accepted!=='boolean')return false;if(sentIntent===intent)return finishReceipt(intent,receipt);intent.earlyReceipt=receipt;return true;},
  acknowledgeFailure(command){const intent=findTracked(command);if(!intent||sentIntent!==intent)return false;intent.unknown=true;toast('请求结果待确认，请等待连接恢复','等待连接恢复');return true;},
  appliedEventId(packet){return packet?.epoch===epoch&&(packet.roomId??null)===roomId&&packet.viewerOwnerId===owner?last:0;},
  apply(packet,currentTick=packet?.tick){
   if(!plain(packet)||!Number.isSafeInteger(packet.epoch)||!Number.isSafeInteger(packet.tick)||!Number.isSafeInteger(currentTick)||currentTick<packet.tick||typeof packet.viewerOwnerId!=='string'||!Array.isArray(packet.events)||packet.events.length>128||!packet.events.every(validEvent)||!validOffer(packet.rescueOffer??null))throw Error('INVALID_GAME_FEEDBACK');
   if(epoch!==null&&(packet.epoch<epoch||packet.viewerOwnerId!==owner)){invalidate();throw Error('FEEDBACK_IDENTITY_MISMATCH');}
   const incomingRoom=packet.roomId??null;
   if(epoch!==packet.epoch||roomId!==incomingRoom){invalidate();audioLedger.clear();epoch=packet.epoch;owner=packet.viewerOwnerId;roomId=incomingRoom;last=0;}
   current=terminal(game)?null:packet.rescueOffer??null;
   if(pendingOffer&&!matches(pendingOffer))invalidate();
   if(unsent&&!matches(unsent))clearUnsent();
   if(sentIntent&&!matches(sentIntent))sentIntent=null;
   if(notice&&!matches(notice))notice=null;
   // Validate the entire batch before side effects; age hidden FIFO feedback against current authority tick.
   for(const e of [...packet.events].sort((a,b)=>a.id-b.id)){if(e.id<=last)continue;last=e.id;if(e.tick>packet.tick||currentTick-e.tick>120)continue;
    if(e.type==='toast')game.toast={text:e.text,time:e.duration};
    else if(audioLedger.get(e.id)===audioKey(e)){audioStats.duplicateSkips++;}
    else if(sound&&typeof sound.play==='function')sound.play(e.name,e.x===undefined?null:{x:e.x,y:e.y},{ui:e.ui,world:game});
   }
   for(const id of audioLedger.keys())if(id<=last)audioLedger.delete(id);
   if(unsent&&!unsent.expired)submit(unsent);
   return true;
  },
  async requestShareRescue(kind,serial){
   const o=api.offer();if(!o||o.kind!==kind||o.serial!==serial)return false;
   if(pending){invalidate();toast('已取消等待，救援机会保留','重新分享');return false;}
   if(sentIntent&&matches(sentIntent))return false;
   if(unsent&&matches(unsent)&&unsent.action==='shareRescue')return retry(unsent);
   if(typeof shareBridge!=='function'){toast('当前环境不支持微信分享复活');return false;}
   clearUnsent();const token=generation;pending=true;pendingOffer={scope:scope(),kind,serial};game.shareRewardPending=true;toast('分享处理中，再次点击可取消等待','取消分享等待');
   try{
    // Keep the bridge's existing contract. Native UI return does not prove delivery or friend verification.
    await shareBridge({title:kind==='player'?'快来救救我的精灵！':kind==='earlyWalls'?'我的前期城墙被毁了，快来支援！':'我的10级城墙全毁了，快来支援！',query:`source=share_rescue&reward=${kind}&event=${serial}`});
    if(token!==generation||!matches(pendingOffer))return false;
    clearUnsent();unsent=createIntent('shareRescue',kind,serial);return submit(unsent);
   }catch(error){if(token===generation)toast(error?.code==='FRIEND_VERIFICATION_REQUIRED'?'好友验证未接入，救援机会保留':'分享未完成，救援机会保留','重新分享');return false;}
   finally{if(token===generation){pending=false;pendingOffer=null;game.shareRewardPending=false;game.wxUiDirty=true;}}
  },
  continueShareRescue(kind,serial){
   const o=api.offer();if(!o||o.kind!==kind||o.serial!==serial||kind==='player')return false;
   if(sentIntent&&matches(sentIntent))return false;
   if(pending)invalidate();
   if(unsent&&matches(unsent)&&unsent.action==='continueShareRescue')return retry(unsent);
   clearUnsent();unsent=createIntent('continueShareRescue',kind,serial);return submit(unsent);
  },
  handleShareRescueTap(x,y){const L=game.shareRescueLayout();if(!L)return false;const hit=b=>b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;if(['walls','earlyWalls'].includes(L.kind)&&hit(L.continueButton)){api.continueShareRescue(L.kind,L.serial);return true;}if(hit(L.button)){api.requestShareRescue(L.kind,L.serial);return true;}return ['walls','earlyWalls'].includes(L.kind);},
  reset(){invalidate();audioLedger.clear();Object.assign(audioStats,{attempted:0,duplicateSkips:0,capacityDeferred:0,peak:0});current=null;epoch=null;owner=null;roomId=null;last=0;}
 };
 return api;
}

module.exports={createGameFeedback,SOUND_NAMES,validEvent,validOffer,eventIssue};
