'use strict';
// Reinvoke native vector gear/text construction at each discrete pose size.
// No canvas transform or resampling an already-rendered button as animation.
module.exports=function install(g){if(g.gearButtonBounceBN)return;const native=g.drawSettingsGear514;g.drawSettingsGear514=function(ctx,b,diameter,k){const api=this.buttonBounceBN;if(!api||this.sessionMenuOpen||this.saveSlotsPanel)return native.call(this,ctx,b,diameter,k);const pose=api.pose({...b,id:'settingsGear'},'设置'),ratio=pose.w/b.w;return native.call(this,ctx,pose,diameter*ratio,k*ratio);};g.gearButtonBounceBN=true;};
