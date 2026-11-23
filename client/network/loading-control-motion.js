'use strict';
function create(battle,{clock=()=>battle.monotonic?.()??Date.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 const motion=require('./native-control-motion')(clock);let down=null,timer=null;
 const inside=(b,p)=>b&&p&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
 const key=()=>{const L=battle.layout();return [L.v.width,L.v.fullHeight||L.v.height,...L.buttons.flatMap(b=>[b.id,b.x,b.y,b.w,b.h])].join(':');};
 const reset=()=>{down=null;motion.cancel();if(timer!==null)cancel(timer);timer=null;};
 const pulse=()=>{if(timer!==null)cancel(timer);let left=20;const tick=()=>{timer=null;if(!battle.active||battle.client?.hidden||battle.ready?.()){reset();return;}battle.runtime.wake?.();if(--left>0&&motion.debug()?.phase==='release')timer=schedule(tick,16);};tick();};
 return {cancel:reset,pose(b){if(down&&down.layout!==key())reset();return motion.pose(b);},input(kind,e){const p=(kind==='end'?e.changedTouches:e.touches)?.[0],point=p?{x:p.clientX??p.x,y:p.clientY??p.y}:null;
 if(kind==='cancel'||e.touches?.length>1){reset();battle.runtime.wake?.();return;}
 if(kind==='start'){reset();const b=battle.layout().buttons.find(b=>inside(b,point));down=point?{point,layout:key()}:null;motion.start(b);battle.runtime.wake?.();}
 if(kind==='move'&&down&&point&&(Math.hypot(point.x-down.point.x,point.y-down.point.y)>8||down.layout!==key())){reset();battle.runtime.wake?.();}
 if(kind==='end'){const valid=!!(down&&point&&down.layout===key()&&battle.layout().buttons.some(b=>inside(b,point)));down=null;motion.release(valid);if(valid)pulse();else reset();}
 },debug:()=>motion.debug()};
}
module.exports=b=>b.loadingControlMotionBN||(b.loadingControlMotionBN=create(b));module.exports.create=create;
