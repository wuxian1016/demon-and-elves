'use strict';
const path=require('node:path'),fs=require('node:fs'),a=require('node:assert/strict');
const {makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const root=path.resolve(process.argv[2]),work=fs.mkdtempSync(path.join(__dirname,'wx-'));
fs.writeFileSync(path.join(work,'keys.json'),'{}');
const host=makeHost(root,work,false,{width:390,height:844,seed:150,clockStart:1800000000000});
let tid=2;
function tap(b){a(b);const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:++tid,clientX:x,clientY:y,x,y};host.emit('TouchStart',{changedTouches:[p],touches:[p]});host.emit('TouchEnd',{changedTouches:[p],touches:[]});}
const pool=['fury','harvest','fortress','sanctuary','storm'];function select(key,id='stone:1',ordinal=0){let h=2166136261;for(const c of key+':'+id+(ordinal?':'+ordinal:''))h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^(h>>>16),0x85ebca6b);h^=h>>>13;return pool[(h>>>0)%5];}
(async()=>{host.start();await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','Home',25000);const {window:w}=host.env(),g=w.game;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'actual Home',12000);
 g.selectDifficulty('crazy',true);tap(g.getStartActionButtons().find(x=>x.id==='startGame'));await until(()=>!g.roundStarting&&g.state==='prep','native Solo',30000);
 const api=g.cardsCandidate,cp=g.cardPresentation;const T=w.originalNetwork627.types;
 a(api.soloRewards&&api.stormConfigured&&g.stoneCardHandoff&&w.cardArtCandidate.ready);
 g.allySlots.fill(false);g.state='hunt';g.selectDifficulty('crazy');g.state='hunt';Object.assign(g,{prepTimeLeft:0,tutorial:null,endlessOpeningIntro:null,ceremony:null,firstAttackCameraFocus:null,stonePending:[],superChallenge580:false});
 a.equal(g.trollDifficulty,'crazy');
 const rows=[];
 async function check(stage,want,k,liveInteraction){
  const wave=10*(stage+1),match='qa-crazy-card-'+stage+'-'+k;
  a.equal(select(match),want);
  api.resetRound();
  g.cardRewardInboxData=null;g.stoneCardData={version:1,matchId:match,serial:0,pending:[],pressure:false,legacyMigrated:true};
  Object.assign(g,{hounds:[],huntElapsed:[360,900,1550][stage],soloSlimeAssaultAt:60,waveElapsed:60+360+(wave-10)*30+.01,waveNumber:wave-1,monsterWaveBiasV2BN:0,stoneQueuedThrough:0,stonePending:[],stoneDefeatEvents:[],tutorial:null,ceremony:null});
  g.troll.evolved=stage>0;g.troll.dragonEvolved=stage===2;g.batIntroSeenBN=g.stoneIntroSeenBN=true;
  a.equal(g.waveMonsterStageBN(),stage);
  // Exercise the current phase through the real bank-backed spawn queue.
  // Do not call the removed full-page compatibility preload.
  g.updateHoundWaves(0);
  for(let i=0;i<120&&!g.hounds.some(x=>x.waveStone&&x.waveNumber===wave);i++){
   host.advance(1000/60);g.update(1000/60);
   await new Promise(r=>setTimeout(r,0));
  }
  a(g.stoneBossCandidate.artReady());
  a.equal(g.waveMonsterStageBN(),stage,'controlled demon stage remains selected');
  const b=g.hounds.find(x=>x.waveStone&&x.waveZoneIndex===(g.playerStartZoneIndex??0));
  a(b?.hp>0,JSON.stringify({stage,wave:g.waveNumber,stonePending:g.stonePending,spawns:g.hounds.map(x=>x.waveZoneIndex),zones:g.playerStartZoneIndex}));
  a.equal(b.waveNumber,wave);a.equal(b.stoneStats.stage,stage);
  const id=b.stoneRewardId;a.equal(id,'stone:1');const src=stage===0?g.player:stage===1?new T.Building(g.player.x,g.player.y,'tower'):new T.Robot(g.player.x,g.player.y);
  const preHp=b.hp;b.takeDamage(1e9,src);a(b.dead&&b.stoneDeathRecorded);
  g.cardsCandidate.tick(16);g.draw();
  const drawn=api.core.state.hand.map(c=>c.type),n=stage+1,expected=Array.from({length:n},(_,i)=>select(match,id,i));
  a.deepEqual(Array.from(drawn),expected);a.equal(api.core.state.lastAward,n);a.equal(g.cardRewardInboxData.events[0].cardsGranted,n);a.equal(g.cardRewardInboxData.events[0].status,'granted');
  if(stage===0)a.equal(cp.ui.state.award,want);else a.deepEqual(Array.from(cp.ui.state.hand),expected);
  const row={stage,wave,match,id,drops:drawn,visible:cp.ui.state.award??Array.from(cp.ui.state.hand),preHp,rewardOwner:g.elfRewardOwnerSlot(src),attackCardArtworkRead:host.access.some(([act,f])=>act==='package:file:read'&&f.includes('fury'))};
  if(liveInteraction){
   // This matrix also exercises actual click-to-use, not just a card-state grant.
   host.advance(750);g.draw();const ix=api.core.state.hand.findIndex(c=>c.type==='fury');a(ix>=0);
   const pose=cp.ui.state.poses[ix];a(pose);tap({x:pose.x,y:pose.y,w:0,h:0});a.equal(cp.ui.state.hand[cp.ui.state.selected],'fury');
   const confirm=cp.guideControl(api.core.state.hand[ix].id);a.equal(confirm.step,'confirm');tap(confirm.pointer);
   a.equal(api.core.modifiers().attack,6);a.equal(api.core.modifiers().attackSpeed,2);
   a.equal(api.core.state.effects.at(-1).type,'fury');
   const saved=g.serializeProgress();row.save=saved;row.attackAfterTap=6;row.attackSpeedAfterTap=2;
  }
  rows.push(row);
 }
 for(let stage=0;stage<3;stage++)for(const want of pool){let k=0;while(select('qa-crazy-card-'+stage+'-'+k)!==want)k++;await check(stage,want,k,stage===2&&want==='fury');}
 const row=rows.find(r=>r.save);a(await g.loadProgressAsync(row.save));const n=api.core.state.lastAward;api.tick(16);a.equal(api.core.state.lastAward,n);a.equal(api.core.modifiers().attack,6);row.save='native load: no duplicate rewards, active x6 preserved';
 const sample=Object.fromEntries(pool.map(t=>[t,0]));for(let i=0;i<10000;i++)sample[select('qa-sample'+i)]++;
 console.log('RESULT '+JSON.stringify({difficulty:'crazy',stormConfigured:api.stormConfigured,outcomesPerPhase:pool,rows,sample}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>host.close());
