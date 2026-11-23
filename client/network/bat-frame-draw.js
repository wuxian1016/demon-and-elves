'use strict';
const layouts=require('./bat-frame-trim');
// Paint in the original authored coordinate system. Preserve the full-frame
// footprint for game/cargo math while submitting only the guarded alpha bounds.
function draw(c,frame,family,index,x,y,size){
 const crop=layouts[family][index];
 const paint=family!=='net'&&c.ghostHostBodyImageBN||c.drawImage;
 if(!crop){paint.call(c,frame,x,y,size,size);return;}
 const [left,top,w,h,ow,oh]=crop;
 const sx=size/ow,sy=size/oh;
 paint.call(c,frame,x+left*sx,y+top*sy,w*sx,h*sy);
}
module.exports={draw};
