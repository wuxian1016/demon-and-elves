'use strict';
// Transport metadata stays outside the immutable, validated gameplay graph.
const times=new WeakMap();
function mark(packet,stamp){if(packet&&typeof packet==='object'&&Number.isFinite(stamp?.serverTimeMs)&&stamp.serverTimeMs>=0)times.set(packet,Object.freeze({serverTimeMs:stamp.serverTimeMs}));return packet;}
const get=packet=>packet&&typeof packet==='object'?times.get(packet):undefined;
function transfer(from,to){const stamp=get(from);if(stamp)mark(to,stamp);return to;}
module.exports={mark,get,transfer};
