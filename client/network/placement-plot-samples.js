'use strict';
// UI signatures only. Native plot mutation/acceptance/payment remain unchanged.
const states=new WeakMap(),writers=['claim','takeOver','setRef','addBuilding','release','restoreEntries'];
function disable(s,reason){s.tracked=false;s.reason=reason;s.revision++;s.plans.clear();}
function stateFor(plots){let s=states.get(plots);if(s)return s;s={revision:0,plans:new Map(),reads:0,rebuilds:0,tracked:false,reason:'opaque',ownerAt:null,methods:[]};states.set(plots,s);
 try{
  const owner=Object.getOwnPropertyDescriptor(plots,'ownerAt');
  if(!Object.isExtensible(plots)||!owner||!Object.hasOwn(owner,'value')||typeof owner.value!=='function')return s;
  // Preflight every entry before changing any property. Accessors, inherited
  // writers and non-configurable properties conservatively use live queries.
  const specs=writers.map(name=>({name,descriptor:Object.getOwnPropertyDescriptor(plots,name)}));
  if(specs.some(({descriptor:d})=>!d||!d.configurable||!Object.hasOwn(d,'value')||typeof d.value!=='function'))return s;
  s.ownerAt=owner.value;
  for(const spec of specs){const original=spec.descriptor.value;spec.wrapper=function(...args){try{return original.apply(this,args);}finally{s.revision++;}};}
  try{
   for(const spec of specs){Object.defineProperty(plots,spec.name,{...spec.descriptor,value:spec.wrapper});if(Object.getOwnPropertyDescriptor(plots,spec.name)?.value!==spec.wrapper)throw Error('PLOT_WRAPPER_NOT_INSTALLED');}
  }catch(_){
   // A proxy/host object can fail after successful earlier definitions. Undo
   // our own wrappers where possible; any survivor remains native passthrough.
   for(const spec of [...specs].reverse())try{if(Object.getOwnPropertyDescriptor(plots,spec.name)?.value===spec.wrapper)Object.defineProperty(plots,spec.name,spec.descriptor);}catch(_){}
   disable(s,'installation-failed');return s;
  }
  s.methods=specs;s.tracked=true;s.reason=null;
 }catch(_){disable(s,'unsupported-descriptor');}return s;
}
function verify(plots,s){if(!s.tracked)return;try{if(Object.getOwnPropertyDescriptor(plots,'ownerAt')?.value!==s.ownerAt||s.methods.some(spec=>Object.getOwnPropertyDescriptor(plots,spec.name)?.value!==spec.wrapper))disable(s,'entry-replaced');}catch(_){disable(s,'descriptor-unavailable');}}
function append(g,values,x0,y0,x1,y1,step=90,ignoreBuildings=false){const plots=g.plots;if(!plots||typeof plots.ownerAt!=='function')return;const s=stateFor(plots);verify(plots,s);const key=[x0,y0,x1,y1,step].join(':'),old=s.plans.get(key);let plan=old;
 if(!s.tracked||!plan||plan.revision!==s.revision){const points=old?.points||[],records=[];if(!old)for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step)points.push({x,y});for(let i=0;i<points.length;i++){const p=points[i],record=plots.ownerAt(p.x,p.y);s.reads++;if(record)records.push({index:i,record});}plan={revision:s.revision,points,records};s.plans.set(key,plan);s.rebuilds++;if(s.plans.size>8)s.plans.delete(s.plans.keys().next().value);}
 // Retain live records, not frozen resource values: movement, radius, death,
 // in-place ref/kind changes and shared multi-building plot records stay exact.
 values.push('plot-samples',plan.points.length);for(const {index,record}of plan.records){const o=ignoreBuildings&&record.kind==='building'?null:record;if(o)values.push(index,o.ref,o.kind,o.ref?.x,o.ref?.y,o.ref?.radius,o.ref?.dead);}
 // Clear-ring predicates remain live even for custom/native overrides.
 values.push('spawn-clear');for(let i=0;i<plan.points.length;i++){const p=plan.points[i];if(g.inSpawnClearRing?.(p.x,p.y))values.push(i);}values.push('plot-end');
}
module.exports={append,stats:g=>{const s=states.get(g.plots);return s?{revision:s.revision,plans:s.plans.size,ownerReads:s.reads,rebuilds:s.rebuilds,tracked:s.tracked,fallbackReason:s.reason}:null;}};
