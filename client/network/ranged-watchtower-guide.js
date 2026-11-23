'use strict';
const priority=require('./notice-priority');
const towers=new Set(['tower','iceTower','manaTower','cannonTower']);
const CHECK=650,SHOW=4200,MAX_RECOMMENDED_LEVEL=6;
const between=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
const alive=b=>!!b&&!b.dead&&b.hp>0;
const ordinary=b=>alive(b)&&towers.has(b.type)&&!b.airDefenseKindBN&&b.range>0;
const incapacitated=b=>b.stunTimer>0||b.mammothPetrifyLeftBN>0;
function install(g,{offline=()=>false,catalog=[],Building,bonus}={}){
 if(g.rangedWatchtowerGuideBN)return g.rangedWatchtowerGuideBN;
 const entry=catalog.find(b=>b.type==='watchtower');if(!entry||!Building||typeof bonus!=='function')return null;
 let active=null,lastPlayer=null,nextProbe=0,template;
 const now=()=>g.supportTime||0;
 const match=()=>offline()===true&&g.player&&!g.player.dead&&g.state==='hunt'&&!g.networkDrawCamera627&&!g.networkAuthorityPhases627&&!g.tutorial&&!g.superChallenge580;
 const busy=()=>g.roundStarting||g.roundLoading591||g.endlessOpeningIntro||g.sessionMenuOpen||g.saveSlotsPanel||g.buildMenu||g.placement||g.selectedBuilding||g.demonPanel||g.allyDataPanel||g.relicPanel||g.ceremony||g.firstAttackGuideActive||g.popupActive515?.()||g.batIntroCardBN?.visible?.()||g.dragonTutorialBL?.active||g.noBuildingWarningAZ?.remaining?.()!=null||priority.active(g)||g.goldShortageGuideBN?.busy?.()||g.easyOpeningGuideEnabled?.()&&(g.easyOpeningGuideStage||0)<10;
 const eligible=(h,t)=>alive(h)&&h.waveRangedTrollBN===true&&h.waveNumber===g.waveNumber&&alive(t)&&t.ownerSlot==null&&!Number.isFinite(h.groundWaveRetireAtBN);
 function plan(h){
  template ||= new Building(0,0,'watchtower',1);
  const cap=Math.min(MAX_RECOMMENDED_LEVEL,template.maxUpgradeLevel()),targets=[],watchtowers=[];
  if(cap<2)return null;
  for(const b of g.buildings){
   if(ordinary(b)){
    const gap=between(b,h),current=b.attackRange();
    // If another tower can already reach, cooldown or target priority isn't a range problem.
    if(gap<current*current)return null;
    if(b.ownerSlot!=null||incapacitated(b))continue;
    for(let lv=2;lv<=cap;lv++){const reach=b.range*(1+bonus(lv)/100);if(gap<reach*reach){targets.push({b,lv});break;}}
   } else if(alive(b)&&b.ownerSlot==null&&b.type==='watchtower')watchtowers.push(b);
  }
  if(!targets.length)return null;
  let upgrade=null,best=null;
  for(const t of targets){
   if(!best||t.lv<best.lv)best=t;
   for(const w of watchtowers){
    const prospectiveSight=w.sightRange+(t.lv-w.level)*320;
    if(w.level>=t.lv||w.maxUpgradeLevel()<t.lv||!(prospectiveSight>0)||between(w,t.b)>prospectiveSight**2||g.buildingUpgradeBlockReason(w))continue;
    if(!upgrade||t.lv-w.level<upgrade.lv-upgrade.watch.level)upgrade={...t,watch:w};
   }
  }
  return upgrade||(g.isBuildUnlocked(entry)&&g.easyOpeningGuideAllowsBuild?.('watchtower')!==false?best:null);
 }
 function cancel(){
  if(active&&g.toast===active.toast)g.toast.time=0;
  active=null;
 }
 function onShot(h,t){
  if(lastPlayer!==g.player){cancel();lastPlayer=g.player;nextProbe=0;}
  if(!match()||!eligible(h,t)||g.player.rangedWatchtowerHintWaveBN===h.waveNumber)return false;
  const ts=now();if(ts<nextProbe||g.toast?.time>0||busy())return false;
  nextProbe=ts+CHECK;if(!g.buildings.includes(t))return false;const advice=plan(h);if(!advice)return false;
  const text=advice.watch?`哨塔升到Lv${advice.lv}，可提高附近防御塔射程`:`建哨塔并升到Lv${advice.lv}，可提高附近防御塔射程`;
  g.showToast(text);if(g.toast?.text!==text)return false;
  g.toast.time=SHOW;g.player.rangedWatchtowerHintWaveBN=h.waveNumber;
  active={h,t,advice,toast:g.toast,until:ts+SHOW,check:ts+CHECK};return true;
 }
 function tick(){
  if(!active)return;
  if(!match()||g.player!==lastPlayer||!eligible(active.h,active.t)||busy()||g.toast!==active.toast||active.toast.time<=0||now()>=active.until){cancel();return;}
  if(now()<active.check)return;
  active.check=now()+CHECK;const q=g.buildings.includes(active.t)&&plan(active.h);
  if(!q||q.watch!==active.advice.watch||q.lv!==active.advice.lv)cancel();
 }
 function draw(c){
  if(!active)return false;
  const w=active.advice.watch;
  if(w){
   const scale=g.zoom(),safe=g.uiSafeRect396(),x=(w.x-g.camera.x)*scale,y=(w.y-g.camera.y)*scale-60;
   if(x<safe.x+22||x>safe.right-22||y<g.topHudLayout().bottom+50||y>(g.buttonAreaTop||safe.bottom)-20)return false;
   g.drawUnifiedGuidanceArrow?.(c,{tipX:x,tipY:y,direction:'down',color:'green',scale:.83});return true;
  }
  const b=g.buttons?.find(p=>p.id==='moreBuilds'&&p.visible!==false&&p.w>0);
  if(!b)return false;
  g.drawUnifiedGuidanceArrow?.(c,{tipX:b.x+b.w/2,tipY:b.y-5,direction:'down',color:'green',scale:.83});return true;
 }
 return g.rangedWatchtowerGuideBN={onShot,tick,draw};
}
module.exports={install};
