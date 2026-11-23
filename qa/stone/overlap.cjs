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
 const dx=z.gateX-z.x,dy=z.gateY-z.y,m=Math.hypot(dx,dy),append=b=>{g.buildings.push(b);g.plots.addBuilding(b.x,b.y,b);return b;};
 const stones=()=>g.hounds.filter(x=>x.waveStone&&!x.dead);
 const elapsed=wave=>420+(wave/10-1)*300;
 function anchor(n){const t=elapsed(n)-.001;Object.assign(g,{state:'hunt',waveElapsed:t,soloSlimeAssaultAt:60,monsterWaveBiasV2BN:0,waveNumber:n-1,huntElapsed:t-60});}
 g.hounds.length=0;h.emit('MemoryWarning',{level:10});
 anchor(10);let q;
 for(let n=0;n<120;n++){await step();q=stones()[0];if(q)break;}
 A(q);const first=q.stoneId;
 const wall=append(new B(q.x+dx/m*240,q.y+dy/m*240,'wall',9));wall.maxHp=wall.hp=1e7;
 for(let n=0;n<530;n++)await step([q]);A(!q.dead);const original={x:q.x,y:q.y,id:q.stoneId,walkAge:q.stoneWalkElapsed,stage:q.stoneStats.stage};
 anchor(20);
 let reentry=[],at=0,errors=[],action=new Set();
 for(let n=0;n<240;n++){
  reentry=stones();const r=await step(reentry);
  if(stones().length>1&&!at)at=n+1;
  for(const [i,st] of reentry.entries()){const row=r.raw[i],want=rawExpected(st);action.add(want[2]);if(!row[0]?.includes(want[0])||row[1]!==want[1])errors.push({frame:n,id:st.stoneId,wanted:want,row:row.slice(0,3)});}
 }
 A.equal(stones().length,2);A.equal(stones()[0].stoneId,first);A(stones().some(b=>b.waveNumber===20&&b.waveZoneIndex===lane));
 console.log(JSON.stringify({mode,lane,first:original,count:stones().length,ids:stones().map(b=>b.stoneId),spawnFrame:at,errors:errors.length,firstErrors:errors.slice(0,5),actions:[...action],budget:g.stoneBossCandidate.bankReport()}));
 h.close();
})().catch(e=>{console.error(e);h.close();process.exitCode=1;});
