'use strict';
// Tint the image that the native body pose renderer selected. The source crop,
// destination, mirroring and all authored pose clocks stay unchanged.
module.exports=function create(canvas,constrained=()=>false){
 const contexts=new WeakMap(),ids=new WeakMap(),poses=new Map();let id=0,bytes=0,bakes=0,hits=0,selected=null;
 let host=null,matrix=null,top=null,failed=false,trim=0,budget=0;
 const free=v=>{v.art.width=1;v.art.height=1;bytes-=v.bytes;};
 function resize(limit){while(poses.size&&(poses.size>48||bytes>limit)){const key=poses.keys().next().value;free(poses.get(key));poses.delete(key);}}
 function clear(){resize(0);host=null;selected=null;matrix=null;top=null;failed=false;}
 function matrixOf(c){return typeof c.getTransform==='function'?c.getTransform():null;}
 function pose(im,sx,sy,sw,sh){
  if(!ids.has(im))ids.set(im,++id);
  const key=ids.get(im)+':'+sx+':'+sy+':'+sw+':'+sh;
  let p=poses.get(key);if(p){hits++;poses.delete(key);poses.set(key,p);return p;}
  if(!budget||failed)return null;
  budget--;
  const k=Math.min(1,256/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*k)),h=Math.max(1,Math.round(sh*k));
  let a;try{
   a=canvas(w,h);if(!a)return null;const c=a.getContext('2d',{willReadFrequently:true});
   c.drawImage(im,sx,sy,sw,sh,0,0,w,h);
   const image=c.getImageData(0,0,w,h),d=image.data;let roof=-1,row=0;
   for(let i=0;i<d.length;i+=4){
    const n=i/4;
    if(n%w===0)row=0;
    if(d[i+3]>112&&roof<0&&++row>=3)roof=Math.floor(n/w);
    if(!d[i+3])continue;
    const r=d[i],g=d[i+1],b=d[i+2],l=.29*r+.57*g+.14*b;
    if(l<17)continue;
    const m=l>174&&Math.max(r,g,b)-Math.min(r,g,b)<40?.66:.92;
    d[i]=r+(19+.78*l-r)*m;d[i+1]=g+(7+.43*l-g)*m;d[i+2]=b+(31+.96*l-b)*m;
   }
   // Some native images expose dimensions before pixels are ready. Do not cache a blank pose.
   if(roof<0){a.width=1;a.height=1;return null;}

   c.putImageData(image,0,0);p={art:a,head:Math.max(0,roof)/h,bytes:w*h*4};
  }catch(_){if(a){a.width=1;a.height=1;}failed=true;return null;}
  bakes++;bytes+=p.bytes;poses.set(key,p);resize(trim);return p;
 }
 function image(c,explicit,im,args){
  const armor=selected&&host?.waveMammothBN&&args.length===8&&(im?.width===880||im?.width===672);
  if(!host||selected&&!armor||(!explicit&&host.waveBat))return c.drawImage(im,...args);
  const full=args.length===8;
  const [sx,sy,sw,sh]=full?args:[0,0,im?.width,im?.height];
  const offset=full?4:0,x=args[offset],y=args[offset+1],w=args[offset+2]??sw,h=args[offset+3]??sh;
  // The native secondary contact/cast shadows are flat; do not tint them.
  if(!im?.width||!(sw>0&&sh>0&&w>14&&h>15)||(!explicit&&(h<w*.4||h>2.7*w)))return c.drawImage(im,...args);
  if(!armor)selected=im;
  const item=pose(im,sx,sy,sw,sh);
  if(!item)return c.drawImage(im,...args);
  const p=matrixOf(c);
  if(!armor&&matrix&&p&&Math.abs(matrix.d)>0.001&&Math.abs(p.b)<1e-5&&Math.abs(matrix.b)<1e-5){
   const wy=(p.f+p.d*(y+item.head*h)-matrix.f)/matrix.d;
   if(Number.isFinite(wy)&&wy>=host.y-300&&wy<host.y-4)top=wy;
  }
  return c.drawImage(item.art,x,y,w,h);
 }
 function context(c){
  let v=contexts.get(c);if(v)return v;
  const methods=new Map();
  v=new Proxy(c,{
   get(t,k){if(k==='drawImage'||k==='ghostHostBodyImageBN'){
    if(!methods.has(k))methods.set(k,(im,...a)=>image(t,k==='ghostHostBodyImageBN',im,a));return methods.get(k);
   }
    const m=Reflect.get(t,k,t);if(typeof m!=='function')return m;
    if(!methods.has(k))methods.set(k,m.bind(t));return methods.get(k);
   },
   set(t,k,v){return Reflect.set(t,k,v,t);}
  });
  contexts.set(c,v);return v;
 }
 function draw(c,h,render){
  host=h;selected=null;matrix=matrixOf(c);top=null;budget=h.waveMammothBN?2:1;trim=constrained()?1152*1024:3*1024*1024;resize(trim);
  try{render(context(c));return top;}finally{host=null;selected=null;matrix=null;}
 }
 return {draw,clear,stats:()=>({count:poses.size,rgbaBytes:bytes,bakes,hits})};
};
