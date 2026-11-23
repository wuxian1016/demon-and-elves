'use strict';
const {create}=require('./robot-skill-guide');
const {create:createScenes}=require('./robot-guide-scenes');
module.exports=function(g,{offline,viewport,hidden,resetInput,wake,art,now,drawSiege,relocate,copy,ghostRobot,dragon,approvedStageFor=()=>null}){
 const scenes=createScenes({art,teleport:relocate,clone:copy,ghostRobot,dragon,drawSiege});
 const guide=create(g,{offline,viewport,hidden,resetInput,wake,ready:scenes.ready,render:scenes.paint,now});
 const native=g.onButtonClick, update=g.update, draw=g.draw, hud=g.drawHUD;
 const aimCopy={text:'点战场空地放置分身',time:1};
 if(hud)g.drawHUD=function(...a){
  const old=this.toast,copy=this.ghostCopyBN?.pending()&&!guide.playing()&&!(old?.time>0)&&this.ghostRobotAimUIBN?.()!==false;
  if(copy)this.toast=aimCopy;
  try{return hud.apply(this,a);}finally{
   if(copy)this.toast=old;
   if(!guide.playing())this.ghostRelocateBN?.drawFeedback?.(this.ctx);
  }
 };
 const specs={
  robotSiege:r=>!r.ghostMechBN&&g.robotTech?.laser>=10&&!(r.siegeCd>0),
  robotFlame:r=>r.flameUnlocked(g)&&!(r.flameCd>0),
  robotSuper:r=>!r.ghostMechBN&&r.superUnlocked(g)&&!r.superActive()&&!(r.superCd>0),
  ghostCopy:r=>r.ghostMechBN===true&&g.ghostRobotSkillBN('ghostCopy',r)&&g.ghostCopyBN?.canBegin(r)===true
 };
 g.onButtonClick=function(id,...rest){
  if(guide.playing())return;
  const aim=id==='ghostRelocate'?g.ghostRelocateBN:id==='ghostCopy'?g.ghostCopyBN:null;
  if(aim?.pending?.())return native.call(this,id,...rest);
  if(Object.hasOwn(specs,id)&&!approvedStageFor(id==='robotFlame'&&g.player?.drivingTank?.ghostMechBN?'ghostFlame':id,g)){
   const resume=id==='ghostCopy'?r=>{
    g.ghostRelocateBN?.cancel();g.ghostCopyBN?.cancel();
    g.ghostCopyBN?.begin(r);
   }:undefined;
   if(guide.begin(id,g.player?.drivingTank,{eligible:specs[id],resume})){
    g.ghostRelocateBN?.cancel();g.ghostCopyBN?.cancel();
    if(g.player?.drivingTank?.ghostMechBN){g.factoryModelsBN?.warm?.();if(id==='ghostCopy')g.ghostCopyBN?.warm?.();}
    return;
   }
  }
  return native.call(this,id,...rest);
 };
 g.update=function(...a){if(!guide.combatPaused())return update.apply(this,a);};
 g.draw=function(...a){const pol=draw.apply(this,a);if(guide.playing())guide.render(this.ctx);return pol;};
 g.robotGuideBN=guide;
 return guide;
};
