const {encodeVisionRows,decodeVisionRows}=require('./vision-row-codec');
const {WORLD_FIELDS,ENTITY_FIELDS}=require('./presentation-schema');
// Transport only: reconstruct a complete authorized keyframe before hydration.
// No partial entity patching, arbitrary writes, or implicit hidden-state retention.
const DELTA_SCHEMA=1;
const fail=()=>{throw Error('PRESENTATION_REBASE_REQUIRED');};
const {isPlainRecord:plain}=require('./plain-record');
const {isCapturedPresentationNode}=require('./presentation-queue');
// Only privately copied, deeply immutable fields can retain this scan proof.
// References are checked against EACH reconstructed entity set, including removals.
// A proof retains the original traversal cost/depth so limits cannot be bypassed.
const referenceProofs=new WeakMap();
const cachedMetadata=new Set(['roster','publicTeamData','publicCombatHud','rescueOffer','events']);
const worldFields=new Set(WORLD_FIELDS),entityFields=new Set(ENTITY_FIELDS);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rowPatch=(before,after)=>{const old=new Map(before.map(row=>[row[0],row])),next=new Map(after.map(row=>[row[0],row])),upserts=after.filter(row=>!same(old.get(row[0]),row)),removed=[...old.keys()].filter(key=>!next.has(key)),packed=encodeVisionRows(old,upserts);return packed.data.length<=666668&&JSON.stringify(packed).length<JSON.stringify(upserts).length?{packed,removed}:{upserts,removed};};
function makePresentationDelta(base,next){
 if(!base||base.schema!==1||next.schema!==1||base.epoch!==next.epoch||base.roomId!==next.roomId||base.viewerOwnerId!==next.viewerOwnerId||base.engineHash!==next.engineHash||base.sceneRevision!==next.sceneRevision||base.revision>=next.revision)return next;
 const old=new Map(base.entities.map(e=>[e.id,e])),current=new Set(next.entities.map(e=>e.id));
 const {entities,vision,...header}=next;
 let visionPatch={full:vision};
 if(base.vision?.version===1&&vision?.version===1&&base.vision.cell===vision.cell&&base.vision.cols===vision.cols&&base.vision.rows===vision.rows){
  const {visible,explored,...meta}=vision;visionPatch={baseRevision:base.vision.revision,meta,visible:rowPatch(base.vision.visible,visible),explored:rowPatch(base.vision.explored,explored)};
 }
 if(visionPatch.visible&&same(visionPatch.visible,visionPatch.explored)){delete visionPatch.explored;visionPatch.exploredReuseVisible=true;}
 const upserts=[],entityPatches=[];for(const e of entities){const prior=old.get(e.id);if(same(prior,e))continue;
  if(prior?.type===e.type){const patch={id:e.id,type:e.type,set:Object.fromEntries(Object.entries(e.fields).filter(([key,value])=>!Object.hasOwn(prior.fields,key)||!same(prior.fields[key],value))),remove:Object.keys(prior.fields).filter(key=>!Object.hasOwn(e.fields,key))};
   if(JSON.stringify(patch).length<JSON.stringify(e).length){entityPatches.push(patch);continue;}}
  upserts.push(e);
 }
 const result={...header,delta:DELTA_SCHEMA,baseRevision:base.revision,upserts,...(entityPatches.length?{entityPatches}:{}),removed:base.entities.filter(e=>!current.has(e.id)).map(e=>e.id),visionPatch};
 const worldPatch={set:Object.fromEntries(Object.entries(next.worldView).filter(([key,value])=>!Object.hasOwn(base.worldView,key)||!same(base.worldView[key],value))),remove:Object.keys(base.worldView).filter(key=>!Object.hasOwn(next.worldView,key))};
 if(JSON.stringify(worldPatch).length<JSON.stringify(next.worldView).length){delete result.worldView;result.worldPatch=worldPatch;}
 const unchanged=[];for(const key of cachedMetadata)if(Object.hasOwn(base,key)&&Object.hasOwn(next,key)&&same(base[key],next[key])){delete result[key];unchanged.push(key);}if(unchanged.length)result.unchanged=unchanged;
 // Dense changes should use a keyframe, not a larger delta.
 return JSON.stringify(result).length<JSON.stringify(next).length?result:next;
}
function patchRows(before,patch,rows,cols){
 if(plain(patch)&&Object.hasOwn(patch,'packed')){if(Object.keys(patch).some(k=>!['packed','removed'].includes(k))||Object.hasOwn(patch,'upserts'))fail();patch={upserts:decodeVisionRows(before,patch.packed,rows,cols),removed:patch.removed};}
 if(!plain(patch)||!Array.isArray(patch.upserts)||!Array.isArray(patch.removed)||patch.upserts.length>rows||patch.removed.length>rows)fail();
 const result=new Map(before.map(row=>[row[0],row])),touched=new Set();
 for(const id of patch.removed){if(!Number.isInteger(id)||id<0||id>=rows||touched.has(id)||!result.has(id))fail();touched.add(id);result.delete(id);}
 for(const row of patch.upserts){if(!Array.isArray(row)||row.length<3||row.length%2!==1||!Number.isInteger(row[0])||row[0]<0||row[0]>=rows||touched.has(row[0]))fail();let end=-1;for(let i=1;i<row.length;i+=2){if(!Number.isInteger(row[i])||!Number.isInteger(row[i+1])||row[i]<0||row[i]<end||row[i+1]<=row[i]||row[i+1]>cols)fail();end=row[i+1];}touched.add(row[0]);result.set(row[0],row);}
 return [...result.values()].sort((a,b)=>a[0]-b[0]);
}
function applyPresentationDelta(base,delta,visionDecoder=null){
 if(!plain(delta)||delta.delta!==DELTA_SCHEMA||delta.schema!==1||!base||base.delta||delta.baseRevision!==base.revision||delta.revision<=base.revision||delta.epoch!==base.epoch||delta.roomId!==base.roomId||delta.viewerOwnerId!==base.viewerOwnerId||delta.engineHash!==base.engineHash||delta.sceneRevision!==base.sceneRevision)fail();
 if(!Array.isArray(delta.upserts)||delta.upserts.length>50000||!Array.isArray(delta.removed)||delta.removed.length>50000||(!plain(delta.worldView)&&!plain(delta.worldPatch))||!plain(delta.visionPatch))fail();
 let worldView=delta.worldView;
 if(Object.hasOwn(delta,'worldPatch')){
  if(Object.hasOwn(delta,'worldView')||!plain(base.worldView))fail();const patch=delta.worldPatch;
  if(!plain(patch)||Object.keys(patch).some(key=>!['set','remove'].includes(key))||!plain(patch.set)||!Array.isArray(patch.remove)||patch.remove.length>worldFields.size)fail();
  worldView={...base.worldView};const touched=new Set();for(const key of patch.remove){if(!worldFields.has(key)||touched.has(key)||!Object.hasOwn(worldView,key))fail();touched.add(key);delete worldView[key];}
  for(const [key,value]of Object.entries(patch.set)){if(!worldFields.has(key)||touched.has(key))fail();touched.add(key);worldView[key]=value;}
 }
 const entities=new Map(base.entities.map(e=>[e.id,e])),touched=new Set();
 for(const id of delta.removed){if(typeof id!=='string'||touched.has(id)||!entities.has(id))fail();touched.add(id);entities.delete(id);}
 for(const e of delta.upserts){if(!plain(e)||typeof e.id!=='string'||!e.id.length||e.id.length>96||!plain(e.fields)||typeof e.type!=='string'||touched.has(e.id))fail();touched.add(e.id);entities.set(e.id,e);}
 if(delta.entityPatches!==undefined){if(!Array.isArray(delta.entityPatches)||delta.entityPatches.length>50000)fail();for(const patch of delta.entityPatches){
  if(!plain(patch)||Object.keys(patch).some(k=>!['id','type','set','remove'].includes(k))||typeof patch.id!=='string'||touched.has(patch.id)||!plain(patch.set)||!Array.isArray(patch.remove)||patch.remove.length>entityFields.size)fail();
  const prior=entities.get(patch.id);if(!prior||prior.type!==patch.type)fail();touched.add(patch.id);const fields={...prior.fields},keys=new Set();
  for(const key of patch.remove){if(!entityFields.has(key)||keys.has(key)||!Object.hasOwn(fields,key))fail();keys.add(key);delete fields[key];}
  for(const [key,value]of Object.entries(patch.set)){if(!entityFields.has(key)||keys.has(key))fail();keys.add(key);fields[key]=value;}
  entities.set(patch.id,{...prior,fields});
 }}
 if(entities.size>50000)fail();
 let vision;const patch=delta.visionPatch;
 if(visionDecoder){vision=visionDecoder(base.vision,patch,delta.tick,delta);}
 else if(Object.hasOwn(patch,'full')){if(Object.keys(patch).length!==1)fail();vision=patch.full;}
 else {if(Object.hasOwn(patch,'exploredReuseVisible')&&(patch.exploredReuseVisible!==true||Object.hasOwn(patch,'explored')))fail();if(patch.baseRevision!==base.vision?.revision||!plain(patch.meta)||patch.meta.version!==1||!Number.isSafeInteger(patch.meta.revision)||patch.meta.revision<base.vision.revision||patch.meta.cell!==base.vision.cell||patch.meta.rows!==base.vision.rows||patch.meta.cols!==base.vision.cols)fail();vision={...patch.meta,visible:patchRows(base.vision.visible,patch.visible,patch.meta.rows,patch.meta.cols),explored:patchRows(base.vision.explored,patch.exploredReuseVisible?patch.visible:patch.explored,patch.meta.rows,patch.meta.cols)};}
 const {delta:version,baseRevision,upserts,entityPatches,removed,visionPatch,worldPatch,unchanged=[],...header}=delta;
 if(!Array.isArray(unchanged)||unchanged.length>cachedMetadata.size||new Set(unchanged).size!==unchanged.length)fail();for(const key of unchanged){if(!cachedMetadata.has(key)||Object.hasOwn(header,key)||!Object.hasOwn(base,key))fail();header[key]=base[key];}
 const full={...header,worldView,entities:[...entities.values()],vision};
 // Reject dangling references before any caller can render the reconstructed view.
 let budget=500000;const refs=value=>{
  const proof=value&&typeof value==='object'?referenceProofs.get(value):null;
  if(proof){budget-=proof.values;if(budget<0||proof.height>10)fail();for(const id of proof.references)if(!entities.has(id))fail();return;}
  const owned=isCapturedPresentationNode(value),references=[],start=budget;let height=0;
  const walk=(node,depth=0)=>{if(--budget<0||depth>10)fail();height=Math.max(height,depth);if(!node||typeof node!=='object')return;if(Array.isArray(node)){for(const v of node)walk(v,depth+1);return;}if(Object.hasOwn(node,'ref')){if(Object.keys(node).length!==1||!entities.has(node.ref))fail();if(owned)references.push(node.ref);return;}for(const key of Object.keys(node)){if(key==='__proto__'||key==='prototype'||key==='constructor')fail();walk(node[key],depth+1);}};
  walk(value);if(owned)referenceProofs.set(value,{values:start-budget,height,references});
 };
 refs(full.worldView);for(const e of full.entities)refs(e.fields);return full;
}

module.exports={DELTA_SCHEMA,makePresentationDelta,applyPresentationDelta};
