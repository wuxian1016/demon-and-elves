'use strict';
const packetServiceTime=require('./packet-service-time');
// FIFO presentation preparation; callers retain the last committed view while this yields.
// FullGameClient captures before acceptance. Queue onCapture/network-ui.capture
// measures ownership reuse for accepted packets; actual copying is in packetJsMs.
const {isPlainRecord}=require('./plain-record');
const {isOwnedVision,prepareTrustedVision}=require('./trusted-vision');
const fail=code=>{throw Error(code)};
// Private ownership proves only immutable capture, never schema/reference validity.
// Node budgets are retained so DAG reuse cannot bypass depth/value/array bounds.
const ownedNodes=new WeakMap(),ownedPackets=new WeakMap();
function capturePresentationPacket(packet,{maxDepth=32,maxValues=3000000,maxArrayLength=20000}={}){
 const packetProof=packet&&typeof packet==='object'?ownedPackets.get(packet):null;
 const checkProof=(proof,depth,used)=>{
  if(used+proof.values>maxValues)fail('PRESENTATION_CAPTURE_VALUES');
  if(depth+proof.height>maxDepth)fail('PRESENTATION_CAPTURE_DEPTH');
  if(proof.maxArrayLength>maxArrayLength)fail('PRESENTATION_CAPTURE_ARRAY_LENGTH');
 };
 if(packetProof){checkProof(packetProof,0,0);return packet;}
 if(!isPlainRecord(packet))fail('PRESENTATION_CAPTURE_RECORD');
 let values=0;const ancestors=new Set();
 function clone(value,depth,root=false){
  const proof=value&&typeof value==='object'&&!root?ownedNodes.get(value):null;
  if(proof){checkProof(proof,depth,values);values+=proof.values;return value;}
  if(++values>maxValues)fail('PRESENTATION_CAPTURE_VALUES');if(depth>maxDepth)fail('PRESENTATION_CAPTURE_DEPTH');
  if(value===null||typeof value!=='object'){
   if(typeof value==='function')fail('PRESENTATION_CAPTURE_FUNCTION');
   return value;
  }
  if(ancestors.has(value))fail('PRESENTATION_CAPTURE_CYCLE');
  const array=Array.isArray(value);if(array&&value.length>maxArrayLength)fail('PRESENTATION_CAPTURE_ARRAY_LENGTH');
  if(!array){const proto=Object.getPrototypeOf(value);if(proto!==null&&proto!==Object.prototype&&!isPlainRecord(value))fail('PRESENTATION_CAPTURE_RECORD');}
  ancestors.add(value);const out=array?new Array(value.length):Object.create(null),meta={values:1,height:0,maxArrayLength:array?value.length:0};
  for(const key of array?Object.keys(value):Reflect.ownKeys(value)){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!Object.hasOwn(descriptor,'value'))fail(array?'PRESENTATION_CAPTURE_ACCESSOR':'PRESENTATION_CAPTURE_RECORD');
   if(!descriptor.enumerable||typeof key!=='string')continue;
   const raw=descriptor.value;let next;
   if(root&&key==='vision')next=isOwnedVision(raw)?raw:prepareTrustedVision(raw,packet.tick,packet);
   else{next=clone(raw,depth+1);const child=next&&typeof next==='object'?ownedNodes.get(next):null;meta.values+=child?child.values:1;meta.height=Math.max(meta.height,child?child.height+1:1);if(child)meta.maxArrayLength=Math.max(meta.maxArrayLength,child.maxArrayLength);}
   if(array&&key==='__proto__')Object.defineProperty(out,key,{value:next,writable:true,configurable:true,enumerable:true});else out[key]=next;
  }
  ancestors.delete(value);Object.freeze(out);Object.freeze(meta);
  // A root has special vision treatment; it is not a generic reusable subtree.
  (root?ownedPackets:ownedNodes).set(out,meta);return out;
 }
 return packetServiceTime.transfer(packet,clone(packet,0,true));
}
const scopeOf=packet=>JSON.stringify([packet.roomId,packet.viewerOwnerId,packet.epoch,packet.sceneRevision,packet.mapChecksum]);
class AsyncPresentationQueue{
 constructor({prepare,commit,isCurrent=()=>true,capture=capturePresentationPacket,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0)),clock=Date.now,onCapture=()=>{},onError=()=>{},onCommit=()=>{},onDiscard=()=>{},mayReplace=()=>false,mayStartInline=()=>false,coalesce=null,onReplace=()=>{},maxPending=64}){Object.assign(this,{prepare,commit,isCurrent,capture,yieldTask,clock,onCapture,onError,onCommit,onDiscard,mayReplace,mayStartInline,coalesce,onReplace,maxPending});this.queue=[];this.running=null;this.generation=0;this.scope=null;this.lastEnqueued=-1;this.failed=false;this.disposed=false;this.paused=false;this.waiters=[];this.resetObservations();}
 resetObservations(){this.observations={enqueued:0,replaced:0,committed:0,peakPending:0,errors:0};this.replacementBlocks=Object.create(null);}
 observeReplacementBlock(reason){const allowed=['state','events-invalid','feedback-not-retained','focus','warning-boundary','rescue','toast','ceremony'];const key=allowed.includes(reason)?reason:'unknown';this.replacementBlocks[key]=(this.replacementBlocks[key]||0)+1;}
 report(){return {...this.observations,replacementBlocks:{...this.replacementBlocks},pending:this.size,paused:this.paused,failed:this.failed,running:!!this.running};}
 get size(){return this.queue.length+(this.running&&!this.running.cancelled?1:0);}
 valid(job){return !this.disposed&&!this.failed&&!this.paused&&!job.cancelled&&job.generation===this.generation&&job.scope===this.scope&&this.isCurrent(job);}
 enqueue(source,scene){
  if(this.disposed||this.failed)return false;
  // Inspect only data fields for deduplication; a caller-supplied getter or
  // toJSON must never run while deriving scope or capturing the packet.
  if(!isPlainRecord(source)||['roomId','viewerOwnerId','sceneRevision','mapChecksum'].some(k=>!Object.hasOwn(source,k)||typeof source[k]!=='string')||!Object.hasOwn(source,'epoch')||!Number.isSafeInteger(source.epoch)||source.epoch<1||!Object.hasOwn(source,'revision')||!Number.isSafeInteger(source.revision)||source.revision<0){this.error(Error('PRESENTATION_QUEUE_HEADER'));return false;}
  const scope=scopeOf(source);if(this.scope!==scope){const paused=this.paused;this.cancel('scope-change');this.paused=paused;this.scope=scope;}
  if(source.revision<=this.lastEnqueued)return false;
  let packet;const before=this.clock();try{packet=this.capture(source);}catch(error){this.error(error);return false;}finally{try{this.onCapture(Math.max(0,this.clock()-before));}catch(_){}}
  const tail=this.queue[this.queue.length-1];
  let replace=false;
  if(tail&&tail.scene===scene){
   if(typeof this.coalesce==='function'){
    try{const merged=this.coalesce(tail.packet,packet);if(merged){if(merged!==packet)packet=this.capture(merged);replace=true;}}catch(error){this.error(error);return false;}
   }else replace=this.mayReplace(tail.packet,packet);
  }
  if(!replace&&this.size>=this.maxPending){this.error(Error('PRESENTATION_QUEUE_OVERLOAD'));return false;}
  if(replace){this.observations.replaced++;this.queue.pop();try{this.onReplace();}catch(_){}}
  this.lastEnqueued=source.revision;this.queue.push({source,packet,scene,scope,generation:this.generation,cancelled:false,enqueuedAt:before,captureMs:Math.max(0,this.clock()-before)});this.observations.enqueued++;this.observations.peakPending=Math.max(this.observations.peakPending,this.size);void this.pump();return true;
 }
 async pump(){
  if(this.running||this.disposed||this.failed||this.paused)return;
  const job=this.queue.shift();if(!job){this.settle();return;}this.running=job;let plan,committed=false;
  try{
   // Macrotask boundary permits rendering/touch dispatch; microtask-only
   // Promise.resolve yielding would not provide that opportunity.
   if(!this.mayStartInline(job))await this.yieldTask();if(!this.valid(job))return;
   plan=await this.prepare(job.packet,job.scene,()=>this.valid(job),job);
   if(!this.valid(job))return;if(plan==null)throw Error('PRESENTATION_PREPARE_EMPTY');
   // commit must synchronously preflight then install the complete plan.
   const result=this.commit(plan,job.packet,job.scene,job.source);if(result&&typeof result.then==='function')throw Error('PRESENTATION_COMMIT_MUST_BE_SYNC');committed=true;this.observations.committed++;
   try{this.onCommit(job.packet,result,job);}catch(_){}
  }catch(error){if(!this.disposed&&!this.failed&&!job.cancelled&&job.generation===this.generation)this.error(error);}
  finally{if(plan!=null&&!committed)try{this.onDiscard(plan);}catch(_){}if(this.running===job)this.running=null;if(!this.disposed&&!this.failed&&!this.paused&&this.queue.length)void this.pump();else this.settle();}
 }
 pause(){if(this.paused||this.disposed||this.failed)return;this.paused=true;if(this.running&&!this.running.cancelled){const job=this.running;job.cancelled=true;this.queue.unshift({...job,cancelled:false});}}
 resume(){if(this.disposed||this.failed)return;this.paused=false;void this.pump();}
 error(error){if(this.failed||this.disposed)return;this.failed=true;this.observations.errors++;this.generation++;if(this.running)this.running.cancelled=true;this.queue.length=0;try{this.onError(error);}catch(_){}if(!this.running)this.settle();}
 cancel(_reason='cancel'){this.generation++;if(this.running)this.running.cancelled=true;this.queue.length=0;this.lastEnqueued=-1;this.scope=null;this.failed=false;this.paused=false;if(!this.running)this.settle();}
 dispose(){this.cancel('dispose');this.disposed=true;if(!this.running)this.settle();}
 idle(){if(!this.running&&!this.queue.length)return Promise.resolve();return new Promise(resolve=>this.waiters.push(resolve));}
 settle(){if(this.running||this.queue.length)return;for(const resolve of this.waiters.splice(0))resolve();}
}
function isCapturedPresentationNode(value){return !!value&&typeof value==='object'&&ownedNodes.has(value);}
module.exports={AsyncPresentationQueue,capturePresentationPacket,scopeOf,isCapturedPresentationNode};
