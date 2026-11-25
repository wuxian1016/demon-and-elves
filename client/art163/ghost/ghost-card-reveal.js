'use strict';
const clip=x=>Math.max(0,Math.min(1,x)),ease=x=>{x=clip(x);return x*x*(3-2*x);},mix=(a,b,t)=>a+(b-a)*t;
const END=2610,ORBIT=1100,FLIP=1860,MID=2200,SPIN=Math.PI*2*.74;
const rank=[0,1,2,3,4].sort((a,b)=>Math.cos(SPIN+a*Math.PI*.4-Math.PI/2)-Math.cos(SPIN+b*Math.PI*.4-Math.PI/2));
function box(c,x,y,w,h){c.beginPath();const r=Math.min(w*.14,8);c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
function back(c,x,y,w,h,alpha,selected){c.save();c.globalAlpha=alpha;box(c,x-w/2,y-h/2,w,h);c.fillStyle='#312247';c.fill();c.strokeStyle=selected?'#fff0ab':'#c29155';c.lineWidth=selected?2.5:1.5;c.stroke();if(w>23){c.font='bold '+Math.round(w*.62)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe4a4';c.fillText('?',x,y);}c.restore();}
function glow(c,x,y,r,s){const grad=c.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,'rgba(180,255,226,'+s*.48+')');grad.addColorStop(.5,'rgba(77,245,219,'+s*.43+')');grad.addColorStop(.85,'rgba(255,210,119,'+s*.19+')');grad.addColorStop(1,'rgba(100,235,210,0)');c.fillStyle=grad;c.fillRect(x-r,y-r,r*2,r*2);}
function layout(z,s,award=false){
 const a=z.safe||{x:0,y:0,right:z.w,bottom:z.h},usableH=a.bottom-a.y,usableW=a.right-a.x,x=(a.x+a.right)/2;
 // Fit the complete print (including both gold tips), not its transparent padding.
 const inkTop=11.5/480,inkH=(689.5-11.5)/480,margin=8,gap=8,bh=44;
 const side=usableW>usableH*1.36&&usableW>=440,sideW=112;
 const bottom=a.bottom-margin-(side?0:gap+bh),top=a.y+margin;
 const limit=Math.max(1,Math.min(440,usableW-2*(margin+(side?sideW+gap:0)),(bottom-a.y-margin)/inkH));
 const w=Math.min(limit,(bottom-top)/inkH),h=w*1.5,inkY=top+(bottom-top-w*inkH)/2,y=inkY-w*inkTop+h/2,by=inkY+w*inkH+gap;
 const bw=Math.min(128,Math.max(68,w*.37),(usableW-2*margin-gap)/2);
 const button=(bx,yy,ww)=>({x:bx,y:yy,w:ww,h:bh,paint:{x:bx,y:yy+2,w:ww,h:40,fontSize:Math.min(16,Math.max(13,ww*.135))}});
 const sx=x+w*204/480+gap,sy=inkY+(w*inkH-2*bh-gap)/2;
 return {x,y,w,h,a:0,award:side?button(sx,inkY+(w*inkH-bh)/2,sideW):button(x-bw/2,by,bw),
  cancel:side?button(sx,sy+bh+gap,sideW):button(x-bw-gap/2,by,bw),
  ok:side?button(sx,sy,sideW):button(x+gap/2,by,bw)};
}
function backdrop(c,z,alpha=.54){c.save();c.fillStyle='rgba(0,0,0,'+alpha+')';c.fillRect(0,-(z.displayTop||0),z.w,z.displayFull||z.h);c.restore();}
function draw(c,z,s,age,k,slot,art){
 const {x,y,w}=layout(z,s,true),p=Math.min(s,z.h/530),cardW=60*p,cardH=94*p;
 c.save();backdrop(c,z,.54*(1-k));
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
module.exports={draw,END,layout,backdrop};
