'use strict';
// Six advisory anchors only. Native collision, cost, movement and authority stay unchanged.
const region=require('./camp-hint-region'),memo=new WeakMap(),STEP=103;
function anchors(g,z){if(!z)return[];let m=memo.get(g);if(!m){m=new WeakMap();memo.set(g,m);}const f=region.gateFrame(g,z),old=m.get(z);if(old?.frame===f)return old.rows;const inner=(g.defenseRecommendationLayout?.(z)||[]).filter(s=>s.type==='wall').slice(0,3),rows=inner.map(s=>({...s,wallBandBI:'wall-inner'})).concat(inner.map((s,i)=>({...s,x:s.x+f.ax*STEP,y:s.y+f.ay*STEP,number:i+4,wallBandBI:'wall-outer'})));m.set(z,{frame:f,rows});return rows;}
function role(g,s){if(s.type!=='wall')return null;const z=region.campAt(g,s.x,s.y)?.zone;return anchors(g,z).find(a=>Math.abs(a.x-s.x)<1e-6&&Math.abs(a.y-s.y)<1e-6)?.wallBandBI||null;}
module.exports={anchors,role,STEP};
