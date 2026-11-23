'use strict';
// Independent primitive redraw states. Existing hit rectangles are never changed.
module.exports=function install(g){
 if(g.homeOptionsBounceBN)return;
 const state=g.drawStartState459,screen=g.drawStartScreen;
 g.drawStartState459=function(b){
  if(this.bakingHome514)return;
  const p=this.buttonBounceBN?.pose(b,b.text)||b;
  return state.call(this,{...p,bounceScaleBN:p.w/b.w});
 };
 g.drawStartScreen=function(...args){
  const out=screen.apply(this,args);
  // Match native asset readiness: a loaded home cache alone is not proof the
  // home atlas is available. paintStartScreen sets this at its normal gate.
  if(this.homeOptionsReadyBN){
   for(const b of [...this.getTimeOptionButtons(),...this.getDifficultyOptionButtons(),this.getFogOptionButton(),...this.getAllySlotButtons()])this.drawStartState459(b);
  }
  return out;
 };
 g.homeStatic514=null;
 g.homeOptionsBounceBN=true;
};
