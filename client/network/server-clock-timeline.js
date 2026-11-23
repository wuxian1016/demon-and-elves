'use strict';
// Receipt-aligned service time. It is not an entity sample or one-way latency.
class BaseServerClockTimeline{
 constructor({maxAdvanceMs=250,maxSlewMs=2}={}){this.maxAdvanceMs=maxAdvanceMs;this.maxSlewMs=maxSlewMs;this.reset();}
 reset(){this.anchor=null;this.last=null;this.sampledAt=null;this.samples=0;this.ignored=0;}
 observe({roomId,epoch,serverTimeMs,receivedAtMs}){if(typeof roomId!=='string'||!Number.isSafeInteger(epoch)||epoch<1||!Number.isFinite(serverTimeMs)||serverTimeMs<0||!Number.isFinite(receivedAtMs))return false;const a=this.anchor;if(!a||a.roomId!==roomId||a.epoch!==epoch){this.reset();this.anchor={roomId,epoch,serverTimeMs,receivedAtMs,rawReceivedAtMs:receivedAtMs,observedServerMs:serverTimeMs};this.last=serverTimeMs;this.samples=1;return true;}if(serverTimeMs<=a.observedServerMs||receivedAtMs<a.rawReceivedAtMs){this.ignored++;return false;}const anchorAt=Math.max(receivedAtMs,this.sampledAt??receivedAtMs),projected=this.sample(anchorAt),adjustedServerMs=serverTimeMs+(anchorAt-receivedAtMs),slew=Math.max(-this.maxSlewMs,Math.min(this.maxSlewMs,(adjustedServerMs-projected)*.1));this.anchor={roomId,epoch,serverTimeMs:Math.max(this.last,projected+slew),receivedAtMs:anchorAt,rawReceivedAtMs:receivedAtMs,observedServerMs:serverTimeMs};this.samples++;return true;}
 sample(now){if(!this.anchor||!Number.isFinite(now))return null;this.sampledAt=Math.max(this.sampledAt??now,now);const a=this.anchor,value=a.serverTimeMs+Math.min(this.maxAdvanceMs,Math.max(0,now-a.receivedAtMs));return this.last=Math.max(this.last??value,value);}
 report(now){return{samples:this.samples,ignored:this.ignored,estimatedServerMs:this.sample(now),maxAdvanceMs:this.maxAdvanceMs,maxSlewMs:this.maxSlewMs,scope:'Receipt-aligned continuous service clock only; no cross-device clock subtraction, no entity samples, no authority freshness or latency replacement.'};}
}


// Service-clock recovery. Does not refresh entity/authority age,
// acknowledge inputs, alter RTT timestamps, or run any gameplay simulation.
class ServerClockTimeline extends BaseServerClockTimeline{
 constructor(options={}){super(options);this.maxBurstMs=500;}
 reset(){super.reset();this.recovering=false;this.recoveryCreditMs=0;this.healthySamples=0;this.reanchors=0;this.implausible=0;this.lastRejection=null;}
 observe(o){
  this.lastRejection=null;const a=this.anchor;
  if(!a||!o||a.roomId!==o.roomId||a.epoch!==o.epoch||!Number.isFinite(o.receivedAtMs)||!Number.isFinite(o.serverTimeMs)||o.serverTimeMs<=a.observedServerMs||o.receivedAtMs<a.rawReceivedAtMs)return super.observe(o);
  const localGap=o.receivedAtMs-a.rawReceivedAtMs,serverGap=o.serverTimeMs-a.observedServerMs;
  if(localGap>this.maxAdvanceMs)this.recoveryCreditMs=Math.max(this.recoveryCreditMs,localGap);
  // A native-dispatch pause grants only its measured local duration as catchup
  // credit. A tiny-arrival-gap clock cannot inject an arbitrary future time.
  if(serverGap>localGap+this.maxBurstMs+this.recoveryCreditMs){this.ignored++;this.implausible++;this.lastRejection='implausible-forward-jump';return false;}
  const anchorAt=Math.max(o.receivedAtMs,this.sampledAt??o.receivedAtMs),projected=this.sample(anchorAt),adjusted=o.serverTimeMs+(anchorAt-o.receivedAtMs);
  if(localGap>this.maxAdvanceMs||adjusted-projected>this.maxAdvanceMs)this.recovering=true;
  if(!this.recovering)return super.observe(o);
  this.recoveryCreditMs=Math.max(0,this.recoveryCreditMs-Math.max(0,serverGap-localGap));
  this.healthySamples=localGap>=8&&Math.abs(serverGap-localGap)<=Math.max(20,localGap*.5)?this.healthySamples+1:0;
  const value=Math.max(this.last,adjusted);this.anchor={roomId:o.roomId,epoch:o.epoch,serverTimeMs:value,receivedAtMs:anchorAt,rawReceivedAtMs:o.receivedAtMs,observedServerMs:o.serverTimeMs};this.last=value;this.samples++;this.reanchors++;
  if(this.healthySamples>=2){this.recovering=false;this.healthySamples=0;this.recoveryCreditMs=0;}return true;
 }
 report(now){return{...super.report(now),recovering:this.recovering,reanchors:this.reanchors,implausibleForwardJumps:this.implausible,recoveryScope:'Service-clock discontinuity recovery only; never a new entity sample, authority freshness, accepted ACK, or network RTT.'};}
}
module.exports={ServerClockTimeline};
