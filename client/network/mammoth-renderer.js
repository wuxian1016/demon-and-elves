'use strict';
// BN19R4 confirmed sprites: 8 independently drawn step poses, 6 attack poses, separate idle.
// Preserve the original 512-coordinate frame and foot baseline; only discard transparent source padding.
const trim=require('./mammoth-trim-layout');
const names=['idle',...Array.from({length:8},(_,i)=>'walk-'+i),...Array.from({length:6},(_,i)=>'attack-'+i)];
const WIDTH=168,FOOT=430/512*WIDTH,WALK_MS=760,WALK_STRIDE=64;
// Landmarks for the planted near hoof on row y=425 of the approved 512px frames.
const SUPPORT_X=[343.5,253,212.5,289.5,277.5,248.5,208,268.5];
const WALK_MARKS=[0,16,27,32,37,45,55,59,64];
const REGISTER_X=[-6,5,6,-4,-2,0,3,0];
const SHADOW_W=146,SHADOW_H=38,IDLE_HOLD_MS=142;
const phaseVisualScale=h=>h.waveMonsterEvolutionStageBN===2?1.20:1;
const nextWalkPhase=(phase,distance)=>((Number.isFinite(phase)?phase:0)+Math.max(0,distance)*WALK_MS/WALK_STRIDE)%WALK_MS;
const assetPath=name=>name==='shadow'?'mammoth-walk/contact-shadow.png':(name.startsWith('attack-')?'mammoth-attack/':'mammoth-walk/')+name+'.webp.bin';
function walkIndex(t){
 const distance=(Math.max(0,Number(t)||0)%WALK_MS)*WALK_STRIDE/WALK_MS;
 let i=1;while(i<8&&distance>=WALK_MARKS[i])i++;return i-1;
}
function frameAt(action,t){
 if(action==='walk')return 'walk-'+walkIndex(t);
 if(action==='attack'||action==='petrify')return 'attack-'+(t<130?0:t<260?1:t<390?2:t<520?3:t<680?4:5);
 return 'idle';
}
function updateGait(h,dx,dy,dt){
 const d=Math.hypot(dx,dy),ms=Math.max(0,Math.min(50,Number(dt)||0));
 const valid=d>.01&&d<=Math.max(8,ms*.16);
 if(valid){
  h.mammothWalkingEverBN=true;h.mammothStopMsBN=0;h.mammothMovingBN=true;h.mammothWalkBN=nextWalkPhase(h.mammothWalkBN,d);
  const observed=dx/d,weight=1-Math.exp(-ms/110);
  const prior=h.mammothHeadingXBN??observed;
  h.mammothHeadingXBN=prior+(observed-prior)*weight;
  // A near-vertical road does not flip the side-facing sprite when the x sign jitters.
  if(Math.abs(observed)>.24&&Math.abs(h.mammothHeadingXBN)>.31&&Math.sign(observed)===Math.sign(h.mammothHeadingXBN))h.mammothFaceBN=observed<0?-1:1;
 }else{
  h.mammothStopMsBN=(h.mammothStopMsBN||0)+ms;
  h.mammothMovingBN=h.mammothWalkingEverBN===true&&h.mammothStopMsBN<IDLE_HOLD_MS;
 }
}
function draw(ctx,images,{x,y,action,elapsedMs,facingLeft=false,visualScale=1,armor=false}){
 const frame=frameAt(action,elapsedMs),key=images?.[frame]?frame:'idle',image=images?.[key];
 if(!image?.width||!Number.isFinite(x)||!Number.isFinite(y))return false;
 ctx.save();ctx.imageSmoothingEnabled=true;
 // Soft contact follows the unchanging heel baseline across separate frames;
 // one tiny alpha-blended texture, no gradients or shadowBlur during draw.
 const shade=images?.shadow;
 if(shade?.width)ctx.drawImage(shade,x+((facingLeft?9:-9)-SHADOW_W/2)*visualScale,y-16*visualScale,SHADOW_W*visualScale,SHADOW_H*visualScale);
 ctx.translate(x,y);
 if(facingLeft)ctx.scale(-1,1);
 // Distinct drawn poses remain intact. Translate only the source-frame registration; no warping.
 const pin=(action==='walk'?REGISTER_X[walkIndex(elapsedMs)]:0)*visualScale;
 const width=WIDTH*visualScale,foot=FOOT*visualScale,size=width/512,r=trim[key];
 if(r&&image.width===r[2]&&image.height===r[3])ctx.drawImage(image,-width/2+pin+r[0]*size,-foot+r[1]*size,r[2]*size,r[3]*size);
 else ctx.drawImage(image,-width/2+pin,-foot,width,width);
 if(armor&&images.armor?.width===880){const i=names.indexOf(key),cell=176;if(i>=0)ctx.drawImage(images.armor,i%5*cell,Math.floor(i/5)*cell,cell,cell,-width/2+pin,-foot,width,width);}
 ctx.restore();return true;
}
module.exports={frameAt,draw,names,assetPath,trim,nextWalkPhase,WIDTH,WALK_STRIDE,updateGait,WALK_MARKS,SUPPORT_X,REGISTER_X,SHADOW_W,SHADOW_H,phaseVisualScale};
