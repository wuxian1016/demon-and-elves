'use strict';
// Latch from the victim when the strike is triggered; walking must not replace
// the pose mid-swing. Northbound strikes use a profile, not a face-down pose.
function latchAttackFacing(e,target,sideRatio=.65){
 if(!target)return false;
 const dx=target.x-e.x,dy=target.y-e.y;if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<.001)return false;
 e.attackFacingV=dy<0?-1:1;
 e.attackSideways=dy<0||Math.abs(dx)>Math.abs(dy)*sideRatio;
 e.attackFacing=Math.abs(dx)>.4?(dx<0?-1:1):(e.attackFacing||e.facing||1);
 e.facing=e.attackFacing;return true;
}
function attackDirection(e,movementDirection){
 if(!(e.actionAnim>0))return movementDirection;
 const latched=e.actionKind!=='cast'&&typeof e.attackSideways==='boolean';
 const side=latched?(e.attackSideways||e.attackFacingV<0):e.sideways;
 const horizontal=latched&&Number.isFinite(e.attackFacing)?e.attackFacing:e.facing;
 if(side)return horizontal<0?1:2;
 return 0;
}
module.exports={attackDirection,latchAttackFacing};
