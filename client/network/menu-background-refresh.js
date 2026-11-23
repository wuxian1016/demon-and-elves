'use strict';
// Rebuild only after an actual loading frame was shown and authority is ready.
// drawFrame398 draws the current authorized scene; it does not step gameplay,
// sample input or bypass the normal outer menu draw. Keep save-panel ownership.
function refreshMenuBackground(game){
 if(game.saveSlotsPanel||!(game.sessionMenuOpen||game.demonPanel||game.allyDataPanel)||typeof game.drawFrame398!=='function')return false;
 const keys=['sessionMenuOpen','demonPanel','allyDataPanel','audioSettingsOpen','pauseNeedsFreshScene'];
 const saved=keys.map(key=>[key,Object.hasOwn(game,key),game[key]]);
 game.releasePauseBackdrop627?.();
 try{
  game.sessionMenuOpen=false;game.demonPanel=game.allyDataPanel=null;game.audioSettingsOpen=false;game.pauseNeedsFreshScene=false;
  game.drawFrame398(true);
 }finally{
  for(const [key,own,value]of saved){if(own)game[key]=value;else delete game[key];}
 }
 // The next normal menu draw captures the fresh scene, not a loading screen
 // or the neutral placeholder used by offline save/load transitions.
 game.pauseNeedsFreshScene=false;
 return true;
}
module.exports={refreshMenuBackground};
