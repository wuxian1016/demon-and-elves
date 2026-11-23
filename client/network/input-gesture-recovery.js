'use strict';
// Only local gesture state is reset here. No simulation or authority commands.
function createGestureRecovery({runtime,getInput}){
 return function resetGesture(reason){
  const i=getInput();if(!i)return false;
  const forced=reason==='cancel'||reason==='hide'||reason==='show'||reason==='controller-error';
  if(!forced&&!i.active&&!i.pinch?.active&&!i.volumeDrag514&&!i.roundLoading591&&!i.stick?.active&&!i.panning&&!i.minimapPeek)return false;
  try{runtime.cancelInput?.(reason);}
  finally{
   Object.assign(i,{active:false,dx:0,dy:0,panning:false,panCandidate396:false,panMoved396:false,spectatorDrag588:false,minimapPeek:false,savePanelTap:false,wxMenuTap:false,roundLoading591:false,volumeDrag514:false,buildMenuGesture:null,buildMenuScrollMoved:false,placementButtonGesture:null});
   if(i.pinch){i.pinch.active=false;i.pinch.id0=i.pinch.id1=null;}
   if(i.stick){i.stick.active=false;i.stick.dx=i.stick.dy=0;i.stick.originX=i.stick.originY=null;}
  }
  return true;
 };
}
module.exports={createGestureRecovery};
