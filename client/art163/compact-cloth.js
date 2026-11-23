'use strict';

// Each run stores the gap from the previous end, the pixel count, and shade/alpha pairs.
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Values=new Int16Array(128).fill(-1);
for(let i=0;i<alphabet.length;i++) base64Values[alphabet.charCodeAt(i)]=i;

function unpackBase64(text,wx) {
  if(typeof wx.base64ToArrayBuffer==='function') return new Uint8Array(wx.base64ToArrayBuffer(text));
  if(typeof Uint8Array.fromBase64==='function') return Uint8Array.fromBase64(text);
  const end=text.indexOf('=');
  const n=end<0?text.length:end;
  const bytes=new Uint8Array(Math.floor(n*6/8));
  let bits=0, buffered=0, pos=0;
  for(let i=0;i<n;i++) {
    const code=text.charCodeAt(i), value=base64Values[code];
    if(value===undefined||value<0) throw Error('无效的染色遮罩编码');
    buffered=(buffered<<6)|value;
    bits+=6;
    if(bits>=8) {
      bits-=8;
      bytes[pos++]=(buffered>>bits)&255;
    }
  }
  return bytes;
}

module.exports=function unpackMask(mask,wx) {
  const {w,h,count,runCount,sampleBytes,runsB64}=mask;
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>4000000||
     !Number.isInteger(runCount)||runCount<0||runCount>w*h||
     !Number.isInteger(sampleBytes)||sampleBytes<0||sampleBytes>2*w*h||
     typeof runsB64!=='string') throw Error('无效的染色遮罩尺寸');
  const bytes=unpackBase64(runsB64,wx);
  const samples=new Uint8Array(sampleBytes), offsets=new Uint32Array(2*runCount);
  let pos=0, cursor=0, end=0;
  function readUint() {
    let value=0;
    for(let shift=0;shift<=21 && pos<bytes.length;shift+=7) {
      const byte=bytes[pos++];
      value+=(byte&127)*2**shift;
      if(byte<128) return value;
    }
    throw Error('损坏的染色遮罩索引');
  }
  for(let i=0;i<runCount;i++) {
    const start=end+readUint(), length=readUint();
    end=start+length;
    const n=2*length;
    if(!length||end>w*h||cursor+n>sampleBytes||pos+n>bytes.length) throw Error('染色遮罩越界');
    offsets[2*i]=start;
    samples.set(bytes.subarray(pos,pos+n),cursor);
    pos+=n;
    cursor+=n;
    offsets[2*i+1]=cursor;
  }
  if(cursor!==sampleBytes||pos!==bytes.length) throw Error('染色遮罩数据不完整');
  return {w,h,count,samples,offsets};
};
