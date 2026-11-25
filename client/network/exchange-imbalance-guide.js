'use strict';
const noticePriority=require('./notice-priority'),visual=require('./exchange-guidance-visual');
const REFRESH_MS=400, MAX_DETAILS=3, DETAIL_MS=7000, COOLDOWN_MS=12000, REARM_MS=2000;
function install(g,{offline=()=>false,catalog=[]}={}){
 if(g.exchangeImbalanceBN)return;
 const entry=Array.isArray(catalog)?catalog.find(e=>e.type==='exchange'):catalog.exchange;
 if(!entry)return;
 let scan=null,blockedByPrior=false;
 const ordinary=()=>offline()===true&&!g.networkDrawCamera627&&!g.tutorial&&!g.superChallenge580&&g.player&&!g.player.dead&&['prep','hunt'].includes(g.state)
  &&!(g.easyOpeningGuideEnabled?.()&&(g.easyOpeningGuideStage||0)<10);
 const mayInterfere=()=>g.roundStarting||g.roundLoading591||g.endlessOpeningIntro||g.sessionMenuOpen||g.saveSlotsPanel
  ||g.demonPanel||g.allyDataPanel||g.relicPanel||g.ceremony||g.firstAttackGuideActive||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active
  ||noticePriority.active(g)||g.goldShortageGuideBN?.busy?.();
 const higher=a=>!!(a?.onboardingBN||a?.mandatory399||a?.boarding399||a?.wallWarning399||a?.emergency||a?.attackIntro);
 const time=()=>g.supportTime||0,paint=visual.create(g,time);
 const rich=(p,ratio,min,max)=>p.gold>=min&&p.gold>p.wood*ratio&&p.wood<max?'gold'
  :p.wood>=min&&p.wood>p.gold*ratio&&p.gold<max?'wood':null;
 function plan(resource){
  if(!resource)return null;
  const p=g.player,now=time(),scarce=resource==='gold'?'wood':'gold',dir=resource==='gold'?'goldToWood':'woodToGold';
  if(!scan||scan.player!==p||scan.buildings!==g.buildings||scan.count!==g.buildings.length||scan.time>now||now-scan.time>=REFRESH_MS){
   scan={player:p,buildings:g.buildings,count:g.buildings.length,time:now,shops:g.ownerBuildings(null,'exchange'),unlocked:g.isBuildUnlocked(entry)};
  }
  const live=shop=>shop&&!shop.dead&&shop.hp>0&&shop.ownerSlot==null&&shop.type==='exchange';
  const selected=g.selectedBuilding;
  const permits=shop=>live(shop)&&!g.exchangeBlockReason(shop,dir);
  const target=scan.shops.includes(selected)&&permits(selected)?selected:scan.shops.find(permits);
  if(target)return{resource,actionable:true,target,action:resource==='gold'?'exchangeGoldToWoodBtn':'exchangeWoodToGoldBtn',
   actionLabel:resource==='gold'?'金币换木材':'木材换金币',title:'把富余资源换成短缺资源',detail:'打开自己的交易所，按 1:1 兑换；每次额度由交易所等级决定。'};
  if(scan.shops.some(live)||!scan.unlocked)return null;
  if(p.wood>=entry.wood&&p.gold>=entry.gold)return{resource,actionable:true,type:'exchange',allowedTypes:['exchange'],title:'资源失衡，建造交易所',
   detail:'木材和金币可按 1:1 互换，建好后就能把富余资源换过来。'};
  if(p.drivingTank||p[scarce]>=entry[scarce]||p[resource]<entry[resource]||(scarce==='wood'?p.maxWood:p.maxGold)<entry[scarce])return null;
  return{resource,actionable:false,button:scarce==='wood'?'collectWood':'collectGold',title:'先攒够交易所的建造费用',
   detail:'建造交易所需要木'+entry.wood+'、金'+entry.gold+'；先补足短缺资源。'};
 }
 function record(now){
  const s=g.exchangeHintEpisodesBN;
  if(s&&Number.isInteger(s.count)&&s.count>=0&&s.count<=MAX_DETAILS&&Number.isFinite(s.started)&&s.started<=now
   &&(s.latched===null||s.latched==='wood'||s.latched==='gold')&&(s.neutral===null||Number.isFinite(s.neutral)&&s.neutral<=now))return s;
  return g.exchangeHintEpisodesBN={count:Math.min(MAX_DETAILS,Math.max(0,Math.floor(Number(s?.count)||0))),started:now-COOLDOWN_MS,latched:null,neutral:null};
 }
 const presenting=()=>!g.selectedBuilding&&!g.buildMenu&&!g.placement;
 const isDetailed=(s,resource,now)=>s&&s.latched===resource&&now>=s.started&&now-s.started<DETAIL_MS;
 const isFull=()=>g.player.wood>=g.player.maxWood||g.player.gold>=g.player.maxGold;
 function hint(next,s){
  return {...next,step:Math.max(10,g.easyOpeningGuideStage||0),optional:true,development:true,exchangeImbalanceBN:true,key396:'resource-imbalance:episode:'+s.count};
 }
 function opportunity(prior,advance){
  if(!ordinary()||g.midEconomyGuideR13?.managesExchange())return null;
  const p=g.player,now=time(),resource=rich(p,3,120,400),s=advance?record(now):g.exchangeHintEpisodesBN,blocked=higher(prior)||mayInterfere();
  // Rearm only after actually leaving the imbalance band, not after missing
  // the shop, briefly crossing the entry threshold, or reopening a saved game.
  if(advance&&s.latched!==null&&s.count<MAX_DETAILS){
   if(rich(p,2.5,100,440)===s.latched)s.neutral=null;
   else if(s.neutral===null)s.neutral=now;
   else if(now-s.neutral>=REARM_MS){s.latched=null;s.neutral=null;}
  }
  if(!resource||blocked)return null;
  const detailed=isDetailed(s,resource,now);
  const canStart=advance&&s.count<MAX_DETAILS&&s.latched===null&&now-s.started>=COOLDOWN_MS&&presenting();
  if(!detailed&&!canStart)return null;
  const next=plan(resource);
  if(!next||!next.actionable&&(prior||isFull()))return null;
  if(!detailed){s.count++;s.started=now;s.latched=resource;s.neutral=null;}
  return hint(next,s);
 }
 const previous=g.openingGuideAdvice;
 g.openingGuideAdvice=function(advance=false,...args){
  const prior=previous.apply(this,args);
  blockedByPrior=higher(prior);
  return opportunity(prior,advance===true)||prior;
 };
 const started=g.guideArrowStarted394;
 g.guideArrowStarted394=function(a,...args){
  if(a?.exchangeImbalanceBN&&(a.action&&a.target===this.selectedBuilding||a.type==='exchange'&&this.placement?.type==='exchange'&&this.placement.stage==='confirm'))return false;
  return started.call(this,a,...args);
 };
 function draw(ctx,inView,z,art){
  if(g.passiveHintsR13?.quiet())return null;
  if(!ordinary()||g.midEconomyGuideR13?.managesExchange()||blockedByPrior||mayInterfere()||!presenting()||!(z>0))return null;
  const resource=rich(g.player,3,120,400);
  if(!resource||isDetailed(g.exchangeHintEpisodesBN,resource,time()))return null;
  const target=plan(resource)?.target;
  if(!target||!inView(target.x,target.y,0)||g.fogEnabled&&g.fogStateAtWorld(target.x,target.y)!==2)return null;
  const {x,y}=paint.anchor(target,z,art);
  if(!inView(x,y,0)||!inView(x,y-19/z,0))return null;
  return visual.arrow(ctx,{x,y,time:time(),unit:1/z});
 }
 g.exchangeImbalanceBN={
  ownsAdvice:ordinary,advice:()=>opportunity(null,false),draw,
  cardRect:(a,measure)=>paint.card(a,measure),drawDetail:(a,art,text,measure)=>paint.drawDetail(a,art,{text,measure}),
  priority:()=>{
   const prior=g.developmentAdviceCache396?.advice;
   if(!ordinary()||g.midEconomyGuideR13?.managesExchange()||blockedByPrior||higher(prior)||mayInterfere())return false;
   const resource=rich(g.player,3,120,400);if(!resource)return false;
   const s=g.exchangeHintEpisodesBN,now=time(),next=plan(resource);
   if(!next?.actionable)return false;
   return !!next.target||isDetailed(s,resource,now)||((!s||s.count<MAX_DETAILS&&s.latched===null&&now-s.started>=COOLDOWN_MS)&&presenting());
  }
 };
}
module.exports={install};
