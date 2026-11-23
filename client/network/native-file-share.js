'use strict';
const states=new WeakMap();
function stateFor(wx){let state=states.get(wx);if(!state)states.set(wx,state={attempts:[],pending:false});return state;}
function fileShareObservation(wx){
 let platform='',version='',sdk='',declared=null;
 for(const method of ['getDeviceInfo','getSystemInfoSync'])try{platform=wx[method]?.()?.platform||platform;if(platform)break;}catch(_){}
 try{const info=wx.getAppBaseInfo?.()||{};version=String(info.version||'').slice(0,32);sdk=String(info.SDKVersion||'').slice(0,32);}catch(_){}
 try{if(typeof wx.canIUse==='function')declared=wx.canIUse('shareFileMessage')===true;}catch(_){}
 return{schema:1,platform:String(platform).slice(0,24),wechatVersion:version,SDKVersion:sdk,functionPresent:typeof wx.shareFileMessage==='function',declaredSupported:declared,chooserObserved:'not-automatically-observable',deliveryVerified:false,attempts:stateFor(wx).attempts.map(x=>({...x}))};
}
function requestNativeFileShare(wx,filePath,fileName,{timeoutMs=120000,clock=Date.now}={}){
 const state=stateFor(wx);if(state.pending)return Promise.resolve({status:'busy',observation:fileShareObservation(wx)});
 if(typeof wx.shareFileMessage!=='function')return Promise.resolve({status:'unavailable',observation:fileShareObservation(wx)});
 // This function must only be invoked by a second explicit user action after
 // generating the diagnostic file. It never picks a recipient.
 state.pending=true;const row={time:clock(),result:'requested',codeClass:null};state.attempts.push(row);if(state.attempts.length>8)state.attempts.shift();
 return new Promise(resolve=>{let ended=false;const finish=(result,error)=>{if(ended)return;ended=true;clearTimeout(timer);state.pending=false;row.result=result;row.elapsedMs=Math.max(0,Math.min(600000,clock()-row.time));
  if(error){const text=String(error.errMsg||error.message||'');row.codeClass=/cancel/i.test(text)?'cancel':/not support|unsupported|not available|not a function|not implemented|invalid scope/i.test(text)?'unsupported':/permission|denied|forbidden/i.test(text)?'denied':'other';}
  resolve({status:result,codeClass:row.codeClass,observation:fileShareObservation(wx)});
 };const timer=setTimeout(()=>finish('callback-not-observed'),timeoutMs);
 try{wx.shareFileMessage({filePath,fileName,success:()=>finish('sdk-success'),fail:error=>finish('sdk-failed',error)});}catch(error){finish('sdk-failed',error);}
 });
}
module.exports={fileShareObservation,requestNativeFileShare};
