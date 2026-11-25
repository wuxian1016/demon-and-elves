const roundedCardPath=require('./rounded-card-path');
const {MAX_HAND,GHOST,canHold}=require('./card-state');
/* Approved-layout candidate. Gameplay mutations are returned by authoritative callbacks only. */
const CARD_DEFS = Object.freeze({
 fury:{name:'狂战',effect:'攻击×6，攻速×2；不含坦克和机器人',duration:'持续1分钟',color:'#863b22'},
 harvest:{name:'丰收',effect:'所有资源采集翻倍',duration:'持续1分钟',color:'#17613c'},
 fortress:{name:'坚城',effect:'所有建筑血量与防御×2',duration:'持续2分钟',color:'#245879'},
 sanctuary:{name:'庇护',effect:'整个据点获得无敌保护罩',duration:'持续30秒',color:'#16776e'},
 storm:{name:'雷暴',effect:'范围伤害；每次命中眩晕3秒',duration:'每次6秒，可使用3次',color:'#573382'},
 ghost:{name:'幽灵转职',effect:'附身 · 隐身',duration:'独立保留',color:'#41386a'}
});
function createCardInteraction(options) {
 const o=options||{}, state={hand:(o.hand||[]).slice(0,MAX_HAND+1),selected:0,open:false,confirm:false,award:null,awardFlight:null,aim:null,burst:null,lastActivity:0,tween:null,poses:[],lastNow:0};
 const scale=()=>o.scale||1, geometry=()=>({w:o.width||552,h:o.height||1194,x:o.joystickX||100,top:o.joystickTop||945,safe:o.safe,hudBottom:o.hudBottom,displayTop:o.displayTop,displayFull:o.displayFull});
 const lerp=(a,b,t)=>a+(b-a)*t, ease=t=>1-Math.pow(1-Math.max(0,Math.min(1,t)),4);
 function target(){const z=geometry(),s=scale(),others=state.hand.map((_,i)=>i).filter(i=>i!==state.selected);const ordinary=state.hand.map((_,i)=>i).filter(i=>state.hand[i]!==GHOST);return state.hand.map((type,i)=>{if(!state.open){const offset=type===GHOST?(ordinary.length+1)/2:ordinary.indexOf(i)-(ordinary.length-1)/2;return{x:z.x+offset*39*s,y:z.top-58*s,w:54*s,h:(54*388/267)*s,a:type===GHOST?0:offset*.08};}if(i===state.selected&&type===GHOST){if(o.ghostReveal?.layout){const {x,y,w,h,a}=o.ghostReveal.layout(z,s);return{x,y,w,h,a};}const w=Math.min(210*s,(z.h-96)/1.5);return{x:z.w-w/2-18*s,y:Math.min(z.top-70*s,Math.max(w*.75+10,z.h*.5-24*s)),w,h:w*1.5,a:0};}if(i===state.selected)return{x:z.w-155*s,y:z.top-95*s,w:150*s,h:(150*388/267)*s,a:0};return{x:z.w-155*s+([-70,70,-116][others.indexOf(i)]||70)*s,y:z.top-65*s,w:95*s,h:(95*388/267)*s,a:i===others[0]?-.14:.14};});}
 function sample(now){if(!state.tween)return;let t=ease((now-state.tween.at)/300);state.poses=state.tween.to.map((p,i)=>{const f=state.tween.from[i]||p;return Object.fromEntries(Object.keys(p).map(k=>[k,lerp(f[k],p[k],t)]))});if(t>=1)state.tween=null;}
 function retarget(now){sample(now);state.tween={from:state.poses.map(p=>({...p})),to:target(),at:now};}
 function noteActivity(now){state.lastActivity=now;}
 function select(i,now){if(i<0||i>=state.hand.length)return;sample(now);state.selected=i;state.open=true;state.confirm=false;noteActivity(now);o.onSelect?.(state.hand[i]);retarget(now);}
 function collapse(now){sample(now);state.open=false;state.confirm=false;state.aim=null;retarget(now);}
 function clearAward(){state.award=null;state.awardFlight=null;state.awardOpenedAt=null;state.ghostReveal=null;}
 function beginAward(type,now){if(!CARD_DEFS[type])throw Error('Unknown card type');if(!canHold(state.hand,type)){if(o.onFullHand)o.onFullHand(type);return false;}state.award=type;state.awardFlight=null;state.awardOpenedAt=now;state.ghostReveal=type===GHOST&&o.ghostReveal?{age:0,now}:null;if(state.ghostReveal)collapse(now);return true;}
 function collectAwardQuick(type,now){
  if(!CARD_DEFS[type]||!canHold(state.hand,type))return false;
  sample(now);state.hand.push(type);
  const dest=target()[state.hand.length-1];
  state.tween=null;state.poses.push({...dest,y:dest.y-(state.open||state.aim?0:14*scale())});
  retarget(now);return true;
 }
 function removeOwnedCard(i,now){
  if(!Number.isInteger(i)||i<0||i>=state.hand.length)return;
  const selected=state.selected===i;sample(now);state.hand.splice(i,1);state.poses.splice(i,1);state.tween=null;
  if(i<state.selected)state.selected--;state.selected=Math.max(0,Math.min(state.selected,state.hand.length-1));
  if(selected&&(state.open||state.confirm||state.aim))collapse(now);else retarget(now);
 }
 function suspendGhost(){if(state.ghostReveal)state.ghostReveal.now=null;}
 function tick(now){
  const g=state.ghostReveal;if(g){if(g.now!==null)g.age+=Math.min(80,Math.max(0,now-g.now));g.now=now;}
  state.lastNow=now;sample(now);if(state.open&&now-state.lastActivity>=5000)collapse(now);
  if(state.award&&state.award!==GHOST&&!state.awardFlight&&now-state.awardOpenedAt>=900)state.awardFlight={at:state.awardOpenedAt+900};
  if(state.awardFlight&&now-state.awardFlight.at>=600){const type=state.award;state.hand.push(type);if(o.onAwardCollected)o.onAwardCollected(type);clearAward();retarget(now);}
 }
 function rr(c,x,y,w,h,color,border='#e9c574'){roundedCardPath(c,x,y,w,h,7*scale());c.fillStyle=color;c.fill();if(border){c.strokeStyle=border;c.lineWidth=1.4*scale();c.stroke();}}
 function text(c,s,x,y,n=14,color='#fff',align='center',maxWidth=null){c.font='600 '+n*scale()+'px sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.strokeStyle='rgba(14,35,25,.75)';c.lineWidth=2*scale();if(maxWidth){c.strokeText(s,x,y,maxWidth);c.fillText(s,x,y,maxWidth);}else{c.strokeText(s,x,y);c.fillText(s,x,y);}}
 function button(c,label,b,kind){b=b.paint||b;if(o.drawButton){o.drawButton(c,label,b,kind);return;}rr(c,b.x,b.y,b.w,b.h,kind==='cancel'?'#304a4a':'#008d49');text(c,label,b.x+b.w/2,b.y+b.h/2,18);}

 function useBox(){const z=geometry(),s=scale();return{x:z.x-55*s,y:z.top-79*s,w:110*s,h:48*s};}
 function confirmBoxes(){const z=geometry(),s=scale(),ghost=state.hand[state.selected]===GHOST;if(ghost&&o.ghostReveal?.layout){const {cancel,ok}=o.ghostReveal.layout(z,s);return{cancel,ok};}const y=ghost?Math.min(z.top+55*s,z.h-52*s-10):z.top+55*s;return{cancel:{x:z.w-282*s,y,w:122*s,h:52*s},ok:{x:z.w-150*s,y,w:138*s,h:52*s}};}
 function aimCancelBox(){return confirmBoxes().cancel;}

 function awardBox(){const z=geometry(),s=scale();if(state.ghostReveal&&o.ghostReveal.layout)return o.ghostReveal.layout(z,s,true).award;return{x:z.w/2-68*s,y:state.award===GHOST?z.h-48*s-8:z.h/2+90*s,w:136*s,h:48*s};}
 function hit(b,x,y){return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}
 function paintCard(c,type,p,front){c.save();c.translate(p.x,p.y);c.rotate(p.a||0);if(o.drawFullCard)o.drawFullCard(c,type,{x:-p.w/2,y:-p.h/2,w:p.w,h:p.h},front);c.restore();}

 function draw(c,now){tick(now);const z=geometry(),s=scale();if(state.ghostReveal){const n=state.hand.filter(t=>t!==GHOST).length,k=state.awardFlight?ease((now-state.awardFlight.at)/600):0;o.ghostReveal.draw(c,z,s,state.ghostReveal.age,k,{x:z.x+(n+1)/2*39*s,y:z.top-58*s},o.drawFullCard);if(!state.awardFlight)button(c,state.ghostReveal.age<o.ghostReveal.END?'跳过':'收起',awardBox());return;}if(state.open&&state.hand[state.selected]===GHOST)o.ghostReveal?.backdrop?.(c,z);const order=state.open?state.hand.map((_,i)=>i).filter(i=>i!==state.selected).concat(state.hand.length?[state.selected]:[]):state.hand.map((_,i)=>i);if(!state.aim)order.forEach(i=>paintCard(c,state.hand[i],state.poses[i]||target()[i],state.open&&i===state.selected));
  if(!state.open&&state.hand.length){text(c,state.hand.filter(t=>t!==GHOST).length+'/3'+(state.hand.includes(GHOST)?' +1':''),z.x+(state.hand.includes(GHOST)?117:82)*s,z.top-49*s,14,'#fff2bc');}
  if(state.open&&state.hand.length&&!state.aim){const b=confirmBoxes();button(c,'取消',b.cancel,'cancel');button(c,state.hand[state.selected]===GHOST?(state.confirm?'确认转职':'转职'):'确认使用',b.ok,state.hand[state.selected]===GHOST?'cancel':undefined);}
  if(state.aim){const p=state.aim,r=o.getAimRadius?.()||90*s;c.save();const grad=c.createRadialGradient(p.x,p.y,0,p.x,p.y,r);grad.addColorStop(0,'rgba(170,100,255,.12)');grad.addColorStop(1,'rgba(173,105,255,.4)');c.fillStyle=grad;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.fill();c.strokeStyle='#d4a2ff';c.lineWidth=2*s;c.shadowColor='#ac6dff';c.shadowBlur=10;c.stroke();c.shadowBlur=0;c.lineWidth=3*s;const k=20*s,l=9*s;for(const ax of[-1,1])for(const ay of[-1,1]){c.beginPath();c.moveTo(p.x+ax*k,p.y+ay*(k-l));c.lineTo(p.x+ax*k,p.y+ay*k);c.lineTo(p.x+ax*(k-l),p.y+ay*k);c.stroke();}c.beginPath();c.moveTo(p.x-7*s,p.y);c.lineTo(p.x+7*s,p.y);c.moveTo(p.x,p.y-7*s);c.lineTo(p.x,p.y+7*s);c.stroke();text(c,'点地图施放雷暴 · 剩 '+(o.getCharges?o.getCharges(state.selected):0)+' 次',z.w-125*s,z.h*.36,16,'#f0dcff');button(c,'取消',aimCancelBox(),'cancel');c.restore();}
  if(state.award&&!state.open&&!state.aim){const d=CARD_DEFS[state.award],box=awardBox();if(!state.awardFlight){if(o.guideMode?.()){
   const wide=z.w>z.h,tx=wide?19:z.w/2,y=wide?z.h*.48:z.h/2+157*s,align=wide?'left':'center',space=wide?Math.max(120,z.w/2-122*s):z.w*.91;
   text(c,d.effect,tx,y,16,'#f2fff5',align,space);
   text(c,d.duration,tx,y+23*s,14,'#d4ffe1',align,space);
   text(c,state.award==='storm'?'收起 → 选卡确认 → 点地图':'收起 → 选卡 → 确认使用',tx,y+44*s,14,'#d4ffe1',align,space);
  }text(c,'获得卡牌 · '+d.name,z.w/2,z.h/2-238*s,21,'#ffe89f');button(c,'收起',box);paintCard(c,state.award,{x:z.w/2,y:z.h/2-85*s,w:190*s,h:(190*388/267)*s,a:0},true);}else{const t=ease((now-state.awardFlight.at)/600);const n=state.hand.filter(t=>t!==GHOST).length+(state.award===GHOST?2:1);const dest={x:z.x+(n-1)/2*39*s,y:z.top-58*s};paintCard(c,state.award,{x:lerp(z.w/2,dest.x,t),y:lerp(z.h/2-85*s,dest.y,t),w:lerp(190*s,54*s,t),h:lerp(190*388/267*s,54*388/267*s,t),a:lerp(0,(n-1)/2*.08,t)},false);}}
 }
 function pointerDown(x,y,now){tick(now);noteActivity(now);if(state.award&&!state.open&&!state.aim&&!state.awardFlight&&hit(awardBox(),x,y)){if(state.ghostReveal&&state.ghostReveal.age<o.ghostReveal.END){state.ghostReveal.age=o.ghostReveal.END;return true;}state.awardFlight={at:now};return true;}
 if(state.award===GHOST)return true;
 if(state.aim){if(hit(aimCancelBox(),x,y)){collapse(now);return true;}return false;}
 if(state.open){const b=confirmBoxes();if(hit(b.cancel,x,y)){collapse(now);return true;}if(hit(b.ok,x,y)){const type=state.hand[state.selected];if(type===GHOST){if(!state.confirm){state.confirm=true;return true;}if(o.onConfirmUse?.(type,state.selected,undefined,b.ok)?.ok)removeOwnedCard(state.selected,now);return true;}if(type==='storm'){const z=geometry();state.aim={x:z.w*.57,y:z.h*.5};}else{const result=o.onConfirmUse?.(type,state.selected);if(result?.ok){state.hand.splice(state.selected,1);state.selected=Math.max(0,Math.min(state.selected,state.hand.length-1));collapse(now);}}return true;}
   if(state.hand[state.selected]===GHOST&&b.cancel.paint&&x>=Math.min(b.cancel.x,b.ok.x)&&x<=Math.max(b.cancel.x+b.cancel.w,b.ok.x+b.ok.w)&&y>=Math.min(b.cancel.y,b.ok.y)&&y<=Math.max(b.cancel.y+b.cancel.h,b.ok.y+b.ok.h))return true;
  }
 const order=state.open?state.hand.map((_,i)=>i).filter(i=>i!==state.selected):state.hand.map((_,i)=>i).reverse();if(state.open)order.unshift(state.selected);for(const i of order){const p=state.poses[i];if(!p)continue;let dx=x-p.x,dy=y-p.y,xx=dx*Math.cos(p.a)+dy*Math.sin(p.a),yy=-dx*Math.sin(p.a)+dy*Math.cos(p.a);if(Math.abs(xx)<=p.w/2&&Math.abs(yy)<=p.h/2){select(i,now);return true;}}return false;}

 // Use the same armed card and aim state; only a completed single tap calls this.
 function castAim(point,expected,now){
  if(!expected||state.aim!==expected||state.hand[state.selected]!=='storm'||!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||hit(aimCancelBox(),point.x,point.y))return false;
  noteActivity(now);
  const result=o.onConfirmUse?.('storm',state.selected,point);
  if(result?.ok){if(result.remaining===0)state.hand.splice(state.selected,1);state.selected=Math.max(0,Math.min(state.selected,state.hand.length-1));collapse(now);}
  return true;
 }
 // Guide uses the native card geometry. No click or animation is issued here.
 function guideControl(preferred){
  if(state.award||state.awardFlight||!state.hand.length)return null;
  if(state.aim)return {step:'aim',type:state.hand[state.selected]};
  if(state.open&&state.hand[state.selected]===GHOST)return null;
  if(state.open)return {step:'confirm',type:state.hand[state.selected],pointer:confirmBoxes().ok};
  const i=Number.isInteger(preferred)&&preferred>=0&&preferred<state.hand.length?preferred:state.hand.map(t=>t!==GHOST).lastIndexOf(true),p=state.poses[i]||target()[i];if(state.hand[i]===GHOST)return null;
  return p?{step:'tray',type:state.hand[i],pointer:{x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h}}:null;
 }
 state.poses=target();return{state,suspendGhost,guideControl,draw,tick,pointerDown,castAim,noteActivity,select,collapse,beginAward,clearAward,collectAwardQuick,removeOwnedCard,definitions:CARD_DEFS};
}
if(typeof module!=='undefined')module.exports={CARD_DEFS,createCardInteraction};
