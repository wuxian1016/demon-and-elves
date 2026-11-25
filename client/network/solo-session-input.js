'use strict';
// Keep the shared touch, exit and saved-game UI without creating a room client.
const {installCanvasInput}=require('./canvas-input');
const {createGestureRecovery}=require('./input-gesture-recovery');
const {installSaveBackdropGuard}=require('./save-backdrop-guard');
const {installSessionActions}=require('../session-actions');
module.exports=function installSoloInput(wx,env){
  const {runtime,window}=env,previous=runtime.attach;
  const resetGesture=createGestureRecovery({runtime,getInput:()=>window.originalNetwork627?.input});
  const gate=installCanvasInput(wx,{resetGesture,freezeTrace:runtime.freezeTrace});
  gate.priorityInput=(kind,event)=>{
    const boot=runtime.startupInput627;
    if(!boot?.active())return !!window.game?.cameraScenesR7?.touch(kind,event);
    try{boot.touch?.(kind,event);}catch(_){}
    if(kind==='end')boot.end(event);
    return true;
  };
  wx.onHide?.(()=>window.game?.cameraScenesR7?.touch('hide',{}));
  let backdrop,actions;
  runtime.attach=function(game){
    previous.call(this,game);
    backdrop?.dispose();actions?.dispose();
    actions=installSessionActions({game,runtime,wx});
    backdrop=installSaveBackdropGuard(game);
  };
};
