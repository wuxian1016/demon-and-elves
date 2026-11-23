'use strict';

const FRAME_WINDOW_MS = 1000;
const RTT_MAX_AGE_MS = 6500;
const FPS_UNKNOWN = 'FPS --';
const RTT_UNKNOWN = 'HTTP --';

class LiveMatchHud {
  constructor({offline = false} = {}) { this.offline = offline; this.reset(); }

  reset() {
    this.frameStart = null;
    this.frameCount = 0;
    this.fpsText = FPS_UNKNOWN;
    this.clearNetwork();
  }

  clearNetwork() {
    this.warningAt = null;this.networkSource='heartbeatMs';this.networkSamples={};
    this.rttAt = null;
    this.rttValue = null;
    this.rttPaintAt = -Infinity;
    this.rttText = this.offline ? '网络 单机' : RTT_UNKNOWN;
  }

  receipt(ms, at, source='heartbeatMs') {
    if (this.offline) return;
    if (!Number.isFinite(ms) || ms < 0 || !Number.isFinite(at)) return;
    this.warningAt = null;this.networkSamples[source]={ms,at};this.selectNetwork(at);
  }

  selectNetwork(at){
    const s=this.networkSamples.socketRttMs,h=this.networkSamples.heartbeatMs;
    const selected=s&&at>=s.at&&at-s.at<RTT_MAX_AGE_MS?['socketRttMs',s]:h&&at>=h.at&&at-h.at<RTT_MAX_AGE_MS?['heartbeatMs',h]:null;
    if(selected){if(this.networkSource!==selected[0])this.rttPaintAt=-Infinity;this.networkSource=selected[0];this.rttAt=selected[1].at;this.rttValue=selected[1].ms;}
  }
  heartbeatWarning(at) { if(!this.offline&&Number.isFinite(at)){this.warningAt=at;this.rttText='连接波动';} }

  completedFrame(at) {
    if (this.frameStart === null) {
      this.frameStart = at;
      return;
    }
    this.frameCount++;
    const elapsed = at - this.frameStart;
    if (elapsed < FRAME_WINDOW_MS) return;
    this.fpsText = 'FPS ' + Math.round(this.frameCount * 1000 / elapsed);
    this.frameStart = at;
    this.frameCount = 0;
  }

  layout(viewport, geometry, avoidRects=[], display={}) {
    if(display.fps===false&&display.network===false)return null;
    const desiredWidth=display.fps===false?116:display.network===false?86:165;
    const width=viewport.width,height=viewport.fullHeight||viewport.height;
    if(!Number.isFinite(width)||width<135||!Number.isFinite(height))return null;
    const left=viewport.safeLeft||0,right=width-(viewport.safeRight||0),h=20;
    const menuEnd=geometry?.menu?geometry.menu.x+geometry.menu.w+4:left+8;
    const mapStart=geometry?.map?.x??right-8;
    const start=geometry?.land?Math.max(left+8,geometry.resource?.x||0):menuEnd;
    const limit=geometry?.land?Math.min(mapStart-4,geometry.demon?.x??right-8):mapStart-4;
    const room=limit-start;
    const underStatus=Number.isFinite(geometry?.bottom)&&room>=124;
    const w=underStatus?Math.min(room,desiredWidth):Math.min(right-left-16,desiredWidth);
    if(w<60)return null;
    const x=underStatus?start+(room-w)/2:left+(right-left-w)/2;
    const statusY=geometry?.land?Math.max(geometry.bottom+4,(geometry.menu?.y||0)+60):geometry?.bottom+2;
    let y=underStatus?statusY:Math.max(0,height-(viewport.safeBottom||0)-h-8);
    for(const rect of avoidRects){if(rect&&Number.isFinite(rect.x)&&Number.isFinite(rect.y)&&Number.isFinite(rect.w)&&Number.isFinite(rect.h)&&x<rect.x+rect.w&&x+w>rect.x&&y<rect.y+rect.h&&y+h>rect.y)y=rect.y+rect.h+4;}
    if(y+h>height-(viewport.safeBottom||0))return null;
    return {x,y,w,h};
  }

  draw(ctx, canvas, viewport, at, connected, geometry, nativeText=String, avoidRects=[], display={}) {
    const layout=this.layout(viewport,geometry,avoidRects,display);
    if(!ctx||!canvas||!layout)return;
    const {x,y,w,h}=layout,width=viewport.width,height=viewport.fullHeight||viewport.height;
    this.selectNetwork(at);
    if (!connected || this.warningAt === null && this.rttAt !== null && at - this.rttAt >= RTT_MAX_AGE_MS) this.clearNetwork();
    if (!this.offline && this.warningAt === null && this.rttAt !== null && at - this.rttPaintAt >= 500) {
      this.rttText = (this.networkSource==='socketRttMs'?'Socket ':'HTTP ') + Math.round(this.rttValue) + ' ms';
      this.rttPaintAt = at;
    }
    ctx.save();
    try {
      ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
      ctx.fillStyle = 'rgba(8,21,17,.90)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#f6f4de';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const split=Math.round(w*.43);
      if(display.fps!==false&&display.network!==false){
        ctx.fillText(nativeText(this.fpsText),x+7,y+h/2,split-10);
        ctx.fillText(nativeText(this.rttText),x+split,y+h/2,w-split-6);
      }else{ctx.textAlign='center';ctx.fillText(nativeText(display.fps===false?this.rttText:this.fpsText),x+w/2,y+h/2,w-14);}
    } finally { ctx.restore(); }
  }
}
module.exports = {LiveMatchHud};
