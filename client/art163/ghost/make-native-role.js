'use strict';
const {create}=require('./native-role-stage');
const warm=new WeakMap();
function prime(w){
 if(!w)return false;if(warm.has(w))return !!warm.get(w).sprite;
 const state={sprite:null};warm.set(w,state);
 Promise.resolve().then(()=>w.loadGhostElfBN()).then(i=>state.sprite=i,()=>{warm.delete(w);});
 w.batWaveCandidateBN?.preloadCargo?.()?.catch?.(()=>{});
}
function createRole(key,shadow,profile){
 if(!['ghostStealth','ghostPossess','batRaid'].includes(key)||!shadow||!profile?.window)return null;
 const {world,types,scope,close,live}=shadow,{window:w,Projectile,Width,Height,makeCanvas,now}=profile;
 if(!world||world===live||world.player===live.player||typeof scope!=='function')return null;
 prime(w);
 let player=world.player,threat=world.troll,bat,depot,home,owner,drive=null,stage,clock=0;
 const x=4650,y=3930,hidden=key==='ghostStealth',raid=key==='batRaid';
 const ghost=w.ghostModulesBN?.ghost_elf;
 if(!ghost||!w.woodlandArt)return null;
 scope(()=>{
  Object.assign(player,{x:x-48,y,gold:0,wood:0,maxGold:20000,maxWood:20000,_animX:x-48,_animY:y});
  Object.assign(threat,{x:x+132,y:y-12,_animX:x+132,_animY:y-12,shopProgress:null,shopping:false,retreating:false,attackCd:1e8,facing:-1,state:'patrol'});
  world.updateFogOfWar=()=>{};
  const isolated=w.batWaveCandidateBN; // Render/facing APIs only, not world spawn/authority.
  const api=ghost(world,{Projectile,MiniTroll:class IsolatedMiniTroll{},opened:()=>true,
   worldW:Width,worldH:Height,loadSprite:()=>Promise.resolve(warm.get(w)?.sprite).then(i=>i||w.loadGhostElfBN()),
   batFace:(...a)=>isolated?.face?.(...a),directionArt:()=>w.ghostDirectionalBN,canvas:makeCanvas,art:()=>w.rangedTrollArtBN,stick:()=>drive});
  if(!api||!api.transform())return;
  const hint=makeCanvas?.(2,2)?.getContext?.('2d');
  if(hint)api.paint(hint,player,()=>{});
  if(!hidden){
   // Genuine native Hound class and the wave-installer's owned bat fields; no running live waves.
   bat=new types.Hound(x,y,2);
   Object.assign(bat,{waveBat:true,enemyKind:'bat',airborne:true,waveHound:false,maxHp:220,hp:220,waveNumber:8,waveZoneIndex:0,batTimeBN:0,batCargoBN:{},batDeliveredBN:{},batCargoVisualBN:'empty',batStateBN:'seek'});
   world.hounds.push(bat);
   if(hint)isolated?.draw?.(world,bat,hint);
   owner={slot:1,gold:330,wood:250};
   depot=new types.Building(x+(raid?68:130),y+(raid?0:32),'warehouse',3);
   depot.ownerSlot=1;world.buildings.push(depot);world.allies.push(owner);
   home=new types.Building(x-320,y+110,'house',1);home.isInitialBase=true;
   world.buildings.push(home);
   if(raid&&(!api.button('collectWood')||api.host!==bat))return;
  }
 });
 const tick=dt=>{
  world.supportTime+=dt;
  const api=world.ghostElfAPI;
  api.step(dt);
  if(!api.controlledUpdate(dt,api.driveStick(drive)))player.update(dt,world.buildings,drive);
  api.syncBody(dt);
  if(hidden){
   api.clearTarget(threat);
   threat.update(dt,api.targets([player]),[],[],[],world.trollBase,[]);
   threat.animTrack(dt);
  }else if(api.host){api.hostTick(bat,dt);bat.animTrack(dt);}
  player.animTrack(dt);
 };
 stage=create(key,live,{world,x,y,threat,bat,depot,owner,home,tick,now,
  setDrive(dx,dy){drive=dx||dy?{dx,dy}:null;}},(_,f)=>scope(f));
 if(!stage)return null;
 const caption=()=>[stage.effect()||({ghostStealth:'恶魔正在追踪幽灵精灵。',ghostPossess:'附身蝙蝠后，飞近有资源的仓库。',batRaid:'蝙蝠从仓库偷取资源。'})[key]];
 let surface=null;
 return {length:5600,step(dt){clock+=Math.max(0,Number(dt)||0);stage.advance(clock);},draw(c,rect){
   const width=Math.ceil(rect.w),height=Math.ceil(rect.h);
   if(!surface||surface.width!==width||surface.height!==height)surface=makeCanvas?.(width,height);
   const layer=surface?.getContext('2d');
   if(!layer)return stage.paint(c,rect);
   layer.clearRect(0,0,width,height);
   if(!stage.paint(layer,{x:0,y:0,w:width,h:height}))return false;
   c.drawImage(surface,rect.x,rect.y,rect.w,rect.h);return true;
  },caption,
  dispose(){surface=null;try{stage.stop();}finally{close();}}};
}
module.exports={createRole,prime};
