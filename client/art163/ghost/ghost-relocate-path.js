'use strict';
// Escape proof: game-native terrain sweeps and live building collision, apart from active AI jobs.
const STEP=42,DIR=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
function* search(g,p,body,bounds){
 const home=g.trollBase,r=body.radius;
 if(!home||home.dead||!bounds||!g.demonLineBlocked||!g.slimeBlockingBuilding410)return false;
 const probe={radius:r},w=bounds.width,h=bounds.height;
 const free=q=>q.x>=r&&q.y>=r&&q.x<=w-r&&q.y<=h-r&&!g.terrainCollisionAt(q.x,q.y,r);
 const edge=(a,b)=>!g.demonLineBlocked(a,b,r+3,true)&&!g.slimeBlockingBuilding410(probe,a,b);
 const end={x:home.x,y:home.y},distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function* nativeReturn(){
  if(home.inSupplyRange(p))return true;
  if(!g.demonReturnPathSteps)return null;
  const q=g.demonReturnPathSteps(p,end,r);
  for(let i=0;i<44000;i++){
   yield;const z=q.next();if(z.done)return z.value?.length>0;
  }
  return null;
 }
 if(free(end)){
  let a=p,ok=true,clear=true;
  const k=Math.ceil(distance(p,end)/STEP);
  for(let i=1;i<=k;i++){yield;const b={x:p.x+(end.x-p.x)*i/k,y:p.y+(end.y-p.y)*i/k};if(!edge(a,b)){ok=false;break;}if(clear&&g.demonLineBlocked(a,b,r))clear=false;a=b;}
  if(ok)return clear?true:yield*nativeReturn();
 }
 const open=[],seen=new Set(),cols=Math.ceil(w/STEP),rows=Math.ceil(h/STEP);
 const push=(x,y,a,n)=>{
  if(x<0||x>=cols||y<0||y>=rows)return;
  const key=y*cols+x;
  if(seen.has(key))return;
  const q={x:x*STEP+STEP/2,y:y*STEP+STEP/2,cx:x,cy:y,n};
  if(!free(q)||!edge(a,q))return;
  seen.add(key);q.f=n+1.8*distance(q,end)/STEP;
  let i=open.length;open.push(q);
  while(i>0){const j=(i-1)>>1;if(open[j].f<=q.f)break;open[i]=open[j];i=j;}
  open[i]=q;
 };
 const pop=()=>{
  const q=open[0],last=open.pop();let i=0;
  if(open.length){while(i*2+1<open.length){let j=i*2+1;if(j+1<open.length&&open[j+1].f<open[j].f)j++;if(open[j].f>=last.f)break;open[i]=open[j];i=j;}open[i]=last;}
  return q;
 };
 const x=Math.floor(p.x/STEP),y=Math.floor(p.y/STEP);
 push(x,y,p,0);
 for(const [dx,dy] of DIR){yield;push(x+dx,y+dy,p,1);}
 for(let i=0;open.length&&i<3600;i++){
  const a=pop();
  if(home.inSupplyRange(a))return yield*nativeReturn();
  for(const [dx,dy] of DIR){yield;push(a.cx+dx,a.cy+dy,a,a.n+1);}
 }
 return open.length?null:false;
}
const version=g=>[g.terrainClearEpoch411,g.terrainCollisionEnabled,g.terrainRevision,g.rocks,g.rocks?.length,g.waterPools,g.mountainRanges,g.groundObstacleRevision,g.buildings,g.buildings.length,g.trollBase,g.trollBase?.x,g.trollBase?.y];
function current(g,p,body){return p&&body.radius===p.r&&version(g).every((v,i)=>p.v[i]===v);}
function make(g,p,body,bounds){return{v:version(g),r:body.radius,search:search(g,p,body,bounds)};}
function work(p){
 if(!p||p.ok!==undefined)return;
 const now=()=>globalThis.performance?.now?.()??Date.now(),start=now();
 for(let i=0;i<256&&now()-start<1.1;i++){const s=p.search.next();if(s.done){p.ok=s.value;p.search=null;return;}}
}
module.exports={current,make,work};
