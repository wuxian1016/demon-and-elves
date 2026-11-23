'use strict';
module.exports=function(x,y,w,h,paint,started,wxRuntime,performance){
 const prev=this.edgeView200;this.edgeView200={x,y,w,h};
 if(!prev||Math.abs(prev.w-w)>.01||Math.abs(prev.h-h)>.01||wxRuntime?.memoryConstrained?.()||performance.now()-started>=2)return;
 const dx=x-prev.x,dy=y-prev.y,n=this.size,rect=this.visibleCells614;
 if(!rect||Math.max(Math.abs(dx),Math.abs(dy))<.01||Math.abs(dx)>n||Math.abs(dy)>n)return;
 const deltaX=dx>0?(rect.x1+1)*n-x-w:x-rect.x0*n,deltaY=dy>0?(rect.y1+1)*n-y-h:y-rect.y0*n;
 const candX=dx&&deltaX<=Math.max(72,Math.min(n,Math.abs(dx)*16)),candY=dy&&deltaY<=Math.max(72,Math.min(n,Math.abs(dy)*16));
 if(!candX&&!candY)return;
 const alongX=candX&&(!candY||deltaX/Math.abs(dx)<=deltaY/Math.abs(dy));
 const fixed=alongX?(dx>0?rect.x1+1:rect.x0-1):(dy>0?rect.y1+1:rect.y0-1);
 const lo=alongX?rect.y0:rect.x0,hi=alongX?rect.y1:rect.x1,want=this.wanted566;
 if(hi-lo>13)return;
 const front=this.front,z=this.scale,sz=n*z,bytes=(Math.ceil(sz)+4)**2*4,keys=[];let next=null;
 const horizontal=alongX&&fixed*n===front.x+front.w&&front.art.width>=(front.w+n)*z;
 const vertical=!alongX&&fixed*n===front.y+front.h&&front.art.height>=(front.h+n)*z;
 const staged=(horizontal||vertical)?(front.edge200||(front.edge200=new Map())):null;
 const mid=(lo+hi)>>1;
 for(let j=0;j<=hi-lo;j++){
  const i=mid+(j%2?((j+1)>>1):-(j>>1)),gx=alongX?fixed:i,gy=alongX?i:fixed;
  if(i<lo||i>hi)continue;
  const key=gx+','+gy,t=this.tiles.get(key);keys.push(key);
  if(!next&&(!t||t.dirty||staged&&staged.get(key)!==t)){
   const x=gx*n,y=gy*n,sx=(x-front.x)*z,sy=(y-front.y)*z;
   const ready=!!(staged&&sx>=0&&sy>=0&&sx+sz<=front.art.width&&sy+sz<=front.art.height);
   if(!t||t.dirty||ready)next={key,x,y,sx,sy,ready,t};
  }
 }
 if(!next)return;
 if(!next.t&&this.bytes+bytes>this.budget){
  if(this.tiles.size<=want.size+keys.length)return;
  let available=false;
  for(const [k,t] of this.tiles)if(t.art&&!want.has(k)&&!keys.includes(k)){available=true;break;}
  if(!available)return;
 }
 let tile=next.t;
 if(!tile||tile.dirty){
  for(const k of keys)want.add(k);
  const rebuilt=this.rebuilds;
  try{tile=this.paint({key:next.key,x:next.x,y:next.y},paint);this.rebuilds=rebuilt;}finally{for(const k of keys)want.delete(k);}
 }
 if(next.ready&&tile?.art&&performance.now()-started<2){
  const c=front.art.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=false;c.clearRect(next.sx,next.sy,sz,sz);
  c.drawImage(tile.art,2,2,sz,sz,next.sx,next.sy,sz,sz);staged.set(next.key,tile);
 }
};
