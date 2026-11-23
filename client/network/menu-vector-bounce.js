'use strict';
module.exports=function install(g){if(g.menuVectorBounceBN)return;for(const name of ['drawClose515','drawMinimapToggle520']){const native=g[name];g[name]=function(c,b){const pose=this.buttonBounceBN?.pose({...b,id:name},name)||b;return native.call(this,c,{...pose,bounceScaleBN:pose.w/b.w});};}g.menuVectorBounceBN=true;};
