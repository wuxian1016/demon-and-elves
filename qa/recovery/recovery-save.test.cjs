'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),a=require('node:assert/strict'),{test}=require('node:test');
const {makeHost,STARTUP,until}=require('./ads-instrumented-host.cjs');
const root=path.resolve(process.env.COW_CLIENT);
const exact=require(path.join(root,'network/ad-lab/native-placement-config'));
function fixture(ver,{delayReward=true,showMock=false}={}){
 const disk=fs.mkdtempSync(path.join(os.tmpdir(),'c3-ads-no-live-'));fs.writeFileSync(path.join(disk,'keys.json'),'{}');
 const h=makeHost(root,disk,false,{width:390,height:844,seed:150});
 for(const api of ['request','connectSocket','downloadFile','uploadFile','login','shareAppMessage'])h.wx[api]=()=>{throw Error('External network disabled: '+api);};
 const prev=h.wx.getAccountInfoSync;
 h.wx.getAccountInfoSync=()=>{const o=prev();o.miniProgram.envVersion=ver;return o;};
 h.wx.getAppBaseInfo=()=>({SDKVersion:'3.7.1'});
 let reward=0,inter=0,lobby=0,show=0,result,loaded=false;const rewards=[];
 const neverShow=()=>{show++;throw Error('false automatic playback');};
 h.wx.createRewardedVideoAd=o=>{
  if(o.adUnitId!==exact.rewardId)throw Error('incorrect native reward route');reward++;
  const ad={load(){loaded=true;return delayReward?new Promise((yes,no)=>{this.foil=()=>no({errCode:1004});this.readyMock=yes;}):Promise.resolve();},show(){if(!showMock)return neverShow();show++;return Promise.resolve();},onError(f){this.noFill=f;},onClose(f){this.closeMock=f;},destroy(){}};rewards.push(ad);return ad;
 };
 h.wx.createInterstitialAd=o=>{
  if(o.adUnitId!==exact.interstitialId)throw Error('incorrect native settlement route');inter++;
  return result={show(){if(!showMock)return neverShow();show++;return Promise.resolve();},onLoad(f){this.loaded=f;},onError(f){this.noFill=f;},onClose(f){this.close=f;},destroy(){}};
 };
 h.wx.createCustomAd=()=>{lobby++;throw Error('unverified native template must not be created');};
 return {h,rewards,trace:()=>[reward,inter,lobby,show],result:()=>result,pending:()=>loaded};
}
async function home(t){
 const {h}=t;h.start();a.deepEqual(t.trace(),[0,0,0,0]);
 await until(()=>{
  a.deepEqual(t.trace(),[0,0,0,0]);
  return h.stored()[STARTUP]?.events?.at(-1)?.kind==='ready';
 },'native startup Home',25000);
 const g=h.env().window.game;a.equal(g.state,'start');
 await until(()=>{g.draw();a.deepEqual(t.trace(),[0,0,0,0]);return g.homeOptionsReadyBN;},'Home canvas',15000);
 return g;
}
function tap(h,b){const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:1,clientX:x,clientY:y,x,y};
 h.emit('TouchStart',{changedTouches:[p],touches:[p]});
 h.emit('TouchEnd',{changedTouches:[p],touches:[]});
}
test('exact COW8B trial config: no native factory before or on Home; unresolved rewarded preload cannot block first solo game; no-fill return sync',async ctx=>{
 const t=fixture('trial');ctx.after(()=>t.h.close());const g=await home(t);a(g.rewardAdBN);
 const difficulty=g.getDifficultyOptionButtons().find(x=>x.id==='medium');a(difficulty);tap(t.h,difficulty);a.equal(g.trollDifficulty,'medium');
 const b=g.getStartActionButtons().find(x=>x.id==='startGame');a(b);tap(t.h,b);a(g.roundStarting);
 await until(()=>{if(g.roundStarting)a.deepEqual(t.trace(),[0,0,0,0]);return !g.roundStarting&&g.state==='prep';},'first solo game boot',35000);
 a(!g.tutorial);
 g.draw();a.deepEqual(t.trace(),[1,0,0,0]);a(t.pending());
 g.state='win';g.ceremony=null;g.endlessOpeningIntro=null;g.draw();
 a.deepEqual(t.trace(),[1,1,0,0]);t.result().noFill();
 let returned=0;a(g.rewardAdBN.returnResult('win',()=>{returned++;g.state='start';}));a.equal(returned,1);
 a.deepEqual(t.trace(),[1,1,0,0]);g.rewardAdBN.dispose();
});
test('same enabled config release environment: Home, play and results never instantiate SDK',async ctx=>{
 const t=fixture('release');ctx.after(()=>t.h.close());const g=await home(t);a.equal(g.rewardAdBN,undefined);g.state='hunt';g.draw();
 g.state='win';g.ceremony=null;g.draw();a.deepEqual(t.trace(),[0,0,0,0]);
});
async function first(t){
 const g=await home(t);
 const m=g.getDifficultyOptionButtons().find(x=>x.id==='medium');a(m);tap(t.h,m);
 const b=g.getStartActionButtons().find(x=>x.id==='startGame');a(b);tap(t.h,b);
 await until(()=>!g.roundStarting&&g.state==='prep','normal player round ready',35000);
 a(g.player.rewardAdV1?.id);g.finishEndlessOpeningIntroBH?.();g.draw(false);
 await new Promise(setImmediate);
 return g;
}
function label(g,s){
 const c=g.ctx,previous=c.fillText;
 let found;c.fillText=function(value,x,y,...arg){if(value===s)found={x,y,w:0,h:0};return previous.call(this,value,x,y,...arg);};
 try{g.draw();}finally{c.fillText=previous;}
 return found;
}
test('round identity persists after same-save reload, legacy no ledger untouched, actual fresh new reset gets a distinct ID',async ctx=>{
 const t=fixture('trial',{delayReward:false});ctx.after(()=>t.h.close());const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());
 const id=g.player.rewardAdV1.id,saved=g.serializeProgress(),found=g.player.rewardAdV1;
 delete g.player.rewardAdV1;
 const stableIds=[g.stoneCardData,g.cardRewardInboxData];
 const legacy=g.serializeProgress();
 g.stoneCardData=g.cardRewardInboxData=null;
 const noProvenId=g.serializeProgress();
 [g.stoneCardData,g.cardRewardInboxData]=stableIds;g.player.rewardAdV1=found;
 a(g.loadProgress(saved));a.equal(g.player.rewardAdV1.id,id);
 a(g.loadProgress(legacy));
 if(process.env.EXPECT_TRUSTED_LEGACY==='1'){
  a.equal(g.player.rewardAdV1?.wallOnly,true,'only known native archive opts into future walls');
  a.equal(g.player.rewardAdV1.wall,0);
  a.equal(g.player.rewardAdV1.vehicles,undefined);a.equal(g.player.rewardAdV1.tower,undefined);
 }else a(!g.player.rewardAdV1,'original historical ledger-free save unchanged');
 a(g.loadProgress(noProvenId));a(!g.player.rewardAdV1,'unknown legacy native ID must not opt in');
 const ignored={selected:1};a(!g.rewardAdBN.setupManual(ignored));a(!ignored.adManualBN);
 g.reset();a(g.player.rewardAdV1?.id);a.notEqual(g.player.rewardAdV1.id,id);a.equal(g.player.rewardAdV1.wall,0);a.equal(g.player.rewardAdV1.vehicles,0);
});
test('first round helper excludes multiplayer authority and hard challenges without any ad ready/shown',async ctx=>{
 const t=fixture('trial');ctx.after(()=>t.h.close());const g=await home(t);ctx.after(()=>g.rewardAdBN?.dispose());
 g.networkAuthorityPhases627={};g.beginRound(true);a(!g.player.rewardAdV1);a.deepEqual(t.trace(),[0,0,0,0]);
 // Stop the controlled fake loading job before the asserted high-difficulty no-ads scenario.
 g.cancelRoundLoading591();g.networkAuthorityPhases627=null;g.superChallenge580=true;g.state='prep';g.draw();
 a(!g.rewardAdBN.setupManual({selected:1}));a.deepEqual(t.trace(),[0,0,0,0]);
});
const WALL='看广告重建这段城墙',TOWER='看广告重建防御塔';
const settle=()=>new Promise(setImmediate);
function wallTeam(t,g,level=1,count=2){
 const T=t.h.env().window.originalNetwork627.types.Building,lane=g.resourceZones[g.playerStartZoneIndex];
 const group=[];
 const pts=[...g.defenseRecommendationLayout(lane).filter(p=>p.type==='wall')];
 for(const p of pts){
  const b=new T(p.x,p.y,'wall',level);if(!g.canPlaceBuilding(p.x,p.y,b.radius,'wall'))continue;
  g.buildings.push(b);g.plots.addBuilding(b.x,b.y,b);group.push(b);if(group.length===count)break;
 }
 a.equal(group.length,count,'native legal same-lane wall sites');
 return group;
}
function hurt(g,b,source=g.troll){b.takeDamage(1e9,source);a(b.dead);}
function purge(g){g.buildings=g.buildings.filter(b=>!b.dead);g.hounds=[];g.miniTrolls=[];g.tanks=g.tanks.filter(v=>!v.dead);g.troll.x=9200;g.troll.y=7200;g.selectedBuilding=null;}
async function warm(t,g){g.draw();const e=t.rewards.at(-1);a(e);e.readyMock?.();await settle();g.draw();return e;}
async function full(t,g,labelText,row=t.rewards.at(-1)){
 const b=label(g,labelText);a(b,labelText+' absent');tap(t.h,b);await settle();row.closeMock({isEnded:true});await settle();g.draw();
}
test('native wall: exposed single-wall quota monotonic after old restore, Lv10 reset never gives a fourth',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const [p,q]=wallTeam(t,g,9);
 const before=g.serializeProgress();hurt(g,p);a.equal(g.player.rewardAdV1.wall,0);
 await full(t,g,WALL,await warm(t,g));a(!p.dead&&!q.dead);a.equal(g.player.rewardAdV1.wall,1);
 hurt(g,p);await full(t,g,WALL,await warm(t,g));a.equal(g.player.rewardAdV1.wall,2);
 a(p.upgrade());a.equal(p.level,10);
 const beforeBonus=g.serializeProgress();
 a(await g.loadProgressAsync(beforeBonus));g.sessionMenuOpen=false;g.state='hunt';g.endlessOpeningIntro=null;g.ceremony=null;
 const lvl10=g.buildings.find(b=>b.type==='wall'&&b.level===10&&!b.dead);a(lvl10);hurt(g,lvl10);
 await full(t,g,WALL,await warm(t,g));a.equal(g.player.rewardAdV1.wall,3);a(!lvl10.dead);
 a(await g.loadProgressAsync(before));g.sessionMenuOpen=false;g.state='hunt';g.endlessOpeningIntro=null;g.ceremony=null;
 a.equal(g.player.rewardAdV1.wall,3);a(g.player.rewardAdV1.wallWipesV2.unlocked);
 const restored9=g.buildings.find(b=>b.type==='wall'&&b.level===9&&!b.dead);a(restored9);a(restored9.upgrade());hurt(g,restored9);
 await warm(t,g);a.equal(label(g,WALL),undefined);a.equal(t.trace()[3],3);
});
test('legacy trial limits: already consumed 3 locked / 4 unlocked migrated and no new opportunity after re-level or reload',async ctx=>{
 const t=fixture('trial',{delayReward:false,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const w9=wallTeam(t,g,9,1)[0], match=g.player.rewardAdV1.id;
 const key='wall_reward_wipeout_v2:'+match;
 const world=g.serializeProgress();
 for(const old of [{used:3,unlocked:false,ordinal:3},{used:4,unlocked:true,ordinal:4}]){
  t.h.wx.setStorageSync(key,old);
  a(await g.loadProgressAsync(world));g.state='hunt';g.sessionMenuOpen=false;g.endlessOpeningIntro=null;g.ceremony=null;
  a.equal(g.player.rewardAdV1.wall,3);
  a.equal(g.player.rewardAdV1.wallWipesV2.committed,old.ordinal);
  a.equal(g.player.rewardAdV1.wallWipesV2.unlocked,old.unlocked);
  const wall=g.buildings.find(b=>!b.dead&&b.type==='wall'&&b.level===9&&b.x===w9.x&&b.y===w9.y);a(wall);
  a(wall.upgrade());a(g.player.rewardAdV1.wallWipesV2.unlocked);
  hurt(g,wall);a.equal(label(g,WALL),undefined);a.equal(g.player.rewardAdV1.wall,3);
  a.equal(t.h.wx.getStorageSync(key).used,3);
 }
 a.equal(t.trace()[3],0);
});
function towerAt(t,g,typ='tower',lv=2){
 const T=t.h.env().window.originalNetwork627.types.Building;
 const z=g.resourceZones[g.playerStartZoneIndex],center=[z.x,z.y];
 for(let k=0;k<64;k++){
  const angle=(k%16)*Math.PI/8,r=180+Math.floor(k/16)*120,x=center[0]+r*Math.cos(angle),y=center[1]+r*Math.sin(angle);
  const q=new T(x,y,typ,lv);if(!g.canPlaceBuilding(x,y,q.radius,q.type))continue;
  g.buildings.push(q);g.plots.addBuilding(x,y,q);return q;
 }
 a.fail('no safe tower fixture');
}
test('saved pre-read walls never replay; unsupported/under-build/AI/manual loss no offer, later native fresh wall still eligible',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const [dead,live]=wallTeam(t,g);hurt(g,dead);
 const world=g.serializeProgress();a.equal(g.player.rewardAdV1.wall,0);a.equal(g.player.rewardAdV1.wallRows,undefined);
 a(await g.loadProgressAsync(world));g.state='hunt';g.sessionMenuOpen=false;g.endlessOpeningIntro=null;g.ceremony=null;
 await warm(t,g);a.equal(label(g,WALL),undefined,'pre-save death is not replayed after load');a.equal(g.player.rewardAdV1.wall,0);
 const activeWall=g.buildings.find(w=>!w.dead&&w.type==='wall'&&w.x===live.x&&w.y===live.y);a(activeWall);hurt(g,activeWall);
 await full(t,g,WALL,t.rewards.at(-1));a.equal(g.player.rewardAdV1.wall,1);a(!activeWall.dead);
 purge(g);const unbuilt=wallTeam(t,g,1,1)[0];unbuilt.buildTime=5000;unbuilt.buildProgress=12;hurt(g,unbuilt);a.equal(g.player.rewardAdV1.wall,1);
 purge(g);const [ally,manual]=wallTeam(t,g);ally.ownerSlot=1;hurt(g,ally);a.equal(g.player.rewardAdV1.wall,1);
 a(g.trySellBuilding(manual));a.equal(g.player.rewardAdV1.wall,1);a.equal(label(g,WALL),undefined);
});
test('native tower independent first two, ready after delay, early then full, saved level & anti-air variant; AI excluded',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const ghost=towerAt(t,g);ghost.ownerSlot=1;hurt(g,ghost);a.equal(g.player.rewardAdV1.tower,0);
 const t0=towerAt(t,g);hurt(g,t0);a.equal(g.player.rewardAdV1.tower,1);a.equal(g.player.rewardAdV1.wall,0);a.equal(label(g,TOWER),undefined);
 const f0=await warm(t,g);const button=label(g,TOWER);a(button);tap(t.h,button);await settle();f0.closeMock({isEnded:false});await settle();a(t0.dead);
 purge(g);const t1=towerAt(t,g,'antiAirTowerBN',3),where=[t1.x,t1.y,t1.level,t1.airDefenseKindBN];
 hurt(g,t1);a.equal(g.player.rewardAdV1.tower,2);
 await full(t,g,TOWER,await warm(t,g));a.deepEqual([t1.x,t1.y,t1.level,t1.airDefenseKindBN],where);a(!t1.dead);
 hurt(g,t1);a.equal(g.player.rewardAdV1.tower,2);a.equal(label(g,TOWER),undefined);
});
test('native first robot and tank deaths each once, not lost while SDK loads; preserve state and grant half HP only full',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const T=t.h.env().window.originalNetwork627.types;
 function spawn(K){for(let y=1600;y<6500;y+=189)for(let x=2200;x<8500;x+=207){const q=new T[K](x,y);if(g.queryTerrainCollisionAt(x,y,q.radius,false)||[...g.buildings,...g.trees,...g.goldMines,...g.guardTrees,g.troll,g.trollBase,g.player].some(b=>b&&!b.dead&&Math.hypot(x-b.x,y-b.y)<q.radius+(b.radius||0)+4))continue;g.tanks.push(q);return q;}a.fail('no clear vehicle spot');}
 const r=spawn('Robot');hurt(g,r);a.equal(g.player.rewardAdV1.vehicles,0);a.equal(label(g,'看广告复活机器人'),undefined);
 await full(t,g,'看广告复活机器人',await warm(t,g));a.equal(r.hp,Math.ceil(r.maxHp/2));a(!r.dead&&!r.driver);
 hurt(g,r);a.equal(label(g,'看广告复活机器人'),undefined);
 purge(g);const a1=spawn('Tank');hurt(g,a1);a.equal(g.player.rewardAdV1.vehicles,1);
 const f1=await warm(t,g),b=label(g,'看广告复活坦克');a(b);tap(t.h,b);await settle();f1.closeMock({isEnded:false});await settle();a(a1.dead);
});
test('native settlement: ready interstitial only on result exit button, one return; no load means direct exit',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());
 g.state='win';g.ceremony=null;g.draw();a.equal(t.trace()[1],1);a.equal(t.trace()[3],0);
 t.result().loaded();let returns=0;
 a(g.rewardAdBN.returnResult('win',()=>{returns++;g.state='start';}));a.equal(returns,0);a.equal(t.trace()[3],1);
 a(g.rewardAdBN.returnResult('win',()=>returns++));await settle();t.result().close();a.equal(returns,1);
});

