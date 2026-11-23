'use strict';
const {COLS,ROWS}=require('./fog-raster-store');
const {isOwnedVision}=require('./trusted-vision');
// A private vision proof guarantees deeply immutable row arrays. Coverage is
// structural only; it never grants room membership, visibility or authority.
const rowCoverage=new WeakMap();
function completeRows(rows,owned){
 if(!Array.isArray(rows)||rows.length!==ROWS)return false;
 if(owned&&rowCoverage.has(rows))return rowCoverage.get(rows);
 const complete=rows.every((line,y)=>line.length===3&&line[0]===y&&line[1]===0&&line[2]===COLS);
 if(owned)rowCoverage.set(rows,complete);return complete;
}
// Only a fully validated, server-authorized complete vision can take this
// allocation-free path. It cannot turn a cropped authority packet into a world.
function completeVision(v){if(!v||v.cols!==COLS||v.rows!==ROWS)return false;const owned=isOwnedVision(v);return completeRows(v.visible,owned)&&completeRows(v.explored,owned);}
class UnfoggedVisionStore {
 constructor(){this.unfogged=true;this.sources=[];this.fixedKey={};this.identity=null;this.revision=0;}
 applyValidated(v,identity){if(this.disposed)throw Error('FOG_STORE_DISPOSED');if(!completeVision(v))throw Error('INCOMPLETE_UNFOGGED_VISION');if(!identity||typeof identity.roomId!=='string'||!identity.roomId||typeof identity.viewerOwnerId!=='string'||!identity.viewerOwnerId||!Number.isSafeInteger(identity.epoch)||identity.epoch<1)throw Error('INVALID_FOG_IDENTITY');this.identity={...identity};this.revision=v.revision;}
 stateAt(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<COLS*3&&y<ROWS*3?2:0;}
 bindings(){return {fogVisible:null,fogExplored:null,fogCols:COLS,fogRows:ROWS,fogRevision:this.revision,fogVisionRevision:this.revision,fogFixedCoverage:this.fixedKey,fogVisionSources:()=>this.sources};}
 dispose(){this.disposed=true;this.identity=this.fixedKey=null;this.sources=[];}
}
module.exports={completeVision,UnfoggedVisionStore};
