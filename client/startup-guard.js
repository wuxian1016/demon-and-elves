'use strict';
// The first canvas is the visible Mini Game canvas. Runtime must reuse it.
const resizeCanvasBacking=require('./network/resize-canvas-backing');
const BUILD=require('./asset-config').config.diagnosticBuild;
const detail=require('./network/startup-error-detail');
const KEY='forest-startup-diagnostics-v1';
let api=null,primary=null,phase='启动入口',done=false,failed=false,scheduled=null;
let prior=null,events=[],started=0,stoneRetry=null,firstError=null,generation=0,visibleError=null;
function canvas(wx){if(!primary)primary=wx.createCanvas();return primary;}
function record(kind,detail=''){
  events.push({kind,phase,time:Date.now(),detail:String(detail).slice(0,500)});
  if(events.length>12)events.shift();
  try{api?.setStorageSync?.(KEY,{build:BUILD,started,events:events.slice(),previous:prior,firstError});}catch(_){}
}
function paint(error){
  try{
    const surface=canvas(api),ctx=surface.getContext('2d');
    if(!ctx)throw Error('2D canvas unavailable');
    let info={};try{info=api.getWindowInfo?.()||api.getSystemInfoSync?.()||{};}catch(_){}
    const width=Number(info.windowWidth)||390,height=Number(info.windowHeight)||844;
    const scale=Math.max(1,Math.min(2,Number(info.pixelRatio)||1));
    resizeCanvasBacking(surface,Math.round(width*scale),Math.round(height*scale));
    ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='#07131d';ctx.fillRect(0,0,width,height);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f6f1dc';ctx.font='bold 23px sans-serif';
    ctx.fillText(error?'暂时无法启动':'恶魔与精灵',width/2,error?height*.26:height*.4,width-36);
    ctx.font='15px sans-serif';ctx.fillStyle='#d9f5ff';
    ctx.fillText(error?'失败阶段：'+phase:'正在准备游戏…',width/2,height*(error?.26:.4)+38,width-36);
    if(error){
      ctx.textAlign='left';ctx.font='13px sans-serif';ctx.fillStyle='#ffcfac';
      const rowWidth=width-48,max=Math.max(12,Math.floor(rowWidth/8));
      const chunks=Array.from(detail.describe(error));for(let i=0;i<7&&i*max<chunks.length;i++)ctx.fillText(chunks.slice(i*max,(i+1)*max).join(''),24,height*.26+72+i*17,rowWidth);
      ctx.textAlign='center';ctx.fillStyle='#294c42';ctx.fillRect(24,height*.63,width-48,44);ctx.fillStyle='#fff2cd';ctx.font='bold 15px sans-serif';ctx.fillText('复制报错',width/2,height*.63+22,width-60);
      ctx.fillStyle='#244354';ctx.fillRect(24,height*.63+54,width-48,44);ctx.fillStyle='#f1f8ff';ctx.fillText('重新加载',width/2,height*.63+76,width-60);
    }
    ctx.fillStyle='#b8c7cb';ctx.font='12px sans-serif';ctx.fillText(BUILD,width/2,height-42,width-24);
    return true;
  }catch(_){return false;}
}
function fail(error,options){
  if(done)return;
  if(failed){if(stoneRetry&&error?.code!=='STONE_RESOURCE_RETRY'){visibleError=error;stoneRetry=null;generation++;record('fatal-after-stone',error?.stack||detail.describe(error));paint(error);}return;}
  visibleError=error;
  generation++;failed=true;stoneRetry=error?.code==='STONE_RESOURCE_RETRY'&&typeof options?.retry==='function'?options.retry:null;firstError=firstError||String(error?.stack||error?.message||error);record('error',error?.stack||error?.message||error);
  if(!paint(error))try{api?.showModal?.({title:'启动未完成',content:detail.report(api,BUILD,phase,error),showCancel:false});}catch(_){}
}
function stage(value){if(done||failed)return;phase=String(value).slice(0,64);record('stage');}
function ready(){if(done||failed)return;record('ready');done=true;}
function run(wx,start){
  api=wx;started=Date.now();
  try{const old=wx.getStorageSync?.(KEY);if(old&&typeof old.build==='string'&&Array.isArray(old.events))prior={build:old.build.slice(0,80),started:Number(old.started)||0,events:old.events.slice(-12).map(e=>({kind:String(e.kind||'').slice(0,20),phase:String(e.phase||'').slice(0,64),time:Number(e.time)||0,detail:String(e.detail||'').slice(0,500)}))};}catch(_){}
  record('entry');
  // Register before runtime/module evaluation so a rejected startup promise is visible.
  try{wx.onError?.(e=>{if(!done)fail(e);});}catch(_){}
  try{wx.onTouchEnd?.(event=>{
    if(done||!failed||!visibleError)return;
    const touch=event?.changedTouches;if(touch?.length!==1)return;
    let info={};try{info=wx.getWindowInfo?.()||wx.getSystemInfoSync?.()||{};}catch(_){}
    const width=info.windowWidth||390,height=info.windowHeight||844,p=touch[0],x=p.clientX??p.x,y=p.clientY??p.y;
    if(x<24||x>width-24)return;
    const y0=height*.63;
    if(y>=y0&&y<=y0+44){
      const data=detail.report(wx,BUILD,phase,visibleError);
      const show=()=>{try{wx.showModal?.({title:'启动报错',content:data,showCancel:false});}catch(_){}};
      try{if(typeof wx.setClipboardData==='function')wx.setClipboardData({data,fail:show});else show();}catch(_){show();}
    }else if(y>=y0+54&&y<=y0+98){
      if(stoneRetry){const retry=stoneRetry;stoneRetry=null;failed=false;generation++;record('stone-retry');try{Promise.resolve(retry()).catch(e=>fail(e));}catch(e){fail(e);}return;}
      const manual=()=>{try{wx.showModal?.({title:'重新加载',content:'请关闭小游戏，再扫描测试码进入。不会清除存档。',showCancel:false});}catch(_){}};
      try{if(typeof wx.restartMiniProgram==='function')wx.restartMiniProgram({fail:manual});else manual();}catch(_){manual();}
    }
  });}catch(_){}
  try{wx.onUnhandledRejection?.(e=>{if(!done)fail(e?.reason||e);});}catch(_){}
  try{
    canvas(wx);paint();
    // Yield once, allowing the initial canvas to present before synchronous modules.
    let hidden=false,handedOff=false;
    const hide=()=>{hidden=true;};
    function scheduleEntry(){
      if(handedOff||hidden||scheduled!==null)return;
      scheduled=setTimeout(()=>{
        scheduled=null;
        if(hidden||handedOff)return;
        handedOff=true;
        wx.offHide?.(hide);wx.offShow?.(show);
        if(!failed)try{start();}catch(e){fail(e);}
      },0);
    }
    function show(){hidden=false;scheduleEntry();}
    wx.onHide?.(hide);wx.onShow?.(show);
    scheduleEntry();
  }catch(e){fail(e);}
}
module.exports={run,canvas,stage,ready,fail,stoneRetryAvailable:()=>!!stoneRetry,checkpoint:()=>generation,current:token=>token===generation&&!failed&&!done};
