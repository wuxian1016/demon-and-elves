'use strict';
// Render-only state. No simulation, save, or input state is written here.
const DIR_ENTER=-.67,DIR_EXIT=-.50,TIMEOUT_MS=8000,LOAD_START_SEC=30,RETRY_SEC=35,SWEEP_SEC=1,PREFETCH_SEC=20,MAMMOTH=3;
const files=[
 ['stone-1.webp.bin',160,8,3],['stone-2.webp.bin',160,8,3],['stone-3.webp.bin',160,8,3],['mammoth.webp.bin',168,4,2]
];
const validStage=n=>Number.isInteger(n)&&n>=0&&n<=2;
function unload(im){
 if(!im)return;
 try{im.onload=im.onerror=null;im.src='';}catch(_){}
}
function loadRearArt({Image,loadPackage,canWarm=()=>true,after=setTimeout,clear=clearTimeout}){
 const resident=[null,null,null,null];
 let mask=0,pending=null,pendingKey=-1,packageReady=false;
 function within(run){return new Promise((resolve,reject)=>{let done=false;const finish=(ok,v)=>{if(done)return;done=true;clear(timer);ok?resolve(v):reject(v);};
  const timer=after(()=>finish(false,Error('rear motion timeout')),TIMEOUT_MS);
  Promise.resolve().then(run).then(v=>finish(true,v),e=>finish(false,e));
 });}
 function read([name,cell,cols,rows]){
  return new Promise((resolve,reject)=>{
   const im=new Image();let done=false;
   const finish=error=>{if(done)return;done=true;clear(timer);im.onload=im.onerror=null;if(error){unload(im);reject(error);}else resolve(im);};
   const timer=after(()=>finish(Error('rear image timeout: '+name)),TIMEOUT_MS);
   im.onload=()=>finish(im.width===cell*cols&&im.height===cell*rows?null:Error('rear image dimensions: '+name));
   im.onerror=()=>finish(Error('rear image unavailable: '+name));
   try{im.src='monster-rear-motion/'+name;}catch(error){finish(error);}
  });
 }
 function warm(key,stillWanted=()=>true){
  if(resident[key])return Promise.resolve(resident[key]);
  if(pending)return pendingKey===key?pending:Promise.resolve(null);
  if(!files[key]||typeof Image!=='function'||typeof loadPackage!=='function')return Promise.resolve(null);
  pendingKey=key;
  pending=(async()=>{
   if(!packageReady){await within(loadPackage);packageReady=true;}
   if(!canWarm()||!stillWanted())return null;
   const image=await read(files[key]);
   if(!stillWanted()){unload(image);return null;}
   resident[key]=image;mask|=1<<key;return image;
  })().finally(()=>{pendingKey=-1;pending=null;});
  return pending;
 }
 function retain(bits){
  const drop=mask&~bits;
  if(!drop)return;
  for(let id=0;id<resident.length;id++)if(drop&(1<<id)){
   const im=resident[id];resident[id]=null;unload(im);
  }
  mask&=bits;
 }
 return {warm,retain,get(key){return resident[key];},get mask(){return mask;}};
}
function install(g,{loader,offline=()=>false,runtime}){
 let states=new WeakMap(),owner=g.troll,stageSeen=-1,wanted=0,required=0,prewarmed=0,dirty=true,nextSweep=LOAD_START_SEC,inFlight=false,lastNow=0;
 const tries=[0,0,0,0],next=[0,0,0,0];
 const stageNow=()=>g.waveMonsterStageBN?.()??(g.troll?.dragonEvolved?2:g.troll?.evolved?1:0);
 const canRenderSession=()=>offline()===true&&!g.roundStarting&&!g.tutorial&&!g.superChallenge580&&['prep','hunt'].includes(g.state);
 const actorKey=h=>h.waveStone?h.stoneStats?.stage:MAMMOTH;
 function settleStone(h,q,frame,walking){
  const phase=h.stoneStats?.stage;
  if(q?.north&&validStage(q.key)&&validStage(phase)&&phase!==q.key&&(!walking||frame<=1)&&loader.get(phase))q.key=phase;
 }
 const stoneFrame=h=>Math.floor((h.stoneWalkElapsed||0)/62.5)%24;
 function visiblePhases(current){
  let bits=(1<<current)|(1<<MAMMOTH);
  for(const h of g.hounds||[]){
   if(h.dead||!h.waveStone)continue;
   const actual=h.stoneStats?.stage,q=states.get(h);
   // Offscreen/inactive drawn shape must not retain an old allocation forever.
   // Stop/cast admits a neutral attachment; a moving actor only changes on the actual gait seam.
   if(q&&q.key!==actual)settleStone(h,q,stoneFrame(h),h.stoneWalking);
   const shown=q?.key;
   if(validStage(actual))bits|=1<<actual;
   // A live actor can still be rendering its old palette while its new phase decodes.
   if(validStage(shown))bits|=1<<shown;
  }
  for(const entry of g.stonePending||[]){const phase=entry.stats?.stage;if(validStage(phase))bits|=1<<phase;}
  return bits;
 }
 function readyJob(){
  if(!canRenderSession())return;
  const sec=g.waveElapsed||0,stage=stageNow(),changed=owner!==g.troll||sec<lastNow;
  lastNow=sec;
  if(changed){owner=g.troll;tries.fill(0);next.fill(0);prewarmed=0;dirty=true;states=new WeakMap();}
  if(sec<LOAD_START_SEC&&!changed)return;
  if(!dirty&&stageSeen===stage&&sec<nextSweep)return;
  dirty=false;stageSeen=stage;nextSweep=sec+SWEEP_SEC;
  required=visiblePhases(stage);
  const constrained=runtime?.memoryConstrained?.()===true;
  const hunt=g.huntElapsed||0,deadline=g.monsterRearPrewarmDeadlineBN?.(stage);
  // One forecast only. Never chase broad timelines or cache more than the next stage.
  const visible=required&7;
  const roomForForecast=(visible&(visible-1))===0;
  const forecast=roomForForecast&&stage<2&&!g.troll?.dead&&!constrained&&Number.isFinite(deadline)&&hunt>=deadline-PREFETCH_SEC&&hunt<=deadline?1<<(stage+1):0;
  const speculative=forecast&~required;
  wanted=required|speculative;
  loader.retain(wanted);
  if(sec<LOAD_START_SEC||inFlight||runtime?.hidden||constrained||g.sessionMenuOpen)return;
  const liveNeeded=required&~loader.mask,forecastNeeded=speculative&~loader.mask&~prewarmed;
  let key=-1;
  const select=id=>{if(key<0&&(liveNeeded&(1<<id))&&tries[id]<3&&sec>=next[id])key=id;};
  select(stage);select(MAMMOTH);for(let i=0;i<3;i++)select(i);
  if(key<0&&forecastNeeded){key=stage+1;prewarmed|=1<<key;}
  if(key<0)return;
  const focus=1<<key;
  if(required&focus){tries[key]++;next[key]=sec+RETRY_SEC;}
  inFlight=true;
  void loader.warm(key,()=>!!(wanted&focus)&&canRenderSession()&&(required&focus||!runtime?.memoryConstrained?.()))
   .catch(error=>{try{runtime?.diagnosticEvent?.('rear-motion-fallback',String(error?.message||error));}catch(_){}})
   .finally(()=>{inFlight=false;dirty=true;});
 }
 const baseline=g.update;
 g.update=function(dt){const result=baseline.apply(this,arguments);readyJob();return result;};
 function observe(h,dx,dy){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)+Math.abs(dy)<=.01)return;
  let q=states.get(h);const f=dy/Math.hypot(dx,dy);
  if(q?.north){
   if(f>DIR_EXIT){q.north=false;q.key=-1;}
   else if(h.waveStone&&q.key!==h.stoneStats?.stage)settleStone(h,q,stoneFrame(h),true);
   return;
  }
  if(f>DIR_ENTER)return;
  if(!q){q={north:false,key:-1};states.set(h,q);}
  const key=actorKey(h);q.north=true;q.key=loader.get(key)?key:-1;
 }
 function atlas(ctx,image,cell,cols,frame,x,top,width=cell){
  if(!image?.width||!Number.isFinite(x)||!Number.isFinite(top))return false;
  ctx.drawImage(image,(frame%cols)*cell,(frame/cols|0)*cell,cell,cell,x-width/2,top,width,width);return true;
 }
 return {
  observe,
  drawStone(ctx,b,phase,frame,walking){
   const q=states.get(b);if(!q?.north||!validStage(q.key))return false;
   // A natural evolution may replace stats in-place. A late phase swaps at a foot-aligned seam,
   // not in the middle of a step; other directions and combat still use the original phase art.
   if(phase!==q.key)settleStone(b,q,frame,walking);
   return atlas(ctx,loader.get(q.key),160,8,walking?frame:0,b.x,b.y-136);
  },
  drawMammoth(ctx,h,x,y,frame,walking,shade,visualScale=1,armor=null){
   const q=states.get(h),sheet=loader.get(MAMMOTH);
   if(!q?.north||q.key!==MAMMOTH||!sheet?.width)return false;
   ctx.save();try{
    ctx.imageSmoothingEnabled=true;
    if(shade?.width)ctx.drawImage(shade,x-73*visualScale,y-16*visualScale,146*visualScale,38*visualScale);
    const width=168*visualScale;
    const i=walking?frame:3,top=y-430/512*width;
    const drawn=atlas(ctx,sheet,168,4,i,x,top,width);
    if(drawn&&armor?.width===672&&armor?.height===336)atlas(ctx,armor,168,4,i,x,top,width);
    return drawn;
   }finally{ctx.restore();}
  },
  trimSpeculative(){
   required=visiblePhases(stageNow());wanted=required;loader.retain(required);dirty=true;
  },
  get atlasMask(){return loader.mask;}
 };
}
module.exports={loadRearArt,install};
