'use strict';
const fs=require('node:fs'),p=require('node:path'),A=require('node:assert/strict'),{makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const {imageSize}=require('image-size');
const [root,mode='warm']=process.argv.slice(2), dir=fs.mkdtempSync(p.join(__dirname,'fixture-')); fs.writeFileSync(p.join(dir,'keys.json'),'{}');
const h=makeHost(root,dir,false,{width:390,height:844,seed:150,clockStart:1800000000000});
const reads=[],pkgs=[], queued=[], mk=h.wx.createImage, load=h.wx.loadSubpackage; let clock=0;
h.wx.createImage=()=>{const i=mk(),d=Object.getOwnPropertyDescriptor(i,'src');Object.defineProperty(i,'src',{...d,set(s){if(s)reads.push(s);if(mode.includes('delay')&&s?.includes('-bank')){const ready=i.onload;i.onload=(...e)=>queued.push([clock+45,()=>ready.apply(i,e)]);}return d.set.call(this,s);}});return i;};
h.wx.loadSubpackage=o=>{pkgs.push(o.name);return load(o);};
const trace=[], c=new Proxy({drawImage(im,...a){trace.push([im?.src||'canvas',...a]);},scale(...a){trace.push(['scale',...a]);}}, {get(t,k){return k in t?t[k]:k==='ghostHostBodyImageBN'?undefined:()=>{};}});
const tick=()=>new Promise(r=>setTimeout(r,0));
function tap(b){const x=b.x+b.w/2,y=b.y+b.h/2,q={identifier:1,clientX:x,clientY:y,x,y};h.emit('TouchStart',{changedTouches:[q],touches:[q]});h.emit('TouchEnd',{changedTouches:[q],touches:[]});}
let g,w,runtime,H;
async function start(){h.start();await until(()=>h.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','Home ready',25000);({window:w,runtime}=h.env());g=w.game;H=w.originalNetwork627.types.Hound;await until(()=>{g.draw();return g.homeOptionsReadyBN;},'Home actual draw');tap(g.getDifficultyOptionButtons().find(b=>b.id==='medium'));tap(g.getStartActionButtons().find(b=>b.id==='startGame'));await until(()=>!g.roundStarting&&g.state==='prep','fresh solo start',35000);g.finishEndlessOpeningIntroBH?.();g.draw();await tick();}
function check(hd,batch=true){trace.length=0;hd.draw(c,batch);return trace.slice();}
function pose(hd,steps,filtered){return steps.map(fields=>{if(fields.t!=null)g.supportTime=fields.t;Object.assign(hd,fields);return check(hd).filter(x=>filtered.test(x[0])).map(x=>[x[0].split('/').slice(-2).join('/'),...x.slice(1,x.length===9?5:1)]);});}
function hd(fields={}){return Object.assign(new H(1100,1150,2),fields);}
const common={waveHound:true,stoneStats:{stage:0},waveZoneIndex:0,waveNumber:10};

const snap=()=>({wave:g.waveNumber,pending:g.stonePending?.length||0,born:g.hounds.filter(x=>x.waveStone&&!x.dead).length,warning:runtime.memoryConstrained(),budget:g.stoneBossCandidate.bankReport?.(),gameElapsed:g.waveElapsed});
async function step(drawList=[]){
 clock+=1000/60;h.advance(1000/60);for(let i=queued.length-1;i>=0;i--)if(queued[i][0]<=clock)queued.splice(i,1)[0][1]();const t=performance.now();g.update(1000/60);const update=performance.now()-t,raw=[];
 for(const q of drawList){const row=check(q).filter(v=>v[0].startsWith('stone-art/'));raw.push(row[0]||[]);}
 await tick();return {raw,update};
}
function rawExpected(q){
 const a=q.stoneAction,w=!a&&q.stoneWalking;
 const f=w?Math.floor((q.stoneWalkElapsed||0)/62.5)%24:a?(a.kind==='throw'?24:0)+Math.min(23,Math.floor(a.age/62.5)):0;
 return [(w?'walk':'attack')+'-phase'+(q.stoneStats.stage+1)+'-bank'+String(f>>2).padStart(2,'0'),f%4*(w?256:181),w?'walk':a?.kind||'idle'];
}
(async()=>{
 await start();
 const B=w.originalNetwork627.types.Building,lane=g.playerStartZoneIndex,z=g.resourceZones[lane];
 if(!g.completedElfBuildingBitsBN()[lane]){const b=new B(z.x,z.y,'base',1);g.buildings.push(b);g.plots.addBuilding(b.x,b.y,b);}
 A.equal(g.allySlots.filter(Boolean).length,0);A.equal(g.completedElfBuildingBitsBN().filter(Boolean).length,1);
 if(mode.startsWith('warn'))h.emit('MemoryWarning',{level:10});
 const append=b=>{g.buildings.push(b);g.plots.addBuilding(b.x,b.y,b);return b;};
 const dx=z.gateX-z.x,dy=z.gateY-z.y,m=Math.hypot(dx,dy);
 const rounds=[];
 let restoreWorld=null;
 for(const [phase,wave] of [10,20,30].entries()){
  g.hounds.length=0;
  if(mode.startsWith('warn'))h.emit('MemoryWarning',{level:10});
  const elapsed=420+300*phase;
  g.troll.evolved=phase>0;g.troll.dragonEvolved=phase>1;
  Object.assign(g,{state:'hunt',waveElapsed:elapsed-.001,soloSlimeAssaultAt:60,monsterWaveBiasV2BN:0,waveNumber:wave-1,huntElapsed:elapsed-60-.001,stoneQueuedThrough:wave-10});
  const startReads=reads.filter(s=>s.startsWith('stone-art/')).length,start=g.stoneBossCandidate.bankReport();
  let group=[],bornTick=0;
  for(let k=0;k<100;k++){await step();group=g.hounds.filter(x=>x.waveStone&&!x.dead);if(group.length){bornTick=k+1;break;}}
  A.equal(g.waveNumber,wave);A.equal(group.length,1);A.equal(g.stonePending.length,0);
  let q=group[0],wall=append(new B(q.x+dx/m*190,q.y+dy/m*190,'wall',8));
  wall.hp=wall.maxHp=1e7;
  let missing=0,blank=0; const errors=[],seen=new Set(),poses=new Map(),t0=g.stoneBossCandidate.bankReport();
  async function sample(k){const out=await step([q]),raw=out.raw[0],x=rawExpected(q);seen.add(x[2]);if(!poses.has(x[2]))poses.set(x[2],new Set());poses.get(x[2]).add(x[0]+'_'+x[1]);
   if(!raw[0]?.includes(x[0])||raw[1]!==x[1]){missing++;if(!raw.length)blank++;if(errors.length<8)errors.push({k,wanted:x,got:raw.slice(0,3)});}
  }
  for(let k=0;k<420;k++)await sample(k);
  const tower=append(new B(z.x,z.y,'tower',5));tower.maxHp=tower.hp=1e7;
  let hp=tower.hp;
  q.x=z.x+dx/m*125;q.y=z.y+dy/m*125;q.stoneThrowLeft=0;q.stoneAction=null;wall.dead=true;q.stoneMeleeLeft=1800;
  for(let k=420;k<590;k++){
   await sample(k); if(wave===20&&restoreWorld&&restoreWorld.expected.length<60){restoreWorld.expected.push(rawExpected(q));}
   if(!restoreWorld&&wave===20&&q.stoneAction?.kind==='throw'&&q.stoneAction.age>=400&&q.stoneAction.age<=600)restoreWorld={serialized:g.serializeProgress(),stamp:q.stoneId,phase:q.stoneStats.stage,expected:[]};
  }
  tower.dead=true;
  const after=g.stoneBossCandidate.bankReport();
  rounds.push({phase,wave,bornTick,newStone:group.length,warning:runtime.memoryConstrained(),poses:Object.fromEntries([...poses].map(([k,v])=>[k,v.size])),towerDamaged:tower.hp<hp,missing,blank,repeats:after.repeated-t0.repeated,emergency:after.emergency-t0.emergency,peak:after.peak,readNew:reads.filter(x=>x.startsWith('stone-art/')).slice(startReads),errors});
 }
 A(restoreWorld,"native mid-throw save snapshot"); const rho=[];
 if(restoreWorld){
  const prior=reads.filter(n=>n.startsWith('stone-art/')).length;
  const p=g.loadProgressAsync(restoreWorld.serialized);let stopped=false;let err=null;
  p.then(()=>stopped=true,e=>{err=e;stopped=true;});
  for(let k=0;k<90&&!stopped;k++){clock+=16.667;h.advance(16.667);for(let i=queued.length-1;i>=0;i--)if(queued[i][0]<=clock)queued.splice(i,1)[0][1]();await new Promise(r=>setTimeout(r,8));}
  if(err)throw err;
  A(stopped,'actual async saved scene restored');
  const q=g.hounds.find(x=>x.waveStone&&x.stoneId===restoreWorld.stamp);A(q);A.equal(q.stoneStats.stage,restoreWorld.phase);
  const row=check(q).filter(v=>v[0].startsWith('stone-art/'))[0]||[];const wanted=rawExpected(q);
  tap(g.sessionMenuButtons().find(b=>b.id==="resume"));A.equal(g.sessionMenuOpen,false);
  let replayWrong=0;const replayTrace=[];
  for(const wanted of restoreWorld.expected){const out=await step([q]),row=out.raw[0];if(!row[0]?.includes(wanted[0])||row[1]!==wanted[1]){replayWrong++;if(replayTrace.length<5)replayTrace.push({wanted,row:row.slice(0,3),age:q.stoneAction?.age,state:g.state,menu:g.sessionMenuOpen,reported:rawExpected(q)});}}
  rho.push({replayTrace,replayFrames:restoreWorld.expected.length,replayWrong,one:g.hounds.filter(x=>x.waveStone&&!x.dead).length,wanted,got:row.slice(0,4),same:row[0]?.includes(wanted[0])&&row[1]===wanted[1],added:reads.filter(n=>n.startsWith('stone-art/')).slice(prior)});
 }
 const all=reads.filter(x=>x.startsWith('stone-art/'));A(all.every(x=>x.includes('-bank')||x.endsWith('stone-rock.webp.bin')));
 console.log(JSON.stringify({mode,rounds,restore:rho,static:all.length,final:g.stoneBossCandidate.bankReport()}));
 h.close();
})().catch(e=>{console.error(e);h.close();process.exitCode=1;});
