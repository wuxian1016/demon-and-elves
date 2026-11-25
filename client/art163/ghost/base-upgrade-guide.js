'use strict';
const soft=require('./soft-hint');
const priority=require('../../network/notice-priority');
const legal=(g,b)=>b&&b.ownerSlot==null&&g.completedElfBuildingBN(b)&&g.buildings.includes(b);
const active=(g)=>!!g.baseUpgradeGuideBN&&g.baseUpgradeGuideBN.player===g.player;
const urgent=(g,b)=>g.wallHalfGuideDemo?.urgent?.()&&g.criticalPlayerWall399()!==b;
const wallPriority=(g,b)=>g.wallHalfGuideDemo?.state().shot||g.wallHalfGuideDemo?.active()&&g.wallHalfGuideDemo.state().wall!==b;
function open(g,b,required,allow){
 const p=g.player;if(g.operationGuideModeR13?.()===false||!required||!allow||!['prep','hunt'].includes(g.state)||p.dead||g.tutorial||!legal(g,b)||priority.active(g)||g.cameraScenesR7?.active()||g.demonAttackFocus545||g.pendingDemonFocus545||wallPriority(g,b)||urgent(g,b))return false;
 if(g.baseUpgradeGuideBN&&g.baseUpgradeGuideBN.building!==b)return false;
 const homes=g.ownerBuildings(null,'house').filter(h=>legal(g,h)&&h.canUpgrade());
 const h=homes.sort((a,b)=>b.level-a.level||Number(!!b.isInitialBase)-Number(!!a.isInitialBase))[0];
 if(!h||h.level>=required)return false;
 g.resourceCapPreview?.cancelGuide?.();g.goldShortageGuideBN?.cancelGuide?.();
 g.passiveHintsR13?.earned();
 g.baseUpgradeGuideBN={player:p,building:b,level:b.level,home:h,required,stage:'base',started:null};
 g.buildMenu=false;g.placement=null;g.rangeInspect548=null;g.builtSelectedBuilding=null;g.selectedBuilding=null;g.buildingMapFocus=null;g.cameraPeek=null;g.wxUiDirty=true;
 return true;
}
function stop(g,settle=false){
 if(settle){g.cameraFollow.x=g.camera.x;g.cameraFollow.y=g.camera.y;g.cameraPan.x=g.cameraPan.y=g.cameraRecenter.x=g.cameraRecenter.y=0;g.manualCamera394=true;}
 g.baseUpgradeGuideBN=null;
}
function frame(g,input,visible,w,h,mx,my){
 const s=g.baseUpgradeGuideBN;if(!s)return false;if(g.operationGuideModeR13?.()===false){stop(g);return false;}
 const busy=g.passiveHintsR13?.quiet()||!visible||g.player!==s.player||g.player.dead||!['prep','hunt'].includes(g.state)||!legal(g,s.building)||s.building.level!==s.level||!legal(g,s.home)||g.cameraPeek||g.endlessOpeningIntro||g.ceremony||g.buildMenu||g.placement||g.sessionMenuOpen||g.relicPanel||g.demonPanel||g.allyDataPanel||g.cardPresentation?.modal()||g.saveSlotsPanel||(!s.waiting&&input.active&&!input.wxMenuTap)||input.panning||input.stick?.active||input.pinch?.active;
 if(urgent(g,s.building)&&!busy){s.started=null;return false;}
 const combat=priority.active(g)||g.cameraScenesR7?.active()||g.demonAttackFocus545||g.pendingDemonFocus545||g.firstAttackCameraFocus||wallPriority(g,s.building);
 if(busy||combat){if(g.passiveHintsR13?.enabled()&&visible&&g.player===s.player&&legal(g,s.building)&&legal(g,s.home)&&s.building.level===s.level){s.detached=true;return false;}stop(g,!!input.panning);return false;}
 if(s.detached)return false;
 const target=s.stage==='base'?s.home:s.building;
 if(s.waiting){
  if(g.selectedBuilding!==target){if(g.passiveHintsR13?.enabled())s.detached=true;else stop(g);}
  return false;
 }
 if(g.selectedBuilding&&g.selectedBuilding!==target){stop(g);return false;}
 if(s.started===null){s.started=g.supportTime||0;s.x=g.camera.x;s.y=g.camera.y;}
 const u=Math.min(1,Math.max(0,((g.supportTime||0)-s.started)/950)),e=u*u*u*(10+u*(-15+6*u));
 const x=Math.max(0,Math.min(mx,target.x-w*.5)),y=Math.max(g.cameraTopLimitBN(),Math.min(my,target.y-h*.54));
 g.camera.x=s.x+(x-s.x)*e;g.camera.y=s.y+(y-s.y)*e;
 if(u===1){
  g.cameraFollow.x=x;g.cameraFollow.y=y;g.cameraPan.x=g.cameraPan.y=g.cameraRecenter.x=g.cameraRecenter.y=0;
  g.manualCamera394=true;g.selectedBuilding=target;s.waiting=true;g.wxUiDirty=true;
 }
 return true;
}
function afterUpgrade(g,b){
 const s=g.baseUpgradeGuideBN;
 if(!s||(!s.waiting&&!s.detached)||s.stage!=='base'||(b!==s.home&&!g.passiveHintsR13?.enabled())||g.getOwnerMaxHouseLevel()<s.required)return false;
 if(!legal(g,s.building)||s.building.level!==s.level){stop(g);return false;}
 s.stage='return';s.started=null;s.waiting=false;return true;
}
function paint(g,c,text){
 if(g.operationGuideModeR13?.()===false||g.passiveHintsR13?.quiet())return;
 const s=g.baseUpgradeGuideBN;
 if(!active(g)||priority.active(g)||urgent(g,s.building)||wallPriority(g,s.building)||g.popupActive515()&&!g.selectedBuilding)return;
 const target=s.stage==='base'?s.home:s.building;
 const label=s.building.type==='wall'?'城墙':g.buildingName(s.building);
 const msg=s.stage==='base'?['先把基地升到 '+s.required+' 级，','才能继续升级'+label] : ['基地等级已满足，','现在可继续升级这座'+label];
 const S=g.uiSafeRect396(),L=(s.waiting||s.detached)&&g.selectedBuilding===target?g.getUpgradePanelLayout():null,button=L?.upgradeBtn;
 const box=soft.layout(c,Math.min(266,S.w-44),msg.map(v=>[text(v),15])),{w,h}=box,top=g.topHudLayout().bottom;
 let x=S.x+(S.w-w)/2,y=Math.max(S.y+5,top+8,g.getMinimapRect().y+g.getMinimapRect().h+8);
 if(L){
  if(L.x-w-14>S.x){x=L.x-w-10;y=Math.max(S.y+6,L.y+4);}
  else if(L.y+L.h+h+12<S.bottom)y=L.y+L.h+6;
  else y=Math.max(S.y+3,L.y-h-6);
 }
 y=Math.max(S.y+3,Math.min(S.bottom-h-12,y));
 if(button){soft.buildArrow(g,c,button,1.15,box);return;}
 const z=g.zoom(),sx=(target.x-g.camera.x)*z,sy=(target.y-g.camera.y)*z-Math.min(48,Math.max(18,target.radius*.58*z));
 if(sx>=S.x&&sx<=S.right&&sy>=S.y&&sy<=S.bottom)soft.buildArrow(g,c,{x:sx,y:sy,w:0,h:0},1.13,box);
 else soft.paint(c,x,y,box);
}
module.exports={open,frame,stop,afterUpgrade,paint,active};
