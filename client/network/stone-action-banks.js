'use strict';
const read=require('./native-image-decode');
const WALK=6, PHASE=18, N=PHASE*3+1, ROCK=N-1;
const BYTE_CAP=6*1024*1024, cellOf=i=>i===ROCK?0:i%PHASE<WALK?256:181;
const key=(phase,walking,frame)=>phase*PHASE+(walking?0:WALK)+(frame>>2);
const initial=phase=>[key(phase,true,0),key(phase,true,4),key(phase,false,0),key(phase,false,24),ROCK];
const pose=a=>{const action=a.stoneAction,w=!action&&a.stoneWalking;return [w,w?Math.floor((a.stoneWalkElapsed||0)/62.5)%24:action?(action.kind==='throw'?24:0)+Math.min(23,Math.floor(action.age/62.5)):0];};
const bytesOf=i=>i===ROCK?384*288*4:16*cellOf(i)**2;
const source=i=>{
 if(i===ROCK)return 'stone-art/stone-rock.webp.bin';
 const phase=(i/PHASE|0)+1,local=i%PHASE,walking=local<WALK,n=walking?local:local-WALK;
 return 'stone-art/'+(walking?'walk':'attack')+'-phase'+phase+'-bank'+String(n).padStart(2,'0')+'.webp.bin';
};
const norm=(i,n)=>(i%n+n)%n;
exports.create=function(Image,runtime,loadPackage,clock=Date.now){
 const entries=Array.from({length:N},()=>null),urgent=new Float64Array(N),prefetch=new Float64Array(N),lastUse=new Float64Array(N),backoff=new Float64Array(N);
 urgent.fill(-Infinity);prefetch.fill(-Infinity);lastUse.fill(-Infinity);
 let used=0,pack=null,doing=-1,stopped=false,booting=false,assetEpoch=0,peak=0,coldMs=0,supply=0,misses=0,repeated=0,emergency=0,decode=0,evictions=0,pkgReads=0;
 const recent=new WeakMap();let boots=[],bootMask=new Uint8Array(N),stageUI=0,lastDrawPhase=0;
 const dwell=38;
 function dropped(i){
  const im=entries[i];if(!im)return;
  entries[i]=null;used-=bytesOf(i);evictions++;try{im.src='';}catch(_){}
 }
 function trimFor(n,now,first){
  while(used+n>BYTE_CAP){
   let at=-1,age=Infinity;
   for(let i=0;i<N;i++){
    if(!entries[i]||i===ROCK||i===key(lastDrawPhase,false,0)||i===key(lastDrawPhase,false,24)||booting&&bootMask[i])continue;
    // Protect banks currently visible, not stale prefetched pages.
    if(!first&&urgent[i]+45>=now)continue;
    if(lastUse[i]<age){age=lastUse[i];at=i;}
   }
   if(at<0)return false;
   dropped(at);
  }
  return true;
 }
 function need(i,seen=false){
  const now=clock();(seen?urgent:prefetch)[i]=now;
  if(entries[i]&&seen)lastUse[i]=now;
 }
 function queueFirst(phase,saved=null){
  if(!booting||stageUI!==phase||saved){
   stageUI=phase;booting=true;boots=initial(phase);
   if(saved)for(const a of saved)if(a.waveStone&&!a.dead){
    const stage=a.stoneStats?.stage??phase,[walking,f]=pose(a),next=walking?norm(f+2,24):f<24?Math.min(23,f+2):Math.min(47,f+2);
    boots.push(key(stage,walking,f),key(stage,walking,next),key(stage,false,0),key(stage,false,24));
   }
   bootMask.fill(0);boots=[...new Set(boots)];for(const i of boots)bootMask[i]=1;
  }
  for(const i of boots)if(!entries[i])need(i,true);
 }
 function ready(phase){return initial(phase).every(i=>!!entries[i]);}
 function bootReady(){return boots.length>0&&boots.every(i=>!!entries[i]);}
 function stopFirst(){booting=false;bootMask.fill(0);}
 function visiblePhase(wanted){
  if(lastDrawPhase!==wanted&&ready(wanted)&&(!(booting&&stageUI===wanted)||bootReady()))lastDrawPhase=wanted;
  return lastDrawPhase;
 }
 async function restore(phase,saved){
  stopped=false;lastDrawPhase=phase;queueFirst(phase,saved);
  if(boots.reduce((n,i)=>n+bytesOf(i),0)>BYTE_CAP){stopFirst();throw Error('Stone bank: saved actors exceed bounded working set');}
  const end=clock()+8500;
  while(!bootReady()&&clock()<end){pump();await new Promise(r=>setTimeout(r,8));}
  if(!bootReady())throw Error('Stone bank: saved page read not ready');
  stopFirst();
 }
 function park(){
  stopped=true;booting=false;
  urgent.fill(-Infinity);prefetch.fill(-Infinity);
 }
 function pump(){
  if(runtime.hidden||doing>=0||stopped||!Number.isFinite(clock()))return;
  const now=clock();if(now<coldMs+dwell)return;
  let chosen=-1,score=-Infinity;
  for(let i=0;i<N;i++){
   if(entries[i]||now<backoff[i])continue;
   const pri=booting&&bootMask[i]?3:urgent[i]+100>=now?2:prefetch[i]+260>=now?1:0;
   if(!pri||pri<=score)continue;
   chosen=i;score=pri;
  }
  if(chosen<0||!trimFor(bytesOf(chosen),now,booting))return;
  doing=chosen;coldMs=now;const generation=assetEpoch;
  if(!pack){pkgReads++;pack=Promise.resolve().then(loadPackage).catch(e=>{pack=null;throw e;});}
  pack.then(async()=>{
   if(runtime.hidden||stopped||generation!==assetEpoch)return;
   const im=new Image(),n=cellOf(chosen),current=()=>!stopped&&generation===assetEpoch;
   const image=await read(im,source(chosen),8000,current);
   if(!image||!current())return;
   if(chosen===ROCK?image.width!==384||image.height!==288:image.width!==4*n||image.height!==n)throw new Error('Stone bank dimensions');
   entries[chosen]=im;used+=bytesOf(chosen);lastUse[chosen]=clock();decode++;peak=Math.max(peak,used);
  }).catch(()=>{backoff[chosen]=clock()+650;}).finally(()=>{doing=-1;});
 }
 function frame(actor,phase,walking,i,isIdle){
  const j=key(phase,walking,i);need(j,true);
  if(!walking&&(actor.stoneAction?.age||0)>=1300){
   need(key(phase,true,Math.floor((actor.stoneWalkElapsed||0)/62.5)%24));
  }
  if(!isIdle){
   const next=walking?norm(i+2,24):i<24?Math.min(23,i+2):Math.min(47,i+2);
   if(next!==i)need(key(phase,walking,next));
  }
  const kind=walking?0:i<24?1:2, previous=recent.get(actor);
  const exact=entries[j];
  if(exact){
   supply++;
   if(previous){previous.key=j;previous.col=i&3;previous.kind=kind;}
   else recent.set(actor,{key:j,col:i&3,kind});
   return [exact,i&3];
  }
  misses++;
  if(previous?.kind===kind&&Math.floor(previous.key/PHASE)===phase&&entries[previous.key]){
   repeated++;lastUse[previous.key]=clock();return [entries[previous.key],previous.col];
  }
  emergency++;
  // On missing art use the nearest loaded *genuine frame of this same authored action*;
  // report this as a miss, never let it look like full-cadence success.
  const lo=phase*PHASE+(walking?0:i<24?WALK:WALK+6), hi=lo+6;
  for(let n=1;n<=5;n++)for(const a of [j-n,j+n])if(a>=lo&&a<hi&&entries[a])return [entries[a],a<j?3:0];
  const idle=key(phase,false,0);if(entries[idle])return [entries[idle],0,181];
  return null;
 }
 return {ready,queueFirst,stopFirst,visiblePhase,restore,restart(){stopped=false;},park,pump,frame,get rock(){need(ROCK,true);return entries[ROCK];},clear(){park();assetEpoch++;for(let i=0;i<N;i++)dropped(i);},report:()=>({used,peak,doing,decode,supply,misses,repeated,emergency,evictions,pkgReads})};
};
