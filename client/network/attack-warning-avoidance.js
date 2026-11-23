'use strict';
const overlaps=(a,b,pad=0)=>a.x<b.x+b.w+pad&&b.x<a.x+a.w+pad&&a.y<b.y+b.h+pad&&b.y<a.y+a.h+pad;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
// The warning belongs to a world-space entrance, never to a free HUD slot.
// Occlusion hides it; neither camera movement nor an actor may move its anchor.
function install(g,{viewport=()=>({width:393,height:852}),art=()=>null}={}){
 if(g.attackWarningAvoidanceAZ)return g.attackWarningAvoidanceAZ;
 const states=new Map();
 let zones=g.resourceZones,lastTime=-Infinity,lastWave=-Infinity;
 function resetIfNeeded(){
  const time=g.supportTime||0,wave=g.waveElapsed||0;
  if(zones!==g.resourceZones||time<lastTime||wave<lastWave||!['prep','hunt'].includes(g.state||'hunt'))states.clear();
  zones=g.resourceZones;lastTime=time;lastWave=wave;
 }
 function anchor(w){
  const z=w.zone,b=g.trollBase;
  if(!z||!b||!Number.isFinite(z.gateX)||!Number.isFinite(z.gateY))return{x:Number.isFinite(z?.gateX)?z.gateX:0,y:Number.isFinite(z?.gateY)?z.gateY:0,radius:63};
  const dx=z.gateX-b.x,dy=z.gateY-b.y,len=Math.hypot(dx,dy)||1,side=w.kind==='demon'?78:-78;
  // Two permanent lanes remain stable when the other warning appears/disappears.
  return{x:z.gateX-dx/len*210-dy/len*side,y:z.gateY-dy/len*210+dx/len*side,radius:63};
 }
 function worldHostileRects(){
  const rows=[];
  for(const e of [g.troll,...(g.hounds||[]),...(g.miniTrolls||[])]){
   if(!e||e.dead)continue;
   const scale=e.waveHound?(e.slimeVisualScale568?.()||1):1,w=e.waveHound?52*scale:e.dragonEvolved?230:e.evolved?135:Math.max(45,(e.radius||20)*2.4),h=e.waveHound?65*scale:e.dragonEvolved?235:e.evolved?155:110;
   rows.push({x:e.x-w/2-8,y:e.y-(h-12)-12,w:w+16,h:h+20});
  }return rows;
 }
 const hostileRects=()=>{const z=g.zoom()||1,c=g.camera;return worldHostileRects().map(r=>({x:(r.x-c.x)*z,y:(r.y-c.y)*z,w:r.w*z,h:r.h*z}));};
 function arrived(w,frameUnits){
  resetIfNeeded();const zone=w.zone,key=(w.enemyKind==='bat'?'bat':w.kind)+':'+(g.resourceZones||[]).indexOf(zone),gate={x:zone.gateX,y:zone.gateY};
  let s=states.get(key);if(!s||s.zone!==zone){s={zone,arrived:false,wave:null,source:g.troll};states.set(key,s);}
  if(w.kind==='slime'){
   const index=(g.resourceZones||[]).indexOf(zone),count=(g.resourceZones||[]).length;
   const units=frameUnits===undefined?(g.hounds||[]).filter(h=>!h.dead&&(w.enemyKind==='bat'?h.waveBat:h.waveHound)&&((h.waveZoneIndex%count+count)%count)===index):frameUnits;
   const wave=Math.max(0,...units.map(h=>h.waveNumber||1));
   if(wave&&wave!==s.wave){s.wave=wave;s.arrived=false;}
   if(units.some(h=>(h.waveNumber||1)===s.wave&&(distance(h,gate)<=160||(w.enemyKind==='bat'&&g.trollBase&&(h.x-gate.x)*(gate.x-g.trollBase.x)+(h.y-gate.y)*(gate.y-g.trollBase.y)>=0))))s.arrived=true;
  }else{
   const e=w.source||g.troll;
   if(s.source!==e){s.source=e;s.arrived=false;s.raidSerial=undefined;}
   if(Number.isSafeInteger(w.raidSerialAB)&&s.raidSerial!==w.raidSerialAB){s.raidSerial=w.raidSerialAB;s.arrived=false;}
   if(g.demonWarningAtOwnBase?.())s.arrived=false;
   if(w.raidContactAB||e&&!e.dead&&(distance(e,gate)<=180||g.demonWarningReachedDefense?.()))s.arrived=true;
  }
  return s.arrived;
 }
 function visible(w){
  if(!w?.zone||!Number.isFinite(w.zone.gateX)||!Number.isFinite(w.zone.gateY)||arrived(w))return false;
  const p=anchor(w),box={x:p.x-66,y:p.y-66,w:132,h:140};
  if(worldHostileRects().some(r=>overlaps(box,r,14)))return false;
  for(const b of g.buildings||[]){
   if(b.dead)continue;
   const r=Math.max(48,b.radius||48),l=art()?.buildingLayout?.(b),width=l?(l.visibleW||l.w):r*2+32,height=l?(l.visibleH||l.h):Math.max(180,r*2.8);
   const rect={x:b.x-width/2-8,y:b.y+26-height-8,w:width+16,h:height+16};
   if(overlaps(box,rect,14))return false;
  }
  const z=g.zoom()||1,c=g.camera,v=viewport(),screen={x:(box.x-c.x)*z,y:(box.y-c.y)*z,w:box.w*z,h:box.h*z};
  // Offscreen is offscreen: do not clamp back to an unrelated spot on the map.
  if(screen.x+screen.w<0||screen.x>v.width||screen.y+screen.h<0||screen.y>(v.height||v.fullHeight))return false;
  const hud=g.topHudLayout?.(),obstacles=[g.getMinimapRect?.(),g.toastRect,hud&&{x:0,y:0,w:v.width,h:hud.bottom}].filter(Boolean);
  return !obstacles.some(r=>overlaps(screen,r,8));
 }
 g.incomingWarningMarker=anchor;
 g.incomingWarningDisplayMarker440=anchor;
 const drawWarnings=g.drawIncomingAttackWarning;
 if(drawWarnings)g.drawIncomingAttackWarning=function(...args){
  // Observe arrival even on the frame the original producer removes a <=72px
  // warning, so retreating survivors cannot resurrect the same wave's circle.
  resetIfNeeded();
  const zones=this.resourceZones||[],count=zones.length;
  if(zones.some(zone=>Number.isFinite(zone.gateX))){
   const ground=[],bats=[],empty=[];
   // Partition once in this synchronous observer only; never retain an entity
   // or a lane verdict across renders, waves, deaths or world replacement.
   for(const h of this.hounds||[]){
    if(!h||h.dead||(!h.waveHound&&!h.waveBat))continue;
    const i=(h.waveZoneIndex%count+count)%count;if(!Number.isInteger(i))continue;
    if(h.waveHound)(ground[i]||(ground[i]=[])).push(h);
    if(h.waveBat)(bats[i]||(bats[i]=[])).push(h);
   }
   for(const zone of zones)if(Number.isFinite(zone.gateX)){
    const i=zones.indexOf(zone);
    arrived({kind:'slime',zone},ground[i]||empty);arrived({kind:'slime',enemyKind:'bat',zone},bats[i]||empty);arrived({kind:'demon',zone,source:this.troll});
   }
  }
  return drawWarnings.apply(this,args);
 };
 const draw=g.drawIncomingAttackWarningItem;
 if(draw)g.drawIncomingAttackWarningItem=function(ctx,inView,w){if(visible(w))return draw.call(this,ctx,inView,w);};
 const cards=g.incomingWarningCardLayouts440;
 if(cards)g.incomingWarningCardLayouts440=function(warnings){
  if(this.allowIncomingWarningCardsBN?.()===false)return[];
  warnings??=this.incomingAttackWarningStates();
  // Keep the brief explanation next to its fixed circle, never leave a stray
  // offscreen tether or a floating card after contact/occlusion.
  return cards.call(this,warnings.filter(visible));
 };
 const api={hostileRects,anchor,visible,arrived,adjust:(w)=>anchor(w),clear:()=>states.clear(),stats:()=>({tracked:states.size})};
 Object.defineProperty(g,'attackWarningAvoidanceAZ',{value:api,configurable:true});return api;
}
module.exports={install,overlaps};
