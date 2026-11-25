'use strict';const bootGuard=require('./startup-guard');bootGuard.stage('分享入口');require('./share')(wx,{roomInvites:false});bootGuard.stage('运行环境');const env=require('./runtime');env.runtime.deferStoneStartupBN=env.runtime.preparedArt;env.window.cardPresentationApproved=true;env.window.cardRewardIntegrationApproved=true;const offline=()=>true;

async function beginStartup() {
 const token=bootGuard.checkpoint();
 const current=()=>bootGuard.current(token);
 const nextForegroundTask=async()=>{
  await new Promise(resolve=>setTimeout(resolve,0));
  await env.runtime.whenImageWorkVisibleBN(()=>{});
  return current();
 };
 bootGuard.stage('建筑几何预备');
 if(!await nextForegroundTask())return;
 const placementGeometry=require('./network/placement-geometry-data');
 if(!await nextForegroundTask())return;
 const buildingGrid=require('./network/ordinary-building-grid');
 if(!await nextForegroundTask())return;
 const footprintTerrain=require('./network/placement-footprint-terrain');
 if(!await nextForegroundTask())return;
 env.window.resourceSpacingAD=require('./network/resource-spacing')(placementGeometry,buildingGrid,footprintTerrain);
 if(!await nextForegroundTask())return;
 bootGuard.stage('单人注册');
 const soloPreparation=require('./single-player-build')(env,{installActions:false,offline});
 if(!await nextForegroundTask())return;
 bootGuard.stage('单人输入');require('./network/solo-session-input')(wx,env);env.window.networkDefenseModeBN=()=>false;env.window.batSoloPolicyBN=require('./network/bat-solo-policy')({offline});env.window.batWaveCandidateBN=require('./network/bat-wave-candidate')({isStormSource:s=>env.window.game?.cardsCandidate?.isStormSource(s)===true,scope:g=>env.window.batSoloPolicyBN.allows(g),onlinePresentation:()=>false,nativeText:env.runtime.nativeText,healFractionPerSecond:0.2,Image:env.Image,imagePath:env.runtime.imagePath,offline});env.window.batTowerVisualBN=require('./network/bat-tower-visual')({Image:env.Image,imagePath:env.runtime.imagePath,cementArt:env.window.petrifiedTowerArtR55});env.window.batAirDefenseBN=require('./network/bat-air-defense-candidate')({enabled:g=>env.window.batWaveCandidateBN.enabled(g)});env.window.batPersistenceBN=require('./network/bat-persistence-candidate')({allowOfflineSlots:true,offline,airDefense:()=>env.window.batAirDefenseBN});require('./dragon-tutorial-install')(env,{offline});env.window.miniDemonFollower=require('./network/mini-demon-follow')({simulate:offline});bootGuard.stage('加载界面');const{runtime,window}=env;function text(value,x,y,maxWidth){const flat=runtime.nativeText(value);if(maxWidth===undefined)c.fillText(flat,x,y);else c.fillText(flat,x,y,maxWidth);}
let bootReady627=false,bootFailed627=false;let stopped=false,started=false,error='',progress=0,phase='',phaseDetail='',preparingPack=false;let loadingReady=false,roundPaint591=false;let loadingImage=null;
const resizeCanvasBacking=require('./network/resize-canvas-backing');
const readNativeImage=require('./network/native-image-decode');
function ensureLoadingPoster(){
 if(loadingImage)return;
 const image=loadingImage=wx.createImage();
 const current=()=>loadingImage===image;
 readNativeImage(image,'/assets/loading-screen-v456.jpg',8000,current).then(loaded=>{
  if(loaded && current()){loadingReady=true;paint();}
 },()=>{if(current())loadingReady=false;});
}
function releaseLoadingPoster(){
 const image=loadingImage;
 loadingImage=null;
 readNativeImage.discardObsolete();
 if(loadingReady && image)image.src='';
 loadingReady=false;
}
runtime.releaseLoadingPoster591=releaseLoadingPoster;
function roundedRect(x,y,w,h,r){const radius=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+radius,y);c.lineTo(x+w-radius,y);c.arcTo(x+w,y,x+w,y+radius,radius);c.lineTo(x+w,y+h-radius);c.arcTo(x+w,y+h,x+w-radius,y+h,radius);c.lineTo(x+radius,y+h);c.arcTo(x,y+h,x,y+h-radius,radius);c.lineTo(x,y+radius);c.arcTo(x,y,x+radius,y,radius);c.closePath();}
function drawLoadingPoster(v){c.fillStyle='#07131d';c.fillRect(0,0,v.width,v.fullHeight);if(loadingReady){const iw=loadingImage.width||540,ih=loadingImage.height||960,scale=Math.max(v.width/iw,v.fullHeight/ih);const dw=iw*scale,dh=ih*scale;c.drawImage(loadingImage,(v.width-dw)/2,(v.fullHeight-dh)/2,dw,dh);}
const shade=c.createLinearGradient(0,0,0,v.fullHeight);shade.addColorStop(0,'rgba(4,12,23,.30)');shade.addColorStop(.52,'rgba(4,12,23,.02)');shade.addColorStop(.72,'rgba(4,12,23,.18)');shade.addColorStop(1,'rgba(3,9,17,.90)');c.fillStyle=shade;c.fillRect(0,0,v.width,v.fullHeight);}
function paint(){if(runtime.hidden||(bootReady627||bootFailed627)&&!roundPaint591)return;const v=runtime.viewport(),d=Math.min(2,v.pixelRatio||1);resizeCanvasBacking(canvas,Math.round(v.width*d),Math.round(v.fullHeight*d));
c.setTransform(d,0,0,d,0,0);drawLoadingPoster(v);c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';const titleY=Math.max(54,(v.safeTop||0)+34);c.font='bold 25px sans-serif';c.lineWidth=5;c.strokeStyle='rgba(3,10,17,.72)';c.strokeText(runtime.nativeText('恶魔与精灵'),v.width/2,titleY);c.fillStyle='#f6f1dc';text('恶魔与精灵',v.width/2,titleY);const w=Math.min(v.width-44,440),x=(v.width-w)/2,barH=22;const y=v.fullHeight-Math.max(126,(v.safeBottom||0)+108);if(roundPaint591&&!error)require('./network/game-intro-caption').draw(c,{x:v.width/2,top:titleY+24,bottom:y-20,width:Math.min(v.width-30,408),center:true,size:16,alpha:.52},runtime.nativeText);c.save();c.shadowColor='rgba(55,218,255,.42)';c.shadowBlur=14;roundedRect(x-2,y-2,w+4,barH+4,barH/2+2);c.fillStyle='rgba(5,15,27,.86)';c.fill();c.restore();roundedRect(x,y,w,barH,barH/2);c.fillStyle='rgba(5,18,31,.88)';c.fill();c.strokeStyle='rgba(132,229,255,.82)';c.lineWidth=1.5;c.stroke();const inner=3,fillW=Math.max(0,(w-inner*2)*Math.max(0,Math.min(100,progress))/100);if(fillW>0){c.save();roundedRect(x+inner,y+inner,w-inner*2,barH-inner*2,(barH-inner*2)/2);c.clip();const fill=c.createLinearGradient(x,y,x+w,y);fill.addColorStop(0,'#14bfe5');fill.addColorStop(.68,'#55e8ff');fill.addColorStop(1,'#ff9a45');c.fillStyle=fill;c.fillRect(x+inner,y+inner,fillW,barH-inner*2);const shine=c.createLinearGradient(0,y+inner,0,y+barH-inner);shine.addColorStop(0,'rgba(255,255,255,.72)');shine.addColorStop(.42,'rgba(255,255,255,.12)');shine.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=shine;c.fillRect(x+inner,y+inner,fillW,barH-inner*2);c.restore();const head=x+inner+Math.max(6,fillW-6);c.save();c.shadowColor='#ffb05f';c.shadowBlur=10;c.beginPath();c.arc(head,y+barH/2,4.2,0,Math.PI*2);c.fillStyle='#fff3c8';c.fill();c.restore();}
c.font='bold 12px sans-serif';c.lineWidth=3;c.strokeStyle='rgba(0,10,18,.78)';const percent=error?'加载未完成':Number.isFinite(progress)?`当前阶段 ${Math.floor(progress)}%`:'当前阶段处理中…';c.strokeText(runtime.nativeText(percent),v.width/2,y+barH/2+.5);c.fillStyle='#f8fbff';text(percent,v.width/2,y+barH/2+.5);const s=runtime.startupStatus(),kb=n=>Math.floor(n/1024);c.font='13px sans-serif';c.fillStyle=error?'#ffc6a8':'#d9f5ff';text(error?(roundPaint591?'请选择重试或返回首页':'点击屏幕重新加载'):phase||(started?'正在准备地图…':s.stage==='decode'?`正在准备画面 ${s.loaded}/${s.total}`:`正在读取素材 ${kb(s.availableBytes)}/${kb(s.totalBytes)} KB`),v.width/2,y+barH+22,w);c.font='11px sans-serif';c.fillStyle=error?'#ffad88':'rgba(230,244,249,.76)';text(error?error:phaseDetail||(s.cacheHits?`已复用 ${s.cacheHits} 项本机素材`:'首次加载后会缓存素材，下次进入更快'),v.width/2,y+barH+43,w);}
runtime.drawRoundLoading591=info=>{if(runtime.hidden)return [];ensureLoadingPoster();const prior=[error,progress,phase,phaseDetail];error=info.error||'';progress=info.progress;phase=info.phase;phaseDetail=info.error||info.detail;roundPaint591=true;try{paint();}finally{roundPaint591=false;[error,progress,phase,phaseDetail]=prior;}
const v=runtime.viewport(),w=Math.min(v.width-44,440),x=(v.width-w)/2,y=v.fullHeight-Math.max(45,(v.safeBottom||0)+34),gap=12;const buttons=info.error?[{id:'retry',text:'重试',x,y,w:(w-gap)/2,h:30},{id:'back',text:'返回首页',x:x+(w+gap)/2,y,w:(w-gap)/2,h:30}]:[{id:'back',text:'取消并返回首页',x,y,w,h:30}];c.font='13px sans-serif';c.textAlign='center';c.textBaseline='middle';for(const originalButton of buttons){const hb={...originalButton,id:'round-loading:'+originalButton.id,y:originalButton.y-v.top},pose=window.game?.buttonBounceBN?.pose(hb,originalButton.text)||hb,bs=pose.w/hb.w,b={...pose,y:pose.y+v.top};c.font=(13*bs)+'px sans-serif';roundedRect(b.x,b.y,b.w,b.h,12*bs);c.fillStyle='rgba(7,32,45,.94)';c.fill();c.strokeStyle='#84e5ff';c.lineWidth=1;c.stroke();c.fillStyle='#e4f3db';text(b.text,b.x+b.w/2,b.y+b.h/2,b.w-12*bs);}
return buttons.map(b=>({...b,y:b.y-v.top}));};function fail(e){stopped=true;bootReady627=false;bootFailed627=true;error=require('./network/startup-error-detail').describe(e);try{runtime.diagnosticEvent?.('error','bootstrap '+phase+': '+String(e?.stack||e));console.error('微信小游戏启动失败',error);paint();}finally{bootGuard.fail(e,{retry:e?.code==='STONE_RESOURCE_RETRY'?async()=>{stopped=false;preparingPack=false;bootFailed627=false;error='';phase='重新加载石头人素材';paint();await tick();}:null});}}
bootGuard.stage('单人规则预备');
if(!await nextForegroundTask())return;
for(const _ of soloPreparation){
 if(!await nextForegroundTask())return;
}
bootGuard.stage('单人规则就绪');
const canvas=runtime.canvas,c=canvas.getContext('2d');
ensureLoadingPoster();
bootGuard.stage('基础素材模块');try{window.vehicleArmorBufferBJ=require('./network/vehicle-armor-buffer');require('./js/reference-terrain');if(runtime.preparedArt)require('./network/canonical-forest-304').preload(wx);require('./network/defense-shoulder-trees').install(window.referenceTerrain);require('./js/unit-motion');require('./js/terrain-layout161');require('./js/sound-layout161');require('./js/woodland-art');}catch(e){fail(e);}
async function tick(){const token=bootGuard.checkpoint(),current=()=>bootGuard.current(token);if(stopped||!current())return;try{if(runtime.preparedArt){if(preparingPack)return;preparingPack=true;bootGuard.stage('首页分包');phase='打开首页资源';phaseDetail=runtime.releaseLabel;paint();
const artName='art163';if(!env.window.ghostModulesBN)await new Promise((ok,no)=>{const t=setTimeout(()=>no(Error('首页分包加载超时')),45000);wx.loadSubpackage({name:artName,success:()=>{clearTimeout(t);ok();},fail:e=>{clearTimeout(t);no(e);}});});if(!current())return;
const install=()=>env.window.ghostModulesBN.ghost_startup(env,wx,require('./network/rounded-card-path'),current,false);
await readNativeImage.whenVisible(install);if(!current())return;runtime.homeArtPackageReadyBN=true;
let matchArts=null,cardRetry=null;
const prepareCards=()=>readNativeImage.whenVisible(()=>env.window.ghostModulesBN.ghost_startup(env,wx,require('./network/rounded-card-path'),()=>!runtime.hidden));
runtime.ensureMatchArtsBN=progress=>{
 if(matchArts)return matchArts.then(()=>{if(window.cardArtCandidate?.ready)return;if(!cardRetry)cardRetry=prepareCards().finally(()=>{cardRetry=null;});return cardRetry;});
 const mark=(phase,done,total)=>{try{progress?.(phase,done,total);}catch(_){}};
 const p=(async()=>{
   runtime.diagnosticEvent?.('phase','match-art-pack');mark('获取对局画面包');
   await runtime.ensureCombatIcons471?.();
   const layout=await runtime.loadPreparedPackage((_p,w,total)=>mark('获取对局画面包',w,total));
   await window.batTowerVisualBN?.warmup();window.monsterSpeciesLiteBN?.warm();
   runtime.diagnosticEvent?.('phase','match-art-hydration');await window.woodlandArt.hydratePrepared(layout,(done,total)=>mark('解析对局画面包',done,total));
   await prepareCards();
   runtime.diagnosticEvent?.('phase','match-art-ready');mark('画面已就绪',1,1);
 })();
 matchArts=p;p.catch(()=>{if(matchArts===p)matchArts=null;});return p;
};
releaseLoadingPoster();
const homeQueue=runtime.homeImageQueue471=require('./network/home-image-queue')(env.Image,runtime.imagePath);
const homeView=runtime.viewport();await homeQueue.prepare(homeView.width>homeView.height);if(!current())return;
bootGuard.stage('游戏主模块');require('./js/main');await runtime.ensureHomeImages471?.();if(!current())return;started=stopped=true;runtime.start();bootReady627=true;bootGuard.ready();return;}
const s=runtime.startupStatus(),a=window.woodlandArt?.startupStatus();if(s.error||a?.error)throw new Error(s.error||a.error);progress=Math.max(progress,Math.min(90,s.availableBytes/s.totalBytes*70+s.loaded/s.total*20));paint();if(!runtime.hidden&&s.loaded===s.total){if(!a||a.loaded!==a.total)throw new Error('素材未完整解析');started=true;if(!env.window.ghostModulesBN)await new Promise((ok,fail)=>wx.loadSubpackage({name:'art163',success:ok,fail}));await env.window.ghostModulesBN.ghost_startup(env,wx,require('./network/rounded-card-path'),current);if(!current())return;bootGuard.stage('游戏主模块');if(!current())return;require('./js/main');if(!current())return;runtime.preparing=true;try{await window.game.prepareInitialScene((done,total)=>{if(!current())return;progress=total>0?90+done/total*10:null;paint();});}
finally{runtime.preparing=false;}
stopped=true;if(!current())return;runtime.start();bootReady627=true;bootGuard.ready();return;}}catch(e){if(current())fail(e);return;}
if(current())setTimeout(tick,150);}
// The guard owns all failure visuals and input; the loading poster never paints over it.
paint();tick();

}
beginStartup().catch(error=>bootGuard.fail(error));
