'use strict';

// The mini-game's legacy Canvas2D context may not expose native roundRect.
module.exports=function roundedCardPath(c,x,y,w,h,r){
 c.beginPath();
 if(typeof c.roundRect==='function'){
  c.roundRect(x,y,w,h,r);
  return;
 }
 const right=x+w,bottom=y+h;
 const radius=Math.max(0,Math.min(r,w/2,h/2));
 c.moveTo(x+radius,y);
 c.lineTo(right-radius,y);
 c.quadraticCurveTo(right,y,right,y+radius);
 c.lineTo(right,bottom-radius);
 c.quadraticCurveTo(right,bottom,right-radius,bottom);
 c.lineTo(x+radius,bottom);
 c.quadraticCurveTo(x,bottom,x,bottom-radius);
 c.lineTo(x,y+radius);
 c.quadraticCurveTo(x,y,x+radius,y);
 c.closePath();
};
