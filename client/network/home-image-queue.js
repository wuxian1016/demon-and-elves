'use strict';

// Native callbacks bound each decode. Eviction never starts the next job while
// the former decoder still owns an image; a missing callback has a finite timeout.
module.exports=function createHomeImageQueue(Image,resolvePath){
 const entries=new Map();
 const readImage=require('./native-image-decode');
 function detach(image){if(image){image.onload=image.onerror=null;image.src='';}}
 function load(name){
  const existing=entries.get(name);
  if(existing)return existing.promise;
  const entry={image:new Image(),settled:false};
  entries.set(name,entry);
  const current=()=>entries.get(name)===entry;
  entry.promise=readImage(entry.image,resolvePath(name),8000,current).then(image=>{
   entry.settled=true;
   if(!current() || !image)return null;
   if(!image.width || !image.height)throw Error('图片尺寸异常：'+name);
   return image;
  }).catch(error=>{
   entry.settled=true;
   if(!current())return null;
   entries.delete(name);detach(entry.image);
   throw error;
  });
  return entry.promise;
 }
 function drop(name){
  const entry=entries.get(name);
  if(!entry)return;
  entries.delete(name);
  if(entry.settled)detach(entry.image);
  else readImage.discardObsolete();
 }
 const menu='art163/home-design-v459.jpg',ui='art163/ui524.webp.bin';
 const background=wide=>wide?'art163/home-landscape471.jpg':'art163/home-background-v460.jpg';
 function prepare(wide){
  drop(background(!wide));
  return Promise.all([load(menu),load(ui),load(background(wide))]);
 }
 function releaseHome(){for(const name of [menu,background(false),background(true)])drop(name);}
 return {load,prepare,releaseHome};
};
