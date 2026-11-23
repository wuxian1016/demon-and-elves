'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const [root,mode]=process.argv.slice(2);
const {create}=require(path.join(root,'network/card-effects-bridge.js'));
const color={'#ff6570':'fury','#ffdc61':'fortress','#57ff9c':'harvest'}, kinds='house houseForPeasants goldMine warehouse exchange repairShop tankFactory tankLab robotFactory robotLab cannonTower wall tower iceTower manaTower watchtower altar antiAir net'.split(' ');
const combat=new Set(['cannonTower','tower','iceTower','manaTower','antiAir','net']);
const state={time:0}; let low=false,auth=true,mods={attack:2,maxHp:2,armor:2,harvest:2};
const at=(id,type,m={})=>({x:id*600,y:300,type,radius:28,...m});
const own=kinds.map((k,i)=>at(i+10,k==='antiAir'||k==='net'?'tower':k,k==='antiAir'||k==='net'?{airDefenseKindBN:k}:{}));
const worker=at(2,'peasant',{carryWood:12}),bystander=at(3,'peasant',{ownerSlot:2});
const player=at(1,'elf',{task:{type:'gold'},relicBladeLevel:1});
const more=[at(35,'goldMine',{ownerSlot:2}),at(36,'goldMine',{underConstruction:true}),at(39,'tower',{dead:true}),at(40,'tower',{preview:true}),at(42,'tower',{buildProgress:1,buildTime:500})];
const game={player,camera:{x:0,y:0},buildings:[...own,...more]};
let drawn=[];
let ctx={save(){},restore(){},fillRect(x){drawn.push([Math.round(x/600),color[this.fillStyle]])}};
const fx=create({game,controller:{core:{state,authority:()=>auth,modifiers:()=>mods}},createCanvas:()=>{throw Error('force fallback geometry capture')},enabled:()=>true,constrained:()=>low});
const view=()=>true;
function frame(entities=game.buildings,people=[worker,bystander]){
 drawn=[];fx.draw(ctx,view,people,true,entities);
 const before=drawn.slice();
 fx.drawActorFx?.(ctx);
 const advanced=drawn.slice();
 fx.drawActorFx?.(ctx);
 assert.deepEqual(drawn,advanced,'deferred actor painting one-use');
 assert(fx.stats().draws<=fx.stats().max);
 return {before,all:advanced};
}
const frame0=frame(),has=(ts,id,kind)=>ts.some(([x,k])=>x===id&&k===kind);
const fstCovered=kinds.filter((k,i)=>has(frame0.before,i+10,'fortress'));
if(mode==='new'){
 assert.equal(fstCovered.length,19);
 for(const [i,k] of kinds.entries()){
  assert.equal(has(frame0.before,i+10,'fury'),combat.has(k),k);
  assert.equal(has(frame0.before,i+10,'harvest'),k==='goldMine',k);
 }
 assert(!frame0.before.some(([i])=>i<10));
 assert(has(frame0.all,1,'fury')&&has(frame0.all,1,'harvest')&&has(frame0.all,2,'harvest'));
 assert(!frame0.all.some(([i])=>i===3||i>=35));
 // When engine supplies its exact viewport list, ignore the full world tree entirely.
 Object.defineProperty(game,'buildings',{get(){throw Error('must not scan global buildings')},configurable:true});
 assert(frame(own.slice(9,10),[]).all.every(([i])=>i===1||i===19));
 // 200 buildings plus 3 actor marks, with 3 colors fighting for 48 or 144 slots.
 const dense=Array.from({length:200},(_,i)=>at(i+50,i%2?'tower':'goldMine'));
 const expected=new Set(['1:fury','1:harvest','2:harvest']);
 for(const [i,e] of dense.entries())for(const k of ['fortress',e.type==='tower'?'fury':'harvest'])expected.add((i+50)+':'+k);
 for(const max of [144,48]){
  low=max===48; const union=new Set();
  for(let frameIndex=0;frameIndex<Math.ceil(expected.size/max);frameIndex++){
   state.time=frameIndex*420;
   const {all}=frame(dense), seen=new Set(all.map(x=>x.join(':')));
   assert.equal(seen.size,max);
   for(const key of seen)union.add(key);
   assert.deepEqual(frame(dense).all,all,'same simulation time keeps same particle turn');
  }
  assert.deepEqual(union,expected);
 }
 mods={attack:1,maxHp:1,armor:1,harvest:1};
 assert.equal(frame(own).all.length,0);
 mods={attack:2,maxHp:2,armor:2,harvest:2};auth=false;
 assert.equal(frame(own).all.length,0);
}
console.log(JSON.stringify({mode,fortressDistinct:fstCovered,distinctHome:new Set(frame0.all.map(x=>x.join(':'))).size,caps:mode==='new'?[144,48]:[],mixedEntries:mode==='new'?403:0}));
