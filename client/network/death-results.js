'use strict';
const {validateRanking,duration}=require('./survival-ranking');
const {seatColor}=require('./seat-colors');
function validateDeathResults(value,tick){
 if(value==null)return null;
 const bad=()=>{throw Error('INVALID_DEATH_RESULTS');};
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['tick','survival','kills','scope'].includes(k))||!Number.isSafeInteger(value.tick)||value.tick<0||value.tick>tick||!['round','since-load'].includes(value.scope))bad();
 const survival=validateRanking(value.survival,value.tick);
 if(!survival||!Array.isArray(value.kills)||value.kills.length!==survival.rows.length)bad();
 const seen=new Set();let previous=Infinity,rank=0;
 const kills=value.kills.map((r,i)=>{
  if(!r||Object.keys(r).some(k=>!['ownerId','seat','kind','name','kills','rank'].includes(k)))bad();
  const participant=survival.rows.find(p=>p.ownerId===r.ownerId);
  if(!participant||seen.has(r.ownerId)||['seat','kind','name'].some(k=>participant[k]!==r[k])||!Number.isSafeInteger(r.kills)||r.kills<0||r.kills>1e9||r.kills>previous)bad();
  if(r.kills!==previous)rank=i+1;if(r.rank!==rank)bad();
  previous=r.kills;seen.add(r.ownerId);return {...r};
 });
 return {tick:value.tick,survival,kills,scope:value.scope};
}
function resultsLayout(view,count,online=false){return require('./merged-results-ui').layout(view,count,online);}
function drawDeathResults(ctx,canvas,view,results,options={}){return require('./merged-results-ui').draw(ctx,canvas,view,results,options);}
// Local overlay state only: no finish/leave/restart is called until an action.
// Identity is rechecked on every frame and tap so a revival cancels the panel.
function createDeathResultsGate({current,view,online=false,onAction,onShare=null,wake=()=>{},text=x=>x,clock=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 const motion=require('./native-control-motion')(clock);let timer=null;
 const stopMotion=()=>{motion.cancel();if(timer!==null){cancel(timer);timer=null;}};
 const pulse=()=>{if(timer!==null)cancel(timer);let remaining=20;const tick=()=>{timer=null;if(!panel)return;wake();if(--remaining>0&&motion.debug()?.phase==='release')timer=schedule(tick,16);};tick();};
 let panel=null,down=null;
 const sync=()=>{const c=current();if(panel&&(!c?.dead||c.body!==panel.body||c.epoch!==panel.epoch)){panel=null;down=null;stopMotion();wake();}return panel;};
 const close=()=>{panel=null;down=null;stopMotion();wake();};
 const open=results=>{const c=current();if(!c?.dead)return false;if(sync())return true;panel={body:c.body,epoch:c.epoch,results};wake();return true;};
 const tap=(x,y)=>{if(!sync())return false;const r=resultsLayout(view(),panel.results?.survival.rows.length||0,online),inside=b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;if(inside(r.close)){close();return true;}const b=r.buttons.find(inside);if(b){const scope={body:panel.body,epoch:panel.epoch,ownerId:current()?.ownerId};if(b.id==='share'){const share=onShare||((data,state)=>require('./results-share').shareResults(data,{wx:typeof wx==='undefined'?null:wx,ownerId:state.ownerId,text}));Promise.resolve(share(panel.results,scope)).catch(()=>{});return true;}close();if(b.id!=='resume')onAction(b.id,scope);}return true;};
 const touch=(kind,e)=>{if(!sync())return false;const p=(kind==='end'?e.changedTouches:e.touches)?.[0],point=p?{x:p.clientX??p.x,y:p.clientY??p.y}:null;if(kind==='cancel'||e.touches?.length>1){down=null;stopMotion();wake();return true;}if(kind==='start'){down=point;const L=resultsLayout(view(),panel.results?.survival.rows.length||0,online),inside=b=>point&&point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h;motion.start([{...L.close,id:'results-close'},...L.buttons].find(inside));wake();}if(kind==='move'&&down&&point&&Math.hypot(point.x-down.x,point.y-down.y)>8){down=null;stopMotion();wake();}if(kind==='end'){const d=down;down=null;const valid=!!(d&&point&&Math.hypot(d.x-point.x,d.y-point.y)<=8);motion.release(valid);if(valid){tap(point.x,point.y);if(panel)pulse();}else stopMotion();}return true;};
 return {open,close,sync,tap,touch,refresh(results){if(sync()&&results)panel.results=results;},draw(ctx,canvas){const p=sync();if(p)drawDeathResults(ctx,canvas,view(),p.results,{online,text,pose:b=>motion.pose(b)});},get visible(){return !!sync();}};
}
module.exports={validateDeathResults,resultsLayout,drawDeathResults,createDeathResultsGate};
