// usage: node pixdiff.cjs a.rgba b.rgba width out.png
const fs=require('fs'),n=require('@napi-rs/canvas');
const [a,b,wArg,out]=process.argv.slice(2);const A=fs.readFileSync(a),B=fs.readFileSync(b),W=+wArg,H=A.length/4/W;
let cnt=0,maxd=0,x0=1e9,y0=1e9,x1=-1,y1=-1;const cv=n.createCanvas(W,H),c=cv.getContext('2d'),img=c.createImageData(W,H);
for(let i=0;i<A.length;i+=4){const d=Math.max(Math.abs(A[i]-B[i]),Math.abs(A[i+1]-B[i+1]),Math.abs(A[i+2]-B[i+2]),Math.abs(A[i+3]-B[i+3]));const p=i/4,x=p%W,y=(p/W)|0;img.data[i]=A[i]>>2;img.data[i+1]=A[i+1]>>2;img.data[i+2]=A[i+2]>>2;img.data[i+3]=255;if(d){cnt++;maxd=Math.max(maxd,d);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);img.data[i]=255;img.data[i+1]=0;img.data[i+2]=255;}}
c.putImageData(img,0,0);if(out)fs.writeFileSync(out,cv.toBuffer('image/png'));
console.log(JSON.stringify({diffPixels:cnt,maxChannelDiff:maxd,bbox:cnt?[x0,y0,x1,y1]:null}));
