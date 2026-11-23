'use strict';
// Local first-build advice only; retain native legality and paid placement.
const hints=require('./placement-zone-hints');
function anchor(g,z,type){const f=hints.frame(g,z);if(type!=='exchange'||!f)return hints.resourceAnchor(g,z);const d=f.axis+hints.UNIT*3;return{x:f.gate.x-f.gate.ax*d,y:f.gate.y-f.gate.ay*d};}
function accepts(g,s,type){const role=hints.role(g,s);if(type!=='exchange')return role==='resource';const z=g.resourceZones?.[require('./placement-current-camp').index(g)],f=z&&hints.frame(g,z);if(!f)return role==='resource';const d=-((s.x-f.gate.x)*f.gate.ax+(s.y-f.gate.y)*f.gate.ay);return d>=f.axis-hints.UNIT/2&&!['defense','defense-mid','defense-soft'].includes(role);}
function compare(g,z,type,a,b){const p=anchor(g,z,type);if(type!=='exchange')return Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.id.localeCompare(b.id);
 const towers=(g.defenseRecommendationLayout(z)||[]).filter(s=>s.type==='tower');
 const distance=s=>towers.length?Math.min(...towers.map(t=>Math.hypot(t.x-s.x,t.y-s.y))):Math.hypot(s.x-p.x,s.y-p.y);
 return distance(a)-distance(b)||Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)||a.id.localeCompare(b.id);}
module.exports={anchor,accepts,compare};
