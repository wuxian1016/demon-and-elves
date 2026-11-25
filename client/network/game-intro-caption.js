'use strict';
function drawIntroFeather(ctx, glyphBoxes, { feather = 12, alpha = .30 } = {}) {
  const boxes = glyphBoxes.filter(b => b && [b.x,b.y,b.w,b.h].every(Number.isFinite) && b.w > 0 && b.h > 0);
  if (!boxes.length) return null;
  if (!Number.isFinite(feather) || !Number.isFinite(alpha) || feather <= 0 || alpha <= 0 || alpha > 1) return null;
  const l=Math.min(...boxes.map(b=>b.x)), t=Math.min(...boxes.map(b=>b.y));
  const r=Math.max(...boxes.map(b=>b.x+b.w)), b=Math.max(...boxes.map(b=>b.y+b.h));
  const dark='rgba(0,0,0,'+alpha+')', clear='rgba(0,0,0,0)';
  const edge=(gradient,x,y,w,h)=>{
    gradient.addColorStop(0,dark);gradient.addColorStop(1,clear);
    ctx.fillStyle=gradient;ctx.fillRect(x,y,w,h);
  };
  ctx.save();
  try {
    ctx.fillStyle=dark;ctx.fillRect(l,t,r-l,b-t);
    edge(ctx.createLinearGradient(l,t,l,t-feather),l,t-feather,r-l,feather);
    edge(ctx.createLinearGradient(l,b,l,b+feather),l,b,r-l,feather);
    edge(ctx.createLinearGradient(l,t,l-feather,t),l-feather,t,feather,b-t);
    edge(ctx.createLinearGradient(r,t,r+feather,t),r,t,feather,b-t);
    for(const [x,y,dx,dy] of [[l,t,-1,-1],[r,t,0,-1],[l,b,-1,0],[r,b,0,0]]) {
      edge(ctx.createRadialGradient(x,y,0,x,y,feather),x+feather*dx,y+feather*dy,feather,feather);
    }
  } finally { ctx.restore(); }
  return { x:l-feather, y:t-feather, w:r-l+2*feather, h:b-t+2*feather };
}

const heading='经营养成 × 塔防 × 即时战略';
const body='恶魔沉睡的 60 秒，是你布防的机会。抓紧采集资源、筑墙建塔，守住家园。站稳脚跟后，发展经济、升级科技，造出机器人反击。摧毁恶魔城堡，即可获胜！';
function wrap(text,measure,width){
 const lines=[];let line='';
 for(const ch of text){
  if(line&&measure(line+ch)>width){if(/[，。！、；：？）]/.test(ch)&&line.length>1){lines.push(line.slice(0,-1));line=line.slice(-1);}else{lines.push(line);line='';}}
  line+=ch;
 }
 if(line)lines.push(line);
 return lines;
}
function draw(c,{x,top,bottom,width,center=false,size=15,alpha=.42},native=x=>x){
 if(![x,top,bottom,width].every(Number.isFinite)||width<104||bottom-top<39)return null;
 const font=(n,b=false)=>(b?'bold ':'')+n+'px sans-serif',setw=n=>c.font=font(n),feather=10,bodyWidth=width-feather*2-7;
 const safeMetrics=(text,n)=>{const m=c.measureText(native(text)),ascent=m.actualBoundingBoxAscent,descent=m.actualBoundingBoxDescent,w=Math.ceil(m.width+2);return{w,ascent:Number.isFinite(ascent)&&ascent>0?Math.max(n*.8,ascent):n,descent:Number.isFinite(descent)&&descent>0?Math.max(n*.24,descent):n*.28};};
 c.save();
 try{
  c.textAlign='center';c.textBaseline='alphabetic';c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetX=c.shadowOffsetY=0;
  for(let n=size;n>=9;n--){
   setw(n);const measure=t=>c.measureText(native(t)).width;
   let lines=wrap(body,measure,bodyWidth);
   // Avoid leaving one or two final glyphs on their own when the same number
   // of lines can use a more centered, narrower text area.
   if(lines.length>1&&measure(lines.at(-1))<bodyWidth*.5){
    let low=Math.ceil(bodyWidth*.65),high=Math.floor(bodyWidth);
    while(low<high){
     const mid=(low+high)>>1,trial=wrap(body,measure,mid);
     if(trial.length<=lines.length){lines=trial;high=mid;}else low=mid+1;
    }
   }
   const lineStep=Math.ceil(n*1.34),headSize=n+2,headY=headSize+feather+1,first=headY+lineStep+3;
   c.font=font(headSize,true);const head=safeMetrics(heading,headSize);
   if(head.w>bodyWidth)continue;
   setw(n);const hs=lines.map(t=>safeMetrics(t,n));
   const span=first+lineStep*(lines.length-1)+Math.ceil(hs.at(-1).descent)+feather+1;
   if(span>bottom-top)continue;
   const anchor=Math.round(top+(center?(bottom-top-span)*.5:0));
   const baseline=anchor+headY,baselines=lines.map((_,i)=>anchor+first+i*lineStep);
   const box=(m,y)=>({x:Math.floor(x-m.w/2),y:Math.floor(y-m.ascent),w:m.w+2,h:Math.ceil(m.ascent+m.descent)+1});
   const boxes=[box(head,baseline),...hs.map((m,i)=>box(m,baselines[i]))];
   const region=drawIntroFeather(c,boxes,{feather,alpha});
   c.font=font(headSize,true);c.fillStyle='#f6e2ad';c.fillText(native(heading),x,baseline);
   setw(n);c.fillStyle='#fff9e8';lines.forEach((t,i)=>c.fillText(native(t),x,baselines[i]));
   return {region,boxes,lines,n};
  }
  return null;
 }finally{c.restore();}
}
module.exports={heading,body,drawIntroFeather,draw};
