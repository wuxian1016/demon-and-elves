'use strict';
const clean=value=>String(value??'').replace(/[\x00-\x1f\x7f\s]+/g,' ').trim();
function describe(error){
 if(typeof error==='string')return clean(error)||'未知启动错误';
 const message=clean(error?.errMsg||error?.message||error?.reason||error?.name);
 const code=clean(error?.errCode??error?.code);
 return ((message||'未知启动错误')+(code&&!message.includes(code)?'（'+code+'）':'')).slice(0,320);
}
function deviceSummary(wx){
 let d={},a={};try{d=wx.getDeviceInfo?.()||wx.getSystemInfoSync?.()||{};}catch(_){}try{a=wx.getAppBaseInfo?.()||{};}catch(_){}
 return [d.platform,d.system,a.version||d.version,a.SDKVersion||d.SDKVersion].map(clean).filter(Boolean).join(' · ').slice(0,150);
}
function report(wx,build,phase,error){
 return ['版本：'+build,'阶段：'+clean(phase),'错误：'+describe(error),deviceSummary(wx)].filter(Boolean).join('\n');
}
module.exports={describe,report};
