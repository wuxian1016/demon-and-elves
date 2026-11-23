'use strict';
const {create}=require('./card-presentation');
const DOCK=['collectWood','collectGold','moreBuilds','robotSiege','robotFlame','robotSuper','ghostRelocate','ghostCopy','equipDragonRelic','driveTank','exitTank','returnBase','callCrew','crewOut'];
module.exports=function install(g,{art,viewport,clock=Date.now,createCardInteraction}){
 if(!art||!g.cardsCandidate)return null;
 const ui=create({createCardInteraction,game:g,controller:g.cardsCandidate,view:viewport,clock,artReady:()=>art.ready===true,warmGhost:art.warmGhost,drawFullCard:art.draw,screenToWorld:p=>g.screenToWorld(p.x,p.y),drawButton(c,label,b,kind){const old=g.ctx;g.ctx=c;try{g.drawPanelButton({...b,id:'cards-'+label},label,kind==='cancel'?'#284554':'#09a650',b.fontSize??18*viewport().width/552);}finally{g.ctx=old;}}});
 const draw=g.drawCircularDock512;let hidden=null;
 g.drawCircularDock512=function(...args){if(ui.blocksDock()){if(!hidden)hidden=new Map(this.buttons.filter(b=>DOCK.includes(b.id)).map(b=>[b,b.visible]));for(const b of hidden.keys())b.visible=false;return this.uiSafeRect396().bottom;}if(hidden){for(const[b,v]of hidden)b.visible=v;hidden=null;}return draw.apply(this,args);};
 const restore=g.applySavedWorld;g.applySavedWorld=function(...args){const r=restore.apply(this,args);ui.restore();return r;};
 Object.defineProperty(g,'cardPresentation',{value:ui,configurable:true});return ui;
};
