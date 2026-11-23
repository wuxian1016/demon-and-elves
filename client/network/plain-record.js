'use strict';
// Native SDK callbacks can deliver JSON objects from another JavaScript realm.
// Check their native Object prototype, never instanceof or local prototype identity
// alone. Inspect descriptors so a rejected record cannot run an own accessor.
const nativeObjectSource=Function.prototype.toString.call(Object);
const objectPrototypeKeys=Reflect.ownKeys(Object.prototype);
const own=Object.prototype.hasOwnProperty;
function plainRecordIssue(value,{allowNullPrototype=true}={}){
 if(!value||typeof value!=='object')return 'TYPE';
 try{
  if(Array.isArray(value))return 'ARRAY';
  const proto=Object.getPrototypeOf(value);
  if(proto===null){if(!allowNullPrototype)return 'NULL_PROTOTYPE';}
  else if(proto!==Object.prototype){
   if(Object.getPrototypeOf(proto)!==null)return 'PROTOTYPE_PARENT';
   const constructor=Object.getOwnPropertyDescriptor(proto,'constructor');
   if(!constructor||!own.call(constructor,'value')||typeof constructor.value!=='function')return 'CONSTRUCTOR';
   const ctor=constructor.value,prototype=Object.getOwnPropertyDescriptor(ctor,'prototype');
   if(!prototype||!own.call(prototype,'value')||prototype.value!==proto||Function.prototype.toString.call(ctor)!==nativeObjectSource)return 'NATIVE_OBJECT';
   const keys=Reflect.ownKeys(proto);
   if(keys.length!==objectPrototypeKeys.length||keys.some(key=>!objectPrototypeKeys.includes(key)))return 'PROTOTYPE_FIELDS';
  }
  for(const key of Reflect.ownKeys(value)){
   const descriptor=Object.getOwnPropertyDescriptor(value,key);
   if(!descriptor||!own.call(descriptor,'value'))return 'ACCESSOR';
  }
  return null;
 }catch(_){return 'UNREADABLE';}
}
function isPlainRecord(value,options){return plainRecordIssue(value,options)===null;}
module.exports={isPlainRecord,plainRecordIssue};
