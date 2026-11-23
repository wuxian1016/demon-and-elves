'use strict';
const {createDefaultClock}=require('./default-monotonic-clock');
// Map original performance timestamps; durations and supportTime deadlines are
// deliberately not converted. Identical server events never restart on replay.
class PresentationClock{
 constructor(wall=Date.now,mono=createDefaultClock()){this.wall=wall;this.mono=mono;this.events=new Map();this.epoch=null;this.version=0;}
 apply(view){this.version++;if(this.epoch!==view.epoch){this.events.clear();this.epoch=view.epoch;}const now=this.mono(),wall=this.wall(),seen=new Set();for(const[id,e]of view.entities)for(const key of ['frostHitAt','chopHitAt']){const stamp=e[key];if(!Number.isFinite(stamp))continue;if(!Number.isFinite(view.presentationTimeMs))throw Error('INVALID_PRESENTATION_TIME');const idKey=id+':'+key;seen.add(idKey);let event=this.events.get(idKey);const age=Math.max(0,view.presentationTimeMs-stamp);if(!event||event.stamp!==stamp){event={stamp,age,wall,mono:now};this.events.set(idKey,event);}const elapsed=Math.max(0,wall-event.wall,now-event.mono);e[key]=now-Math.max(age,event.age+elapsed);}for(const key of this.events.keys())if(!seen.has(key))this.events.delete(key);}
 prepare(view){
  const version=this.version,fork=new PresentationClock(this.wall,this.mono);fork.epoch=this.epoch;fork.events=new Map(this.events);fork.apply(view);
  if(this.version!==version)throw Error('PRESENTATION_CLOCK_STALE');let done=false;
  return ()=>{if(done||this.version!==version)throw Error('PRESENTATION_CLOCK_STALE');this.events=fork.events;this.epoch=fork.epoch;this.version++;done=true;};
 }
 reset(){this.version++;this.events.clear();this.epoch=null;}
}
module.exports={PresentationClock};
