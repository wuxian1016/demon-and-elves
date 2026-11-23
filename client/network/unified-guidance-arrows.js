'use strict';
const {createDefaultClock}=require('./default-monotonic-clock');
const arrow=require('./resource-guidance-arrow');
function install(g,{clock=createDefaultClock()}={}){if(g.unifiedGuidanceArrows)return;g.drawUnifiedGuidanceArrow=function(ctx,options){return arrow.draw(ctx,{timeMs:clock(),...options});};g.drawGuideArrow394=function(x,y,angle,danger=false){arrow.draw(this.ctx,{tipX:x,tipY:y,angle,timeMs:clock()});};g.unifiedGuidanceArrows={version:'bright-alpha-v1'};}
module.exports={install};
