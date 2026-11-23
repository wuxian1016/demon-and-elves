'use strict';
const grid=require('./ordinary-building-grid');
function origins(g,type,bounds){return grid.install(g).origins(bounds);}
function nativeNeighbours(){return [];}
module.exports={origins,nativeNeighbours};
