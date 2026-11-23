const path=require('node:path'),a=require('node:assert/strict'),r=process.argv[2],mode=process.argv[3];
const {create}=require(path.join(r,'network/card-effects-bridge'));
const make=(n,type='warehouse')=>Array.from({length:n},(_,i)=>({x:500*(i+1),y:1000,radius:30,type}));
let low=false, owner, m;
const s={time:0},g={camera:{x:0,y:0},buildings:make(180)};
const fx=create({game:g,controller:{core:{authority:()=>true,modifiers:()=>m,state:s}},createCanvas:()=>{throw Error('Test fallback no canvas')},enabled:()=>true,constrained:()=>low});
let observed;
const c={save(){},restore(){},fillRect(x,y,w,h){observed.add(Math.floor((x+250)/500))}}, inView=(x,y,p)=>x>0&&x<500*181;
function frame(t){s.time=t;observed=new Set();fx.draw(c,inView,[],false,g.buildings);return {seen:observed,stats:fx.stats()};}
function sweep(n,m0,low0){g.buildings=make(n,'tower');m=m0;low=low0;const union=new Set(),shots=[];
 for(let t=0;t<Math.ceil(n/(low?48:144))*420;t+=420){const q=frame(t);shots.push(q.seen.size);a(q.stats.draws<=q.stats.max);for(const x of q.seen)union.add(x);}
 if(mode==='new'){a.equal(union.size,n);if(n<=qcap())for(const x of shots)a.equal(x,n);}
 return {n,low,union:union.size,shots};
}
function qcap(){return low?48:144}
const fort={attack:1,armor:2,maxHp:2,harvest:1};
const cases=[sweep(18,fort,false),sweep(144,fort,false),sweep(145,fort,false),sweep(180,fort,true),sweep(48,fort,true),sweep(49,fort,true)];
g.buildings=[...make(3,'warehouse'),{x:3500,y:1000,type:'wall',ownerSlot:1},{x:4000,y:1000,type:'wall',buildTime:300,buildProgress:100},{x:100000,y:1000,type:'wall'},{x:4500,y:1000,type:'wall',dead:true},{x:5000,y:1000,type:'wall',preview:true}];
const x=frame(0);
if(mode==='new') a.deepEqual(Array.from(x.seen).sort(),[1,2,3]);
console.log(JSON.stringify({mode,cases,exclusions:[...x.seen],stats:x.stats}));
