'use strict';
const SCHEMA=require('./presentation-schema');
const {isCapturedPresentationNode}=require('./presentation-queue');
const {eventIssue,validOffer}=require('./game-feedback');
const TYPES='Entity Tree GoldMine Building Player Ally TrollBase Troll Hound MiniTroll Tank Robot Peasant Particle TankShell RobotLaser RobotSiegeLaser Projectile Object'.split(' ');
const FORBIDDEN=new Set(['__proto__','prototype','constructor']);
const CLOCK_FIELDS=Object.freeze(['frostHitAt','chopHitAt']);
// Diagnostics name fixed protocol checks and validated schema locations only.
// Never include packet values, entity IDs, or unknown remote property names.
function invalid(reason,path){const error=Error('INVALID_PRESENTATION');error.code='INVALID_PRESENTATION';error.presentationReason=reason;error.presentationPath=path.slice(0,160);throw error;}
function validateRaidWarning(w){if(w==null)return;if(typeof w!=='object'||Array.isArray(w)||Object.keys(w).some(k=>!['active','remaining'].includes(k))||w.active!==true||!Number.isInteger(w.remaining)||w.remaining<0||w.remaining>50)invalid('RAID_WARNING','worldView.demonRaidWarning');}
function validateHud(h){
 if(h==null)return null;
 const sections={troll:['retreating','level','mana','maxMana','gold','hp','maxHp','dead','dragonEvolved','damage'],base:['hp','maxHp','dead'],details:['life','armor','tempo','shredded','controlled']};
 if(typeof h!=='object'||Object.keys(h).some(k=>!sections[k]&&!['infoEquipment','infoSkills','retreatBannerRemainingMs'].includes(k)))invalid('HUD_FIELDS','publicCombatHud');
 for(const[k,keys]of Object.entries(sections)){
  const section=h[k],path='publicCombatHud.'+k;
  if(!section||typeof section!=='object'||Object.keys(section).some(x=>!keys.includes(x)))invalid('HUD_SECTION',path);
  for(const key of keys){const v=section[key],at=path+'.'+key;
   if(['retreating','dead','dragonEvolved','shredded','controlled'].includes(key)){if(typeof v!=='boolean'&&!(key==='retreating'&&v===undefined))invalid('HUD_BOOLEAN',at);}
   else if(k==='details'){if(typeof v!=='string'||v.length>2048)invalid('HUD_STRING',at);}
   else if(!Number.isFinite(v)||Math.abs(v)>1e15)invalid('HUD_NUMBER',at);
  }
 }
 for(const key of ['infoEquipment','infoSkills'])if(h[key]!==undefined){
  const path='publicCombatHud.'+key;
  if(!Array.isArray(h[key])||h[key].length>64)invalid('HUD_INFO_LIST',path);
  for(let i=0;i<h[key].length;i++){const row=h[key][i];if(!row||Object.keys(row).some(k=>!['title','status','detail'].includes(k))||['title','status','detail'].some(k=>typeof row[k]!=='string'||row[k].length>2048))invalid('HUD_INFO_ROW',path+'['+i+']');}
 }
 if(h.retreatBannerRemainingMs!==undefined&&(!Number.isFinite(h.retreatBannerRemainingMs)||h.retreatBannerRemainingMs<0||h.retreatBannerRemainingMs>1800))invalid('HUD_RETREAT_TIME','publicCombatHud.retreatBannerRemainingMs');
 return h;
}
function validateTeam(rows){
 if(rows===undefined)return [];
 if(!Array.isArray(rows)||rows.length>8)invalid('TEAM_LIST','publicTeamData');
 for(let i=0;i<rows.length;i++){
  const row=rows[i],path='publicTeamData['+i+']';
  if(!row||Object.keys(row).some(k=>!['ownerId','slot','markColor','profile','status','rows'].includes(k))||!Number.isInteger(row.slot)||row.slot<0||row.slot>7)invalid('TEAM_ROW',path);
  for(const k of ['ownerId','markColor','profile','status'])if(typeof row[k]!=='string'||row[k].length>256)invalid('TEAM_STRING',path+'.'+k);
  if(!row.rows||Object.keys(row.rows).some(k=>!['economy','defense','technology'].includes(k)))invalid('TEAM_SECTIONS',path+'.rows');
  for(const key of ['economy','defense','technology']){const list=row.rows[key];if(!Array.isArray(list)||list.length>64||list.some(pair=>!Array.isArray(pair)||pair.length!==2||pair.some(v=>typeof v!=='string'||v.length>2048)))invalid('TEAM_SECTION_ROWS',path+'.rows.'+key);}
 }
 return rows;
}
function validateRoster(rows){
 if(rows===undefined)return [];
 if(!Array.isArray(rows)||rows.length>9)invalid('ROSTER_LIST','roster');
 const ids=new Set(),seats=new Set();
 for(let i=0;i<rows.length;i++){const row=rows[i];if(!row||Object.keys(row).some(k=>!['ownerId','seat','kind','name','connected'].includes(k))||typeof row.ownerId!=='string'||row.ownerId.length>96||ids.has(row.ownerId)||!Number.isInteger(row.seat)||row.seat<0||row.seat>8||seats.has(row.seat)||!['human','ai'].includes(row.kind)||typeof row.name!=='string'||row.name.length>16||typeof row.connected!=='boolean')invalid('ROSTER_ROW','roster['+i+']');ids.add(row.ownerId);seats.add(row.seat);}
 return rows.map(r=>({...r}));
}
function validateWarnings(rows){
 if(rows===undefined)return [];
 if(!Array.isArray(rows)||rows.length>8)invalid('WARNING_LIST','publicWarnings');
 for(let i=0;i<rows.length;i++){const r=rows[i];if(!r||Object.keys(r).some(k=>!['kind','seconds','progress','zoneIndex','compact','supplying','estimated','stacked','targetId','sourceId'].includes(k))||!['slime','demon'].includes(r.kind)||!Number.isFinite(r.seconds)||r.seconds<0||r.seconds>86400||!Number.isFinite(r.progress)||r.progress<0||r.progress>1||!Number.isInteger(r.zoneIndex)||r.zoneIndex<0||r.zoneIndex>8||['compact','supplying','estimated','stacked'].some(k=>typeof r[k]!=='boolean'))invalid('WARNING_ROW','publicWarnings['+i+']');}
 for(let i=0;i<rows.length;i++)for(const key of ['targetId','sourceId'])if(rows[i][key]!==undefined&&(typeof rows[i][key]!=='string'||rows[i][key].length>128))invalid('WARNING_REFERENCE_ID','publicWarnings['+i+'].'+key);
 return rows.map(r=>({...r}));
}
function guideAdvice(value,objects,records,staged=objects,normalizeRecords=false){
 const record=v=>normalizeRecords?Object.assign(Object.create(null),v):v;
 if(value==null)return null;
 if(typeof value!=='object'||Array.isArray(value))invalid('GUIDE_OBJECT','publicGuideAdvice');
 const out=Object.create(null),strings='title detail key396 type button action actionLabel'.split(' '),bools='joystick cameraDrag401 upgrade emergency attackIntro boarding399 guidePlayer399 mandatory399 optional development wait'.split(' ');
 const ref=(v,path)=>{if(v===null)return null;if(!v||Object.keys(v).length!==1||!objects.has(v.ref))invalid('GUIDE_REFERENCE',path);return objects.get(v.ref);};
 for(const[k,v]of Object.entries(value)){
  if(strings.includes(k)){if(typeof v!=='string'||v.length>4096)invalid('GUIDE_STRING','publicGuideAdvice.'+k);out[k]=v;}
  else if(bools.includes(k)){if(typeof v!=='boolean')invalid('GUIDE_BOOLEAN','publicGuideAdvice.'+k);out[k]=v;}
  else if(k==='step'){if(!(Number.isInteger(v)&&v>=0&&v<=15)&&!['control-stick','control-camera'].includes(v))invalid('GUIDE_STEP','publicGuideAdvice.step');out[k]=v;}
  else if(k==='allowedTypes'){if(!Array.isArray(v)||v.length>17||v.some(x=>!('cannonTower house wall tower iceTower manaTower watchtower goldMine warehouse altar houseForPeasants exchange repairShop tankFactory tankLab robotFactory robotLab'.split(' ').includes(x))))invalid('GUIDE_ALLOWED_TYPES','publicGuideAdvice.allowedTypes');out[k]=v.slice();}
  else if(k==='cost'){if(!v||Object.keys(v).length!==2||['wood','gold'].some(x=>!Number.isFinite(v[x])||v[x]<0||v[x]>1e15))invalid('GUIDE_COST','publicGuideAdvice.cost');out[k]=record({wood:v.wood,gold:v.gold});}
  else if(k==='target'||k==='wallWarning399'){out[k]=ref(v,'publicGuideAdvice.'+k);if(v&&(records.get(v.ref)?.type!=='Building'||staged.get(v.ref).ownerSlot!=null))invalid('GUIDE_BUILDING_OWNER','publicGuideAdvice.'+k);}
  else if(k==='moveTo'){if(v&&Object.keys(v).length===2&&Number.isFinite(v.x)&&Number.isFinite(v.y)&&Math.abs(v.x)<=1e7&&Math.abs(v.y)<=1e7)out[k]=record({x:v.x,y:v.y});else out[k]=ref(v,'publicGuideAdvice.moveTo');}
  else invalid('GUIDE_FIELD','publicGuideAdvice.[unknown-field]');
 }
 return out;
}
// This is a presentation protocol, never a checkpoint decoder. Constructors are
// supplied locally, never selected from window/globalThis by remote names.
function* preparePresentationSteps(packet,types,{engineHash=SCHEMA.ENGINE_HASH,worldFields=SCHEMA.WORLD_FIELDS,entityFields=SCHEMA.ENTITY_FIELDS,recordFields=SCHEMA.RECORD_FIELDS,maxEntities=20000,maxValues=3000000}={},prior=null,cooperative={}){
 if(!packet||packet.schema!==1||!engineHash||packet.engineHash!==engineHash||typeof packet.viewerOwnerId!=='string'||packet.viewerOwnerId.length>96)invalid('PACKET_HEADER','packet');
 for(const key of ['epoch','revision','tick'])if(!Number.isSafeInteger(packet[key])||packet[key]<(key==='epoch'?1:0))invalid('PACKET_COUNTER',key);
 if(!Array.isArray(packet.entities)||packet.entities.length>maxEntities||!packet.worldView||!worldFields||!entityFields)invalid('PACKET_COLLECTIONS','packet');
 validateRaidWarning(packet.worldView.demonRaidWarning);
 const prototypeCache=new Map(),checkedCleanShapes=new Map();
 const batchSize=Number.isInteger(cooperative.batchSize)&&cooperative.batchSize>0?cooperative.batchSize:16;
 const keepGoing=typeof cooperative.keepGoing==='function'?cooperative.keepGoing:()=>true;
 const identity={epoch:packet.epoch,revision:packet.revision,tick:packet.tick,viewerOwnerId:packet.viewerOwnerId,entities:packet.entities,worldView:packet.worldView};
 const priorIdentity=prior?{epoch:prior.epoch,revision:prior.revision,viewerOwnerId:prior.viewerOwnerId,entities:prior.entities}:null;
 const checkCurrent=()=>{
  prototypeCache.clear();checkedCleanShapes.clear();
  if(!keepGoing())throw preparationCancelled();
  for(const key of ['epoch','revision','tick','viewerOwnerId','entities','worldView'])if(packet[key]!==identity[key])throw stalePlan();
  if(priorIdentity)for(const key of ['epoch','revision','viewerOwnerId','entities'])if(prior[key]!==priorIdentity[key])throw stalePlan();
 };
 checkCurrent();
 const objects=new Map(),staged=new Map(),plans=[],records=new Map(),stagePlans=new Map(),reuseScope=!!prior&&prior.epoch===packet.epoch&&prior.viewerOwnerId===packet.viewerOwnerId,worldAllowed=new Set(worldFields),recordAllowed=new Set(recordFields);let values=0;
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<=128;
 let entityIndex=0;
 for(const row of packet.entities){
  const path='entities['+entityIndex+']';entityIndex++;
  if(!row||!validId(row.id)||objects.has(row.id)||!TYPES.includes(row.type)||!row.fields||Array.isArray(row.fields))invalid('ENTITY_RECORD',path);
  const ctor=types[row.type];if(row.type!=='Object'&&(typeof ctor!=='function'||!ctor.prototype))invalid('ENTITY_CONSTRUCTOR',path+'.type');
  const prototype=row.type==='Object'?null:ctor.prototype;
  const lookupId=reuseScope?row.id:null,old=reuseScope?prior.entities.get(lookupId):null;
  const clean=old&&cleanRows.get(old),tracker=old&&trackedEntities.get(old);
  const legacyClock=CLOCK_FIELDS.some(key=>!Object.hasOwn(row.fields,key)&&Number.isFinite(fieldDescriptor(prototype,key)?.value));
  if(clean&&tracker&&tracker.version===clean.liveVersion&&clean.fields===row.fields&&clean.prototype===prototype&&!legacyClock&&Object.getPrototypeOf(old)===prototype&&Object.isExtensible(old)){
   objects.set(row.id,old);staged.set(row.id,clean.fields);records.set(row.id,row);
   const plan={id:row.id,target:old,object:clean.fields,prototype,reused:true,legacyClock:false,version:committedVersions.get(old)||0,fieldKeys:clean.keys,fieldSet:clean.set,clean};
   plans.push(plan);stagePlans.set(row.id,plan);
   if(entityIndex%batchSize===0){yield {stage:'identity',done:entityIndex,total:packet.entities.length};checkCurrent();}
   continue;
  }
  const object=Object.create(legacyClock?prototype:null);Object.defineProperty(object,'networkId',{value:row.id,enumerable:false});
  // The rare legacy clock path may inherit one data timestamp and another
  // accessor. Shadow that accessor privately; clock never executes a getter.
  if(legacyClock)for(const key of CLOCK_FIELDS){const descriptor=fieldDescriptor(prototype,key);if(!Object.hasOwn(row.fields,key)&&descriptor&&!Object.hasOwn(descriptor,'value'))Object.defineProperty(object,key,{value:undefined,writable:true,configurable:true});}
  // Staging is always private, including a newly visible entity. Live targets
  // must remain extensible for the renderer after an atomic commit.
  let target=null,reused=false;
  if(old&&Object.getPrototypeOf(old)===prototype&&Object.isExtensible(old)){
   if(isCapturedPresentationNode(row.fields)?canReuseCapturedTarget(old,row.fields):canReuseUnownedTarget(old,row.fields)){target=old;reused=true;}
  }
  if(!target){target=Object.create(prototype);Object.defineProperty(target,'networkId',{value:object.networkId,enumerable:false});if(row.type==='Tree'||row.type==='GoldMine')target=trackEntity(target);}
  objects.set(row.id,target);staged.set(row.id,object);records.set(row.id,row);
  const plan={id:object.networkId,target,object,prototype,reused,legacyClock,version:committedVersions.get(target)||0,fieldKeys:null,fieldSet:null};plans.push(plan);stagePlans.set(row.id,plan);
  if(entityIndex%batchSize===0){yield {stage:'identity',done:entityIndex,total:packet.entities.length};checkCurrent();}
 }
 yield {stage:'identity',done:entityIndex,total:packet.entities.length};checkCurrent();
 function decode(value,depth=0,path='value'){
  if(++values>maxValues||depth>24)invalid('VALUE_BUDGET',path);
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e15)invalid('VALUE_NUMBER',path);return value;}
  if(typeof value==='string'){if(value.length>4096)invalid('VALUE_STRING',path);return value;}
  if(!value||typeof value!=='object')invalid('VALUE_TYPE',path);
  if(Array.isArray(value)){if(value.length>20000)invalid('VALUE_ARRAY_LENGTH',path);return value.map((v,i)=>decode(v,depth+1,path+'['+i+']'));}
  const keys=Object.keys(value);if(keys.length>512)invalid('VALUE_RECORD_SIZE',path);
  if(Object.hasOwn(value,'ref')){if(keys.length!==1||!objects.has(value.ref))invalid('VALUE_REFERENCE',path+'.ref');return objects.get(value.ref);}
  const out=Object.create(null);for(const k of keys){if(FORBIDDEN.has(k)||k.length>96||!recordAllowed.has(k))invalid('VALUE_RECORD_FIELD',path+'.[unknown-field]');out[k]=decode(value[k],depth+1,path+'.'+k);}return out;
 }
 entityIndex=0;
 // The schema is local and constant for this decode. Build each allow-list once,
 // preserving per-entity validation order and atomic snapshot installation.
 const sharedEntityAllowed=Array.isArray(entityFields)?new Set(entityFields):null,allowedByType=new Map();
 yield {stage:'fields',done:0,total:records.size};checkCurrent();
 for(const[id,row]of records){
  if(Object.hasOwn(row.fields,'wallAxisAB')&&(row.type!=='Building'||row.fields.type!=='wall'||!['h','v'].includes(row.fields.wallAxisAB)))invalid('WALL_AXIS','entities.wallAxisAB');
  let allowed=sharedEntityAllowed||allowedByType.get(row.type);
  if(!allowed){allowed=new Set(entityFields[row.type]||[]);allowedByType.set(row.type,allowed);}
  const object=staged.get(id),plan=stagePlans.get(id),path='entities['+entityIndex+'].fields',methods=cooperative.cachePrototypeFields?prototypeFieldCache(plan.prototype,prototypeCache):null,fieldKeys=plan.clean?plan.fieldKeys:Object.keys(row.fields);entityIndex++;
  if(plan.clean){
   values+=fieldKeys.length;if(values>maxValues)invalid('VALUE_BUDGET',path);
   let checked=checkedCleanShapes.get(plan.prototype);if(!checked){checked=new Set();checkedCleanShapes.set(plan.prototype,checked);}
   const shape=row.type+':'+plan.clean.shape;
   if(!cooperative.cachePrototypeFields||!checked.has(shape)){
    for(const key of fieldKeys){
     if(FORBIDDEN.has(key)||key==='networkId'||!allowed.has(key))invalid('ENTITY_FIELD',path+'.[unknown-field]');
     if(typeof (cooperative.cachePrototypeFields?cachedFieldDescriptor(plan.prototype,key,methods):fieldDescriptor(plan.prototype,key))?.value==='function')invalid('ENTITY_METHOD_OVERWRITE',path+'.'+key);
    }
    checked.add(shape);
   }
   if(entityIndex%batchSize===0){yield {stage:'fields',done:entityIndex,total:records.size};checkCurrent();}
   continue;
  }
  for(const key of fieldKeys){
   if(FORBIDDEN.has(key)||key==='networkId'||!allowed.has(key))invalid('ENTITY_FIELD',path+'.[unknown-field]');
   if(typeof (cooperative.cachePrototypeFields?cachedFieldDescriptor(plan.prototype,key,methods):fieldDescriptor(plan.prototype,key))?.value==='function')invalid('ENTITY_METHOD_OVERWRITE',path+'.'+key);
   const raw=row.fields[key],kind=typeof raw;
   // Hot entity fields are mostly numbers, booleans and short strings. Keep
   // the validation and value budget but only build a diagnostic path on error.
   let value;
   if(raw===null||kind==='boolean'||kind==='number'||kind==='string'){
    if(++values>maxValues)invalid('VALUE_BUDGET',path+'.'+key);
    if(kind==='number'&&(!Number.isFinite(raw)||Math.abs(raw)>1e15))invalid('VALUE_NUMBER',path+'.'+key);
    if(kind==='string'&&raw.length>4096)invalid('VALUE_STRING',path+'.'+key);
    value=raw;
   }else value=decode(raw,0,path+'.'+key);
   // Normal staging objects have a null prototype and are private until sealed.
   // Only the legacy clock shape needs an explicit own slot to bypass accessors.
   if(plan.legacyClock)Object.defineProperty(object,key,{value,enumerable:true,writable:true,configurable:true});
   else object[key]=value;
  }
  // Seal only the null-prototype private staging shape. Data values remain
  // writable for the transactional clock; slots cannot turn into accessors.
  plan.fieldKeys=fieldKeys;if(!plan.legacyClock){plan.fieldSet=new Set(fieldKeys);Object.seal(object);sealedStages.add(object);}
  // Only immutable scalar wire rows can bypass decoding on a later identical
  // delta row. No decoded nested arrays/records or reference identities cached.
  if(trackedEntities.has(plan.target)&&!plan.legacyClock&&isCapturedPresentationNode(row.fields)&&!CLOCK_FIELDS.some(k=>Object.hasOwn(row.fields,k))&&fieldKeys.every(k=>row.fields[k]===null||['boolean','number','string'].includes(typeof row.fields[k]))){
   plan.nextClean={fields:row.fields,prototype:plan.prototype,keys:fieldKeys,set:plan.fieldSet,shape:fieldKeys.join('\0')};
  }
  if(entityIndex%batchSize===0){yield {stage:'fields',done:entityIndex,total:records.size};checkCurrent();}
 }
 yield {stage:'fields',done:entityIndex,total:records.size};checkCurrent();
 yield {stage:'finalize',done:0,total:1};checkCurrent();
 const events=packet.events||[];
 if(!Array.isArray(events))invalid('EVENTS_ARRAY','events');
 if(events.length>128)invalid('EVENTS_LIMIT','events');
 for(let i=0;i<events.length;i++){const issue=eventIssue(events[i],packet.tick);if(issue)invalid(issue.reason,'events['+i+']'+(issue.field?'.'+issue.field:''));}
 if(!validOffer(packet.rescueOffer??null))invalid('RESCUE_OFFER','rescueOffer');
 const worldView=Object.create(null);for(const key of Object.keys(packet.worldView)){if(FORBIDDEN.has(key)||!worldAllowed.has(key))invalid('WORLD_FIELD','worldView.[unknown-field]');worldView[key]=decode(packet.worldView[key],0,'worldView.'+key);}
 if(packet.presentationTimeMs!==undefined&&(!Number.isFinite(packet.presentationTimeMs)||packet.presentationTimeMs<0))invalid('PRESENTATION_TIME','presentationTimeMs');
 const focus=packet.publicDemonFocusEvent??null;
 if(focus!==null&&(typeof focus!=='object'||Array.isArray(focus)||![3,4].includes(Object.keys(focus).length)||!Number.isSafeInteger(focus.serial)||focus.serial<1||Object.keys(focus).some(k=>!['serial','x','y','issuedTick'].includes(k))||!Number.isFinite(focus.x)||!Number.isFinite(focus.y)||Math.abs(focus.x)>1e7||Math.abs(focus.y)>1e7))invalid('DEMON_FOCUS','publicDemonFocusEvent');
 if(focus?.issuedTick!==undefined&&(!Number.isSafeInteger(focus.issuedTick)||focus.issuedTick<0||focus.issuedTick>packet.tick))invalid('DEMON_FOCUS_TICK','publicDemonFocusEvent');
 const publicSurvivalRanking=require('./survival-ranking').validateRanking(packet.publicSurvivalRanking,packet.tick);
 const personalDeathResults=require('./death-results').validateDeathResults(packet.personalDeathResults,packet.tick);
 const publicWarnings=validateWarnings(packet.publicWarnings);for(let i=0;i<publicWarnings.length;i++)for(const key of ['targetId','sourceId'])if(publicWarnings[i][key]!==undefined&&!objects.has(publicWarnings[i][key]))invalid('WARNING_REFERENCE_MISSING','publicWarnings['+i+'].'+key);
 // Snapshot creation is atomic: callers must not install a partially decoded view.
 const view={worldView,publicSurvivalRanking,personalDeathResults,publicDemonFocusEvent:focus?{...focus}:null,publicGuideAdvice:guideAdvice(packet.publicGuideAdvice,objects,records,staged,reuseScope),presentationTimeMs:packet.presentationTimeMs,publicWarnings,roster:validateRoster(packet.roster),publicCombatHud:validateHud(packet.publicCombatHud),publicTeamData:validateTeam(packet.publicTeamData),entities:objects,epoch:packet.epoch,revision:packet.revision,tick:packet.tick,viewerOwnerId:packet.viewerOwnerId,vision:packet.vision,events:events.map(e=>({...e}))};
 // External adapter checks (vision/scene/world methods) and timestamp mapping
 // must finish before synchronous commit. Async callers must supply keepGoing
 // for their scope/epoch/generation; commit rechecks all live target descriptors.
 const clockView={...view,entities:staged};let committed=false;
 yield {stage:'finalize',done:1,total:1};checkCurrent();
 const preflight=()=>{
  if(committed)throw Error('PRESENTATION_ALREADY_COMMITTED');
  checkCurrent();if(clockView.entities!==staged)throw stalePlan();
  // Re-sample every target and every forthcoming write before any live write.
  const commits=[];
  try{for(const {id,target,object,prototype,reused,legacyClock,version,fieldKeys,fieldSet,clean}of plans){
   if(reused&&prior.entities.get(id)!==target||staged.get(id)!==object||Object.getPrototypeOf(target)!==prototype||!Object.isExtensible(target)||(committedVersions.get(target)||0)!==version)throw stalePlan();
   if(clean){
    if(object!==clean.fields||!isCapturedPresentationNode(object))throw stalePlan();
    // The proxy observes set/define/delete/prototype/extensibility operations.
    // With no live mutation since the last complete commit, there is no write
    // or descriptor change to preflight. Mutated rows take the full audit below.
    if(trackedEntities.get(target)?.version===clean.liveVersion)continue;
   }else if(legacyClock?Object.getPrototypeOf(object)!==prototype:!sealedStages.has(object))throw stalePlan();
   const own=ownDescriptorTable(trackedEntities.get(target)?.target||target),incoming=legacyClock?Object.getOwnPropertyDescriptors(object):null;let keys=null,assignments=null,definitions=null;
   for(const key of Object.keys(own))if(own[key].enumerable){if(!own[key].configurable)throw stalePlan();if(key!=='_dragonGait'&&!(incoming?incoming[key]?.enumerable:fieldSet.has(key)))(keys ||= []).push(key);}
   // Metadata is fixed in the private sealed shape. Read the latest data value
   // after clock.prepare, without allocating descriptors for staging again.
   for(const key of incoming?Object.keys(incoming):fieldKeys){
    const descriptor=incoming?.[key];if(incoming&&!descriptor.enumerable)continue;
    const slot=own[key];if(!canDefineData(slot)||incoming&&(!Object.hasOwn(descriptor,'value')||!descriptor.writable||!descriptor.configurable))throw stalePlan();
    const value=incoming?descriptor.value:object[key];
    // Sealing forbids accessors/shape changes but still permits writable:false.
    // A same-value write to this proven private data slot preserves rejection
    // of readonly staging without allocating another descriptor per field.
    if(!incoming&&!clean)object[key]=value;
    if(slot&&Object.hasOwn(slot,'value')&&slot.writable){if(!Object.is(slot.value,value))(assignments ||= []).push(key,value);continue;}
    definitions ||= Object.create(null);
    const retained=slot&&!slot.enumerable?slot:null;
    definitions[key]={value,writable:true,enumerable:!retained,configurable:retained?retained.configurable:true};
   }
   if(keys||assignments||definitions)commits.push({target,assignments,definitions,keys});
  }}catch(error){if(error?.code==='PRESENTATION_PLAN_STALE')throw error;throw stalePlan();}
  checkCurrent();return commits;
 };
 return {view,clockView,assertCurrent(){preflight();return true;},commit(){
  const commits=preflight();
  for(const {target,assignments,definitions,keys}of commits){
   // Only the hydrator holds the raw target. An audited authority batch uses it
   // directly and advances the mutation generation once; renderer writes still
   // pass through the tracking proxy. No setter/accessor can run after preflight.
   const tracker=trackedEntities.get(target),write=tracker?.target||target;
   if(keys)for(const key of keys)delete write[key];
   if(assignments)for(let i=0;i<assignments.length;i+=2)write[assignments[i]]=assignments[i+1];
   if(definitions)Object.defineProperties(write,definitions);
   if(tracker)tracker.version++;
  }
  for(const plan of plans){const target=plan.target;committedVersions.set(target,(committedVersions.get(target)||0)+1);
   const clean=plan.nextClean||plan.clean,tracker=trackedEntities.get(target);
   if(clean&&tracker)cleanRows.set(target,{...clean,liveVersion:tracker.version});else cleanRows.delete(target);
  }
  committed=true;return view;
 }};
}
function hydratePresentation(packet,types,options){return prepareFusedPresentation(packet,types,options).commit();}
module.exports={preparePresentationSteps,prepareFusedPresentation,prepareFusedPresentationAsync,hydratePresentation,isStagingData,TYPES};

