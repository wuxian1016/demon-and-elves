'use strict';
const LABELS={Player:'精灵',Ally:'队友',Peasant:'工人',Troll:'恶魔/龙',Hound:'史莱姆',MiniTroll:'小恶魔',Tank:'坦克',Robot:'机器人',Projectile:'防御塔弹丸',TankShell:'坦克弹丸',RobotLaser:'激光',RobotSiegeLaser:'重炮激光',Particle:'粒子'};
function animationSummaryPages(data){
 const trace=data?.clientVisualSampling?.actualAnimationContent;
 if(trace?.schema!==1||!Array.isArray(trace.columns)||!Array.isArray(trace.categories)||!Array.isArray(trace.rows)||trace.rows.length>4096)return [];
 const keys=['renderSerial','monotonicMs','category','objectSerial','textureHash','drawGeometryHash','images'],indices=keys.map(k=>trace.columns.indexOf(k));if(indices.some(i=>i<0))return [];
 const groups=new Map();let start=Infinity,end=-Infinity;
 for(const row of trace.rows){if(!Array.isArray(row)||indices.some(i=>!Number.isFinite(row[i])))return [];const[serial,at,category,id,texture,geometry,images]=indices.map(i=>row[i]),label=LABELS[trace.categories[category]];if(!label)continue;start=Math.min(start,at);end=Math.max(end,at);let g=groups.get(label);if(!g)groups.set(label,g={draws:0,pairs:0,texturePairs:0,textureChanges:0,geometryChanges:0,last:null});g.draws++;const last=g.last;if(last&&last.id===id&&last.serial+1===serial){g.pairs++;if(last.geometry!==geometry)g.geometryChanges++;if(images>0&&last.images>0){g.texturePairs++;if(last.texture!==texture)g.textureChanges++;}}g.last={serial,id,texture,geometry,images};}
 const seconds=Number.isFinite(start)&&end>=start?((end-start)/1000).toFixed(2):'0';
 const pages=[['动画内容采样（JS绘制）','保留 '+trace.rows.length+' 条 / '+seconds+'秒','同一对象连续帧才比较','贴图/源矩形与几何分别计数','不是屏幕FPS或实机通过'].join('\n')];
 for(const[label,g]of groups)pages.push([label+' · 实际绘制 '+g.draws+' 次','同对象连续可比 '+g.pairs+' 对',g.texturePairs?'贴图变化 '+g.textureChanges+'/'+g.texturePairs:'贴图：无连续图像样本','几何变化 '+g.geometryChanges+'/'+g.pairs,'静态图不要求每帧换贴图'].join('\n'));
 return pages;
}
module.exports={animationSummaryPages};
