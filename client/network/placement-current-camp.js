"use strict";
// Presentation-only camp selection. Never rewrite spawn/authority fields.
const {campAt}=require('./camp-hint-region');
function index(g){
 const p=g.player;if(!p||p.dead)return -1;
 const local=campAt(g,p.x,p.y);if(local)return local.camp;
 // Outside every camp, don't pull the camera to an obsolete spawn point.
 return -1;
}
function install(g){if(g.buildRecommendationZoneIndexBN)return;Object.defineProperty(g,'buildRecommendationZoneIndexBN',{value:()=>index(g),configurable:true});}
module.exports={index,install};
