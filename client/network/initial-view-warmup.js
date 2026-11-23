'use strict';
const RETRY_REASONS=new Set(['cancelled','superseded','world-changed','artwork-changed','water-changed','cache-changed','view-changed','scene-changed','buildings-changed','vision-changed','state-changed','text-mode-changed','snapshot-changed','actor-changed']);
const PHASES=Object.freeze([
 ['terrain','prepareTerrainTilesViewAsync','地形视区准备'],
 ['fog','prepareFogCachesViewAsync','视野画面准备'],
 ['hud','prepareHudCachesViewAsync','状态栏准备'],
 ['actor','prepareLocalActorPosesAsync','角色动画准备']
]);
const counts=value=>Number.isSafeInteger(value?.done)&&Number.isSafeInteger(value?.total)&&value.done>=0&&value.total>=value.done?{done:value.done,total:value.total}:{};
async function warmInitialView({game,world,keepGoing=()=>true,onProgress=()=>{},schedule,sliceMs=2}){
 const stages=[];let partial=null,last={};
 for(const [stage,method,label]of PHASES){
  if(!keepGoing())return{complete:false,published:stages.some(s=>s.published),reason:'cancelled',stages,...counts(last)};
  if(typeof game[method]!=='function')continue;
  if(stage==='actor'&&game.localActorPoseWarmupSupported?.()===false)continue;
  let result;
  try{result=await game[method](world,{keepGoing,schedule,sliceMs,onProgress:value=>{if(keepGoing())onProgress({...counts(value),stage,label});}});}
  catch(error){if(!keepGoing())return{complete:false,published:stages.some(s=>s.published),reason:'cancelled',stages,...counts(last)};throw error;}
  if(!keepGoing())return{complete:false,published:stages.some(s=>s.published),reason:'cancelled',stages,...counts(last)};
  const row={stage,label,complete:result?.complete===true,published:result?.published===true,reason:typeof result?.reason==='string'?result.reason:'unsupported-result',...counts(result)};
  stages.push(row);last=row;
  if(!row.complete){partial||=row;if(RETRY_REASONS.has(row.reason))return{...row,complete:false,published:stages.some(s=>s.published),stages};}
 }
 return{complete:!partial,published:stages.some(s=>s.published),reason:partial?.reason||'ready',...counts(last),label:last.label,stages};
}
module.exports={warmInitialView};
