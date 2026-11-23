'use strict';
// Guard only local drawing of an already-open save panel. Explicit lifecycle
// release, authority commands and save/load eligibility retain their behavior.
function installSaveBackdropGuard(game){
 const frame=game.drawFrame398,release=game.releasePauseBackdrop627;
 if(typeof frame!=='function'||typeof release!=='function')return{dispose(){}};
 const ownFrame=Object.hasOwn(game,'drawFrame398'),ownRelease=Object.hasOwn(game,'releasePauseBackdrop627');let depth=0;
 const draw=function(...args){depth++;try{return frame.apply(this,args);}finally{depth--;}};
 const retire=function(...args){if(depth&&this.saveSlotsPanel)return;return release.apply(this,args);};
 game.drawFrame398=draw;game.releasePauseBackdrop627=retire;
 return{dispose(){if(game.drawFrame398===draw){if(ownFrame)game.drawFrame398=frame;else delete game.drawFrame398;}if(game.releasePauseBackdrop627===retire){if(ownRelease)game.releasePauseBackdrop627=release;else delete game.releasePauseBackdrop627;}}};
}
module.exports={installSaveBackdropGuard};
