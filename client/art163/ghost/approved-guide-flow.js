'use strict';
// Approved tutorial orchestration. Skill state, health, resources, cooldown and targeting
// are deliberately not touched here. Every scene adapter must own its isolated props.
const rows={
 robotSiege:[1,'激光重炮','robotSiege','激光升至 10 级'],
 robotFlame:[2,'扇形喷火','robotFlame','激光升至 10 级'],
 robotSuper:[4,'狂暴模式','robotSuper','激光和小机器人均达到 20 级'],
 ghostRelocate:[8,'传送','ghostRelocate','幽灵机甲激光升至 10 级'],
 ghostCopy:[16,'复制恶魔','ghostCopy','激光和小机器人均达到 20 级'],
 ghostFlame:[32,'幽灵紫焰','robotFlame','幽灵机甲激光升至 10 级'],
 ghostStealth:[64,'隐身','collectGold','成功转职为幽灵精灵'],
 ghostPossess:[128,'附身','collectWood','成功转职为幽灵精灵'],
 batRaid:[256,'偷取 / 送达','collectWood','成功附身蝙蝠']
};
const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const mid=r=>[r.x+r.w/2,r.y+r.h/2];
const entrance=300,duration=1120,closeDuration=600;
function layout(v){
 const l=(v.safeLeft||0)+8,r=v.width-(v.safeRight||0)-8,b=v.height-(v.safeBottom||0)-8;
 const w=Math.min(440,v.width-30,r-l),x=clamp((v.width-w)/2,l,r-w);
 const capsule=v.capsule;
 let t=(v.safeTop||0)+8;
 if(capsule&&capsule.left<x+w&&capsule.right>x)t=Math.max(t,capsule.bottom+8);
 const h=Math.min(440,b-t),y=clamp((v.height-h)/2+12,t,b-h);
 if(w<200||h<210)return null;
 const f={x:x+(w-104)/2,y:y+h-52,w:104,h:44};
 return {x,y,w,h,skip:f,stage:{x:x+12,y:y+53,w:w-24,h:h-162}};
}
const validRect=(r,v)=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0&&r.x>=0&&r.y>=0&&r.x+r.w<=v.width&&r.y+r.h<=v.height;
const rect=r=>({x:r.x,y:r.y,w:r.w,h:r.h});
const put=(c,r,rad=0)=>{c.beginPath();if(!rad){c.rect(r.x,r.y,r.w,r.h);return;}const {x,y,w,h}=r;c.moveTo(x+rad,y);c.arcTo(x+w,y,x+w,y+h,rad);c.arcTo(x+w,y+h,x,y+h,rad);c.arcTo(x,y+h,x,y,rad);c.arcTo(x,y,x+w,y,rad);c.closePath();};
function letter(c,s,x,y,n,color,width,bold=false){c.textAlign='center';c.textBaseline='middle';c.font=(bold?'bold ':'')+n+'px sans-serif';c.fillStyle=color;c.fillText(s,x,y,width);}
function create(g,{offline,viewport,hidden=()=>false,now=Date.now,wake=()=>{},resetInput=()=>{},slot,dockEligible=()=>true,stageFor}){
 let q=[],run=null,capture=false,consumed=null,handoff=false;
 const mask=()=>g.robotGuideApprovedSeenBN??(g.robotGuideSeenBN&448);
 const seen=k=>(mask()&rows[k][0])!==0;
 const able=()=>offline()===true&&!g.player?.dead&&!g.tutorial&&!g.superChallenge580&&['hunt','prep'].includes(g.state)&&!g.roundLoading591&&!g.roundStarting&&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.ceremony;
 const frameAble=()=>able()&&!g.batIntroCardBN?.visible?.()&&!g.cardPresentation?.blocksDock?.()&&!g.dragonTutorialBL?.active;
 const wanted=k=>!!rows[k]&&!seen(k)&&run?.key!==k&&!q.some(s=>s.key===k);
 function announce(key,origin,completed,originPanel=null){
  const v=viewport();if(!wanted(key)||!stageFor(key)?.create||!validRect(origin,v)||!able())return false;
  q.push({key,origin:rect(origin),sourceViewport:[v.width,v.height],completed,originPanel,queuedOn:now(),retryAt:0,failures:0,player:g.player,troll:g.troll});wake();return true;
 }
 const sameRun=s=>s.player===g.player&&s.troll===g.troll;
 function backoff(s){s.failures++;s.retryAt=now()+Math.min(30000,1500*2**Math.min(5,s.failures-1));}
 function release(record,retry=false){
  const s=run;run=null;if(!s)return;
  try{s.scene.dispose?.();}catch(_){}
  if(record&&sameRun(s))g.robotGuideApprovedSeenBN=mask()|rows[s.key][0];
  if(retry&&sameRun(s)&&!seen(s.key)){backoff(s);q.push({key:s.key,origin:s.origin,originPanel:s.originPanel,sourceViewport:s.sourceViewport,completed:s.completed,queuedOn:s.queuedOn,retryAt:s.retryAt,failures:s.failures,player:s.player,troll:s.troll});}
  handoff=true;
  wake();
 }
 function startFrame(v){
  if(!q.length||!frameAble())return;
  q=q.filter(s=>sameRun(s)&&!seen(s.key));
  let s,provider,target,index=-1;
  for(let i=0;i<q.length;i++){
   const next=q[i];if(!dockEligible(next.key)||next.retryAt>now())continue;
   const p=stageFor(next.key),t=slot(next.key,rows[next.key][2]);
   if(t&&validRect(t,v)&&typeof t.icon==='function'&&p?.ready?.()!==false){s=next;provider=p;target=t;index=i;break;}
  }
  if(index<0)return;
  let scene;try{scene=provider.create(s.key);}catch(_){}if(!scene||!Number.isFinite(scene.length)||scene.length<200||scene.length>6500||typeof scene.draw!=='function'||typeof scene.step!=='function'){try{scene?.dispose?.();}catch(_){}backoff(s);return;}
  q.splice(index,1);resetInput();run={...s,scene,target,last:null,age:0,closeAt:null,stageAge:0,painted:false};wake();
 }
 function dismissOrigin(s){const panel=s.originPanel;s.originPanel=null;if(panel&&g.selectedBuilding===panel)g.selectedBuilding=null;}
 function clock(){if(!run)return false;if(!able()||!sameRun(run)){release(false);return false;}
  const t=now();if(run.last!==null&&!hidden())run.age+=clamp(t-run.last,0,70);run.last=hidden()?null:t;
  if(run.age>=duration)dismissOrigin(run);
  if(run.closeAt===null&&run.age>=duration+run.scene.length){run.closeAt=run.age;}
  if(run.closeAt!==null&&run.age-run.closeAt>=closeDuration){release(true);return false;}
  return true;
 }
 function footer(c,r){put(c,r,8);c.fillStyle='#22352e';c.fill();c.strokeStyle='#9fcca8';c.lineWidth=1;c.stroke();letter(c,'跳过',...mid(r),15,'#f2efd9',r.w-12,true);}
 function draw(c){
  const v=viewport(),l=layout(v);if(hidden())return;if(!l){release(false);handoff=false;return;}if(!run){handoff=false;startFrame(v);}if(!clock())return;
  const s=run,target=slot(s.key,rows[s.key][2]);if(!target||!validRect(target,v)||typeof target.icon!=='function'){release(false);return;}
  s.target=target;const elapsed=s.closeAt===null?null:s.age-s.closeAt,clipAge=s.closeAt===null?s.age:s.closeAt;
  const phase=ease(s.age/entrance),zoom=elapsed===null?phase:ease(elapsed/480);
  const [vx,vy]=s.sourceViewport;
  const root={x:s.origin.x*v.width/vx,y:s.origin.y*v.height/vy,w:s.origin.w*v.width/vx,h:s.origin.h*v.height/vy};
  const [cx,cy]=mid(l),[ox,oy]=mid(root),[tx,ty]=mid(target);
  c.save();try{
   // Match the pause-layer weight over the already rendered world. No snapshot.
   const shade=.5*(elapsed===null?1:1-zoom);
   if(shade>0){c.fillStyle='rgba(0,0,0,'+shade+')';c.fillRect(0,-(v.top||0),v.width,v.fullHeight||v.height);}
   if(elapsed===null||elapsed<480){
    const w=elapsed===null?root.w+(l.w-root.w)*zoom:l.w+(target.w-l.w)*zoom,h=elapsed===null?root.h+(l.h-root.h)*zoom:l.h+(target.w-l.h)*zoom;
    const x=elapsed===null?ox+(cx-ox)*zoom:cx+(tx-cx)*zoom,y=elapsed===null?oy+(cy-oy)*zoom:cy+(ty-cy)*zoom;
    const shell={x:x-w/2,y:y-h/2,w,h},rad=Math.min(w,h)*(elapsed===null?.05+.15*(1-phase):.02+.48*zoom);
    c.save();
    try{
     put(c,shell,rad);c.fillStyle='#18252c';c.fill();c.clip();
     c.save();try{
     c.translate(x,y);c.scale(w/l.w,h/l.h);c.translate(-cx,-cy);
     const row=rows[s.key];
     if(clipAge<duration){
      const y=Math.max(l.y+26,l.y+l.h*.218),size=Math.min(78,l.h*.20);
      c.save();c.globalAlpha*=phase;letter(c,'恭喜技能解锁',cx,y,24,'#f7e5b9',l.w-26,true);c.restore();target.icon(c,cx-size/2,y+24,size);
      letter(c,row[1],cx,y+size+46,22,'#f2f0e4',l.w-26,true);
      const reason=s.completed&&s.completed!==row[3]?[s.completed,row[3]]:[row[3]];
      reason.forEach((text,i)=>letter(c,text,cx,y+size+67+i*17,15,'#d8d0e7',l.w-28));
     }else{
      const t=clamp(clipAge-duration,0,s.scene.length);
      while(s.stageAge+1000/60<=t+.0001){s.scene.step(1000/60);s.stageAge+=1000/60;}
      c.fillStyle='#152238';c.fillRect(l.stage.x,l.stage.y,l.stage.w,l.stage.h);
      c.save();try{put(c,l.stage);c.clip();s.scene.draw(c,l.stage,t);}finally{c.restore();}
      c.font='bold 22px sans-serif';const tw=c.measureText(row[1]).width,ix=cx-(tw+46)/2;
      target.icon(c,ix,l.y+9,36);letter(c,row[1],ix+46+tw/2,l.y+27,22,'#f8e9c4',l.w-70,true);
      (s.scene.caption?.()||[]).slice(0,2).forEach((text,i)=>letter(c,text,cx,l.y+l.h-94+i*19,15,'#e0e3dc',l.w-28));
     }
     if(elapsed!==null)footer(c,l.skip);
     }finally{c.restore();}
     // Inset the matching rounded outline so the clip cannot remove the curve.
     if(w>1&&h>1){put(c,{x:shell.x+.5,y:shell.y+.5,w:w-1,h:h-1},Math.max(0,rad-.5));c.lineWidth=1;c.strokeStyle='#9e825c';c.stroke();}
    }finally{c.restore();}
   }
   if(elapsed===null){footer(c,l.skip);s.painted=true;}
   else if(elapsed>=480){
    const u=clamp((elapsed-480)/120,0,1),d=target.w*(1+.16*Math.sin(Math.PI*u));c.globalAlpha*=1-ease((u-.72)/.28);target.icon(c,tx-d/2,ty-d/2,d);
   }
  }catch(_){release(false,true);}finally{c.restore();}
 }
 const id=t=>t?.identifier??0;
 function clear(){q=[];release(false);capture=false;consumed=null;handoff=false;}
 return {announce,draw,wanted,frameAble,waiting:k=>q.some(s=>s.key===k&&now()-s.queuedOn<1500),dockNeeded:()=>!!run||(q.length>0&&frameAble()&&q.some(s=>sameRun(s)&&s.retryAt<=now()&&dockEligible(s.key)&&stageFor(s.key)?.ready?.()!==false)),playing:()=>!!run,combatPaused(){const before=!!run;clock();return before||handoff;},clear,
  start(touches){
   const t=touches?.length===1&&touches[0];
   if(!run){if(t){capture=false;if(id(t)===consumed)consumed=null;}return capture;}
   capture=true;const b=layout(viewport())?.skip,x=t?.clientX??t?.x,y=t?.clientY??t?.y;
   if(t&&b&&run.painted&&run.closeAt===null&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){consumed=id(t);dismissOrigin(run);run.closeAt=run.age;wake();}
   return true;
  },
  move:()=>!!run||capture,
  end(changed,remaining){const late=consumed!==null&&changed?.some(t=>id(t)===consumed);if(late)consumed=null;const was=!!run||capture||late;if(!remaining?.length)capture=false;return was;},
  cancel(){capture=false;consumed=null;},
  suspend(){if(run)run.last=null;capture=false;consumed=null;},
  report:()=>({active:run?.key,queued:q.map(s=>s.key),phase:run?(run.closeAt!==null?'close':run.age<duration?'unlock':'scene'):null,age:run?.age??null,origin:run?.origin&&rect(run.origin),completed:run?.completed??null,target:run?.target&&rect(run.target)})
 };
}
module.exports={create,layout,rows};
