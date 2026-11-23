'use strict';
// Manual-only native orientation control. Device posture and accelerometer
// callbacks are deliberately not observed: the player changes direction from
// 游戏设置, and that preference is reapplied when WeChat returns to foreground.
function createManualOrientation(wx,options){
  options=options||{};
  const onResult=typeof options.onResult==='function'?options.onResult:function(){};
  const supported=typeof wx.setDeviceOrientation==='function';
  let current=options.initialOrientation==='landscape'?'landscape':'portrait';
  let desired=current,pending=null,disposed=false,serial=0;
  function valid(value){return value==='portrait'||value==='landscape';}
  function notify(ok,value,error,reapplied=false){try{onResult({ok,value,reapplied,error:error?.errMsg||error?.message||''});}catch(_){}}
  function issue(force){
    if(disposed||!supported||pending||(!force&&current===desired))return;
    const value=desired,token=++serial;pending={token,value};
    try{wx.setDeviceOrientation({value,
      success(){if(!pending||pending.token!==token||disposed)return;pending=null;current=value;notify(true,value,null,force);if(desired!==current)issue(false);},
      fail(error){if(!pending||pending.token!==token||disposed)return;pending=null;notify(false,value,error,force);if(desired!==value)issue(false);}
    });}catch(error){pending=null;notify(false,value,error,force);}
  }
  function set(value){if(!valid(value)||disposed)return false;desired=value;if(!supported){notify(false,value,'unsupported');return false;}issue(false);return true;}
  function reapply(){if(disposed||!supported)return false;issue(true);return true;}
  function sync(value){const next=value==='portrait'?'portrait':value==='landscape'||value==='landscapeReverse'?'landscape':'';if(next)current=next;}
  function dispose(){disposed=true;pending=null;serial++;}
  return{set,reapply,sync,dispose,state(){return{supported,current,desired,pending:pending?.value||''};}};
}
module.exports={createManualOrientation};
