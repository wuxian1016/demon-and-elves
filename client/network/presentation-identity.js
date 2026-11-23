'use strict';
// Only these original renderer-owned fields survive a complete authoritative
// replacement. Stable emitter identity also preserves original WeakMap trails.
const VISUAL_FIELDS=new Set(['_dragonGait']);
function stabilizePresentation(next,prior,staticFields=[]){if(!prior||next.epoch!==prior.epoch||next.viewerOwnerId!==prior.viewerOwnerId)return next;const replacements=new Map(),plans=[];
 for(const[id,fresh]of next.entities){const old=prior.entities.get(id);if(!old||Object.getPrototypeOf(old)!==Object.getPrototypeOf(fresh)||!Object.isExtensible(old))continue;const keys=Object.keys(old);if(keys.some(k=>!Object.getOwnPropertyDescriptor(old,k).configurable))continue;replacements.set(fresh,old);}
 const entityObjects=new Set(next.entities.values());const rewrite=v=>{if(!v||typeof v!=='object')return v;if(replacements.has(v))return replacements.get(v);if(entityObjects.has(v))return v;if(Array.isArray(v))return v.map(rewrite);const out=Object.create(null);for(const[k,x]of Object.entries(v))out[k]=rewrite(x);return out;};
 for(const[id,fresh]of next.entities){const target=replacements.get(fresh)||fresh,fields=Object.create(null);for(const[k,v]of Object.entries(fresh))fields[k]=rewrite(v);plans.push({id,target,fields});}
 const worldView=Object.create(null);for(const[k,v]of Object.entries(next.worldView))worldView[k]=staticFields.includes(k)?v:rewrite(v);
 const advice=rewrite(next.publicGuideAdvice);
 // All validation and graph planning completed before the first live mutation.
 for(const {id,target,fields}of plans){for(const key of Object.keys(target))if(!VISUAL_FIELDS.has(key))delete target[key];Object.assign(target,fields);next.entities.set(id,target);}next.worldView=worldView;next.publicGuideAdvice=advice;return next;}
module.exports={stabilizePresentation,VISUAL_FIELDS};
