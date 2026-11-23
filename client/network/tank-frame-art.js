"use strict";
// 24 independently painted poses. Runtime changes source-frame selection only.
// No pixel warping, bone deformation, oscillation, rotation or action-dependent scaling.
const ANCHORS=[[144,142,134,128,124,114],[154,154,146,138,132,128],[126,122,118,112,108,106],[144,142,134,128,124,114]];
const BASELINES=[240,216,190,202];
function frameIndex(e){if(!e||e.actionKind!=="fire"||!(e.actionAnim>0)||!(e.actionDuration>0))return 0;return Math.min(5,Math.max(0,Math.floor((1-e.actionAnim/e.actionDuration)*6)));}
function create({Image,canvas,imagePath=value=>value,canLoad=()=>false}){
 let ready=false,error=null,started=false;const frames=[],variants=new Map(),img=new Image();
 img.onload=()=>{try{const sheet=canvas(img.width,img.height),c=sheet.getContext("2d");c.drawImage(img,0,0);const pixels=c.getImageData(0,0,img.width,img.height),p=pixels.data;
 for(let i=0;i<p.length;i+=4)if(p[i]>155&&p[i+2]>155&&p[i+1]<110)p[i+3]=0;
 c.putImageData(pixels,0,0);
 for(let row=0;row<4;row++)for(let col=0;col<6;col++){const f=canvas(256,256),q=f.getContext("2d");q.imageSmoothingEnabled=false;const sy=row===3?720:row*256,sh=row===3?304:256,base=row===3?250:BASELINES[row];q.drawImage(sheet,col*256,sy,256,sh,128-ANCHORS[row][col],240-base,256,sh);frames.push(f);}
 // Fixed lower chassis is a separately painted immutable layer. Upper poses
 // retain their independently drawn turret/barrel changes. Registration is
 // constant per asset cell, not an animation-derived displacement.
 for(const row of [1,2])for(let col=1;col<6;col++){const q=frames[row*6+col].getContext("2d");q.clearRect(0,165,256,91);q.drawImage(frames[row*6],0,165,256,91,0,165,256,91);}
 sheet.width=sheet.height=1;ready=true;
 }catch(e){error=String(e);}};img.onerror=e=>{error=String(e?.errMsg||"tank frame load failed");};function start(){if(started||!canLoad())return;started=true;img.src=imagePath("art163/tank-fire-drawn-bk-v2.webp.bin");}
 function get(row,index,color){const base=frames[row*6+index];if(!/^#[0-9a-f]{6}$/i.test(color||""))return base;const key=row+":"+index+":"+color;if(variants.has(key))return variants.get(key);const f=canvas(256,256),q=f.getContext("2d");q.drawImage(base,0,0);const im=q.getImageData(0,0,256,256),d=im.data,rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),peak=Math.max(...rgb);for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],hi=Math.max(r,g,b),lo=Math.min(r,g,b);if(!d[i+3]||r>220||r>g*1.25||hi-lo<20||!(r>b*1.3&&g>b*1.3&&Math.abs(r-g)<hi*.5))continue;const sat=Math.max(.8,(hi-lo)/hi),v=hi/255;for(let k=0;k<3;k++)d[i+k]=Math.round(255*v*((1-sat)+sat*rgb[k]/peak));}q.putImageData(im,0,0);variants.set(key,f);if(variants.size>24){const old=variants.keys().next().value;variants.delete(old);}return f;}
 return{status:()=>({ready,error,started,frames:frames.length,bytes:frames.length*256*256*4+variants.size*256*256*4}),draw(ctx,e,{direction,scale=1,color=null}){if(!ready){start();return false;}const i=frameIndex(e),f=get(direction,i,color),k=(direction===1||direction===2?.52:.45)*scale;ctx.drawImage(f,e.x-128*k,e.y+41.5*scale-240*k,256*k,256*k);return true;}};
}
module.exports={create,frameIndex,ANCHORS,BASELINES};