const committedVersions=new WeakMap(),sealedStages=new WeakSet();
const trackedEntities=new WeakMap(),cleanRows=new WeakMap();
function trackEntity(target){
 if(typeof Proxy!=='function')return target;
 const tracker={version:0,target};
 const proxy=new Proxy(target,{
  set(t,k,v,r){const ok=Reflect.set(t,k,v,r);if(ok)tracker.version++;return ok;},
  defineProperty(t,k,d){const ok=Reflect.defineProperty(t,k,d);if(ok)tracker.version++;return ok;},
  deleteProperty(t,k){const ok=Reflect.deleteProperty(t,k);if(ok)tracker.version++;return ok;},
  setPrototypeOf(t,p){const ok=Reflect.setPrototypeOf(t,p);if(ok)tracker.version++;return ok;},
  preventExtensions(t){const ok=Reflect.preventExtensions(t);if(ok)tracker.version++;return ok;}
 });trackedEntities.set(proxy,tracker);return proxy;
}
function isStagingData(value){return sealedStages.has(value);}
// Explicit own-data definitions cannot invoke prototype setters. An existing
// non-configurable own property is reusable only when it is writable data.
function canDefineData(descriptor){return !descriptor||descriptor.configurable||Object.hasOwn(descriptor,'value')&&descriptor.writable===true;}
function fieldDescriptor(object,key){for(let at=object;at!==null;at=Object.getPrototypeOf(at)){const descriptor=Object.getOwnPropertyDescriptor(at,key);if(descriptor)return descriptor;}return null;}
function prototypeFieldCache(proto,cache){
 if(proto===null)return null;if(cache.has(proto))return cache.get(proto);
 const fields=new Map();cache.set(proto,fields);return fields;
}
function cachedFieldDescriptor(proto,key,fields){
 if(fields===null)return null;if(fields.has(key))return fields.get(key);
 const descriptor=fieldDescriptor(proto,key);fields.set(key,descriptor);return descriptor;
}
function stalePlan(){const error=Error('PRESENTATION_PLAN_STALE');error.code='PRESENTATION_PLAN_STALE';error.retryable=true;return error;}
function preparationCancelled(){const error=Error('PRESENTATION_PREPARATION_CANCELLED');error.code='PRESENTATION_PREPARATION_CANCELLED';error.cancelled=true;return error;}
function prepareFusedPresentation(packet,types,options,prior=null){const iterator=preparePresentationSteps(packet,types,options,prior);let step;do{step=iterator.next();}while(!step.done);return step.value;}
async function prepareFusedPresentationAsync(packet,types,options,prior=null,cooperative={}){
 let lastTime=0;
 const clock=typeof cooperative.clock==='function'?cooperative.clock:()=>lastTime=Math.max(lastTime,typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now());
 const schedule=typeof cooperative.schedule==='function'?cooperative.schedule:fn=>setTimeout(fn,0);
 const keepGoing=typeof cooperative.keepGoing==='function'?cooperative.keepGoing:()=>true;
 const sliceMs=Number.isFinite(cooperative.sliceMs)&&cooperative.sliceMs>0?cooperative.sliceMs:4;
 const maxBatches=Number.isInteger(cooperative.maxBatchesPerSlice)&&cooperative.maxBatchesPerSlice>0?cooperative.maxBatchesPerSlice:4;
 const iterator=preparePresentationSteps(packet,types,options,prior,{...cooperative,keepGoing,cachePrototypeFields:true});
 let sliceStart=clock(),batches=0,lastProgress=null,slicePhases=new Set();
 const reportSlice=()=>cooperative.onSlice?.({phase:slicePhases.size===1?[...slicePhases][0]:slicePhases.size?'hydration':'finalize',durationMs:Math.max(0,clock()-sliceStart),work:batches});
 try{while(true){
  if(!keepGoing())throw preparationCancelled();
  const step=iterator.next();batches++;
  if(step.done){reportSlice();if(!keepGoing())throw preparationCancelled();return step.value;}
  lastProgress=step.value;slicePhases.add(lastProgress.stage);cooperative.onProgress?.(lastProgress);
  if(!keepGoing())throw preparationCancelled();
  if(clock()-sliceStart>=sliceMs||batches>=maxBatches){
   reportSlice();
   await new Promise(resolve=>schedule(resolve));
   sliceStart=clock();batches=0;slicePhases.clear();
  }
 }}finally{iterator.return();}
}

