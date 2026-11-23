'use strict';
const gates=new WeakMap();
function installCanvasInput(wx,{resetGesture=null,freezeTrace=null}={}){
 if(gates.has(wx)){const gate=gates.get(wx);if(resetGesture)gate.resetGesture=resetGesture;return gate;}
 const gate={controller:null,resetGesture,priorityInput:null,hidden:false},listeners={};
 for(const[api,kind]of[['TouchStart','start'],['TouchMove','move'],['TouchEnd','end'],['TouchCancel','cancel']]){
  const on='on'+api,off='off'+api,register=wx[on]?.bind(wx);if(!register)continue;listeners[kind]=[];
  const dispatch=e=>{
   if(gate.hidden)return;
   if(gate.priorityInput?.(kind,e))return;
   if(kind==='cancel'||kind==='start'&&(e.touches?.length?e.touches:e.changedTouches)?.length===1)gate.resetGesture?.(kind==='cancel'?'cancel':'single-start');
   let consumed;
   try{consumed=gate.controller?.touch(kind,e);}
   catch(error){gate.resetGesture?.('controller-error');throw error;}
   if(consumed){if(kind==='end')gate.resetGesture?.('consumed-end');return;}
   // Registration replaces the list, so iteration holds its original snapshot
   // without allocating a fresh array for every move event.
   for(const f of listeners[kind])f(e);
  };
  register(freezeTrace?freezeTrace.wrapTouch(dispatch,kind):dispatch);
  wx[on]=f=>{if(!listeners[kind].includes(f))listeners[kind]=listeners[kind].concat(f);};
  wx[off]=f=>{listeners[kind]=listeners[kind].filter(x=>x!==f);};
 }
 wx.onHide?.(()=>{gate.hidden=true;gate.resetGesture?.('hide');});
 wx.onShow?.(()=>{gate.hidden=false;gate.resetGesture?.('show');});
 gates.set(wx,gate);return gate;
}
module.exports={installCanvasInput};
