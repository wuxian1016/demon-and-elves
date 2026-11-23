'use strict';
const unit=x=>typeof x==='string'&&/^adunit-[a-z0-9]+$/i.test(x);
const finite=Number.isFinite;
const rect=r=>r&&[r.x,r.y,r.w,r.h].every(finite)&&r.w>0&&r.h>0;
const within=(a,b)=>a.x>=b.x&&a.y>=b.y&&a.x+a.w<=b.x+b.w&&a.y+a.h<=b.y+b.h;
const overlap=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const safely=(fn,...a)=>{try{return fn(...a);}catch{return undefined;}};

// Native coordinates are logical window pixels, not DPR canvas pixels.
// policy comes from verified template profiling, never from requested style.
module.exports=function lobbyCustom({
 wx,id,otherIds=[],live,layout,policy,measure,competing=()=>false
}){
 let visit=null,unsafeOverlay=false;
 const used=new WeakSet();
 const supported=unit(id)&&!otherIds.some(x=>unit(x)&&x.toLowerCase()===id.toLowerCase())&&
  typeof wx?.createCustomAd==='function'&&typeof live==='function'&&typeof layout==='function'&&typeof policy==='function';
 const allowed=r=>visit===r&&safely(live,r.id)===true&&safely(competing)===false&&!unsafeOverlay;
 function fit(r){
  const l=safely(layout,r.id);if(!l||l.nativeLogicalPixels!==true||l.revision==null||l.blockersVerified!==true||
   !rect(l.safe)||!rect(l.bottomSlot)||!within(l.bottomSlot,l.safe)||
   !Array.isArray(l.blockers)||!l.blockers.every(rect))return null;
  const p=safely(policy,l);if(!p||p.verified!==true||!finite(p.width)||!finite(p.height)||p.width<=0||p.height<=0)return null;
  const area=l.bottomSlot;
  const box={x:Math.floor(area.x+(area.w-p.width)/2),y:Math.floor(area.y+area.h-p.height),w:p.width,h:p.height};
  if(!within(box,area)||l.blockers.some(x=>overlap(box,x)))return null;
  return {revision:l.revision,box,fixed:p.fixed===true,profile:p.profile??null};
 }
 function fresh(r){
  const a=r.fit,b=fit(r);
  return !!(a&&b&&a.revision===b.revision&&a.fixed===b.fixed&&a.profile===b.profile&&
   ['x','y','w','h'].every(k=>a.box[k]===b.box[k]));
 }
 function retire(r){
  const a=r.ad,display=r.phase==='showing'||r.phase==='shown';r.ad=null;r.phase='retired';
  if(!a)return;
  for(const [off,cb] of [['offLoad',r.load],['offError',r.error],['offResize',r.resize],['offClose',r.close]])safely(()=>a[off]?.(cb));
  // Destroy is the mandatory lifetime boundary. Hide is optional and cannot
  // by itself make a delayed show() harmless. Try it if destroy actually throws.
  try{a.destroy();}catch{if(display){unsafeOverlay=true;safely(()=>a.hide?.());}}
 }
 function leave(){
  const r=visit;visit=null;if(r)retire(r);
 }
 function acceptedSize(r,size){
  return !!(size&&[size.width,size.height].every(finite)&&size.width>0&&size.height>0&&
   size.width<=r.fit.box.w&&size.height<=r.fit.box.h);
 }
 function entered(visitId,{noAd=false}={}){
  if(visitId==null||safely(live,visitId)!==true)return false;
  if(visit?.id===visitId)return true;
  leave();
  const r=visit={id:visitId,ad:null,phase:'none',fit:null,seenSize:null};
  if(!supported||noAd||!allowed(r)||(r.fit=fit(r))==null)return true;
  const {box,fixed}=r.fit;
  const a=safely(()=>wx.createCustomAd({adUnitId:id,style:{left:box.x,top:box.y,width:box.w}}));
  if(!a||typeof a!=='object'||used.has(a))return true;
  if(['destroy','show','onLoad','onError'].some(key=>typeof a[key]!=='function')||
   (!fixed&&typeof a.onResize!=='function')){
   safely(()=>a.destroy?.());return true;
  }
  used.add(a);r.ad=a;r.phase='loading';
  r.error=()=>{if(r.ad===a)retire(r);};
  r.close=r.error;
  r.resize=size=>{
   if(r.ad!==a)return;
   if(!allowed(r)||!fresh(r)||!acceptedSize(r,size)){retire(r);return;}
   r.seenSize={width:size.width,height:size.height};
   if(r.phase==='measuring')showMeasured(r.seenSize);
  };
  function showMeasured(size){
   if(r.ad!==a||!allowed(r)||!fresh(r)){retire(r);return;}
   if(size!=null&&!acceptedSize(r,size)){retire(r);return;}
   if(size==null&&!fixed){r.phase='measuring';return;}
   r.phase='showing';
   let promise;try{promise=a.show();}catch{retire(r);return;}
   Promise.resolve(promise).then(()=>{
    if(r.ad!==a)return;
    if(!allowed(r)||!fresh(r)){retire(r);return;}r.phase='shown';
   },r.error);
  }
  r.load=()=>{
   if(r.ad!==a||r.phase!=='loading')return;
   // Require real sizes while invisible for variable templates. A certified
   // dimension envelope on the exact fixed template is also sufficient.
   showMeasured(r.seenSize??(typeof measure==='function'?safely(measure,a):undefined));
  };
  try{
   a.onError(r.error);if(r.ad!==a)return true;
   a.onClose?.(r.close);if(r.ad!==a)return true;
   a.onResize?.(r.resize);if(r.ad!==a)return true;
   a.onLoad(r.load);
  }catch{retire(r);}
  return true;
 }
 function layoutChanged(){
  const r=visit;
  if(r?.ad&&(!allowed(r)||!fresh(r)))retire(r);
 }
 return {supported,entered,leave,layoutChanged,
  busy:()=>unsafeOverlay||!!visit&&['showing','shown'].includes(visit.phase)};
};
