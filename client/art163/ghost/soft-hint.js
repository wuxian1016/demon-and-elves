'use strict';
const cache=new Map(),pad=14,vertical=6,fill='rgba(10,33,21,.64)',stroke='rgba(129,226,166,.70)';
function layout(c,max,segments){
 max=Math.floor(max);const key=max+JSON.stringify(segments),prev=cache.get(key);if(prev)return prev;
 let widest=0,h=2*vertical;const rows=[];
 c.save();try{
  for(const [value,size=14,color='#F0FFF0',weight='bold'] of segments){
   if(!value)continue;
   const font=(weight?weight+' ':'')+size+'px sans-serif',lineH=size+4;
   c.font=font;
   const add=s=>{if(!s)return;rows.push([s,font,color,h-vertical+lineH/2]);h+=lineH;widest=Math.max(widest,c.measureText(s).width);};
   const text=String(value);if(c.measureText(text).width<=max-pad*2){add(text);continue;}
   let s='';
   for(const ch of text){if(s&&c.measureText(s+ch).width>max-pad*2){add(s);s=ch;}else s+=ch;}add(s);
  }
 }finally{c.restore();}
 const value={rows,w:Math.min(max,Math.ceil(widest)+pad*2),h};
 cache.set(key,value);if(cache.size>48)cache.delete(cache.keys().next().value);
 return value;
}
function paint(c,x,y,{w,h,rows}){
 const r=8;
 c.save();c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
 c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=1;c.stroke();
 c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
 for(const [copy,font,color,dy] of rows){
  c.font=font;c.strokeStyle='rgba(5,15,10,.91)';c.lineWidth=1.7;c.strokeText(copy,x+w/2,y+dy);
  c.fillStyle=color;c.fillText(copy,x+w/2,y+dy);
 }
 c.restore();
}
const STRONG=27; // Existing R12 full-amplitude preset.
function stationaryLabel(g,c,plan,scale,rest,direction){
 if(!plan?.rows?.length)return;
 const S=g.uiSafeRect396(),{x,y}=rest,extent=27*scale+7;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const cx=clamp(x-plan.w/2,S.x+4,S.right-plan.w-4);
 const yy=clamp(y-plan.h/2,S.y+4,S.bottom-plan.h-4);
 if(direction==='left'){
  // Keep the static box out of the ENTIRE arrow corridor, not just its current tip.
  const G=g.hudGeometry504?.(),R=G?.resource,k=G?.k||1,clear=6.5;
  const rect=(x1,y1,x2,y2)=>({x1,y1,x2,y2});
  const sweep=rect((rest.fixedLabelX??x+7)-7,y-13*scale,
   (rest.fixedFarX??x-3)+3+STRONG+27*scale,y+13*scale);
  const obstacles=[];
  if(R){
   if(G.land){
    obstacles.push(rect(R.x,R.y+R.h*.22,R.x+R.w,R.y+R.h*.78));
    const D=G.demon;
    if(D)obstacles.push(rect(D.x,D.y,D.x+D.w,D.y+D.h),rect(D.x,G.timerY-15*k,D.x+D.w,G.timerY+15*k));
   }else{
    const L=R.x+12*k,leftEdge=R.x+R.w*.315,mid=R.x+R.w*.665,cx=(leftEdge+mid)/2;
    for(const i of [0,1]){
     const v=g.resourceValueRectR13?.(c,i),cy=R.y+(29+i*25)*k;
     obstacles.push(rect(L,cy-8*k,v?.fixedFarX??leftEdge-2,cy+8*k));
    }
    c.save();try{
     c.font='bold '+Math.round(12*k)+'px sans-serif';
     const population='人口 '+(g.getPeasantCount?.()??0)+'/'+(g.getPeasantCap?.()??0);
     const py=R.y+79*k,px=L+Math.min(leftEdge-L,c.measureText(population).width);
     obstacles.push(rect(L,py-8*k,px,py+8*k));
     const objective=Math.min(mid-leftEdge-10*k,c.measureText('目标：摧毁恶魔老巢').width);
     obstacles.push(rect(cx-objective/2,R.y+62*k,cx+objective/2,R.y+78*k));
     c.font='bold '+Math.round(13*k)+'px sans-serif';
     const t=Math.floor(g.huntElapsed||0),time=g.state==='prep'?'苏醒 '+Math.ceil(g.prepTimeLeft||0)+'秒':'狩猎 '+Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
     const tw=Math.min(mid-leftEdge-10*k,c.measureText(time).width);
     obstacles.push(rect(cx-tw/2,R.y+30*k,cx+tw/2,R.y+48*k));
    }finally{c.restore();}
    obstacles.push(rect(mid,R.y+8*k,R.x+R.w,R.y+105*k));
   }
  }
  const gear=g.sessionMenuRect?.(),map=g.getMinimapRect?.();for(const q of [gear,map])if(q)obstacles.push(rect(q.x,q.y,q.x+q.w,q.y+q.h));
  const overlap=(l,t,r,b,o,pad)=>l<o.x2+pad&&r>o.x1-pad&&t<o.y2+pad&&b>o.y1-pad;
  const xs=[sweep.x1,sweep.x2-plan.w,sweep.x2+clear,sweep.x1-plan.w-clear,S.x+4,S.right-plan.w-4];
  const ys=[sweep.y1-plan.h-clear,sweep.y2+clear,y-plan.h/2,S.y+4,R?R.y+R.h+4:S.y+4];
  for(const u of obstacles){xs.push(u.x2+3,u.x1-plan.w-3);ys.push(u.y2+3,u.y1-plan.h-3);}
  let best=null,score=Infinity;
  for(const px of xs)for(const py of ys){
   const l=clamp(px,S.x+4,S.right-plan.w-4),t=clamp(py,S.y+4,S.bottom-plan.h-4),r=l+plan.w,b=t+plan.h;
   if(overlap(l,t,r,b,sweep,clear)||obstacles.some(o=>overlap(l,t,r,b,o,2)))continue;
   const dx=Math.max(0,sweep.x1-r,l-sweep.x2),dy=Math.max(0,sweep.y1-b,t-sweep.y2);
   const rank=dx*dx+dy*dy+.04*(l+plan.w*.5-(sweep.x1+sweep.x2)*.5)**2;
   if(rank<score){score=rank;best={l,t};}
  }
  if(best)paint(c,best.l,best.t,plan);return;
 }
 if(direction==='right'){
  const left=x-STRONG-extent-plan.w;
  if(left>=S.x+4){paint(c,left,yy,plan);return;}
  paint(c,cx,clamp(y-plan.h-13,S.y+4,S.bottom-plan.h-4),plan);return;
 }
 if(direction==='up'){
  paint(c,cx,clamp(y+STRONG+extent,S.y+4,S.bottom-plan.h-4),plan);return;
 }
 const upper=y-STRONG-extent-plan.h;
 if(upper>=S.y+4){paint(c,cx,upper,plan);return;}
 const bx=x+21+plan.w<S.right-4?x+21:x-21-plan.w;
 paint(c,clamp(bx,S.x+4,S.right-plan.w-4),clamp(y-STRONG/2-plan.h/2,S.y+4,S.bottom-plan.h-4),plan);
}
function cardinal(g,c,{x,y,direction='down',scale=1.3,alpha=1,fixedLabelX,fixedFarX},plan){
 const signs={down:[0,1],right:[1,0],up:[0,-1],left:[-1,0]};
 const [vx,vy]=signs[direction]||signs.down;
 const frame=g.drawUnifiedGuidanceArrow(c,{tipX:x-vx*STRONG,tipY:y-vy*STRONG,direction,scale,travel:STRONG/(7*scale),alpha});
 stationaryLabel(g,c,plan,scale,{x,y,fixedLabelX,fixedFarX},direction);
 return frame;
}
function buildArrow(g,c,r,scale=1.3,plan){
 g.passiveHintsR13?.target(r);
 if(r.scrollDown){
  scale*=1.25;
  const h=r.scrollH,top=r.scrollTop,u=((g.supportTime||0)%1150)/1150,tipX=r.x+r.w/2;
  const origin=top+h*.13,end=top+h*.91,y=origin+(end-origin)*u,labelY=top+Math.max(13,h*.055);
  c.save();c.textAlign='center';c.textBaseline='middle';c.font='bold 20px sans-serif';c.lineWidth=2;
  const cue=r.scrollEpisode;
  if(cue&&cue.copy===undefined){cue.copy=!g.scrollGuideSeenR12;g.scrollGuideSeenR12=true;}
  if(cue?.copy){
   c.strokeStyle='#10301E';c.fillStyle='#60FF92';
   c.strokeText('下滑菜单',tipX,labelY);c.fillText('下滑菜单',tipX,labelY);
  }
  const alpha=u>.78?Math.max(0,1-(u-.78)/.22):u<.12?Math.min(1,u/.12):1,clipTop=labelY+13;
  c.beginPath();c.rect(tipX-30*scale,clipTop,60*scale,Math.max(0,top+h-5-clipTop));c.clip();
  const out=g.drawUnifiedGuidanceArrow(c,{tipX,tipY:y,direction:'down',scale,travel:0,alpha});c.restore();return out;
 }
 if(r.hudValue)return cardinal(g,c,{x:r.x+r.w+3,y:r.y+r.h*.5,direction:'left',scale,fixedLabelX:r.fixedLabelX,fixedFarX:r.fixedFarX},plan);
 if(r.scrollRevealed){
  const S=g.uiSafeRect396(),edge=r.x-3;
  // Catalog columns at the left carry name, price, and combat stats.
  // The native title band has a clear run just left of the card preview.
  const x=r.guideCatalogRow?r.x+r.w-Math.min(64,r.w*.24)-13:edge-27*scale-STRONG>=S.x+2?edge:Math.min(r.x+r.w*.45,S.x+27*scale+STRONG+2);
  const y=r.guideCatalogRow?Math.max(r.y+13,Math.min(r.y+r.h-13,r.guideCatalogTop+18)):r.y+r.h*.5;
  return cardinal(g,c,{x,y,direction:'right',scale},r.guideCatalogRow?null:plan);
 }
 if(r.guideCatalogRow)return cardinal(g,c,{x:r.x+r.w/2,y:r.y+Math.min(r.h-4,29),scale},null);
 return cardinal(g,c,{x:r.x+r.w/2,y:r.y-1,scale},plan);
}

