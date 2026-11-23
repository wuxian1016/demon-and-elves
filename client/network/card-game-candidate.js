'use strict';
const {CardState,validate,GHOST}=require('./card-state');
const {RewardInbox,validate:validateInbox}=require('./card-reward-inbox');
// Offline-only adapter. The multiplayer server must own award/use/tick before rollout.
// No fixture setup, no injected enemies, no fake global charges or scene reset.
function install(g,{types,offline,storm=null,stormWorld=null,scope=e=>e===g.player||e?.ownerSlot==null,hpPolicy=null,soloRewards=false,onEvent=()=>{}}){
 if(g.cardsCandidate)return g.cardsCandidate;
 const active=()=>offline()===true&&!g.tutorial&&['prep','hunt'].includes(g.state);
 if(!storm&&soloRewards&&stormWorld)storm=require('./card-storm-policy').create(g,stormWorld);
 const core=new CardState({owner:'local',authority:active,storm,onEvent:e=>{onEvent(e);g.cardPresentation?.onEvent(e);}});
 const stormImpact=require('./card-storm-impact').create({game:g,authority:active,getStunPolicy:()=>core.storm?.stunPolicy,getDamagePolicy:()=>core.storm?.damagePolicy});
 let player=g.player,lastData=null,inbox=null,lastScan=null;
 // Reset the live controller before terrain's first yield. An opening frame
 // may render before the first tick, and the old player still exists here.
 function resetRound(){
  core.state=new CardState({owner:'local'}).state;
  player=g.player;g.cardStateData=lastData=core.state;
  inbox=null;lastScan=null;
  g.cardPresentation?.restore();g.cardEffectHudBN?.clear();
 }
 function prepareRewardInbox(matchId){if(g.cardRewardInboxData){validateInbox(g.cardRewardInboxData);if(g.cardRewardInboxData.matchId!==matchId)throw Error('Reward match mismatch');}inbox=new RewardInbox({matchId,authority:active,resolveEnabled:soloRewards});if(g.cardRewardInboxData)inbox.restore(g.cardRewardInboxData);g.cardRewardInboxData=inbox.state;return inbox;}
 const acceptStoneDefeat=require('./card-defeat-handoff').create({getInbox:()=>inbox});
 function recordStoneDefeat(event){if(!inbox)return{ok:false,reason:'stable-match-id-pending'};return inbox.record(event);}
 const bind=()=>{if(g.cardStateData!==lastData&&g.cardStateData){core.restore(g.cardStateData);lastData=g.cardStateData;}else if(player!==g.player&&!g.cardStateData){core.state=new CardState({owner:'local'}).state;lastData=null;if(!g.cardRewardInboxData)inbox=null;g.cardPresentation?.restore();}player=g.player;g.cardStateData=core.state;lastData=core.state;};
 const mods=e=>active()&&scope(e)?core.modifiers():{attack:1,attackSpeed:1,harvest:1,maxHp:1,armor:1,invulnerable:false};
 const wrap=(proto,name,fn)=>{if(typeof proto?.[name]!=='function')return;const before=proto[name];proto[name]=function(...args){return fn.call(this,before,args);};};
 for(const [Type,damage,speed] of [[types.Building,'attackDamage','attackInterval'],[types.Player,'relicDamageAgainst',null]]){
  wrap(Type?.prototype,damage,function(before,args){return before.apply(this,args)*mods(this).attack;});
  if(speed)wrap(Type?.prototype,speed,function(before,args){return before.apply(this,args)/mods(this).attackSpeed;});
 }
 // Native takeDamage retains all rewards/death events; shield rejects only scoped targets.
 for(const Type of [types.Building,types.Player,types.Tank,types.Peasant])wrap(Type?.prototype,'takeDamage',function(before,args){if(mods(this).invulnerable)return;return before.apply(this,args);});
 const syncHp=()=>{if(hpPolicy!=='preserve-ratio')return;for(const b of g.buildings||[]){if(b.dead)continue;const wanted=mods(b).maxHp,was=b.cardHpFactor||1;if(wanted===was)continue;const ratio=b.maxHp>0?b.hp/b.maxHp:0;b.maxHp=b.maxHp/was*wanted;b.hp=Math.max(0,Math.min(b.maxHp,b.maxHp*ratio));b.cardHpFactor=wanted;}};
 wrap(types.Building?.prototype,'applyLevelStats',function(before,args){this.cardHpFactor=1;const result=before.apply(this,args);if(hpPolicy==='preserve-ratio'){const m=mods(this).maxHp;this.maxHp*=m;this.hp*=m;this.cardHpFactor=m;}return result;});
 function use(command){bind();const card=core.state.hand.find(c=>c.id===command.cardId);if(card?.type===GHOST){if(!active()||g.player?.dead||g.player?.ghostElf||!g.ghostElfAPI?.canTransform())return{ok:false,reason:'profession-unavailable'};const result=core.discardGhost(command);if(result.ok){g.ghostElfAPI.transform();result.remaining=0;}return result;}if(card?.type==='storm'&&core.storm?.approved===true&&typeof core.storm.stunPolicy!=='function')return{ok:false,reason:'storm-immunity-policy-pending'};if(card?.type==='fortress'&&hpPolicy!=='preserve-ratio')return{ok:false,reason:'fortress-hp-policy-pending'};const result=core.use(command);if(result.ok)syncHp();return result;}
 // Stable per-match draw: retries and save/load never reroll a boss's reward.
 function settleSoloReward(){
  if(!soloRewards||!inbox||!g.cardPresentation)return;
  const events=inbox.state.events, used=core.state.lastCommand;
  if(lastScan?.events===events&&lastScan.count===events.length&&lastScan.used===used&&lastScan.granted===core.state.lastAward)return;
  lastScan={events,count:events.length,used,granted:core.state.lastAward};
  const event=events.find(e=>e.status==='pending'&&e.localEligible===true);
  if(!event)return;
  const remaining=(event.cardCount??1)-(event.cardsGranted??0);
  for(let i=0;i<remaining;i++){
   const ordinal=event.cardsGranted??0;
   let roll=2166136261;for(const ch of inbox.state.matchId+':'+event.id+(ordinal?':'+ordinal:''))roll=Math.imul(roll^ch.charCodeAt(0),16777619);
  roll=Math.imul(roll^(roll>>>16),0x85ebca6b);roll^=roll>>>13;
  const pool=core.storm?.approved===true?['fury','harvest','fortress','sanctuary','storm']:['fury','harvest','fortress','sanctuary'];
  const type=pool[(roll>>>0)%pool.length];
   if(!inbox.resolve(event.id,{owner:'local',type},api).ok)break;
  }
 }
 function tick(dt){bind();if(!active())return;settleSoloReward();const policy=core.storm;const stormAllowed=policy?.approved===true&&typeof policy.stunPolicy==='function'&&core.state.effects.filter(e=>e.type==='storm').every(e=>(e.damagePerSecond===policy.damagePerSecond||policy.acceptsDamagePerSecond?.(e.damagePerSecond)===true)&&e.area.radius===policy.radius);const step=Number.isFinite(dt)&&dt>=0&&dt<=1000?dt:0;if(!stormAllowed)for(const e of core.state.effects)if(e.type==='storm'){e.starts+=step;e.ends+=step;}core.advance(dt);for(const p of stormAllowed?core.stormPulses():[]){
  stormImpact.apply(p);
 }core.expire();syncHp();}
 for(const name of ['applySavedWorld']){const before=g[name];if(typeof before==='function')g[name]=function(...args){const result=before.apply(this,args);bind();if(g.cardRewardInboxData)prepareRewardInbox(g.cardRewardInboxData.matchId);return result;};}
 // Only the native local demon bounty can invoke this prototype reward.
 function awardDemonProfession(stage){bind();if(g.player?.ghostElf||!soloRewards||!active()||![0,1,2].includes(stage))return{ok:false,reason:'not-eligible'};
  // First stage and dragon are fixed; the phase-two table has one approved candidate.
  // Selecting a singleton cannot reroll or perturb the game's random stream.
  return core.award({owner:'local',serial:core.state.lastAward+1,type:GHOST,quickCollect:false});
 }
 const api={core,awardDemonProfession,discardGhost:command=>{bind();return core.discardGhost(command);},stormImpact,isStormSource:stormImpact.isSource,consumeStormStun:stormImpact.consumeStun,prepareRewardInbox,acceptStoneDefeat,recordStoneDefeat,tick,use,resetRound,reconcileRestoredHp(){if(active())syncHp();},award:command=>{bind();return core.award(command);},mods,validate,bind,scopeStatus:'local-owner candidate; team/multiplayer policy pending',hpPolicy,soloRewards,stormConfigured:storm?.approved===true};
 Object.defineProperty(g,'cardsCandidate',{value:api});return api;
}
module.exports={install,validate};
