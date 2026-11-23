'use strict';
// Research adds proportional buffering after the existing fixed armor, without
// removing the native minimum hit damage. This is not enemy- or phase-specific.
const MAX_LEVEL=20,MAX_BUFFER=.80,UNBUFFERED_DAMAGE=150;
function buffer(level,enabled=true){return enabled?Math.max(0,Math.min(MAX_LEVEL,Number(level)||0))/MAX_LEVEL*MAX_BUFFER:0;}
function mitigate(postArmorDamage,minimumDamage,level,enabled=true){if(!enabled)return postArmorDamage;return Math.max(minimumDamage,Math.min(postArmorDamage,UNBUFFERED_DAMAGE)+Math.max(0,postArmorDamage-UNBUFFERED_DAMAGE)*(1-buffer(level)));}
function percent(level,enabled=true){return Math.round(buffer(level,enabled)*100);}
module.exports={buffer,mitigate,percent,MAX_LEVEL,MAX_BUFFER,UNBUFFERED_DAMAGE};
