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
 const at={x:4554,y:3906};Object.assign(g.player,at);
 const shift=(x,y)=>{g.camera.x=g.cameraFollow.x=x-182/g.zoom();g.camera.y=g.cameraFollow.y=y-469/g.zoom();};
 const types='house houseForPeasants goldMine warehouse exchange repairShop tankFactory tankLab robotFactory robotLab cannonTower wall tower iceTower manaTower watchtower altar antiAir net'.split(' ');
 const docs={fortress:'all buildings',harvest:'mines and own gatherers',fury:'4 combat towers + anti-air + net speed'};
 g.buildings.length=0;g.peasants.length=0;
 function b(x,y,type,slot=null){const air=type==='antiAir'||type==='net';const o=new T.Building(x,y,air?'tower':type,3);if(air)w.batAirDefenseBN.apply(o,type,3);o.ownerSlot=slot;g.buildings.push(o);return o;}
 const x1=at.x,y1=at.y,x2=at.x+3600,y2=at.y;shift(x1,y1);
 const all=types.map((type,i)=>b(x1-250+(i%5)*125,y1-300+Math.floor(i/5)*160,type));
 const ally=b(x1+15,y1+330,'goldMine',2),pending=b(x1-50,y1+320,'goldMine');
 pending.underConstruction=true;pending.buildTime=1000;pending.buildProgress=750;
 const secondHome=b(x2,y2-190,'house'),secondMine=b(x2+22,y2,'goldMine');
 const worker1=new T.Peasant(x1+20,y1,all[0]),worker2=new T.Peasant(x2-30,y2,secondHome);
 for(const worker of [worker1,worker2]){worker.carryWood=4;worker.task={type:'wood',phase:'collect',target:null};g.peasants.push(worker);}
 g.player.task={type:'gold',phase:'collect',target:null};g.player.relicBladeLevel=1;
 const api=g.cardsCandidate,fx=g.cardVisuals,C=g.ctx;
 const oldHp=all.map(e=>e.maxHp);
 const gold=secondMine.goldInterval;
 function use(type){const award=api.award({owner:'local',serial:api.core.state.lastAward+1,type});a(award.ok);a(api.use({owner:'local',cardId:award.card.id,sequence:api.core.state.lastCommand+1,confirmed:true}).ok);}
 use('fortress');use('harvest');use('fury');g.cardPresentation.restore();
 for(let i=0;i<types.length;i++){a.equal(all[i].maxHp,2*oldHp[i],types[i]);a.equal(api.mods(all[i]).armor,2);}
 a.equal(api.mods(ally).harvest,1);a.equal(api.mods(ally).maxHp,1);a.equal(api.mods(secondMine).harvest,2);a.equal(api.mods(worker2).harvest,2);
 secondMine.goldTimer=0;secondMine.storedGold=0;secondMine.update(gold/2);a(secondMine.storedGold>0,'outpost actual production at half timer');
 const moves=[];
 function step(tag,dt=100){host.advance(dt);api.tick(dt);g.draw();const q=fx.stats();a(q.draws<=q.max);moves.push({tag,eligible:q.eligible,marked:q.marked,sparks:q.sparks,bases:q.bases,bodyTints:q.bodyTints,draws:q.draws,reduced:q.reduced});return q;}
 const home=step('home');
 shift(x2,y2);Object.assign(g.player,{x:x2,y:y2});const outpost=step('outpost');
 const newMine=b(x2+95,y2,'goldMine');newMine.underConstruction=true;newMine.buildTime=100;newMine.buildProgress=10;
 const under=step('outpost-under-build');
 newMine.buildProgress=newMine.buildTime;newMine.underConstruction=false;
 const built=step('outpost-after-build');
 if(mode==='new'){a.equal(home.marked,29);a.equal(outpost.marked,6);a.equal(under.marked,outpost.marked);a.equal(built.marked,8);}
 host.emit('MemoryWarning',{level:15});a(runtime.memoryConstrained());const low=step('outpost-memory-warning');
 if(mode==='new')a.equal(low.marked,built.marked);
 shift(x1,y1);Object.assign(g.player,at);const returned=step('return-home');
 if(mode==='new')a.equal(returned.marked,home.marked);
 for(let i=0;i<122;i++)api.tick(1000);
 a.equal(step('expired').draws,0);
 console.log('NATIVE '+JSON.stringify({mode,moves,docs,nativeHpTypes:types.length,scope:{allyBoost:1,ownNewMine:2}}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>host.close());
