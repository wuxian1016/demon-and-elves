'use strict';
const rewardVideo=require('./wx-reward-video');
const createWall=require('./wall-rewarded-rebuild'),createWipeout=require('./wall-wipeout-reward');
const createResults=require('./wx-results-interstitial');
const createLobby=require('./wx-lobby-custom-ad');
const createVehicle=require('./rewarded-vehicle-revive');
const createManual=require('./rewarded-manual-save-gate');
// This bridge is the only place to call either lifecycle through the host.
module.exports=function adSurfaces({
 wx,rewardId,interstitialId,lobbyId,wallHost,towerHost,vehicleHost,manualHost,resultsLive,resultsWarmLive,resultsTrace,lobbyLive,lobbyLayout,lobbyPolicy,lobbyMeasure,
 otherAd=()=>false,clock=Date.now,after=setTimeout,clear=clearTimeout
}){
 const raw=rewardVideo(wx,rewardId,clock,after,clear);
 let rewardOwner=null,manualPanel=null,guard=0,skipNextLobby=false;
 const lobby=createLobby({wx,id:lobbyId,otherIds:[rewardId,interstitialId],live:lobbyLive,layout:lobbyLayout,policy:lobbyPolicy,measure:lobbyMeasure,
  competing:()=>!!rewardOwner||!!manualPanel||results.busy()||otherAd()!==false});
 const results=createResults({wx,id:interstitialId,rewardId,live:resultsLive,warmLive:resultsWarmLive,trace:resultsTrace,now:clock,later:after,clear,
  competing:()=>!!rewardOwner||!!manualPanel||lobby.busy()||otherAd()!==false,onPresented:()=>{skipNextLobby=true;}});
 const safeWall=()=>{
  try{return !results.busy()&&!lobby.busy()&&otherAd()===false;}catch{return false;}
 };
 const port=owner=>({
  supported:()=>raw.supported,
  loadFailure:()=>raw.loadFailure(),
  warm:()=>safeWall()&&!rewardOwner&&(owner==='manual')===!!manualPanel&&raw.warm(),
  ready:()=>safeWall()&&!rewardOwner&&(owner==='manual')===!!manualPanel&&raw.ready(),
  play:done=>{
   if(!safeWall()||rewardOwner||(owner==='manual')!==!!manualPanel)return false;
   const stamp=++guard;
   rewardOwner=owner;
   try{
    if(raw.play(result=>{
     if(stamp!==guard)return;
     rewardOwner=null;done(result);
    }))return true;
   }catch{}
   if(guard===stamp)rewardOwner=null;
   return false;
  },
  cancel(){
   if(rewardOwner&&rewardOwner!==owner)return;
   ++guard;rewardOwner=null;raw.cancel();
  }
 });
 const wall=createWipeout({...wallHost,video:port('wall')});
 const vehicle=vehicleHost?createVehicle({...vehicleHost,video:port('vehicle'),canOffer:()=>vehicleHost.canOffer()===true&&!wall.offer()}):null;
 const tower=towerHost?createWall({...towerHost,kind:'tower',video:port('tower')}):null;
 const manual=manualHost?createManual({...manualHost,video:port('manual')}):null;
 const leaveManual=()=>{manual?.cancel();manualPanel=null;};
 const cancelRecovery=()=>{wall.cancel();vehicle?.cancel();tower?.cancel();};
 return {
  wall,tower,vehicle,results,lobby,
  prepareManual(panel,slot,match){if(!manual)return false;manualPanel=panel;return manual.prepare(panel,slot,match);},
  watchManual:(panel,slot,match,save)=>manualPanel===panel?manual?.start(panel,slot,match,save):false,
  interruptManual:panel=>manual?.cancel(panel),
  leaveManual,
  // Host confirmed actual results BEFORE this call. Cancel outstanding wall
  // operations, and skip this results interstitial if a rewarded display had started.
  enterResults(matchId){
   if(resultsLive(matchId)!==true)return false;
   const noAd=!!rewardOwner||lobby.busy();
   leaveManual();lobby.leave();cancelRecovery();
   return results.entered(matchId,{noAd});
  },
  warmResults:id=>results.warm(id),
  leaveResults:()=>results.left(),
  enterLobby(visitId,{userInitiated=false}={}){
   if(typeof lobbyLive!=='function'||lobbyLive(visitId)!==true)return false;
   const noAd=!!rewardOwner||results.busy()||skipNextLobby&&!userInitiated;
   skipNextLobby=false;
   leaveManual();results.left();cancelRecovery();
   return lobby.entered(visitId,{noAd});
  },
  leaveLobby:()=>lobby.leave(),
  lobbyLayoutChanged:()=>lobby.layoutChanged(),
  reset(){lobby.leave();leaveManual();results.left();cancelRecovery();skipNextLobby=false;}
 };
};
