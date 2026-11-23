'use strict';
// Round setup chooses a patrol destination, not a visible enemy or attack target.
// Only fixed opening seat/zone metadata is used; moving units remain normally visible.
function distribution(humans,ais){
 const rows=[...humans.map(zone=>({zone,human:true})),...ais.map(zone=>({zone,human:false}))];
 if(!rows.length)return rows;
 const humanShare=ais.length?Math.min(.1,1/Math.max(1,humans.length)):1/Math.max(1,humans.length);
 const aiShare=ais.length?(1-humanShare*humans.length)/ais.length:0;
 for(const row of rows)row.probability=row.human?humanShare:aiShare;
 return rows;
}
// With no computer allies, vacant real patrol zones share the remaining 90%.
function soloEmptyDistribution(human,n){
 const empty=Array.from({length:n},(_,zone)=>zone).filter(zone=>zone!==human);
 if(!empty.length)return [{zone:human,human:true,probability:1}];
 return [{zone:human,human:true,probability:.1},...empty.map(zone=>({zone,human:false,probability:.9/empty.length}))];
}
function choose(rows,draw){if(!rows.length)return null;let left=Math.max(0,Math.min(1-Number.EPSILON,draw));for(const row of rows){if(left<row.probability)return row;left-=row.probability;}return rows[rows.length-1];}
function installOpeningPatrolLottery(battle,random){
 const g=battle.g,t=g.troll;
 if(!t||t.openingPatrolLotteryBF||g.tutorial||g.superChallenge580||g.state!=='prep'||(g.huntElapsed||0)>0||g.prepTimeLeft<59.9)return null;
 const n=t.searchZones?.length||0;if(!n)return null;
 const valid=z=>Number.isInteger(z)&&z>=0&&z<n;
 const humans=(battle.players||[]).map(p=>Number.isInteger(p.zone)?p.zone:p.body===g.player?g.playerStartZoneIndex:null);
 const ais=(g.allies||[]).map(a=>a.homeZoneIndex);
 if(!humans.every(valid)||!ais.every(valid)||new Set([...humans,...ais]).size!==humans.length+ais.length)return null;
 const soloEmpty=battle.soloMultiAi===true&&humans.length===1&&ais.length===0&&['medium','crazy'].includes(g.trollDifficulty);
 const rows=soloEmpty?soloEmptyDistribution(humans[0],n):distribution(humans,ais),picked=choose(rows,random());if(!picked)return null;
 // Supersedes the old first-crazy two-zone human exemption in ordinary rounds.
 // Challenge is excluded above. No visibility, damage or combat-filter overrides.
 t.searchStartIndex=picked.zone;t.openingProtectedZone541=-1;t.openingVisited541=[];
 if(g.networkOpeningZoneProtected627)g.networkOpeningZoneProtected627=()=>false;
 t.patrolTarget=null;t.searchPoint=null;t.navPath=[];t.navPathIndex=0;t.navRouteKey=null;
 t.openingPatrolLotteryBF={schema:1,zone:picked.zone,human:picked.human,humanCount:humans.length,aiCount:ais.length,perHumanProbability:rows.find(r=>r.human)?.probability||0};
 return t.openingPatrolLotteryBF;
}
function openingDraw(battle){const clock=battle.runtime?.checkpointClock?.();return Number.isInteger(clock?.random)?((Math.imul(clock.random,1664525)+1013904223)>>>0)/4294967296:Math.random();}
module.exports={distribution,choose,installOpeningPatrolLottery,openingDraw};
