'use strict';
// Simulation-time, authority-only candidate. Unapproved choices fail without consumption.
const NEUTRAL=Object.freeze({attack:1,attackSpeed:1,harvest:1,maxHp:1,armor:1,invulnerable:false});
const MAX_HAND=3;
const TYPES=['fury','harvest','fortress','sanctuary','storm'];
const GHOST='ghost';
const canHold=(hand,type)=>type===GHOST?!hand.includes(GHOST):hand.filter(t=>t!==GHOST).length<MAX_HAND;
const DURATIONS={fury:60000,harvest:60000,fortress:120000,sanctuary:30000,storm:6000};
// Already activated legacy boosts retain the remaining time in their saved round.
const LEGACY_DURATIONS={fury:120000,harvest:120000,fortress:60000};
const durationValid=(type,ms)=>Math.abs(ms-DURATIONS[type])<=1e-6||Math.abs(ms-LEGACY_DURATIONS[type])<=1e-6;
const validId=s=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,96}$/.test(s);
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const copy=x=>JSON.parse(JSON.stringify(x));
function validate(s){
 if(!s||s.version!==1||!validId(s.owner)||!finite(s.time)||!['serial','lastCommand','lastAward'].every(k=>Number.isSafeInteger(s[k])&&s[k]>=0)||!Array.isArray(s.hand)||s.hand.length>MAX_HAND+1||s.hand.filter(c=>c?.type===GHOST).length>1||s.hand.filter(c=>c?.type!==GHOST).length>MAX_HAND||!Array.isArray(s.effects)||s.effects.length>5)throw Error('Invalid card snapshot');
 const ids=new Set();for(const c of s.hand){if(!validId(c.id)||ids.has(c.id)||!(TYPES.includes(c.type)||c.type===GHOST)||!Number.isInteger(c.uses)||c.uses<1||c.uses>(c.type==='storm'?3:1))throw Error('Invalid card instance');ids.add(c.id);}
 for(const e of s.effects){if(!validId(e.id)||ids.has(e.id)||!TYPES.includes(e.type)||!finite(e.starts)||!finite(e.ends)||!durationValid(e.type,e.ends-e.starts)||e.starts>s.time||!validId(e.sourceCard))throw Error('Invalid card effect');ids.add(e.id);if(e.type==='storm'&&(!e.area||!Number.isFinite(e.area.x)||!Number.isFinite(e.area.y)||!finite(e.area.radius)||e.area.radius<=0||!finite(e.damagePerSecond)||!Number.isInteger(e.ticksApplied)||e.ticksApplied<0||e.ticksApplied>24))throw Error('Invalid storm');}return s;
}
class CardState{
 constructor({owner='local',authority=()=>false,storm=null,onEvent=()=>{}}={}){this.state=validate({version:1,owner,time:0,serial:0,lastCommand:0,lastAward:0,hand:[],effects:[]});this.authority=authority;this.storm=storm;this.onEvent=onEvent;}
 snapshot(){return copy(validate(this.state));}
 restore(value){const next=copy(validate(value));if(next.owner!==this.state.owner)throw Error('Wrong card owner');this.state=next;}
 event(e){try{this.onEvent(e);}catch(_){/* UI failure cannot undo committed gameplay. */}}
 award({serial,type,owner,quickCollect=false}){const s=this.state;let reason=!this.authority()?'not-authority':owner!==s.owner?'wrong-owner':!Number.isSafeInteger(serial)||serial<1||!(TYPES.includes(type)||type===GHOST)?'invalid-award':serial<=s.lastAward?'duplicate-award':serial!==s.lastAward+1?'award-order':null;if(reason)return{ok:false,reason};const room=canHold(s.hand.map(c=>c.type),type);if(type===GHOST&&!room)return{ok:false,reason:'ghost-already-held'};const card={id:s.owner+':card:'+(++s.serial),type,uses:type==='storm'?3:1};const dropped=room?null:s.hand.splice(s.hand.findIndex(c=>c.type!==GHOST),1)[0];s.hand.push(card);s.lastAward=serial;const result={ok:true,card:copy(card)};if(dropped)result.replacedCardId=dropped.id;this.event({kind:'award',card:copy(card),replacedCardId:dropped?.id,...(quickCollect===true?{quickCollect:true}:{})});return result;}
 use({sequence,owner,cardId,confirmed,area}){const s=this.state;let reason=!this.authority()?'not-authority':owner!==s.owner?'wrong-owner':!Number.isSafeInteger(sequence)||sequence<1?'invalid-sequence':sequence<=s.lastCommand?'duplicate-command':sequence!==s.lastCommand+1?'command-order':confirmed!==true?'confirmation-required':null;if(reason)return{ok:false,reason};const card=s.hand.find(c=>c.id===cardId);if(!card)return{ok:false,reason:'missing-card'};if(card.type===GHOST)return{ok:false,reason:'profession-pending'};if(s.effects.some(e=>e.type===card.type&&e.ends>s.time))return{ok:false,reason:'stacking-policy-pending'};
 let target=null;if(card.type==='storm'){const p=this.storm;if(!p||p.approved!==true||!finite(p.radius)||p.radius<=0||!finite(p.damagePerSecond)||typeof p.validateArea!=='function')return{ok:false,reason:'storm-balance-pending'};if(!area||!Number.isFinite(area.x)||!Number.isFinite(area.y))return{ok:false,reason:'invalid-area'};target={x:area.x,y:area.y,radius:p.radius};if(p.validateArea(target,s.owner)!==true)return{ok:false,reason:'invalid-area'};}
 const effect={id:s.owner+':effect:'+sequence,sourceCard:card.id,type:card.type,starts:s.time,ends:s.time+DURATIONS[card.type]};if(target)Object.assign(effect,{area:target,damagePerSecond:this.storm.damagePerSecond,ticksApplied:0});s.lastCommand=sequence;s.effects=s.effects.filter(e=>e.ends>s.time);s.effects.push(effect);card.uses--;if(!card.uses)s.hand.splice(s.hand.indexOf(card),1);this.event({kind:'use',effect:copy(effect),remaining:card.uses});return{ok:true,effect:copy(effect),remaining:card.uses};}
 discardGhost({sequence,owner,cardId,confirmed}={}){const s=this.state;if(!this.authority()||owner!==s.owner||confirmed!==true||!Number.isSafeInteger(sequence)||sequence!==s.lastCommand+1)return{ok:false,reason:'invalid-discard'};const i=s.hand.findIndex(c=>c.id===cardId&&c.type===GHOST);if(i<0)return{ok:false,reason:'missing-ghost'};s.hand.splice(i,1);s.lastCommand=sequence;return{ok:true};}
 advance(dt){if(!this.authority()||!finite(dt)||dt>1000)return false;this.state.time+=dt;return true;}
 stormPulses(){if(!this.authority())return[];const out=[];for(const e of this.state.effects){if(e.type!=='storm')continue;const due=Math.min(24,Math.floor((Math.min(this.state.time,e.ends)-e.starts)/250));while(e.ticksApplied<due){e.ticksApplied++;out.push({id:e.id+':'+e.ticksApplied,area:copy(e.area),damage:e.damagePerSecond/4,stunMs:Math.min(250,Math.max(0,e.ends-this.state.time)),owner:this.state.owner});}}return out;}
 expire(){if(!this.authority())return;this.state.effects=this.state.effects.filter(e=>{if(e.ends>this.state.time)return true;this.event({kind:'expired',effect:copy(e)});return false;});}
 modifiers(owner=this.state.owner){if(owner!==this.state.owner)return NEUTRAL;if(this.cacheState===this.state&&this.cacheTime===this.state.time&&this.cacheCommand===this.state.lastCommand)return this.cached;const active=new Set(this.state.effects.filter(e=>e.ends>this.state.time).map(e=>e.type));this.cacheState=this.state;this.cacheTime=this.state.time;this.cacheCommand=this.state.lastCommand;return this.cached={attack:active.has('fury')?6:1,attackSpeed:active.has('fury')?2:1,harvest:active.has('harvest')?2:1,maxHp:active.has('fortress')?2:1,armor:active.has('fortress')?2:1,invulnerable:active.has('sanctuary')};}
}
module.exports={CardState,TYPES,DURATIONS,MAX_HAND,GHOST,canHold,validate};
