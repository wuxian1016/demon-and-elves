"use strict";
// Counts completed original-game draws, not RAF requests or network packets.
// packetJsMs covers synchronous client delta/validation/capture. Legacy callers
// also include synchronous UI application. applyJsMs measures atomic UI commit;
// network-ui reports deferred preparation tasks. Overlapping metrics must not be added.
// JS elapsed time is observable here; GPU cost and phone temperature are not.
const emptyPackets=()=>({packets:0,packetJsMs:0,maxPacketJsMs:0,packetOver16_67:0,packetOver50:0});
class PlayPerformance {
 constructor({clock,emit=()=>{},context=()=>({}),intervalMs=5000}){Object.assign(this,{clock,emit,context,intervalMs});this.reset();}
 reset(){this.window=null;this.pendingApply={count:0,total:0,max:0};this.pendingPackets=emptyPackets();this.pendingStarted=null;this.latest=null;}
 pendingAt(ms){const started=this.clock()-ms;this.pendingStarted=this.pendingStarted===null?started:Math.min(this.pendingStarted,started);}
 apply(ms){const a=this.window||this.pendingApply;ms=Math.max(0,Number(ms)||0);if(this.window){a.applies++;a.applyMs+=ms;a.maxApplyMs=Math.max(a.maxApplyMs,ms);}else{this.pendingAt(ms);a.count++;a.total+=ms;a.max=Math.max(a.max,ms);}}
 packet(ms){ms=typeof ms==='number'&&Number.isFinite(ms)?Math.max(0,ms):0;const p=this.window||this.pendingPackets;if(!this.window)this.pendingAt(ms);p.packets++;p.packetJsMs+=ms;p.maxPacketJsMs=Math.max(p.maxPacketJsMs,ms);if(ms>16.67)p.packetOver16_67++;if(ms>50)p.packetOver50++;if(this.window)this.flush('interval',false);}
 newWindow(at,pending=false,lastFrame=null){const a=pending?this.pendingApply:{count:0,total:0,max:0},packets=pending?this.pendingPackets:emptyPackets(),w={started:at,frames:0,drawMs:0,maxDrawMs:0,maxGapMs:0,lastFrame,gaps:[],gapOver25:0,gapOver50:0,applies:a.count,applyMs:a.total,maxApplyMs:a.max,...packets,inputs:0,moves:0,stops:0,receipts:0,rejected:0,maxInputMs:0};if(pending){this.pendingApply={count:0,total:0,max:0};this.pendingPackets=emptyPackets();this.pendingStarted=null;}return w;}
 beginFrame(){const at=this.clock();if(!this.window)this.window=this.newWindow(at,true);return at;}
 endFrame(start){const w=this.window;if(!w)return;const now=this.clock(),ms=Math.max(0,now-start);if(w.lastFrame!==null){
   const gap=Math.max(0,start-w.lastFrame);
   w.maxGapMs=Math.max(w.maxGapMs,gap);
   if(w.gaps.length<400)w.gaps.push(gap);
   if(gap>25)w.gapOver25++;
   if(gap>50)w.gapOver50++;
  }w.lastFrame=start;w.frames++;w.drawMs+=ms;w.maxDrawMs=Math.max(w.maxDrawMs,ms);this.flush('interval',false);}
 input(command){const w=this.window;if(!w)return;w.inputs++;if(command.action==='joystick'){if(command.args?.dx||command.args?.dy)w.moves++;else w.stops++;}}
 receipt(ms,accepted){const w=this.window;if(!w)return;w.receipts++;if(!accepted)w.rejected++;w.maxInputMs=Math.max(w.maxInputMs,Math.max(0,Number(ms)||0));}
 reportContext(){const result={};try{const raw=this.context();if(raw?.role==='host'||raw?.role==='guest')result.role=raw.role;if(typeof raw?.phase==='string')result.phase=raw.phase.slice(0,24);for(const k of ['intro','menu','gameReady','hidden','resyncing'])if(typeof raw?.[k]==='boolean')result[k]=raw[k];for(const k of ['entities','players','queue','snapshotAgeMs'])if(typeof raw?.[k]==='number'&&Number.isFinite(raw[k]))result[k]=Math.max(0,Math.round(raw[k]));}catch(_){}return result;}
 flush(reason,force=true){let w=this.window,initial=false;if(!w){if(!force||!['hidden','back','error'].includes(reason)||!this.pendingPackets.packets&&!this.pendingApply.count)return null;initial=true;w=this.newWindow(this.pendingStarted??this.clock(),true);}const elapsed=Math.max(0,this.clock()-w.started);if(!force&&elapsed<this.intervalMs)return null;const round=n=>Number.isFinite(n)?Math.abs(n)<1e12?Math.round(n*100)/100:Math.round(n):null;const gaps=w.gaps.sort((a,b)=>a-b),percentile=p=>gaps.length?round(gaps[Math.ceil(p*gaps.length)-1]):null;const report={reason:initial?'initial-'+reason:typeof reason==='string'?reason.slice(0,32):'unknown',elapsedMs:round(elapsed),frames:w.frames,renderFps:!initial&&w.frames>0&&elapsed>=1000?round(w.frames*1000/elapsed):null,drawJsMs:round(w.drawMs),maxDrawJsMs:round(w.maxDrawMs),maxFrameGapMs:round(w.maxGapMs),frameP95Ms:percentile(.95),frameP99Ms:percentile(.99),gapOver25:w.gapOver25,gapOver50:w.gapOver50,applies:w.applies,applyJsMs:round(w.applyMs),maxApplyJsMs:round(w.maxApplyMs),packets:w.packets,packetJsMs:round(w.packetJsMs),maxPacketJsMs:round(w.maxPacketJsMs),packetOver16_67:w.packetOver16_67,packetOver50:w.packetOver50,inputs:w.inputs,movingInputs:w.moves,stopInputs:w.stops,receipts:w.receipts,rejected:w.rejected,maxInputAckMs:round(w.maxInputMs),...this.reportContext()};
  // Runtime stores at most 800 characters per diagnostic. Keep complete JSON,
  // preserving all counters; only optional context is omitted for extreme sizes.
  for(const key of ['snapshotAgeMs','entities','queue','players','phase','intro','menu']){if(JSON.stringify(report).length<800)break;delete report[key];}
  this.latest=report;this.window=force?null:this.newWindow(this.clock(),false,w.lastFrame);try{this.emit(report);}catch(_){}return report;
 }
}
module.exports={PlayPerformance};
