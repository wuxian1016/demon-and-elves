'use strict';
const teleport=require('./teleport-native-painter');
const FRAME=1000/60;
module.exports=function create(k,{live,fixture,scope,advance,art,paintMech,paintDragon}){
 if(k!=='ghostRelocate'&&k!=='ghostFlame')return null; // Approved Copy gold needs its own exact source.
 const {world:g,mech:r,dragon:d,landing,to:{x,y}={},mobs=[]}=fixture||{},p=g?.player;
 const shared=['player','troll','tanks','hounds','allies','buildings','particles','projectiles','robotTech'].some(f=>live?.[f]&&live[f]===g?.[f]);
 if(!live||!g||g===live||shared||!r||!d||p?.drivingTank!==r||g.troll!==d||g.tanks?.includes(r)!==true||
    typeof scope!=='function'||typeof advance!=='function'||typeof paintMech!=='function')return null;
 const move=k==='ghostRelocate',fx=g.ghostRelocateBN,distant={x:d.x,y:d.y};
 if(move&&(!fx||!Number.isFinite(x)||!Number.isFinite(y)||typeof paintDragon!=='function')||
    !move&&(!art?.character||mobs.length!==3||mobs.some(m=>!g.hounds.includes(m)||!m.waveHound||m.waveBat||m.waveStone||m.waveGriffinBN||m.waveRangedTrollBN||m.waveMammothBN)))return null;
 let age=0,began=false,queued=false,impact,actualSlow,t=0,closed=false;
 function step(dt){
  if(closed||!Number.isFinite(dt)||dt<=0||dt>FRAME+.001)return;
  scope(()=>{
   age+=dt;
   if(!began&&age>=962){
    began=true;
    if(move){if(!fx.begin(r)||!fx.tapWorld(x,y))throw Error('Native relocate did not select legal stage point');}
    else{
     const hp=mobs.map(m=>m.hp),status=r.tryFlame(g);
     if(typeof status==='string')throw Error(status);
     impact=mobs.map((m,i)=>({delta:hp[i]-m.hp,stun:m.slimeFlameStun407||0}));
    }
   }
   if(move&&began&&!queued&&fx.placement()?.valid){queued=true;fx.tapButton('placeConfirm');}
   advance(dt);t++;
   if(move&&fx.state(r).slowMs>0&&!impact)impact={x:d.x,y:d.y,slow:fx.state(r).slowMs};
   if(!move&&impact&&mobs.every(m=>m.movementSlowMultiplier()===.9))actualSlow=true;
  });
 }
 function draw(c,s){
  if(closed)return;
  return scope(()=>{
   if(move)return teleport(c,s,{fx,mech:r,dragon:d,distant,landing:landing||{x,y},paintMech,paintDragon});
   const scale=Math.min(s.w/336,s.h/278),ax=s.x+s.w*.23-r.x*scale,ay=s.y+s.h*.69-r.y*scale;
   c.save();try{
    c.translate(ax,ay);c.scale(scale,scale);paintMech(c,r,0);r.drawFlame(c);
    for(const m of mobs)if(!m.dead)m.draw(c);
   }finally{c.restore();}
   if(impact)for(let i=0;i<mobs.length;i++){
    const m=mobs[i];if(m.dead||age>2600)continue;
    c.textAlign='center';c.fillStyle='#ffdb9c';c.font='bold 14px sans-serif';
    c.fillText('−'+Math.round(impact[i].delta),Math.min(s.x+s.w-24,Math.max(s.x+24,ax+m.x*scale)),ay+(m.y-24)*scale);
   }
  });
 }
 function caption(){
  if(move)return ['远处的恶魔被拉到落点。','落地后减速 80%，持续 10 秒。'];
  return ['机甲朝敌群释放扇形紫焰。',actualSlow?'群晕结束，史莱姆减速 10%（6 秒）。':impact?'3 只史莱姆受到伤害，并群晕 2.2 秒。':'命中史莱姆会造成伤害和控制。'];
 }
 return {length:5500,step,draw,caption,dispose(){closed=true;},report:()=>({age,t,impact,actualSlow})};
};
