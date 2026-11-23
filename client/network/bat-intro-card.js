'use strict';
const roundedCardPath=require('./rounded-card-path');
// Compact non-modal introduction; first-wave triggers are unchanged.
module.exports=function install(g,{enabled=()=>false,stoneEnabled=enabled,viewport=()=>({width:393,height:852}),clock=Date.now}={}){
 if(g.batIntroCardBN)return g.batIntroCardBN;
 const motion=require('./native-control-motion')(clock);
 let active=false,until=0,skipRect=null,skipSkin=null,captured=false,last=null,kind=null;
 const inside=(p,r)=>!!p&&!!r&&p.clientX>=r.x&&p.clientX<=r.x+r.w&&p.clientY>=r.y&&p.clientY<=r.y+r.h;
 const allowed=which=>(which==='stone'?stoneEnabled():enabled())===true&&['prep','hunt'].includes(g.state)&&!g.player?.dead;
 const copy={
  bat:{title:'蝙蝠来袭',lines:['飞袭仓库偷资源；无仓库打金矿厂。','箭塔、冰塔、防空塔可对空。','捕网迫降后，所有塔都能攻击。']},
  stone:{title:'石头人来袭',lines:['啃城墙回血，投石砸附近的塔。','用魔法塔克制，先守好城墙。','击败后可获得卡牌。']}
 };
 const covered=()=>!!(g.sessionMenuOpen||g.roundStarting||g.roundLoading591||g.saveSlotsPanel||g.buildMenu||g.selectedBuilding||g.relicPanel||g.demonPanel||g.allyDataPanel||g.placement||g.dragonTutorialBL?.active);
 function show(enemy,which,seen){if(active||!enemy||enemy.dead||g[seen]||!allowed(which)||(g.waveElapsed||0)>=600)return false;g[seen]=true;kind=which;active=true;until=clock()+10000;skipRect=skipSkin=null;return true;}
 const api={
 visible(){if(!allowed(kind)||(g.waveElapsed||0)>=600||clock()>=until)active=false;return active;},
 onDeparture(bat){return !!bat?.waveBat&&(!Number.isFinite(bat.waveNumber)||bat.waveNumber<=8)&&show(bat,'bat','batIntroSeenBN');},
 onStoneArrival(stone){return !!stone?.waveStone&&stone.waveNumber===10&&show(stone,'stone','stoneIntroSeenBN');},
 skip(){active=false;skipRect=skipSkin=null;motion.cancel();},
 reset(){motion.cancel();active=false;kind=null;skipRect=skipSkin=null;g.batIntroSeenBN=false;g.stoneIntroSeenBN=false;captured=false;last=null;},
 exportState(){return {seen:g.batIntroSeenBN===true,seenStone:g.stoneIntroSeenBN===true};},
 restoreState(s){motion.cancel();active=false;kind=null;skipRect=skipSkin=null;captured=false;last=null;g.batIntroSeenBN=s?.seen===true;g.stoneIntroSeenBN=s?.seenStone===true;},
 start(points){const p=points?.[0];if(captured&&points?.length>1){api.cancel();return false;}if(captured)return true;if(!api.visible()||covered()||points?.length!==1||!inside(p,skipRect))return false;captured=true;last=p;motion.start(skipSkin);return true;},
 move(points){if(!captured)return false;if(points?.[0])last=points[0];if(!inside(last,skipRect))motion.cancel();return true;},
 end(points){if(!captured)return false;if(points?.[0])last=points[0];if(api.visible()&&!covered()&&inside(last,skipRect))api.skip();captured=false;last=null;motion.cancel();return true;},
 cancel(){motion.cancel();const was=captured;captured=false;last=null;return was;},
 draw(){if(!api.visible()||covered()){skipRect=skipSkin=null;return;}paint.call(g);}
 };
 function paint(){
 const msg=copy[kind];if(!msg)return;
 const c=this.ctx,v=viewport(),w=v.width||v.w||393,h=v.height||v.h||852;
 const S=this.uiSafeRect396?.()||{x:0,y:0,right:w,bottom:h},hud=this.topHudLayout?.(),mm=this.getMinimapRect?.(),menu=this.sessionMenuRect?.();
 const x=Math.ceil(S.x+10),room=Math.max(0,Math.floor(S.right-10-x)),sideRoom=mm?Math.floor(mm.x-8-x):room;
 const W=Math.min(252,room,sideRoom>=234?sideRoom:room),H=98;
 let y=Math.ceil(Math.max(S.y+8,(hud?.bottom||0)+8,menu?menu.y+menu.h+8:0));
 // Keep the card in the upper gutter and out of the minimap/accessory hitboxes.
 if(mm&&x+W+8>mm.x&&y<mm.y+mm.h+8){const zoom=this.minimapZoomButton515?.();y=Math.ceil(Math.max(mm.y+mm.h+8,zoom?zoom.y+zoom.h+6:0));}
 // The native performance badge draws after this layer in landscape.
 const hudAvoid=this.toastRect?[this.toastRect]:[],warning=this.noBuildingWarningAZ;
 if(warning?.remaining()!=null)hudAvoid.push(warning.layout());
 const meter=this.singlePlayerHud627?.layout(v,this.hudGeometry504?.(),hudAvoid);
 if(meter&&x<meter.x+meter.w+6&&x+W+6>meter.x&&y<meter.y+meter.h+6&&y+H>meter.y-6)y=Math.ceil(meter.y+meter.h+6);
 if(W<210||y+H>S.bottom-80){skipRect=skipSkin=null;return;}
 c.save();
 try{
  c.globalAlpha=1;c.textAlign='left';c.textBaseline='middle';
  c.fillStyle='rgba(23,39,32,.93)';c.strokeStyle=kind==='stone'?'#CEBE95':'#D3B6E8';c.lineWidth=1.1;
  roundedCardPath(c,x,y,W,H,10);c.fill();c.stroke();
  c.fillStyle=kind==='stone'?'#44544E':'#534164';c.beginPath();c.arc(x+25,y+21,15,0,Math.PI*2);c.fill();
  c.save();try{c.translate(x+25,y+21);c.scale(.65,.65);this.batWarningAvatarBN?.(c,{enemyKind:kind},0,1,true);}finally{c.restore();}
  c.font='bold 15px sans-serif';c.fillStyle='#FFF0BB';c.fillText(msg.title,x+46,y+21,W-148);
  c.font='13px sans-serif';
  for(let i=0;i<msg.lines.length;i++){c.fillStyle=i===1?'#F1C590':'#F3F1DD';c.fillText(msg.lines[i],x+12,y+46+i*17,W-24);}
  // The requested original 82×25 skin/text remains; the tap target only grows.
  skipSkin={id:'bat-intro-skip',x:x+W-92,y:y+8,w:82,h:25};
  skipRect={x:skipSkin.x,y:y,w:82,h:44};
  const bp=motion.pose(skipSkin),bs=bp.motionScale;
  c.fillStyle='#365645';roundedCardPath(c,bp.x,bp.y,bp.w,bp.h,6*bs);c.fill();
  c.fillStyle='#F4ECCB';c.textAlign='center';c.font='bold '+(12*bs)+'px sans-serif';c.fillText('跳过提示',bp.x+41*bs,bp.y+13*bs);
  c.fillStyle='#B79AE0';c.fillRect(x+10,y+H-4,(W-20)*Math.max(0,(until-clock())/10000),2);
 }finally{c.restore();}
 };
 const original=g.draw;g.draw=function(...args){const result=original.apply(this,args);api.draw();return result;};
 const resetSteps=g.resetSteps591;if(resetSteps)g.resetSteps591=function(...args){api.reset();return resetSteps.apply(this,args);};
 g.batIntroCardBN=api;return api;
};
