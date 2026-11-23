'use strict';
// PERF-L3 (2026-11-23): ring prefetch for terrain tiles.
// Keeps the 1-tile ring around the visible terrain painted ahead of time (nearest first, biased toward
// the camera's movement), so walking/panning never has to paint several tiles in one frame.
//  - A prefetched tile is painted in 4 (2 when moving fast) clipped bands over as many frames; every pixel receives
//    exactly the same drawing operations as a one-shot paint, so the tile is identical.
//  - It also keeps running after a memory warning (the old version stopped for 5 minutes, which made
//    every new tile row a synchronous paint); tiles stay inside the tile budget (16 MB, was 12 MB).
//  - It does nothing on frames where terrain already did work (same 2 ms gate as before).
const BANDS_SLOW=4,BANDS_FAST=2;// quarter tiles per frame normally, half tiles when the camera moves fast
function stepBand(cache,job,paint){
 const n=Math.ceil(cache.size*cache.scale)+4,bleed=2/cache.scale;
 if(!job.art){job.art=cache.beginTileSurface200({key:job.key,x:job.x,y:job.y},job.reuse||null);job.reuse=null;job.band=0;}
 const B=job.bands||BANDS_SLOW,c=job.art.getContext('2d'),b0=Math.floor(job.band*n/B),b1=Math.floor((job.band+1)*n/B);
 c.save();
 c.setTransform(1,0,0,1,0,0);c.beginPath();c.rect(0,b0,n,b1-b0);c.clip();
 c.imageSmoothingEnabled=false;
 c.setTransform(cache.scale,0,0,cache.scale,-(job.x-bleed)*cache.scale,-(job.y-bleed)*cache.scale);
 paint(c,job.x-bleed,job.y-bleed,job.art.width/cache.scale,job.art.height/cache.scale,job.key);
 c.restore();
 job.band++;
 return job.band>=(job.bands||BANDS_SLOW);
}
function commit(cache,job){
 const n=Math.ceil(cache.size*cache.scale)+4,old=cache.tiles.get(job.key);
 if(old)cache.bytes-=old.bytes;
 const t={key:job.key,x:job.x,y:job.y,art:job.art,bytes:n*n*4,dirty:false};
 cache.tiles.delete(job.key);cache.tiles.set(job.key,t);cache.bytes+=t.bytes;
 return t;
}
module.exports=function(x,y,w,h,paint,started,wxRuntime,performance){
 const st=this.prefStatsBN||(this.prefStatsBN={calls:0,noPrev:0,gate:0,jump:0,noBest:0,budget:0,started:0,bands:0,commits:0,dropped:0});st.calls++;
 const prev=this.edgeView200;this.edgeView200={x,y,w,h};
 const rect=this.visibleCells614,n=this.size;
 if(!rect||!prev||Math.abs(prev.w-w)>.01||Math.abs(prev.h-h)>.01){st.noPrev++;this.edgeJobBN=null;return;}
 if(performance.now()-started>=2){st.gate++;return;}
 const dx=x-prev.x,dy=y-prev.y;
 if(Math.abs(dx)>n||Math.abs(dy)>n){st.jump++;this.edgeJobBN=null;return;}// a camera jump: the ring is elsewhere now
 const inRing=(gx,gy)=>gx>=rect.x0-1&&gx<=rect.x1+1&&gy>=rect.y0-1&&gy<=rect.y1+1&&!(gx>=rect.x0&&gx<=rect.x1&&gy>=rect.y0&&gy<=rect.y1);
 let job=this.edgeJobBN;
 if(job){
  const have=this.tiles.get(job.key);
  if(have&&!have.dirty||!inRing(job.gx,job.gy)){st.dropped++;job=this.edgeJobBN=null;}
 }
 if(!job){
  // pick the ring cell that will be needed first
  const mv=Math.hypot(dx,dy),ux=mv>.01?dx/mv:0,uy=mv>.01?dy/mv:0,cx=x+w/2,cy=y+h/2;
  let best=null,score=Infinity;
  for(let gy=rect.y0-1;gy<=rect.y1+1;gy++)for(let gx=rect.x0-1;gx<=rect.x1+1;gx++){
   if(!inRing(gx,gy))continue;
   const t=this.tiles.get(gx+','+gy);if(t&&!t.dirty)continue;
   const tx=gx*n+n/2-cx,ty=gy*n+n/2-cy,s=Math.hypot(tx,ty)-(tx*ux+ty*uy)*.9;
   if(s<score){score=s;best={gx,gy};}
  }
  if(!best){st.noBest++;return;}
  const z=this.scale,bytes=(Math.ceil(n*z)+4)**2*4,want=this.wanted566;
  if(this.bytes+bytes>this.budget){
   // only reuse budget from tiles that are neither visible nor in the ring
   let available=false;
   for(const [k,t] of this.tiles){if(!t.art||want.has(k))continue;const c=k.split(',');if(!inRing(+c[0],+c[1])){available=true;break;}}
   if(!available){st.budget++;return;}
  }
  // reuse the canvas of a tile that has fallen behind the camera, so memory stays flat at the budget
  let reuse=null;const size=Math.ceil(n*z)+4;
  if(this.bytes+bytes>this.budget)for(const [k,t] of this.tiles){if(!t.art||want.has(k)||t.art.width!==size||t.art.height!==size)continue;const c=k.split(',');if(inRing(+c[0],+c[1]))continue;this.tiles.delete(k);this.bytes-=t.bytes;reuse=t.art;break;}
  job=this.edgeJobBN={key:best.gx+','+best.gy,gx:best.gx,gy:best.gy,x:best.gx*n,y:best.gy*n,art:null,band:0,reuse,bands:Math.hypot(dx,dy)>3?BANDS_FAST:BANDS_SLOW};
 }
 st.bands++;if(job.band===0&&!job.art)st.started++;if(stepBand(this,job,paint)){st.commits++;this.edgeJobBN=null;commit(this,job);}
};
