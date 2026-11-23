'use strict';
const landing=require('./vehicle-eject-landing');
function install(g,{offline=()=>false,Tank}={}){
 if(g.phaseOneTankDropBN||!Tank)return;
 const active=()=>offline()===true&&!g.networkDrawCamera627&&!g.tutorial&&!g.superChallenge580&&['prep','hunt'].includes(g.state);
 const drops=()=>Array.isArray(g.phaseOneTankDropsBN)?g.phaseOneTankDropsBN:null;
 function validate(list){
  if(list!==undefined&&(!Array.isArray(list)||list.some(d=>!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))))throw Error('Invalid tank drop position');
 }
 function drop(t,source,roll){
  if(!active()||t!==g.troll||!t.dead||t.phaseOneTankRolledBN||t.evolved||t.dragonEvolved||!Number.isFinite(t.x)||!Number.isFinite(t.y))return false;
  const slot=g.elfRewardOwnerSlot(source),owner=slot===undefined?null:g.ownerWallet(slot);
  if(!owner||owner.defected)return false;
  t.phaseOneTankRolledBN=true;if(!(roll()<.1))return false;
  const row={x:t.x,y:t.y},list=drops()||(g.phaseOneTankDropsBN=[]);list.push(row);return true;
 }
 function tap(x,y,width,height){
  const list=drops();
  if(!list?.length||!active()||g.player.dead)return false;
  const r=Math.max(38,25/g.zoom()),i=list.findIndex(d=>g.fogStateAtWorld(d.x,d.y)>0&&Math.hypot(d.x-x,d.y-18-y)<r);
  if(i<0)return false;
  if(g.playerVehicleSlotUsed()){g.showToast('坦克宝箱仍在，载具名额空出后可拾取');return true;}
  if(!(width>0&&height>0))return true;
  const d=list[i],vehicle=new Tank(0,0,null),tech=g.ownerTechnology(null).tankTech;
  vehicle.setVisualLevel((tech.armor||0)+(tech.damage||0));
  // Reuse the native clearance search for the final tech-adjusted hull, not
  // just the visible crate. No mutation until the site is proven usable.
  const safe=landing.find(g,{x:d.x,y:d.y,radius:12},vehicle,g.player.x-d.x,g.player.y-d.y,
   {width,height,ejectGap:12});
  if(!safe){g.showToast('附近没有安全位置，坦克宝箱未消耗');return true;}
  vehicle.x=safe.x;vehicle.y=safe.y;g.tanks.push(vehicle);g.applyTankTech();list.splice(i,1);
  g.spawnParticles(safe.x,safe.y,'#9EF8C3',12);g.showToast('拾取坦克！靠近后可乘坐');return true;
 }
 function draw(c,inView){
  const list=drops();if(!list?.length||!active())return;
  for(const {x,y} of list){if(!inView(x,y,64)||g.fogStateAtWorld(x,y)===0)continue;
   c.save();try{
    c.translate(x,y);c.beginPath();c.ellipse(0,4,28,8,0,Math.PI*2);c.fillStyle='rgba(19,70,48,.36)';c.fill();
    c.fillStyle='#183f31';c.fillRect(-22,-31,44,26);c.strokeStyle='#95ffc5';c.lineWidth=2;c.strokeRect(-22,-31,44,26);
    c.fillStyle='#70e5a6';c.fillRect(-13,-17,27,6);c.fillRect(-9,-22,17,6);c.fillRect(-2,-25,10,5);c.fillRect(7,-25,11,2);
    c.textAlign='center';c.textBaseline='middle';c.font='bold 12px sans-serif';c.lineWidth=3;c.strokeStyle='#123524';c.fillStyle='#c8ffe0';
    c.strokeText('坦克宝箱',0,18);c.fillText('坦克宝箱',0,18);
   }finally{c.restore();}
  }
 }
 g.phaseOneTankDropBN={drop,tap,draw,validate};
}
module.exports={install};
