'use strict';
// Geometry/text states only; input rectangles and action authority stay native.
module.exports=function motion(clock=Date.now){
 let fx=null;const frames=[.97,.985,1.015,1.04,1.055,1.05,1.035,1.015,1.003,.995,.997,1];
 const key=b=>[b.id,b.slot??'',b.value??'',b.x,b.y,b.w,b.h].join(':');
 return {start(b,enabled=true){fx=b?{key:key(b),at:clock(),phase:'down',enabled}:null;},cancel(){fx=null;},release(ok){if(ok&&fx){fx.phase='release';fx.at=clock();}else fx=null;},pose(b){let s=1;if(fx&&key(b)===fx.key){if(fx.phase==='down')s=fx.enabled?.97:.98;else{const i=Math.max(0,Math.floor((clock()-fx.at)/25));if(i>=frames.length)fx=null;else s=fx.enabled?frames[i]:Math.min(1,Math.max(.98,frames[i]));}}return {...b,x:b.x+b.w*(1-s)/2,y:b.y+b.h*(1-s)/2,w:b.w*s,h:b.h*s,motionScale:s};},debug:()=>fx&&({...fx})};
};
