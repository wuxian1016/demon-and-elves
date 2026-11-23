'use strict';
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict');
const {makeHost,STARTUP,until}=require('./instrumented-host.cjs');const n=require('@napi-rs/canvas');
if(process.env.GAME_CJK_FONT) n.GlobalFonts.registerFromPath(process.env.GAME_CJK_FONT,'sans-serif');
const [root,out,mode]=process.argv.slice(2),work=fs.mkdtempSync(path.join(__dirname,'wx-fx-'));
fs.writeFileSync(path.join(work,'keys.json'),'{}');const orig=Object.getOwnPropertyDescriptor(n.Image.prototype,'src');
const graphics={canvas(w,h){const c=n.createCanvas(w,h);c.addEventListener=()=>{};c.removeEventListener=()=>{};return c;},
 image(locate){const i=new n.Image();let name;Object.defineProperty(i,'src',{configurable:true,get(){return name;},set(s){name=s;if(!s)return;try{orig.set.call(i,fs.readFileSync(locate(s)));}catch(e){queueMicrotask(()=>i.onerror?.(e));}}});return i;}};
const host=makeHost(root,work,false,{width:390,height:844,seed:150,clockStart:1800000000000,graphics});
let tid=2;
function tap(p){a(p);const x=p.x+p.w/2,y=p.y+p.h/2,f={identifier:++tid,clientX:x,clientY:y,x,y};host.emit('TouchStart',{changedTouches:[f],touches:[f]});host.emit('TouchEnd',{changedTouches:[f],touches:[]});}
(async()=>{host.start();await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','native Home',25e3);
 const {window:w,runtime}=host.env(),g=w.game,T=w.originalNetwork627.types;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'home render',12e3);
 tap(g.getStartActionButtons().find(x=>x.id==='startGame'));await until(()=>!g.roundStarting&&g.state==='prep','native Solo',30e3);
 g.state='hunt';g.tutorial=null;g.endlessOpeningIntro=null;g.ceremony=null;g.setFogEnabled(false);g.manualCamera394=true;
 const at={x:4554,y:3906};Object.assign(g.player,at);g.camera.x=g.cameraFollow.x=at.x-182/g.zoom();g.camera.y=g.cameraFollow.y=at.y-469/g.zoom();
 function b(dx,dy,type){const r=new T.Building(at.x+dx,at.y+dy,type,3);r.ownerSlot=null;g.buildings.push(r);return r;}
 const home=b(0,-150,'house');const mines=[],guns=[];
 for(let i=0;i<10;i++)mines.push(b(-210+(i%5)*100,-135+Math.floor(i/5)*84,'goldMine'));
 for(let i=0;i<5;i++)guns.push(b(-200+i*100,120,i<4?'tower':'wall'));
 for(let i=0;i<14;i++)g.peasants.push(new T.Peasant(at.x-220+(i%7)*65,at.y+16+Math.floor(i/7)*38,home));
 const api=g.cardsCandidate,fx=g.cardVisuals,C=g.ctx;
 for(const type of ['fortress','harvest']){
  const award=api.award({owner:'local',serial:api.core.state.lastAward+1,type});a(award.ok);
  a(api.use({owner:'local',cardId:award.card.id,sequence:api.core.state.lastCommand+1,confirmed:true}).ok);
 }
 g.cardPresentation.restore();
 a.equal(api.mods(mines[0]).harvest,2);a.equal(api.mods(guns[0]).armor,2);
 const hooks={},uses=[];
 for(const key of ['draw','drawBases','drawWorkerBases','drawActorFx'])if(typeof fx[key]==='function'){
  const fn=fx[key];fx[key]=function(...args){hooks.pass=key;try{return fn.apply(this,args);}finally{hooks.pass=null;}};
 }
 const bi=C.drawImage.bind(C);C.drawImage=function(img,...xy){
  if(hooks.pass&&img?.width===32&&img?.height===32)uses.push([hooks.pass,xy[2],this.globalAlpha]);
  return bi(img,...xy);
 };
 const marks=[];
 function frame(tag,dt){
  host.advance(dt);api.tick(dt);uses.length=0;g.draw();
  const stats=fx.stats(),stars=uses.filter(x=>x[1]===19||x[1]===15),worker=stars.filter(x=>x[0]==='drawActorFx'),field=stars.filter(x=>x[0]==='draw');
  a(stats.draws<=stats.max);a(!mode.includes('new')||stars.length>0&&worker.length>0&&field.length>0&&stats.cachedTextures<=4);
  marks.push({tag,stats,nativeBlits:uses.length,stars:stars.length,worker:worker.length,world:field.length});
  if(tag==='normal'||tag==='reduced')fs.writeFileSync(out+'-'+tag+'.png',C.canvas.toBuffer('image/png'));
 }
 frame('normal',351);
 frame('warm',250);
 a.equal(marks[0].stats.cachedTextures,marks[1].stats.cachedTextures);
 host.emit('MemoryWarning',{level:15});
 a(runtime.memoryConstrained(),'actual memory warning callback');
 frame('reduced',142);a(marks[2].stats.reduced&&marks[2].stats.max===48);
 // No fallback texture allocation if the card expires; no particle/tint after actual timer.
 for(let i=0;i<130;i++)api.tick(1000);
 uses.length=0;g.draw();const ended=fx.stats();a.equal(ended.draws,0);
 if(mode==='old'){a.equal(typeof fx.drawActorFx,'undefined');a.equal(typeof fx.drawWorkerBases,'undefined');}
 console.log('FX '+JSON.stringify({mode,marks,ended}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>host.close());
