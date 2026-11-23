'use strict';
// Reuses the exact drawImage source/crop/transform selected by the native animation.
// A single preallocated GPU scratch canvas; no readback, source mutation, pose snapshots,
// cached character geometry, image creation, or canvas resize on a gameplay frame.
const COLORS={fury:'#ff354d',fortress:'#ffdc61',harvest:'#57ff9c'};
function create({createCanvas,size=512,clock=()=>0,enabled=()=>true}){
 const scratch=createCanvas();scratch.width=scratch.height=size;const sc=scratch.getContext('2d');const proxies=new WeakMap();let draws=0,skips=0;
 function decorate(ctx,kind){if(!COLORS[kind]||!enabled())return ctx;let map=proxies.get(ctx);if(!map){map=new Map();proxies.set(ctx,map);}if(map.has(kind))return map.get(kind);
 const draw=ctx.drawImage.bind(ctx),color=COLORS[kind],bound=new Map();const proxy=new Proxy(ctx,{get(target,key){if(key==='drawImage')return paint;if(key==='__cardTintContext')return true;const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;if(!bound.has(key))bound.set(key,v.bind(target));return bound.get(key);},set(target,key,v){return Reflect.set(target,key,v,target);}});
 function paint(source,...a){draw(source,...a);if(!source||source===scratch||!enabled()||ctx.globalAlpha<=0||ctx.globalCompositeOperation!=='source-over')return;let sx=0,sy=0,sw=source.width,sh=source.height,dx,dy,dw,dh;if(a.length===2){[dx,dy]=a;dw=sw;dh=sh;}else if(a.length===4){[dx,dy,dw,dh]=a;}else if(a.length===8){[sx,sy,sw,sh,dx,dy,dw,dh]=a;}else return;if(![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||sw<=0||sh<=0||dw<=0||dh<=0||dw>size||dh>size){skips++;return;}
  const w=Math.min(size,Math.max(1,Math.ceil(dw*2))),h=Math.min(size,Math.max(1,Math.ceil(dh*2)));
  sc.setTransform(1,0,0,1,0,0);sc.globalAlpha=1;sc.globalCompositeOperation='source-over';sc.clearRect(0,0,w,h);sc.drawImage(source,sx,sy,sw,sh,0,0,w,h);sc.globalCompositeOperation='source-atop';sc.fillStyle=color;sc.globalAlpha=.42;sc.fillRect(0,0,w,h);sc.globalAlpha=1;sc.globalCompositeOperation='source-over';
  const alpha=ctx.globalAlpha;ctx.save();ctx.globalAlpha=alpha*(.41+.10*Math.sin(clock()/1000*2.8));ctx.shadowColor=color;ctx.shadowBlur=16;draw(scratch,0,0,w,h,dx,dy,dw,dh);ctx.shadowBlur=0;ctx.globalAlpha=alpha*.50;draw(scratch,0,0,w,h,dx,dy,dw,dh);ctx.restore();draws++;
 }
 map.set(kind,proxy);return proxy;
 }
 return{decorate,stats:()=>({draws,skips,canvasCount:1,rgbaBytes:size*size*4,usesPixelReadback:false})};
}
module.exports={create};
