'use strict';
// 06: the approved shot order (original faces the mech → chest cast →
 // purple copy emerges → both attack). Nothing recorded is played.
const DT=1000/60;
module.exports=function create(outer,{world:g,mech:r,demon:d,scope,close,art,paintMech}){
 const copy=g?.ghostCopyBN;
 if(!outer||!g||g===outer||g.player===outer.player||d!==g.troll||d===outer.troll||!d.evolved||d.dragonEvolved||
   g.player?.drivingTank!==r||g.tanks===outer.tanks||g.projectiles===outer.projectiles||
   !copy||!art?.character||typeof scope!=='function'||typeof close!=='function'||typeof paintMech!=='function')return null;
 let age=0,started=false,spawned=null,castFrames=0,attacks=[false,false],minimum=[Infinity,Infinity],closed=false;
 const x=r.x,y=r.y,originHp=d.hp;
 function step(dt){
  if(closed||Math.abs(dt-DT)>.001)return;
  scope(()=>{
   age+=dt;
   // Original's idle portrait is side-facing the mech. Let the native taunt
   // use the original entity's native attack/facing path after formation.
   if(!started&&age>=1110){started=copy.begin(r);if(!started)throw Error('Native Copy tutorial could not cast');}
   if(!started)return;
   copy.tick(dt);
   const body=copy.active();
   if(body){
    if(spawned===null){spawned={time:age,x:body.x,y:body.y,hp:body.hp};d.attackCd=0;}
    d.animTrack(dt);
    copy.enemyTick(d,dt);
    attacks[0]||=d.actionKind==='attack'&&d.actionAnim>0;
    attacks[1]||=body.actionKind==='attack'&&body.actionAnim>0;
    minimum[0]=Math.min(minimum[0],d.hp);minimum[1]=Math.min(minimum[1],body.hp);
   }
  });
 }
 function draw(c,s){
  if(closed)return;
  scope(()=>{
   const scale=Math.min(s.w/334,s.h/278)*.95,cx=s.x+s.w*.205,cy=s.y+s.h*.73;
   c.save();try{
    c.beginPath();c.rect(s.x,s.y,s.w,s.h);c.clip();
    c.translate(cx,cy);c.scale(scale,scale);c.translate(-x,-y);
    // Actor/FX painter only. The native clone health bars belong to the
    // battle HUD, not the approved standalone tutorial stage.
    const f=c.fillRect;
    try{c.fillRect=function(a,b,w,h){if((h===5||h===7)&&['#312143','#ca88f2','#25352a','#75c35d'].includes(c.fillStyle))return;return f.call(c,a,b,w,h);};copy.draw(c,()=>true);}
    finally{c.fillRect=f;}
    if(!art.character(c,d,2,.74))throw Error('Original evolved Demon frames not ready');
    c.save();try{c.translate(x,y-22);c.scale(.84,.84);c.translate(-x,-y+22);if(copy.drawCaster(c,r))castFrames++;else paintMech(c,r);}finally{c.restore();}
   }finally{c.restore();}
   c.save();try{
    c.font='bold 15px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f0f0ef';
    c.fillText(age<1110?'原版恶魔正对机甲':age<1820?'从胸口复制恶魔':age<2600?'紫色分身在机甲前方出现':'原版与分身相互攻击',s.x+s.w/2,s.y+s.h*.155);
   }finally{c.restore();}
  });
 }
 const caption=()=>['恶魔在激光射程内时，分身在机甲前生成。','分身存在 60 秒，不继承减速；冷却 180 秒。'];
 return {length:5500,step,draw,caption,dispose(){if(closed)return;closed=true;try{scope(()=>copy.reset());}finally{close();}},
 report:()=>({age,started,spawned,attacks,minimum,originHp,castFrames})};
};
