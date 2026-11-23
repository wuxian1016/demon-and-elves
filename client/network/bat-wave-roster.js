'use strict';
const LEGACY=4,FIRST=6,MAX=8,MAX_REWARD_SHARE=1000000000;
const isBatWave=n=>Number.isSafeInteger(n)&&n>=8&&(n-8)%10===0;
// Only newly scheduled rounds use the stepped roster. Old pending rows
// deliberately retain their original size, including after save/load.
const scheduled=n=>isBatWave(n)?Math.min(MAX,FIRST+(n-8)/10):LEGACY;
const pending=q=>q.rosterBN??LEGACY;
const valid=q=>q.rosterBN===undefined||isBatWave(q.wave)&&q.batScheduleBN===2&&q.rosterBN===scheduled(q.wave)&&q.rosterBN>LEGACY&&Array.isArray(q.countsBN);
const validShare=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX_REWARD_SHARE;
module.exports={LEGACY,MAX,scheduled,pending,valid,validShare};
