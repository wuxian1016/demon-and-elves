'use strict';
const make=require('./guide-mech-native'),copyStage=require('./guide-copy-native');
module.exports=function build(key,sh,{window:w,makeCanvas,now,installCopy,installRelocate}){
 const {world:g,types:T,scope,close,live}=sh,p=g.player,d=g.troll;
 const move=key==='ghostRelocate',copy=key==='ghostCopy',mobs=[];
 let r,fx;
 scope(()=>{
  r=new T.Robot(4650,3930,null);g.tanks.push(r);
  Object.assign(r,{ghostMechBN:true,driver:p,attackCd:1e8,miniRobotCd:1e8,facing:1,lastAttackFacingXBN:1,lastAttackFacingYBN:0,sideways:copy});
  Object.assign(p,{ghostElf:true,drivingTank:r,x:r.x,y:r.y});
  Object.assign(g.robotTech,{laser:copy?20:10,minion:copy?20:0});
  g.tankTech.armor=7;g.ghostRobotAimUIBN=()=>true;g.factoryModelsBN={unlocked:()=>true};
  d.evolve();if(move)d.evolveDragon(1560);
  Object.assign(d,{x:copy?r.x+186:9450,y:copy?r.y-8:7100,state:'patrol',hp:d.maxHp,facing:copy?-1:1,facingV:1,sideways:true,attackCd:1e8});
  if(copy){installCopy(g,live);g.ghostCopyBN.warm();}
  else if(move){g.cardVisuals={drawBolt:(...a)=>live.cardVisuals?.drawBolt?.(...a)};fx=g.ghostRelocateBN=installRelocate(g);}
  else for(const [x,y] of [[126,-54],[163,9],[115,54]]){
   const h=new T.Hound(r.x+x,r.y+y,8,false);
   Object.assign(h,{waveHound:true,soloSlime:true,waveNumber:44,waveDamage:35,waveVehicleHunter:true,slimeHop:167,slimeLoadFixed571:true,slimeBalanceVersion545:581,maxHp:8000,hp:8000,facing:-1,sideways:true});
   mobs.push(h);g.hounds.push(h);
  }
 });
 const art=w.woodlandArt;
 const paintMech=(c,v,pose)=>{if(pose&&fx?.drawCaster(c,v,pose))return;return w.ghostDirectionalBN?.drawMech(c,v,110)||live.factoryModelsBN.drawGhostBody(c,v.x,v.y+18,110);};
 const paintDragon=(c,v)=>art.character(c,v,2,.57);
 if(copy)return copyStage(live,{world:g,mech:r,demon:d,scope,close,art,paintMech});
 const to={x:4535.6,y:4097.92};
 const advance=dt=>{
  g.supportTime+=dt;
  if(move){fx.tick(dt);d.animTrack(dt);return;}
  r.animTrack(dt);r.flameTimer=Math.max(0,(r.flameTimer||0)-dt);
  for(const h of mobs){if(g.supportTime>=1000||r.flameTimer>0)h.update(dt,[p],[],d,[r]);h.animTrack(dt);}
 };
 const scene=make(key,{live,fixture:{world:g,mech:r,dragon:d,to,mobs},scope,advance,art,paintMech,paintDragon});
 if(!scene){close();return null;}
 const dispose=scene.dispose;scene.dispose=()=>{try{dispose();}finally{close();}};
 return scene;
};
