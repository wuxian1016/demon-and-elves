'use strict';
const {Inflate}=require('./pako-inflate');
const indexes=new WeakMap(),magic=0x44415331,rawSize=574042;
function index(d){
 const n=d.byteLength;
 if(n<8||d.getUint32(0)!==magic||d.getUint16(6,true)!==0)return null;
 const count=d.getUint16(4,true),head=8+12*count;
 if(!count||count>64||head>n)return null;
 const out=new Map();let end=head;
 for(let i=0;i<count;i++){
  const p=8+12*i,key=d.getUint32(p,true),start=d.getUint32(p+4,true),bytes=d.getUint32(p+8,true);
  if(key>=rawSize||start!==end||bytes<8||start+bytes>n||out.has(key))return null;
  out.set(key,[start,bytes]);end=start+bytes;
 }
 return end===n?out:null;
}
module.exports=function* openCue(bank,row){
 try{
  if(bank.byteLength===rawSize&&bank.getUint32(0)!==magic)return bank;
  if(!indexes.has(bank))indexes.set(bank,index(bank));
  const hit=indexes.get(bank)?.get(row.offset),n=row.length;
  if(!hit||!Number.isInteger(n)||n<1||n>32768)return null;
  const [start,bytes]=hit,packed=new Uint8Array(bank.buffer,bank.byteOffset+start,bytes),lanes=new Uint8Array(n*2);
  const z=new Inflate({chunkSize:4096});let filled=0;
  z.onData=b=>{if(filled+b.length>lanes.length)throw Error('Invalid audio cue length');lanes.set(b,filled);filled+=b.length;};
  for(let at=0;at<packed.length;at+=2048){
   const end=Math.min(at+2048,packed.length);
   if(!z.push(packed.subarray(at,end),end===packed.length)||z.err)return null;
   yield;
  }
  if(!z.ended||filled!==lanes.length)return null;
  const decoded=new DataView(new ArrayBuffer(n*2));let last=0;
  for(let i=0;i<n;i++){
   last=(last+lanes[i]+256*lanes[n+i])&65535;decoded.setUint16(i*2,last,true);
   if((i&4095)===4095)yield;
  }
  return decoded;
 }catch(_){return null;}
};
