'use strict';

const boost = require('./monster-rewards');
const batRoster=require('./bat-wave-roster');
const STABLE_AT = 260; // Native floors plateau; growing stone floor wins the cycle by here.
const MAX_BONUS = 1000000000;
const scope = (g, win) => !!g && !g.tutorial && !g.superChallenge580 &&
  !g.networkAuthorityPhases627 &&
  win.networkDefenseModeBN?.() !== true &&
  win.batSoloPolicyBN?.allows?.(g) === true &&
  g.mammothCandidate?.enabled?.() === true &&
  g.stoneBossCandidate?.enabled?.() === true &&
  win.batWaveCandidateBN?.enabled?.(g) === true;

function nativeCount(wave, phase) {
  return phase === 2 ? 8 : Math.min(20, 10 + Math.floor((wave - 1) / 5));
}
function encounter(wave) {
  if (wave % 10 === 6) return 'mammoth';
  if (wave % 10 === 8) return 'bat';
  if (wave % 10 === 0) return 'stone';
  return 'slime';
}
const validWave = w => Number.isSafeInteger(w) && w >= 1 && w <= 200000000;
const validPhase = p => Number.isInteger(p) && p >= 0 && p <= 2;
const extra = e => Number.isSafeInteger(e?.soloWaveBountyExtraR51) &&
  e.soloWaveBountyExtraR51 >= 0 && e.soloWaveBountyExtraR51 <= MAX_BONUS ? e.soloWaveBountyExtraR51 : 0;

function create(slimeBase, batBase) {
  // All current difficulties use the same cash coefficient. The callback still gets
  // the real difficulty; cache each of the three allowed inputs separately.
  const cache = new Map();
  function floors(wave, phase, difficulty) {
    const type = encounter(wave), raw = slimeBase(wave, difficulty);
    const count = type==='slime'?nativeCount(wave,phase):type==='mammoth'?5:type==='bat'?4:1;
    const primary = boost(type==='slime'?raw:type==='mammoth'?Math.ceil(raw*1.5):
      type==='bat'?batBase(wave):Math.max(12,raw*2));
    const fragments = type==='slime'&&phase===2?2*count*primary:0;
    return {type,count,primary,total:count*primary+fragments};
  }
  function schedule(wave,difficulty) {
    if (!validWave(wave)) return null;
    if (!['easy','medium','crazy'].includes(difficulty)) return null;
    let table=cache.get(difficulty);
    if(!table){table=[null];cache.set(difficulty,table);}
    const last=Math.min(wave,STABLE_AT+10);
    for(let n=table.length;n<=last;n++){
      const prev=table[n-1];
      const ordinary=floors(n,0,difficulty), dragon=floors(n,2,difficulty);
      const step=ordinary.type==='stone'?5:1;
      const stoneFloor=ordinary.type==='stone'?120+40*(n/10-1):0;
      const early=Math.max(ordinary.total,stoneFloor,(prev?.early??0)+step);
      const mixed=ordinary.type==='slime'?early+2*ordinary.count*ordinary.primary:early;
      const late=Math.max(dragon.total,early,(prev?.late??0)+step,(prev?.mixed??0)+step);
      table.push({early,mixed,late});
    }
    if (wave<=STABLE_AT+10) return table[wave];
    // Both curves then translate by +40 over each ten-wave cycle. Use bounded
    // lookup even on a far-future save; later levels never allocate extra rows.
    const cycles=Math.floor((wave-STABLE_AT-1)/10);
    const t=table[wave-cycles*10], add=cycles*40;
    return {early:t.early+add,late:t.late+add,mixed:t.mixed+add};
  }
  function stamp(g, win, entity, ordinal, kind, admitted, stoneBirthTag) {
    // A retained Stone reservation keeps its original boss-wave phase across later ordinary windows.
    const tag=kind==='stone'&&stoneBirthTag?stoneBirthTag:g.soloWaveRewardWindowR51, wave=entity.waveNumber;
    const ranged=kind==='rangedTroll'&&entity.waveRangedTrollBN===true&&wave%10===7;
    const griffin=kind==='griffin'&&entity.waveGriffinBN===true&&wave%10===9;
    if (!scope(g,win)||tag?.wave!==wave||!validPhase(tag.phase)||encounter(wave)!==(ranged||griffin?'slime':kind)) return;
    const row=schedule(wave,g.trollDifficulty);if(!row)return;
    // More bats share the old full-lane budget. A partial queue keeps its
    // original denominator, so missing births cannot inflate payouts.
    if(kind==='bat'&&entity.waveBat===true&&admitted===batRoster.scheduled(wave)&&admitted>batRoster.LEGACY){
      if(!Number.isInteger(ordinal)||ordinal<0||ordinal>=admitted)return;
      const payout=tag.phase===2?row.late:row.early;
      const share=Math.floor(payout/admitted)+(ordinal<payout%admitted?1:0);
      if(batRoster.validShare(share))entity.batWaveBountyShareBN=share;
      return;
    }
    const floor=floors(wave,tag.phase,g.trollDifficulty);
    // Ordinary births may be reduced by the shared live cap or a blocked
    // spawn point. Deferred legacy specials retain their original rule.
    const actual=
      (kind==='slime'||ranged||griffin)&&Number.isSafeInteger(admitted)&&admitted>0?
      Math.min(admitted,floor.count):floor.count;
    if(!Number.isInteger(ordinal)||ordinal<0||ordinal>=actual)return;
    const native=actual*floor.primary*(kind==='slime'&&tag.phase===2?3:1);
    const amount=(tag.phase===2?row.late:row.early)-native;
    const bonus=Math.floor(amount/actual)+(ordinal<amount%actual?1:0);
    // Never edit base bounty, never attach anything to split children, never
    // allocate a recurring ledger. Existing per-entity save and paid flags apply.
    if (bonus>0&&bonus<=MAX_BONUS)entity.soloWaveBountyExtraR51=bonus;
  }
  return {floors,schedule,stamp};
}
module.exports={scope,create,extra,nativeCount,encounter,STABLE_AT};
