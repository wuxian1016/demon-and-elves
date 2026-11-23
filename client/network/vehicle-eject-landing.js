'use strict';
const WRECK_SHIELD_MS=5000;
const offsets=[0,Math.PI/6,-Math.PI/6,Math.PI/3,-Math.PI/3,Math.PI/2,-Math.PI/2,Math.PI*2/3,-Math.PI*2/3,Math.PI*5/6,-Math.PI*5/6,Math.PI];
function find(g,tank,elf,dx,dy,{width,height,ejectGap}){
 const radius=elf.radius||10,pad=radius+4,gap=(tank.radius||30)+radius+ejectGap,origin={x:tank.x,y:tank.y};
 const foot=(x,y)=>x>=pad&&x<=width-pad&&y>=pad&&y<=height-pad&&!g.isTerrainBlocked?.(x,y,pad);
 const structures=[];
 function add(list){for(const o of list||[]){if(!o||o===tank||o===elf||o.dead||o.hp===0)continue;
  const r=Math.max(o.type==='wall'?46:0,o.radius||14);
  if((o.x-tank.x)**2+(o.y-tank.y)**2<=(gap+180+r)**2)structures.push({x:o.x,y:o.y,r});}}
 add(g.buildings);add(g.tanks);add(g.trees);add(g.goldMines);add([g.trollBase,g.player]);add(g.allies);add(g.peasants);
 const isClear=(x,y)=>foot(x,y)&&!structures.some(o=>(o.x-x)**2+(o.y-y)**2<(o.r+pad)**2);
 function corridor(x,y){
  const n=Math.max(1,Math.ceil(Math.hypot(x-origin.x,y-origin.y)/12));let exited=isClear(origin.x,origin.y);
  for(let i=1;i<=n;i++){const clear=isClear(origin.x+(x-origin.x)*i/n,origin.y+(y-origin.y)*i/n);if(!clear&&exited)return false;if(clear)exited=true;}
  return exited;
 }
 function canContinue(x,y){const step=Math.max(13,radius*.7);return isClear(x+step,y)||isClear(x-step,y)||isClear(x,y+step)||isClear(x,y-step);}
 const heading=Math.atan2(dy,dx);
 if(isClear(origin.x,origin.y)&&canContinue(origin.x,origin.y))return{x:origin.x,y:origin.y};
 let emergency=null;
 for(const r of [12,24,36,48,64,80,gap,gap+36,gap+80,gap+130].sort((a,b)=>a-b)){
  for(const d of offsets){
   const a=heading+d,nx=Math.cos(a),ny=Math.sin(a),x=origin.x+nx*r,y=origin.y+ny*r;
   if(!isClear(x,y)||!canContinue(x,y))continue;
   const point={x,y,dx:nx,dy:ny};if(corridor(x,y))return point;if(!emergency)emergency=point;
  }
 }
 // A destroyed vehicle can already be intersecting terrain. Only in that
 // case, and with no route/center usable, rescue to a tested nearby spot.
 return isClear(origin.x,origin.y)?null:emergency;
}
function hasLiveVehicleDriver(elf){const v=elf.drivingTank;return !!v&&!v.dead&&v.hp>0&&v.driver===elf;}
function protectedFromDamage(elf){return elf.vehicleWreckShieldMsBN>0;}
function stepShield(elf,dt){if(protectedFromDamage(elf))elf.vehicleWreckShieldMsBN=Math.max(0,elf.vehicleWreckShieldMsBN-dt);}
function drawShield(ctx,elf){
 if(!protectedFromDamage(elf))return;
 const r=(elf.radius||16)+11,y=elf.y-3;
 ctx.save();
 ctx.beginPath();ctx.ellipse(elf.x,y,r,r*1.17,0,0,Math.PI*2);
 ctx.fillStyle='rgba(89,204,255,.14)';ctx.fill();ctx.strokeStyle='#a8edff';ctx.lineWidth=2;ctx.stroke();
 ctx.restore();
}
module.exports={find,WRECK_SHIELD_MS,stepShield,hasLiveVehicleDriver,protectedFromDamage,drawShield};
