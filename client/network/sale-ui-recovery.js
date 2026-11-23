'use strict';
const SELECTIONS=['selectedBuilding','builtSelectedBuilding','sellConfirmation','builtSaleConfirmation','rangeInspect548'];
// Local modal state only. Never changes entities, currency or authority sequence.
class SaleUiRecovery{
 constructor(game,clock){this.game=game;this.clock=clock;this.pending=new Map();this.events=[];this.last=null;this.counts={requests:0,uiReleased:0,acked:0,rejected:0,applied:0,timeouts:0,inputSampled:0};}
 event(stage,entry,extra={}){const row={atMs:this.clock(),stage,seq:entry?.seq??null,epoch:entry?.epoch??null,...extra};this.events.push(row);if(this.events.length>96)this.events.shift();this.last=row;const counter={request:'requests','ui-released':'uiReleased','business-ack':'acked','business-rejected':'rejected','authority-applied':'applied','timeout-unconfirmed':'timeouts','input-sampled':'inputSampled'}[stage];if(counter)this.counts[counter]++;}
 expire(){const now=this.clock();for(const [seq,e]of this.pending)if(now-e.atMs>=15000){this.event('timeout-unconfirmed',e);this.pending.delete(seq);}}
 waiting(id,epoch){this.expire();return [...this.pending.values()].some(e=>e.targetId===id&&e.epoch===epoch);}
 begin(command){const e={seq:command.seq,epoch:command.epoch,targetId:command.targetId,atMs:this.clock(),drawn:false};this.pending.set(e.seq,e);if(this.pending.size>32)this.pending.delete(this.pending.keys().next().value);this.event('request',e);return e;}
 submitted(seq){const e=this.pending.get(seq);if(!e)return;this.event('submitted',e);let closed=0;for(const key of SELECTIONS)if(this.game[key]?.networkId===e.targetId){this.game[key]=null;closed++;}this.game.wxUiDirty=true;this.event('ui-released',e,{closed,elapsedMs:Math.max(0,this.clock()-e.atMs),joystickAvailable:!!this.game.joystickAvailable?.()});}
 failed(seq,stage='submission-failed'){const e=this.pending.get(seq);if(e){this.event(stage,e);this.pending.delete(seq);}}
 acknowledge({epoch,seq,ok}){const e=this.pending.get(seq);if(!e||e.epoch!==epoch)return;this.event(ok?'business-ack':'business-rejected',e,{elapsedMs:Math.max(0,this.clock()-e.atMs)});if(!ok)this.pending.delete(seq);}
 input(command){if(command.action!=='joystick')return;for(const e of this.pending.values())if(!e.inputSampled){e.inputSampled=true;this.event('input-sampled',e,{inputSeq:command.seq,active:!!(command.args.dx||command.args.dy),elapsedMs:Math.max(0,this.clock()-e.atMs)});}}
 applying(){if(this.pending.size)this.event('authority-apply-start');}
 commit(view){this.expire();for(const [seq,e]of this.pending){if(e.epoch!==view.epoch){this.event('epoch-replaced',e);this.pending.delete(seq);continue;}if((view.lastSeq??-1)<seq)continue;const target=view.entities.get(e.targetId);this.event('authority-applied',e,{tick:view.tick,revision:view.revision,targetDead:target?.dead===true,targetAbsent:!target,elapsedMs:Math.max(0,this.clock()-e.atMs),joystickAvailable:!!this.game.joystickAvailable?.()});this.pending.delete(seq);}}
 drawn(){if(!this.last||this.last.stage==='draw-complete')return;this.event('draw-complete',this.last,{joystickAvailable:!!this.game.joystickAvailable?.()});}
 summary(){this.expire();return {...this.counts,pending:this.pending.size,lastStage:this.last?.stage??null};}
 report(){this.expire();return {scope:'Same-client monotonic UI timeline. Submission/ACK do not prove sale or refund; only authority applies world state. Draw is JS completion, not GPU presentation.',summary:this.summary(),pending:this.pending.size,capacity:96,timeoutMs:15000,events:this.events.map(e=>({...e}))};}
 reset(){this.pending.clear();this.events.length=0;this.last=null;for(const key of Object.keys(this.counts))this.counts[key]=0;}
}
function restoreLiveSelections(game,entities,selections){for(const key of SELECTIONS){const entity=entities.get(selections[key]);game[key]=entity&&!entity.dead?entity:null;}}
module.exports={SaleUiRecovery,restoreLiveSelections};
