const assert=require('node:assert/strict');
const {create}=require(process.argv[2]);let now=0,ready=false,made=0,draws=0,steps=0,dispose=0;
const g={player:{},troll:{},state:'hunt'},v={width:390,height:844};
const c=new Proxy({measureText:()=>({width:30})},{get:(t,k)=>Object.hasOwn(t,k)?t[k]:()=>{}});
const flags={off:true};
const stageFor=()=>({ready:()=>ready,create(){
 made++;if(made===1)return null;
 return {length:500,step(){steps++;},draw(){if(++draws===1)throw new Error('transient exact stage render');},dispose(){dispose++;}};
}});
const flow=create(g,{offline:()=>flags.off,viewport:()=>v,now:()=>now,stageFor,slot:()=>({x:250,y:650,w:40,h:40,icon(){}})});
const key='ghostCopy',origin={x:100,y:400,w:160,h:44};
assert(flow.announce(key,origin,'minion',null));
flow.draw(c);assert.equal(made,0);assert(!flow.combatPaused());assert.deepEqual(flow.report().queued,[key]);
ready=true;flow.draw(c);assert.equal(made,1);assert(!flow.combatPaused());assert.deepEqual(flow.report().queued,[key]);
now=1000;flow.draw(c);assert.equal(made,1);
now=1500;flow.draw(c);assert.equal(made,2);assert(flow.combatPaused());
for(let n=0;n<17;n++){now+=70;flow.draw(c);}
assert.equal(draws,1);assert.equal(dispose,1);assert.deepEqual(flow.report().queued,[key]);assert(!flow.playing());assert.equal(g.robotGuideApprovedSeenBN,undefined);
now+=3000;flow.draw(c);assert.equal(made,3);assert(flow.combatPaused());
for(let n=0;n<46;n++){now+=70;flow.draw(c);}
assert.equal(g.robotGuideApprovedSeenBN,16);assert(!flow.playing());assert(steps>0);assert.equal(dispose,2);
flags.off=false;assert(!flow.announce('ghostRelocate',origin));assert(!flow.combatPaused());
console.log(JSON.stringify({assetPendingNoPause:true,createRetainedAfterFail:made,renderRetainedAfterFail:draws,disposed:dispose,naturalSeen:g.robotGuideApprovedSeenBN,multiplayerNeverPauses:true}));
