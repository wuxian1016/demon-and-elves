'use strict';
// Cache only module-owned immutable vision data. Caller freezing is not a proof.
// Explicit bases preserve the client's accepted-history and out-of-order delta behavior.
const {validateVision}=require('./shared-fog');
const {mergeExploredRows}=require('./fog-row-union');
const {isPlainRecord:plain}=require('./plain-record');
const {decodeTrustedVisionRows:decodeOwnedRows,isTrustedVisionBatch:isOwnedDecodedBatch}=require('./vision-row-codec');
const ROWS=2667,COLS=3334,knownVisions=new WeakMap();
const bad=()=>{throw Error('INVALID_SNAPSHOT');},rebase=()=>{throw Error('PRESENTATION_REBASE_REQUIRED');};
function identity(x){if(x===undefined)return null;if(!x||typeof x.roomId!=='string'||!x.roomId||!Number.isSafeInteger(x.epoch)||x.epoch<1||typeof x.viewerOwnerId!=='string'||!x.viewerOwnerId)bad();return Object.freeze({roomId:x.roomId,epoch:x.epoch,viewerOwnerId:x.viewerOwnerId});}
const sameIdentity=(a,b)=>!!a&&!!b&&a.roomId===b.roomId&&a.epoch===b.epoch&&a.viewerOwnerId===b.viewerOwnerId;
function validTick(tick){if(!Number.isSafeInteger(tick)||tick<0)bad();}
function strictRow(row){if(!Array.isArray(row)||row.length<3||row.length%2!==1||!Number.isInteger(row[0])||row[0]<0||row[0]>=ROWS)rebase();if(row.length>COLS+1)bad();let end=-1;for(let j=1;j<row.length;j+=2){const a=row[j],b=row[j+1];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||a<end||b<=a||b>COLS)rebase();if(a===end)bad();end=b;}}
function sourceCopies(sources){return Array.isArray(sources)&&sources.length<=4096?Array.from(sources,s=>s&&(typeof s==='object'||typeof s==='function')?{...s,x:s.x,y:s.y,range:s.range}:s):sources;}
function freezeSources(v){for(const s of v.sources)Object.freeze(s);Object.freeze(v.sources);}
function equalRow(a,b){if(a===b)return true;if(!a||a.length!==b.length)return false;for(let i=1;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
// Capture order and Array.from iterator behavior match the baseline. Each local
// row is checked/frozen/indexed while it is hot; caller objects are never branded.
function captureFullRows(input){
 const byRow=new Array(ROWS);let invalid=false,last=-1,uncopied=false;
 if(!Array.isArray(input)||input.length>ROWS)return {rows:input,byRow,invalid:true,uncopied:true};
 const rows=Array.from(input,original=>{
  if(!Array.isArray(original)||original.length>COLS+1){invalid=true;uncopied=true;return original;}
  const row=Array.from(original),y=row[0];
  if(row.length<3||row.length%2!==1||row.length>COLS+1||!Number.isInteger(y)||y<=last||y>=ROWS)invalid=true;
  else{last=y;let end=-1;for(let i=1;i<row.length;i+=2){const a=row[i],b=row[i+1];if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||a<=end||b<=a||b>COLS){invalid=true;break;}end=b;}byRow[y]=row;}
  Object.freeze(row);return row;
 });
 if(rows.length>ROWS)invalid=true;Object.freeze(rows);return {rows,byRow,invalid,uncopied};
}
function prepareTrustedVision(input,tick,scope){
 validTick(tick);const id=identity(scope),proof=input&&typeof input==='object'?knownVisions.get(input):null;
 if(proof&&(id===null||sameIdentity(proof.identity,id))){if(input.tick>tick)bad();return input;}
 if(!input||typeof input!=='object')bad();
 // Preserve the original spread/header -> visible -> explored -> sources reads.
 const v={...input,version:input.version,team:input.team,cell:input.cell,cols:input.cols,rows:input.rows,revision:input.revision,tick:input.tick};
 let visible=captureFullRows(input.visible);v.visible=visible.rows;
 let explored=captureFullRows(input.explored);v.explored=explored.rows;
 v.sources=sourceCopies(input.sources);
 // Validate unchanged protocol/source rules without rewalking every captured row.
 validateVision({...v,visible:[],explored:[]},tick);
 // A later source getter may repair a previously uncopied oversized array.
 // Recapture that side privately once; never freeze or brand caller-owned rows.
 if(visible.uncopied){visible=captureFullRows(v.visible);v.visible=visible.rows;}
 if(explored.uncopied){explored=captureFullRows(v.explored);v.explored=explored.rows;}
 if(visible.invalid||explored.invalid)bad();
 for(const row of visible.rows){const seen=explored.byRow[row[0]];if(!seen)bad();let j=1;for(let i=1;i<row.length;i+=2){while(j<seen.length&&seen[j+1]<row[i+1])j+=2;if(j>=seen.length||seen[j]>row[i])bad();}}
 freezeSources(v);Object.freeze(v);
 knownVisions.set(v,{identity:id,visible:{rows:visible.rows,byRow:visible.byRow},explored:{rows:explored.rows,byRow:explored.byRow},stats:Object.freeze({full:true,rowValidated:v.visible.length+v.explored.length,rowReused:0,subsetChecked:v.visible.length,subsetReused:0,changedRows:v.visible.length+v.explored.length})});return v;
}
function patchRows(before,patch,stats){
 if(!plain(patch))rebase();let incoming,decoded=false;
 if(Object.hasOwn(patch,'packed')){if(Object.keys(patch).some(k=>!['packed','removed'].includes(k))||Object.hasOwn(patch,'upserts'))rebase();incoming=decodeOwnedRows({get:y=>before.byRow[y]},patch.packed,ROWS,COLS);decoded=isOwnedDecodedBatch(incoming);if(!decoded)bad();stats.rowValidated+=incoming.length;}
 else incoming=patch.upserts;
 if(!Array.isArray(incoming)||!Array.isArray(patch.removed)||incoming.length>ROWS||patch.removed.length>ROWS)rebase();
 if(!incoming.length&&!patch.removed.length){stats.rowReused+=before.rows.length;return {rows:before.rows,byRow:before.byRow,changed:null};}
 const byRow=before.byRow.slice(),touched=new Uint8Array(ROWS),changed=new Uint8Array(ROWS);let countChanged=0;
 for(const y of patch.removed){if(!Number.isInteger(y)||y<0||y>=ROWS||touched[y]||!byRow[y])rebase();touched[y]=1;changed[y]=1;countChanged++;byRow[y]=undefined;}
 for(const original of incoming){let row;if(decoded)row=original;else{if(!Array.isArray(original))rebase();if(original.length>COLS+1)bad();row=Array.from(original);strictRow(row);Object.freeze(row);stats.rowValidated++;}
  const y=row[0];if(touched[y])rebase();touched[y]=1;const old=before.byRow[y];if(equalRow(old,row))byRow[y]=old;else{byRow[y]=row;changed[y]=1;countChanged++;}
 }
 if(!countChanged){stats.rowReused+=before.rows.length;return {rows:before.rows,byRow:before.byRow,changed:null};}
 const rows=[];for(let y=0;y<ROWS;y++)if(byRow[y]){rows.push(byRow[y]);if(byRow[y]===before.byRow[y])stats.rowReused++;}Object.freeze(rows);stats.changedRows+=countChanged;return {rows,byRow,changed};
}
function exploredFromVisible(before,visible,stats){
 if(!visible.changed){stats.rowReused+=before.rows.length;return {rows:before.rows,byRow:before.byRow,changed:null};}
 const byRow=before.byRow.slice(),changed=new Uint8Array(ROWS),rows=[];let count=0;
 for(const row of mergeExploredRows(before.rows,visible.rows)){
  const y=row[0];rows.push(Object.freeze(row));
  if(row!==before.byRow[y]){byRow[y]=row;changed[y]=1;count++;}else stats.rowReused++;
 }
 stats.changedRows+=count;
 return count?{rows:Object.freeze(rows),byRow,changed}:{rows:before.rows,byRow:before.byRow,changed:null};
}
function applyTrustedVisionPatch(base,patch,tick,scope){
 validTick(tick);const id=identity(scope),proof=base&&typeof base==='object'?knownVisions.get(base):null;
 // The caller must select its actual accepted base. Cross-viewer/epoch proof is never transferable.
 if(!proof||!sameIdentity(proof.identity,id)||!plain(patch))rebase();
 if(Object.hasOwn(patch,'full')){if(Object.keys(patch).length!==1)rebase();return prepareTrustedVision(patch.full,tick,id);}
 if(Object.hasOwn(patch,'exploredReuseVisible')&&(patch.exploredReuseVisible!==true||Object.hasOwn(patch,'explored')))rebase();
 if(Object.hasOwn(patch,'exploredFromVisible')&&(patch.exploredFromVisible!==true||Object.hasOwn(patch,'explored')||Object.hasOwn(patch,'exploredReuseVisible')))rebase();
 const m=patch.meta;if(patch.baseRevision!==base.revision||!plain(m)||!Number.isSafeInteger(m.revision)||m.revision<base.revision||m.cell!==base.cell||m.rows!==base.rows||m.cols!==base.cols)rebase();
 const v={...m,version:m.version,team:m.team,cell:m.cell,cols:m.cols,rows:m.rows,revision:m.revision,tick:m.tick,visible:[],explored:[],sources:sourceCopies(m.sources)};
 validateVision(v,tick);freezeSources(v);const stats={full:false,rowValidated:0,rowReused:0,subsetChecked:0,subsetReused:0,changedRows:0};
 const visible=patchRows(proof.visible,patch.visible,stats),explored=patch.exploredFromVisible?exploredFromVisible(proof.explored,visible,stats):patchRows(proof.explored,patch.exploredReuseVisible?patch.visible:patch.explored,stats);
 // An unchanged trusted pair already has a complete subset proof. Preserve
 // its statistics without rescanning all2667 rows on every fog-off delta.
 if(!visible.changed&&!explored.changed)stats.subsetReused+=visible.rows.length;
 else for(let y=0;y<ROWS;y++){
  const row=visible.byRow[y];if(!row)continue;
  if(!visible.changed?.[y]&&!explored.changed?.[y]){stats.subsetReused++;continue;}
  const seen=explored.byRow[y];if(!seen)bad();stats.subsetChecked++;let j=1;for(let i=1;i<row.length;i+=2){while(j<seen.length&&seen[j+1]<row[i+1])j+=2;if(j>=seen.length||seen[j]>row[i])bad();}
 }
 v.visible=visible.rows;v.explored=explored.rows;Object.freeze(v);knownVisions.set(v,{identity:id,visible,explored,stats:Object.freeze(stats)});return v;
}
function isOwnedVision(v){return knownVisions.has(v);}
function proofStats(v){return knownVisions.get(v)?.stats;}
function validateTrustedVision(v,tick){
 if(!knownVisions.has(v))return validateVision(v,tick);
 validTick(tick);if(v.tick>tick)bad();return v;
}
module.exports={prepareTrustedVision,validateTrustedVision,applyTrustedVisionPatch,isOwnedVision,trustedVisionStats:proofStats};
