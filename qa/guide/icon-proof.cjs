'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const [root,o,out]=process.argv.slice(2),wide=o==='landscape',work=fs.mkdtempSync(path.join(__dirname,'wx-'));
fs.writeFileSync(path.join(work,'keys.json'),'{}');
const host=makeHost(root,work,false,{width:wide?844:390,height:wide?390:844,seed:150,clockStart:1800000000000});
function tap(b){assert(b&&b.w>0);const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:11,x,y,clientX:x,clientY:y};host.emit('TouchStart',{changedTouches:[p],touches:[p]});host.emit('TouchEnd',{changedTouches:[p],touches:[]});}
(async()=>{
 host.start();await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','Home',25000);
 const {window:w,runtime}=host.env(),g=w.game,T=w.originalNetwork627.types,ctx=g.ctx;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'actual home',12000);
 tap(g.getStartActionButtons().find(x=>x.id==='startGame'));
 await until(()=>!g.roundStarting&&g.state==='prep','native first solo',30000);
 g.state='hunt';g.tutorial=null;g.endlessOpeningIntro=null;g.sessionMenuOpen=false;g.troll.evolved=true;g.troll.dead=false;g.player.dead=false;
 g.player.gold=g.player.wood=1e6;g.tankTech.armor=g.tankTech.damage=20;
 const {layout,rows}=host.evaluate(path.join(root,'art163/ghost/approved-guide-flow.js'));
 const closeBox=layout(runtime.viewport()).skip, flow=g.robotGuideBN, report=()=>flow.report().approved;
 const plain=b=>[b.x,b.y,b.w,b.h]; const actor=g.player;
 const results=[], events=[], labels=[];
 const draw=ctx.drawImage,txt=ctx.fillText,origCache=g.cachedUi514;let probe='',guideCrop=0;
 const identity=(src,a)=>{if(src===w.skillAtlas512&&a.length===8)return ['stock skill atlas',...a.slice(0,4)].join(':');
   if(!src?.src||a.length<4)return '';const s=src.src;
   if(s.includes('ghost-models.webp.bin')&&a[2]===88&&a[3]===88)return ['factory ghost atlas',...a.slice(0,4)].join(':');
   if(s.includes('ghost-possess-icon.webp.bin'))return 'approved possess 128px';
   if(s.includes('bat-steal-approved-review.png'))return 'approved bat claw 72px';
   if(a.length===8&&a[0]===72&&a[1]===466&&a[2]===82&&a[3]===82)return 'approved stealth card interior (72,466,82,82)';
   return '';};
 ctx.drawImage=function(src,...a){if(src===g.canvas||src===ctx.canvas)guideCrop++;
  const id=identity(src,a);if(id)events.push({kind:probe||'direct',id,d:a.at(-2)});return draw.call(this,src,...a);};
 ctx.fillText=function(t,...a){labels.push(t);return txt.call(this,t,...a);};
 let filterDock=null;
 g.cachedUi514=function(key,ww,hh,build){
  if(filterDock&&key?.startsWith('skill544:fade:'+filterDock+':')){
    ctx.save();probe='real HUD';try{build(ctx);}finally{probe='';ctx.restore();}
  }
  return origCache.call(this,key,ww,hh,build);
 };
 const charge=(kind,level)=>{
  const old=g.robotTech[kind],before=actor.gold,cost=g.robotTechCost(kind);
  g.draw();const control=g.getUpgradePanelLayout()[kind==='laser'?'robotLaserBtn':'robotMinionBtn'];assert(control);
  tap(control);assert.equal(g.robotTech[kind],level);assert.equal(level,old+1);assert.equal(before-actor.gold,cost);return plain(control);
 };
 const ready=key=>until(()=>{g.draw();return report().active===key;},'skill '+key,5000).catch(e=>{console.log(JSON.stringify({report:report(),factory:g.factoryModelsBN?.artReady(),hand:!!w.ghostHandPoseBN,bolt:g.cardVisuals?.boltReady,ghostMech:r?.ghostMechBN,ghostRole:actor.ghostElf,dock:g.buttons.filter(x=>x.visible&&x.circular512).map(x=>x.id),access:host.access.slice(-12),shown:g.endlessOpeningIntro}));throw e;});
 const step=(delta=70)=>{host.advance(delta);g.draw();};
 async function inspect(key,origin,completed){
  await ready(key);let a=report();const [,title,id]=rows[key], bounds=arr=>Array.from(arr);
  assert.equal(a.phase,'unlock');if(origin)assert.deepEqual(plain(a.origin),origin);if(completed)assert.equal(a.completed,completed);
  const pos=g.buttons.find(b=>b.id===id&&b.visible);assert(pos);assert.equal(a.target.x,pos.x);assert.equal(a.target.y,pos.y);assert.equal(a.target.w,pos.diameter512);
  filterDock=id;events.length=labels.length=0;g.draw();filterDock=null;
  const nav=events.filter(a=>a.kind==='real HUD').at(-1);assert(nav, key+' missing HUD asset '+JSON.stringify(events));
  const verify=(description)=>assert(events.some(x=>x.kind==='direct'&&x.id===nav.id),key+' '+description+' '+JSON.stringify(events));
  verify('unlock asset identity');assert(labels.includes(title));assert(labels.includes('恭喜技能解锁'));
  events.length=labels.length=0;for(let j=0;j<19&&report().phase==='unlock';j++)step();
  assert.equal(report().phase,'scene');assert(labels.includes(title));verify('demo header asset identity');
  let duration=report().age;events.length=0;tap(closeBox);assert.equal(report().phase,'close');
  for(let j=0;j<7;j++)step();assert.equal(report().phase,'close');verify('return asset identity');
  // Leave enough to pass terminal pop and release, but not promote the next guide.
  for(let j=0;j<2;j++)step();
  results.push({key,title,asset:nav.id,origin:a.origin,source:a.completed,target:a.target,sceneAt:duration});
 }
 const lab=new T.Building(actor.x+10,actor.y+10,'robotLab');lab.ownerSlot=null;g.buildings.push(lab);
 const r=new T.Robot(actor.x,actor.y,null);r.driver=actor;g.tanks.push(r);actor.drivingTank=r;
 g.robotGuideSeenBN=63;delete g.robotGuideApprovedSeenBN;
 g.robotTech.laser=9;g.selectedBuilding=lab;
 let first=charge('laser',10);
 await inspect('robotSiege',first,'激光升至 10 级');await inspect('robotFlame',first,'激光升至 10 级');
 g.selectedBuilding=lab;g.robotTech.laser=20;g.robotTech.minion=19;
 first=charge('minion',20);await inspect('robotSuper',first,'小机器人升至 20 级');
 actor.ghostElf=true;r.ghostMechBN=true;g.selectedBuilding=lab;g.robotTech.laser=9;g.robotTech.minion=0;
 first=charge('laser',10);await until(()=>{g.draw();return !!report().active;},'paired Ghost first'); const firstGhost=report().active;await inspect(firstGhost,first,'激光升至 10 级');await inspect(firstGhost==='ghostRelocate'?'ghostFlame':'ghostRelocate',first,'激光升至 10 级');
 g.selectedBuilding=lab;g.robotTech.laser=19;g.robotTech.minion=20;
 first=charge('laser',20);await inspect('ghostCopy',first,'激光升至 20 级');
 g.robotGuideApprovedSeenBN&=~16;g.selectedBuilding=lab;g.robotTech.minion=19;
 first=charge('minion',20);await inspect('ghostCopy',first,'小机器人升至 20 级');
 actor.ghostElf=false;actor.drivingTank=null;r.driver=null;g.selectedBuilding=null;g.draw();
 assert(g.cardsCandidate.core.authority());assert(g.ghostElfAPI.canTransform());
 const a=g.troll;g.troll.dead=false;g.troll.hp=1;g.troll.maxHp=Math.max(1,g.troll.maxHp);
 a.takeDamage(1e6,actor);g.cardsCandidate.tick(16);g.draw();
 const ui=g.cardPresentation.ui;
 assert.equal(ui.state.award,'ghost','true demon kill earned ghost card');
 const rl=host.evaluate(path.join(root,'art163/ghost/ghost-card-reveal.js')).layout;
 const boxes=(award=false)=>{const v=runtime.viewport(),j=g.getJoystickRect(),hud=g.topHudLayout?.();
 return rl({w:v.width,h:v.height,x:j.x,top:j.y-j.r,safe:g.uiSafeRect396(),hudBottom:wide?Math.max(hud.bottom,hud.timer+11):hud.bottom},v.width/552,award);};
 tap(boxes(true).award);tap(boxes(true).award);step(610);step(310);
 assert.equal(ui.state.hand.at(-1),'ghost');const p=ui.state.poses.at(-1);
 tap({x:p.x-4,y:p.y-4,w:8,h:8});assert(ui.state.open);
 const confirm=boxes().ok;tap(confirm);assert(ui.state.confirm);tap(confirm);
 assert(actor.ghostElf,'actual ghost profession changed');
 await inspect('ghostStealth',plain(confirm));
 await inspect('ghostPossess',plain(confirm));
 g.hounds.length=g.miniTrolls.length=0;
 const b=new T.Hound(actor.x+5,actor.y,2,false);Object.assign(b,{waveBat:true,batGroundedBN:true});g.hounds.push(b);
 g.draw();tap(g.buttons.find(x=>x.id==='collectWood'&&x.visible));assert.equal(g.ghostElfAPI.host,b,'actual bat possessed');
 await inspect('batRaid',null);
 assert.equal(g.robotGuideApprovedSeenBN,511);assert.equal(guideCrop,0);assert.equal(new Set(results.map(x=>x.key)).size,9);
 g.ghostElfAPI.leave();g.hounds.splice(g.hounds.indexOf(b),1);const save=g.serializeProgress();
 assert(await g.loadProgressAsync(save));assert.equal(g.robotGuideApprovedSeenBN,511);assert.equal(g.ghostElfAPI.host,null);
 const summary={orientation:o,count:results.length,guideCrop,saveSeen:g.robotGuideApprovedSeenBN,results};
 fs.writeFileSync(out,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{host.close();fs.rmSync(work,{recursive:true,force:true});});
