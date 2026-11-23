'use strict';
// Cement is a recolor, not an animation or replacement sprite. The cache is
// keyed by immutable sprite/crop, not by building instance, timer, screen or tile.
const MAX_EDGE=416, BYTE_LIMIT=4*1024*1024, SLOT_LIMIT=12;
const shade=(r,g,b)=>Math.round(38+.71*(.2126*r+.7152*g+.0722*b));
function color(value){
 if(typeof value!=='string')return value;
 const s=value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!s)return value;
 const h=s[1].length===6?s[1]:s[1].replace(/./g,i=>i+i);
 const n=parseInt(h,16),v=shade(n>>16,(n>>8)&255,n&255);return 'rgb('+v+','+v+','+v+')';
}
function create({createCanvas}){
 const entries=[],decorated=new WeakMap();
 let bytes=0,reads=0,hits=0,allocations=0,flatFallbacks=0;
 function clear(){
  for(const e of entries){try{e.art.width=e.art.height=1;}catch(_){}}
  entries.length=0;bytes=0;
 }
 function prepare(source,sx,sy,sw,sh){
  for(let i=entries.length-1;i>=0;i--){
   const e=entries[i];
   if(e.source!==source||e.sx!==sx||e.sy!==sy||e.sw!==sw||e.sh!==sh||e.iw!==source.width||e.ih!==source.height)continue;
   if(i!==entries.length-1){entries.splice(i,1);entries.push(e);}hits++;return e.art;
  }
  const scale=Math.min(1,MAX_EDGE/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale)),size=w*h*4;
  let reusable=null;
  while(entries.length&&(bytes+size>BYTE_LIMIT||entries.length>=SLOT_LIMIT)){
   const e=entries.shift();bytes-=e.art.width*e.art.height*4;
   if(!reusable)reusable=e.art;
   else try{e.art.width=e.art.height=1;}catch(_){}
  }
  let art;
  try{
   art=reusable||createCanvas();if(!reusable)allocations++;
   if(art.width!==w)art.width=w;if(art.height!==h)art.height=h;
   const c=art.getContext('2d');c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.imageSmoothingEnabled=true;c.clearRect(0,0,w,h);
   c.drawImage(source,sx,sy,sw,sh,0,0,w,h);
   try{
    const pix=c.getImageData(0,0,w,h),d=pix.data;
    for(let i=0;i<d.length;i+=4)if(d[i+3])d[i]=d[i+1]=d[i+2]=shade(d[i],d[i+1],d[i+2]);
    c.putImageData(pix,0,0);reads++;
   }catch(_){
    // Safe where a renderer disallows readback: cement silhouette, same alpha.
    c.globalCompositeOperation='source-in';c.fillStyle='#939393';c.fillRect(0,0,w,h);c.globalCompositeOperation='source-over';flatFallbacks++;
   }
   entries.push({source,sx,sy,sw,sh,iw:source.width,ih:source.height,art});bytes+=size;return art;
  }catch(_){if(art)try{art.width=art.height=1;}catch(_){}return null;}
 }
 function paint(ctx,source,...a){
  if(!source?.width||!source?.height)return ctx.drawImage(source,...a);
  let sx=0,sy=0,sw=source.width,sh=source.height,dx,dy,dw=sw,dh=sh;
  if(a.length===2)[dx,dy]=a;
  else if(a.length===4)[dx,dy,dw,dh]=a;
  else if(a.length===8)[sx,sy,sw,sh,dx,dy,dw,dh]=a;
  else return ctx.drawImage(source,...a);
  if(![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||sw<=0||sh<=0||dw<=0||dh<=0)return ctx.drawImage(source,...a);
  const sprite=prepare(source,sx,sy,sw,sh);
  return sprite?ctx.drawImage(sprite,dx,dy,dw,dh):ctx.drawImage(source,...a);
 }
 // Only the original procedural/fallback body code is routed through this
 // context, never labels, combat effects, range circles or the world canvas.
 function fallback(ctx){
  if(decorated.has(ctx))return decorated.get(ctx);
  const bound=new Map(),draw=(source,...a)=>paint(ctx,source,...a);
  const proxy=new Proxy(ctx,{get(t,k){if(k==='drawImage')return draw;const v=Reflect.get(t,k,t);if(typeof v!=='function')return v;if(!bound.has(k))bound.set(k,v.bind(t));return bound.get(k);},
   set(t,k,v){return Reflect.set(t,k,k==='fillStyle'||k==='strokeStyle'?color(v):v,t);}});
  decorated.set(ctx,proxy);return proxy;
 }
 return {paint,fallback,clear,stats:()=>({entries:entries.length,bytes,reads,hits,allocations,flatFallbacks})};
}
module.exports={create,color};
