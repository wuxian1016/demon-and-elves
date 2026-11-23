const {isPlainRecord}=require('./plain-record');
// Exact integer transport encoding, never a visibility approximation.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const fail=()=>{throw Error('PRESENTATION_REBASE_REQUIRED');};
function base64(bytes){let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);out+=alphabet[n>>>18]+alphabet[(n>>>12)&63]+(i+1<bytes.length?alphabet[(n>>>6)&63]:'=')+(i+2<bytes.length?alphabet[n&63]:'=');}return out;}
// Canonical base64 decoding into one bounded native allocation. Table lookups
// avoid temporary byte arrays and repeated alphabet scans; invalid glyphs,
// misplaced padding and nonzero unused padding bits remain rejected.
const base64Values=new Int16Array(128);base64Values.fill(-1);for(let i=0;i<alphabet.length;i++)base64Values[alphabet.charCodeAt(i)]=i;
function unbase64(text){
 if(typeof text!=='string'||text.length>666668||text.length%4)fail();
 const n=text.length;if(!n)return new Uint8Array(0);
 const padding=text[n-1]==='='?(text[n-2]==='='?2:1):0,out=new Uint8Array(n/4*3-padding);
 let at=0;
 for(let i=0;i<n;i+=4){
  const aa=text.charCodeAt(i),bb=text.charCodeAt(i+1),cc=text.charCodeAt(i+2),dd=text.charCodeAt(i+3);
  if((aa|bb|cc|dd)>127)fail();
  const a=base64Values[aa],b=base64Values[bb],c=base64Values[cc],d=base64Values[dd];
  if(a<0||b<0)fail();
  out[at++]=(a<<2)|(b>>>4);
  if(i===n-4&&padding){
   if(padding===2){if(cc!==61||dd!==61||(b&15))fail();}
   else{if(c<0||dd!==61||(c&3))fail();out[at++]=((b&15)<<4)|(c>>>2);}
  }else{if(c<0||d<0)fail();out[at++]=((b&15)<<4)|(c>>>2);out[at++]=((c&3)<<6)|d;}
 }
 return out;
}
function encodeVisionRows(before,rows){
 const old=before instanceof Map?before:new Map(before.map(r=>[r[0],r])),bytes=[];const put=n=>{if(!Number.isSafeInteger(n)||n<0||n>0x7fffffff)fail();while(n>=128){bytes.push((n%128)|128);n=Math.floor(n/128);}bytes.push(n);};put(rows.length);let priorRow=-1;
 for(const row of rows){put(row[0]-priorRow-1);priorRow=row[0];const previous=old.get(row[0]);const changed=previous?.length===row.length?row.map((v,i)=>i>0&&v!==previous[i]?i:0).filter(Boolean):null;
  // mode1 replaces exact changed boundaries relative to this row's baseline.
  if(changed&&changed.length*2+1<row.length){put(1);put(changed.length);let previousIndex=0;for(const i of changed){put(i-previousIndex-1);previousIndex=i;const d=row[i]-previous[i];put(d>=0?d*2:-d*2-1);}}
  else{put(0);put((row.length-1)/2);let end=0;for(let i=1;i<row.length;i+=2){put(row[i]-end);put(row[i+1]-row[i]);end=row[i+1];}}
 }
 return {encoding:'vision-rows-v1',data:base64(bytes)};
}
const trustedBatches=new WeakSet();
function decodeRows(before,packed,rowLimit,colLimit,owned=false){
 if(!isPlainRecord(packed,{allowNullPrototype:false})||Object.keys(packed).length!==2||packed.encoding!=='vision-rows-v1'||!Number.isInteger(rowLimit)||!Number.isInteger(colLimit)||rowLimit<1||colLimit<1||owned&&(rowLimit!==2667||colLimit!==3334||!before||typeof before.get!=='function'))fail();
 const bytes=unbase64(packed.data),old=owned?before:new Map(before.map(r=>[r[0],r]));let at=0,budget=500000;
 const get=()=>{let n=0,m=1,count=0,last;do{if(at>=bytes.length||++count>5||--budget<0)fail();last=bytes[at++];n+=(last&127)*m;m*=128;}while(last&128);if(n>0x7fffffff||count>1&&last===0)fail();return n;};
 const count=get();if(count>rowLimit)fail();const result=[];let priorRow=-1;
 for(let i=0;i<count;i++){const id=priorRow+get()+1;if(id<0||id>=rowLimit)fail();priorRow=id;const mode=get(),n=get();let row;
  if(mode===1){const previous=old.get(id);if(!previous||n>previous.length-1)fail();row=owned?Array.from(previous):previous.slice();let index=0;for(let j=0;j<n;j++){index+=get()+1;if(index>=row.length)fail();const value=get(),d=value%2?-(value+1)/2:value/2;row[index]+=d;}}
  else if(mode===0){if(n<1||n>colLimit)fail();row=[id];let end=0;for(let j=0;j<n;j++){const start=end+get();end=start+get();row.push(start,end);}}
  else fail();let end=-1,adjacent=false;for(let j=1;j<row.length;j+=2){if(!Number.isInteger(row[j])||!Number.isInteger(row[j+1])||row[j]<0||row[j]<end||row[j+1]<=row[j]||row[j+1]>colLimit)fail();if(row[j]===end)adjacent=true;end=row[j+1];}if(owned){if(row.length<3||row.length%2!==1||row.length>colLimit+1||adjacent)throw Error('INVALID_SNAPSHOT');Object.freeze(row);}result.push(row);
 }
 if(at!==bytes.length)fail();if(owned){Object.freeze(result);trustedBatches.add(result);}return result;
}

function decodeVisionRows(before,packed,rowLimit,colLimit){return decodeRows(before,packed,rowLimit,colLimit);}
// Only this decoder can produce a batch proof. Shared-vision cache callers use
// their private accepted baseline lookup; external JSON cannot forge the proof.
function decodeTrustedVisionRows(beforeLookup,packed,rowLimit,colLimit){return decodeRows(beforeLookup,packed,rowLimit,colLimit,true);}
module.exports={encodeVisionRows,decodeVisionRows,decodeTrustedVisionRows,isTrustedVisionBatch:batch=>trustedBatches.has(batch)};
