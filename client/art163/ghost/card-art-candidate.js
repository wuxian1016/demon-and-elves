'use strict';
// Approved PNGs, no gameplay crops. Failures release handlers and allow explicit retry.
module.exports=function create({Image,imagePath=value=>value,timeoutMs=10000,loadGhostPackage=null,roundedCardPath,wake=()=>{}}){
 const sprites=Object.create(null),keys=['fury','harvest','fortress','sanctuary','storm'];let promise=null,ready=false,generation=0,lastError=null;
 function prepare(){if(ready)return Promise.resolve(true);if(promise)return promise;const token=++generation;let current=null,timer=null,settled=false;
 const task=new Promise((resolve,reject)=>{let index=0;function finish(error){if(settled)return;settled=true;clearTimeout(timer);if(current)current.onload=current.onerror=null;if(error){lastError=String(error.message||error);for(const key of keys)delete sprites[key];reject(error);}else{ready=true;lastError=null;resolve(true);}}
 timer=setTimeout(()=>finish(Error('Card art loading timed out')),timeoutMs);function next(){if(token!==generation)return;try{const type=keys[index],im=current=new Image();im.onerror=()=>finish(Error('Card art failed: '+type));im.onload=()=>{if(settled||token!==generation)return;if(!im.width||!im.height){finish(Error('Invalid card art: '+type));return;}sprites[type]=im;im.onload=im.onerror=null;if(++index<keys.length)next();else finish();};im.src=imagePath('/card-art/'+type+'.png');}catch(error){finish(error);}}next();});
 promise=task.catch(error=>{promise=null;throw error;});return promise;}
 let ghost=null,loading=false,retryAt=0;
 function warmGhost(){if(!loadGhostPackage||ghost||loading||Date.now()<retryAt)return;loading=true;let timer;let im;function done(ok){clearTimeout(timer);if(im)im.onload=im.onerror=null;if(ok)ghost=im;else retryAt=Date.now()+5000;loading=false;if(ok)wake();}
 timer=setTimeout(()=>done(false),timeoutMs);Promise.resolve().then(loadGhostPackage).then(()=>{if(!loading)return;im=new Image();im.onload=()=>done(im.width>0&&im.height>0);im.onerror=()=>done(false);im.src=imagePath('/factory-model-art/ghost-job.webp.bin');}).catch(()=>done(false));}
 // Trace the approved 480x720 print itself. No recolor/re-encode, extra bitmap or offscreen pass.
 function ghostContour(c,b){
  const x=n=>b.x+n*b.w/480,y=n=>b.y+n*b.h/720;
  c.beginPath();c.moveTo(x(240),y(11.5));
  c.lineTo(x(257),y(35.5));c.lineTo(x(256),y(41.5));c.bezierCurveTo(x(267),y(36),x(282),y(37),x(292),y(42.5));
  c.quadraticCurveTo(x(286),y(43),x(279),y(48));c.lineTo(x(405),y(48));c.bezierCurveTo(x(427),y(48),x(443),y(62),x(443.5),y(86));c.lineTo(x(443.5),y(638));c.bezierCurveTo(x(443.5),y(658),x(430),y(674.5),x(403),y(675));
  c.lineTo(x(264),y(675));c.quadraticCurveTo(x(250),y(675),x(240),y(689.5));c.quadraticCurveTo(x(229),y(675),x(216),y(675));c.lineTo(x(76),y(675));
  c.bezierCurveTo(x(51),y(674.5),x(36),y(660),x(36),y(638));c.lineTo(x(35.5),y(86));c.bezierCurveTo(x(35.5),y(62),x(50),y(48),x(75),y(48));c.lineTo(x(201),y(48));
  c.quadraticCurveTo(x(195),y(44),x(187.5),y(42.5));c.bezierCurveTo(x(198),y(37),x(211),y(36),x(224),y(41.5));c.lineTo(x(223.5),y(35.5));c.closePath();c.clip();
 }
 function draw(c,type,b,front){if(type==='ghost'){
  if(ghost){c.save();ghostContour(c,b);c.drawImage(ghost,b.x,b.y,b.w,b.h);
   // Expanded cards add one ability line in the unused interior footer, not the miniature.
   if(b.w>=96){
    c.textAlign='center';c.textBaseline='alphabetic';c.font=(b.w*18/480)+'px sans-serif';c.fillStyle='#f7e8ff';
    c.fillText('附身蝙蝠后，可偷取恶魔或队友的资源。',b.x+b.w/2,b.y+b.h*610/720,b.w*372/480);
   }
   c.restore();return;}
  warmGhost();
  // Prototype marker only: no unapproved production art or character effect.
  const x=b.x,y=b.y,w=b.w,h=b.h;
  c.save();roundedCardPath(c,x,y,w,h,w*.06);c.fillStyle='#24233d';c.fill();c.lineWidth=Math.max(1,w*.02);c.strokeStyle='#a5a0db';c.stroke();
  c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ede8ff';c.font='bold '+Math.max(5,w*.19)+'px sans-serif';c.fillText('幽灵卡',x+w*.5,y+h*.43,w*.94);
  if(front&&w>=100){c.font='bold '+w*.086+'px sans-serif';c.fillText('附身 · 隐身',x+w*.5,y+h*.65,w*.94);}
  c.restore();return;
 }const im=sprites[type];if(!ready||!im)return;c.save();if(front){c.shadowColor='#ffcf4e';c.shadowBlur=16*(b.w/267);c.shadowOffsetX=c.shadowOffsetY=0;}c.drawImage(im,b.x,b.y,b.w,b.h);if(front){c.shadowBlur=8*(b.w/267);c.drawImage(im,b.x,b.y,b.w,b.h);}
 if(type==='fury'){
  c.shadowBlur=0;
  const x=b.x+b.w*.052,y=b.y+b.h*.714,w=b.w*.896,h=b.h*.102;
  c.fillStyle='#572921';c.fillRect(x,y,w,h);
  c.font='bold '+Math.max(3,b.w*.073)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe3a3';
  const expanded=b.w>=100;
  c.fillText('攻击 ×6 / 攻速 ×2',b.x+b.w*.5,y+h*(expanded?.30:.52),w);
  if(expanded){
   c.font='bold '+Math.max(3,b.w*.051)+'px sans-serif';
   c.fillText('不含坦克和机器人',b.x+b.w*.5,y+h*.77,w);
  }
 }
 if(type==='fortress'){
  // The approved source embeds two ×5 labels. Mask only that text column.
  const x=b.x+b.w*.052,y=b.y+b.h*.708,w=b.w*.896,h=b.h*.098;
  c.shadowBlur=0;c.fillStyle='#102e4a';c.fillRect(x,y,w,h);
  c.font='bold '+Math.max(3,b.w*.084)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe3a3';
  c.fillText('建筑血量 ×2 / 防御 ×2',b.x+b.w*.5,y+h*.55,w-1);
 }
 if(type==='storm'){
  const x=b.x+b.w*.052,y=b.y+b.h*.708,w=b.w*.896,h=b.h*.098;
  c.shadowBlur=0;c.fillStyle='#442660';c.fillRect(x,y,w,h);
  c.font='bold '+Math.max(3,b.w*.084)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe3a3';
  c.fillText('范围伤害 / 眩晕 3 秒',b.x+b.w*.5,y+h*.55,w-1);
 }
 if(type==='fury'||type==='fortress'||type==='harvest'){
  // Replace the text only; keep the artwork and original clock icon.
  const x=b.x+b.w*.445,y=b.y+b.h*.859,w=b.w*.285,h=b.h*.071;
  c.shadowBlur=0;c.fillStyle=type==='fury'?'#5d3025':type==='fortress'?'#10344d':'#234824';c.fillRect(x,y,w,h);
  c.font='bold '+Math.max(3,b.w*.083)+'px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#ffe9b0';
  c.fillText(type==='fortress'?'2分钟':'1分钟',x+w*.51,y+h*.52,w-1);
 }
 c.restore();}
 return{prepare,draw,warmGhost,stealthImage(warm){if(warm&&!ghost)warmGhost();return ghost;},get ready(){return ready;},get lastError(){return lastError;}};
};
