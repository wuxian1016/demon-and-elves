'use strict';
// Visual and hitbox only. Host calls draw/tap after its UI-safe/reserved areas
// are resolved; do not swallow joystick, world taps or unrelated HUD buttons.
module.exports=function footer(controller,wake=()=>{},opts={}){
 let visible=null;
 const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 const inside=(b,x,y)=>x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h;
 function draw(ctx,safe,blocked=[]){
  visible=null;const wall=controller.offer();
  if(!wall||!safe||![safe.x,safe.y,safe.w,safe.h].every(Number.isFinite)||safe.w<272||safe.h<104)return false;
  const w=Math.min(335,safe.w-12),x=safe.x+(safe.w-w)/2,h=78;
  let rect;
  for(const inset of [8,96,184]){
   const y=safe.y+safe.h-h-inset,possible={x,y,w,h};
   if(y>=safe.y+8&&!blocked.some(p=>overlap(possible,p))){rect=possible;break;}
  }
  if(!rect||controller.present&&controller.present(wall)!==true)return false;
  const y=rect.y,bh=38,top=y+32,inner=w-16,bw=Math.floor((inner-8)*.60),watch={x:x+8,y:top,w:bw,h:bh},skip={x:x+16+bw,y:top,w:inner-8-bw,h:bh};
  ctx.save();try{
   ctx.globalAlpha=1;ctx.fillStyle='rgba(18,35,29,.97)';ctx.fillRect(x,y,w,h);
   ctx.lineWidth=1.5;ctx.strokeStyle='#e0bc6b';ctx.strokeRect(x,y,w,h);
   ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillStyle='#ffe0a2';ctx.fillText(opts.title?.(wall)||'城墙已被摧毁，可选择重建这段城墙',x+w/2,y+17);
   const words=typeof controller.labels==='function'?controller.labels(wall):controller.labels;
   for(const [i,b,t] of [[0,watch,words.watch],[1,skip,words.skip]]){
    ctx.fillStyle=i?'#30443a':'#c49849';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=i?'#fff3d1':'#201807';ctx.fillText(t,b.x+b.w/2,b.y+b.h/2);
   }
  }finally{ctx.restore();}
  visible={wall,watch,skip};return true;
 }
 function tap(x,y){
  const row=visible;if(!row||controller.offer()!==row.wall)return false;
  let handled=false;
  if(inside(row.watch,x,y))handled=controller.watch(row.wall);
  else if(inside(row.skip,x,y))handled=controller.dismiss(row.wall);
  if(handled){visible=null;wake();}return handled;
 }
 return {draw,tap,hit(x,y){
  if(!visible||controller.offer()!==visible.wall)return null;
  return inside(visible.watch,x,y)?'watch':inside(visible.skip,x,y)?'skip':null;
 },invalidate(){visible=null;}};
};
