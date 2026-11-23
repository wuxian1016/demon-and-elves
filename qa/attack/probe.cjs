'use strict';
const fs=require('fs'),path=require('path'),a=require('node:assert/strict'),{makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const [root,out,owner]=process.argv.slice(2),disk=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wx-attack-warning-'));
fs.writeFileSync(disk+'/keys.json','{}');
const host=makeHost(root,disk,false,{width:390,height:844,seed:150,clockStart:1800000000000});
function tap(b){const x=b.x+b.w/2,y=b.y+b.h/2,p={identifier:1,x,y,clientX:x,clientY:y};host.emit('TouchStart',{changedTouches:[p],touches:[p]});host.emit('TouchEnd',{changedTouches:[p],touches:[]});}
function strings(ctx){const texts=[],fill=ctx.fillText;ctx.fillText=function(t,...a){texts.push(t);return fill.call(this,t,...a);};return texts;}
(async()=>{
 host.start();await until(()=>host.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','Home',25000);
 const {window:w,runtime}=host.env(),g=w.game,T=w.originalNetwork627.types;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'home',12000);
 g.allySlots.fill(false);if(owner!=='solo')g.allySlots[0]=true;
 g.startOptionsDirty=true;tap(g.getStartActionButtons().find(x=>x.id==='startGame'));
 await until(()=>!g.roundStarting&&g.state==='prep','native new game',30000);
 const homes=g.buildings.filter(b=>b.isInitialBase&&b.type==='house'&&!b.dead),d=g.troll,zone=g.playerWarningZone431(),home=homes.find(b=>b.ownerSlot==null),allyhome=g.buildings.find(b=>b.type==='house'&&b.ownerSlot!=null);
 a(home&&zone&&g.attackWarningAvoidanceAZ);
 g.state='hunt';g.tutorial=null;g.endlessOpeningIntro=null;g.sessionMenuOpen=false;
 g.waveElapsed=145;g.supportTime=145000;
 Object.assign(d,{dead:false,state:'patrol',attackCd:1e6,x:zone.gateX+(g.trollBase.x-zone.gateX)*.22,y:zone.gateY+(g.trollBase.y-zone.gateY)*.22});
 g.update(1000/60);const pol=d.raidPolicyStateAB;
 if(pol)Object.assign(pol,{owner:'self',phase:'local',first:false,warningLeft:38000,selectionSerial:21,engaged:false,healthReturnPending:false,purchasePending:false});
 g.toast=null;g.firstDemonAttackSeen545=false;g.pendingDemonFocus545=null;g.firstGateHintAB=null;
 const calls=[],notify=g.showToast;g.showToast=function(t,...args){calls.push(t);return notify.call(this,t,...args);};
 const texts=strings(g.ctx),cache=[];const arrow=g.drawAttackDirectionArrowBH;
 g.drawAttackDirectionArrowBH=function(...args){const ok=arrow.apply(this,args);cache.push(ok);return ok;};
 const observe=()=>Array.from(g.incomingAttackWarningStates(),r=>({kind:r.kind,seconds:r.seconds,arrived:g.attackWarningAvoidanceAZ.arrived(r),visible:g.attackWarningAvoidanceAZ.visible(r)}));
 const warning0=observe();g.updateFirstAttackWarningFocus();g.updateFirstAttackWarningFocus();
 const phrase='恶魔正从路口来袭！',patched=process.env.ASSERT_FIXED==='1';
 if(owner!=='solo'&&patched)a.equal(calls.filter(t=>t===phrase).length,1);
 const approach={warnings:warning0,calls:calls.slice(),focus:!!g.firstAttackCameraFocus,disabled:false};
 const beforeGate={x:d.x,y:d.y};
 d.x=zone.gateX;d.y=zone.gateY;g.drawIncomingAttackWarning(g.ctx,()=>true);
 const contactAtGate=observe();if(patched)a(contactAtGate.some(w=>w.kind==='demon'&&w.arrived&&!w.visible));
 if(pol){d.x=beforeGate.x;d.y=beforeGate.y;pol.selectionSerial++;pol.warningLeft=39000;}
 const secondApproach=observe();
 if(pol&&patched){a(secondApproach.some(w=>w.kind==='demon'&&!w.arrived));const mid=calls.length;g.toast=null;
  const {x,y}=g.camera;g.manualCamera394=true;g.updateFirstAttackWarningFocus();a.equal(calls.length,mid+1);a.equal(g.camera.x,x);a.equal(g.camera.y,y);
  g.updateFirstAttackWarningFocus();a.equal(calls.length,mid+1);g.manualCamera394=false;
  pol.selectionSerial++;pol.owner='ai-0';g.toast=null;g.updateFirstAttackWarningFocus();a.equal(calls.length,mid+1);
  pol.owner='self';pol.purchasePending=true;g.updateFirstAttackWarningFocus();a.equal(calls.length,mid+1);pol.purchasePending=false;
 }
 const apply=(b)=>{const before=b.hp;d.applyAttackDamage(b,[],g.buildings,g.tanks);return {before,after:b.hp};};
 let ally=null;if(owner==='ally-first'&&allyhome){ally=apply(allyhome);g.pendingDemonFocus545=null;}
 const hit=apply(home),self={hp:hit,calls:calls.slice(),marked:g.demonAttackMarkers545?.length,seen:g.firstDemonAttackSeen545,pending:!!g.pendingDemonFocus545};
 if(patched){a.equal(calls.filter(t=>t==='恶魔正在攻击你的防线！').length,1);apply(home);a.equal(calls.filter(t=>t==='恶魔正在攻击你的防线！').length,1);}
 g.placement={type:'wall',stage:'aim',x:zone.gateX,y:zone.gateY};g.defenseWallGuideComplete=true;
 Object.assign(g.camera,{x:zone.gateX-195/g.zoom(),y:zone.gateY-474/g.zoom()});
 texts.length=cache.length=0;g.drawDefenseRecommendationGuides(g.ctx,g.defenseRecommendationSpots());
 const arrowEvidence={calls:cache.slice(),texts:texts.slice()};
 if(patched){
  a.deepEqual(cache,[true]);a(texts.includes('敌人进攻方向'));
  cache.length=texts.length=0;g.placement.type='house';g.drawDefenseRecommendationGuides(g.ctx,[]);a.equal(cache.length,0);
  g.placement.type='wall';const po=g.attackDirectionArrowBH.pose(zone);
  const block=new T.Building(po.x,po.y+40,'house',1);g.buildings.push(block);g.drawDefenseRecommendationGuides(g.ctx,[]);a.equal(cache.at(-1),false);g.buildings.pop();
  const w=g.incomingWarningDisplayMarker440({kind:'demon',zone});g.camera.x+=40;const w2=g.incomingWarningDisplayMarker440({kind:'demon',zone});a.equal(w.x,w2.x);a.equal(w.y,w2.y);
 }
 fs.writeFileSync(out,JSON.stringify({owner:owner??'default',allySlots:g.allies.length,policy:!!pol,approach,contactAtGate,secondApproach,ally,self,arrow:arrowEvidence,flags:{state:g.state,easy:g.easyOnboardingBN?.scope()}},null,2));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{host.close();fs.rmSync(disk,{recursive:true,force:true})});
