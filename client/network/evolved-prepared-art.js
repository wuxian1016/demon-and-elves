'use strict';
const lengths={front:32,back:32,sideWalk:16,sideAttack:16};
function policy(layout){
 // Skip only 18 prepared stage-two fallback sprites with no external readers.
 // An older/incomplete manifest follows the unchanged eager hydration path.
 const fallback=layout.structure?.evolvedFrames,motion=layout.structure?.evolvedMotion;
 if(fallback?.length!==18||!motion)return null;
 const rows=new Map(layout.sprites.map(e=>[e.id,e])), all=new Set(), short=new Set(), full=new Set();
 function add(ref,to){if(!Number.isInteger(ref?.sprite)||!rows.has(ref.sprite)||all.has(ref.sprite))return false;to.add(ref.sprite);all.add(ref.sprite);return true;}
 for(const f of fallback)if(!add(f,short))return null;
 for(const [key,length] of Object.entries(lengths)){
  if(motion[key]?.length!==length)return null;
  for(const f of motion[key])if(!add(f,full))return null;
 }
 const others={...layout.structure};delete others.evolvedFrames;delete others.evolvedMotion;
 function isolated(v){return !v||typeof v!=='object'||('sprite'in v?!all.has(v.sprite):Object.values(v).every(isolated));}
 if(!isolated(others))return null;
 return {short,full};
}
module.exports={policy};
