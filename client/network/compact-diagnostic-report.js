'use strict';
const {cleanText,utf8Bytes}=require('./diagnostic-file-export');
const LIMIT=4096,active=new WeakSet();
function showNotice(wx,options){try{wx.showModal?.(options);}catch(_){}}
const num=v=>typeof v==='number'&&Number.isFinite(v)?String(Math.round(v*100)/100):'?';
function short(value,max=100){if(typeof value!=='string')return '?';let s=value.slice(0,512).replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*/g,'[REDACTED PRIVATE KEY]');s=cleanText(s).replace(/[\r\n\t]+/g,' ');return Array.from(s).slice(0,max).join('');}
const code=v=>typeof v==='string'&&/^[A-Z][A-Z0-9_-]{0,95}$/.test(v)?v:'?';
const time=v=>Number.isSafeInteger(v)&&v>=0&&v<=8640000000000000?new Date(v).toISOString():'?';
function makeCompactReport(input,{wx=null,maxBytes=LIMIT,fullFile=null,now=Date.now}={}){
 if(!Number.isInteger(maxBytes)||maxBytes<1024||maxBytes>8192)throw Error('REPORT_BYTE_LIMIT');
 let data=input,parseState='object';if(typeof input==='string'){if(input.length>65536){data={};parseState='legacy-json-over-64KiB-not-parsed';}else try{data=JSON.parse(input);parseState='legacy-json';}catch(_){data={};parseState='invalid-json';}}if(!data||typeof data!=='object')data={};
 let info={};try{info=wx?.getDeviceInfo?.()||wx?.getSystemInfoSync?.()||{};}catch(_){}let app={};try{app=wx?.getAppBaseInfo?.()||{};}catch(_){}
 const c=data.connection||{},run=data.longRun||{},rt=run.runtime||{},ctx=data.summaryContext||{},routing=data.routing||{},frames=run.frames||{},metrics=run.metrics||{},summary=data.summary||{},missing=[],lines=[];
 const val=(v,label)=>{if(v==null||v==='?'){missing.push(label);return '?';}return typeof v==='number'?num(v):short(v);};
 const metric=(key,label)=>{const m=metrics[key],s=summary[key];if(m&&m.count>0)return label+' n='+num(m.count)+' P95上界='+num(m.p95UpperBoundMs)+' max='+num(m.maxMs)+'ms';if(s&&s.samples>0)return label+' 最近'+num(s.samples)+'/'+num(s.count)+'样本P95='+num(s.p95)+'ms（非累计上界）';missing.push(label);return label+' 未采到';};
 lines.push('【恶魔与精灵·精简诊断摘要】非完整日志');
 lines.push('客户端 '+val(data.diagnosticBuild,'客户端版本')+'；角色 '+short(data.role,12));
 const http=(routing.httpProcesses||[]).slice(-3).map(p=>short(p.release,80)),socket=short(routing.socketRelease,80);if(socket==='?'&&!http.some(s=>s!=='?'))missing.push('后端版本');
 lines.push('后端 Socket='+socket+'；HTTP='+[...new Set(http)].join(',')+(http.length?'':'?')+'（按实际观测，未知不推断）');
 lines.push('设备 '+val(ctx.deviceModel||info.model,'设备')+'；系统 '+short(ctx.system||info.system,48)+'；微信 '+short(rt.wechatVersion||app.version||info.version,24)+'；库 '+short(rt.baseLibraryVersion||app.SDKVersion||info.SDKVersion,24));
 lines.push('范围 人数='+val(ctx.playerCount,'人数')+' 真人='+num(ctx.humanCount)+' 电脑='+num(ctx.aiCount)+' 难度='+short(ctx.difficulty,12)+'；诊断累计='+val(run.elapsedMs!=null?run.elapsedMs/1000:ctx.elapsedSeconds,'时长')+'s 狩猎游戏时钟='+num(ctx.huntSeconds)+'s');
 lines.push('采样起始UTC='+time(run.startedAtMs)+'；导出UTC='+time(c.diagnosticExportedAtMs??run.exportedAtMs??now()));
 lines.push('状态 ready='+String(c.socketReady??'?')+' bound='+String(c.socketBound??'?')+' game='+String(c.gameReady??'?')+' resync='+String(c.resyncing??'?')+' fatal='+String(c.fatal??'?'));
 lines.push('最近错误 '+code(c.failureCode||c.errorCode)+' 分类='+code(c.socketFailureClass)+' 阶段='+short(c.failureStage||c.loadFailureStage,16)+' close='+num(c.closeCode??run.connection?.lastObservedCloseCode)+' SDK='+num(c.sdkCode));
 lines.push('错误本机UTC='+time(c.failureRecordedAtMs||c.socketFailureObservedAtMs)+'；Socket建立→失败='+num(Number.isFinite(c.socketFailureObservedAtMs)&&Number.isFinite(c.socketAttemptStartedAtMs)?Math.max(0,c.socketFailureObservedAtMs-c.socketAttemptStartedAtMs):null)+'ms（本机墙钟）');
 lines.push('已完成对局输入 Socket='+num(run.transportCounts?.socket??data.transport?.socket)+' HTTP='+num(run.transportCounts?.http??data.transport?.http)+'；接受='+num(run.inputs?.accepted)+' 拒绝='+num(run.inputs?.rejected)+' 失败='+num(run.inputs?.failed));
 lines.push(metric('socketRttMs','应用Socket匹配pong RTT'));
 lines.push(metric('heartbeatMs','房间心跳响应（可能Socket或HTTP）'));
 lines.push(metric('acceptedCommandAckMs','入队→业务接受ACK'));
 lines.push(metric('inputToConfirmedViewDrawMs','输入→权威状态完成绘制'));
 const sale=data.saleUiTimeline?.summary;if(sale)lines.push('出售 请求='+num(sale.requests)+' 关闭卡片='+num(sale.uiReleased)+' ACK='+num(sale.acked)+' 拒绝='+num(sale.rejected)+' 权威应用='+num(sale.applied)+' 超时未确认='+num(sale.timeouts)+' 恢复后摇杆输入='+num(sale.inputSampled)+' 待定='+num(sale.pending)+' 末阶段='+short(sale.lastStage,32)+'（非退款证明）');
 lines.push('JS完成绘制节奏='+num(frames.completedDrawCadenceFps)+'FPS；计入='+num(frames.completedEligible)+' 排除='+num(frames.excluded)+'；帧间隔P95上界='+num(frames.gaps?.p95UpperBoundMs)+' max='+num(frames.gaps?.maxMs)+'ms');if(!Number.isFinite(frames.completedDrawCadenceFps))missing.push('绘制节奏');
 lines.push(metric('drawJsMs','JS绘制工作'));
 lines.push(metric('snapshotAgeMs','快照年龄'));
 lines.push(metric('snapshotGapMs','快照接收间隔'));
 lines.push(metric('inputServerWorkerQueueMs','服务端工作队列'));
 lines.push(metric('inputServerWorkerWorkMs','服务端工作计算'));
 const events=Array.isArray(run.events)?run.events:[];for(const e of events.slice(-2))lines.push('最近事件 '+short(e.kind,32)+' @诊断+'+num(e.elapsedMs)+'ms close='+num(e.closeCode)+' state='+short(e.state,20));
 const failures=Array.isArray(data.authFailures)?data.authFailures:[];for(const e of failures.slice(-2))lines.push('鉴权 '+code(e.code)+' '+short(e.source,12)+' HTTP='+num(e.status)+' UTC='+time(e.atMs));
 lines.push('文件接口是否暴露='+String(data.nativeFileShare?.functionPresent??'?')+'；未以游戏沙盒写入当作系统文件或好友取件成功。');
 lines.push('窗口：最近事件'+Math.min(events.length,32)+'/32，绘制窗口'+Math.min(data.windows?.draw?.length||0,4)+'/4，队列窗口'+Math.min(data.windows?.ui?.length||0,4)+'/4，最近分钟'+Math.min(run.recentMinutes?.length||0,60)+'/60；累计直方图与最近120样本P95分开；P95上界?表示缺失或溢出。');
 lines.push('口径：毫秒≠秒；入队ACK≠权威画面；本地反馈≠服务器确认；JS绘制节奏≠屏幕/GPU帧率。散热/真实屏幕帧率未测；1006不代表已定位根因。');
 if(parseState!=='object')lines.push('输入格式 '+parseState+'；旧格式过长或无效时未展开原文。');
 const fileState=fullFile?.status==='verified-local'?'完整文件：游戏内已逐段校对 '+num(fullFile.verifiedBytes)+' 字节，尚未确认取出/送达。':fullFile?'完整文件状态：'+short(fullFile.status,30)+'；未确认完整文件取出。':'完整日志另走“导出完整诊断文件”，此摘要不代替完整日志；尚未确认取出。';
 const missingText='缺失字段：'+[...new Set(missing)].slice(0,12).join('、')+(!missing.length?'无上述缺项':'（?表示未知，不补造数值）');
 const footerReserve=Math.min(820,Math.floor(maxBytes*.45)),bodyBudget=maxBytes-footerReserve-1;let text='',omitted=0;
 for(const line of lines){const next=text+(text?'\n':'')+line;if(utf8Bytes(next)<=bodyBudget)text=next;else omitted++;}
 const footerLines=['摘要省略行数='+omitted+'；UTF8上限='+maxBytes+'字节；未附原始采样。',fileState,'缺失字段数='+new Set(missing).size+'：'+[...new Set(missing)].slice(0,5).join('、')+(new Set(missing).size>5?'等；?为未知':'')];
 let footerText='';for(const line of footerLines){const next=footerText+(footerText?'\n':'')+line;if(utf8Bytes(next)<=footerReserve)footerText=next;else{const available=footerReserve-utf8Bytes(footerText)-4;let prefix='';for(const ch of line){if(utf8Bytes(prefix+ch)>available)break;prefix+=ch;}if(prefix)footerText+='\n'+prefix+'…';}}
 text+=(text?'\n':'')+footerText;if(utf8Bytes(text)>maxBytes)throw Error('REPORT_INTERNAL_BYTE_OVERFLOW');return {text,bytes:utf8Bytes(text),maxBytes,omittedLines:omitted,missing:[...new Set(missing)],scope:'summary-not-complete-log',parseState};
}
async function copyCompactReport(wx,data,{build='unknown',now=Date.now,clipboardTimeoutMs=15000}={}){
 if(active.has(wx))return {status:'busy'};active.add(wx);let fullFile=null,report;
 try{
  fullFile=await require('./diagnostic-file-export').exportDiagnosticFile(wx,data,{build,now,present:false});report=makeCompactReport(data,{wx,fullFile,now});
  if(typeof wx.setClipboardData!=='function')throw Error('当前微信未提供剪贴板写入能力');
  await new Promise((resolve,reject)=>{let done=false;const finish=(ok,v)=>{if(done)return;done=true;clearTimeout(timer);(ok?resolve:reject)(v);};const timer=setTimeout(()=>finish(false,Error('剪贴板未返回结果，请重试')),clipboardTimeoutMs);try{wx.setClipboardData({data:report.text,success:()=>finish(true),fail:()=>finish(false,Error('精简报告未复制，请重试'))});}catch(e){finish(false,e);}});
  showNotice(wx,{title:'精简报告已写入剪贴板',content:report.bytes+' 字节（UTF8上限 '+report.maxBytes+'）。这是摘要，请一次粘贴给诊断人员；没有自动发送，也未验证粘贴或送达。完整文件'+(fullFile?.status==='verified-local'?'已在游戏内核对，尚未取出。':'未确认保存，请用完整文件导出重试。'),showCancel:false});return {status:'sdk-success',report,fullFile,pasteVerified:false,deliveryVerified:false};
 }catch(e){showNotice(wx,{title:'精简报告未复制',content:short(e.message||String(e),160)+'。没有确认复制成功；完整文件与摘要的状态分开记录。',showCancel:false});return {status:'failed',report,fullFile,pasteVerified:false,deliveryVerified:false};}
 finally{active.delete(wx);}
}
module.exports={makeCompactReport,copyCompactReport,MAX_REPORT_BYTES:LIMIT};
