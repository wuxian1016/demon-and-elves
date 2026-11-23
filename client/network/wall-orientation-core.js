'use strict';
// Original logical wall span90, base wall radius28 => body depth56.
// These are world units, independent of screen orientation or source PNG size.
const LENGTH=90,DEPTH=56;
const validAxis=a=>a==='h'||a==='v';
function autoAxis(zones,x,y){let zone=null,best=Infinity;for(const z of zones||[])if([z.x,z.y,z.gateX,z.gateY].every(Number.isFinite)){const d=Math.hypot(z.gateX-x,z.gateY-y);if(d<best){best=d;zone=z;}}if(!zone)return 'h';const dx=zone.x-zone.gateX,dy=zone.y-zone.gateY;return Math.abs(dx)>Math.abs(dy)?'v':'h';}
function bounds(x,y,axis){const w=axis==='v'?DEPTH:LENGTH,h=axis==='v'?LENGTH:DEPTH;return {x,y,w,h,x0:x-w/2,x1:x+w/2,y0:y-h/2,y1:y+h/2};}
function surfaceDistance(p,r){return Math.hypot(Math.max(r.x0-p.x,0,p.x-r.x1),Math.max(r.y0-p.y,0,p.y-r.y1));}
function circleOverlaps(p,radius,r){return surfaceDistance(p,r)<radius;}
function slab(from,to,x0,y0,x1,y1){let a=0,b=1;for(const [p,d,lo,hi]of [[from.x,to.x-from.x,x0,x1],[from.y,to.y-from.y,y0,y1]]){if(Math.abs(d)<1e-12){if(p<lo||p>hi)return Infinity;continue;}let t0=(lo-p)/d,t1=(hi-p)/d;if(t0>t1)[t0,t1]=[t1,t0];a=Math.max(a,t0);b=Math.min(b,t1);if(a>b)return Infinity;}return a<=1&&b>=0?Math.max(0,a):Infinity;}
function circleEntry(from,to,x,y,r){const dx=to.x-from.x,dy=to.y-from.y,len=dx*dx+dy*dy;if(len<1e-10)return Infinity;const ox=from.x-x,oy=from.y-y,dot=ox*dx+oy*dy,old=ox*ox+oy*oy,t=Math.max(0,Math.min(1,-dot/len));if((ox+dx*t)**2+(oy+dy*t)**2>=r*r)return Infinity;return Math.max(0,(-dot-Math.sqrt(Math.max(0,dot*dot-len*(old-r*r))))/len);}
function wallEntry(from,to,radius,r){const dx=to.x-from.x,dy=to.y-from.y;if(dx*dx+dy*dy<1e-10)return Infinity;const before=surfaceDistance(from,r),after=surfaceDistance(to,r);if(before<radius&&after>before&&(from.x-r.x)*dx+(from.y-r.y)*dy>=0)return Infinity;let first=Math.min(slab(from,to,r.x0-radius,r.y0,r.x1+radius,r.y1),slab(from,to,r.x0,r.y0-radius,r.x1,r.y1+radius));for(const x of [r.x0,r.x1])for(const y of [r.y0,r.y1])first=Math.min(first,circleEntry(from,to,x,y,radius));return first;}
function pairOverlap(a,b,gap){return a.x0<b.x1+gap-.001&&a.x1>b.x0-gap+.001&&a.y0<b.y1+gap-.001&&a.y1>b.y0-gap+.001;}
module.exports={LENGTH,DEPTH,validAxis,autoAxis,bounds,surfaceDistance,circleOverlaps,wallEntry,circleEntry,pairOverlap};
