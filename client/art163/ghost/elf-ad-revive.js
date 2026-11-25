'use strict';
module.exports=function(game,runtime,solo,video,trackPause){
 let elfAd=null,elfNotice=null;
 function playing(){return !!elfAd&&elfAd.body===game.player;}
 function playerEligible(serial){
  const offer=game.shareRescueOffer();
  return solo()&&game.player?.dead&&!game.roundStarting&&!game.roundLoading591&&offer?.kind==='player'&&offer.serial===serial;
 }
 function start(serial){
  if(elfAd||runtime.hidden||(!game.shareRescueVisible616()&&!(game.spectating587&&game.deathSpectatorMode587()&&game.teammateBuildings587()&&!game.popupActive515()))||!playerEligible(serial))return false;
  elfNotice=null;const order=elfAd={body:game.player,serial};
  const end=out=>{
   if(elfAd!==order)return;
   elfAd=null;
   if(game.player===order.body){
    if(playerEligible(serial)){
     game.sessionMenuOpen=false;game.loopClock=null;game.simulationDebt=0;
     if(out==='ended')game.grantShareRescue('player',serial,true);
     else elfNotice={...order,until:Date.now()+4000,text:out==='closed'?'广告未看完，复活机会保留':'广告暂不可用，复活机会保留'};
    }
    trackPause(false);game.wxUiDirty=true;runtime.wake?.();
   }
  };
  trackPause(true);
  if(!video.play(end))end('unavailable');
  game.wxUiDirty=true;runtime.wake?.();return true;
 }
 function notice(){return elfNotice?.body===game.player&&elfNotice.serial===game.playerDeathSerial&&elfNotice.until>Date.now()?elfNotice.text:'';}
 return {start,playing,notice,supported:video.supported,clear(){elfAd=elfNotice=null;},recheck(){
  if(elfAd&&(!playing()||!playerEligible(elfAd.serial))){video.cancel();elfAd=null;trackPause(false);}
 }};
};
