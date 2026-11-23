'use strict';
// Independent integration candidate. Persist this data WITH card inbox in one
// existing world snapshot. No writes, awaits, reward attribution, or combat edits.
const idOK=s=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,96}$/.test(s);
function validate(d){if(!d||d.version!==1||!idOK(d.matchId)||!Number.isSafeInteger(d.serial)||d.serial<0||!Array.isArray(d.pending))throw Error('Invalid stone outbox');const ids=new Set();for(const e of d.pending){if(!idOK(e.id)||ids.has(e.id)||(e.cardCount!==undefined&&![1,2,3].includes(e.cardCount))||!Number.isInteger(e.wave)||e.wave<10||e.wave%10||!Number.isInteger(e.lane)||e.lane<0||e.lane>32||e.sourceOwner!==null&&(!Number.isInteger(e.sourceOwner)||e.sourceOwner<0||e.sourceOwner>32))throw Error('Invalid stone event');ids.add(e.id);}return d;}
function create({game:g,matchIdFactory,sink,pressureLimit=4096}){
 let draining=false,lastData=null;
 function ensure(){if(!g.stoneCardData){const matchId=matchIdFactory();g.stoneCardData=validate({version:1,matchId,serial:0,pending:[],pressure:false});}if(lastData!==g.stoneCardData){validate(g.stoneCardData);lastData=g.stoneCardData;}return g.stoneCardData;}
 function assign(b){const d=ensure();if(b.stoneRewardMatchId===d.matchId&&idOK(b.stoneRewardId))return b.stoneRewardId;if(d.serial>=Number.MAX_SAFE_INTEGER)throw Error('Stone serial exhausted');b.stoneRewardId='stone:'+ ++d.serial;b.stoneRewardMatchId=d.matchId;return b.stoneRewardId;}
 function capture(b,source){const d=ensure();if(b.stoneRewardEmitted===d.matchId)return{captured:true,duplicate:true};const id=assign(b);const event=Object.freeze({id,wave:b.waveNumber,lane:b.waveZoneIndex,sourceOwner:source?.rewardOwnerSlot??null,localEligible:source?.localEligible===true,cardCount:source?.cardCount??1});validate({...d,pending:[event]});d.pending.push(event);b.stoneRewardEmitted=d.matchId;d.pressure=d.pending.length>=pressureLimit;return{captured:true,pressure:d.pressure};}
 function drain(limit=4){if(draining)return 0;const d=ensure();draining=true;let accepted=0;try{for(let i=0,attempts=0;i<d.pending.length&&attempts<limit;attempts++){const event=d.pending[i];let result;try{result=sink?.({matchId:d.matchId,event});}catch(_){result=null;}if(result?.accepted===true){d.pending.splice(i,1);accepted++;}else i++;}d.pressure=d.pending.length>=pressureLimit;return accepted;}finally{draining=false;}}
 function migrateLegacy(bosses,events=[]){const d=ensure();if(d.legacyMigrated)return d;for(const b of bosses||[])if(b.waveStone)assign(b);for(const e of events){if(d.pending.some(p=>p.legacyId===e.id))continue;const b={waveNumber:e.wave,waveZoneIndex:e.lane};assign(b);const p={id:b.stoneRewardId,wave:e.wave,lane:e.lane,sourceOwner:e.sourceOwner??null,legacyId:e.id,migrated:true};validate({...d,pending:[p]});d.pending.push(p);}d.pressure=d.pending.length>=pressureLimit;d.legacyMigrated=true;return d;}
 return{ensure,assign,capture,drain,migrateLegacy,validate};
}
module.exports={create,validate};
