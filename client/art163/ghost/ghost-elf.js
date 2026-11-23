'use strict';
const DUR=30000,CD=60000,VITALITY=60,near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
module.exports=function install(g,{Projectile,MiniTroll,art,opened=()=>true,stick,worldW,worldH,loadSprite,ranged:rt,griffin,batFace,directionArt,canvas,constrained}){
 const appearance=require('./ghost-host-style')(canvas,constrained);
 const POSSESS_SCALE=10,STONE_POSSESS_SCALE=5;
 const bodyScale=h=>h.waveStone===true?STONE_POSSESS_SCALE:POSSESS_SCALE;
 // The green bar can change by less than one screen pixel per real hit.
 // Keep one damage readout per possessed body, never a particle per hit.
 const BODY_LOSS_MS=900,BODY_LOSS_TEXT_MS=160;
 let bodyLossOwner=null,bodyLossFrom=0,bodyLossTotal=0,bodyLossCount=0,bodyLossShown=0,bodyLossPaintAt=0,bodyLossText='';
 function clearBodyLoss(){bodyLossOwner=null;bodyLossFrom=bodyLossTotal=bodyLossCount=bodyLossShown=bodyLossPaintAt=0;bodyLossText='';}
 function recordBodyLoss(amount){
  if(!Number.isFinite(amount)||amount<=0)return;
  const now=g.supportTime||0;
  if(bodyLossOwner!==g.player||now<bodyLossFrom||now-bodyLossFrom>=BODY_LOSS_MS){
   clearBodyLoss();bodyLossOwner=g.player;bodyLossFrom=now;
  }
  bodyLossTotal+=amount;bodyLossCount++;
 }
 function drawBodyLoss(c,x,y){
  const now=g.supportTime||0,age=now-bodyLossFrom;
  if(bodyLossOwner!==g.player||g.player.dead||age<0||age>=BODY_LOSS_MS||bodyLossTotal<=0)return;
  if(!bodyLossText||bodyLossShown!==bodyLossTotal&&now>=bodyLossPaintAt){
   bodyLossShown=bodyLossTotal;bodyLossText=(bodyLossCount>1?'累计 −':'−')+(bodyLossTotal<1?bodyLossTotal.toPrecision(1):Math.round(bodyLossTotal));
   bodyLossPaintAt=now+BODY_LOSS_TEXT_MS;
  }
  const zoom=g.zoom();if(!(zoom>0))return;
  c.translate(x-5/zoom,y);c.scale(1/zoom,1/zoom);
  c.globalAlpha*=Math.min(1,(BODY_LOSS_MS-age)/200);
  c.font='bold 13px sans-serif';c.textAlign='right';c.textBaseline='middle';c.lineJoin='round';
  c.lineWidth=2.5;c.strokeStyle='#35212b';c.strokeText(bodyLossText,0,0);
  c.fillStyle='#ffc1b3';c.fillText(bodyLossText,0,0);
 }
 let host=null,aim=null,power=0,routing=false,entryCd=0,priorPlayer=null,lastX=0,lastY=0,motion=0,sprite=null,loading=false,retry=0,batCast=null,hostX=0,hostY=0,autoAt=0,delivery=null;
 function warm(){if(!loadSprite||sprite||loading||Date.now()<retry)return;loading=true;loadSprite().then(im=>{sprite=im;}).catch(()=>{retry=Date.now()+10000;}).finally(()=>{loading=false;});}
 const isGroundSlime=h=>h.waveHound&&!h.waveBat&&!h.waveGriffinBN&&!h.waveRangedTrollBN&&!h.waveMammothBN;
 const sky=h=>h?.airborne===true&&!h.batGroundedBN&&!(h.batRootBN>0)&&!h.groundNetLockedBN&&(h.waveBat||h.waveGriffinBN);
 const halted=h=>h.stoneStunLeft>0||h.groundNetLockedBN||h.batGroundedBN||h.batRootBN>0||h.cardStormStunMs>0||h.slimeFlameStun407>0;
 const activeCast=h=>batCast||h.waveStone&&h.stoneAction||h.mammothAttackBN||h.rangedTrollCastBN||h.griffinStrikeBN||h.griffinRecoverBN>0;
 const canHitAir=(source,target)=>source===host&&!!source&&(sky(source)||source.waveRangedTrollBN===true||target?.waveBat&&!sky(target));
 const interval=h=>(h.waveBat?1500:h.waveHound||h.waveGriffinBN?h.slimeAttackInterval567():h instanceof MiniTroll?800:500)*(h.attackSlowTimer>0?(h.attackSlowFactor||1):1);
 const eligible=()=>opened()&&['prep','hunt'].includes(g.state)&&!g.player.dead;
 const active=()=>eligible()&&g.player.ghostElf===true;
 const stealth=()=>active()&&(g.player.ghostStealthLeft||0)>0;
 const hidden=o=>stealth()&&(o===g.player||o===g.player.drivingTank&&o?.isRobot&&o.driver===g.player&&o.ownerSlot==null);
 function syncVital(){const p=g.player;if(opened()&&p.ghostElf===true&&!p.ghostVitalityBN&&p.maxHp>0){const ratio=Math.min(1,Math.max(0,p.hp/p.maxHp));p.maxHp+=VITALITY;p.hp=p.dead?0:p.maxHp*ratio;p.ghostVitalityBN=true;}}
 function transform(){if(!eligible()||g.player.ghostElf)return false;const p=g.player;p.ghostElf=true;syncVital();p.task=null;p.moveTarget=null;g.clearUnitNavigation(p);return true;}
 function legend(id){if(!active())return null;if(id==='collectGold')return{title:stealth()?'隐身中':'隐身',icon:'stealth',cd:stealth()?g.player.ghostStealthLeft:g.player.ghostStealthCd||0,dur:stealth()?DUR:CD,active:stealth()};
 if(id==='collectWood'&&host?.waveBat&&g.player.ghostRaidCargo)return{title:delivery?'送达中':'送达',icon:'bat',cargo:g.player.ghostRaidCargo,gather:delivery||batCast?g.player.ghostRaidCargo.gold?'gold':'wood':null};
 if(id==='collectWood')return{title:host?(host.waveStone?'咬击/投石':host.waveRangedTrollBN?'投掷':host.waveBat?'偷资源':host.waveGriffinBN?'俯冲':host.waveMammothBN?'象牙撞击':'攻击'):'附身',icon:host?(host.waveRangedTrollBN?'seed':host.waveBat?'bat':host.waveGriffinBN?'dive':host.waveMammothBN?'tusk':'attack'):'possess',cd:host?.waveStone?Math.min(host.stoneThrowLeft,host.stoneMeleeLeft):host?.attackCd||0,dur:host?.waveStone?1800:host?interval(host):1000};return null;}
 function refund(){delivery=null;const p=g.player,q=p.ghostRaidCargo;if(!q)return;for(const k of ['gold','wood'])q.owner[k]=(q.owner[k]||0)+q[k];delete p.ghostRaidCargo;}
 function clearHost(h,cd,hpScale){clearBodyLoss();if(hpScale>1){h.maxHp/=hpScale;h.hp/=hpScale;}appearance.clear();if(h.waveStone)g.stoneBossCandidate?.clearPossession(h);batCast=null;h.batGhostStrikingBN=false;h.griffinRecoverBN=0;h.attackCd=cd;h.rangedTrollCastBN=null;h.rangedTrollReleaseUntilBN=0;h.target=null;h.slimeCombatTarget539=null;h.mammothAttackBN=null;h.mammothCastBN=null;h.griffinStrikeBN=null;h.setMoveIntent(0,0);g.clearUnitNavigation(h);for(const p of g.projectiles)if(p.rangedTrollSourceBN===h)p.dead=true;}
 function restoreHost(){clearBodyLoss();syncVital();const p=g.player,saved=p.ghostPossessedStateBN;if(saved){delete p.ghostPossessedStateBN;clearHost(saved.host,saved.cd,saved.scaledBN===true?(saved.hpScale5BN===true?STONE_POSSESS_SCALE:POSSESS_SCALE):1);}refund();}
 function leave(){refund();const h=host;host=null;aim=null;if(!h)return false;delete g.player.ghostPossessedStateBN;clearHost(h,entryCd,bodyScale(h));entryCd=0;power=0;return true;}

 function button(id){if(!active())return false;
 if(host&&id==='exitTank')return leave();
 if(host&&(id==='moreBuilds'||id==='returnBase')){aim=delivery=null;return false;}
 if(id==='collectGold'){const p=g.player,v=p.drivingTank;if(host||v&&(!v.isRobot||v.ownerSlot!=null||v.driver!==p)||p.ghostStealthCd>0){g.showToast(host?'先离体再隐身':v&&!v.isRobot?'只能在驾驶自己的机器人时隐身':'隐身暂不可用');return true;}p.ghostStealthLeft=DUR;p.ghostStealthCd=CD;return true;}
 if(id==='collectWood'){if(g.player.drivingTank){g.showToast('请先离开载具再附身');return true;}if(!host)return possess();if(host.waveBat)return batRaidPress(host);aim=aim?null:'skill';if(aim)g.showToast(host.waveStone?'点敌人或恶魔城堡：近处咬击，远处投石':host.waveGriffinBN?'点小怪、恶魔或恶魔老巢俯冲':'点小怪、恶魔或恶魔老巢攻击，再点技能可取消');return true;}return !!host;}
 const valid=u=>u&&!u.dead&&u.hp>0&&u!==g.troll&&!u.dragonEvolved&&!u.waveStone&&!u.boss&&!u.isGhostCopyBN;
 const possessable=u=>valid(u)||u?.waveStone===true&&u!==g.troll&&!u.dead&&u.hp>0&&!u.isGhostCopyBN&&g.stoneBossCandidate?.enabled();
 function possess(){let target=null,d=Infinity,blocked=false;const p=g.player;
 for(const list of [g.hounds,g.miniTrolls])for(const u of list)if(possessable(u)){const n=near(u,p);if(n>220||n>=d)continue;
 if(!g.ghostPossessionLandingBN(u,sky(u))){blocked=true;continue;}d=n;target=u;}
 if(!target){g.showToast(blocked?'附近小怪的位置无法附身，请等它走到开阔处':'附近没有可附身的小怪，请靠近后再试');return true;}
 if(p.task?.type!=='build')p.task=null;p.moveTarget=null;g.clearUnitNavigation(p);target.target=null;target.slimeCombatTarget539=null;target.rangedTrollCastBN=null;target.mammothAttackBN=null;target.mammothCastBN=null;target.griffinStrikeBN=null;g.clearUnitNavigation(target);if(target.waveStone)g.stoneBossCandidate.clearPossession(target);host=target;autoAt=0;hostX=target.x;hostY=target.y;entryCd=target.attackCd||0;
 if(target.waveBat){if(target.batRetireAtBN===undefined)target.batStateBN='seek';target.batAttackSlotBN=undefined;}const scale=bodyScale(target);power=target.waveBat?0:scale*Math.max(1,(target.waveStone?target.stoneStats.damage:target.waveRangedTrollBN?rt.nativeDamage(g,target):target.getDamage())||0);target.maxHp*=scale;target.hp*=scale;g.player.ghostPossessedStateBN={host:target,cd:entryCd,scaledBN:true,hpScale5BN:scale===STONE_POSSESS_SCALE};target.attackCd=0;g.player.x=target.x;g.player.y=target.y;g.player.ghostStealthLeft=0;aim=null;if(halted(target))g.showToast('已附身，等控制效果解除后就能移动和攻击');if(target.waveBat)g.approvedGuideEventBN?.('bat',target);return true;}
 function strikeHint(text){g.showToast(text);return true;}
 const visibleY=u=>u.y-(u===g.trollBase?55:u.waveGriffinBN?(u.griffinAltitudeBN||0)+17:u.waveBat?(u.batGroundedBN?14:42):17);
 const contact=(pick,u)=>Math.hypot(u.x-pick.x,visibleY(u)-pick.y);
 const hit=(pick,u)=>u&&!u.dead&&contact(pick,u)<=Math.max(34,(u.radius||24)+12);
 function reach(h,u){return h.attackReachFor?.(u)||(h.attackRange||24)+(u.radius||0);}
 const mainFoe=u=>u===g.troll&&!!u&&!u.dead&&u.hp>0;
 const stoneFoe=u=>u&&u!==host&&(valid(u)||(u===g.troll||u===g.trollBase)&&!u.dead&&u.hp>0);
 const autoFoe=u=>u&&u!==host&&!u.dead&&u.hp>0&&!u.isGhostCopyBN&&typeof u.takeDamage==='function'&&
  (valid(u)||u.waveStone||u===g.trollBase||mainFoe(u)&&u.state!=='frozen'&&(!g.fogEnabled||g.fogStateAtWorld(u.x,u.y)===2));
 const strikeableByStone=u=>(stoneFoe(u)||autoFoe(u)&&u.waveStone)&&!sky(u);
 const ray={radius:2};
 function autoLine(h,t){
  if(!autoFoe(t)||((t.waveBat||sky(t))&&!canHitAir(h,t)))return false;
  if(g.demonLineBlocked?.(h,t,ray.radius,true))return false;
  const blocker=g.slimeBlockingBuilding410?.(ray,h,t);return !blocker||blocker===t;
 }
 function autoStrike(h){
  if(aim||h.waveBat||activeCast(h)||g.placement||g.player.task?.type==='build')return;
  const stone=g.stoneBossCandidate;
  if(h.waveStone?!(stone?.possessedMeleeReach)||h.stoneMeleeLeft>0||g.player.stickDriven||g.player.task?.type==='returnBase512':h.attackCd>0)return;
  const now=g.supportTime||0;if(now<autoAt)return;autoAt=now+120;
  let best=null,d=Infinity;
  function consider(t){
   if(!autoFoe(t)||((t.waveBat||sky(t))&&(h.waveStone||!canHitAir(h,t))))return;
   const x=t.x-h.x,y=t.y-h.y,n=x*x+y*y;if(n>=d)return;
   const r=h.waveStone?stone.possessedMeleeReach(h,t):h.waveGriffinBN?(t.radius||0)+63:h.waveRangedTrollBN?rt.reach(t,210):reach(h,t);
   if(!(r>0)||n>r*r||(h.waveRangedTrollBN?!rt.position(g,h,t):!autoLine(h,t)))return;
   d=n;best=t;
  }
  const batch=g.hostilesNear200?.(h.x,h.y,210,g.hounds,true)||g.hounds;
  for(const t of batch)consider(t);
  for(const t of g.miniTrolls)consider(t);
  consider(g.troll);consider(g.trollBase);
  if(!best||!(attackValue(h,best)>0))return;
  if(h.waveStone){if(!stone.possessedAttack(h,best)&&h.stoneAction)h.stoneAction.ghostAutoBN=true;return;}
  if(h.waveGriffinBN){if(griffin?.possessedStrike(g,h,best,best!==g.trollBase))h.griffinStrikeBN.ghostAutoBN=true;return;}
  if(h.waveRangedTrollBN){rt.start(g,h,best,interval(h));return;}
  if(h.waveMammothBN){if(!g.mammothCandidate?.startAttack(h,best))return;h.mammothAttackBN.ghostAutoBN=true;}
  else{face(h,best.x-h.x,best.y-h.y);h.playAction('bite',h instanceof MiniTroll?240:420);best.takeDamage(attackValue(h,best),h);}
  h.attackCd=interval(h);
 }
 function pointEnemy(p){
  const demon=g.troll,castle=g.trollBase;
  let best=hit(p,castle)?castle:null,d=best?contact(p,best):Infinity;
  if(!host.waveBat&&mainFoe(demon)&&(!g.fogEnabled||g.fogStateAtWorld(demon.x,demon.y)===2)){
   const x=p.x-demon.x,y=p.y-demon.y,r=demon.radius||34;
   const torso=demon.dragonEvolved?109:demon.evolved?48:28;
   const foot=Math.hypot(x,y+12),body=Math.hypot(x,y+torso);
   const n=Math.min(foot,body);
   if(n<d&&(foot<=r+12||(demon.dragonEvolved?(x/61)**2+((y+torso)/88)**2<=1:body<=r+12))){best=demon;d=n;}
  }
  for(const list of [g.hounds,g.miniTrolls])for(const u of list){
  if(u===host||!valid(u))continue;
  const n=contact(p,u);if(n<d&&n<=Math.max(34,(u.radius||24)+12)){best=u;d=n;}
 }return best;}
 const raidRange=t=>Math.max(90,(t.radius||40)+28);
 function batRaidPress(h){
  aim=null;
  if(g.player.ghostRaidCargo){
   if(delivery){delivery=null;return strikeHint('已取消自动送达，资源仍在携带中');}
   const home=raidHome();if(!home)return strikeHint('自己的基地不可用，资源仍在携带中');
   g.player.takeOverManual();g.manualCamera394=false;delivery=home;return true;
  }
  if(halted(h))return strikeHint('当前被控制，解除后才能偷资源');
  if(h.attackCd>0||activeCast(h))return strikeHint('技能正在冷却');
  let target=null,owner=null,best=Infinity;
  function consider(t,o){if(!t||t.dead||!o||o.dead&&t!==g.trollBase||o.defected||!(o.gold>0||o.wood>0))return;
   const d=near(h,t);if(d<=raidRange(t)&&d<best){best=d;target=t;owner=o;}}
  consider(g.trollBase,g.troll);
  for(const b of g.buildings)if(b.type==='warehouse'&&b.ownerSlot!=null&&!b.dead&&near(h,b)<=raidRange(b)&&g.completedElfBuildingBN(b))
   consider(b,g.allies.find(o=>o.slot===b.ownerSlot));
  if(!target)return strikeHint('靠近恶魔老巢或有资源的队友仓库，再点偷资源');
  startBat(h,target,owner);return true;
 }
 function startBat(h,t,owner){batFace?.(h,t.x-h.x,t.y-h.y);h.batAttackStartBN=h.batTimeBN||0;h.batGhostStrikingBN=true;batCast={target:t,owner,hit:false};h.attackCd=interval(h);h.setMoveIntent(0,0);}
 function batRaidLimits(){
  let mines=0,workers=0;
  for(const b of g.buildings)if(b.type==='goldMine'&&b.ownerSlot==null&&b.goldOutput>0&&b.goldInterval>0&&g.completedElfBuildingBN(b))mines++;
  for(const w of g.peasants){
   if(w.ownerSlot!=null||w.dead||!(w.hp>0)||w.inTank||w.tankEscapeTime>0||w.storageWaiting)continue;
   const task=w.task;if(task?.type!=='wood')continue;
   if(task.phase==='return'?w.carryWood>0:
    (task.phase==='goto'||task.phase==='collect')&&task.target&&!task.target.dead&&!task.target.isGuard&&task.target.wood>0)workers++;
  }
  return{gold:100+Math.floor(1175*Math.min(20,mines)/20),wood:60+Math.floor(1977*Math.min(100,workers)/100)};
 }
 function tickBat(h,dt){
  h.batTimeBN=(h.batTimeBN||0)+dt;h.batGroundedBN=h.batRootBN>0||h.groundNetLockedBN===true;
  h.batNetImmuneBN=Math.max(0,(h.batNetImmuneBN||0)-dt);h.batNetVisualBN=Math.max(0,(h.batNetVisualBN||0)-dt);
  if(!batCast)return;
  const a=batCast,t=a.target,age=h.batTimeBN-h.batAttackStartBN;
  if(halted(h)){batCast=null;h.batGhostStrikingBN=false;return;}
  if(!a.hit&&age>=330){
   a.hit=true;
   if(!t||t.dead||near(h,t)>raidRange(t))return;
   const p=g.player,owner=a.owner;if(p.ghostRaidCargo||owner.defected||(t===g.trollBase?owner!==g.troll:owner.dead||owner.slot!==t.ownerSlot||!g.completedElfBuildingBN(t)))return;
   const limits=batRaidLimits(),pack={owner,gold:0,wood:0};
   for(const k of ['gold','wood']){const available=owner[k],n=Number.isFinite(available)?Math.min(Math.max(0,available),limits[k]):0;if(n>0){owner[k]-=n;pack[k]=n;}}
   if(pack.gold||pack.wood){p.ghostRaidCargo=pack;g.showToast('已取得资源，点送达自动回自己的基地');}else g.showToast('这里没有可劫掠的资源');
  }
  if(age>=780){batCast=null;h.batGhostStrikingBN=false;}
 }
 function tap(p){
  if(!active())return false;
  const h=host;if(!h||h.dead)return false;
  const b=g.findBuildingAt(p.x,p.y);
  // A real clicked monster takes precedence during deliberate attack aiming, but empty ground
  // over the player’s own building still opens its native menu regardless of aim.
  const t=aim?pointEnemy(p):null;
  if(!t&&b&&b.ownerSlot==null){aim=null;return false;}
  if(!aim)return true;
  if(halted(h))return strikeHint('当前被控制，解除后才能使用');
  if(h.attackCd>0||activeCast(h))return strikeHint('技能正在冷却');
  if(h.waveStone){
   if(!t)return strikeHint('请点击敌人或恶魔城堡');
   if(sky(t))return strikeHint('石头人打不到飞行小怪，请换目标');
   const reason=g.stoneBossCandidate?.possessedAttack(h,t);if(reason)return strikeHint(reason);
  }else if(h.waveGriffinBN){
   if(!t||!griffin?.possessedStrike(g,h,t,t!==g.trollBase))return strikeHint('靠近后再点小怪、恶魔或恶魔老巢俯冲');
  }else{
   if(!t)return strikeHint('请点击要攻击的小怪、恶魔或恶魔老巢');
   if((t.waveBat||sky(t))&&!canHitAir(h,t))return strikeHint('地面近战打不到飞行小怪，请换目标');
   if(h.waveRangedTrollBN){if(!rt.start(g,h,t,interval(h)))return strikeHint('目标太远或路径被障碍挡住');}
   else{
    if(near(h,t)>reach(h,t))return strikeHint('目标太远，靠近后再攻击');
    if(g.demonLineBlocked?.(h,t,2,true)||g.slimeBlockingBuilding410?.({radius:2},h,t))return strikeHint('攻击路径被挡住');
    if(h.waveMammothBN){if(!g.mammothCandidate?.startAttack(h,t))return strikeHint('象牙撞击暂不可用');}
    else{face(h,t.x-h.x,t.y-h.y);h.playAction('bite',h instanceof MiniTroll?240:420);t.takeDamage(attackValue(h,t),h);}
    h.attackCd=interval(h);
   }
  }
  aim=null;return true;
 }
 function face(h,dx,dy){
  if(Math.abs(dx)>.4)h.facing=dx<0?-1:1;
  if(Math.abs(dy)>.4)h.facingV=dy<0?-1:1;
  if(!h.moving&&Math.abs(dx)+Math.abs(dy)>.4)h.sideways=Math.abs(dx)>Math.abs(dy);
 }
 const raidHome=()=>g.buildings.find(b=>b.isInitialBase&&b.ownerSlot==null&&g.completedElfBuildingBN(b));
 function step(dt){if(!active()){if(host||aim)leave();return;}const p=g.player;if(!p.ghostVitalityBN)syncVital();for(const key of ['ghostStealthLeft','ghostStealthCd'])if(p[key]>0)p[key]=Math.max(0,p[key]-dt);if(host?.dead||host&&p.drivingTank)leave();if(host){hostX=host.x;hostY=host.y;entryCd=Math.max(0,entryCd-dt);p.ghostPossessedStateBN.cd=entryCd;if(p.task?.type!=='build'&&p.task?.type!=='returnBase512'){p.task=null;p.moveTarget=null;}}
 if(host?.waveBat&&p.ghostRaidCargo){const home=raidHome();
 if(delivery&&delivery!==home){delivery=null;strikeHint('基地不可用，已停止送达');}
 if(home&&near(host,home)<Math.max(68,(home.radius||30)+20)){const cargo=p.ghostRaidCargo;for(const k of ['gold','wood']){const max=p[k==='gold'?'maxGold':'maxWood'],n=Math.min(cargo[k],Math.max(0,max-p[k]));p[k]+=n;cargo[k]-=n;}refund();g.showToast('劫掠资源已交付');}}
 if(p.task&&['gold','wood'].includes(p.task.type))p.task=null;}
 function driveStick(v){const h=host;if(!h)return v;const moving=v&&(v.dx||v.dy);if(moving)delivery=null;
  // A travel command overrides background swings and the recovery of an attack already released.
  const a=h.waveStone&&h.stoneAction,task=g.player.task?.type;
  if(a&&(a.ghostAutoBN||a.fired)&&(moving||task==='build'||task==='returnBase512')&&!halted(h)){h.stoneAction=null;h.target=null;}
  if(!v)return v;if(halted(h)||activeCast(h))return {dx:0,dy:0};return v;}
 function controlledUpdate(dt,v){
  const h=host,p=g.player;if(!h)return false;
  const fly=sky(h),speed=p.speed*h.movementSlowMultiplier();
  const busy=halted(h)||activeCast(h),manual=!!(v&&(v.dx||v.dy)&&Number.isFinite(speed)&&speed>0),r=p.radius,s=p.speed;
  let dx=0,dy=0;
  p.radius=h.radius;p.speed=speed;
  try{
   if(manual){p.takeOverManual();dx=v.dx*speed;dy=v.dy*speed;}
   else if(delivery&&!busy&&fly&&speed>0){const x=delivery.x-h.x,y=delivery.y-h.y,f=Math.min(1,speed/Math.hypot(x,y));dx=x*f;dy=y*f;}
   else if(!busy&&p.task?.type==='returnBase512'&&Number.isFinite(speed)&&speed>0){
    g.updatePlayerTravel512(null);const goal=p.moveTarget;
    if(goal){const x=goal.x-h.x,y=goal.y-h.y,d=Math.hypot(x,y);if(d>.01){const k=Math.min(d,speed)/d;dx=x*k;dy=y*k;}}
   }
   if(dx||dy){h.setMoveIntent(dx,dy);
    if(fly){h.x=Math.max(h.radius,Math.min(worldW-h.radius,h.x+dx));h.y=Math.max(h.radius,Math.min(worldH-h.radius,h.y+dy));}
    else h.moveByTerrain(dx,dy,true);
    p.x=h.x;p.y=h.y;
   }
   // Player health and the normal construction authorization still run on the player, not the enemy.
   p.moveTarget=null;p.update(dt,g.buildings,null);p.stickDriven=manual;g.updateFogOfWar(dt);
   if(!busy&&p.task?.type==='build')g.updatePlayerBuild506(dt);
  }finally{p.radius=r;p.speed=s;}
  return true;
 }
 function syncBody(dt){
  const p=g.player;if(!p.ghostElf){motion=0;priorPlayer=null;return;}
  const moved=priorPlayer===p&&Math.hypot(p.x-lastX,p.y-lastY)>.06;motion=moved?motion+dt:0;
  priorPlayer=p;lastX=p.x;lastY=p.y;if(!host)return;
  const h=host,dx=p.x-hostX,dy=p.y-hostY;h.x=p.x;h.y=p.y;h.setMoveIntent(dx,dy);
  if(h.waveStone)g.stoneBossCandidate?.possessedWalk(h,dx,dy,dt);
  if(h.waveMammothBN)g.mammothCandidate?.possessedWalk(h,hostX,hostY,dt);
  if(h.waveGriffinBN)griffin?.face?.(h,dx,dy);else if(h.waveBat)batFace?.(h,dx,dy);
 }
 function hostTick(h,dt){if(h!==host)return false;if(h.dead||!active()){leave();return true;}
  if(h.waveStone)h.stoneStunLeft=Math.max(0,(h.stoneStunLeft||0)-dt);
  h.batRootBN=Math.max(0,(h.batRootBN||0)-dt);h.moveSlowTimer=Math.max(0,(h.moveSlowTimer||0)-dt);h.attackSlowTimer=Math.max(0,(h.attackSlowTimer||0)-dt);
  const storm=g.cardsCandidate?.consumeStormStun(h,dt);
  if(!h.waveBat&&!h.waveStone&&(h.waveHound||h.waveGriffinBN)){
   h.slimeFlameStun407=Math.max(0,(h.slimeFlameStun407||0)-dt);h.finishFlameStunBN?.(g.supportTime||0);
  }
  if(h.waveStone){const ready=!storm&&!halted(h);g.stoneBossCandidate?.possessedTick(h,dt,ready,strikeableByStone);if(ready)autoStrike(h);return true;}
  if(h.waveBat){if(storm){batCast=null;h.batGhostStrikingBN=false;}tickBat(h,dt);}
  if(storm||halted(h)){
   h.rangedTrollCastBN=null;h.griffinStrikeBN=null;h.mammothAttackBN=null;
   h.attackCd=Math.max(0,(h.attackCd||0)-dt);
   if(h.waveGriffinBN&&!storm)griffin?.possessedTick(g,h,dt,null,worldW,worldH);
   return true;
  }
  if(isGroundSlime(h))h.slimeHop=((h.slimeHop||0)+dt)%900;
  if(h.mammothAttackBN){g.mammothCandidate?.tickAttack(h,dt,h.mammothAttackBN.ghostAutoBN?autoLine:null);return true;}
  h.attackCd=Math.max(0,(h.attackCd||0)-dt);
  if(h.rangedTrollCastBN){rt.tickCast(g,h,dt,Projectile,art());return true;}
  if(h.waveGriffinBN)griffin?.possessedTick(g,h,dt,null,worldW,worldH,h.griffinStrikeBN?.ghostAutoBN?autoLine:null);
  autoStrike(h);return true;
 }
 function receive(h,amount,source){
  if(h!==host||routing)return false;
  if(g.elfRewardOwnerSlot(source)!==undefined)return true;
  const before=h.hp;
  routing=true;try{h.takeDamage(amount,source);}finally{
   routing=false;if(host===h){if(h.dead)leave();else recordBodyLoss(before-h.hp);}
  }
  return true;
 }
 function attackValue(h,t){return h===host?power:undefined;}
 // Recolor the authored pose, then stack real player and body health above its head.
 function drawHost(c,h,draw=h.draw){
  const head=appearance.draw(c,h,ctx=>draw.call(h,ctx,h.waveHound)),p=g.player;
  const fallback=h.waveGriffinBN?(h.griffinAltitudeBN||0)+68:h.waveStone?131:h.waveMammothBN?(h.waveMonsterEvolutionStageBN===2?126:102):h.waveBat?96:h.waveRangedTrollBN?63:h.waveHound?31*(h.slimeVisualScale568?.()||1):53;
  const y=(head??h.y-fallback)-11,w=h.waveStone?54:h.waveMammothBN?46:38,x=h.x-w/2;
  const q=Math.max(0,Math.min(1,p.hp/p.maxHp)),r=Math.max(0,Math.min(1,h.hp/h.maxHp));
  c.save();c.fillStyle='#312143';c.fillRect(x,y,w,4);c.fillStyle='#ca88f2';c.fillRect(x,y,w*q,4);
  c.fillStyle='#25352a';c.fillRect(x,y+6,w,4);c.fillStyle='#75c35d';c.fillRect(x,y+6,w*r,4);drawBodyLoss(c,x,y+8);c.restore();
 }
 function clearTarget(o){if(hidden(o.target)){o.target=null;g.clearUnitNavigation(o);}}
 function paint(c,o,draw){if(host&&o===g.player)return;if(!hidden(o)&&!(active()&&o===g.player&&!o.drivingTank))return draw();c.save();try{if(hidden(o))c.globalAlpha*=.29;if(o===g.player&&!o.drivingTank){
 const lift=motion?12+Math.sin(motion*.009)*1.7:12;
 if(!sprite)warm();
 if(directionArt?.()?.drawElf(c,o,lift,motion,sprite))return;
 if(sprite){c.save();c.translate(o.x,o.y-12);if(o.facing<0)c.scale(-1,1);c.drawImage(sprite,0,0,64,72,-32,-64,64,72);c.restore();return;}
 c.translate(0,-lift);
 }return draw();}finally{c.restore();}}
 // Followers have their own native class/list; use the same controlled body rendering and HP routing.
 if(MiniTroll){
  const proto=MiniTroll.prototype,damage=proto.takeDamage,draw=proto.draw;
  proto.takeDamage=function(amount,source){
   if(this===host&&Number.isFinite(amount)&&amount>0&&!this.dead&&receive(this,amount,source))return;
   return damage.call(this,amount,source);
  };
  proto.draw=function(c){if(this!==host)return draw.call(this,c);drawHost(c,this,draw);};
 }
 const attackers=(list)=>host?list.filter(o=>o!==host):list;
 const targets=(list)=>stealth()?list.filter(o=>!hidden(o)):list;
 return g.ghostElfAPI={restoreHost,driveStick,controlledUpdate,syncBody,receive,hitHost:(p,n,s)=>p===g.player&&!!host&&receive(host,n,s),hostFell:h=>h===host&&leave(),canHitAir,attackValue,drawHost,tintStats:appearance.stats,clearTarget,refund,canTransform:()=>eligible()&&!g.player.ghostElf,transform,legend,button,tap,step,hostTick,paint,attackers,targets,hidden,leave,stealth,get host(){return host;},get aim(){return aim;}};
};
