'use strict';
const {createDefaultClock}=require('./default-monotonic-clock');
// Preserve wire order and native arrival timestamps. A bounded rolling16.67ms
// window limits callbacks to4 messages;4ms CPU budget yields sooner.
class BaseSocketReceiveQueue{
 constructor({process,onOverflow,clock=createDefaultClock(),wall=Date.now,schedule=setTimeout,cancel=clearTimeout,maxMessages=32,maxBytes=16*1024*1024,windowMs=1000/60,maxPerWindow=4,budgetMs=4}={}){Object.assign(this,{process,onOverflow,clock,wall,schedule,cancel,maxMessages,maxBytes,windowMs,maxPerWindow,budgetMs});this.items=[];this.bytes=0;this.closed=false;this.timer=null;this.windowAt=-Infinity;this.used=0;this.stats={enqueued:0,processed:0,peak:0,peakBytes:0,overflows:0,maxWaitMs:0,totalWaitMs:0,maxBatchMs:0};}
 push(event){if(this.closed)return false;const bytes=typeof event?.data==='string'?event.data.length*2:Number.isSafeInteger(event?.data?.byteLength)?event.data.byteLength:0;if(this.items.length>=this.maxMessages||this.bytes+bytes>this.maxBytes){this.stats.overflows++;this.close();this.onOverflow?.();return false;}this.items.push({event,bytes,at:this.clock(),wall:this.wall()});this.bytes+=bytes;this.stats.enqueued++;this.stats.peak=Math.max(this.stats.peak,this.items.length);this.stats.peakBytes=Math.max(this.stats.peakBytes,this.bytes);this.arm(0);return true;}
 arm(delay){if(this.closed||this.timer!==null||!this.items.length)return;this.timer=this.schedule(()=>{this.timer=null;this.consume();},delay);}
 consume(){if(this.closed)return;const started=this.clock();if(started-this.windowAt>=this.windowMs){this.windowAt=started;this.used=0;}while(this.items.length&&this.used<this.maxPerWindow&&!this.closed){if(this.used>0&&this.clock()-started>=this.budgetMs)break;const row=this.items.shift();this.bytes-=row.bytes;this.used++;const wait=Math.max(0,this.clock()-row.at);this.stats.maxWaitMs=Math.max(this.stats.maxWaitMs,wait);this.stats.totalWaitMs+=wait;this.stats.processed++;this.process(row.event,row.at,row.wall);}this.stats.maxBatchMs=Math.max(this.stats.maxBatchMs,Math.max(0,this.clock()-started));if(this.items.length)this.arm(Math.max(0,this.windowAt+this.windowMs-this.clock()));}
 report(){return{...this.stats,pending:this.items.length,queuedBytes:this.bytes,maxMessages:this.maxMessages,maxBytes:this.maxBytes,maxPerWindow:this.maxPerWindow,windowMs:this.windowMs,budgetMs:this.budgetMs,scope:'Ordered raw-message queue; native arrival timestamps preserved for existing Socket RTT, queue wait is separate; business accepted ACK and authority draw include actual deferred completion.'};}
 close(){this.closed=true;if(this.timer!==null)this.cancel(this.timer);this.timer=null;this.items.length=0;this.bytes=0;}
}


class SocketReceiveQueue extends BaseSocketReceiveQueue{
 constructor(options={}){super(options);this.clockMetadata=options.clockMetadata;this.processing=false;this.lastInlineClockAt=-Infinity;Object.assign(this.stats,{inlineClocks:0,received:0,coalescedClocks:0,skippedClocks:0,maxCoalescedWaitMs:0});}
 push(event){
  if(this.closed)return false;const at=this.clock(),wall=this.wall();this.stats.received++;
  const bytes=typeof event?.data==='string'?event.data.length*2:Number.isSafeInteger(event?.data?.byteLength)?event.data.byteLength:0;
  let clock=null;try{clock=this.clockMetadata?.(event)||null;}catch(_){}
  // A validated optional clock has no entities, receipts or membership effects.
  // With an empty queue it needs no extra timer hop. Never cross a retained
  // message/barrier or re-enter a handler; cap this tiny lane at1 per window.
  if(clock&&bytes<=1024&&!this.items.length&&!this.processing&&at-this.lastInlineClockAt>=this.windowMs){this.lastInlineClockAt=at;this.processing=true;this.stats.enqueued++;this.stats.processed++;this.stats.inlineClocks++;const started=this.clock();try{this.process(event,at,wall);}finally{this.processing=false;this.stats.maxBatchMs=Math.max(this.stats.maxBatchMs,Math.max(0,this.clock()-started));}return true;}
  if(clock)for(let i=this.items.length-1;i>=0;i--){const old=this.items[i];if(old.barrier||old.event?.terminalKind)break;
   if(old.clock?.key===clock.key&&clock.tick>=old.clock.tick&&clock.serverTimeMs>old.clock.serverTimeMs){this.items.splice(i,1);this.bytes-=old.bytes;this.stats.coalescedClocks++;this.stats.maxCoalescedWaitMs=Math.max(this.stats.maxCoalescedWaitMs,Math.max(0,at-old.at));}
  }
  if(this.items.length>=this.maxMessages||this.bytes+bytes>this.maxBytes){
   // Clock pulses already are optional server metadata. Never discard a pong,
   // receipt, entity/event snapshot, scope reset, error, or close callback.
   if(clock){this.stats.skippedClocks++;return false;}
   this.stats.overflows++;this.close();this.onOverflow?.();return false;
  }
  const barrier=!!event?.terminalKind||!clock&&(typeof event?.data!=='string'||!event.data.startsWith('{"type":"snapshot",'));this.items.push({event,bytes,at,wall,clock,barrier});this.bytes+=bytes;this.stats.enqueued++;this.stats.peak=Math.max(this.stats.peak,this.items.length);this.stats.peakBytes=Math.max(this.stats.peakBytes,this.bytes);this.arm(0);return true;
 }
 consume(){this.processing=true;try{return super.consume();}finally{this.processing=false;}}
 report(){return{...super.report(),scope:'Optional validated<=512character clocks may run inline only with an empty queue, no reentrancy and at most1 per16.67ms; all other retained messages preserve FIFO and original4message/4ms budget. Native callback timestamps/RTT/HUD unchanged. Original FIFO for every retained message; only validated same-room/epoch monotone optional clocks may supersede older queued clocks. Actual native callback timestamps, receipt/pong/snapshot order,32message/16MiB bounds and4per16.67ms/4ms budgets remain unchanged. Coalesced/skipped metadata counts are explicit.'};}
}
module.exports={SocketReceiveQueue};
