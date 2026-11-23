'use strict';
const name={robotSiege:'siege',robotFlame:'flame',robotSuper:'fury'};
const FRAME=1000/60;
// Host must be a new, discardable solo game under a scope which resolves both
// engine world pointers. Never point this at the live client or share actors.
module.exports=function create(id,{world:host,live:liveWorld,types,scope,close},{now}){
 const key=name[id],g=host;
 if(!Object.hasOwn(name,id)||!g||!liveWorld||g===liveWorld||g.player===liveWorld.player||g.troll===liveWorld.troll||['projectiles','robotTech','tankTech','tanks','hounds','buildings','trollBase'].some(field=>g[field]&&g[field]===liveWorld[field])||!types?.Robot||!types.Hound||typeof scope!=='function'||typeof close!=='function'||typeof now!=='function')throw new Error('isolated normal skill world required');
 const p=g.player,d=g.troll,x=4650,y=3930;
 let r,targets=[],ticks=0,played=false,cast=null,charge,fireFrames=0,beamFrames=0,bolts=0,destroyed=false;
 const hits=[],phase={};
 scope(()=>{
  Object.assign(g,{state:'hunt',huntElapsed:600,supportTime:1140000,soloSlimeAssaultAt:99999,waveElapsed:0,sessionMenuOpen:false,ceremony:null,tutorial:null,endlessOpeningIntro:null,firstAttackCameraFocus:null,robotGuideSeenBN:8191});
  r=new types.Robot(x,y,null);g.tanks.push(r);
  Object.assign(r,{ghostMechBN:false,driver:p,attackCd:1e8,miniRobotCd:1e8,facing:1,lastAttackFacingXBN:1,lastAttackFacingYBN:0});
  Object.assign(p,{ghostElf:false,drivingTank:r,x,y,invincibleTime:1e8});
  g.tankTech.armor=7;Object.assign(g.robotTech,{laser:key==='fury'?20:10,minion:key==='fury'?20:0});g.applyTankTech();
  while(d.level<(key==='fury'?13:5))d.levelUp();if(key==='fury')d.evolve();
  Object.assign(d,{x:x+(key==='siege'?262:158),y:y+1,attackCd:1e8,hp:d.maxHp,state:'patrol',sideways:true,facing:-1,facingV:1});
  if(key==='siege')d.tutorialHome=r;
  if(key==='fury')r.attackCd=330;
  if(key==='flame')targets=[[215,-52],[245,63]].map(([a,b])=>{
   const h=new types.Hound(x+a,y+b,8,false);
   Object.assign(h,{waveHound:true,soloSlime:true,waveNumber:34,waveZoneIndex:g.playerStartZoneIndex||0,waveDamage:35,slimeHop:167,slimeEvolved:false,slimeLoadFixed571:true,maxHp:3400,hp:3400,slimeBalanceVersion545:581,sideways:true,facing:-1});
   const prev=h.update;h.update=function(...args){if(played)return prev.apply(this,args);};g.hounds.push(h);return h;
  });
  const rawHit=d.takeDamage;d.takeDamage=function(n,...args){const before=this.hp,res=rawHit.call(this,n,...args);if(before>this.hp)hits.push({tick:ticks,before,after:this.hp,raw:n});return res;};
 });
 function update(dt){
  g.supportTime+=dt;
  r.update(dt,p,d,targets,g.buildings,g.trollBase,null);
  if(key==='siege')d.update(dt,[p],g.buildings,targets,g.tanks,g.trollBase,g.clues);
  if(key==='flame')for(const h of targets)h.update(dt,[p],g.buildings,d,g.tanks);
  for(const unit of [r,d,...targets])unit.animTrack(dt);
  for(let j=g.projectiles.length-1;j>=0;j--){const shot=g.projectiles[j];shot.update(dt);if(shot.dead)g.projectiles.splice(j,1);}
 }
 function trigger(){
  if(key==='fury')phase.normal={raw:r.getDamage(),attackCd:r.getAttackCd()};
  const value=r[key==='siege'?'trySiege':key==='flame'?'tryFlame':'trySuper'](g);
  if(typeof value==='string')throw new Error(value);
  played=true;cast={tick:ticks,hp:d.hp,targets:targets.map(h=>h.hp)};
  if(key==='fury')phase.boost={raw:r.getDamage(),attackCd:r.getAttackCd()};
  if(key==='flame')phase.stuns=targets.map(h=>h.slimeFlameStun407||0);
  if(key==='siege')charge=g.projectiles.find(q=>q instanceof types.RobotSiegeLaser&&q.target===d)?.charge;
 }
 function seek(age){
  if(destroyed)return;
  const tick=Math.min(335,Math.max(0,Math.floor(age/FRAME)));
  return scope(()=>{while(ticks<tick){
   if(!played&&ticks>=58)trigger();
   update(FRAME);
   ticks++;
   if(r.flameTimer>0)fireFrames++;
   for(const q of g.projectiles){if(q instanceof types.RobotSiegeLaser&&q.fired)beamFrames++;else if(q instanceof types.RobotLaser)bolts++;}
  }});
 }
 function paint(c,rect){
  if(destroyed)return;
  const {x,y,w,h}=rect,s=Math.min(w/336,h/278)*.77;
  return scope(()=>{
   const text=c.fillText,stroke=c.strokeText,fill=c.fillRect,draw=c.drawImage;
   c.save();
   try{
    c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x+w*78/336,y+h*.66);c.scale(s,s);c.translate(-r.x,-r.y);
    c.fillText=function(t,...q){if(key==='siege'&&String(t).includes('眩晕'))return text.call(this,t,...q);};c.strokeText=()=>{};
    c.drawImage=function(img,...q){if(q.length===4&&q[3]<30&&q[2]<180){const mid=q[0]+q[2]/2;if((Math.abs(mid-r.x)<1&&q[1]>r.y-120&&q[1]<r.y-60)||(Math.abs(mid-d.x)<1&&q[2]<52))return;}return draw.call(this,img,...q);};
    c.fillRect=function(ix,iy,iw,ih){if((c.fillStyle==='rgba(20, 20, 20, 0.72)'&&(Math.abs(ix+iw/2-r.x)<2||(Math.abs(ix+iw/2-d.x)<2&&iw<52)))||((ih===6||ih===10)&&Math.abs(iy-(r.y-58))<=2&&Math.abs(ix-(r.x-54))<=2))return;return fill.call(this,ix,iy,iw,ih);};
    r.draw(c);if(!d.dead)d.draw(c,now());
    for(const h of targets)if(!h.dead)h.draw(c);
    if(key==='flame'&&played)for(const h of targets){if(h.dead||!(h.slimeFlameStun407>0))continue;c.fillStyle='#c4f4ff';c.font='bold 13px sans-serif';c.textAlign='center';text.call(c,'眩晕',h.x,h.y-57);}
    for(const q of g.projectiles)if(!q.dead)q.draw?.(c);
   }finally{c.fillText=text;c.strokeText=stroke;c.fillRect=fill;c.drawImage=draw;c.restore();}
  });
 }
 function caption(){
  if(key==='siege')return ['点重炮，优先锁射程内的恶魔。',d.robotStun>0?'命中！恶魔停止行动，大本营不眩晕。':'命中恶魔眩晕 1.8 秒，大本营不眩晕。'];
  if(key==='flame')return ['靠近敌群后点喷火。',!played?'朝敌人最多的方向喷射，史莱姆群晕。':targets.some(h=>h.slimeFlameStun407>0)?'群体受伤，史莱姆眩晕 2.2 秒。':'史莱姆已解除眩晕，单人仍减速 10%。'];
  return ['点狂暴模式，短时间强化战力。',played&&r.superActive()?'狂暴生效：普攻伤害 ×2，攻速 ×1.5。':'普攻伤害翻倍，攻击速度提高 50%。'];
 }
 let age=0;return {length:5500,step(dt){if(!(dt>0&&dt<=FRAME+.001))return;age+=dt;seek(age+.000001);},draw:paint,caption,dispose(){if(!destroyed){destroyed=true;close();}},report:()=>scope(()=>({key,ticks,cast,charge,hits:hits.slice(),phase,fireFrames,beamFrames,bolts,demonStun:d.robotStun||0,demonHP:d.hp,targets:targets.map(h=>[h.hp,h.slimeFlameStun407||0,h.movementSlowMultiplier()])}))};
};
