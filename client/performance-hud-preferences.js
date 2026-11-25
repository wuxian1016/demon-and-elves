'use strict';
const KEY='demon-and-elves.performance-hud.v1';
function createHudPreferences(storage){
 let current={fps:false,network:false};
 try{let raw=storage?.getStorageSync?.(KEY);if(typeof raw==='string')raw=JSON.parse(raw);if(raw?.schema===1){if(typeof raw.fps==='boolean')current.fps=raw.fps;if(typeof raw.network==='boolean')current.network=raw.network;}}catch(_){}
 return{get value(){return {...current};},toggle(key){if(key!=='fps'&&key!=='network')return false;current={...current,[key]:!current[key]};try{storage?.setStorageSync?.(KEY,{schema:1,...current});}catch(_){}return current[key];}};
}
module.exports={createHudPreferences,KEY};
