'use strict';
// Rows are sorted, disjoint half-open intervals on the same exact CELL3 grid.
// Reuse the prior explored row when the current visibility adds no cells.
function mergeExploredRow(prior,visible){
 if(!prior)return visible;
 if(!visible)return prior;
 let a=1;
 for(let b=1;b<visible.length;b+=2){
  while(a<prior.length&&prior[a+1]<visible[b+1])a+=2;
  if(a>=prior.length||prior[a]>visible[b]){
   const out=[prior[0]];let i=1,j=1;
   while(i<prior.length||j<visible.length){
    const old=j>=visible.length||i<prior.length&&prior[i]<=visible[j];
    const row=old?prior:visible,k=old?i:j;
    if(old)i+=2;else j+=2;
    const n=out.length;
    if(n>1&&row[k]<=out[n-1])out[n-1]=Math.max(out[n-1],row[k+1]);else out.push(row[k],row[k+1]);
   }
   return out;
  }
 }
 return prior;
}
function* mergeExploredRows(prior,visible){
 let i=0,j=0;
 while(i<prior.length||j<visible.length){
  const a=prior[i],b=visible[j];
  if(!b||a&&a[0]<b[0]){yield a;i++;}
  else if(!a||b[0]<a[0]){yield b;j++;}
  else{yield mergeExploredRow(a,b);i++;j++;}
 }
}

module.exports={mergeExploredRows};
