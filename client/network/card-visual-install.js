'use strict';
// Draw approved effect colors as world-space particles above current native
// character frames. Never repaint every sprite to a scratch canvas per frame.
module.exports=function install(g,{types,createCanvas,enabled=()=>false,constrained=()=>false}){
 if(g.cardVisuals)return g.cardVisuals;
 const particles=require('./card-effects-bridge').create({game:g,controller:g.cardsCandidate,types,createCanvas,enabled,constrained});
 const storm=require('./card-storm-visual').create({game:g});
 const api={harvestWorkers:particles.harvestWorkers,drawBases:particles.drawBases,drawWorkerBases:particles.drawWorkerBases,drawActorFx:particles.drawActorFx,draw(c,inView,workers,deferActors=false,visibleBuildings=null){particles.draw(c,inView,workers,deferActors,visibleBuildings);storm.draw(c,inView,enabled()&&!constrained());},
  warmStorm:storm.warmup,warmBolt:storm.warmBolt,drawBolt:storm.drawBolt,get boltReady(){return storm.boltReady;},get stormVisualReady(){return storm.ready;},
  stats:()=>({...particles.stats(),stormDraws:storm.draws})};
 Object.defineProperty(g,'cardVisuals',{value:api});return api;
};
