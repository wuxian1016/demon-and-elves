'use strict';
// 07–09 only. The host owns the native demo world; this module has no live-game entry points.
const ALLOW=new Set(['ghostStealth','ghostPossess','batRaid']);
const STEP=1000/60;
function create(key,live,fixture,withWorld){
 if(!ALLOW.has(key))return null;
 const {world:g,depot,owner,home,bat,threat,x,y}=fixture||{};
 const p=g?.player,api=g?.ghostElfAPI;
 const liveUnits=[live,live?.player,live?.troll,...(live?.buildings||[]),...(live?.hounds||[]),...(live?.allies||[]),...(live?.projectiles||[]),...(live?.tanks||[]),...(live?.peasants||[])];
 const foreign=[g,p,threat,depot,owner,home,bat].filter(Boolean).some(o=>liveUnits.includes(o));
 const shared=(a,b)=>a!==undefined&&a===b;
 if(!live||!g||foreign||!p||!api||!Number.isFinite(x)||!Number.isFinite(y)||typeof withWorld!=='function'||typeof fixture.tick!=='function'||typeof fixture.setDrive!=='function'||['hounds','allies','buildings','tanks','projectiles','particles','robotTech','cardStateData'].some(k=>shared(live[k],g[k])))return null;
 const stealth=key==='ghostStealth',delivery=key==='batRaid';
 if(stealth?!threat:!bat||!depot||!owner||(delivery&&!home))return null;
 const origin=[p.gold,p.wood],victim=owner&&[owner.gold,owner.wood];
 let elapsed=0,spent=0,hit=false,later=false,delivering=false,done=false,seen=false,lost=false,cargo=null,cargoAt=0,credited=false;
 const run=cb=>withWorld(g,cb);
 if(delivery&&api.host!==bat)return null; // #09 starts after true possession, not a second role transform.
 function advance(ms){
  if(done)return;
  if(Number.isFinite(ms)&&ms>=0)elapsed=Math.min(5600,Math.max(elapsed,ms));
  let n=0;
  run(()=>{
   while(spent+STEP<=elapsed+.00001&&n++<10){
    const next=spent+STEP;
    if(stealth&&!hit&&next>=900){
     hit=true;api.button('collectGold');
    }else if(!stealth&&!delivery&&!hit&&next>=900){
     hit=true;api.button('collectWood');
    }
    if(!stealth&&!later&&next>=(delivery?950:2250)){
     later=true;
     if(api.host===bat)api.button('collectWood');
    }
    if(delivery&&cargo&&!delivering&&next>=1830){
     delivering=true;if(api.host===bat)api.button('collectWood');
    }
    const walking=!delivery&&(stealth?next>=1530&&next<2100:next>=1430&&next<1930);
    fixture.setDrive(walking?(stealth?.72:.37):0,stealth&&walking?-.25:0);
    fixture.tick(STEP);
    if(stealth){
     if(!hit&&threat.target===p)seen=true;
     if(hit&&seen&&api.stealth()&&threat.target!==p)lost=true;
    }else if(!cargo&&p.ghostRaidCargo){
     const pack=p.ghostRaidCargo;
     if(owner.gold===victim[0]-pack.gold&&owner.wood===victim[1]-pack.wood&&p.gold===origin[0]&&p.wood===origin[1])
      {cargo={gold:pack.gold,wood:pack.wood};cargoAt=next;}
    }else if(delivering&&cargo&&!p.ghostRaidCargo&&p.gold===origin[0]+cargo.gold&&p.wood===origin[1]+cargo.wood&&!home.dead&&Math.hypot(bat.x-home.x,bat.y-home.y)<=Math.max(68,(home.radius||30)+20)){
     credited=true;
    }
    spent=next;
   }
  });
 }
 function paint(c,rect){
  if(done||!c||!rect||!(rect.w>0&&rect.h>0))return false;
  return run(()=>{
   const s=Math.min(rect.w/336,rect.h/278)*(stealth?.55:delivery?.58:.83);
   c.save();
   const centerX=rect.x+rect.w*(stealth?.585:delivery?.71:.37),centerY=rect.y+rect.h*(stealth?.53:delivery?.65:.63);
   const fill=c.fillText,stroke=c.strokeText;
   try{
    c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();
    c.translate(centerX,centerY);
    c.scale(s,s);c.translate(-x,-y);
    c.fillText=c.strokeText=()=>{};
    if(delivery)home.draw(c);
    if(!stealth)depot.draw(c);
    if(!delivery)g.drawPlayerGroundAura?.(c,fixture.now?.());
    if(!stealth&&api.host===bat)api.drawHost(c,bat);
    else{
     if(stealth)threat.draw(c);else if(!bat.dead)bat.draw(c,true);
     api.paint(c,p,()=>p.draw(c));
    }
   }finally{c.fillText=fill;c.strokeText=stroke;c.restore();}
   if(cargo&&!stealth&&(credited||spent-cargoAt<1300)&&typeof c.measureText==='function'){
    const at=credited?home:depot, prefix=credited?'基地 +':'仓库 −',sign=credited?'+':'−';
    const label=prefix+cargo.gold+' 金 / '+sign+cargo.wood+' 木';
    c.save();
    try{
     c.beginPath();c.rect(rect.x,rect.y,rect.w,rect.h);c.clip();
     c.fillStyle=credited?'#aaf4c5':'#ffd092';c.strokeStyle='#152238';c.lineWidth=3;
     c.font='bold '+Math.max(11,Math.min(14,rect.w/26))+'px sans-serif';c.textAlign='center';c.textBaseline='middle';
     const half=c.measureText(label).width/2+6;
     const tx=Math.min(rect.x+rect.w-half,Math.max(rect.x+half,centerX+(at.x-x)*s+(credited?27:-16)));
     const ty=Math.min(rect.y+rect.h-13,Math.max(rect.y+13,centerY+(at.y-y)*s-44));
     c.strokeText(label,tx,ty);c.fillText(label,tx,ty);
    }finally{c.restore();}
   }
   return true;
  });
 }
 function effect(){
  if(stealth)return lost?'幽灵隐身后，恶魔失去目标。':null;
  if(!cargo)return null;
  const count=cargo.gold+' 金 / '+cargo.wood+' 木';
  return credited?'己方基地收到 '+count:delivering?'携带 '+count+'，自动飞回己方基地。':'仓库失去 '+count+'，蝙蝠已携带。';
 }
 return {advance,paint,effect,stop(){if(!done){done=true;run(()=>fixture.setDrive(0,0));}}};
}
module.exports={create};
