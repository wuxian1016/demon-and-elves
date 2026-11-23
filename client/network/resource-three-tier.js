'use strict';
const config=require('./resource-three-tier-config');
const TYPES=new Set(['goldMine','warehouse','houseForPeasants']),TARGET=[0,1,3,5],CAPACITY=[0,150,350,650,1100,1750],POPULATION=[0,2,4,8,14,24];
const legacy=b=>Math.max(1,Math.floor(b.resourceLegacyLevelAZ||b.level||1));
const tier=lv=>lv>=5?3:lv>=2?2:1;
function install(g,{Building,enabled}={}){
 if(g.resourceThreeTierAZ)return g.resourceThreeTierAZ;if(!Building?.prototype||!g.buildings)return null;
 let override=enabled,depth=0;const on=()=>override===undefined?config.enabled:override;const originals={},p=Building.prototype;
 const targeted=b=>!!b&&TYPES.has(b.type),active=b=>on()&&targeted(b)&&!depth;
 const withLevel=(b,level,fn)=>{const old=b.level;depth++;b.level=level;try{return fn();}finally{b.level=old;depth--;}};
 const semantic=fn=>{if(!on()||depth)return fn();const changed=[];depth++;try{for(const b of g.buildings)if(targeted(b)&&b.resourceTierExperimentAZ===1){changed.push([b,b.level]);b.level=legacy(b);}return fn();}finally{for(const[b,lv]of changed)b.level=lv;depth--;}};
 const patch=(obj,key,fn)=>Object.defineProperty(obj,key,{value:fn,writable:true,configurable:true,enumerable:false});
 const pending=new WeakMap();
 for(const key of ['applyLevelStats','maxUpgradeLevel','upgradeCost','upgrade','stashCap','getRewardXp','getRewardGold','getHitXp','getHitGold'])if(typeof p[key]==='function')originals[key]=p[key];
 patch(p,'maxUpgradeLevel',function(){return active(this)?3:originals.maxUpgradeLevel.call(this);});
 patch(p,'applyLevelStats',function(...args){if(!active(this))return originals.applyLevelStats.apply(this,args);const lv=pending.get(this)||this.resourceLegacyLevelAZ||(this.level>3?this.level:TARGET[Math.max(1,this.level)]);this.resourceTierExperimentAZ=1;this.resourceLegacyLevelAZ=lv;if(this.level>3)this.level=tier(lv);return withLevel(this,lv,()=>originals.applyLevelStats.apply(this,args));});
 patch(p,'upgradeCost',function(oldPrices=false){if(!active(this))return originals.upgradeCost.call(this,oldPrices);if(this.level>=3)return null;const from=legacy(this),to=Math.max(from,TARGET[this.level+1]),sum={wood:0,gold:0};for(let lv=from;lv<to;lv++){const probe=Object.create(this);probe.level=lv;const cost=withLevel(probe,lv,()=>originals.upgradeCost.call(probe,oldPrices));if(!cost)return null;sum.wood+=cost.wood;sum.gold+=cost.gold;}return sum;});
 patch(p,'upgrade',function(...args){if(!active(this))return originals.upgrade.apply(this,args);if(!this.canUpgrade())return false;pending.set(this,Math.max(legacy(this),TARGET[this.level+1]));try{return originals.upgrade.apply(this,args);}finally{pending.delete(this);}});
 for(const key of ['stashCap','getRewardXp','getRewardGold','getHitXp','getHitGold'])if(originals[key])patch(p,key,function(...args){return active(this)?withLevel(this,legacy(this),()=>originals[key].apply(this,args)):originals[key].apply(this,args);});
 const reconcile=(buildings=g.buildings)=>{g.resourceThreeTierVersionAZ=on()?1:0;for(const b of buildings||[])if(targeted(b)){if(on()){if(b.resourceTierExperimentAZ!==1){const lv=Math.max(1,b.level||1);if(!b.paidCost&&typeof g.buildingSellRefund==='function'){depth++;try{b.paidCost=g.buildingSellRefund(b,true);}finally{depth--;}}b.resourceTierExperimentAZ=1;b.resourceLegacyLevelAZ=lv;}b.level=tier(legacy(b));}else if(b.resourceTierExperimentAZ===1)b.level=legacy(b);}return buildings;};
 for(const key of ['ownerWarehouseCapacity','getPeasantCap','updateSpecialBuildings','allyPeasantTarget'])if(typeof g[key]==='function'){originals[key]=g[key];patch(g,key,function(...args){return semantic(()=>originals[key].apply(this,args));});}
 originals.block=g.buildingUpgradeBlockReason;if(typeof originals.block==='function')patch(g,'buildingUpgradeBlockReason',function(b,owner=null){if(active(b)&&!b.dead&&(b.ownerSlot??null)===(owner??null)&&b.level<3){const level=this.getOwnerMaxHouseLevel(owner);if(b.level+1>Math.min(3,level))return level?`先升级到${b.level+1}级基地，才能升级此资源建筑`:'需要所属基地才能继续升级资源建筑';}return originals.block.call(this,b,owner);});
 originals.applySavedWorld=g.applySavedWorld;if(typeof originals.applySavedWorld==='function')patch(g,'applySavedWorld',function(world,...args){this.validateSavedWorld(world);reconcile(world.buildings);return originals.applySavedWorld.call(this,world,...args);});
 originals.preview=g.getUpgradePreview;if(typeof originals.preview==='function')patch(g,'getUpgradePreview',function(b){const rows=originals.preview.call(this,b);if(!active(b)||!rows.length)return rows;const from=Math.min(5,legacy(b)),next=Math.min(5,Math.max(from,TARGET[Math.min(3,b.level+1)]));if(b.type==='warehouse')return rows.map(s=>s.startsWith('仓库容量')?`仓库容量 +${CAPACITY[from]} → +${CAPACITY[next]}`:s);if(b.type==='houseForPeasants'){const now=this.getPeasantCap(b.ownerSlot??null);return rows.map(s=>s.startsWith('人口上限')?`人口上限 ${now} → ${Math.min(100,now+POPULATION[next]-POPULATION[from])}`:s);}return rows;});
 patch(g,'resourceThreeTierVersionAZ',on()?1:0);
 const api={version:config.version,enabled:on,legacyLevel:legacy,tierForLegacy:tier,reconcile,setEnabled(value){override=!!value;reconcile();g.syncOwnerStorage?.();for(const a of g.allies||[])g.syncOwnerStorage?.(a.slot);g.wxUiDirty=true;return on();},exportLegacySave(){const prior=override;override=false;reconcile();try{return g.serializeProgress();}finally{override=prior;reconcile();}},originals};
 patch(g,'resourceThreeTierAZ',api);reconcile();return api;
}
// Append-only originals are written before an explicit slot overwrite. Any
// backup failure rejects the overwrite and leaves the user's original intact.
function protectSlotOverwrites(runtime, wxApi) {
 const slots=runtime?.slots;
 if(!slots||!wxApi?.getFileSystemManager||slots.resourceTierBackupAZ)return;
 const put=slots.put.bind(slots);
 const directory=wxApi.env.USER_DATA_PATH+'/resource-three-tier-originals-AZ1';
 let filesystem=null,serial=0,chain=Promise.resolve();
 slots.put=function(slot,text,meta,overwrite=false){
  const run=async()=>{
   if(overwrite){
    const old=await slots.get(slot);
    if(old&&(config.enabled||old.text?.includes('resourceTierExperimentAZ'))){
     // The backup bridge is only needed when replacing a protected save.
     filesystem??=wxApi.getFileSystemManager();
     try{filesystem.mkdirSync(directory,true);}
     catch(error){if(!String(error?.errMsg||error).toLowerCase().includes('exist'))throw error;}
     const filePath=directory+'/slot-'+slot+'-'+Date.now()+'-'+(++serial)+'.json';
     const data=JSON.stringify({schema:1,slot,at:Date.now(),text:old.text,meta:old.meta,reason:'before-three-tier-overwrite'});
     await new Promise((resolve,reject)=>filesystem.writeFile({filePath,data,encoding:'utf8',success:resolve,fail:reject}));
    }
   }
   return put(slot,text,meta,overwrite);
  };
  const next=chain.catch(()=>{}).then(run);
  chain=next;
  return next;
 };
 Object.defineProperty(slots,'resourceTierBackupAZ',{value:true});
}
module.exports={install,protectSlotOverwrites,legacyLevel:legacy,tierForLegacy:tier};
