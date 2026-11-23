'use strict';
// Exact shared-vision raster. Native indexing matches the original game renderer.
// applyValidated is internal: callers must already have run validateVision on this packet.
const {isOwnedVision}=require('./trusted-vision');
const COLS=3334,ROWS=2667,CELLS=COLS*ROWS;
function equalRow(a,b){if(a===b)return true;if(!a||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
const equalSources=(a,b)=>a.length===b.length&&a.every((s,i)=>s.x===b[i].x&&s.y===b[i].y&&s.range===b[i].range&&s.fixed===b[i].fixed);
function prepareRows(previous,rows,reset,owned){
 const next=new Map(),changes=[];
 for(const row of rows){const old=previous.get(row[0]);if(!reset&&equalRow(old,row))next.set(row[0],old);else{const copy=owned?row:row.slice();next.set(row[0],copy);changes.push([old,copy]);}}
 if(!reset)for(const [y,row]of previous)if(!next.has(y))changes.push([row,null]);
 return {next,changes};
}
function fillChanges(buffer,plan,reset,fresh){
 let cellsWritten=0;if(reset&&!fresh){buffer.fill(0);cellsWritten+=CELLS;}
 for(const [old,row]of plan.changes){
  if(old&&!reset){const base=old[0]*COLS;for(let i=1;i<old.length;i+=2){buffer.fill(0,base+old[i],base+old[i+1]);cellsWritten+=old[i+1]-old[i];}}
  if(row){const base=row[0]*COLS;for(let i=1;i<row.length;i+=2){buffer.fill(1,base+row[i],base+row[i+1]);cellsWritten+=row[i+1]-row[i];}}
 }
 return cellsWritten;
}
class FogRasterStore{
 constructor(){this.visible=null;this.explored=null;this.visibleRows=new Map();this.exploredRows=new Map();this.sources=[];this.fixedSources=[];this.fixedKey=null;this.rasterRevision=0;this.visionRevision=0;this.identity=null;this.disposed=false;}
 apply(vision,tick,identity){
  if(this.disposed)throw Error('FOG_STORE_DISPOSED');
  // Lazy import permits SharedFog to use this store without a module initialization cycle.
  require('./shared-fog').validateVision(vision,tick);
  return this.applyValidated(vision,identity);
 }
 applyValidated(vision,identity){
  if(this.disposed)throw Error('FOG_STORE_DISPOSED');
  if(!identity||typeof identity.roomId!=='string'||!identity.roomId||!Number.isSafeInteger(identity.epoch)||identity.epoch<1||typeof identity.viewerOwnerId!=='string'||!identity.viewerOwnerId)throw Error('INVALID_FOG_IDENTITY');
  const reset=!this.identity||['roomId','epoch','viewerOwnerId'].some(k=>this.identity[k]!==identity[k]);
  const owned=isOwnedVision(vision);
  const vp=prepareRows(this.visibleRows,vision.visible,reset,owned),ep=prepareRows(this.exploredRows,vision.explored,reset,owned);
  const sources=vision.sources.map(s=>({x:s.x,y:s.y,range:s.range,fixed:!!s.fixed}));
  const fixed=sources.filter(s=>s.fixed),rasterChanged=reset||vp.changes.length>0||ep.changes.length>0;
  const sourcesChanged=reset||!equalSources(this.sources,sources),fixedChanged=reset||!equalSources(this.fixedSources,fixed);
  // All validation/cloning/allocation precedes mutation. Native .fill cannot throw for these validated spans.
  const visible=this.visible||new Uint8Array(CELLS),explored=this.explored||new Uint8Array(CELLS);
  const nextFixedKey=fixedChanged?{}:this.fixedKey,nextIdentity={roomId:identity.roomId,epoch:identity.epoch,viewerOwnerId:identity.viewerOwnerId};
  const cellsWritten=fillChanges(visible,vp,reset,!this.visible)+fillChanges(explored,ep,reset,!this.explored);
  this.visible=visible;this.explored=explored;this.visibleRows=vp.next;this.exploredRows=ep.next;
  if(sourcesChanged)this.sources=sources;if(fixedChanged){this.fixedSources=fixed;this.fixedKey=nextFixedKey;}
  if(rasterChanged)this.rasterRevision++;if(sourcesChanged)this.visionRevision++;
  this.identity=nextIdentity;
  return {reset,rasterChanged,sourcesChanged,fixedChanged,changedRows:vp.changes.length+ep.changes.length,cellsWritten};
 }
 stateAt(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=COLS*3||y>=ROWS*3||!this.visible)return 0;const i=Math.floor(y/3)*COLS+Math.floor(x/3);return this.visible[i]?2:this.explored[i]?1:0;}
 bindings(){return {fogVisible:this.visible,fogExplored:this.explored,fogCols:COLS,fogRows:ROWS,fogRevision:this.rasterRevision,fogVisionRevision:this.visionRevision,fogFixedCoverage:this.fixedKey,fogVisionSources:()=>this.sources};}
 dispose(){this.visible=this.explored=null;this.visibleRows=this.exploredRows=null;this.sources=this.fixedSources=this.fixedKey=this.identity=null;this.disposed=true;}
}
module.exports={FogRasterStore,COLS,ROWS,CELLS};
