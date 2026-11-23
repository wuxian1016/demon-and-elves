'use strict';
const {cleanText,jsonParts,exportDiagnosticFile}=require('./diagnostic-file-export');
const {animationSummaryPages}=require('./animation-content-summary');
// Display the same immutable, already-sanitized diagnostic snapshot copied out.
// Native modal pages work without clipboard reads or cross-app navigation.
function diagnosticPages(data){
 let parsed;try{parsed=typeof data==='string'?JSON.parse(data):data;}catch(_){return ['诊断数据无法解析。完整原文仍可复制或保存。'];}
 // Do not pretty-print/wrap every trace sample on the UI thread. Raw bytes
 // remain in the export payload, independently of the bounded summary view.
 const summary=[...animationSummaryPages(parsed),...longRunSummaryPages(parsed)];
 return summary.length?summary.slice(0,32):['已取得诊断快照。完整记录请使用复制或保存功能。'];
}
function longRunSummaryPages(data){
 const carrier=Array.isArray(data?.socketCarrier)&&data.socketCarrier.length?data.socketCarrier[data.socketCarrier.length-1]:null;
 const inputTail=data?.inputTimeline?.samples?.find(s=>s.outcome==='accepted'&&Number.isFinite(s.ackObservedMs));
 const heartbeatTail=data?.heartbeatTimeline?.samples?.[0];
 const r=data?.longRun;if(r?.schema!==1||r.kind!=='fullgame-long-run-observations')return [];
 const n=v=>Number.isFinite(v)?String(Math.round(v*100)/100):'未知/超界',m=k=>r.metrics?.[k]||{},runtime=r.runtime||{},frames=r.frames||{},inputs=r.inputs||{},connection=r.connection||{};
 const mode=key=>runtime.modeObservation==='official-GameGlobal-flags'&&typeof runtime[key]==='boolean'?(runtime[key]?'开启':'关闭'):'未知';
 return [
  ['完整游戏累计诊断','累计 '+n(r.elapsedMs/1000)+' 秒','微信 '+(runtime.wechatVersion||'未知'),'基础库 '+(runtime.baseLibraryVersion||'未知'),'运行时观测 HP：'+mode('actualHighPerformance')+' / HP+：'+mode('actualHighPerformancePlus')],
  ['有效绘制节奏 '+n(frames.completedDrawCadenceFps)+' FPS','已完成绘制 '+n(frames.completedEligible),'间隔P95上界 '+n(frames.gaps?.p95UpperBoundMs)+'ms','最长间隔 '+n(frames.gaps?.maxMs)+'ms','JS绘制节奏，非屏幕/GPU帧率'],
  ['已接受业务确认 '+n(inputs.accepted)+'次','确认样本 '+n(m('acceptedCommandAckMs').count),'确认P95上界 '+n(m('acceptedCommandAckMs').p95UpperBoundMs)+'ms','确认最长 '+n(m('acceptedCommandAckMs').maxMs)+'ms','拒绝 '+n(inputs.rejected)+' 失败 '+n(inputs.failed)],
  ['Socket输入 '+n(r.transportCounts?.socket)+' / HTTP输入 '+n(r.transportCounts?.http),'首次绑定 '+n(connection.initialBindings),'采样解绑/未就绪 '+n(connection.observedLosses),'解绑后重绑定 '+n(connection.observedRecoveries),'最后关闭码 '+n(connection.lastObservedCloseCode)],
  ['心跳P95上界 '+n(m('heartbeatMs').p95UpperBoundMs)+'ms','快照间隔P95上界 '+n(m('snapshotGapMs').p95UpperBoundMs)+'ms','快照年龄P95上界 '+n(m('snapshotAgeMs').p95UpperBoundMs)+'ms','本地反馈P95上界 '+n(m('localFeedbackMs').p95UpperBoundMs)+'ms','本地反馈不代表服务器确认'],
  ['输入等待分段（累计上界）','队列P95 '+n(m('inputQueueMs').p95UpperBoundMs)+'ms','请求回执P95 '+n(m('inputRequestMs').p95UpperBoundMs)+'ms','回执提交JS P95 '+n(m('inputCommitJsMs').p95UpperBoundMs)+'ms','确认视图绘制P95 '+n(m('inputToConfirmedViewDrawMs').p95UpperBoundMs)+'ms'],
  ['仅当前席位累计观测','隐藏次数 '+n(r.lifecycle?.hidden),'前后台时间分开记录','温度、GPU帧率：未测','后续页面为完整脱敏记录']
 ].concat(inputTail?[[
  '最长确认样本：本机分段 '+n(inputTail.ackObservedMs)+'ms',
  '本地排队 '+n(inputTail.queueMs)+' / 重试等待 '+n(inputTail.retryAndWaitMs)+'ms',
  '请求等待 '+n(inputTail.lastRequestWaitMs)+'ms（含SDK/服务）',
  '提交与通知 '+n(inputTail.commitAndNotifyMs)+' / 回调等待 '+n(inputTail.postCommitReceiptMs)+'ms',
  '权威JS画面 '+n(inputTail.confirmedJsDrawMs)+'ms；非真实屏幕延迟'
 ]]:[]).concat(heartbeatTail?[[
  '最慢心跳：HTTP分段（非纯RTT）',
  '到交付 '+n(heartbeatTail.totalMs)+' / 到await '+n(heartbeatTail.totalThroughAwaitMs)+'ms',
  '初始化/派发 '+n(heartbeatTail.initAndDispatchMs)+' / SDK等待 '+n(heartbeatTail.sdkAwaitMs)+'ms',
  '解析交付 '+n(heartbeatTail.parseAndDeliveryMs)+' / await等待 '+n(heartbeatTail.awaitResumeMs)+'ms',
  '循环漂移最大 '+n(heartbeatTail.maxEventLoopDelayMs)+'ms；服务端耗时未知'
 ],[
  '最慢心跳：本机采样细节',
  'JSON解析 '+n(heartbeatTail.jsonParseMs)+'ms',
  '已执行探针漂移 '+n(heartbeatTail.maxEventLoopDelayMs)+'ms',
  '待执行探针逾期 '+n(heartbeatTail.pendingProbeDelayMs)+'ms',
  '两项漂移不能扣除后当成网络耗时'
 ]]:[]).concat(data.loadingState?[[
  '最近请求 '+data.loadingState.lastRequestStage,
  '本机步骤 '+n(data.loadingState.localLoadStep)+'/5',
  '缓存屏障已开始 '+(data.loadingState.barrierCacheStarted===true?'是':data.loadingState.barrierCacheStarted===false?'否':'未知'),
  '屏障缓存年龄 '+n(data.loadingState.barrierCacheAgeMs)+'ms',
  '加载状态请求 '+(data.loadingState.barrierRequestPending?'进行中':data.loadingState.barrierRequestFailed?'失败':'无进行中请求')
 ]]:[]).concat(data.lobbyEntry||data.cloudPreconnect?[[
  '首次建立连接（非稳态延迟）',
  '启动会话 '+(data.cloudPreconnect?.state||'未记录'),
  '启动建立耗时 '+n(data.cloudPreconnect?.elapsedMs)+'ms',
  '入房耗时 '+n(data.lobbyEntry?.elapsedMs)+'ms / '+n(data.lobbyEntry?.attempts)+'次',
  '成员已确认 '+(data.lobbyEntry?.membershipConfirmed===true?'是':'否/未记录')
 ]]:[]).concat(data.presentationQueue?[[
  '客户端视图准备队列',
  '待处理 '+n(data.presentationQueue.pending)+' / 峰值 '+n(data.presentationQueue.peakPending),
  '入队 '+n(data.presentationQueue.enqueued)+' / 已提交 '+n(data.presentationQueue.committed),
  '安全合并 '+n(data.presentationQueue.replaced),
  '队列错误 '+n(data.presentationQueue.errors)+' / 暂停 '+(data.presentationQueue.paused?'是':'否')
 ]]:[]).concat(data.presentationQueue?.replacementBlocks?[[
  '视图合并阻断（本局）',
  '事件未保留 '+n(data.presentationQueue.replacementBlocks['feedback-not-retained']),
  '警报边界 '+n(data.presentationQueue.replacementBlocks['warning-boundary']),
  '状态/救援/镜头 '+n((data.presentationQueue.replacementBlocks.state||0)+(data.presentationQueue.replacementBlocks.rescue||0)+(data.presentationQueue.replacementBlocks.focus||0)),
  '通知/仪式/无效事件 '+n((data.presentationQueue.replacementBlocks.toast||0)+(data.presentationQueue.replacementBlocks.ceremony||0)+(data.presentationQueue.replacementBlocks['events-invalid']||0))
 ]]:[]).concat(carrier?[[
  '原生连接观察（非业务绑定）',
  '尝试 '+n(carrier.attempt)+' / 任务已取得 '+(carrier.taskBound?'是':'否'),
  '回调 '+n(carrier.callbacks)+' / Promise '+n(carrier.promiseCompletions),
  '异包装 '+n(carrier.differentTaskWrappers)+' / 纯状态 '+n(carrier.statusOnlyCompletions),
  '原生打开 '+(carrier.opened?'是':'否')+' / 关闭码 '+n(carrier.closeCode)
 ]]:[]).concat(data.recoveryState?[[
  '业务同步恢复预算',
  '持续失败 '+n(data.recoveryState.elapsedMs/1000)+'秒',
  '新请求预算 '+n(data.recoveryState.budgetMs/1000)+'秒',
  '自动恢复暂停 '+(data.recoveryState.paused?'是':'否'),
  data.recoveryState.paused?'请点重试，重新确认原会话':'就绪标志不能代替业务数据'
 ]]:[]).map(lines=>lines.join('\n'));
}
function copyAndViewDiagnostics(wx,data,{relay=null}={}){
 const state={clipboard:'not-attempted',file:'not-attempted'};
 const notice=(title,content)=>{try{wx?.showModal?.({title,content,showCancel:false});}catch(_){}};
 const build=()=>{if(data&&typeof data==='object')return data.diagnosticBuild||'unknown';if(typeof data==='string'&&data.length<=65536)try{return JSON.parse(data).diagnosticBuild||'unknown';}catch(_){}return 'unknown';};
 const copy=()=>{state.clipboard='preparing';void require('./compact-diagnostic-report').copyCompactReport(wx,data,{build:build()}).then(result=>{state.clipboard=result.status;state.file=result.fullFile?.status||'not-attempted';state.report=result;});};
 const save=()=>{state.file='writing';void exportDiagnosticFile(wx,data,{build:build(),summary:diagnosticPages(data),relay}).then(result=>{state.file=result.status;state.fileResult=result;});};
 const summary=()=>{const pages=diagnosticPages(data);const page=i=>{try{wx.showModal?.({title:'诊断摘要 '+(i+1)+'/'+pages.length,content:pages[i],showCancel:true,cancelText:'关闭',confirmText:i+1<pages.length?'下一页':'完成',success:r=>{if(r.confirm&&i+1<pages.length)page(i+1);}});}catch(_){}};page(0);};
 try{if(typeof wx?.showActionSheet==='function')wx.showActionSheet({itemList:['一键复制精简报告（不超过4KB）','导出完整诊断文件','查看诊断摘要'],success:r=>[copy,save,summary][r.tapIndex]?.()});else copy();}catch(_){notice('无法打开诊断','请稍后重试，未确认复制或完整文件取出成功。');}
 return state;
}
module.exports={diagnosticPages,copyAndViewDiagnostics,longRunSummaryPages};
