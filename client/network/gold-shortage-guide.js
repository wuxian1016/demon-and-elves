'use strict';
const guideArrow=require('./resource-guidance-arrow');
// UI only. Observe an actual resource rejection; never infer failure from the
// network methods' false return, and never buy, deduct, or issue a command.
function point(t,w,h,r=6){const q=Math.PI*r/2,l=[w-2*r,q,h-2*r,q,w-2*r,q,h-2*r,q],total=l.reduce((a,b)=>a+b,0);let d=((t%1)+1)%1*total,i=0;while(d>l[i]&&i<7)d-=l[i++];const a=d/r;return i===0?[r+d,0]:i===1?[w-r+r*Math.cos(a-Math.PI/2),r+r*Math.sin(a-Math.PI/2)]:i===2?[w,r+d]:i===3?[w-r+r*Math.cos(a),h-r+r*Math.sin(a)]:i===4?[w-r-d,h]:i===5?[r+r*Math.cos(a+Math.PI/2),h-r+r*Math.sin(a+Math.PI/2)]:i===6?[0,h-r-d]:[r+r*Math.cos(a+Math.PI),r+r*Math.sin(a+Math.PI)];}
const CARD_DURATION_MS=3000, REJECTION_DURATION_MS=1800, REJECTION_COOLDOWN_MS=4000;
const ACTIONS={startBuildFromCatalog:'build',startPlacement:'build',requestPlayerBuild506:'build',buildBuilding:'build',handlePlacementTap:'build',tryUpgradeBuilding:'upgrade',tryResearchTankTech:'researchTank',tryResearchRobotTech:'researchRobot',tryInstallTankModule:'installModule',tryManufactureTank:'manufactureTank',tryTransformTankToRobot:'transformRobot',tryMakePeasant:'recruit',tryExchange:'exchange'};
function install(g,{catalog=[],costs={},viewport=()=>({width:414,height:896}),clock=()=>Date.now(),offline=()=>true,text=x=>x}={}){
 if(g.goldShortageGuideBN)return g.goldShortageGuideBN;
 const entries=new Map(catalog.map(x=>[x.type,x]));let lastRejectionUntil=-Infinity;let context=null,depth=0,failures=[],lastCard=-Infinity,card=null,generation=g.player,rect=null,guide=null,frames=null,frameSize='';
 const clearCard=()=>{if(card&&g.toast?.text===compactText())g.toast={text:'',time:0};card=null;rect=null;};
 const sync=()=>{if(generation!==g.player){generation=g.player;failures=[];lastCard=-Infinity;lastRejectionUntil=-Infinity;clearCard();guide=null;}if(card&&(clock()>=card.until||g.player?.dead||g.tutorial||!['prep','hunt'].includes(g.state)))clearCard();};
 function capture(action,args={},target=null){if(!Object.values(ACTIONS).includes(action))return null;const p=g.player;if(!p||p.dead)return null;let cost=null;
  if(action==='build'){const e=entries.get(args.type);if(e)cost={wood:e.wood,gold:e.gold};}
  else if(action==='upgrade')cost=target?.upgradeCost?.();
  else if(action==='researchTank')cost={wood:0,gold:g.tankTechCost?.(args.kind)};
  else if(action==='researchRobot')cost={wood:0,gold:g.robotTechCost?.(args.kind)};
  else if(action==='installModule')cost=g.tankModuleCost?.(args.kind);
  else if(action==='exchange'&&args.direction==='goldToWood'&&Number.isFinite(costs.EXCHANGE_RATE?.gold))cost={wood:0,gold:costs.EXCHANGE_RATE.gold*(args.batches??g.exchangeSelectedBatches?.(args.direction,target))};
  return{action,args:{...args},target,cost:cost&&{wood:Number(cost.wood)||0,gold:Number(cost.gold)},gold:p.gold,wood:p.wood,maxGold:p.maxGold,player:p};
 }
 function exhausted(){const p=g.player,z=g.resourceZones?.[g.resourceZoneIndexFor401?.(p)??g.playerStartZoneIndex];if(!p||!z)return false;const known=(g.goldMines||[]).filter(m=>Math.hypot(m.x-z.x,m.y-z.y)<=1200);if(!known.length||known.some(m=>!m.dead&&m.gold>0))return false;return !g.findTaskResource401?.({type:'gold',zoneIndex:g.resourceZoneIndexFor401?.(p),originX:p.x,originY:p.y,localRadius:1200});}
 function recommendation(){const e=entries.get('goldMine'),owned=(g.buildings||[]).filter(b=>!b.dead&&b.ownerSlot==null&&b.type==='goldMine');
  if(e&&!g.buildingCountBlockReason?.('goldMine')&&g.isBuildUnlocked?.(e)&&g.easyOpeningGuideAllowsBuild?.('goldMine')!==false)return{kind:'build',label:'查看金矿厂',detail:'建造更多金矿厂，持续生产金币。'};
  const mine=owned.find(b=>b.canUpgrade?.()&&!g.buildingUpgradeBlockReason?.(b));if(mine)return{kind:'upgrade',target:mine,label:'查看已有金矿厂',detail:'金矿厂暂不能增建，可升级已有金矿厂。'};
  return{kind:null,label:null,detail:owned.length?'现有金矿厂暂不可扩建升级，先等待产金。':'金矿厂暂不可建造，请先满足解锁条件。'};
 }
 function failure(s,message,{online=false}={}){sync();if(!s||s.player!==g.player||g.player?.dead||g.tutorial||!['prep','hunt'].includes(g.state)||typeof message!=='string')return null;
  // Match only terminal native resource failure wording, never capacity/locks.
  if(/仓容|空间不足|已满|未解锁|只能|冷却|放不下：(?!资源不足)/.test(message))return null;
  if(!/资源不足|金子不足|金币不足|^(?:(?:升级|制造|改装|改造机器人))?需要 木\d+ 金\d+/.test(message))return null;
  let cost=s.cost;const match=message.match(/木(\d+)\s*金(\d+)/);if(!cost&&match)cost={wood:+match[1],gold:+match[2]};
  if(!cost||!Number.isFinite(cost.gold)||cost.gold<=0)return null;
  const gold=online?Math.max(s.gold,g.player.gold):s.gold,wood=online?Math.max(s.wood,g.player.wood):s.wood;if(gold>=cost.gold)return null;
  if(Number.isFinite(s.maxGold)&&cost.gold>s.maxGold)return null;
  const both=wood<(cost.wood||0),missing=Math.ceil(cost.gold-gold),short=both?'木材和金币不足':`金币不足，还差${missing}金币`;
  // Existing concise notice is made precise on every actual failure; the
  // explanatory card is rate-limited separately and cannot restart its timer.
  const now=clock();g.resourceCapPreview?.cancelGuide?.();if(now>=lastRejectionUntil+REJECTION_COOLDOWN_MS-REJECTION_DURATION_MS)lastRejectionUntil=now+REJECTION_DURATION_MS;
  if(!require('./notice-priority').active(g)){const remaining=Math.max(0,lastRejectionUntil-now);g.toast=remaining?{text:short,time:remaining}:{text:'',time:0};}failures=failures.filter(at=>now-at<=10000);failures.push(now);
  const empty=exhausted();if(failures.length>=(empty?2:3)&&now-lastCard>=45000&&!card){const advice=recommendation();card={...advice,title:both?'木材和金币不足':'金币不足',lines:[empty?'附近天然金矿已采尽。':'持续产金能减少等待。',advice.detail,both?'先补充木材，再积攒建造金币。':'先积攒资源，再进行建造或升级。'],until:now+CARD_DURATION_MS};lastCard=now;failures=[];}
  return short;
 }
 const show=g.showToast;g.showToast=function(message,...args){if(context)context.messages.push(message);return show.call(this,message,...args);};
 for(const[name,action]of Object.entries(ACTIONS)){const original=g[name];if(typeof original!=='function')continue;g[name]=function(...args){if(!offline()&&name!=='handlePlacementTap')return original.apply(this,args);if(depth)return original.apply(this,args);sync();let target=null,a={};if(action==='build')a={type:name==='handlePlacementTap'?this.placement?.type:args[0]};else if(['researchTank','researchRobot','installModule'].includes(action)){a={kind:args[0]};target=args[1];}else{target=args[0];if(action==='exchange')a={direction:args[1]??'goldToWood',batches:args[2]};}
  // AI/silent production failures are not player clicks.
  if(['manufactureTank','transformRobot'].includes(action)&&args[1]&&args[1]!==g.player||action==='recruit'&&(args[1]!=null||args[2]))return original.apply(this,args);
  const c=context={snapshot:capture(action,a,target),messages:[]};depth++;let result;try{result=original.apply(this,args);}finally{depth--;context=null;}let rejected=false;for(const m of c.messages)if(failure(c.snapshot,m)){rejected=true;break;}if(result===true&&!rejected){failures=[];card=null;}return result;
 };}
 function compactText(){if(!card)return '';const line=card.kind==='build'?'建议建造金矿厂':card.kind==='upgrade'?'建议升级金矿厂':'等待金矿厂产金';return card.title+'\n'+(card.kind||g.buildings?.some(b=>!b.dead&&b.ownerSlot==null&&b.type==='goldMine')?line:'请先解锁金矿厂');}
 function layout(){return rect||{x:0,y:0,w:0,h:0};}
 const hit=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
 function open(){g.resourceCapPreview?.cancelGuide?.();const next=recommendation();card=null;rect=null;if(next.kind==='build'){g.selectedBuilding=null;g.openBuildMenu?.();const e=entries.get('goldMine');g.buildMenuPage=e.page??0;g.builtCatalogPage=e.page??0;const index=catalog.filter(v=>v.page===e.page).findIndex(v=>v.type==='goldMine');g.setBuildMenuScroll439?.(Math.max(0,index*(e.page===1?132:96)-16));guide={kind:'build'};}else if(next.kind==='upgrade'){g.buildMenu=false;g.placement=null;g.selectedBuilding=null;guide={kind:'world',target:next.target,started:clock(),level:next.target.level,from:g.camera?{...g.camera}:null};}g.wxUiDirty=true;}
 const tap=g.handleTap;if(typeof tap==='function')g.handleTap=function(x,y,...args){sync();if(card&&!require('./notice-priority').active(this)&&!this.resourceCapPreview?.priorityAvailable?.()&&hit(rect,x,y)){if(card.kind)open();else{card=null;rect=null;}return true;}if(guide?.kind==='world')guide=null;return tap.call(this,x,y,...args);};
 const draw=g.drawFrame398;if(typeof draw==='function')g.drawFrame398=function(...args){sync();if(guide?.kind==='world'){const q=guide,age=clock()-q.started;if(this.selectedBuilding||this.placement||this.buildMenu||this.sessionMenuOpen||q.target.dead||q.target.level!==q.level)guide=null;else{if(q.from&&this.panCamera){const v=viewport(),z=this.zoom(),u=Math.min(1,age/450),ease=u*u*(3-2*u),to={x:q.target.x-v.width/2/z,y:q.target.y-v.height*.52/z};guide=null;this.panCamera(q.from,(q.from.x-to.x)*ease*z,(q.from.y-to.y)*ease*z);guide=q;}if(age>=1800){const next=recommendation();if(next.kind==='upgrade'&&next.target===q.target){this.selectedBuilding=q.target;guide={kind:'upgrade',target:q.target};}else guide=null;}}}const notice=compactText(),show=!!card&&!this.sessionMenuOpen&&!this.saveSlotsPanel&&!this.demonPanel&&!this.allyDataPanel&&!this.relicPanel&&!this.placement;
 if(show&&!require('./notice-priority').active(this)&&!this.resourceCapPreview?.priorityAvailable?.())this.toast={text:notice,time:Math.min(1000,Math.max(0,card.until-clock()))};
 const result=draw.apply(this,args);rect=show&&!require('./notice-priority').active(this)&&!this.resourceCapPreview?.priorityAvailable?.()&&this.toast?.text===notice&&this.toastRect?{...this.toastRect}:null;
 if(rect){const panel=this.buildMenu?this.getBuildMenuLayout():this.selectedBuilding?this.getUpgradePanelLayout():null;if(panel&&Number.isFinite(panel.y))rect.y=Math.max(8,Math.min(rect.y,panel.y-rect.h-12));const c=this.ctx;if(c){const{x,y,w,h}=rect;c.save();this.displayTransform398(c);c.globalAlpha=1;c.fillStyle='rgba(17,39,31,.94)';c.strokeStyle='#F5CB58';c.lineWidth=2;c.beginPath();c.moveTo(x+6,y);c.lineTo(x+w-6,y);c.quadraticCurveTo(x+w,y,x+w,y+6);c.lineTo(x+w,y+h-6);c.quadraticCurveTo(x+w,y+h,x+w-6,y+h);c.lineTo(x+6,y+h);c.quadraticCurveTo(x,y+h,x,y+h-6);c.lineTo(x,y+6);c.quadraticCurveTo(x,y,x+6,y);c.closePath();c.fill();c.stroke();c.fillStyle='#FFD64A';c.font='900 13px sans-serif';c.textAlign='center';c.textBaseline='alphabetic';(rect.lines||notice.split('\n')).forEach((line,i)=>c.fillText(text(line),x+w/2,y+17+i*18,w-12));c.restore();}}

 if(rect&&this.cachedUi514){const{x,y,w,h}=rect,key=w+':'+h;if(frameSize!==key){frameSize=key;frames=[];for(let frame=0;frame<48;frame++)frames.push(this.cachedUi514('gold-guide-orbit:'+key+':'+frame,w+10,h+10,c=>{for(let j=0;j<20;j++){const[px,py]=point(frame/48-j/300,w,h);c.beginPath();c.fillStyle='rgba(255,220,83,'+((1-j/20)*.9)+')';c.shadowColor='#FFD64B';c.shadowBlur=4;c.arc(px+5,py+5,j?1.5:2.2,0,Math.PI*2);c.fill();}}));}const c=this.ctx;c.save();this.displayTransform398(c);c.globalAlpha=1;c.drawImage(frames[Math.floor(clock()/2000*48)%48],x-5,y-5,w+10,h+10);c.restore();}
 if(guide&&!require('./notice-priority').active(this)){let target=null;if(guide.kind==='world'&&!guide.target.dead){const z=this.zoom();target={x:(guide.target.x-this.camera.x)*z-15,y:(guide.target.y-this.camera.y)*z-20,w:30,h:0};}else if(guide.kind==='upgrade'&&this.selectedBuilding===guide.target&&!guide.target.dead)target=this.getUpgradePanelLayout().upgradeBtn;else if(guide.kind==='build'&&this.buildMenu&&this.buildMenuPage===0){const L=this.getBuildMenuLayout(),row=L.rows.find(q=>q.entry.type==='goldMine');if(row&&row.rect.y>=L.listRect.y&&row.rect.y+row.rect.h<=L.listRect.y+L.listRect.h)target=row.rect;}if(target){const c=this.ctx,vertical=guide.kind!=='build';c.save();this.displayTransform398(c);guideArrow.draw(c,{tipX:vertical?target.x+target.w/2:target.x+target.w-38,tipY:vertical?target.y-16:target.y+target.h*.38,direction:vertical?'down':'left',timeMs:clock(),scale:1});c.restore();}else guide=null;}return result;};
 const pan=g.panCamera;if(pan)g.panCamera=function(...a){if(guide?.kind==='world')guide=null;return pan.apply(this,a);};
 const api={cancelGuide:()=>{card=null;guide=null;rect=null;},busy:()=>{sync();return !!card||!!guide||clock()<lastRejectionUntil;},capture,failure,success:()=>{failures=[];card=null;},report:()=>{sync();return{failures:failures.length,lastCard,card:card&&{...card},exhausted:exhausted()};},dismiss:()=>{card=null;},layout,ownsToast:raw=>!!card&&raw===compactText(),activate:open};Object.defineProperty(g,'goldShortageGuideBN',{value:api,configurable:true});return api;
}
module.exports={install};
