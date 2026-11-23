'use strict';
const path=require('node:path'),fs=require('node:fs'),a=require('node:assert/strict');
const {makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const root=path.resolve(process.argv[2]),work=fs.mkdtempSync(path.join(__dirname,'wx-'));
fs.writeFileSync(path.join(work,'keys.json'),'{}');
const host=makeHost(root,work,false,{width:390,height:844,seed:150,clockStart:1800000000000});
let tid=2;
function tap(b){a(b);const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:++tid,clientX:x,clientY:y,x,y};host.emit('TouchStart',{changedTouches:[p],touches:[p]});host.emit('TouchEnd',{changedTouches:[p],touches:[]});}

(async()=>{
 host.start();await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','Home',25000);
 const {window:w}=host.env(),g=w.game,T=w.originalNetwork627.types;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'actual Home',12000);
 g.selectDifficulty('crazy',true);tap(g.getStartActionButtons().find(x=>x.id==='startGame'));await until(()=>!g.roundStarting&&g.state==='prep','native Solo',30000);
 const api=g.cardsCandidate;g.allySlots.fill(false);
 const l=g.playerStartZoneIndex,z=g.resourceZones[l];if(!g.completedElfBuildingBitsBN()[l]){const b=new T.Building(z.x,z.y,'base',1);g.buildings.push(b);g.plots.addBuilding(b.x,b.y,b);}
 Object.assign(g,{state:'hunt',huntElapsed:839.995,soloSlimeAssaultAt:60,waveElapsed:719.995,waveNumber:19,monsterWaveBiasV2BN:0,stoneQueuedThrough:10,stonePending:[],tutorial:null,ceremony:null,endlessOpeningIntro:null,batIntroSeenBN:true,stoneIntroSeenBN:true});
 g.hounds.length=0;a.equal(g.waveMonsterStageBN(),0);
 const step=async()=>{host.advance(16.667);g.update(16.667);await new Promise(r=>setTimeout(r,0));};
 await step();
 a.equal(g.waveMonsterStageBN(),1,'actual engine evolves through native 840s boundary');
 a.equal(api.core.state.lastAward,0);a.equal(g.waveNumber,20);
 let q;
 for(let k=0;k<80&&!q;k++){await step();q=g.hounds.find(b=>b.waveStone&&b.waveNumber===20);}
 a(q);a.equal(q.stoneStats.stage,1);a.equal(api.core.state.lastAward,0);
 const id=q.stoneRewardId;
 // Advance the clock to the next genuine transition without altering the living boss or demon code.
 g.huntElapsed=1499.995;await step();a.equal(g.waveMonsterStageBN(),2);
 for(let k=0;k<30&&q.stoneStats.stage!==2;k++)await step();
 a.equal(q.stoneStats.stage,2);a(!q.dead&&q.stoneRewardId===id);a.equal(api.core.state.lastAward,0);
 q.takeDamage(1e9,g.player);a(q.dead&&q.stoneDeathRecorded);api.tick(16);
 const granted=api.core.state.lastAward;
 a.equal(granted,3);a.equal(g.cardRewardInboxData.events.find(e=>e.id===id)?.cardsGranted??g.cardRewardInboxData.events[0].cardsGranted,3);
 q.takeDamage(1e9,g.player);api.tick(1000);a.equal(api.core.state.lastAward,granted);
 const saved=g.serializeProgress();a(await g.loadProgressAsync(saved));api.tick(1000);
 a.equal(api.core.state.lastAward,granted,'no replay of reward after native reload');
 console.log(JSON.stringify({naturalEvolutionAt840:1,realBirthWave:20,existingBossNaturalDragonAt1500:2,preDeathCards:0,postDeathCards:granted,replayAfterLoad:0}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>host.close());