test('manual save native opt-in unchanged and fake early-close never writes',async ctx=>{
 const t=fixture('trial',{delayReward:false,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());
 g.sessionMenuOpen=true;g.draw();
 const save=g.sessionMenuButtons().find(x=>x.id==='save');a(save);tap(t.h,save);
 await until(()=>g.saveSlotsPanel&&!g.saveSlotsPanel.busy,'actual settings save panel',10000);
 const panel=g.saveSlotsPanel;a(panel.adManualBN);
 const action=g.saveSlotsLayout().buttons.find(x=>x.id==='action');
 a.equal(action.text,'看广告后保存');
 const existing=g.savedGameAvailable;tap(t.h,action);await new Promise(setImmediate);a.equal(t.trace()[3],1);
 t.rewards.at(-1).closeMock({isEnded:false});a.equal(panel.notice,'广告未看完，本次未保存');a.equal(g.savedGameAvailable,existing);
 a(!panel.slots[0]);a(!panel.busy);
});
test('settlement preload after stable battle, no actual show before return, local status for onLoad/no-fill/reject',async ctx=>{
 const t=fixture('trial',{delayReward:true,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());
 g.state='hunt';g.ceremony=null;g.huntElapsed=10;g.draw();a.equal(t.trace()[1],0);
 g.huntElapsed=30;g.draw();a.equal(t.trace()[1],1);const ad=t.result();ad.loaded();a.equal(t.trace()[3],0);
 g.state='win';g.draw();a.equal(t.trace()[1],1,'same prepared creative is reused');
 ad.show=()=>Promise.reject({errCode:1004,errMsg:'must not appear inside diagnostics'});
 let n=0;a(g.rewardAdBN.returnResult('win',()=>{n++;g.state='start';}));await settle();a.equal(n,1);
 const d=Array.from(g.rewardAdBN.settlementDiagnostic(),x=>({...x}));
 a.deepEqual(d,[{step:'created-in-match'},{step:'onLoad'},{step:'results-entered'},{step:'return-tap'},{step:'show-request'},{step:'show-rejected',code:1004}]);
 a.deepEqual(t.h.stored().test_settlement_ad_trace_v1,d);
});
test('completed watch revalidates its chosen original single wall cell before restoring',async ctx=>{
 const t=fixture('trial',{delayReward:false,showMock:true});ctx.after(()=>t.h.close());
 const g=await first(t);ctx.after(()=>g.rewardAdBN?.dispose());purge(g);
 const [b1,b2]=wallTeam(t,g);hurt(g,b1);hurt(g,b2);const btn=label(g,WALL);a(btn);tap(t.h,btn);await settle();
 const T=t.h.env().window.originalNetwork627.types.Building;
 const foreign=new T(b1.x,b1.y,'wall',2);g.buildings.push(foreign);g.plots.addBuilding(b1.x,b1.y,foreign);
 t.rewards[0].closeMock({isEnded:true});await settle();a(b1.dead&&b2.dead);a(!foreign.dead);a.equal(g.player.rewardAdV1.wall,1);
});
