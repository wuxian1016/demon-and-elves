'use strict';
function install(g,{enabled=()=>false,Image=null}={}){
 if(g.batWarningAvatarAPI)return g.batWarningAvatarAPI;

 const original=g.incomingAttackWarningStates;
 g.incomingAttackWarningStates=function(...args){
  const rows=original.apply(this,args);
  if(!enabled()||this.tutorial||!['prep','hunt'].includes(this.state))return rows;
  const zone=this.playerWarningZone431();if(!zone)return rows;
  const count=this.resourceZones.length,lane=this.resourceZones.indexOf(zone);
  const bats=(this.hounds||[]).filter(b=>!b.dead&&b.waveBat===true&&b.enemyKind==='bat'&&((b.waveZoneIndex%count+count)%count)===lane);
  if(!bats.length)return rows;
  const wave=Math.max(...bats.map(b=>b.waveNumber||0)),current=bats.filter(b=>b.waveNumber===wave);
  const lead=current.reduce((a,b)=>Math.hypot(a.x-zone.gateX,a.y-zone.gateY)<Math.hypot(b.x-zone.gateX,b.y-zone.gateY)?a:b);
  const distance=Math.hypot(lead.x-zone.gateX,lead.y-zone.gateY);
  if(distance<=72)return rows;
  const speed=65*Math.max(.01,lead.movementSlowMultiplier?.()||1),seconds=Math.max(1,Math.ceil(distance/speed));
  const warning={kind:'slime',enemyKind:'bat',waveNumber:wave,source:lead,zone,target:{x:zone.gateX,y:zone.gateY},seconds,progress:Math.min(1,seconds/60)};
  const out=rows.filter(w=>w.kind!=='slime');out.push(warning);if(out.length>1)for(const w of out)w.stacked=true;return out;
 };
 g.batWarningAvatarBN=(ctx,w,x,y,compact)=>{
  if(w.enemyKind!=='bat'||!enabled())return false;
  // Static native-canvas icon, matching the original slime's flat fill,
  // pale 2px outline and white/dark round eyes. No sprite deformation.
  const k=compact?.8:1;
  const X=v=>x+v*k,Y=v=>y+v*k;
  ctx.save();ctx.globalAlpha=1;ctx.lineWidth=2*k;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.fillStyle='#8760B8';ctx.strokeStyle='#D7BBF5';
  for(const side of [-1,1]){
   ctx.beginPath();ctx.moveTo(X(side*10),Y(-5));
   ctx.quadraticCurveTo(X(side*20),Y(-16),X(side*28),Y(-10));
   ctx.quadraticCurveTo(X(side*25),Y(-5),X(side*27),Y(2));
   ctx.quadraticCurveTo(X(side*22),Y(-1),X(side*19),Y(7));
   ctx.quadraticCurveTo(X(side*15),Y(3),X(side*11),Y(10));
   ctx.closePath();ctx.fill();ctx.stroke();
  }
  ctx.beginPath();ctx.moveTo(X(-12),Y(-7));
  ctx.quadraticCurveTo(X(-18),Y(-28),X(-8),Y(-18));
  ctx.lineTo(X(-3),Y(-12));ctx.lineTo(X(3),Y(-12));
  ctx.lineTo(X(8),Y(-18));ctx.quadraticCurveTo(X(18),Y(-28),X(12),Y(-7));
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(x,Y(1),14*k,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.fillStyle='#F1E9FF';ctx.beginPath();ctx.arc(X(-5),Y(-1),4*k,0,Math.PI*2);ctx.arc(X(5),Y(-1),4*k,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#352449';ctx.beginPath();ctx.arc(X(-4),y,2*k,0,Math.PI*2);ctx.arc(X(4),y,2*k,0,Math.PI*2);ctx.fill();
  ctx.restore();return true;
 };
 return g.batWarningAvatarAPI={installed:true};
}
module.exports={install};
