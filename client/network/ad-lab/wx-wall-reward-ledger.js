'use strict';
// Local non-personal game counters, outside reversible save snapshots.
module.exports=function wallRewardLedger(wx,kind='wall'){
 const vehicle=kind==='vehicle',tower=kind==='tower';
 const key=id=>(vehicle?'vehicle_reward_death_mask_v1:':tower?'tower_reward_death_limit_v1:':'wall_reward_death_limit_v1:')+id;
 const value=n=>Number.isInteger(n)&&n>=0&&n<=(vehicle?3:2);
 const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(id);
 function readLedger(id){
  if(!valid(id)||typeof wx?.getStorageSync!=='function')throw Error('reward ledger unavailable');
  const v=wx.getStorageSync(key(id));if(v===''||v==null)return null;
  if(!value(v))throw Error('invalid reward ledger');
  return v;
 }
 function writeLedger(id,n){
  if(!valid(id)||!value(n)||typeof wx?.setStorageSync!=='function')return false;
  try{const old=readLedger(id);if(old!=null&&(vehicle?(old&n)!==old:old>n))return false;
   wx.setStorageSync(key(id),n);return readLedger(id)===n;
  }catch{return false;}
 }
 return {readLedger,writeLedger};
};
