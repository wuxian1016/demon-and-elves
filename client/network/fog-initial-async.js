'use strict';
// Initial/changed-scope preparation. Only returns a complete privately built store.
// Callers keep it private until presentation validation and generation checks pass.
const {FogRasterStore:BaseStore,COLS,ROWS,CELLS}=require('./fog-raster-store');
const {isOwnedVision}=require('./trusted-vision');
const preparations=new WeakMap();
function cancelled(){const e=Error('FOG_PREPARATION_CANCELLED');e.cancelled=true;return e;}
function stale(){const e=Error('FOG_PREPARATION_STALE');e.retryable=true;return e;}
function sameScope(a,b){return a.roomId===b.roomId&&a.epoch===b.epoch&&a.viewerOwnerId===b.viewerOwnerId;}
class FogRasterStore extends BaseStore{
 static prepareInitialAsync(vision,scope,options){return prepareInitialAsync(vision,scope,options);}
 applyValidated(vision,scope){preparations.delete(this);return super.applyValidated(vision,scope);}
 dispose(){preparations.delete(this);super.dispose();}
}
function releasePreparation(store){return preparations.delete(store);}
function preparedFor(store){const p=preparations.get(store);if(!p||store.disposed)return null;if(!p.keepGoing()){store.dispose();throw cancelled();}if(!sameScope(p.scopeSource,p.target.scope)){store.dispose();throw stale();}return p.target;}
async function prepareInitialAsync(vision,scope,{clock=()=>Date.now(),sliceMs=4,schedule=fn=>setTimeout(fn,0),keepGoing=()=>true,onProgress=()=>{},onSlice=()=>{}}={}){
 // Check cancellation before touching packet/scope properties.
 if(!keepGoing())throw cancelled();
 if(!isOwnedVision(vision))throw Error('FOG_PREPARATION_REQUIRES_OWNED_VISION');
 if(!scope||typeof scope.roomId!=='string'||!scope.roomId||!Number.isSafeInteger(scope.epoch)||scope.epoch<1||typeof scope.viewerOwnerId!=='string'||!scope.viewerOwnerId)throw Error('INVALID_FOG_IDENTITY');
 if(typeof clock!=='function'||typeof schedule!=='function'||!Number.isFinite(sliceMs)||sliceMs<=0)throw Error('INVALID_FOG_PREPARATION_OPTIONS');
 const id=Object.freeze({roomId:scope.roomId,epoch:scope.epoch,viewerOwnerId:scope.viewerOwnerId}),candidate=new FogRasterStore();
 const check=()=>{if(!keepGoing())throw cancelled();if(!sameScope(scope,id))throw stale();};
 const yieldTask=()=>new Promise((resolve,reject)=>{try{schedule(()=>{try{check();resolve();}catch(e){reject(e);}});}catch(e){reject(e);}});
 const report=(phase,started,work,extra={})=>onSlice({phase,durationMs:Math.max(0,clock()-started),work,...extra});
 async function runRows(key){
  const rows=vision[key],map=key==='visible'?candidate.visibleRows:candidate.exploredRows,buffer=candidate[key];
  onProgress({stage:key,done:0,total:rows.length});check();await yieldTask();let started=clock(),work=0,cells=0;
  for(let n=0;n<rows.length;n++){
   const row=rows[n];map.set(row[0],row);const base=row[0]*COLS;
   for(let i=1;i<row.length;i+=2){buffer.fill(1,base+row[i],base+row[i+1]);cells+=row[i+1]-row[i];}
   work++;check();
   if(n+1<rows.length&&clock()-started>=sliceMs){report('fog-'+key,started,work,{cellsWritten:cells});onProgress({stage:key,done:n+1,total:rows.length});check();await yieldTask();started=clock();work=0;cells=0;}
  }
  report('fog-'+key,started,work,{cellsWritten:cells});onProgress({stage:key,done:rows.length,total:rows.length});check();
 }
 try{
  onProgress({stage:'allocation',done:0,total:2});check();
  // One native allocation cannot itself yield. Keep them in separate macrotasks and measure each.
  for(let i=0;i<2;i++){await yieldTask();const started=clock();candidate[i?'explored':'visible']=new Uint8Array(CELLS);report('fog-allocate',started,1,{allocatedBytes:CELLS});onProgress({stage:'allocation',done:i+1,total:2});check();}
  await runRows('visible');await runRows('explored');
  onProgress({stage:'sources',done:0,total:vision.sources.length});check();await yieldTask();let started=clock(),work=0;
  for(let i=0;i<vision.sources.length;i++){
   const source=vision.sources[i],copy={x:source.x,y:source.y,range:source.range,fixed:!!source.fixed};candidate.sources.push(copy);if(copy.fixed)candidate.fixedSources.push(copy);work++;check();
   if(i+1<vision.sources.length&&clock()-started>=sliceMs){report('fog-sources',started,work);onProgress({stage:'sources',done:i+1,total:vision.sources.length});check();await yieldTask();started=clock();work=0;}
  }
  report('fog-sources',started,work);onProgress({stage:'sources',done:vision.sources.length,total:vision.sources.length});check();
  await yieldTask();started=clock();candidate.identity=id;candidate.rasterRevision=1;candidate.visionRevision=1;candidate.fixedKey={};
  const target=Object.freeze({vision,scope:id});preparations.set(candidate,{target,scopeSource:scope,keepGoing});report('fog-finalize',started,1);check();return candidate;
 }catch(e){candidate.dispose();throw e;}
}
module.exports={FogRasterStore,prepareInitialAsync,preparedFor,releasePreparation};
