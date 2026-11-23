"use strict";
// UI preparation runs in separate tasks. Count CPU slices separately from their
// end-to-end waiting time and from FullGameClient's synchronous packet metric.
class PresentationPerformance {
 constructor({clock,emit=()=>{},intervalMs=5000}){Object.assign(this,{clock,emit,intervalMs});this.reset();}
 reset(){this.started=this.clock();this.tasks=0;this.cpuMs=0;this.maxTaskMs=0;this.over16_67=0;this.over50=0;this.commits=0;this.latencyMs=0;this.maxLatencyMs=0;this.maxQueue=0;this.superseded=0;this.phases=Object.create(null);}
 slice({phase,durationMs}){if(!Number.isFinite(durationMs)||durationMs<0)return;this.tasks++;this.cpuMs+=durationMs;this.maxTaskMs=Math.max(this.maxTaskMs,durationMs);if(durationMs>16.67)this.over16_67++;if(durationMs>50)this.over50++;const key=typeof phase==='string'&&/^[a-z-]{1,24}$/.test(phase)?phase:'unknown';this.phases[key]=(this.phases[key]||0)+durationMs;this.flush('interval',false);}
 replaced(){this.superseded++;}
 committed(ms,queued=0){this.commits++;if(Number.isFinite(ms)){this.latencyMs+=Math.max(0,ms);this.maxLatencyMs=Math.max(this.maxLatencyMs,ms);}this.maxQueue=Math.max(this.maxQueue,queued);}
 flush(reason,force=true){if(!this.tasks&&!this.commits)return null;const elapsed=this.clock()-this.started;if(!force&&elapsed<this.intervalMs)return null;const round=n=>Math.round(n*100)/100,report={reason,elapsedMs:round(elapsed),tasks:this.tasks,cpuMs:round(this.cpuMs),maxTaskMs:round(this.maxTaskMs),over16_67:this.over16_67,over50:this.over50,commits:this.commits,latencyMs:round(this.latencyMs),maxLatencyMs:round(this.maxLatencyMs),maxQueue:this.maxQueue,superseded:this.superseded,phases:Object.fromEntries(Object.entries(this.phases).map(([k,v])=>[k,round(v)]))};this.reset();try{this.emit(report);}catch(_){}return report;}
}
module.exports={PresentationPerformance};
