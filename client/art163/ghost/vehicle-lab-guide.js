'use strict';
const soft=require('./soft-hint');
const notice=require('../../network/notice-priority');
const opts={
 tank:{bit:1,lab:'tankLab',name:'坦克',fields:['armor','damage','attackSpeed','speed','slowCannon','droneBay'],ids:['techArmorBtn','techDamageBtn','techSpeedBtn','techMoveBtn','slowCannonBtn','droneBayBtn'],names:['护甲','火炮','攻击速度','移动速度','远程减速炮','双无人机舱']},
 robot:{bit:2,lab:'robotLab',name:'机器人',fields:['laser','minion','armor','speed','shred','guard'],ids:['robotLaserBtn','robotMinionBtn','robotArmorBtn','robotSpeedBtn','robotShredBtn','robotGuardBtn'],names:['激光','小机器人','装甲','移动速度','攻击减甲','护塔光环']}
};
exports.install=function(g,runtime,catalog,Building,offline){
 const entries=new Map(catalog.map(e=>[e.type,e]));
 const radius={tankLab:new Building(0,0,'tankLab').radius,robotLab:new Building(0,0,'robotLab').radius};
 const text=runtime.nativeText,own=b=>b?.ownerSlot==null&&g.completedElfBuildingBN(b),clock=()=>g.supportTime||0,age={tank:0,robot:0},quietUntil={tank:0,robot:0},lastStep={tank:0,robot:0};
 let player,firstSeenAt=null,paintAt=null,site=null;
 function clear(){player=g.player;firstSeenAt=paintAt=null;site=null;age.tank=age.robot=0;quietUntil.tank=quietUntil.robot=0;lastStep.tank=lastStep.robot=0;}
 function historic(which){return which==='tank'
   ?Object.values(g.tankTech||{}).some(v=>v>0)||Object.values(g.tankModules||{}).some(Boolean)
   :Object.values(g.robotTech||{}).some(v=>v>0);}
 function catchLegacy(){
  if(g.vehicleLabGuidePendingPF!=null||g.vehicleLabGuideSeenPF!=null)return;
  g.vehicleLabGuidePendingPF=g.vehicleLabGuideSeenPF=0;
  for(const which of ['tank','robot'])if(unique(which)){
   const bit=opts[which].bit;
   if(historic(which))g.vehicleLabGuideSeenPF|=bit;else g.vehicleLabGuidePendingPF|=bit;
  }
 }
 function sync(){if(player!==g.player)clear();}
 function unique(type){return g.tanks.some(t=>!t.dead&&t.ownerSlot==null&&!!t.isRobot===(type==='robot'));}
 function ready(){return g.player&&!g.player.dead&&offline()&&['prep','hunt'].includes(g.state)&&!g.superChallenge580&&!g.tutorial&&!runtime.hidden
  &&!notice.economy(g)&&!g.wallBaseLevelGuideDemo?.active?.()&&!g.baseUpgradeGuideBN
  &&!g.demonTowerGuidePreview?.view()&&!g.antiAirGuidePreview?.view()&&!g.defenseGuideDemo?.view?.()&&!g.goldMineGuidePreview?.view()&&!g.woodWorkforcePreview?.view()
  &&!g.tankEconomyGuidePreview?.view()&&!g.vehicleDriveGuidePreview?.view()&&!g.rewardAdBN?.pausesLive?.()&&!g.robotGuideBN?.playing?.()&&!g.dragonTutorialBL?.active&&!g.batIntroCardBN?.visible?.()
  &&!g.cardPresentation?.modal()&&!g.cardPresentation?.blocksDock?.()&&!g.shareRescueVisible616()&&!g.rotationInputBlocked398()
  &&!g.sessionMenuOpen&&!g.saveSlotsPanel&&!g.relicPanel&&!g.allyDataPanel&&!g.demonPanel&&!g.placement&&!g.ceremony&&!g.endlessOpeningIntro
  &&!g.roundStarting&&!g.roundLoading591&&!g.cameraScenesR7?.active()&&!g.demonAttackFocus545&&!g.pendingDemonFocus545&&!g.firstAttackCameraFocus
  &&!g.goldShortageGuideBN?.busy?.()&&!g.resourceCapPreview?.busy?.()&&!g.warehouseGuidePreview?.view?.();}
 function choice(which,stockGold,stockWood,lab=null){
  const q=opts[which],isTank=which==='tank';if(!isTank&&!g.robotUnlocked())return null;
  for(let i=0;i<q.fields.length;i++){
   const k=q.fields[i],module=isTank&&i>=4;
   if(module){const cost=g.tankModuleCost(k);if(!g.tankModules[k]&&stockGold>=cost.gold&&stockWood>=cost.wood)return {k,id:q.ids[i],name:q.names[i],gold:cost.gold,wood:cost.wood};continue;}
   const cost=isTank?g.tankTechCost(k):g.robotTechCost(k);if(!Number.isFinite(cost)||stockGold<cost)continue;
   if(lab&&(isTank?g.tankTechBlockReason(k,lab):g.robotTechBlockReason(k,lab)))continue;
   return {k,id:q.ids[i],name:q.names[i],gold:cost,wood:0};
  }
  return null;
 }
 function canSite(type){
  const n=g.buildings.length,at=clock(),home=g.indexedOwnerBuildings(null).find(b=>b.type==='house'&&b.isInitialBase&&own(b)),grid=g.ordinaryBuildingGridAD;
  if(!home)return false;if(site&&site.type===type&&site.home===home&&site.n===n&&at>=site.at&&at-site.at<2500)return site.ok;
  site={type,home,n,at,ok:false};
  const u=grid?.unit||100,geom=g.placementGeometry621;if(!geom)g.placementGeometry621=new Map();
  try{for(let r=2;r<=5;r++)for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const x=home.x+dx*r*u,y=home.y+dy*r*u,p=grid?.nearest(x,y,type)||{x,y};
   if(!g.buildQueuePlacementReasonBN?.(type,p.x,p.y)&&g.canPlaceBuilding(p.x,p.y,radius[type],type)){site.ok=true;return true;}
  }}finally{if(!geom)g.placementGeometry621=null;}
  return false;
 }
 function finished(unit){if(!offline()||unit?.ownerSlot!=null||unit.dead||g.superChallenge580||g.tutorial)return;sync();
  const which=unit.isRobot?'robot':'tank',{bit}=opts[which];if(historic(which)){g.vehicleLabGuideSeenPF=(g.vehicleLabGuideSeenPF|0)|bit;g.vehicleLabGuidePendingPF=(g.vehicleLabGuidePendingPF|0)&~bit;return;}if(!(g.vehicleLabGuideSeenPF&bit)){g.vehicleLabGuidePendingPF=(g.vehicleLabGuidePendingPF|0)|bit;firstSeenAt=clock();paintAt=null;g.wxUiDirty=true;}
 }
 function acknowledge(which){const bit=opts[which].bit;if(g.vehicleLabGuidePendingPF&bit){g.vehicleLabGuidePendingPF&=~bit;g.vehicleLabGuideSeenPF=(g.vehicleLabGuideSeenPF|0)|bit;}}
 function view(){
  sync();if(!offline()||!['prep','hunt'].includes(g.state))return null;catchLegacy();const pending=g.vehicleLabGuidePendingPF|0;if(!pending||!ready())return null;
  const now=clock();if(firstSeenAt===null)firstSeenAt=now;if(now-firstSeenAt<1400)return null;
  const which=(pending&2)&&unique('robot')?'robot':(pending&1)&&unique('tank')?'tank':null;
  if(!which)return null;
  const q=opts[which],entry=entries.get(q.lab),p=g.player;if(!entry)return null;
  const lab=g.indexedOwnerBuildings(null).find(b=>b.type===q.lab&&own(b));
  const selected=g.selectedBuilding,full=lab?choice(which,p.gold,p.wood,lab):choice(which,p.gold-entry.gold,p.wood-entry.wood);
  if(!full||selected&&selected!==lab)return null;
  let target=null,mode='down',angle=null,copy,sub;
  if(!lab){
   if(p.wood<entry.wood||p.gold<entry.gold||!g.isBuildUnlocked(entry)||g.easyOpeningGuideAllowsBuild(q.lab)===false
    ||g.getPlayerBuildQueueBN?.().some(j=>j.buildType===q.lab)||g.indexedOwnerBuildings(null).some(b=>!b.dead&&b.type===q.lab)||!canSite(q.lab))return null;
   copy=q.name+'已完工，建造'+entry.name;
   sub='木'+entry.wood+' / 金'+entry.gold+' · 可研发'+full.name;
   if(!g.buildMenu){target=g.buttons.find(b=>b.id==='moreBuilds'&&b.visible!==false);mode='dock';if(!target)return null;}
   else {const l=g.getBuildMenuLayout();
    if(g.buildMenuPage!==entry.page){target=soft.catalogTab(g,l,entry.page);sub=soft.catalogHint(g,entry.page);}
    else {const row=l.rows.find(r=>r.entry.type===q.lab)?.rect;target=soft.catalogRow(g,l,row,q.lab);mode=target?.scrollDown?'scroll':'row';if(target?.scrollDown)sub=soft.scrollCopy(entry.name);else if(!target&&row&&l.maxScroll)sub='向上滑，找到'+entry.name+'。';}
   }
  }else if(g.selectedBuilding===lab){
   target=g.getUpgradePanelLayout()[full.id];if(!target)return null;copy='在'+entry.name+'研发'+full.name;sub=(full.wood?'木'+full.wood+' / ':'')+'金'+full.gold+' · 手动点击按钮研发';
  }else if(!g.buildMenu){
   const z=g.zoom(),S=g.uiSafeRect396(),mm=g.getMinimapRect(),top=Math.max(S.y+44,g.topHudLayout().bottom+48),bottom=S.bottom-99;
   const wx=(lab.x-g.camera.x)*z,wy=(lab.y-g.camera.y)*z-42,cx=S.x+S.w*.5,cy=(top+bottom)*.5;
   const l=S.x+32,r=S.right-34,boundX=Math.max(l,Math.min(r,wx)),boundY=Math.max(top,Math.min(bottom,wy));
   const visible=wx===boundX&&wy===boundY&&!(wx>=mm.x-18&&wx<=mm.x+mm.w+18&&wy<mm.y+mm.h+23);
   const x=visible?wx:boundX,y=visible?wy:Math.max(top,Math.min(bottom,boundY)),u=visible?null:Math.atan2(wy-cy,wx-cx);
   if(!(x>=mm.x-18&&x<=mm.x+mm.w+18&&y<mm.y+mm.h+25)){target={x,y,w:0,h:0};angle=u;}
   copy=visible?'打开已有的'+entry.name:entry.name+'已建成，可去研发';
   sub='可研发'+full.name+'，不会自动扣费';
  }else return null;
  const step=lab?4:3;
  if(lastStep[which]!==step){lastStep[which]=step;age[which]=0;quietUntil[which]=0;paintAt=null;}
  if(now<quietUntil[which])return null;
  const stageCopy=lab?(g.selectedBuilding===lab?'研发'+full.name:'打开已有的'+entry.name):'建造'+entry.name;
  return{which,step,entry,lab,full,copy:step+'/4 '+stageCopy,sub,target,mode,angle};
 }
 function paint(){
  if(g.passiveHintsR13?.quiet())return;
  const v=view(),now=clock();if(!v){paintAt=null;return;}
  if(paintAt!==null)age[v.which]+=Math.min(75,Math.max(0,now-paintAt));
  paintAt=now;if(age[v.which]>=11000){age[v.which]=0;quietUntil[v.which]=now+22000;paintAt=null;return;}
  const C=g.ctx,S=g.uiSafeRect396(),M=g.getMinimapRect(),L=g.buildMenu?g.getBuildMenuLayout():g.selectedBuilding?g.getUpgradePanelLayout():null;
  const box=soft.layout(C,Math.min(288,S.w-44),[[text(v.copy)],[text(v.sub),12,'#DCF5E5','']]),{w,h}=box,x=S.x+(S.w-w)/2;
  let y=Math.min(S.bottom-h-50,Math.max(g.topHudLayout().bottom+20,M.y+M.h+10));
  if(L)y=L.y+L.h+h+8<S.bottom-36?L.y+L.h+7:Math.max(S.y+4,L.y-h-5);
  C.save();g.displayTransform398(C);
  if(v.target&&v.angle==null&&!v.target.scrollDown)soft.buildArrow(g,C,v.target,1.22,box);
  else if(v.target?.scrollDown)soft.buildArrow(g,C,v.target,1.22);
  else soft.paint(C,x,y,box);
  C.restore();
 }
 for(const [method,which] of [['tryResearchTankTech','tank'],['tryInstallTankModule','tank'],['tryResearchRobotTech','robot']]){
  const orig=g[method];g[method]=function(...args){const ok=orig.apply(this,args);if(ok)acknowledge(which);return ok;};
 }
 const draw=g.draw;g.draw=function(...args){const out=draw.apply(this,args);paint();return out;};
 g.vehicleLabGuidePF={finished,view,clear};
};
