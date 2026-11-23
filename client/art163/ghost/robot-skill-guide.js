'use strict';
const {guideLayout}=require('./robot-guide-scenes');
// Presentation-only first use. Targets and simulation remain untouched until the user exits.
function create(g,{offline,viewport,render,ready,resetInput,hidden=()=>false,wake=()=>{},now=Date.now}){
 let run=null,capture=false,consumed;
 const player=()=>g.player;
 const controlled=r=>r&&r.isRobot&&!r.dead&&r.driver===player()&&player()?.drivingTank===r&&!player()?.dead;
 const inPlay=()=>offline()&&!g.tutorial&&!g.superChallenge580&&(g.state==='prep'||g.state==='hunt')&&!g.roundStarting&&!g.roundLoading591&&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.ceremony;
 const valid=s=>s&&player()===s.player&&controlled(s.robot)&&inPlay()&&s.eligible(s.robot);
 const same=(a,b)=>a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
 const box=()=>run?.hit&&same(run.hit,guideLayout(viewport()).skip)?run.hit:null;
 const id=t=>t?.identifier??0;
 const point=t=>({x:t?.clientX??t?.x,y:t?.clientY??t?.y});
 function inside(p,b){
  if(!p||!b||!(p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h))return false;
  const dx=Math.max(0,b.x+b.r-p.x,p.x-b.x-b.w+b.r),dy=Math.max(0,b.y+b.r-p.y,p.y-b.y-b.h+b.r);
  return dx*dx+dy*dy<=b.r*b.r;
 }
 const mask={robotSiege:1,robotFlame:2,robotSuper:4,ghostRelocate:8,ghostCopy:16,ghostFlame:32};
 const visualKey=(id,r)=>id==='robotFlame'&&r.ghostMechBN===true?'ghostFlame':id;
 const seen=id=>!!(g.robotGuideSeenBN&mask[id]);
 function close(completed){
  const s=run;run=null;
  if(!completed||!valid(s))return;
  g.robotGuideSeenBN=(g.robotGuideSeenBN|mask[s.key])&63;
  s.resume?.(s.robot);
  wake();
 }
 function clock(active=true){
  if(!run)return false;
  if(!valid(run)){close(false);return false;}
  const t=now();
  if(active&&!hidden()&&run.last!==null)run.age+=Math.max(0,Math.min(70,t-run.last));
  run.last=active&&!hidden()?t:null;
  if(run.age>=run.duration){close(true);return false;}
  return true;
 }
 return {
  begin(id,robot,{eligible=()=>true,resume,duration=5500}={}){
   if(run)return true;
   const key=visualKey(id,robot||{});
   if(!Object.hasOwn(mask,id)||id==='ghostFlame'||seen(key)||!inPlay()||!controlled(robot)||!eligible(robot)||!ready(key,robot))return false;
   resetInput();
   run={id,key,robot,player:player(),eligible,resume,duration,age:0,last:now()};
   wake();return true;
  },
  playing:()=>!!run,
  combatPaused(){return clock();},
  render(c){
   if(!clock())return;
   const v=viewport(),layout=guideLayout(v),r=layout.skip;
   c.save();
   try{
    c.fillStyle='rgba(7,12,20,.79)';c.fillRect(0,0,v.width,v.height);
    render(run.key,c,v,run.age,run.duration,layout);
    const {x,y,w,h}=r,a=r.r;
    c.beginPath();c.moveTo(x+a,y);c.arcTo(x+w,y,x+w,y+h,a);c.arcTo(x+w,y+h,x,y+h,a);c.arcTo(x,y+h,x,y,a);c.arcTo(x,y,x+w,y,a);c.closePath();
    c.fillStyle='#22352e';c.fill();c.strokeStyle='#9fcca8';c.lineWidth=1;c.stroke();
    c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f2efd9';c.font='bold 15px sans-serif';
    c.fillText('跳过',r.x+r.w/2,r.y+r.h/2);run.hit=r;
   }finally{c.restore();}
  },
  start(touches){
   const one=touches?.length===1,t=touches?.[0];
   if(!run&&(!capture||one)){
    // New downs recover after missing release. A late release with a distinct
    // identifier still belongs to the old guide, not the new world gesture.
    capture=false;if(one&&id(t)===consumed)consumed=undefined;return false;
   }
   capture=true;
   if(run&&one&&inside(point(t),box())){consumed=id(t);close(true);}
   return true;
  },
  move(){return !!run||capture;},
  end(changed,remaining){
   if(!run&&!capture){
    const late=consumed!==undefined&&changed?.length===1&&id(changed[0])===consumed;
    if(late||!remaining?.length)consumed=undefined;
    return late;
   }
   if(!remaining?.length){capture=false;consumed=undefined;}
   return true;
  },
  cancel(){capture=false;consumed=undefined;},
  suspend(){if(run?.id==='ghostRelocate'||run?.id==='ghostCopy')close(false);else if(run)clock(false);capture=false;consumed=undefined;},
  clear(){close(false);capture=false;consumed=undefined;},
  report:()=>({active:!!run,age:run?.age??null,id:run?.id,seen:Object.keys(mask).filter(seen).sort()})
 };
}
module.exports={create};