const catalogHint=(g,page)=>g.buildMenuPage===3?'返回建筑目录，再到「'+['资源','防御','武器'][page]+'」栏。':'到「'+['资源','防御','武器'][page]+'」栏。';
const catalogTab=(g,L,page)=>g.buildMenuPage===3?L.catalogBtn:L.pageTabs?.find(b=>b.page===page);
const scrollHints=new WeakMap();
const clearCatalog=g=>scrollHints.delete(g);
function catalogRow(g,L,r,key,min=46){
 const c=L.listRect;if(!c||!r)return null;
 const y=Math.max(r.y,c.y),bottom=c.y+c.h,h=Math.min(r.y+r.h,bottom)-y,prior=scrollHints.get(g);
 const same=prior&&prior.player===g.player&&prior.key===key&&prior.page===g.buildMenuPage;
 if(h>=min){
  if(same)prior.ended=true;
  return {...r,y,h,guideCatalogRow:true,guideCatalogTop:r.y,scrollRevealed:!!same&&L.scroll>prior.scroll+.5};
 }
 if(r.y>=bottom-min&&Number(L.maxScroll)>Number(L.scroll)+.5){
  let cue=prior;
  if(!same||prior.ended){cue={player:g.player,key,page:g.buildMenuPage,scroll:L.scroll};scrollHints.set(g,cue);}
  else if(L.scroll<cue.scroll)cue.scroll=L.scroll;
  return {x:c.x+c.w*.5,y:bottom-10,w:0,h:0,scrollTop:c.y,scrollH:c.h,scrollDown:true,scrollEpisode:cue};
 }
 if(same)prior.ended=true;
 return null;
}
const scrollCopy=name=>'建造'+name+'。';
module.exports={layout,paint,buildArrow,cardinal,catalogHint,catalogTab,catalogRow,scrollCopy,clearCatalog};
