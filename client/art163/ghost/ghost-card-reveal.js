'use strict';
const clip=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clip(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
const END=2610,ORBIT=1100,FLIP=1860,MID=2200,SPIN=Math.PI*2*.74;
const rank=[0,1,2,3,4].sort((a,b)=>Math.cos(SPIN+a*Math.PI*.4-Math.PI/2)-Math.cos(SPIN+b*Math.PI*.4-Math.PI/2));
function box(c,x,y,w,h){c.beginPath();const r=Math.min(w*.14,8);c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function back(c,x,y,w,h,alpha,selected){c.save();c.globalAlpha=alpha;box(c,x-w/2,y-h/2,w,h);c.fillStyle='#312247';c.fill();c.strokeStyle=selected?'#fff0ab':'#c29155';c.lineWidth=selected?2.5:1.5;c.stroke();if(w>23){c.font='bold '+Math.round(w*.62)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe4a4';c.fillText('?',x,y);}c.restore();}
function glow(c,x,y,r,s){const grad=c.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(180,255,226,'+s*.48+')');grad.addColorStop(.5,'rgba(77,245,219,'+s*.43+')');grad.addColorStop(.85,'rgba(255,210,119,'+s*.19+')');grad.addColorStop(1,'rgba(100,235,210,0)');c.fillStyle=grad;c.fillRect(x-r,y-r,r*2,r*2);}
function layout(z,s,award=false){
 const a=z.safe||{x:0,y:0,right:z.w,bottom:z.h};
 const usableH=Math.max(80,a.bottom-a.y),usableW=Math.max(100,a.right-a.x),x=(a.x+a.right)/2,scale=Math.min(s,1.05);
 // The expanded choice gives the print priority; the animated award stays identical.
 if(!award){
  const hitH=44,gap=6,minTop=Math.max(a.y,Math.min(a.bottom-115,(z.hudBottom||0)+9));
  const w=Math.min(266*s,usableW-14,(a.bottom-minTop-hitH-gap-8)/1.5),h=w*1.5,artBottom=h*689.5/720;
  const top=Math.max(minTop,a.y+(usableH-(artBottom+gap+hitH))/2),by=top+artBottom+gap,between=8;
  const bw=Math.max(44,Math.min(76,w*.4)),left=x-bw-between/2;
  const button=bx=>({x:bx,y:by,w:bw,h:hitH,paint:{x:bx,y:by+2,w:bw,h:32,fontSize:12}});
  return {x,y:top+h/2,w,h,a:0,cancel:button(left),ok:button(x+between/2)};
 }
 const minTop=a.y;
 const bh=Math.max(44,50*scale),gap=8,w=Math.min(236*s,usableW-12,(a.bottom-minTop-bh-gap-12)/1.5),h=w*1.5;
 const goldBottom=h*689.5/720;
 const top=Math.max(minTop,a.y+(usableH-(goldBottom+gap+bh))/2),y=top+h/2,by=top+goldBottom+gap;
 const cw=Math.min(122*scale,(usableW-28)/2),ow=Math.min(138*scale,(usableW-28)/2),left=x-(cw+ow+8)/2,bw=Math.min(usableW-12,Math.max(96,136*scale));
 return {x,y,w,h,a:0,award:{x:x-bw/2,y:by,w:bw,h:bh},cancel:{x:left,y:by,w:cw,h:bh},ok:{x:left+cw+8,y:by,w:ow,h:bh}};
}
function draw(c,z,s,age,k,slot,art){
 const {x,y,w}=layout(z,s,true),p=Math.min(s,z.h/530),cardW=60*p,cardH=94*p;
 c.save();c.fillStyle='rgba(11,10,22,'+(.54*(1-k))+')';c.fillRect(0,0,z.w,z.h);
 if(k||age>=END){const dx=mix(x,slot.x,k),dy=mix(y,slot.y,k),dw=mix(w,54*s,k),dh=mix(w*1.5,54*388/267*s,k);glow(c,dx,dy,Math.min(z.w*.46,dw*1.12),.24*(1-k));art(c,'ghost',{x:dx-dw/2,y:dy-dh/2,w:dw,h:dh},false);c.restore();return;}
 if(age<ORBIT){const a=SPIN*ease(age/(ORBIT*.76)),settle=ease((age-ORBIT*.72)/(ORBIT*.28)),alpha=ease(age/185);
 for(let i=0;i<5;i++){const q=a+i*Math.PI*.4-Math.PI/2,j=rank.indexOf(i)-2;back(c,x+mix(Math.cos(q)*171*p,j*91*p,settle),y+mix(Math.sin(q)*67*p,Math.abs(j)*7*p,settle),cardW,cardH,alpha,false);}
 }else{
 const f=ease((age-ORBIT)/445);if(f<1)for(const i of [-2,-1,1,2])back(c,x+i*91*p,y+Math.abs(i)*7*p,cardW,cardH,1-f,false);
 const flash=ease((age-ORBIT)/135)*(1-ease((age-ORBIT-210)/620));glow(c,x,y,Math.min(z.w*.46,mix(102*p,w*1.12,ease((age-FLIP)/(END-FLIP)))),.24+.72*flash+.3*ease((age-MID)/(END-MID)));
 if(age<FLIP)back(c,x,y,cardW,cardH,1,true);
 else if(age<MID){const span=mix(cardW,2*p,ease((age-FLIP)/(MID-FLIP)));back(c,x,y,span,cardH,1,true);}
 else {const u=ease((age-MID)/(END-MID)),dw=mix(2*p,w,u),dh=mix(cardH,w*1.5,u);
  // Edge-on reveal uses a clipping aperture over the real, undistorted portrait.
  c.save();c.beginPath();c.rect(x-dw/2,y-dh/2,dw,dh);c.clip();art(c,'ghost',{x:x-w/2,y:y-w*.75,w,h:w*1.5},false);c.restore();
 }
 }
 c.restore();
}
module.exports={draw,END,layout};
