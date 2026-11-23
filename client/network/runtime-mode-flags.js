'use strict';
// Official read-only runtime observations, never inferred from package labels.
function readRuntimeMode(){
 const flag=key=>{try{const root=typeof GameGlobal==='undefined'?null:GameGlobal;const value=root?.[key];return typeof value==='boolean'?value:'unknown';}catch{return'unknown';}};
 const actualHighPerformance=flag('isIOSHighPerformanceMode'),actualHighPerformancePlus=flag('isIOSHighPerformanceModePlus');
 return {actualHighPerformance,actualHighPerformancePlus,modeObservation:typeof actualHighPerformance==='boolean'||typeof actualHighPerformancePlus==='boolean'?'official-GameGlobal-flags':'unavailable'};
}
module.exports={readRuntimeMode};
