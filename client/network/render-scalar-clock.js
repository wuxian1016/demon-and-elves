'use strict';
// Render-only scalar projection. Original updates, hits, resources, cooldowns,
// acknowledgement clocks and authority objects are never advanced here.
const TIMERS=['actionAnim','hurtTimer','relicGuardAnim','relicShieldFlash','flameTimer','roarAnim'];
class RenderScalarClock{
 constructor(){this.reset();this.depth=0;this.frames=[];}
 reset(){this.scope=null;this.records=new WeakMap();this.live=[];this.stamp=null;this.at=null;this.lastRender=null;this.renderTime=null;this.support=null;}
 commit(view,now,actors=null,timers=[]){
  if(!Number.isFinite(now)||!Number.isFinite(view?.presentationTimeMs)||!Number.isSafeInteger(view?.epoch))return;
  const scope=JSON.stringify([view.roomId??null,view.viewerOwnerId,view.epoch]);if(this.scope!==scope){this.reset();this.scope=scope;}
  const stamp=view.presentationTimeMs;if(this.stamp!==null&&stamp<this.stamp)return;
  if(stamp!==this.stamp){this.at=now;this.stamp=stamp;}
  this.support=Number.isFinite(view.worldView?.supportTime)?view.worldView.supportTime:['hunt','prep'].includes(view.worldView?.state)?0:null;
  const candidates=actors?new Set([...actors,...timers.map(t=>t.entity)]):view.entities.values();
  this.live.length=0;for(const e of candidates){
   let needed=e.waveHound&&Number.isFinite(e.slimeHop)&&!e.dead;for(const key of TIMERS)if(Number.isFinite(e[key])&&e[key]>0){needed=true;break;}
   if(!needed){this.records.delete(e);continue;}
   const old=this.records.get(e),record={stamp,phase:null,timers:{},timerList:[]};
   if(e.waveHound&&Number.isFinite(e.slimeHop)&&!e.dead){
    const dt=old?stamp-old.stamp:0,delta=old?.phase?((e.slimeHop-old.phase.value)%900+900)%900:0;
    const rate=dt>0&&old?.phase?(delta<.001?0:Math.abs(delta-dt)<35?1:0):old?.phase?.rate??1;
    const history=old?.phase?.history?old.phase.history.slice(-3):[];if(history.at(-1)?.tick!==view.tick)history.push({tick:view.tick,value:e.slimeHop});record.phase={value:e.slimeHop,rate,history};
   }
   for(const key of TIMERS)if(Number.isFinite(e[key])&&e[key]>0){
    let expires=stamp+e[key];const before=old?.timers[key];
    // Same original countdown across repeated snapshots has one expiry. A new
    // original action extends it by a real simulation event, never by receipt.
    if(before&&Math.abs(expires-before.expires)<=1000/30)expires=before.expires;
    const item={key,expires};record.timers[key]=item;record.timerList.push(item);
   }
   if(record.phase||record.timerList.length){this.records.set(e,record);this.live.push(e);}else this.records.delete(e);
  }
 }
 begin(game,view,now,phaseTick=null){
  const depth=this.depth++,restore=this.frames[depth]||(this.frames[depth]=[]);restore.length=0;
  if(depth||!Number.isFinite(now)||this.stamp===null||!view||JSON.stringify([view.roomId??null,view.viewerOwnerId,view.epoch])!==this.scope)return restore;
  const time=Math.max(this.lastRender??-Infinity,this.stamp+Math.min(250,Math.max(0,now-this.at)));this.lastRender=this.renderTime=time;
  const set=(e,k,v)=>{if(e[k]===v)return;restore.push(e,k,Object.hasOwn(e,k),e[k]);e[k]=v;};
  try{
  if(this.support!==null&&['hunt','prep'].includes(game.state))set(game,'supportTime',this.support+time-this.stamp);
  for(const e of this.live){
   const r=this.records.get(e);if(!r)continue;
   if(r.phase&&!e.dead){let phase=r.phase.value+(time-r.stamp)*r.phase.rate;const target=phaseTick?.(e),history=r.phase.history;if(Number.isFinite(target)&&history.length){phase=history[0].value;let bracket=false;for(let i=1;i<history.length;i++){const b=history[i];if(target>b.tick)continue;const a=history[i-1],fraction=Math.max(0,Math.min(1,(target-a.tick)/Math.max(1,b.tick-a.tick))),delta=((b.value-a.value)%900+900)%900;phase=a.value+delta*fraction;bracket=true;break;}const last=history.at(-1);if(!bracket&&target>=last.tick)phase=last.value+Math.min(250,Math.max(0,target-last.tick)*1000/60)*r.phase.rate;}set(e,'slimeHop',((phase%900)+900)%900);}
   for(const t of r.timerList)set(e,t.key,Math.max(0,t.expires-time));
  }
  return restore;
  }catch(error){this.end(restore);throw error;}
 }
 end(restore){try{for(let i=restore.length-4;i>=0;i-=4){const e=restore[i],k=restore[i+1];if(restore[i+2]){if(e[k]!==restore[i+3])e[k]=restore[i+3];}else delete e[k];}}finally{restore.length=0;this.depth=Math.max(0,this.depth-1);}}
}
module.exports={RenderScalarClock};
