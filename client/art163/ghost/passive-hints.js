'use strict';
const WAIT=4000;
function install(g,offline,input,wake){
 let body,quietUntil=0,targets=[],depth=0,guidedScroll=null;
 const interactive=()=>offline()&&!g.tutorial&&!g.superChallenge580&&!g.networkDrawCamera627&&!g.networkAuthorityPhases627&&['prep','hunt'].includes(g.state)&&!g.player?.dead;
 const enabled=()=>interactive()&&g.operationGuideModeR13();
 const clock=()=>g.supportTime||0;
 const sync=()=>{if(body!==g.player){body=g.player;quietUntil=0;targets=[];guidedScroll=null;}};
 const quiet=()=>{sync();const i=input();return enabled()&&(clock()<quietUntil||i?.panning||i?.pinch?.active||i?.stick?.active&&(i.stick.dx!==0||i.stick.dy!==0));};
 function act(kind,x,y){
  sync();if(!enabled())return;
  if(kind==='tap'){
   const hit=r=>r&&r.w>0&&r.h>0&&!r.scrollDown&&x>=r.x-3&&x<=r.x+r.w+3&&y>=r.y-3&&y<=r.y+r.h+3;
   // Frame painters can run without the outer game.draw wrapper. Read their
   // real rendered capsule rectangles; no hidden or zero-area hit region.
   if(targets.some(hit)||hit(g.resourceCapPreview?.rect())||hit(g.goldShortageGuideBN?.layout()))return;
  }
  if(kind==='scroll'){
   const i=input(),gesture=i?.buildMenuGesture;
   if(gesture&&g.buildMenu){
    // The first real move owns this gesture. A redraw can replace the down cue
    // with the real row before later move events and the matching release arrive.
    if(guidedScroll?.gesture===gesture&&guidedScroll.page===g.buildMenuPage)return;
    if(i.dy<0&&targets.some(r=>r.scrollDown)){
     guidedScroll={gesture,page:g.buildMenuPage};return;
    }
   }
  }
  if(!g.tutorial)quietUntil=clock()+WAIT;
 }
 function target(r){if(depth&&r&&targets.length<12&&(r.scrollDown||r.w>0&&r.h>0))targets.push(r);}
 const draw=g.draw,tap=g.handleTap,legacy=g.easyOpeningGuideAdvice;
 g.easyOpeningGuideAdvice=function(...a){const row=legacy.apply(this,a);return row&&!row.optional&&enabled()?{...row,optional:true}:row;};
 g.draw=function(...a){if(!depth){sync();targets=[];}depth++;try{return draw.apply(this,a);}finally{depth--;}};
 g.handleTap=function(x,y,...a){act('tap',x,y);return tap.call(this,x,y,...a);};
 g.passiveHintsR13={enabled,interactive,quiet,act,target,earned(){quietUntil=0;},cooldown:()=>Math.max(0,quietUntil-clock()),interrupt(x,y){if(!interactive())return false;if(g.finishEndlessOpeningIntroBH(true))wake();return g.cameraScenesR7?.passiveInput?.(x,y)===true;}};
}
module.exports={install};
