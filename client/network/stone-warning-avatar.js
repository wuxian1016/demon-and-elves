'use strict';
function drawStoneWarningAvatar(c,x,y,compact){
 const k=compact?.8:1,s=1.18,X=v=>x+v*k*s,Y=v=>y+v*k*s;
 c.save();c.globalAlpha=1;c.lineWidth=2*k;c.lineJoin='round';c.lineCap='round';
 c.fillStyle='#8F9B9A';c.strokeStyle='#D4E2DC';
 c.beginPath();c.moveTo(X(-17),Y(-10));c.lineTo(X(-12),Y(-18));c.lineTo(X(-5),Y(-20));c.lineTo(X(9),Y(-19));c.lineTo(X(17),Y(-12));c.lineTo(X(19),Y(7));c.lineTo(X(12),Y(18));c.lineTo(X(-11),Y(18));c.lineTo(X(-18),Y(10));c.closePath();c.fill();c.stroke();
 c.fillStyle='#B6C2BA';c.beginPath();c.moveTo(X(-12),Y(-12));c.lineTo(X(-5),Y(-16));c.lineTo(X(5),Y(-14));c.lineTo(X(-2),Y(-10));c.closePath();c.fill();
 c.fillStyle='#F1F8EF';
 for(const side of [-1,1]){c.beginPath();c.ellipse(X(side*6),Y(-1),4*k*s,3*k*s,0,0,Math.PI*2);c.fill();}
 c.fillStyle='#344843';c.beginPath();c.arc(X(-5),Y(0),1.9*k*s,0,Math.PI*2);c.arc(X(5),Y(0),1.9*k*s,0,Math.PI*2);c.fill();
 c.fillStyle='#4F605A';
 c.beginPath();c.moveTo(X(-11),Y(-7));c.lineTo(X(-2),Y(-4));c.lineTo(X(-2),Y(-1));c.lineTo(X(-11),Y(-4));c.closePath();c.fill();
 c.beginPath();c.moveTo(X(11),Y(-7));c.lineTo(X(2),Y(-4));c.lineTo(X(2),Y(-1));c.lineTo(X(11),Y(-4));c.closePath();c.fill();
 c.strokeStyle='#53655E';c.lineWidth=2*k;c.beginPath();c.moveTo(X(-5),Y(10));c.lineTo(X(0),Y(8));c.lineTo(X(5),Y(10));c.stroke();
 c.strokeStyle='#B6C2BA';c.beginPath();c.moveTo(X(-8),Y(14));c.lineTo(X(8),Y(14));c.stroke();
 c.restore();
}
module.exports={drawStoneWarningAvatar};
