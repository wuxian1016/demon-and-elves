'use strict';
// Optional Easy solo advice. Camera nudges are opening-only; advice never blocks input or alters enemies.
const {CARD_DEFS}=require('./card-ui');
const {MAGIC_TOWER_DAMAGE_MULTIPLIER}=require('./stone-boss-candidate');
const GROUND_TOWERS=['tower','cannonTower','iceTower','manaTower'];
const TOWER_LESSONS=[
 ['tower',1,'箭塔','持续打单体，适合落单的敌人。'],
 ['antiAirTowerBN',5,'防空塔','专打飞行怪，防第8波蝙蝠。'],
 ['netTowerBN',6,'捕网塔','先网飞怪，没飞怪就网地面；蝙蝠落地后其他塔也能打。'],
 ['iceTower',2,'冰霜塔','减攻速，适合压住恶魔和近战怪。'],
 ['manaTower',3,'魔法光塔',`优先打石头人，伤害 ×${MAGIC_TOWER_DAMAGE_MULTIPLIER}；也能耗恶魔魔力。`],
 ['watchtower',4,'哨塔','自己不攻击，强化附近防御塔。'],
 ['altar',4,'祭坛','自己不攻击，给附近精灵和建筑回血。'],
 ['cannonTower',2,'炮塔','范围爆炸，适合成群的史莱姆。'],
];
const REFRESH_MS=240,HINT_MS=6000,ECONOMY_HINT_MS=3200;
function install(g,{offline,catalog=[],tankCost,peasantCost={wood:15,gold:5},peasantLevel=3}){
 if(g.easyOnboardingBN||!tankCost)return;
 const entries=new Map(catalog.map(e=>[e.type,e]));
 const scope=()=>offline()===true&&!g.networkDrawCamera627&&!g.superChallenge580&&g.guidedEasySoloMode?.()===true;
 const active=()=>scope()&&['prep','hunt'].includes(g.state)&&g.player&&!g.player.dead&&!g.player.defected;
 const clock=()=>g.supportTime||0;
 let normalHint=null,normalHintPlayer=null,normalNext=0,normalUntil=0,normalLast=-Infinity;
 let lastPlayer,countedState,lastWood=0,lastGold=0,dirty=true,stamp=-Infinity,current=null,shown=null,cardSession=null,dragStarted=null,targetPan=null,focusedTarget=null,focusedStep=null,harvestLesson=null;
 const persist=()=>{
  let s=g.easyOpeningGuideStateBN;
  if(!s||s.version!==1){
   const stage=Math.floor(g.easyOpeningGuideStage||0),old=g.developmentGuide396;
   s=g.easyOpeningGuideStateBN={version:1,wall:stage>=2,tower:stage>=3,wood:g.easyEconomyReady===true,gold:stage>=1||g.easyEconomyReady===true,
    tank:g.easyOpeningGuideDone===true||Number.isFinite(old?.firstTankAt),freeSeen:g.easyOpeningGuideDone===true,upgradeSeen:g.easyOpeningGuideDone===true,robotSeen:g.easyOpeningGuideDone===true};
  }
  if(lastPlayer!==g.player||countedState!==s){lastPlayer=g.player;countedState=s;lastWood=g.player.wood;lastGold=g.player.gold;current=shown=cardSession=dragStarted=targetPan=focusedTarget=focusedStep=harvestLesson=null;stamp=-Infinity;dirty=true;}
  return s;
 };
 const done=b=>b&&!b.dead&&b.hp>0&&b.ownerSlot==null&&!b.preview&&!b.isPreview&&!b.underConstruction&&!(b.buildTime>0&&b.buildProgress<b.buildTime);
 const goal=(phase,key,title,detail='',more={})=>({onboardingBN:true,easyModernBN:true,optional:true,phaseBN:phase,key396:'easy-bn:'+key,step:'easy-bn:'+key,title,detail,...more});
 const build=(phase,type,title,detail,more)=>goal(phase,'build:'+type,title,detail,{type,...more});
 const up=(phase,b,title,detail)=>goal(phase,'upgrade:'+b.type+':'+b.level,title,detail,{target:b,upgrade:true});
 const workerGoal=(home,detail='自动采木，持续补充收入。')=>goal('economy','lumber-worker','制造伐木工',detail,{target:home,action:'makePeasantBtn',smallPointerBN:true});
 function populationGoal(owned,p,affordable){
  const homes=owned.filter(b=>b.type==='houseForPeasants');
  const next=homes.find(b=>b.canUpgrade?.()&&!g.buildingUpgradeBlockReason(b)&&(!affordable||(b.upgradeCost()?.wood<=p.wood&&b.upgradeCost()?.gold<=p.gold)));
  if(next)return {...up('economy',next,'升级房屋','人口满了，先增加人口。'),smallPointerBN:true};
  const entry=entries.get('houseForPeasants');
  if(entry&&!g.buildingCountBlockReason(entry.type)&&g.isBuildUnlocked(entry)&&(!affordable||(entry.wood<=p.wood&&entry.gold<=p.gold)))
   return build('economy',entry.type,'建造房屋','人口满了，先增加人口。',{smallPointerBN:true});
  return null;
 }
 const gatherControl=key=>key==='wood'?'collectWood':'collectGold';
 const acknowledged=id=>countedState?.controls?.[id]===true;
 const gathering=key=>{const p=g.player;return p.task?.type===key||(p.task?.type==='build'&&(p.buildQueueResumeBN?.type===key||p.task.resumeGatherBN?.type===key));};
 const gather=(phase,key,label)=>goal(phase,'gather:'+key,key==='wood'?'点「伐木」':'点「采矿」',label,{button:gatherControl(key),resourceDeficitBN:true});
 function plan(s){
  const owned=g.ownerBuildings().filter(done),find=type=>owned.find(b=>b.type===type),homes=owned.filter(b=>b.type==='house');
  let home=null;for(const b of homes)if(!home||b.level>home.level)home=b;
  const tank=g.tanks.find(t=>t&&!t.dead&&t.hp>0&&t.ownerSlot==null&&!t.isRobot),robot=g.tanks.find(t=>t&&!t.dead&&t.hp>0&&t.ownerSlot==null&&t.isRobot);
  s.wall||=!!find('wall');s.tower||=owned.some(b=>GROUND_TOWERS.includes(b.type)&&!b.airDefenseKindBN);
  s.wood||=g.player.wood>lastWood||g.getPeasantCount()>0;s.gold||=g.player.gold>lastGold||!!find('goldMine');s.tank||=!!(tank||robot);
  lastWood=g.player.wood;lastGold=g.player.gold;
  const dismiss=key=>({hintOnceBN:key});
  const pending=g.getPlayerBuildQueueBN?.()||[];
  const builtOrPending=type=>!!find(type)||pending.some(j=>j.buildType===type);
  const canSuggest=type=>{const row=entries.get(type);return row&&g.isBuildUnlocked(row)&&g.player.wood>=row.wood&&g.player.gold>=row.gold&&(!g.placement||g.placement.type===type);};
  const canUpgrade=b=>!!b&&b.canUpgrade?.()&&!g.buildingUpgradeBlockReason(b);
  const affordable=c=>!!c&&g.player.wood>=c.wood&&g.player.gold>=c.gold;
  const optionalValid=a=>a.target?done(a.target)&&canUpgrade(a.target)&&a.target.level===a.towerLevelBN&&affordable(a.target.upgradeCost()):!builtOrPending(a.type)&&canSuggest(a.type);
  const wave=Math.max(0,g.waveNumber||0);
  // A damaged wall takes priority over optional lessons, never purchases automatically.
  const wall=g.state==='hunt'&&g.criticalPlayerWall399?.();
  if(wall){
   const cost=canUpgrade(wall)&&wall.upgradeCost();
   if(affordable(cost))return {...up('defense',wall,'城墙告急，升级城墙','升级后恢复城墙血量。'),urgentWallBN:true,lateArrowBN:s.tank===true};
   if(cost){
    const wood=Math.max(0,cost.wood-g.player.wood),gold=Math.max(0,cost.gold-g.player.gold);
    return goal('defense','wall-critical-materials','城墙残血，升级缺材料',[wood&&'木 '+Math.ceil(wood),gold&&'金 '+Math.ceil(gold)].filter(Boolean).join('、'),{wait:true});
   }
   if(!pending.some(j=>j.buildType==='wall')&&canSuggest('wall'))return build('defense','wall','城墙残血，补一道城墙','当前这面墙暂不能升级。',{lateArrowBN:s.tank===true,urgentWallBN:true});
  }
  if(shown?.goal.tradeLessonBN){
   const a=shown.goal,t=a.target;
   if(clock()-shown.at<14500&&(!t||done(t))&&(!a.type||!builtOrPending(a.type)&&canSuggest(a.type)))return a;
   shown=null;
  }
  if(!s.tank&&s.wall&&s.tower&&find('goldMine')&&find('warehouse')&&home?.level>=3&&g.state==='hunt'){
   const p=g.player,shop=find('exchange'),woodLow=p.wood<Math.min(60,p.maxWood*.25),goldLow=p.gold<Math.min(50,p.maxGold*.25);
   const preferred=woodLow&&!goldLow?'goldToWood':goldLow&&!woodLow?'woodToGold':null;
   const dirs=preferred?[preferred]:['goldToWood','woodToGold'];
   const key='guideExchangeUseBN';
   if(shop&&!s[key]){
    const d=dirs.find(d=>!g.exchangeBlockReason(shop,d,g.exchangeSelectedBatches(d,shop)));
    if(d){
     const gold=d==='goldToWood',actionLabel=gold?'金币换木材':'木材换金币';
     return goal('economy','exchange-use','用交易所换资源','木材和金币可以 1:1 双向兑换。',{target:shop,action:gold?'exchangeGoldToWoodBtn':'exchangeWoodToGoldBtn',actionLabel,tradeLessonBN:true,...dismiss(key)});
    }
   }
   if(!shop&&!s.guideExchangeBuildBN&&!builtOrPending('exchange')&&canSuggest('exchange')&&(preferred||wave===4||wave>10)){
    return build('economy','exchange','可建交易所','木材和金币可以 1:1 双向兑换。',{tradeLessonBN:true,towerRoleBN:'木材和金币可以 1:1 双向兑换。',...dismiss('guideExchangeBuildBN')});
   }
  }
  if(shown?.goal.infoOnlyBN&&clock()-shown.at<6500)return shown.goal;
  if(!s.tank&&g.state==='hunt'&&wave>=9&&wave<=10&&!s.guideStoneCounterBN&&s.wall&&s.tower){
   const role=`魔法光塔优先打石头人，伤害 ×${MAGIC_TOWER_DAMAGE_MULTIPLIER}。`,b=find('manaTower'),opts={...dismiss('guideStoneCounterBN'),sideHintBN:true,towerRoleBN:role};
   if(!b&&!builtOrPending('manaTower')&&canSuggest('manaTower'))return build('defense','manaTower','石头人来袭，建魔法光塔',role,opts);
   if(b&&canUpgrade(b)&&affordable(b.upgradeCost()))return {...up('defense',b,'升级魔法光塔，对付石头人',role),...opts,towerLevelBN:b.level};
   return goal('defense','stone-counter','石头人怕魔法光塔',role,{...opts,sideHintBN:false,infoOnlyBN:true});
  }
  if(shown?.goal.sideHintBN){if(clock()-shown.at<6800&&optionalValid(shown.goal))return shown.goal;shown=null;}
  if(!s.tank&&s.wall&&s.tower&&g.state==='hunt'&&clock()>=(s.nextTowerHintBN||0)){
   for(const [type,since,name,role] of TOWER_LESSONS){
    if(wave<since||((type==='antiAirTowerBN'||type==='netTowerBN')&&wave>9))continue;
    const b=find(type);
    if(!b&&!builtOrPending(type)&&canSuggest(type)&&!s['guideBuild:'+type])return build('defense',type,'可建'+name,role,{...dismiss('guideBuild:'+type),sideHintBN:true,towerRoleBN:role});
    if(b&&b.level<2&&canUpgrade(b)&&affordable(b.upgradeCost())&&!s['guideUpgrade:'+type])return {...up('defense',b,'可升级'+name,role),...dismiss('guideUpgrade:'+type),sideHintBN:true,towerRoleBN:role,towerLevelBN:b.level};
   }
  }
  function lateAdvice(){
   if(g.state!=='hunt')return null;
   const midOwns=g.midEconomyGuideR13?.ownsLatePlan?.();
   const p=g.player,now=clock(),safety=p.maxWood>0&&p.maxGold>0;
   const recent=s.lateGuideSeenBN||{};
   const canBuild=type=>canSuggest(type)&&!g.buildingCountBlockReason(type)&&!pending.some(j=>j.buildType===type);
   const okCost=b=>canUpgrade(b)&&affordable(b.upgradeCost());
   const mark=(a,k)=>({...a,lateArrowBN:true,lateCueKeyBN:k});
   const expand=(type,title,detail)=>canBuild(type)?mark(build('economy',type,title,detail),'build:'+type):null;
   const raise=(phase,b,title,detail)=>okCost(b)?mark(up(phase,b,title,detail),'upgrade:'+b.type+':'+b.level):null;
   const defense=(type,title,detail)=>canBuild(type)?mark(build('defense',type,title,detail),'build:'+type):null;
   const open=a=>a&&!((recent[a.lateCueKeyBN]??-Infinity)+85000>now);
   if(shown?.goal.lateCueKeyBN){
    const a=shown.goal,still=a.target?(done(a.target)&&(!a.upgrade||okCost(a.target)&&a.key396.endsWith(':'+a.target.level))&&(!a.action||!g.peasantBlockReason(a.target))):canBuild(a.type);
    if(now-shown.at<7800&&still)return a;
    shown=null;
   }
   if(now<(s.nextLateGuideBN||0))return null;
   const walls=owned.filter(b=>b.type==='wall'),towers=owned.filter(b=>GROUND_TOWERS.includes(b.type)&&!b.airDefenseKindBN);
   const mines=owned.filter(b=>b.type==='goldMine'),depots=owned.filter(b=>b.type==='warehouse');
   const needHigh=Math.min(6,2+Math.floor(wave/5));
   const enemyAir=wave%10>=5&&wave%10<=8;
   const damaged=walls.filter(b=>b.hp/b.maxHp<.72).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp).find(okCost);
   const weakWall=walls.filter(b=>b.level<needHigh).find(okCost);
   const weakTower=towers.filter(b=>b.level<needHigh).find(okCost);
   const canUseHome=home&&home.level>=peasantLevel;
   const lowGold=safety&&p.gold<Math.min(420,p.maxGold*.43),lowWood=safety&&p.wood<Math.min(360,p.maxWood*.39);
   const nearCap=safety&&(p.wood/p.maxWood>=.84||p.gold/p.maxGold>=.84);
   const pop=g.getPeasantCount(),cap=g.getPeasantCap();
   const options=[
    raise('defense',damaged,'升级受损城墙','恢复城墙血量。'),
    !walls.length&&defense('wall','补回路口城墙','墙在前，塔在后。'),
    enemyAir&&!owned.some(b=>b.airDefenseKindBN==='antiAir')&&defense('antiAirTowerBN','补防空塔','准备迎战蝙蝠。'),
    towers.length<2&&defense('cannonTower','补一座防御塔','放在城墙后。'),
    nearCap&&(raise('economy',depots.find(okCost),'升级仓库','快满仓了，增加容量。')||expand('warehouse','增建仓库','增加木材与金币容量。')),
    !midOwns&&lowGold&&mines.length>=2&&raise('economy',mines.find(okCost),'升级金矿厂','提高产金速度。'),
    !midOwns&&lowGold&&mines.length<4&&expand('goldMine','增建金矿厂','补足金币收入。'),
    !midOwns&&lowWood&&canUseHome&&pop>=cap&&pop<16&&(()=>{const a=populationGoal(owned,p,true);return a?mark(a,a.upgrade?'upgrade:population:'+a.target.level:'build:population'):null;})(),
    !midOwns&&lowWood&&canUseHome&&pop<Math.min(cap,12)&&!g.peasantBlockReason(home)&&mark(workerGoal(home,'补足木材收入。'),'wood-worker'),
    raise('defense',weakWall,'升级城墙','强化前线防御。'),
    raise('defense',weakTower,'升级'+(g.buildingName(weakTower?.type||'tower')),'提高防御火力。'),
    towers.length<Math.min(7,3+Math.floor(wave/5))&&defense('cannonTower','增建炮塔','用范围火力清怪。'),
    !midOwns&&mines.length<2&&expand('goldMine','增建金矿厂','为之后的升级补收入。')
   ];
   return options.find(open)||null;
  }
  if(s.tank){
   // Only these optional messages have a UI lifetime. Progression never waits for one.
   if(shown&&shown.goal.phaseBN==='free'&&clock()-shown.at<HINT_MS)return shown.goal;
   if(shown?.goal.phaseBN==='free')shown=null;
   const next=lateAdvice();if(next)return next;
   if(!tank&&!robot)return null;
   const lab=find('tankLab'),robotFactory=find('robotFactory'),canRobot=g.robotUnlocked?.()===true;
   if(!s.robotSeen&&tank&&!robot&&canRobot){
    if(robotFactory)return goal('free','robot','可以改造机器人','把坦克开到机器人工厂附近。',{...dismiss('robotSeen'),target:robotFactory,action:'robotFactoryBtn'});
    if(g.isBuildUnlocked(entries.get('robotFactory')))return build('free','robotFactory','机器人工厂已解锁','有需要时可把坦克改成机器人。',dismiss('robotSeen'));
   }
   if(!s.upgradeSeen&&tank){
    if(lab)return goal('free','upgrade-tank','坦克还可研发升级','可提升护甲或火力。',{...dismiss('upgradeSeen'),target:lab});
    if(find('tankFactory')&&g.isBuildUnlocked(entries.get('tankLab')))return build('free','tankLab','坦克还可研发升级','有需要时建坦克改造厂。',dismiss('upgradeSeen'));
   }
   return null;
  }
  const p=g.player,costFor=type=>entries.get(type),afford=c=>!c||p.wood>=c.wood&&p.gold>=c.gold;
  function gatherCost(a,c){
   if(!c||afford(c)||p.drivingTank)return a;
   const missing=[Math.max(0,(Number(c.wood)||0)-p.wood),Math.max(0,(Number(c.gold)||0)-p.gold)];
   const label=[missing[0]>0?'木 '+Math.ceil(missing[0]):'',missing[1]>0?'金 '+Math.ceil(missing[1]):''].filter(Boolean).join('、');
   const detail='缺'+label+' · '+a.title;
   if(missing[0]>0&&a.action!=='makePeasantBtn'&&!a.smallPointerBN&&!gathering('wood')&&p.wood>=peasantCost.wood&&p.gold>=peasantCost.gold&&g.getPeasantCount()<2){
    const base=owned.find(b=>b.type==='house'&&b.level>=peasantLevel);
    if(base&&!g.peasantBlockReason(base))return workerGoal(base,'缺木材，让伐木工持续采集。');
    if(base&&g.getPeasantCount()>=g.getPeasantCap()){
     const pop=populationGoal(owned,p,true);if(pop)return pop;
    }
   }
   if(missing[0]>0&&gathering('wood')||missing[1]>0&&gathering('gold'))
    return goal(a.phaseBN,'prep:'+a.key396,'正在采集，'+label+'待补',a.title,{wait:true});
   return gather(a.phaseBN,missing[0]>0?'wood':'gold',detail);
  }
  function storage(phase,a){
   const canBuild=entries.get('warehouse');
   const depot=owned.find(b=>b.type==='warehouse'&&b.canUpgrade()&&!g.buildingUpgradeBlockReason(b)&&b.upgradeCost()?.wood<=p.maxWood&&b.upgradeCost()?.gold<=p.maxGold);
   if(depot)return gatherCost(up(phase,depot,'升级仓库','扩容后再继续。'),depot.upgradeCost());
   if(canBuild&&g.isBuildUnlocked(canBuild)&&canBuild.wood<=p.maxWood&&canBuild.gold<=p.maxGold)return gatherCost(build(phase,'warehouse','建造仓库','先扩充资源上限。'),canBuild);
   return a;
  }
  function fund(a,cost){
   if(cost&&(cost.wood>p.maxWood||cost.gold>p.maxGold))return storage(a.phaseBN,a);
   return gatherCost(a,cost);
  }
  if(!s.wall){
   if(pending.some(j=>j.buildType==='wall'))return goal('defense','wall-pending','城墙已安排','等精灵到位，也可以先选下一座塔。',{wait:true});
   return fund(build('defense','wall','先在路口建城墙','用城墙挡住敌人。'),costFor('wall'));
  }
  if(!s.tower){
   if(pending.some(j=>GROUND_TOWERS.includes(j.buildType)))return goal('defense','tower-pending','防御塔已安排','这会儿可以继续备料。',{wait:true});
   return fund(build('defense','cannonTower','在城墙后建炮塔','范围攻击适合清理小怪。',{allowedTypes:GROUND_TOWERS}),costFor('cannonTower'));
  }
  const factory=find('tankFactory'),entry=costFor('tankFactory');
  if(!find('goldMine')){
   if(pending.some(j=>j.buildType==='goldMine'))return goal('economy','mine-pending','金矿厂已安排','精灵抵达后开始建造。',{wait:true});
   return fund(build('economy','goldMine','先造金矿厂','建筑 → 资源 → 金矿厂。造好后自动产金。'),costFor('goldMine'));
  }
  if(!find('warehouse')){
   if(pending.some(j=>j.buildType==='warehouse'))return goal('economy','warehouse-pending','仓库已安排','完工后提高资源上限。',{wait:true});
   return fund(build('economy','warehouse','建造仓库','存下更多木材和金币。'),costFor('warehouse'));
  }
  if((g.peasants?.filter(e=>e&&!e.dead&&e.ownerSlot==null&&!e.inTank&&e.task?.type!=='board').length||0)<2){
   if(!home)return fund(build('economy','house','重建基地','基地可以制造伐木工。'),costFor('house'));
   if(home.level<peasantLevel)return fund(up('economy',home,'升级基地至 Lv'+(home.level+1),'基地 Lv'+peasantLevel+' 解锁伐木工。'),home.upgradeCost());
   if(g.getPeasantCount()>=g.getPeasantCap()){
    const pop=populationGoal(owned,p,false);
    if(pop)return fund(pop,pop.target?.upgradeCost()||costFor(pop.type));
    return goal('economy','lumber-cap','伐木人口已满','可先让现有伐木工回去采木。');
   }
   return fund(workerGoal(home),peasantCost);
  }
  if(!factory&&!g.isBuildUnlocked(entry)){
   if(!home)return fund(build('tech','house','重建基地','坦克厂需要三级基地。'),costFor('house'));
   return fund(up('tech',home,'升级基地至 Lv'+Math.min(3,home.level+1),'基地 Lv3 解锁坦克厂。'),home.upgradeCost());
  }
  if(!factory){
   if(pending.some(j=>j.buildType==='tankFactory'))return goal('tech','factory-pending','坦克厂已安排','精灵抵达后开始建造。',{wait:true});
   return fund(build('tech','tankFactory','建造坦克厂','建好后可制造坦克。'),entry);
  }
  if(factory.tankOrder)return goal('tech','tank-building','坦克正在制造','你可以继续自由建设。');
  return fund(goal('tech','tank','制造第一台坦克','在坦克厂下单。',{target:factory,action:'tankFactoryBtn'}),tankCost);
 }
 function cardLesson(s,now){
  const core=g.cardsCandidate?.core?.state;
  if(!core?.lastAward||g.buildMenu||g.placement||g.selectedBuilding||g.batIntroCardBN?.visible?.())return null;
  const eligible=g.cardRewardInboxData?.events?.some(e=>e.localEligible===true&&(e.cardsGranted>0||e.status==='granted'));
  if(!eligible)return null;
  const hand=core.hand,seen=s.cardGuideSeenIdsBN||[];
  if(cardSession&&(now>=cardSession.until||core.lastCommand!==cardSession.command||!hand.some(c=>c.id===cardSession.id)))cardSession=null;
  const candidate=cardSession?hand.find(c=>c.id===cardSession.id):hand.find(c=>!seen.includes(c.id));
  if(!candidate)return null;
  const control=g.cardPresentation?.guideControl(candidate.id);
  if(!control)return null;
  if(control.step==='tray'&&cardSession?.opened){cardSession=null;return null;}
  if(control.step!=='tray'&&cardSession){cardSession.opened=true;cardSession.until=Math.max(cardSession.until,now+5000);}
  const def=CARD_DEFS[control.type];if(!def)return null;
  const spec=control.step==='aim'?['点地图选择雷暴区域',def.effect+' · '+def.duration]:control.step==='confirm'?['点「确认使用」',control.type==='storm'?'再点地图选择雷暴区域。':def.effect+' · '+def.duration]:['点左下角卡牌','① 选「'+def.name+'」② 确认使用'];
  return goal('card','card-'+control.step,spec[0],spec[1],{cardGuideBN:true,cardStepBN:control.step,cardPointerBN:control.pointer,cardCueIdBN:candidate.id,cardCueNameBN:def.name,cardEffectBN:def.effect+' · '+def.duration,cardCommandBN:core.lastCommand});
 }
 function noteCardUse(type){
  if(type!=='harvest'||!active())return;
  const s=persist();if(s.tank)return;
  const b=g.ownerBuildings().filter(b=>done(b)&&b.type==='goldMine')
    .sort((a,b)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(b.x-g.player.x,b.y-g.player.y))[0];
  const role='资源采集翻倍，持续2分钟。';
  harvestLesson={until:clock()+4700,goal:goal('card','harvest-effect','丰收生效 · 采集翻倍',role,{target:b,cardEffectPanBN:true,wait:!b})};
 }

 function advice(advance=false){
  if(!active())return null;
  const s=persist(),now=clock();
  if(current?.urgentWallBN&&(current.target?.dead||current.target?.hp>current.target?.maxHp/3))dirty=true;
  const card=cardLesson(s,now);if(!current?.urgentWallBN){if(harvestLesson&&now<harvestLesson.until)return harvestLesson.goal;if(card)return card;}
  if(g.state==='prep'&&!s.cameraDragSeenBN&&!s.wall&&!g.buildMenu&&!g.placement&&!g.selectedBuilding&&g.prepTimeLeft>0){
   if(dragStarted==null||now<dragStarted)dragStarted=now;
   if(now-dragStarted<5200)return goal('camera','camera','单指拖动镜头','按住空地，向旁边滑。',{cameraDragBN:true});
   s.cameraDragSeenBN=true;
  }
  if(dirty||advance&&(now<stamp||now-stamp>=REFRESH_MS)||current?.target?.dead){current=plan(s);stamp=now;dirty=false;}
  return current;
 }
 function markShown(row){
  if(!active()||!row||!countedState)return;
  if(row.cardGuideBN){
   const id=row.cardCueIdBN,seen=countedState.cardGuideSeenIdsBN||=[];
   if(id&&!seen.includes(id)){seen.push(id);if(seen.length>24)seen.shift();countedState.cardGuideSeenBN=true;cardSession={id,command:row.cardCommandBN,until:clock()+12000,opened:row.cardStepBN!=='tray'};}
   return;
  }
  if(row.cameraDragBN)return;
  if(row!==current)return;
  if(row.lateCueKeyBN){
   if(shown?.goal===row)return;
   const mem=countedState.lateGuideSeenBN||=(Object.create(null));
   mem[row.lateCueKeyBN]=clock();
   const keys=Object.keys(mem);if(keys.length>48)delete mem[keys[0]];
   countedState.nextLateGuideBN=clock()+18000;shown={goal:row,at:clock()};return;
  }
  if(row.phaseBN==='economy'&&!row.hintOnceBN){countedState.economySeen=true;return;}
  if(!row.hintOnceBN||countedState[row.hintOnceBN])return;
  countedState[row.hintOnceBN]=true;if(row.sideHintBN)countedState.nextTowerHintBN=clock()+22000;shown={goal:row,at:clock()};
 }
 // Normal solo rounds get a short, non-modal reminder only when the suggested action is affordable.
 function normalEconomyTick(){
  if(g.midEconomyGuideR13?.ownsLatePlan?.()||scope()||!offline()||g.superChallenge580||g.tutorial||g.state!=='hunt'||!g.player||g.player.dead||g.player.defected){
   normalHint=null;return;
  }
  if(normalHintPlayer!==g.player||clock()<normalNext-2000){normalHintPlayer=g.player;normalNext=0;normalLast=-Infinity;normalHint=null;}
  if(clock()<normalNext)return;
  normalNext=clock()+1600;
  const p=g.player,low=p.wood<=Math.min(65,Math.max(20,p.maxWood*.24)),busy=g.toast?.time>0||g.exchangeImbalanceBN?.priority?.()||g.criticalPlayerWall399?.();
  if(!low||busy){normalHint=null;return;}
  if(!normalHint&&clock()-normalLast<50000)return;
  const owned=g.ownerBuildings().filter(done),home=owned.find(b=>b.type==='house'&&b.level>=peasantLevel);
  const pop=g.getPeasantCount(),cap=g.getPeasantCap();
  if(!home||pop>=6&&pop<cap){normalHint=null;return;}
  let row=pop>=cap?(populationGoal(owned,p,true)||populationGoal(owned,p,false)):(!g.peasantBlockReason(home)?workerGoal(home,'木材偏少，补一名伐木工。'):null);
  if(row&&pop>=cap){
   const cost=row.target?.upgradeCost()||entries.get(row.type),wood=Math.max(0,(cost?.wood||0)-p.wood),gold=Math.max(0,(cost?.gold||0)-p.gold);
   if(wood||gold)row={...row,detail:'人口满 · 还缺'+[wood&&('木 '+Math.ceil(wood)),gold&&('金 '+Math.ceil(gold))].filter(Boolean).join('、')};
  }
  if(!row){normalHint=null;return;}
  const key=row.key396;
  if(!normalHint){normalLast=clock();normalUntil=clock()+10000;}
  if(clock()>=normalUntil){normalHint=null;return;}
  if(normalHint&&normalHint.key396!==key){normalHint=null;return;}
  normalHint=row;
 }
 const oldEnabled=g.easyOpeningGuideEnabled,oldAdvice=g.openingGuideAdvice,oldUpdate=g.updateEasyOpeningGuide;
 g.easyOpeningGuideEnabled=function(...args){return scope()?false:oldEnabled.apply(this,args);};
 g.openingGuideAdvice=function(advance=false,...args){return scope()?advice(advance):oldAdvice.call(this,advance,...args)||(clock()<normalUntil?normalHint:null);};
 function considerTargetCamera(a){
  const t=a?.target,s=persist();
  if(s.tank||!a||a.phaseBN==='free'||!t||!done(t)){targetPan=null;focusedTarget=focusedStep=null;return;}
  if(g.passiveHintsR13?.enabled()||g.easyGuideTargetCameraBlockedBN?.()){targetPan=null;return;}
  if(t===focusedTarget&&a.key396===focusedStep)return;
  focusedTarget=t;focusedStep=a.key396;
  const dest=g.easyGuideTargetCameraDestinationBN?.(t);if(!dest)return;
  const z=g.zoom(),from={x:g.camera.x,y:g.camera.y};
  if(Math.hypot(from.x-dest.x,from.y-dest.y)*z<18)return;
  targetPan={from,dest,z,at:clock(),target:t};
 }
 g.updateEasyOpeningGuide=function(...args){if(!scope()){const out=oldUpdate.apply(this,args);normalEconomyTick();return out;}if(active())considerTargetCamera(advice(true));else targetPan=null;};
 const oldIntro=g.startEndlessOpeningIntro;
 g.startEndlessOpeningIntro=function(...args){if(!scope())return oldIntro.apply(this,args);};
 const oldExchange=g.tryExchange;
 if(typeof oldExchange==='function')g.tryExchange=function(...args){
  const result=oldExchange.apply(this,args);
  if(result&&active()&&shown?.goal.tradeLessonBN){shown=null;dirty=true;}
  return result;
 };
 const oldDeposit=g.depositToHouse;
 g.depositToHouse=function(...args){
  if(!active())return oldDeposit.apply(this,args);
  const p=this.player,w=p.wood,k=p.gold,result=oldDeposit.apply(this,args),s=persist();
  if(p.wood>w){dirty||=!s.wood;s.wood=true;}if(p.gold>k){dirty||=!s.gold;s.gold=true;}return result;
 };
 const oldButton=g.onButtonClick;
 g.onButtonClick=function(id,...args){
  const result=oldButton.call(this,id,...args);
  if(!active())return result;
  const s=persist();
  if((id==='moreBuilds'&&this.buildMenu)||(id==='collectWood'&&gathering('wood'))||(id==='collectGold'&&gathering('gold'))){
   if(!s.controls||typeof s.controls!=='object'||Array.isArray(s.controls))s.controls={};
   s.controls[id]=true;current=plan(s);stamp=clock();dirty=false;
  }
  return result;
 };
 function allowsPointer(a,p){
  if(!p)return false;
  if((a.button==='collectWood'||a.button==='collectGold')&&acknowledged(a.button)&&!a.resourceDeficitBN)return false;
  return true;
 }
 const oldPan=g.panCamera;
 if(typeof oldPan==='function')g.panCamera=function(from,dx,dy,...args){
  targetPan=null;
  const result=oldPan.call(this,from,dx,dy,...args);
  if(this.placement)delete this.placement.guidePanBN;
  if(active()&&!this.buildMenu&&!this.placement&&!this.selectedBuilding&&dx*dx+dy*dy>=144){
   const s=persist();if(!s.cameraDragSeenBN){s.cameraDragSeenBN=true;dirty=true;}
  }
  return result;
 };
 const oldPlace=g.startPlacement;
 g.startPlacement=function(type,...args){
  const before=this.placement,isGuided=active()&&!persist().tank&&['wall','cannonTower','goldMine','tower'].includes(type);
  const row=isGuided?plan(persist()):null;
  const result=oldPlace.call(this,type,...args),p=this.placement;
  if(p&&p!==before&&p.cameraOrigin&&row?.type===type){
   const dest=this.easyGuideBuildCameraDestinationBN?.(p);
   if(dest){
    p.guideSpotBN=dest.spot;p.guidePanBN={at:clock(),x:dest.x,y:dest.y};
    current=row;dirty=true;
   }
  }
  return result;
 };
 const oldUpdateCamera=g.updateCamera;
 g.updateCamera=function(...args){
  const p=this.placement,pan=p?.guidePanBN;
  if(pan){
   if(p.stage!=='aim'||!active()||this.cameraPeek||this.zoom()!==pan.zoom&&pan.zoom!==undefined)delete p.guidePanBN;
   else{
    pan.zoom??=this.zoom();
    const t=Math.max(0,Math.min(1,(clock()-pan.at)/420)),ease=t*t*(3-2*t);
    this.cameraPan.x=(pan.x-p.cameraOrigin.x)*ease;this.cameraPan.y=(pan.y-p.cameraOrigin.y)*ease;
    if(t===1)delete p.guidePanBN;
   }
  }
  const out=oldUpdateCamera.apply(this,args),t=targetPan;
  if(t){
   if(!active()||!done(t.target)||this.zoom()!==t.z||this.easyGuideTargetCameraBlockedBN?.())targetPan=null;
   else {
    const u=Math.min(1,Math.max(0,(clock()-t.at)/480)),e=u*u*(3-2*u);
    this.camera.x=this.cameraFollow.x=t.from.x+(t.dest.x-t.from.x)*e;
    this.camera.y=this.cameraFollow.y=t.from.y+(t.dest.y-t.from.y)*e;
    this.manualCamera394=true;
    if(u===1)targetPan=null;
   }
  }
  return out;
 };
 g.easyOnboardingBN={advice,markShown,scope,allowsPointer,noteCardUse};
}
module.exports={install};
