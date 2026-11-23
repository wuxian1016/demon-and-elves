'use strict';
// Display scope only. The original half-plane snapping/physics are untouched.
// Camp wings use their full native1120 resource-zone radius. Only the outward
// road ribbon is excluded, not the entire half-plane beyond its gate.
// Start that ribbon at the REAL aligned wall row, not the pre-alignment gate:
// the two differ by up to one slot, which previously clipped legal corner cells.
const ROAD_HALF_WIDTH=330; // Native forest road235 + protected tree clearance95.
function campAt(g,x,y){let best=null,distance=Infinity;for(let i=0;i<(g.resourceZones||[]).length;i++){const z=g.resourceZones[i],d=Math.hypot(x-z.x,y-z.y);if(!Number.isFinite(z.gateX+z.gateY)||d>(z.radius||1120)||d>=distance)continue;best={zone:z,camp:i};distance=d;}return best;}
const gateFrames=new WeakMap();
function gateFrame(g,z){let cache=gateFrames.get(g);if(!cache){cache=new WeakMap();gateFrames.set(g,cache);}const key=[g.defenseRecommendationLayout,z.x,z.y,z.gateX,z.gateY,z.gridOriginXAQ,z.gridOriginYAQ,g.tutorial],old=cache.get(z);if(old&&key.every((v,i)=>v===old.key[i]))return old.frame;const middle=g.defenseRecommendationLayout?.(z)?.find(p=>p.type==='wall'&&p.number===2),dx=z.gateX-z.x,dy=z.gateY-z.y,ax=Math.abs(dx)>Math.abs(dy)?Math.sign(dx):0,frame={x:middle?.x??z.gateX,y:middle?.y??z.gateY,ax,ay:ax?0:Math.sign(dy)};cache.set(z,{key,frame});return frame;}
function inOutsideRoad(g,z,x,y){const gate=gateFrame(g,z),ax=gate.ax,ay=gate.ay,px=x-gate.x,py=y-gate.y;if(px*ax+py*ay<=1e-6)return false;const tx=(g.trollBase?.x??5000)-gate.x,ty=(g.trollBase?.y??4000)-gate.y,len=Math.hypot(tx,ty);if(!len)return false;const along=(px*tx+py*ty)/len,side=Math.abs(px*ty-py*tx)/len;return along>=0&&side<=Math.max(ROAD_HALF_WIDTH,(z.gateWidth||294)/2+90);}
function contains(g,x,y){const found=campAt(g,x,y);// Exact two user-approved forest-shoulder cells: native placement collision still decides availability.
const shoulder=found?.camp===2&&Math.abs(y-6545)<1e-6&&(Math.abs(x-5290.5)<1e-6||Math.abs(x-5805.5)<1e-6);return!!found&&(shoulder||!inOutsideRoad(g,found.zone,x,y));}
module.exports={ROAD_HALF_WIDTH,campAt,gateFrame,inOutsideRoad,contains};
