"use strict";
// Display preparation only: no Game.prepareInitialScene/AI routes or simulation.
// Counts are per named phase; a budget/memory skip is never counted as baked work.
async function warmSceneRendering({art,world,keepGoing=()=>true,onProgress=()=>{},schedule,sliceMs=4,includeCollectPoses=true}) {
 if(!keepGoing())return false;
 if(!art||typeof art.prepareGroundRender!=='function')throw Error('SCENE_RENDER_WARMUP_UNAVAILABLE');
 const peasant=includeCollectPoses&&typeof art.prepareInitialPeasantCollectPoses==='function',minimap=typeof art.prepareMinimapRender==='function',options={keepGoing,...(schedule?{schedule}:{})};
 const ground=await art.prepareGroundRender(world,{...options,sliceMs,onProgress:peasant||minimap?p=>onProgress({...p,phase:'ground',label:'地面准备'}):onProgress});
 if(!ground||!keepGoing())return false;
 if(minimap){
  const result=await art.prepareMinimapRender(world,{...options,sliceMs,onProgress:p=>onProgress({...p,phase:'minimap',label:'小地图准备'})});
  if(!result.complete||!keepGoing())return false;
 }
 if(!peasant)return true;
 const result=await art.prepareInitialPeasantCollectPoses({...options,budgetMs:2,onProgress:p=>onProgress({...p,phase:'peasant',label:'采集画面准备'})});
 if(!keepGoing())return false;
 if(result.complete)return true;
 if(['memory-constrained','cache-budget','art-unavailable'].includes(result.reason)){
  onProgress({done:result.done,total:result.total,phase:'peasant',label:'采集画面准备',skipped:true,reason:result.reason});
  return true;
 }
 return false;
}
module.exports={warmSceneRendering};
