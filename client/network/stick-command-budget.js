'use strict';
// Counts accepted controls only; never changes an accepted command or sequence.
// Reserve the last slot for release. This bounds stick traffic to24 per rolling
// second while allowing the newest unsent intent to replace older local intent.
class StickCommandBudget{
 constructor(){this.accepted=[];this.lastNow=-Infinity;}
 trim(now){now=Number.isFinite(now)?Math.max(this.lastNow,now):this.lastNow;this.lastNow=now;this.accepted=this.accepted.filter(at=>now-at<1000);return now;}
 allows(now,moving){this.trim(now);return this.accepted.length<(moving?23:24);}
 record(now){const at=this.trim(now);this.accepted.push(at);}
}
module.exports={StickCommandBudget};
