'use strict';
const textRows={
 robotSiege:['激光重炮','充能后发射激光；激光达到 20 级后强化。'],
 robotFlame:['扇形喷火','击中扇形范围内的敌人，随后短暂减速。'],
 ghostFlame:['扇形喷火','紫焰与普通喷火的攻击与冷却相同。'],
 robotSuper:['狂暴模式','在有限时间内进入狂暴。'],
 ghostRelocate:['传送','点击地面选择落点，默认传送恶魔。','恶魔落地后减速 80%，持续 10 秒，仍可攻击；冷却 100 秒。'],
 ghostCopy:['复制恶魔','演示结束或跳过后，在机甲正前方生成分身。','紫色分身吸引攻击，存在 60 秒；冷却 180 秒。']
};
const normal={x:0,y:0,facing:1,facingV:1,moving:false,sideways:false,superActive:()=>false};
const slime={x:0,y:0,slimeRage:false,slimeHop:0,facing:1};
function guideLayout(v){
 const left=(v.safeLeft||0)+8,right=v.width-(v.safeRight||0)-8;
 const w=Math.min(v.width-30,620,right-left),x=Math.max(left,Math.min(right-w,(v.width-w)/2));
 let top=(v.safeTop||0)+8;
 const cap=v.capsule;
 if(cap&&x+w>cap.left&&x<cap.right)top=Math.max(top,cap.bottom+8);
 const bottom=v.height-(v.safeBottom||0)-8,h=Math.min(v.height-98,410,bottom-top);
 const y=Math.max(top,Math.min(bottom-h,(v.height-h)/2+12));
 return{x,y,w,h,skip:{x:x+w-91,y:y+6,w:79,h:44,r:8}};
}
function create({art,teleport,clone,ghostRobot,dragon,drawSiege}){
 function ready(id){const a=art();if(id==='ghostRelocate')return !!(teleport&&ghostRobot&&dragon);if(id==='ghostCopy')return !!clone;return !!a?.character&&(!id.toLowerCase().includes('flame')||!!a?.robotFlameEffect);}
 function paint(id,c,v,age,total,{x,y,w,h,skip}=guideLayout(v)){
  const p=Math.max(0,Math.min(1,age/total));
  const txt=(s,cy,n,color,bold=false)=>{c.textAlign='center';c.textBaseline='middle';c.fillStyle=color;c.font=(bold?'bold ':'')+n+'px sans-serif';c.fillText(s,x+w/2,cy,w-24);};
  const row=textRows[id];if(!row)return;
  c.save();
  try{
   c.fillStyle='#18252c';c.fillRect(x,y,w,h);c.strokeStyle='#9e825c';c.strokeRect(x+.5,y+.5,w-1,h-1);
   const left=x+12,right=skip.x-8,width=Math.max(1,right-left);
   c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f8e9c4';c.font='bold 22px sans-serif';
   const half=Math.min(width,c.measureText(row[0]).width)/2;
   c.fillText(row[0],Math.max(left+half,Math.min(x+w/2,right-half)),y+28,width);
   const scene={x:x+12,y:y+54,w:w-24,h:h-119};c.save();
   c.beginPath();c.rect(scene.x,scene.y,scene.w,scene.h);c.clip();
   if(id==='ghostRelocate')teleport(c,p,scene,{robot:ghostRobot,dragon});
   else if(id==='ghostCopy')clone(c,p,scene);
   else{
    const ax=x+w*.32,ay=scene.y+scene.h*.67,scale=Math.min(.72,scene.h/160,w/490);
    const a=art(),f=id==='robotFlame'||id==='ghostFlame',fury=id==='robotSuper';
    if(fury&&p>.23){c.strokeStyle='#e15b68';c.lineWidth=3;c.beginPath();c.ellipse(ax,ay,56*scale,30*scale,0,p*9,p*9+Math.PI*1.8);c.stroke();}
    if(id==='ghostFlame'&&ghostRobot)ghostRobot(c,ax,ay,0);
    else{c.save();c.translate(ax,ay-40*scale);a.character(c,normal,3,scale);c.restore();}
    if(f&&p>.23&&p<.75)a.robotFlameEffect(c,{x:ax+29*scale,y:ay-45*scale,angle:0,reach:w*.48,progress:(p-.23)/.52,time:age,lowDetail:true,purple:id==='ghostFlame'});
    else if(!f&&!fury)drawSiege?.(c,p,scene,ax,ay-38*scale);
    for(let i=0;i<(f?3:1);i++){const px=x+w*(.67+i*.08),py=ay+(i-1)*18*scale;c.save();c.translate(px,py);a.character(c,slime,2,.34);c.restore();}
   }
   c.restore();
   for(let i=1;i<row.length;i++)txt(row[i],y+h-45+(i-1)*20,Math.min(15,w*.045),'#e0e3dc');
  }finally{c.restore();}
 }
 return{ready,paint};
}
module.exports={create,guideLayout,copyLayout:guideLayout};
