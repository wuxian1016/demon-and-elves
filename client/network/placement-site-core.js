'use strict';
function id(type,x,y){return type+':'+(Object.is(x,-0)?0:x)+':'+(Object.is(y,-0)?0:y);}
function site(type,x,y,w,h,bottomOffset=0,extra={}){if(![x,y,w,h,bottomOffset].every(Number.isFinite)||w<=0||h<=0)throw Error('INVALID_PLACEMENT_SITE');return {id:id(type,x,y),type,x,y,w,h,bottomOffset,x0:x-w/2,x1:x+w/2,y0:y+bottomOffset-h,y1:y+bottomOffset,cx:x,cy:y+bottomOffset-h/2,...extra};}
function contains(s,p){return p.x>=s.x0&&p.x<=s.x1&&p.y>=s.y0&&p.y<=s.y1;}
function overlap(a,b,gap=0){return a.x0<b.x1+gap&&a.x1>b.x0-gap&&a.y0<b.y1+gap&&a.y1>b.y0-gap;}
function hit(sites,p,allowed=()=>true){let best=null,distance=Infinity;for(const s of sites){if(!allowed(s)||!contains(s,p))continue;const d=Math.hypot(s.cx-p.x,s.cy-p.y);if(!best||Number(s.recommended)>Number(best.recommended)||s.recommended===best.recommended&&d<distance){best=s;distance=d;}}return best;}
module.exports={id,site,contains,overlap,hit};
