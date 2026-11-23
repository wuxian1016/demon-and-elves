'use strict';
// Local display derived only from complete, successfully installed authority views.
// It never sends input, changes membership, opens a modal, or pauses simulation.
class TeamStatusNotices{
 constructor({clock=Date.now,durationMs=5000}={}){this.clock=clock;this.durationMs=durationMs;this.reset();}
 reset(){this.scope=null;this.revision=-1;this.members=new Map();this.notices=new Map();this.version=0;this.layout=null;this.messageVersion=0;this.messageCache=[];}
 clearDisplay(){this.notices.clear();this.version++;this.layout=null;}
 observe(packet,roster=packet?.roster,currentTick=packet?.tick){
  if(!packet||typeof packet.roomId!=='string'||!packet.roomId||typeof packet.viewerOwnerId!=='string'||!Number.isSafeInteger(packet.epoch)||packet.epoch<1||!Number.isSafeInteger(packet.revision)||packet.revision<0||!Number.isSafeInteger(packet.tick)||packet.tick<0||!Number.isSafeInteger(currentTick)||currentTick<packet.tick||!Array.isArray(roster)||!roster.length||roster.length>9)return false;
  const next=new Map(),seats=new Set();
  for(const row of roster){if(!row||typeof row.ownerId!=='string'||!row.ownerId||next.has(row.ownerId)||!Number.isInteger(row.seat)||row.seat<0||row.seat>8||seats.has(row.seat)||!['human','ai'].includes(row.kind)||typeof row.connected!=='boolean')return false;next.set(row.ownerId,row);seats.add(row.seat);}
  if(next.get(packet.viewerOwnerId)?.kind!=='human')return false;
  const scope={room:packet.roomId,epoch:packet.epoch,viewer:packet.viewerOwnerId},same=this.scope&&this.scope.room===scope.room&&this.scope.viewer===scope.viewer;
  if(same&&scope.epoch<this.scope.epoch)return false;
  if(!same||scope.epoch!==this.scope.epoch){this.reset();this.scope=scope;this.revision=packet.revision;for(const row of roster)if(row.kind==='human'&&row.ownerId!==scope.viewer)this.members.set(row.ownerId,{seat:row.seat,connected:row.connected,left:false});return true;}
  if(packet.revision<=this.revision)return false;
  // Seats/kinds cannot change within a live epoch. Reject a partial/mixed view
  // rather than interpreting a malformed entry as an exit.
  for(const[id,old]of this.members){const row=next.get(id);if(row&&(row.kind!=='human'||row.seat!==old.seat))return false;}
  this.revision=packet.revision;const recent=currentTick-packet.tick<=120,now=this.clock();
  for(const[id,old]of this.members){
   if(old.left)continue;const row=next.get(id);let state=null;
   if(!row){old.left=true;state='left';}
   else if(row.connected!==old.connected){old.connected=row.connected;state=row.connected?'online':'offline';}
   if(state){this.notices.delete(id);if(recent)this.notices.set(id,{seat:old.seat,state,until:now+this.durationMs});this.version++;}
  }
  return true;
 }
 messages(){
  const now=this.clock();for(const[id,n]of this.notices)if(now>=n.until){this.notices.delete(id);this.version++;}
  if(this.messageVersion===this.version)return this.messageCache;
  const groups={offline:[],left:[],online:[]};for(const n of this.notices.values())groups[n.state].push(n.seat);
  const text=[];for(const state of ['offline','left','online'])if(groups[state].length){const who=groups[state].sort((a,b)=>a-b).map(seat=>'玩家'+(seat+1)).join('、');text.push(who+({offline:'已掉线，可重连继续',left:'已退出本局，不再重连',online:'已重连，继续游戏'}[state]));}this.messageVersion=this.version;this.messageCache=text;return text;
 }
 draw(ctx,canvas,viewport){
  if(!this.notices.size)return;
  const messages=this.messages();if(!messages.length)return;
  const width=viewport.width,height=viewport.fullHeight||viewport.height;if(!(width>0&&height>0))return;
  const boxW=Math.min(420,width-24),textW=boxW-20,font='13px sans-serif';
  ctx.save();try{
   ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.font=font;
   if(!this.layout||this.layout.version!==this.version||this.layout.width!==boxW){const lines=[];for(const message of messages){let line='';for(const char of message){if(line&&(ctx.measureText?ctx.measureText(line+char).width:(line.length+1)*13)>textW){lines.push(line);line=char;}else line+=char;}if(line)lines.push(line);}this.layout={version:this.version,width:boxW,lines};}
   const lines=this.layout.lines,boxH=lines.length*19+16,x=(width-boxW)/2,y=Math.min(Math.max(12,(viewport.safeTop||0)+76),Math.max(12,height-boxH-110));
   ctx.fillStyle='rgba(16,43,35,0.94)';ctx.fillRect(x,y,boxW,boxH);ctx.textAlign='left';ctx.textBaseline='top';ctx.fillStyle='#fff4d6';for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x+10,y+8+i*19,textW);
  }finally{ctx.restore();}
 }
}
module.exports={TeamStatusNotices};
