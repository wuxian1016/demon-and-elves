'use strict';
const fs=require('node:fs'),path=require('node:path'),A=require('node:assert/strict'),{makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const [root,mode]=process.argv.slice(2),fix=mode!=='before',fail=mode==='retry',work=fs.mkdtempSync(path.join(__dirname,'asset-host-'));fs.writeFileSync(path.join(work,'keys.json'),'{}');
const h=makeHost(root,work,false,{width:390,height:844,clockStart:1800000000000,seed:150});
const reads=[],mk=h.wx.createImage,L=h.wx.loadSubpackage,pkgs=[];let inject=fail?1:0;
h.wx.createImage=function(){const i=mk.call(this),d=Object.getOwnPropertyDescriptor(i,'src');Object.defineProperty(i,'src',{...d,set(s){reads.push(s);if(inject&&s?.endsWith('/griffin.webp.bin')){inject--;queueMicrotask(()=>i.onerror?.({errMsg:'one-time QA read failure'}));return;}return d.set.call(this,s);}});return i;};
h.wx.loadSubpackage=function(o){pkgs.push(o.name);if(o.name==='monsterRearMotion'){queueMicrotask(()=>o.fail?.({errMsg:'controlled demand failure'}));return {onProgressUpdate(){}};}return L.call(this,o);};
const trace=[];const ctx=new Proxy({drawImage(im,...pos){trace.push([im.src,...pos]);}},{get(t,k){if(k in t)return t[k];return ()=>{};}});
(async()=>{
 h.start();await until(()=>h.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','ready',25000);
 const {window:w,runtime}=h.env(),g=w.game,{Hound}=w.originalNetwork627.types;
 A.equal(reads.filter(x=>x?.endsWith('/griffin.webp.bin')).length,0,'not decoded at Home');
 h.emit('MemoryWarning',{level:10});A.equal(runtime.memoryConstrained(),true);
 const gr=new Hound(1000,900,13);Object.assign(gr,{waveGriffinBN:true,enemyKind:'griffin',griffinOrdinalBN:0,airborne:true,griffinAltitudeBN:48,griffinFacingBN:1,griffinRearBN:false});
 if(fail){
  A.equal(await w.griffinArtBN.warm(),false);A.equal(w.griffinArtBN.ready,false);
  A.equal(await w.griffinArtBN.warm(),false);
  A.equal(reads.filter(x=>x?.endsWith('/griffin.webp.bin')).length,1);
  h.advance(12001);
 }
 A.equal(await w.griffinArtBN.warm(),fix);
 await until(()=>{trace.length=0;gr.draw(ctx);return trace.some(v=>String(v[0]).includes('griffin.webp.bin')||String(v[0]).includes('monster-species-lite'));},'real Hound.draw art',6500);
 const record={};for(const rear of [false,true]){gr.griffinRearBN=rear;trace.length=0;for(const t of [0,145,290,435,580]){g.supportTime=t;gr.draw(ctx);}record[rear?'rear':'front']=trace.map(v=>[v[0],...v.slice(1,5)]);A.equal(new Set(trace.map(v=>v.slice(1,5).join(','))).size,fix?4:2);}
 A.equal(reads.filter(x=>x?.endsWith('/griffin.webp.bin')).length,fail?2:fix?1:0);
 A.equal(pkgs.filter(x=>x==='monsterRearMotion').length,0);
 gr.airborne=false;trace.length=0;for(const t of [0,145,290,435]){g.supportTime=t;gr.draw(ctx);}A.equal(new Set(trace.map(v=>v.slice(1,5).join(','))).size,1);
 if(!fail){
  const sheet=createCanvas(4*104,2*122),out=sheet.getContext('2d');
  out.fillStyle='#94aa47';out.fillRect(0,0,sheet.width,sheet.height);
  const source=await loadImage(fs.readFileSync(path.join(root,fix?'art163/griffin.webp.bin':'art163/monster-species-lite.webp.bin')));
  const sprite=createCanvas(104,122),c=sprite.getContext('2d'),nativeDraw=c.drawImage.bind(c);
  c.drawImage=(img,...v)=>nativeDraw(source,...v);
  const sha=require('crypto').createHash;
  const fingerprints=[];
  gr.x=75;gr.y=138;gr.airborne=true;
  for(const [row,rear] of [false,true].entries()){
   gr.griffinRearBN=rear;const sig=[];
   for(let i=0;i<4;i++){
    g.supportTime=i*145;sprite.width=104;sprite.height=122;c.clearRect(0,0,104,122);
    c.save();c.scale(.65,.65);gr.draw(c);c.restore();
    sig.push(sha('sha256').update(c.getImageData(0,0,104,122).data).digest('hex'));
    out.drawImage(sprite,i*104,row*122);
   }
   A.equal(new Set(sig).size,fix?4:2);fingerprints.push(sig.map(x=>x.slice(0,12)));
  }
  fs.writeFileSync(path.join(__dirname,'raster-'+mode+'.png'),sheet.toBuffer('image/png')); console.log(JSON.stringify({fingerprints}));
 }
 console.log(JSON.stringify({mode,record,pkgs,decoded:reads.filter(x=>x.includes('griffin.webp.bin'))}));process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
