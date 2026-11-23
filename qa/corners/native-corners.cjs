'use strict';
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const [root0,kind,orientation,out]=process.argv.slice(2),root=path.resolve(root0),work=fs.mkdtempSync(path.join(__dirname,'wx-'));
fs.writeFileSync(path.join(work,'keys.json'),'{}');
const wide=orientation==='landscape',width=wide?844:390,height=wide?390:844;
const n=require('@napi-rs/canvas');
if(process.env.GAME_CJK_FONT) n.GlobalFonts.registerFromPath(process.env.GAME_CJK_FONT,'sans-serif');
const orig=Object.getOwnPropertyDescriptor(n.Image.prototype,'src');
const graphics={canvas(w,h){const c=n.createCanvas(w,h);c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;},
 image(locate){const i=new n.Image();let name;Object.defineProperty(i,'src',{get(){return name;},set(s){name=s;if(!s)return;try{orig.set.call(i,fs.readFileSync(locate(s)));}catch(e){queueMicrotask(()=>i.onerror?.(e));}}});return i;}};
const host=makeHost(root,work,false,{width,height,seed:150,clockStart:1800000000000,graphics});
function tap(b){const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:1,x,y,clientX:x,clientY:y};host.emit('TouchStart',{changedTouches:[p],touches:[p]});host.emit('TouchEnd',{changedTouches:[p],touches:[]});}
(async()=>{
 host.start();
 await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','ungated Home',25000);
 const {window,runtime}=host.env(),g=window.game,h=window.originalNetwork627,types=h.types;
 g.draw();await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'actual home',12000);
 tap(g.getStartActionButtons().find(x=>x.id==='startGame'));
 await until(()=>!g.roundStarting&&g.state==='prep','native first solo',30000);
 assert(window.cardArtCandidate.ready);assert(g.robotGuideBN&&g.cardPresentation);
 g.state='hunt';g.tutorial=null;g.endlessOpeningIntro=null;g.sessionMenuOpen=false;g.troll.evolved=true;g.troll.dead=true;g.player.dead=false;
 g.player.ghostElf=true;g.player.gold=1e6;g.player.wood=1e6;g.tankTech.armor=20;g.tankTech.damage=20;
 const place=(type,x,y)=>new types.Building(x,y,type);
 const lab=place('robotLab',g.player.x+10,g.player.y+10),other=place('robotFactory',g.player.x,g.player.y);
 for(const x of [lab,other]){x.ownerSlot=null;g.buildings.push(x);}g.ownerBuildingIndex=null;
 const r=new types.Robot(g.player.x,g.player.y,null);r.driver=g.player;r.ghostMechBN=true;g.tanks.push(r);g.player.drivingTank=r;
 g.robotGuideApprovedSeenBN=8;g.robotTech.laser=9;g.selectedBuilding=lab;
 const rect=g.getUpgradePanelLayout().robotLaserBtn,beforeGold=g.player.gold,price=g.robotTechCost('laser');
 assert(rect&&g.robotTechBlockReason('laser',lab)==='');
 const iconCalls=[],old=g.factoryModelsBN.drawIcon;
 let iris=0,skillCanvasReads=0;
 g.factoryModelsBN.drawIcon=function(c,id,variant,x,y,d){if(id==='robotFlame'){
   if(d>50||d===36)iconCalls.push({id,variant,x,y,d});}
  return old.call(this,c,id,variant,x,y,d);};
 const dc=g.ctx,im=dc.drawImage;dc.drawImage=function(src,...args){if(src===g.canvas||src===g.ctx.canvas)skillCanvasReads++;return im.call(this,src,...args);};
 const scrim=[],texts=[],fill=dc.fillRect,txt=dc.fillText;
 dc.fillRect=function(...a){if(this.fillStyle==='#161616')scrim.push(a);return fill.apply(this,a);};
 dc.fillText=function(s,...a){texts.push(s);return txt.call(this,s,...a);};
 g.draw();tap(rect);
 assert.equal(g.robotTech.laser,10);assert.equal(beforeGold-g.player.gold,price);
 const report=()=>g.robotGuideBN.report().approved;
 assert(report().queued.includes('ghostFlame'));
 await until(()=>{g.draw();return report().active==='ghostFlame';},'guide actually starts',10000);
 assert(g.selectedBuilding===lab);assert.equal(report().phase,'unlock');
 for(const k of ['x','y','w','h'])assert.equal(report().origin[k],rect[k]);
 assert.equal(report().completed,'激光升至 10 级');
 const u=g.update,c=g.updateCamera;let steps=0,cam=0;
 g.update=function(...args){steps++;return u.apply(this,args);};
 g.updateCamera=function(...args){cam++;return c.apply(this,args);};
 r.flameCd=1234;
 const world=()=>JSON.stringify([g.supportTime,g.huntElapsed,g.waveElapsed,g.waveNumber,g.player.x,g.player.y,g.troll.x,g.troll.y,r.flameCd]);
 const paused=world();
 host.advance(70);host.frame();
 assert.equal(steps,0,'outer update wrappers unreachable');assert.equal(cam,0,'camera does not tick');
 if(kind==='foreground'){
   const savedAge=report().age;host.emit('Hide',{});host.advance(20_000);host.emit('Show',{});
   g.draw();assert(g.sessionMenuOpen);assert(!report().active,'native foreground menu retires unfinished guide');
   assert(!(g.robotGuideApprovedSeenBN&32),'interrupted guide remains unviewed');
   assert.equal(world(),paused,'hidden time is not replayed');
   g.sessionMenuOpen=false;host.advance(17);host.frame();host.advance(17);host.frame();
   assert(steps>=1&&r.flameCd<1234&&r.flameCd>1195);
   fs.writeFileSync(out,JSON.stringify({foreground:true,pausedMs:20_000,savedAge,steps,cd:r.flameCd}));return;
 }
 const initial={...report(),selected:g.selectedBuilding===lab,cooldown:r.flameCd||0};
 const {layout}=host.evaluate(path.join(root,'art163/ghost/approved-guide-flow.js'));
 const step=(ms=70)=>{const pre=scrim.length;host.advance(ms);host.frame();g.draw();if(report().active){assert(scrim.length>pre); const v=runtime.viewport();assert.deepEqual(scrim.at(-1),[0,0,v.width,v.fullHeight||v.height]);} assert.equal(world(),paused);return report();};
 if(kind==='skip'){
   tap(layout(runtime.viewport()).skip);assert.equal(report().phase,'close');
   assert.equal(g.selectedBuilding,null);
 }else {
   if(kind==='unrelated')g.selectedBuilding=other;
   for(let j=0;j<40&&report().phase==='unlock';j++)step();
   assert.equal(report().phase,'scene');
   for(let i=0;i<21;i++)step();
   fs.writeFileSync(out+'.png',g.canvas.toBuffer('image/png'));
   assert.equal(g.selectedBuilding,kind==='unrelated'?other:null);
   assert((iconCalls.filter(a=>a.d===36)).length>0,'official archive painter rendered header on demo');
   assert(report().age>=2520&&report().age<=2660);
   assert(texts.includes('恭喜技能解锁'));assert(texts.includes('激光升至 10 级'));
   if(kind==='natural'){for(let j=0;j<90&&report().phase==='scene';j++)step();assert.equal(report().phase,'close');assert(texts.some(s=>s.startsWith('3 只史莱姆受到伤害')));assert(texts.some(s=>s.includes('史莱姆减速 10%')));}
   else tap(layout(runtime.viewport()).skip);
   assert.equal(g.selectedBuilding,kind==='unrelated'?other:null);
 }
 assert(iconCalls.some(a=>a.d>50&&a.variant));
 for(let j=0;j<12&&report().active;j++)step();
 assert(!report().active);assert(g.robotGuideApprovedSeenBN&32);
 assert.equal(r.flameCd||0,initial.cooldown);assert.equal(g.player.gold,beforeGold-price);
 assert.equal(g.selectedBuilding,kind==='unrelated'?other:null);
 assert.equal(world(),paused);
 host.advance(17);host.frame();assert(steps>=1);assert(cam>=1);assert(r.flameCd<1234&&r.flameCd>1195,'no cooldown replay');
 const outcome={kind,orientation,iconCalls,skillCanvasReads,initial,end:report(),panelClosed:g.selectedBuilding===null,charge:price,scrimFrames:scrim.length,cd:r.flameCd||0,steps,cameraUpdates:cam};
 fs.writeFileSync(out,JSON.stringify(outcome,null,2));
 console.log(JSON.stringify({...outcome,iconCalls:iconCalls.slice(-5)}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{host.close();fs.rmSync(work,{recursive:true,force:true})});
