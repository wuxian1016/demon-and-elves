'use strict';
// Approved independent tier sprites. Static tiers are NOT action-frame deformation.
module.exports=function({Image,imagePath=value=>value,cementArt=null}){
 const images=new Map(),ready=new Map();
 const readImage=require('./native-image-decode');
 function tier(b){return Math.min(3,Math.max(1,Math.floor(b.level||1)));}
 function load(kind,level=1){
  const t=Math.min(3,Math.max(1,level)),key=kind+':'+t;
  if(images.has(key))return images.get(key);
  const im=new Image();images.set(key,im);
  const source=t===1?(kind==='antiAir'?'art-bat-preview/aa/aa-00.png':'art-bat-preview/net/net-00.png'):`art-bat-preview/levels/${kind}-${t}.webp.bin`;
  const promise=readImage(im,imagePath(source)).catch(error=>{
   if(images.get(key)===im){images.delete(key);ready.delete(key);}
   throw Error('新塔素材加载失败：'+key+' · '+error.message);
  });
  promise.catch(()=>{});ready.set(key,promise);return im;
 }
 function name(kind){return kind==='antiAir'?'防空塔':'捕网塔';}
 // Icon-only visible-body bounds: alpha>32 plus 8px fringe. World/ghost framing stays unchanged.
 const iconCrops={antiAir:{1:[95,73,233,279],2:[8,8,805,950],3:[8,8,1104,1035]},net:{1:[84,83,239,262],2:[8,8,988,1045],3:[8,8,1064,917]}};
 function iconFit(ctx,b,box){const kind=b.airDefenseKindBN,t=tier(b),im=load(kind,t);if(!im.width)return false;const crop=iconCrops[kind]?.[t];if(!crop)return false;const scale=Math.min(box.width/crop[2],box.height/crop[3]),w=crop[2]*scale,h=crop[3]*scale;ctx.drawImage(im,...crop,box.x+(box.width-w)/2,box.y+(box.height-h)/2,w,h);return true;}
 // World geometry shares the normal building ground anchor (y + 26).
 // Tier art dimensions stay approved; transparent margins must not shift the foundation.
 function layout(b){const kind=b.airDefenseKindBN,t=tier(b),im=load(kind,t),cut=iconCrops[kind]?.[t];if(!cut)return null;const w=t===1?160*cut[2]/(im.width||420):t===2?100:132,h=w*cut[3]/cut[2];return{batTower:true,kind,t,cut,w,h,visibleW:w,visibleH:h,offsetX:0,offsetY:0,lv:t};}
 const netMouth=[[.66,.15],[.56,.15],[.50,.28]];
 function netMuzzle(b){const l=layout(b);if(!l)return null;const [u,v]=netMouth[l.t-1];return{x:b.x+(u-.5)*l.w,y:b.y+26-(1-v)*l.h};}
 let shadowImage=null,shadowReady=null;
 function loadShadow(){
  if(shadowImage)return shadowImage;
  const im=shadowImage=new Image();
  shadowReady=readImage(im,imagePath('art-bat-preview/levels/tower-shadows.png')).catch(error=>{
   if(shadowImage===im){shadowImage=null;shadowReady=null;}
   throw Error('新塔落地阴影加载失败 · '+error.message);
  });
  shadowReady.catch(()=>{});return im;
 }
 function shadow(ctx,b,l){const im=loadShadow();if(!im.width)return;const k=l.w/80;ctx.drawImage(im,(l.t-1)*128,l.kind==='antiAir'?0:128,128,128,b.x-l.w/2-16*k,b.y+26-84*k,128*k,128*k);}
 function body(ctx,b,icon=false){if(icon)return iconFit(ctx,b,{x:b.x-16,y:b.y-16,width:32,height:32});const l=layout(b),im=load(b.airDefenseKindBN,tier(b));if(!l||!im.width)return false;shadow(ctx,b,l);if(!b.batGhostBN&&b.mammothPetrifyLeftBN>0&&cementArt)cementArt.paint(ctx,im,...l.cut,b.x-l.w/2,b.y+26-l.h,l.w,l.h);else ctx.drawImage(im,...l.cut,b.x-l.w/2,b.y+26-l.h,l.w,l.h);return true;}
 function ghost(ctx,b){return body(ctx,b);}
 // HP and level use the shared building-status layer, never a duplicate bar at the feet.
 function draw(ctx,b,icon=false,cachedBody=false){if(b.dead)return false;if(!cachedBody)body(ctx,b,icon);if(!icon&&!b.batGhostBN&&b.stunTimer>0&&!(b.mammothPetrifyLeftBN>0)){ctx.save();ctx.fillStyle='rgba(244,67,54,.4)';const r=b.radius+6;ctx.fillRect(b.x-r,b.y-r,r*2,r*2);ctx.restore();}return true;}
 function paintBounds(b){const l=layout(b);if(!l)return null;const k=l.w/80;return{x0:b.x-l.w/2-16*k-2,y0:Math.min(b.y+26-l.h,b.y+26-84*k)-2,x1:b.x-l.w/2+112*k+2,y1:b.y+26+44*k+2};}
 function install(art){if(!art||art.batTowerVisualBN)return;const original=art.building,originalLayout=art.buildingLayout,originalBounds=art.buildingPaintBoundsBN;art.building=function(ctx,b,...args){if(b.airDefenseKindBN){body(ctx,b);return{top:b.y+26-layout(b).h};}return original.call(this,ctx,b,...args);};art.buildingLayout=function(b,...args){return b.airDefenseKindBN?layout(b):originalLayout.call(this,b,...args);};art.buildingPaintBoundsBN=function(b,...args){return b.airDefenseKindBN?paintBounds(b):originalBounds?.call(this,b,...args);};art.batTowerVisualBN=true;}
 // Explicitly called AFTER batArt subpackage loads, before the game module starts.
 async function warmup(){
  for(const kind of ['antiAir','net'])for(let level=1;level<=3;level++){
   load(kind,level);
   await ready.get(kind+':'+level);
  }
  loadShadow();await shadowReady;
 }
 return{draw,ghost,body,iconFit,name,install,load,tier,warmup,layout,paintBounds,netMuzzle};
};
