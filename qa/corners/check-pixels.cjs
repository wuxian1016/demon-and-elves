const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'), {createCanvas}=require('@napi-rs/canvas');
const [modulePath,dest,version]=process.argv.slice(2),main=require(modulePath);
const h=(version==='fixed'),proof=[];
fs.mkdirSync(dest,{recursive:true});
const mix=(a,b,t)=>a+(b-a)*t,eq=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
for(const [orient,width,height] of [['portrait',390,844],['landscape',844,390]]){
 const scale=3,canvas=createCanvas(width*scale,height*scale),c=canvas.getContext('2d');
 const v={width,height,fullHeight:height,safeLeft:orient==='portrait'?0:32,safeRight:orient==='portrait'?0:32,safeTop:18,safeBottom:16},
 l=main.layout(v),o={x:width*.24,y:height*.55,w:104,h:44},target={x:width-116,y:height-124,w:38,h:38};
 let now=1000;
 const game={state:'hunt',player:{},troll:{}},slot=()=>({...target,icon(c,x,y,d){c.fillStyle='#741ea2';c.fillRect(x,y,d,d);}});
 const scene=()=>({length:5500,step(){},draw(c,s){c.fillStyle='#ff0000';c.fillRect(s.x+s.w*.2,s.y+s.h*.6,40,40);}});
 const flow=main.create(game,{offline:()=>true,viewport:()=>v,now:()=>now,stageFor:()=>({ready:()=>true,create:scene}),slot});
 const p=(r)=>[r.x+r.w/2,r.y+r.h/2];
 const rect=(age,closing)=>{const a=closing===null?eq(age/300):eq(closing/480),[ox,oy]=p(o),[cx,cy]=p(l),[tx,ty]=p(target);
 const w=closing===null?mix(o.w,l.w,a):mix(l.w,target.w,a),hh=closing===null?mix(o.h,l.h,a):mix(l.h,target.w,a),
 x=closing===null?mix(ox,cx,a):mix(cx,tx,a),y=closing===null?mix(oy,cy,a):mix(cy,ty,a);
 return{x:x-w/2,y:y-hh/2,w,h:hh,rad:Math.min(w,hh)*(closing===null?.05+.15*(1-a):.02+.48*a)};};
 function draw(){c.setTransform(scale,0,0,scale,0,0);flow.draw(c);}
 const step=(target)=>{while(now<target){now+=Math.min(55,target-now);draw();}};
 const picks=(x,y)=>{const rx=Math.round(x*scale),ry=Math.round(y*scale),{data}=c.getImageData(rx-2,ry-2,5,5);let m=0;
  for(let i=0;i<data.length;i+=4)if(data[i]>90&&data[i+1]>60&&data[i]-data[i+1]>15&&data[i+1]-data[i+2]>15)m++;return m;};
 function record(name,age,closing){
  const b=rect(age,closing),r=b.rad,dx=.5+(r-.5)*(1-Math.SQRT1_2);
  const gold=[[0,0],[1,0],[0,1],[1,1]].map(([i,j])=>picks(b.x+(i?b.w-dx:dx),b.y+(j?b.h-dx:dx)));
  const invisible=[[0,0],[1,0],[0,1],[1,1]].map(([i,j])=>{const x=b.x+(i?b.w-1:1),y=b.y+(j?b.h-1:1),{data}=c.getImageData(Math.round(x*scale),Math.round(y*scale),1,1);return Array.from(data);});
  if(h){assert(gold.every(Boolean),JSON.stringify({orient,name,b,gold}));assert(invisible.every(pixel=>pixel.every((v,i)=>v===(i===3?255:22))),JSON.stringify({orient,name,invisible}));}
  else if(name==='fight')assert(gold.every(x=>x===0),JSON.stringify({orient,name,gold}));
  if(name==='fight'||h&&(name==='early-grow'||name==='shrink-220'))fs.writeFileSync(path.join(dest,orient+'-'+name+'.png'),canvas.toBuffer('image/png'));
  proof.push({orient,name,gold,invisible});
 }
 assert(flow.announce('ghostFlame',o,'激光升至 10 级'));draw();
 record('entry-first',0,null);step(1140);record('early-grow',140,null);step(1300);record('open',300,null);step(3000);record('fight',2000,null);
 assert(flow.start([{identifier:1,x:l.skip.x+l.skip.w/2,y:l.skip.y+l.skip.h/2}]));
 draw();record('shrink-first',2000,0);step(3220);record('shrink-220',2000,220);step(3455);record('shrink-455',2000,455);
 step(3610);assert(!flow.playing());assert.equal(game.robotGuideApprovedSeenBN,32);
}
fs.writeFileSync(path.join(dest,'proof.json'),JSON.stringify(proof,null,2));
console.log(version,proof.length,'frames');
