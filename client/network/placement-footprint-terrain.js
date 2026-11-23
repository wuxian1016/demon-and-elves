'use strict';
// Same forest circles, water row strips, rock ellipses and mountain circles as
// the native engine. Query a real placement rectangle, not just its centre.
const PAD=3,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const circle=(b,x,y,r)=>{const dx=x-clamp(x,b.x0,b.x1),dy=y-clamp(y,b.y0,b.y1);return dx*dx+dy*dy<r*r;};
const strip=(b,x0,y0,x1,y1)=>{const dx=Math.max(x0-b.x1,b.x0-x1,0),dy=Math.max(y0-b.y1,b.y0-y1,0);return dx*dx+dy*dy<PAD*PAD;};
function block(g,b,world){if(g.terrainCollisionEnabled===false)return null;if(b.x0<0||b.y0<0||b.x1>(world?.width||10000)||b.y1>(world?.height||8000))return '建筑占地超出地图边界';
 if(world?.buckets)for(let gy=Math.floor((b.y0-32)/128);gy<=Math.floor((b.y1+32)/128);gy++)for(let gx=Math.floor((b.x0-32)/128);gx<=Math.floor((b.x1+32)/128);gx++){const trees=world.hitRows?.get(gy)?.get(gx)||world.buckets.get(gx+','+gy)||[];for(const t of trees)if(circle(b,t.x,t.y,(t.radius||24)+PAD))return '建筑占地与树林重叠';}
 const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,reach=Math.hypot(b.w,b.h)/2;
 for(const t of g.nearbyGuardTrees?.(cx,cy,reach+40)||[])if(circle(b,t.x,t.y,t.radius+PAD))return '建筑占地与树林重叠';
 const local=g.localTerrainObstacles?.(cx,cy,reach+PAD)||{water:g.waterPools||[],rocks:g.rocks||[],mountains:g.mountainRanges||[]};
 for(const p of local.water||[]){if(b.x1<p.x-p.rx-PAD||b.x0>p.x+p.rx+PAD||b.y1<p.y-p.ry-PAD||b.y0>p.y+p.ry+PAD)continue;if(p.bridge){const q=p.bridge,c=Math.cos(q.angle),s=Math.sin(q.angle);if([[b.x0,b.y0],[b.x1,b.y0],[b.x0,b.y1],[b.x1,b.y1]].every(([x,y])=>Math.abs(-(x-q.x)*s+(y-q.y)*c)+PAD<=q.width/2&&Math.abs((x-q.x)*c+(y-q.y)*s)<=q.length/2+PAD))continue;}for(const r of p.collision?.rows||p.cells||[]){const left=p.x+(r.left??r.dx),right=p.x+(r.right??(r.dx+r.w)),top=p.y+r.dy;if(strip(b,left,top,right,top+6))return '建筑占地与水岸重叠';}}
 for(const r of local.rocks||[]){const size=r.kind==='rock'?[24,15]:r.kind==='rockMid'?[18,12]:[12,9],rx=size[0]+PAD,ry=size[1]+PAD,dx=r.x-clamp(r.x,b.x0,b.x1),dy=r.y-clamp(r.y,b.y0,b.y1);if(dx*dx/(rx*rx)+dy*dy/(ry*ry)<1)return '建筑占地与岩石重叠';}
 for(const m of local.mountains||[])if(circle(b,m.x,m.y,m.radius+PAD))return '建筑占地与山体重叠';return null;
}
module.exports={block,circle,strip};
