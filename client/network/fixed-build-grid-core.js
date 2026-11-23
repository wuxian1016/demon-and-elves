'use strict';
// Geometry only. No shipped design defaults: approved map origin, orientation,
// spacing and region bounds must be supplied by the game adapter.
const EPSILON=1e-6,MAX_CANDIDATES=4096;
function frame(config){
 if(!config||![config.origin?.x,config.origin?.y,config.spacing,config.angle,config.bounds?.minX,config.bounds?.minY,config.bounds?.maxX,config.bounds?.maxY].every(Number.isFinite)||config.spacing<=0||config.bounds.minX>config.bounds.maxX||config.bounds.minY>config.bounds.maxY)throw Error('GRID_CONFIGURATION_REQUIRED');
 const c=Math.cos(config.angle),s=Math.sin(config.angle),{x,y}=config.origin;
 const local=(px,py)=>({col:((px-x)*c+(py-y)*s)/config.spacing,row:(-(px-x)*s+(py-y)*c)/config.spacing});
 const point=(col,row)=>({x:x+(col*c-row*s)*config.spacing,y:y+(col*s+row*c)*config.spacing,col:col===0?0:col,row:row===0?0:row});
 return {config,c,s,local,point};
}
function latticePoint(config,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;const f=frame(config),q=f.local(x,y),col=Math.round(q.col),row=Math.round(q.row),p=f.point(col,row);return Math.hypot(p.x-x,p.y-y)<=EPSILON?p:null;}
function candidates(config){
 const f=frame(config),b=config.bounds,corners=[[b.minX,b.minY],[b.minX,b.maxY],[b.maxX,b.minY],[b.maxX,b.maxY]].map(([x,y])=>f.local(x,y));
 const minCol=Math.ceil(Math.min(...corners.map(q=>q.col))-EPSILON),maxCol=Math.floor(Math.max(...corners.map(q=>q.col))+EPSILON),minRow=Math.ceil(Math.min(...corners.map(q=>q.row))-EPSILON),maxRow=Math.floor(Math.max(...corners.map(q=>q.row))+EPSILON);
 if(![minCol,maxCol,minRow,maxRow].every(Number.isSafeInteger))throw Error('GRID_CANDIDATE_LIMIT');
 const count=Math.max(0,maxCol-minCol+1)*Math.max(0,maxRow-minRow+1);if(!Number.isSafeInteger(count)||count>MAX_CANDIDATES)throw Error('GRID_CANDIDATE_LIMIT');
 const out=[];for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){const p=f.point(col,row);if(p.x>=b.minX-EPSILON&&p.x<=b.maxX+EPSILON&&p.y>=b.minY-EPSILON&&p.y<=b.maxY+EPSILON)out.push(Object.freeze(p));}
 return Object.freeze(out);
}
function legalCandidates(points,type,validate,contains=()=>true){
 if(typeof type!=='string'||!type||typeof validate!=='function')throw Error('GRID_VALIDATOR_REQUIRED');
 // Validate the original coordinates. Holes remain holes; never shift an
 // individual point around an occupied footprint or map obstacle.
 return Object.freeze(points.filter(p=>contains(p,type)&&validate(p.x,p.y,type)===null));
}
function nearestCandidate(points,x,y,maxDistance){
 if(![x,y,maxDistance].every(Number.isFinite)||maxDistance<0)return null;
 let chosen=null,best=maxDistance;for(const p of points){const d=Math.hypot(p.x-x,p.y-y);if(d<=best&&(chosen===null||d<best-EPSILON||Math.abs(d-best)<=EPSILON&&(p.row<chosen.row||p.row===chosen.row&&p.col<chosen.col))){chosen=p;best=d;}}
 return chosen;
}
class LegalGridCache{
 constructor(limit=2){if(!Number.isInteger(limit)||limit<1||limit>16)throw Error('GRID_CACHE_LIMIT');this.limit=limit;this.entries=new Map();}
 get({key,geometry,revision,type,validate,contains}){const old=this.entries.get(key);if(old&&old.geometry===geometry&&old.revision===revision&&old.type===type){this.entries.delete(key);this.entries.set(key,old);return old.points;}
  const points=legalCandidates(geometry,type,validate,contains);this.entries.delete(key);this.entries.set(key,{geometry,revision,type,points});while(this.entries.size>this.limit)this.entries.delete(this.entries.keys().next().value);return points;}
 clear(){this.entries.clear();}
}
module.exports={candidates,latticePoint,legalCandidates,nearestCandidate,LegalGridCache,MAX_CANDIDATES};
