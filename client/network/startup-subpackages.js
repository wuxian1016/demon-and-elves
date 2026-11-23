'use strict';
// All visual packages finish before the game module starts. One shared in-flight load.
let inflight=null;
module.exports=function load(wx,runtime,progress,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(runtime.preparedLayout&&runtime.matchSpritesAReady&&runtime.matchSpritesBReady&&runtime.batArtReadyBN)return Promise.resolve(runtime.ensureBatCargoReadyBN?.()||runtime.batCargoReadyPromiseBN);
 if(inflight)return inflight;
 const packs=[{name:'art163',prepare:()=>runtime.ensureMetadataBN?.(),ready:()=>!!runtime.preparedLayout},
  {name:'matchSpritesA',ready:()=>runtime.matchSpritesAReady===true},
  {name:'matchSpritesB',ready:()=>runtime.matchSpritesBReady===true},
  {name:'batArt',ready:()=>runtime.batArtReadyBN===true}];
 inflight=(async()=>{for(let i=0;i<packs.length;i++){const p=packs[i];if(p.ready())continue;
 if(p.name==='art163'&&runtime.homeArtPackageReadyBN){await p.prepare();if(!p.ready())throw Error('art163分包内容缺失');continue;}
 await new Promise((resolve,reject)=>{let done=false;const finish=err=>{if(done)return;done=true;clearTimer(timer);err?reject(err):resolve();};
 const timer=setTimer(()=>finish(Error(p.name+'分包加载超时，请重试')),45000);
 try{const task=wx.loadSubpackage({name:p.name,success:()=>{Promise.resolve().then(()=>p.prepare?.()).then(()=>p.ready()?finish():finish(Error(p.name+'分包内容缺失')),finish)},fail:e=>finish(Error(p.name+'分包加载失败：'+(e?.errMsg||e)))});task?.onProgressUpdate?.(r=>progress?.((i*100+(r.progress||0))/packs.length,r.totalBytesWritten||0,r.totalBytesExpectedToWrite||0));}catch(e){finish(e);}
 });}await (runtime.ensureBatCargoReadyBN?.()||runtime.batCargoReadyPromiseBN);progress?.(100,0,0);})();
 const result=inflight;result.finally(()=>{if(inflight===result)inflight=null;}).catch(()=>{});return result;
};
