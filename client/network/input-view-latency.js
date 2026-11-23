'use strict';
// Same-client monotonic timing only. No simulation, requests, timers, args or IDs exported.
// A rendered authority view covering lastSeq proves processing, not physical pixel latency.
const valid=n=>Number.isSafeInteger(n)&&n>=0;
class InputViewLatency{
 constructor(emit,onComplete=null){this.emit=emit;this.onComplete=onComplete;this.reset();}
 reset(){this.pending=new Map();this.applied=null;this.dropped=0;this.completed=0;}
 queued(command,at){if(!valid(command?.epoch)||!valid(command?.seq)||!Number.isFinite(at))return;const key=command.epoch+':'+command.seq;if(this.pending.has(key))return;this.pending.set(key,{command,epoch:command.epoch,seq:command.seq,at,accepted:false,drawAt:null});if(this.pending.size>64){this.pending.delete(this.pending.keys().next().value);this.dropped++;}}
 receipt(command,receipt){const key=command?.epoch+':'+command?.seq,p=this.pending.get(key);if(!p||receipt?.epoch!==p.epoch||receipt.seq!==p.seq)return;if(receipt.accepted!==true){this.pending.delete(key);return;}p.accepted=true;this.finish(key,p);}
 failed(command){this.pending.delete(command?.epoch+':'+command?.seq);}
 appliedView(packet){if(!valid(packet?.epoch)||!valid(packet?.lastSeq)||!valid(packet?.revision))return;this.applied={epoch:packet.epoch,lastSeq:packet.lastSeq,revision:packet.revision};}
 drawn(view,at){const a=this.applied;if(!a||!Number.isFinite(at)||view?.epoch!==a.epoch||view?.revision!==a.revision)return;for(const [key,p]of this.pending){if(p.epoch!==a.epoch||p.seq>a.lastSeq||at<p.at)continue;if(p.drawAt===null)p.drawAt=at;this.finish(key,p);}}
 finish(key,p){if(!p.accepted||p.drawAt===null)return;this.pending.delete(key);this.completed++;try{this.emit('inputToConfirmedViewDrawMs',Math.max(0,p.drawAt-p.at));}catch(_){}try{this.onComplete?.(p.command,p.drawAt);}catch(_){}}
 report(){return {pending:this.pending.size,dropped:this.dropped,completed:this.completed,scope:'command enqueue to completed JS draw of same-epoch server view covering sequence, only after accepted receipt; not native touch, photon timing or proof a particular entity position was rendered without preview'};}
}
module.exports={InputViewLatency};
