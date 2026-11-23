'use strict';
const {fileShareObservation,requestNativeFileShare}=require('./native-file-share');
const CHUNK=8192,MAX_DEPTH=80;
let pending=false;
const credential=/^(?:token|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?(?:key|token)|authorization|cookie|open[_-]?id|union[_-]?id|secret|app[_-]?secret|client[_-]?secret|api[_-]?key|private[_-]?key|password)$/i;
// Error strings can contain quoted/escaped JSON, cookies or URL parameters.
// Redact the credential-bearing remainder of a line rather than leaking a
// quoted value or a second cookie; other fields and diagnostic rows stay intact.
const cleanText=value=>String(value).replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g,'[REDACTED PRIVATE KEY]').replace(/((?:access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?(?:key|token)|authorization|cookie|open[_-]?id|union[_-]?id|app[_-]?secret|client[_-]?secret|api[_-]?key|private[_-]?key|password|token|secret)\s*(?:\\?["'])?\s*[:=])[^\r\n]*/ig,'$1[REDACTED]').replace(/\bBearer\s+[^\r\n]*/g,'Bearer [REDACTED]');

function* jsonParts(value,seen=new Set(),depth=0){
 if(depth>MAX_DEPTH)throw Error('诊断层级过深，未导出不完整文件');
 if(value===null){yield 'null';return;}
 if(typeof value==='string'){const text=cleanText(value);yield '"';for(let at=0;at<text.length;){let end=Math.min(text.length,at+1024);if(end<text.length&&text.charCodeAt(end-1)>=0xd800&&text.charCodeAt(end-1)<=0xdbff)end--;yield JSON.stringify(text.slice(at,end)).slice(1,-1);at=end;}yield '"';return;}
 if(typeof value==='number'){yield Number.isFinite(value)?String(value):'null';return;}
 if(typeof value==='boolean'){yield String(value);return;}
 if(typeof value!=='object')throw Error('诊断包含无法导出的数据');
 if(seen.has(value))throw Error('诊断包含循环引用，未导出不完整文件');
 seen.add(value);
 if(Array.isArray(value)){
  yield '[';for(let i=0;i<value.length;i++){if(i)yield ',';const v=value[i];if(v===undefined||typeof v==='function'||typeof v==='symbol')yield 'null';else yield*jsonParts(v,seen,depth+1);}yield ']';
 }else{
  yield '{';let first=true;
  for(const key of Object.keys(value)){const v=value[key];if(v===undefined||typeof v==='function'||typeof v==='symbol')continue;if(!first)yield ',';first=false;yield JSON.stringify(key)+':';if(credential.test(key))yield '"[REDACTED]"';else yield*jsonParts(v,seen,depth+1);}yield '}';
 }
 seen.delete(value);
}
function* boundedChunks(parts){let buffer='';for(const part of parts){let at=0;while(at<part.length){let end=Math.min(part.length,at+CHUNK-buffer.length);if(end<part.length&&end>at&&part.charCodeAt(end-1)>=0xd800&&part.charCodeAt(end-1)<=0xdbff)end--;if(end===at){if(buffer){yield buffer;buffer='';continue;}end=Math.min(part.length,at+2);}buffer+=part.slice(at,end);at=end;if(buffer.length>=CHUNK-1){yield buffer;buffer='';}}}if(buffer)yield buffer;}
function utf8Bytes(s){let n=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<s.length&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;}
function capabilities(wx){let platform='';try{platform=(wx.getDeviceInfo?.()||wx.getSystemInfoSync?.()||{}).platform||'';}catch(_){}
 const offered=name=>{try{return typeof wx[name]==='function'&&(typeof wx.canIUse!=='function'||wx.canIUse(name)===true);}catch(_){return false;}};
 return{platform,disk:['windows','mac'].includes(platform)&&offered('saveFileToDisk'),share:offered('shareFileMessage')};
}
function sdkCall(target,name,args,timeoutMs=15000){return new Promise((resolve,reject)=>{let settled=false,timer=null;const finish=(ok,value)=>{if(settled)return;settled=true;if(timer!==null)clearTimeout(timer);(ok?resolve:reject)(value);};if(timeoutMs>0)timer=setTimeout(()=>finish(false,Error('文件操作超时，请重试')),timeoutMs);try{target[name]({...args,success:r=>finish(true,r),fail:e=>finish(false,e)});}catch(e){finish(false,e);}});}
function notice(wx,title,content){try{wx.showModal?.({title,content,showCancel:false});}catch(_){} }
async function exportDiagnosticFile(wx,data,{summary=[],build='unknown',now=Date.now,yieldTask=()=>new Promise(r=>setTimeout(r,0)),relay=null,present=true}={}){
 if(pending){notice(wx,'正在导出','请等待当前文件完成，再重试。');return{status:'busy'};}
 pending=true;try{wx.showLoading?.({title:'正在导出诊断',mask:true});}catch(_){}let fs,path;const state={status:'writing',verifiedBytes:0,maxChunkChars:0};
 try{
  fs=wx.getFileSystemManager?.();if(!wx.env?.USER_DATA_PATH||!fs||!['writeFile','appendFile','readFile'].every(k=>typeof fs[k]==='function'))throw Error('当前环境未提供完整文件读写能力');
  const at=now(),name='demon-elves-diagnostics-'+String(build).replace(/[^a-z0-9_-]/ig,'').slice(0,50)+'-'+at+'.txt';path=wx.env.USER_DATA_PATH+'/'+name;
  const header='恶魔与精灵 · 诊断文件\n版本：'+build+'\n导出时间：'+new Date(at).toISOString()+'\n凭据字段已脱敏；采样数据未省略。\n\n'+summary.slice(0,32).map(cleanText).join('\n\n')+'\n\n=== RAW JSON ===\n';
  // A string input is already a serialized legacy snapshot. Parse once to sanitize
  // credentials; new callers pass the captured object and avoid a giant stringify.
  const snapshot=typeof data==='string'?JSON.parse(data):data;
  function* parts(){yield header;yield*jsonParts(snapshot);yield '\n';}
  let first=true,offset=0;
  for(const chunk of boundedChunks(parts())){
   state.maxChunkChars=Math.max(state.maxChunkChars,chunk.length);
   await sdkCall(fs,first?'writeFile':'appendFile',{filePath:path,data:chunk,encoding:'utf8'});first=false;
   const bytes=utf8Bytes(chunk);if(offset+bytes>16*1024*1024)throw Error('诊断文件超过16MiB，未导出不完整文件');const read=await sdkCall(fs,'readFile',{filePath:path,encoding:'utf8',position:offset,length:bytes});
   if(read.data!==chunk)throw Error('文件核对失败，不能确认完整性');offset+=bytes;state.verifiedBytes=offset;await yieldTask();
  }
  Object.assign(state,{status:'verified-local',path,fileName:name});
  if(typeof fs.readdir==='function'&&typeof fs.unlink==='function')try{const list=await sdkCall(fs,'readdir',{dirPath:wx.env.USER_DATA_PATH});const owned=(list.files||[]).filter(n=>/^demon-elves-diagnostics-[a-z0-9_-]+-\d+\.txt$/i.test(n)).sort((a,b)=>Number(b.match(/-(\d+)\.txt$/)[1])-Number(a.match(/-(\d+)\.txt$/)[1]));for(const old of owned.slice(3))if(old!==name)await sdkCall(fs,'unlink',{filePath:wx.env.USER_DATA_PATH+'/'+old});}catch(_){}
  try{wx.hideLoading?.();}catch(_){}if(!present)return state;const caps=capabilities(wx),choices=[];
  if(caps.disk)choices.push({text:'选择磁盘保存位置',api:'saveFileToDisk'});
  const nativePresent=typeof wx.shareFileMessage==='function';
  if(relay?.enabled===true)choices.push({text:'生成短期文件下载链接',api:'relay'});
  if(nativePresent)choices.push({text:caps.share?'选择微信好友发送文件':'验证手机好友文件分享',api:'native-share',probe:!caps.share});
  state.nativeFileShare=fileShareObservation(wx);
  const explain='文件已写入并逐段核对，仅保存在游戏内。'+(caps.disk?'可选择磁盘保存位置。':caps.share?'可尝试打开微信文件分享，再按微信提供的功能保存；不能任意选系统目录。':'当前手机小游戏尚未确认可用的文件分享或系统目录选择接口，尚未保存到系统“文件”。')+'\n'+name;
  if(!choices.length||typeof wx.showActionSheet!=='function'){notice(wx,'未取得可外发的诊断文件',explain+'\n微信 '+(state.nativeFileShare.wechatVersion||'未知')+' / 基础库 '+(state.nativeFileShare.SDKVersion||'未知')+'；文件分享接口'+(state.nativeFileShare.functionPresent?'存在但尚未验证':'未暴露')+'。');return state;}
  let chosen=false;wx.showActionSheet({itemList:choices.map(x=>x.text).concat('关闭（仅保留游戏内文件）'),success:choice=>{
   if(chosen)return;chosen=true;const action=choices[choice.tapIndex];if(!action)return;
   // Only this explicit user selection can open a native disk/share sheet.
   if(action.api==='relay'){wx.showModal({title:'上传诊断文件以下载',content:'将把这份完整脱敏诊断上传到已配置的下载服务，生成五分钟有效的文件链接。不会自动发送给好友。是否继续？',confirmText:'继续',cancelText:'取消',success:r=>{if(!r.confirm)return;void require('./diagnostic-relay-upload').uploadDiagnosticFile(wx,{path,fileName:name,bytes:state.verifiedBytes,relay}).then(result=>{state.relay=result;notice(wx,'下载链接已生成','链接尚未经过真机下载验证。请打开链接取得完整文件，再用系统分享选择微信和好友。');wx.showModal({title:'复制短期下载链接',content:'仅复制一条短链接，不复制诊断内容。请自行粘贴到浏览器打开；链接仅对应当前文件。',confirmText:'复制链接',cancelText:'关闭',success:r=>{if(r.confirm)try{if(typeof wx.setClipboardData!=='function')throw Error();wx.setClipboardData({data:result.url,fail:()=>notice(wx,'复制未完成','本地文件仍保留，请重试。')});}catch(_){notice(wx,'复制未完成','当前环境不能复制短链接，本地文件仍保留。');}}});},error=>notice(wx,'文件下载方式未完成',cleanText(error.message).slice(0,180)));}});return;}
   if(action.api==='native-share'){const send=()=>{void requestNativeFileShare(wx,path,name).then(result=>{state.nativeFileShare=result.observation;state.status=result.status==='sdk-success'?'sdk-share-success':result.status==='sdk-failed'?'external-cancelled-or-failed':result.status;notice(wx,result.status==='sdk-success'?'微信报告文件分享成功':'尚未确认文件发送',result.status==='sdk-success'?'已由微信按你选择的会话处理；没有自动选择好友，也未独立确认送达。':result.codeClass==='unsupported'?'当前手机小游戏拒绝文件分享接口。文件仍在游戏内；下载替代方式尚未开通。':result.codeClass==='cancel'?'你已取消文件分享，未确认发送。可重新导出后选择好友。':'未取得可确认的发送结果。请保留当前版本及错误反馈；不会自动重试。');});};if(action.probe)wx.showModal({title:'验证好友文件分享',content:'当前微信没有声明支持此接口。是否尝试打开一次原生文件分享？你可直接取消，不必发送给任何人；这不会自动选好友。',confirmText:'验证',cancelText:'取消',success:r=>{if(r.confirm)send();}});else send();return;}
   void sdkCall(wx,action.api,{filePath:path,...(action.api==='shareFileMessage'?{fileName:name}:{})},0).then(()=>{state.status=action.api==='saveFileToDisk'?'sdk-disk-success':'sdk-share-success';notice(wx,action.api==='saveFileToDisk'?'微信报告保存成功':'微信报告文件分享成功',action.api==='saveFileToDisk'?'保存位置由微信原生窗口选择。':'已按你选择的会话执行；不能据此确认系统文件保存位置。');},()=>{state.status='external-cancelled-or-failed';notice(wx,'未完成外部保存或分享','游戏内已核对的文件仍保留，请重新打开导出重试。');});
  },fail:()=>notice(wx,'尚未选择导出位置',explain)});
  return state;
 }catch(error){state.status='failed';try{if(path)fs?.unlink?.({filePath:path,fail(){}});}catch(_){}if(present)notice(wx,'诊断文件导出失败',cleanText(error?.message||error).slice(0,180)+'。请重试；没有确认外部保存或发送成功。');return state;}
 finally{pending=false;try{wx.hideLoading?.();}catch(_){}}
}
module.exports={exportDiagnosticFile,capabilities,jsonParts,boundedChunks,utf8Bytes,cleanText};
