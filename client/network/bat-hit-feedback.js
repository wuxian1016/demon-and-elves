'use strict';
// Pure presentation. Never writes wallets, health, rewards or cargo.
module.exports=function({nativeText=x=>x}={}){
 const games=new WeakMap(),LIMIT=24,GROUP_MS=500,SHOW_MS=1500;
 const time=g=>Math.max(0,Number(g.supportTime)||0);
 function record(g,w,stolen,before,after){
  if(!w||w.type!=='warehouse'||(w.ownerSlot??null)!==null)return;
  const gold=Math.max(0,Number(stolen?.gold)||0),wood=Math.max(0,Number(stolen?.wood)||0),damage=Math.max(0,(Number(before)||0)-(Number(after)||0));
  if(!(gold||wood||damage))return;
  let list=games.get(g);if(!list){list=[];games.set(g,list);}const now=time(g);
  let e=list.find(x=>x.w===w);if(!e){if(list.length>=LIMIT)list.shift();e={w,pendingGold:0,pendingWood:0,gold:0,wood:0,shownAt:-Infinity,hitAt:-Infinity,last:now};list.push(e);}
  e.pendingGold+=gold;e.pendingWood+=wood;e.last=now;if(damage)e.hitAt=now;
 }
 function draw(g,c,inView=()=>true){
  const list=games.get(g);if(!list)return;const now=time(g);
  for(let i=list.length-1;i>=0;i--){const e=list[i],w=e.w;if(now<e.last||now-e.last>8000){list.splice(i,1);continue;}
   if((e.pendingGold||e.pendingWood)&&now-e.shownAt>=GROUP_MS){e.gold=e.pendingGold;e.wood=e.pendingWood;e.pendingGold=e.pendingWood=0;e.shownAt=now;}
   if(!inView(w.x,w.y,180))continue;const age=now-e.shownAt,hitAge=now-e.hitAt;
   if(age>=SHOW_MS&&hitAge>=SHOW_MS)continue;
   c.save();
   if(age>=0&&age<SHOW_MS&&(e.gold||e.wood)){
    c.globalAlpha=Math.min(1,(SHOW_MS-age)/300);c.font='bold 16px sans-serif';c.textAlign='center';c.textBaseline='middle';c.lineWidth=3;c.strokeStyle='rgba(45,35,18,.8)';
    const y=w.y+132-Math.min(8,age/100),items=[];if(e.gold)items.push({text:nativeText('金币 -'+e.gold),color:'#ffe27a'});if(e.wood)items.push({text:nativeText('木材 -'+e.wood),color:'#aaff9e'});
    for(let n=0;n<items.length;n++){const x=w.x+(n-(items.length-1)/2)*84;c.strokeText?.(items[n].text,x,y);c.fillStyle=items[n].color;c.fillText(items[n].text,x,y);}
   }
   if(hitAge>=0&&hitAge<SHOW_MS){const ratio=Math.max(0,Math.min(1,(w.hp||0)/Math.max(1,w.maxHp||1))),x=w.x-42,y=w.y+107;c.globalAlpha=Math.min(1,(SHOW_MS-hitAge)/300);c.fillStyle='rgba(255,255,255,.4)';c.fillRect(x-1,y-1,86,7);c.fillStyle=hitAge<180?'#ff796b':'#55dc79';c.fillRect(x,y,84*ratio,5);}
   c.restore();
  }
 }
 return{record,draw};
};
