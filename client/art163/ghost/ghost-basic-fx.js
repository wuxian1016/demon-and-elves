'use strict';
// Visual only. Simulation still owns actual damage, healing, target, ammo and cooldown.
const shots=new WeakMap(),launchEnds=new WeakMap(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
function fire(bot,target,now,cd,level){
 let s=shots.get(bot);if(!s){s={rows:[null,null,null],index:0};shots.set(bot,s);}
 const heal=bot.ghostSiphonBN,n=heal&&heal!==s.drained&&heal.at===now&&heal.x===target.x&&heal.y===target.y?heal.n:0;
 if(n>0)s.drained=heal;
 s.index=(s.index+1)%3;
 s.rows[s.index]={x:target.x,y:target.y,at:now,beam:clamp(cd*.62,135,425),return:clamp(cd*.34,105,258),gap:clamp(cd*.05,13,38),count:3+(level>=10?1:0)+(level>=20?1:0),n};
}
function line(c,w,color,x,y,ex,ey,mx,my){
 c.lineWidth=w;c.strokeStyle=color;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(mx,my,ex,ey);c.stroke();
}
function dot(c,x,y,r,color){
 c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
function beam(c,x,y,t,u){
 const vx=t.x-x,vy=t.y-y,d=Math.hypot(vx,vy)||1,nx=-vy/d,ny=vx/d;
 const p=smooth(u/.25),ex=x+p*vx,ey=y+p*vy,fade=1-smooth((u-.53)/.47),midX=x+(ex-x)*.44,midY=y+(ey-y)*.44;
 c.globalAlpha=fade;c.lineCap='round';
 const warm=1-smooth(u/.28);
 if(warm>0){c.strokeStyle='#be92ff';c.lineWidth=1.7;c.globalAlpha=warm*.83;c.beginPath();c.arc(x,y,4+u*28,0,6.283);c.stroke();c.globalAlpha=fade;}
 if(p>0){
  line(c,15,'rgba(138,103,252,.23)',x,y,ex,ey,midX,midY);
  line(c,8,'rgba(186,132,255,.72)',x,y,ex,ey,midX+nx*4,midY+ny*4);
  line(c,3.5,'#5cf3ff',x,y,ex,ey,midX,midY);line(c,1.8,'#ecffff',x,y,ex,ey,midX,midY);
  for(let i=0;i<5;i++){
   const q=(i*.199+u*2.2)%1,k=Math.sin(q*12-u*8+i)*11;
   const sx=x+q*(ex-x)+nx*k,sy=y+q*(ey-y)+ny*k;
   line(c,i%2?1:1.6,i%2?'#9df4e7':'#c59bf3',sx,sy,sx-vx/d*9,sy-vy/d*9,sx-vx/d*4+nx*3,sy-vy/d*4+ny*3);
  }
  c.fillStyle='rgba(112,224,255,.76)';c.beginPath();c.ellipse(ex,ey,11,7,Math.atan2(vy,vx),0,6.283);c.fill();
  dot(c,ex+vx/d*2,ey+vy/d*2,4.6,'#e2fff7');
 }
 if(p>=.995){
  const q=clamp((u-.24)/.76,0,1);c.globalAlpha=(1-q)*.85;c.strokeStyle='#c995fd';c.lineWidth=2;
  c.beginPath();c.arc(t.x,t.y,6+q*26,0,6.283);c.stroke();
  for(let i=0;i<4;i++){const a=i*1.5708+.4,k=9+q*24,dx=Math.cos(a),dy=Math.sin(a);
   line(c,1.5,'#aff7fd',t.x+dx*k,t.y+dy*k,t.x+dx*(k+5),t.y+dy*(k+5),t.x+dx*(k+2.5),t.y+dy*(k+2.5));}
 }
}
function returnLight(c,x,y,t,age){
 const start=t.beam,finish=start+t.return+(t.count-1)*t.gap;
 if(age<start||age>=finish+430||!(t.n>0))return;
 if(age<finish)for(let i=0;i<t.count;i++){
  const q=(age-start-i*t.gap)/t.return;if(q<0||q>=1)continue;
  const k=smooth(q),prev=smooth(Math.max(0,q-.16)),bend=(i%2?-1:1)*(7+i*3),vx=x-t.x,vy=y-t.y;
  const sx=t.x+vx*k,sy=t.y+vy*k+Math.sin(k*Math.PI)*bend;
  const tx=t.x+vx*prev,ty=t.y+vy*prev+Math.sin(prev*Math.PI)*bend;
  c.globalAlpha=Math.sin(.16+q*2.68)*.85;
  line(c,2,'#70eac0',sx,sy,tx,ty,(tx+sx)*.5,(ty+sy)*.5-3);
  c.fillStyle='rgba(121,255,193,.56)';c.beginPath();c.ellipse(sx,sy,5,3,Math.atan2(sy-ty,sx-tx),0,6.283);c.fill();dot(c,sx,sy,2.3,'#dbfff0');
 }
 else{
  const q=(age-finish)/430;c.globalAlpha=1-smooth(q);
  if(q<.54){c.lineWidth=2;c.strokeStyle='#99ffd0';c.beginPath();c.ellipse(x,y,4+q*19,4+q*16,0,0,6.283);c.stroke();dot(c,x,y,4-q*4,'#b2ffdd');}
  c.font='bold 14px sans-serif';c.textAlign='center';c.strokeStyle='#172d28';c.fillStyle='#aeffe4';c.lineWidth=2.5;
  const label=t.n>=1?'+'+Math.round(t.n):'+生命';c.strokeText(label,x+25,y-62-q*8);c.fillText(label,x+25,y-62-q*8);
 }
}
function paint(c,bot,now){
 const s=shots.get(bot);if(!s)return;
 const x=bot.x+8.4,y=bot.y-41.4; // Chest gem in the authored 180×176 body, drawn at height 110.
 const recent=s.rows[s.index],current=now-recent.at;
 if(current>=1250){shots.delete(bot);return;}
 if(current<0)return;
 c.save();c.globalCompositeOperation='screen';
 try{
  if(current<recent.beam)beam(c,x,y,recent,current/recent.beam);
  let showedHeal=false;
  for(let i=0;i<3;i++){
   const t=s.rows[(s.index+3-i)%3];if(!t||!(t.n>0))continue;
   const age=now-t.at,finish=t.beam+t.return+(t.count-1)*t.gap;
   if(age>=finish){if(age>=finish+430||showedHeal)continue;showedHeal=true;}
   returnLight(c,x,y,t,age);
  }
 }finally{c.restore();}
}
// Keep the native front mounted chest anchor while a core beam or siphon is still in flight.
function auxiliary(bot,now){
 if(bot?.isRobot&&Number.isFinite(now))launchEnds.set(bot,now+340);
}
function front(bot,now){
 if(!Number.isFinite(now))return false;
 if(now<(launchEnds.get(bot)||0))return true;
 const s=shots.get(bot);if(!s)return false;
 for(const t of s.rows){if(!t)continue;const age=now-t.at;
  if(age>=0&&(age<t.beam||t.n>0&&age<t.beam+t.return+(t.count-1)*t.gap))return true;
 }
 return false;
}
module.exports={fire,paint,front,auxiliary};