// Sample every own key and its current descriptor in native enumeration order.
// A null-prototype result also preserves literal __proto__ descriptor entries.
function ownDescriptorTable(value){const descriptors=Object.create(null);for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(descriptor)descriptors[key]=descriptor;}return descriptors;}

// Private capture proves these fields contain only immutable enumerable string
// data keys. Sample every live target descriptor, keeping the same reuse rules,
// without creating a descriptor table and two additional key arrays.
function canReuseCapturedTarget(target,fields){target=trackedEntities.get(target)?.target||target;let reusable=true;for(const key of Reflect.ownKeys(target)){const descriptor=Object.getOwnPropertyDescriptor(target,key);if(!descriptor||typeof key!=='string')continue;if(descriptor.enumerable){if(!descriptor.configurable)reusable=false;}else if(Object.hasOwn(fields,key)&&!canDefineData(descriptor))reusable=false;}return reusable;}
function canReuseUnownedTarget(target,fields){target=trackedEntities.get(target)?.target||target;const descriptors=Object.getOwnPropertyDescriptors(target),ownKeys=Object.keys(descriptors).filter(key=>descriptors[key].enumerable);return ownKeys.every(key=>descriptors[key].configurable)&&Object.keys(fields).every(key=>canDefineData(descriptors[key]));}
