'use strict';
// Reusable presentation plumbing. Does not cast, tick, set actor state, or draw live game/UI.
module.exports=function teleportStage(c,stage,{fx,mech,dragon,distant,landing,paintMech,paintDragon}){
 if(!fx?.drawWorld||!mech||!dragon||!distant||!landing||typeof paintMech!=='function'||typeof paintDragon!=='function')throw new Error('Verified native renderer and actor dependencies required');
 const {x,y,w,h}=stage;
 const s=Math.min(w/390,h/315);
 const zones=[
  {p:distant,x:x+.23*w,y:y+.47*h},
  {p:mech,x:x+.44*w,y:y+.80*h},
  {p:landing,x:x+.79*w,y:y+.67*h}
 ];
 const state=fx.state(mech);
 const inZone=(z,px,py)=>Math.hypot(z.p.x-px,z.p.y-py)<=68;
 const on=(z,fn)=>{c.save();try{
  c.translate(z.x,z.y);c.scale(s,s);c.translate(-z.p.x,-z.p.y);fn();
 }finally{c.restore();}};
 c.save();
 try{
  c.beginPath();c.rect(x,y,w,h);c.clip();
  // The approved card's existing independent stage supplies the backdrop.
  // Apply native world layers before actor bodies, matching the actual renderer order.
  for(const z of zones)on(z,()=>fx.drawWorld(c,(px,py)=>inZone(z,px,py)&&!zones.some(k=>k!==z&&Math.hypot(k.p.x-px,k.p.y-py)<Math.hypot(z.p.x-px,z.p.y-py))));
  const bodyZone=state.slowMs>0?zones[2]:zones[0];
  on(bodyZone,()=>paintDragon(c,dragon));
  on(zones[1],()=>paintMech(c,mech,fx.castPose(mech)));
 }finally{c.restore();}
};
