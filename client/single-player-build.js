// Reserve the original attach position before other entry points wrap it.
module.exports = function reserveSinglePlayerBuild(env, options) {
  const runtime=env.runtime;
  const attach=runtime.attach;
  const cementArt=env.window.petrifiedTowerArtR55=require('./network/petrified-tower-art').create({createCanvas:()=>env.document.createElement('canvas')});
  let attachPrepared;
  runtime.attach=function(game) {
    if(!attachPrepared)throw new Error('单人规则尚未准备完成');
    return attachPrepared.call(this,game);
  };
  return prepare(env,options,attach,cementArt,handler=>{attachPrepared=handler;});
};

function* prepare(env, {installActions=true,offline=()=>true}={}, attach, cementArt, installPreparedAttach) {
  const runtime=env.runtime;
  const {installDemonSupplyOverlay}=require('./network/demon-supply-overlay');
  const {installOfflineDeathResults}=require('./offline-death-results');
  yield;
  const {installPlacementSites}=require('./network/placement-sites');
  yield;
  const {installOfflineGateFocus}=require('./network/first-demon-gate-focus');
  const {installAiDefenseCore}=require('./network/ai-defense-core');
  const {installOwnershipColors}=require('./network/ownership-colors');
  const {installSummonedHoundWalls}=require('./network/summoned-hound-wall');
  yield;
  const {installOfflineDemonRaid}=require('./offline-demon-raid');
  const {install:installAiBootsProgression}=require('./network/ai-boots-progression');
  yield;
  const {installGateRaidWarning}=require('./network/demon-raid-warning');
  const {LiveMatchHud}=require('./network/live-match-hud');
  const {installSessionActions}=require('./session-actions');
  yield;
  const stoneArt=require('./network/stone-boss-candidate').prepareArt({Image:env.Image,runtime,loadPackage:()=>new Promise((resolve,reject)=>wx.loadSubpackage({name:'stoneArt',success:resolve,fail:reject})),offline});
  yield;
  const mammoth=require('./network/mammoth-gameplay-candidate');
  const mammothArt=mammoth.prepareArt({Image:env.Image,loadPackage:name=>new Promise((resolve,reject)=>wx.loadSubpackage({name,success:resolve,fail:reject}))});
  yield;
  const rear=require('./network/monster-rear-motion'),rearLoader=rear.loadRearArt({Image:env.Image,canWarm:()=>!runtime.hidden&&!runtime.memoryConstrained?.(),loadPackage:()=>new Promise((resolve,reject)=>wx.loadSubpackage({name:'monsterRearMotion',success:resolve,fail:reject}))});
  yield;
  env.window.rangedTrollArtBN=require('./network/ranged-troll-art').create({fallback:()=>env.window.monsterSpeciesLiteBN,Image:env.Image,allowed:()=>!runtime.hidden,readPage:(im,name,current)=>runtime.readPreparedPage(im,name,current),wake:()=>runtime.wake?.()});
  env.window.griffinArtBN=require('./network/griffin-art').create({fallback:()=>env.window.monsterSpeciesLiteBN,Image:env.Image,allowed:()=>!runtime.hidden,readPage:(im,name,current)=>runtime.readPreparedPage(im,name,current)});
  yield;
  require('./network/resource-three-tier').protectSlotOverwrites(runtime,typeof wx==='undefined'?null:wx);
  const flags=typeof GameGlobal==='undefined'?{}:GameGlobal;
  const mode=flags.isIOSHighPerformanceModePlus===true?'高性能+':flags.isIOSHighPerformanceMode===true?'高性能':flags.isIOSHighPerformanceMode===false&&flags.isIOSHighPerformanceModePlus===false?'普通模式':'模式待确认';
  const testLabel='COW8D-PF1-CLAUDE-R12-GUIDES-SOLO · 单人测试 · '+mode;
  runtime.releaseLabel = 'COW8D-PF1-CLAUDE-R12-GUIDES-SOLO · 单人测试 · '+mode;
  installPreparedAttach(function(game) {
    attach.call(this, game);
    const guide=()=>offline()&&game.operationGuideModeR13();
    env.window.batSoloPolicyBN?.install(game);
    env.window.ghostModulesBN.robot_factory_models.install(game,{runtime,Image:env.Image,offline,art:()=>env.window.woodlandArt,skills:()=>env.window.skillAtlas512,makeCanvas:()=>env.document.createElement('canvas'),loadPackage:typeof wx==='undefined'||!wx.loadSubpackage?null:()=>new Promise((resolve,reject)=>wx.loadSubpackage({name:'factoryModelArt',success:resolve,fail:reject}))});
    require('./network/bat-warning-avatar').install(game,{enabled:()=>env.window.batWaveCandidateBN?.enabled(game)===true,Image:env.Image});
    require('./network/wall-attack-exterior').install(game);
    game.baseGuideR8=env.window.ghostModulesBN.base_upgrade_guide;
    require('./network/resource-three-tier').install(game,{Building:env.window.originalNetwork627?.types?.Building});
    installOwnershipColors(game,{Building:env.window.originalNetwork627?.types?.Building});
    installPlacementSites(game,{cooperativeHints:true,Building:env.window.originalNetwork627?.types?.Building,catalog:env.window.originalNetwork627?.BUILD_CATALOG,viewport:()=>runtime.viewport(),input:()=>env.window.originalNetwork627?.input,clock:()=>env.performance.now(),art:()=>env.window.woodlandArt,towerVisual:()=>env.window.batTowerVisualBN,airDefense:()=>env.window.batAirDefenseBN,text:value=>runtime.nativeText(value)});
    require('./network/player-build-walk').install(game,{Building:env.window.originalNetwork627?.types?.Building,catalog:env.window.originalNetwork627?.BUILD_CATALOG});
    require('./network/altar-range-preview').install(game,{Building:env.window.originalNetwork627?.types?.Building});
    require('./network/building-visual-scale').installPicking(game,()=>env.window.woodlandArt);
    require('./network/tank-production-overlay').install(game,{art:()=>env.window.woodlandArt,text:value=>runtime.nativeText(value),offline});
    game.resourceCapViewport=()=>runtime.viewport();env.window.ghostModulesBN.resource_cap_guide.install(game,{clock:()=>env.performance.now()});
    require('./network/gold-shortage-guide').install(game,{costs:env.window.originalNetwork627?.paymentCostsBN,catalog:env.window.originalNetwork627?.BUILD_CATALOG,viewport:()=>runtime.viewport(),clock:()=>env.performance.now(),offline:guide,text:value=>runtime.nativeText(value)});
    require('./network/attack-warning-avoidance').install(game,{viewport:()=>runtime.viewport(),clock:()=>env.performance.now(),art:()=>env.window.woodlandArt});
    require('./network/unified-guidance-arrows').install(game,{clock:()=>env.performance.now()});
    env.window.ghostModulesBN.solo_cutaway.install(game,runtime);
    env.window.ghostModulesBN.wall_half_guide_demo.install(game,runtime,()=>env.window.originalNetwork627?.input);
    env.window.ghostModulesBN.defense_guide_demo.install(game,env.window.originalNetwork627.BUILD_CATALOG,value=>runtime.nativeText(value),env.window.originalNetwork627.types.Building);
    env.window.ghostModulesBN.wood_workforce_demo.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,env.window.originalNetwork627.types.Building,guide);
    env.window.ghostModulesBN.antiair_guide_demo.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,guide,()=>env.window.batWaveCandidateBN?.menuEnabled(game));
    env.window.ghostModulesBN.goldmine_guide_demo.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,env.window.originalNetwork627.types.Building,guide);
    env.window.ghostModulesBN.tank_economy_guide_demo.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,env.window.originalNetwork627.types.Building,env.window.originalNetwork627.paymentCostsBN.TANK_COST,env.window.originalNetwork627.paymentCostsBN.ROBOT_COST,guide);
    env.window.ghostModulesBN.vehicle_drive_guide_demo.install(game,runtime,guide);
    env.window.ghostModulesBN.vehicle_lab_guide.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,env.window.originalNetwork627.types.Building,guide);
    env.window.ghostModulesBN.demon_tower_guide_demo.install(game,runtime,env.window.originalNetwork627.BUILD_CATALOG,guide);
    env.window.ghostModulesBN.save_reminder.install(game,{offline:guide,text:value=>runtime.nativeText(value)});
    const native=env.window.originalNetwork627;
    const rangeGuide=require('./network/ranged-watchtower-guide').install(game,{offline:guide,catalog:native?.BUILD_CATALOG,Building:native?.types?.Building,bonus:native?.watchtowerBonus});
    require('./network/easy-onboarding').install(game,{offline:guide,catalog:env.window.originalNetwork627?.BUILD_CATALOG,tankCost:env.window.originalNetwork627?.paymentCostsBN?.TANK_COST});
    require('./network/exchange-imbalance-guide').install(game,{offline:guide,catalog:env.window.originalNetwork627?.BUILD_CATALOG});
    require('./network/phase-one-tank-drop').install(game,{offline,Tank:env.window.originalNetwork627?.types?.Tank});
    require('./network/attack-direction-arrow').install(game,{viewport:()=>runtime.viewport(),art:()=>env.window.woodlandArt,text:value=>runtime.nativeText(value)});
    installSummonedHoundWalls(game,{Hound:env.window.originalNetwork627?.types?.Hound,active:offline});
    require('./network/stone-boss-candidate').install(game,{Hound:env.window.originalNetwork627?.types?.Hound,Projectile:env.window.originalNetwork627?.types?.Projectile,Image:env.Image,art:stoneArt,runtime,offline});
    mammoth.install(game,{Hound:env.window.originalNetwork627?.types?.Hound,art:mammothArt,offline});
    game.monsterRearMotionBN=rear.install(game,{loader:rearLoader,offline,runtime});
    if(typeof wx!=='undefined')wx.onMemoryWarning?.(()=>{game.monsterRearMotionBN.trimSpeculative();cementArt.clear();});
    installAiDefenseCore(game,{catalog:env.window.originalNetwork627?.BUILD_CATALOG,active:offline});
    installAiBootsProgression(game,{active:offline});
    const raid=installOfflineDemonRaid(game,offline);
    installGateRaidWarning(game,{warning:()=>raid.warning(),enabled:()=>offline()&&raid.ensure()?.enabled()===true});
    installOfflineGateFocus(game,{enabled:()=>offline()&&raid.ensure()?.enabled()===true,input:env.window.originalNetwork627?.input});
    installDemonSupplyOverlay(game,{runtime,text:s=>runtime.nativeText(s)});
    require('./network/no-building-grace').install(game,{active:offline});
    installOfflineDeathResults(game,{runtime,Troll:env.window.originalNetwork627?.types?.Troll,offline});
    const placements=require('./network/ad-lab/native-placement-config');
    if(placements.enabled===true&&typeof wx!=='undefined'){
      const ads=require('./network/ad-lab/native-host')(game,{runtime,types:env.window.originalNetwork627?.types,offline,sdk:wx,config:placements,elfRevive:env.window.ghostModulesBN.elf_ad_revive,input:env.window.originalNetwork627?.input});
      if(ads){
        Object.defineProperty(game,'rewardAdBN',{value:ads});
        const update=game.update;
        game.update=function(...args){
          if(ads.pausesLive()){this.loopClock=null;this.simulationDebt=this.inSimulationBatch?Math.max(0,args[0]||0):0;return;}
          return update.apply(this,args);
        };
        const reset=game.resetSteps591;
        game.resetSteps591=function*(...args){ads.leaveLobby();const out=yield*reset.apply(this,args);ads.reset(false);return out;};
        const load=game.applySavedWorld;
        game.applySavedWorld=function(...args){
          // The loader may mint a legacy stone-card ID while rebuilding the
          // world. Only a stable ID actually read from the archive can opt it in.
          const world=args[0],card=world?.cardRewardInboxData?.matchId,stone=world?.stoneCardData?.matchId;
          const persistedMatch=card&&stone&&card!==stone?null:card||stone;
          const out=load.apply(this,args);if(out)ads.reset(true,persistedMatch);return out;
        };
        const start=game.beginRound;
        game.beginRound=function(...args){
          ads.leaveLobby();
          // Home's first solo launch may reuse the constructor's pre-built world.
          // The constructor predates this ad host and did not establish a ledger.
          if(args[0]===true&&args[1]!==true&&this.state==='start'&&!this.roundStarting&&!this.roundLoading591&&this.player&&!this.player.rewardAdV1&&offline())ads.reset(false);
          return start.apply(this,args);
        };
        const draw=game.draw;
        game.draw=function(...args){const out=draw.apply(this,args);ads.draw();return out;};
      }
    }
    require('./network/no-building-warning').install(game,{runtime,text:s=>runtime.nativeText(s)});
    require('./network/build-resource-gate').install(game,{catalog:env.window.originalNetwork627?.BUILD_CATALOG});
    if(installActions)installSessionActions({game,runtime,wx:typeof wx==='undefined'?null:wx});
    const hud=game.singlePlayerHud627=new LiveMatchHud({offline:true});
    const clock=()=>env.performance.now();
    const active=()=>offline()&&['prep','hunt'].includes(game.state)&&!game.sessionMenuOpen&&!game.saveSlotsPanel&&!game.demonPanel&&!game.roundStarting&&!runtime.hidden;
    const effects=game.cardEffectHudBN=env.window.cardEffectHudModuleBN.create(value=>runtime.nativeText(value));
    let wasActive=false,hudWarned=false,effectHudWarned=false;
    const smooth=game.drawSmoothFrame;
    game.drawSmoothFrame=function(...args){const result=smooth.apply(this,args);if(active())hud.completedFrame(clock());return result;};
    if(typeof wx!=='undefined'){wx.onHide?.(()=>hud.reset());wx.onShow?.(()=>hud.reset());}
    const draw = game.draw;
    game.draw = function(...args) {
      rangeGuide?.tick();
      const result = draw.apply(this, args);
      if(!offline()){hud.reset();wasActive=false;return result;}
      if(this.robotGuideBN?.playing?.()||this.cardPresentation?.modal())return result;
      const playing=active();if(playing!==wasActive){hud.reset();wasActive=playing;}
      if(['prep','hunt'].includes(this.state)&&!this.roundStarting){
        if(this.deathResultsAD?.visible)return result;
        if(playing)rangeGuide?.draw(this.ctx);
        const avoid=this.toastRect?[this.toastRect]:[],remaining=this.noBuildingWarningAZ?.remaining();
        if(remaining!=null)avoid.push(this.noBuildingWarningAZ.layout());
        const view=runtime.viewport(),geometry=this.hudGeometry504?.(),preferences=runtime.hudPreferences?.value;
        try{hud.draw(this.ctx,runtime.canvas,view,clock(),false,geometry,value=>runtime.nativeText(value),avoid,preferences);}catch(error){hud.reset();if(!hudWarned){hudWarned=true;runtime.diagnosticEvent?.('hud-error',String(error?.message||error));}}
        const core=this.cardsCandidate?.core;effects.clear();
        if(playing&&core?.state?.effects.length&&geometry&&!this.popupActive515?.()&&!this.endlessOpeningIntro){
          try{
            const fps=hud.layout(view,geometry,avoid,preferences);if(fps)avoid.push(fps);
            const settings=this.sessionMenuRect?.();if(settings)avoid.push(settings);
            const map=this.getMinimapRect?.();
            // Reserve the landscape high-priority warning band without rescanning walls.
            if(geometry.land){const r=this.criticalWallBannerRect?.();if(r)avoid.push(r);}
            if(this.troll?.retreating&&!this.troll.dead){
              const w=geometry.land?390:330,x=(view.width-w)/2;
              const y=geometry.land?geometry.bottom+44:Math.min((this.buttonAreaTop||view.height-120)-56,map?map.y+map.h+44:Infinity);
              avoid.push({x,y,w,h:48});
            }
            effects.draw(this.ctx,runtime.canvas,view,geometry,map,avoid,this.buttonAreaTop,core);
          }catch(error){if(!effectHudWarned){effectHudWarned=true;runtime.diagnosticEvent?.('card-effect-hud-error',String(error?.message||error));}}
        }
        if(this.cardPresentation?.expandedGhost()){this.displayTransform398(this.ctx);this.cardPresentation.draw(this.ctx);}
        return result;
      }
      if (this.state !== 'start' || this.sessionMenuOpen || this.saveSlotsPanel || this.roundStarting) return result;
      const view = runtime.viewport(), canvas = runtime.canvas, ctx = canvas.getContext('2d');
      const w = view.width, h = view.fullHeight || view.height, y = (view.safeTop || 0) + 14;
      ctx.save();
      try {
        ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
        ctx.fillStyle = 'rgba(8,30,23,.78)'; ctx.fillRect(w / 2 - 100, y - 10, 200, 22);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#f4e2aa';
        ctx.fillText(runtime.nativeText(testLabel), w / 2, y + 1);
      } finally { ctx.restore(); }
      return result;
    };
    env.window.ghostModulesBN.passive_hints.install(game,offline,()=>native?.input,()=>runtime.wake?.());
  });
}
