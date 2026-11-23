'use strict';
const boundsCache=new WeakMap();
function bounds(g,clock=0) {
 const p=g.player,zones=g.resourceZones||[],buildings=g.buildings||[];
 if(!p||!zones.length)return null;
 const last=boundsCache.get(g);
 if(last?.p===p&&last.zones===zones&&last.buildings===buildings&&last.count===buildings.length&&clock>=last.at&&clock-last.at<240&&Math.abs(p.x-last.px)+Math.abs(p.y-last.py)<100)return last.result;
 let home=null,nearest=Infinity;
 for(const b of buildings){if(b.dead||b.type!=='house'||b.ownerSlot!=null)continue;const d=(b.x-p.x)**2+(b.y-p.y)**2;if(d<nearest){nearest=d;home=b;}}
 if(!home)return null;
 const zoneId=g.resourceZoneIndexFor401(home),z=zones[zoneId];
 if(!z||!Number.isFinite(z.gateX)||!Number.isFinite(z.gateY))return null;
 const dx=z.x-z.gateX,dy=z.y-z.gateY,len=Math.hypot(dx,dy)||1,nx=dx/len,ny=dy/len;
 let l=Infinity,r=-Infinity,t=Infinity,b=-Infinity;
 function include(x,y,rx,top,bottom=rx){if(!Number.isFinite(x)||!Number.isFinite(y))return;l=Math.min(l,x-rx);r=Math.max(r,x+rx);t=Math.min(t,y-top);b=Math.max(b,y+bottom);}
 // Cover the buildable central pocket, all gate cells and the back of the camp;
 // live owned buildings extend the silhouette across the remainder of the site.
 include(z.x,z.y,290,315,275);
 const depth=Math.min(875,Math.max(640,len*1.75));
 include(z.gateX+nx*depth,z.gateY+ny*depth,245,265,230);
 for(const q of z.gateCells||[])include(q.x,q.y,116,160,90);
 include(z.gateX,z.gateY,115,160,100);
 for(const q of buildings){if(q.dead||q.ownerSlot!=null||g.resourceZoneIndexFor401(q)!==zoneId)continue;const radius=Math.max(48,Math.min(105,q.radius||0));include(q.x,q.y,radius+28,radius+96,radius+24);}
 const result={x:(l+r)/2,y:(t+b)/2,rx:(r-l)*.71,ry:(b-t)*.71,left:l,right:r,top:t,bottom:b};
 boundsCache.set(g,{p,px:p.x,py:p.y,zones,buildings,count:buildings.length,at:clock,result});return result;
}
function drawSanctuary(ctx,g,art,inView){
 const core=g.cardsCandidate?.core,s=core?.state;
 if(!core?.authority()||!s.effects.some(e=>e.type==='sanctuary'&&e.ends>s.time)||typeof art?.shieldAura!=='function')return;
 const q=bounds(g,s.time);if(!q||!inView(q.x,q.y,Math.max(q.rx,q.ry)+120))return;
 const sx=q.rx/64,sy=q.ry/78;
 ctx.save();
 try{ctx.globalAlpha=.84;ctx.translate(q.x,q.y+5*sy);ctx.scale(sx,sy);art.shieldAura(ctx,{x:0,y:0,relicShieldLevel:1,relicShield:100,relicShieldFlash:0},1);}
 finally{ctx.restore();}
}
module.exports=drawSanctuary;
module.exports.bounds=bounds;
