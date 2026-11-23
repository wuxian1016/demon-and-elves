'use strict';
module.exports=function create({active,rect,paint,clock=Date.now}){
 const motion=require('./native-control-motion')(clock);let start=null;
 const inside=(b,p)=>p&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
 return {pose:b=>motion.pose(b),touch(kind,e){if(!active()){motion.cancel();start=null;return;}const p=(kind==='end'?e.changedTouches:e.touches)?.[0],point=p?{x:p.clientX??p.x,y:p.clientY??p.y}:null;
 if(kind==='start'){start=point;motion.start(e.touches?.length===1&&inside(rect(),point)?rect():null);}
 if(kind==='move'&&start&&point&&(Math.hypot(point.x-start.x,point.y-start.y)>8||!inside(rect(),point)))motion.cancel();
 if(kind==='cancel'||kind==='end'||e.touches?.length>1){start=null;motion.cancel();}
 paint();},cancel(){start=null;motion.cancel();}};
};
