'use strict';
// Opt-in internal observation of ACTUAL entity draw calls. No image data,
// resource URLs, account IDs, text, network bodies or per-frame serialization.
const CATEGORIES=['Player','Ally','Peasant','Troll','Hound','MiniTroll','Tank','Robot','Projectile','TankShell','RobotLaser','RobotSiegeLaser','Particle'];
const COLUMNS=['renderSerial','monotonicMs','authorityTick','category','objectSerial','x','y','poseHash','textureHash','drawGeometryHash','images','vectorCalls','cameraX','cameraY','stateFlags','completedDrawMs'];
const METHODS=['drawImage','fillRect','strokeRect','moveTo','lineTo','arc','ellipse','rotate','fill','stroke'];
const mix=(h,n)=>Math.imul(h^(Number.isFinite(n)?Math.round(n*1000):2147483647),16777619)>>>0;
class AnimationContentTrace{
 constructor({limit=2048}={}){this.limit=Math.min(4096,Math.max(64,Math.floor(limit)));this.rows=new Float64Array(this.limit*COLUMNS.length);this.scratch=new Float64Array(CATEGORIES.length*COLUMNS.length);this.saved=[];this.images=new WeakMap();this.objects=new WeakMap();this.reset();}
 reset(){this.count=0;this.cursor=0;this.renderSerial=0;this.completedFrames=0;this.active=false;this.capture=null;this.scope=null;this.imageSerial=0;this.objectSerial=0;this.images=new WeakMap();this.objects=new WeakMap();this.seen=new Uint8Array(CATEGORIES.length);this.pending=0;}
 install(game,types){
  if(this.saved.length)return;this.game=game;const trace=this,ctx=game.ctx;
  const wrap=(target,key,fn)=>{const original=target?.[key];if(typeof original!=='function')return;const descriptor=Object.getOwnPropertyDescriptor(target,key);if(descriptor&&!descriptor.configurable&&!descriptor.writable)return;const wrapped=fn(original);try{target[key]=wrapped;if(target[key]!==wrapped)return;}catch(_){return;}this.saved.push({target,key,original,descriptor,wrapped});};
  for(let category=0;category<CATEGORIES.length;category++)wrap(types[CATEGORIES[category]]?.prototype,'draw',original=>function(){
   if(!trace.active||trace.capture||trace.seen[category])return original.apply(this,arguments);
   trace.seen[category]=1;const slot=trace.pending++,at=slot*COLUMNS.length,rows=trace.scratch;let id=trace.objects.get(this);if(!id){id=++trace.objectSerial;trace.objects.set(this,id);}
   let pose=2166136261;for(const key of ['walkDist','collectTimer','slimeHop','actionAnim','roarAnim','flameTimer','activityAngle584','charge','life','paintAge'])pose=mix(pose,this[key]);
   rows[at]=trace.renderSerial;rows[at+1]=trace.at;rows[at+2]=trace.tick;rows[at+3]=category;rows[at+4]=id;rows[at+5]=Number.isFinite(this.x)?this.x:0;rows[at+6]=Number.isFinite(this.y)?this.y:0;rows[at+7]=pose;rows[at+8]=2166136261;rows[at+9]=2166136261;rows[at+10]=rows[at+11]=0;rows[at+12]=game.camera?.x||0;rows[at+13]=game.camera?.y||0;rows[at+14]=(this.moving?1:0)|(this.dead?2:0)|(this.stickDriven?4:0)|(this.task?.phase==='collect'?8:0);trace.capture=at+1;
   try{return original.apply(this,arguments);}finally{trace.capture=null;}
  });
  for(let method=0;method<METHODS.length;method++)wrap(ctx,METHODS[method],original=>function(){
   if(trace.active&&trace.capture){const at=trace.capture-1,r=trace.scratch;let geometry=mix(r[at+9],method);
    if(method===0){const image=arguments[0];let id=0;if(image&&(typeof image==='object'||typeof image==='function')){id=trace.images.get(image);if(!id){id=++trace.imageSerial;trace.images.set(image,id);}}let texture=mix(r[at+8],id);texture=mix(texture,arguments.length);if(arguments.length===9)for(let i=1;i<=4;i++)texture=mix(texture,arguments[i]);r[at+8]=texture;r[at+10]++;for(let i=1;i<arguments.length;i++)geometry=mix(geometry,arguments[i]);}
    else{r[at+11]++;for(let i=0;i<arguments.length;i++)if(typeof arguments[i]==='number')geometry=mix(geometry,arguments[i]);}
    r[at+9]=geometry;
   }
   return original.apply(this,arguments);
  });
 }
 begin(view,now){if(this.active||!Number.isFinite(now)||!Number.isSafeInteger(view?.tick))return false;const scope=JSON.stringify([view.roomId,view.viewerOwnerId,view.epoch]);if(scope!==this.scope){this.reset();this.scope=scope;}this.active=true;this.at=now;this.tick=view.tick;this.renderSerial++;this.seen.fill(0);this.pending=0;return true;}
 end(now,error=false){if(!this.active)return;this.active=false;this.capture=null;if(error||!Number.isFinite(now)||now<this.at){this.pending=0;return;}this.completedFrames++;
  for(let row=0;row<this.pending;row++){const src=row*COLUMNS.length,dst=this.cursor*COLUMNS.length;this.scratch[src+15]=now-this.at;for(let col=0;col<COLUMNS.length;col++)this.rows[dst+col]=this.scratch[src+col];this.cursor=(this.cursor+1)%this.limit;this.count++;}this.pending=0;
 }
 report(){const retained=Math.min(this.count,this.limit),rows=[];for(let i=0;i<retained;i++){const index=(this.cursor-retained+i+this.limit)%this.limit,at=index*COLUMNS.length;rows.push(Array.from(this.rows.subarray(at,at+COLUMNS.length)));}return{schema:1,clock:'same-client battle monotonic milliseconds',columns:COLUMNS,categories:CATEGORIES,completedFrames:this.completedFrames,observedDraws:this.count,limit:this.limit,retained,allocatedSampleBytes:this.rows.byteLength+this.scratch.byteLength,rows,scope:'First actually invoked entity draw per category per completed render. Texture IDs/source rectangles and geometry are hashed, not pixels/GPU/visible photons. Static or vector-only output is explicit. No authority/input-latency/HUD metric is changed; samples do not cover every entity.'};}
 dispose(){for(let i=this.saved.length-1;i>=0;i--){const s=this.saved[i];if(s.target[s.key]!==s.wrapped)continue;if(s.descriptor)Object.defineProperty(s.target,s.key,s.descriptor);else delete s.target[s.key];}this.saved=[];this.reset();}
}
module.exports={AnimationContentTrace};
