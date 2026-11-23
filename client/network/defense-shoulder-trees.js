'use strict';
// Approved BH map-only edit: retreat the local decorative trunks in the user's
// circled camp-3 shoulder slots. Not a seed rule or a collision exemption.
// Other camps, harvestable resource arrays, road paths and tree counts stay intact.
const plans=[{dx:-242,dy:-87,size:89,mx:-40,my:-50},{dx:299,dy:-102,size:98,mx:40,my:-40},{dx:-191,dy:-78,size:101,mx:0,my:-35},{dx:235,dy:-97,size:98,mx:-10,my:-30}];
function migrate(world){
 const z=world?.zones?.[2];
 if(!z||world.width!==10000||world.height!==8000||Math.abs(z.x-5538.309350767484)>1e-6||Math.abs(z.y-7052.904034337845)>1e-6||z.gateX!==5535||z.gateY!==6615)return false;
 const rows=plans.map(p=>({p,t:world.trees.find(t=>t.x===z.gateX+p.dx&&t.y===z.gateY+p.dy&&t.radius===24&&t.size===p.size&&t.variant===0)}));
 // Atomic and fail-closed for unreviewed terrain variants or already moved worlds.
 if(rows.some(r=>!r.t))return false;
 for(const {p,t}of rows){t.x+=p.mx;t.y+=p.my;}
 world.trees.sort((a,b)=>a.y-b.y);
 // Replace buckets to invalidate referenceTerrain.hit's per-buckets WeakMap.
 // Rebuild render chunks and the prepared terrain's optional numeric index too.
 const buckets=new Map(),chunks=new Map();
 for(const t of world.trees){const k=Math.floor(t.x/128)+','+Math.floor(t.y/128);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(t);}
 const put=(o,kind)=>{const k=Math.floor(o.x/512)+','+Math.floor(o.y/512);if(!chunks.has(k))chunks.set(k,{trees:[],props:[]});chunks.get(k)[kind].push(o);};
 for(const t of world.trees)put(t,'trees');for(const p of world.props||[])put(p,'props');
 world.buckets=buckets;world.chunks=chunks;
 if(world.hitRows){world.hitRows.clear();for(const [k,trees]of buckets){const[x,y]=k.split(',').map(Number);if(!world.hitRows.has(y))world.hitRows.set(y,new Map());world.hitRows.get(y).set(x,trees);}}
 return true;
}
function install(api){if(!api||api.defenseShoulderTreesBH)return;Object.defineProperty(api,'defenseShoulderTreesBH',{value:true});
 const configure=api.configureSteps591;api.configureSteps591=function*(...args){const world=yield*configure.apply(this,args);migrate(world);return world;};
 const prepare=api.prepareAsync;if(prepare)api.prepareAsync=async function(...args){const result=await prepare.apply(this,args);migrate(this.prepared);return result;};
 migrate(api.world);migrate(api.prepared);
}
module.exports={migrate,install};
