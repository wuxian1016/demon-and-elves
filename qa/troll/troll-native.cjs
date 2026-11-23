'use strict';
const fs=require('node:fs'),path=require('node:path'),a=require('node:assert/strict'),hash=require('node:crypto'),{makeHost,STARTUP,until}=require('./instrumented-host.cjs');
const {createCanvas,loadImage}=require('@napi-rs/canvas');
const [root,mode]=process.argv.slice(2),fixed=mode!=='before',inject=mode==='retry';
const disk=fs.mkdtempSync(path.join(__dirname,'troll-storage-'));fs.writeFileSync(path.join(disk,'keys.json'),'{}');
const h=makeHost(root,disk,false,{width:390,height:844,clockStart:1800000000000,seed:150});
const pics=[],pkgs=[];let failed=false,readDecoded=0,checkedPackage=false;
const read=h.wx.createImage,load=h.wx.loadSubpackage;
const asset=s=>String(s).endsWith('/forest-troll.webp.bin');
h.wx.createImage=()=>{const im=read(),d=Object.getOwnPropertyDescriptor(im,'src');Object.defineProperty(im,'src',{...d,set(s){if(asset(s)){pics.push(s);if(inject&&!failed){failed=true;queueMicrotask(()=>im.onerror?.({errMsg:'controlled one-time failure'}));return;}}return d.set.call(this,s);}});return im;};
h.wx.loadSubpackage=o=>{pkgs.push(o.name);if(o.name==='monsterRearMotion'){queueMicrotask(()=>o.fail?.({errMsg:'controlled package unavailable'}));return {onProgressUpdate(){}};}return load(o);};
const tap=b=>{a(b);const p={identifier:5,x:b.x+b.w/2,y:b.y+b.h/2};p.clientX=p.x;p.clientY=p.y;h.emit('TouchStart',{touches:[p],changedTouches:[p]});h.emit('TouchEnd',{touches:[],changedTouches:[p]});};
let traces=[],scales=[];const ctx=new Proxy({drawImage(im,...p){traces.push([im.src,...p]);},scale(x,y){scales.push([x,y]);}},{get(o,k){return k in o?o[k]:()=>{};}});
const stride=1000/60;
(async()=>{
 h.start();await until(()=>h.stored()[STARTUP]?.events?.at(-1)?.kind==='ready','home bootstrap',25000);
 const {window:w,runtime}=h.env(),g=w.game,T=w.originalNetwork627.types;
 await until(()=>{g.draw();return g.homeOptionsReadyBN&&g.startBlurLayer477;},'real Home',12000);
 a.equal(pics.length,0,'no troll image at cold Home');a.equal(w.rangedTrollArtBN.ready,false);
 tap(g.getStartActionButtons().find(x=>x.id==='startGame'));await until(()=>!g.roundStarting&&g.state==='prep','real first game',30000);
 a.equal(pics.length,0,'no troll texture before an actual rendered encounter');
 h.emit('MemoryWarning',{level:10});a.equal(runtime.memoryConstrained(),true);
 g.state='hunt';g.tutorial=null;g.endlessOpeningIntro=null;g.troll.dead=true;g.demonLineBlocked=()=>false;g.slimeBlockingBuilding410=()=>null;
 const troll=new T.Hound(g.player.x+90,g.player.y-100,13);
 Object.assign(troll,{waveRangedTrollBN:true,waveHound:true,waveDamage:40,enemyKind:'ranged-troll',moving:true,sideways:false,facing:1,facingV:1,hp:100,maxHp:100});
 troll.draw(ctx);
 if(inject){
  await until(()=>failed,'first watched image failure',3500);await new Promise(setImmediate);
  a.equal(w.rangedTrollArtBN.ready,false);a.equal(pics.length,1);
  for(let n=0;n<100;n++)troll.draw(ctx);
  a.equal(pics.length,1,'one failure cannot cause per-actor decode');
  h.advance(12001);troll.draw(ctx);
 }
 if(fixed)await until(()=>w.rangedTrollArtBN.ready,'visible art under warning',7500);
 else {a.equal(w.rangedTrollArtBN.ready,false);a.equal(pics.length,0,'baseline warning gates all author reads');}
 const action=h.evaluate(path.join(root,'network/ranged-wave-troll.js'));
 function capture(fn){traces=[];scales=[];fn();let t=traces.find(x=>asset(x[0]))??traces.find(x=>String(x[0]).includes('monster-species-lite'));a(t,'actual unit selects expected authored or lite artist');
 if(fixed)a(asset(t[0]));return{cell:t.slice(1,5),flipped:scales.some(([x,y])=>x===-1&&y===1)};}
 const loops={},attacks=[];
 for(const [name,rear,dir] of [['front-right',false,1],['rear-left',true,-1]]){
  Object.assign(troll,{rangedTrollCastBN:null,rangedTrollReleaseUntilBN:0,moving:true,facing:dir,facingV:rear?-1:1,sideways:false});
  loops[name]=[0,1,2,3].map(i=>capture(()=>{g.supportTime=i*185;troll.draw(ctx);}));
  a.equal(new Set(loops[name].map(o=>o.cell.join())).size,fixed?4:2);
  if(fixed)for(const [i,c] of loops[name].entries()){a.deepEqual(c.cell,[i*168,rear?136:0,168,136]);a.equal(c.flipped,dir===-1);}
  g.projectiles=[];g.supportTime=1e4;let damage=0;
  const target={x:troll.x+dir*70,y:troll.y+(rear?-100:100),hp:9999,radius:16,takeDamage(amount,src){a.equal(src,troll);damage+=amount;this.hp-=amount;}};
  a(action.start(g,troll,target,1200));a.equal(troll.rangedTrollRearBN,rear);a.equal(troll.facing,dir);
  const wind=[];
  for(let i=0;i<12;i++){
   if(i%4===0)wind.push(capture(()=>troll.draw(ctx)));
   action.tickCast(g,troll,25,T.Projectile,w.rangedTrollArtBN);g.supportTime+=25;
  }
  if(!g.projectiles.length){action.tickCast(g,troll,.001,T.Projectile,w.rangedTrollArtBN);g.supportTime+=.001;}
  a.equal(g.projectiles.length,1);const release=capture(()=>troll.draw(ctx)),seed=g.projectiles[0];
  if(fixed){for(const [i,c] of wind.entries())a.deepEqual(c.cell,[(4+i)*168,rear?136:0,168,136]);a.deepEqual(release.cell,[7*168,rear?136:0,168,136]);}
  a.equal(seed.damage,action.nativeDamage(g,troll,target));
  for(let i=0;i<40&&!seed.dead;i++)action.tickSeed(g,seed,stride);
  a(seed.dead);a.equal(damage,seed.damage);attacks.push({name,wind,release,damage,speed:505,cooldown:troll.attackCd});
 }
 const before=pics.slice();
 for(let i=0;i<320;i++){if(i%40===0)h.emit('MemoryWarning',{level:10});troll.draw(ctx);}
 h.emit('Hide',{});h.advance(1000);h.emit('Show',{});troll.draw(ctx);
 a.deepEqual(pics,before,'draw/warning/background cycles never grow decode count');
 if(fixed){a.equal(runtime.memoryConstrained(),true);a.equal(w.rangedTrollArtBN.ready,true);a.equal(pics.length,inject?2:1);a(pics.every(s=>String(s).startsWith('art163/')||String(s).startsWith('/art163/')));}
 a.equal(pkgs.filter(x=>x==='monsterRearMotion').length,0,'no separate native package mount');
 const report={mode,loops,attacks,reads:pics,observedSharedMontages:pkgs.filter(x=>x==='art163').length,nominalRGBA:1344*300*4,assetSHA:'58cad2bb609a1d97f3b351d5510c79950438a4494ccc97ddcde31b56bf29b1db'};
 if(mode==='after'){
   const pix=await loadImage(fs.readFileSync(path.join(root,'art163/forest-troll.webp.bin'))),sheet=createCanvas(8*110,2*120),r=sheet.getContext('2d');
   const rng=require('crypto').createHash;r.fillStyle='#243529';r.fillRect(0,0,sheet.width,sheet.height);const raster=[];
   for(const [idx,rear] of [false,true].entries()){const row=[];for(let i=0;i<8;i++){
    const c=createCanvas(110,120).getContext('2d');const original=c.drawImage.bind(c);c.drawImage=(_, ...q)=>original(pix,...q);
    const rev=rear?-1:1;troll.x=56;troll.y=101;w.rangedTrollArtBN.drawUnit(c,troll,i<4?'walk':i<7?'windup':'release',i<4?i:i-4,rev,rear);
    row.push(rng('sha256').update(c.getImageData(0,0,110,120).data).digest('hex'));
    r.drawImage(c.canvas,i*110,idx*120);
   }a.equal(new Set(row).size,8);raster.push(row);}
   fs.writeFileSync(path.join(__dirname,'troll-16-authored-poses-mac.png'),sheet.toBuffer('image/png'));report.rasterAssetFrames=raster;
 }
 fs.writeFileSync(path.join(__dirname,'proof-'+mode+'.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({mode,reads:pics,attack:attacks.map(x=>x.damage),nominalRGBA:report.nominalRGBA}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;}).finally(()=>{h.close();fs.rmSync(disk,{recursive:true,force:true});});
