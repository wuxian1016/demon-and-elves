'use strict';
// Not configured in shipped builds. An owner-approved relay origin and the
// existing authenticated HTTP requester are required; never discovers a host.
async function uploadDiagnosticFile(wx,{path,fileName,bytes,relay,onProgress=()=>{},clock=Date.now,paceMs=125}){
 if(!relay||typeof relay.request!=='function'||!/^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[1-9][0-9]{0,4})?$/i.test(relay.approvedOrigin||''))throw Error('下载服务尚未开通，本地文件仍保留');
 if(!Number.isSafeInteger(bytes)||bytes<1||bytes>16*1024*1024)throw Error('诊断文件大小超出限制');
 const started=clock(),request=async(route,body)=>{if(clock()-started>120000)throw Error('上传超时，请重试');return relay.request(route,body);};
 let exportId=null;try{
 const capability=await request('/api/diagnostic-file/capability');if(capability?.enabled!==true||capability.downloadReady!==true||capability.chunkBytes!==4096)throw Error('下载服务尚未开通，本地文件仍保留');
 const begin=await request('/api/diagnostic-file/begin',{name:fileName,bytes});if(!/^[a-f0-9]{32}$/.test(begin?.id||''))throw Error('下载服务返回无效结果');
 exportId=begin.id;const fs=wx.getFileSystemManager();let position=0;
 while(position<bytes){const length=Math.min(4096,bytes-position),data=await new Promise((resolve,reject)=>{let done=false;const finish=(ok,v)=>{if(done)return;done=true;clearTimeout(timer);(ok?resolve:reject)(v);};const timer=setTimeout(()=>finish(false,Error('文件读取超时')),15000);try{fs.readFile({filePath:path,position,length,encoding:'base64',success:r=>finish(true,r.data),fail:()=>finish(false,Error('诊断文件读取失败'))});}catch(e){finish(false,e);}});
  if(typeof data!=='string'||data.length!==Math.ceil(length/3)*4)throw Error('诊断文件读取不完整');
  const result=await request('/api/diagnostic-file/chunk',{id:begin.id,offset:position,data});if(result?.received!==position+length)throw Error('服务端文件核对失败');position+=length;onProgress(position,bytes);await new Promise(r=>setTimeout(r,paceMs));
 }
 const result=await request('/api/diagnostic-file/finish',{id:begin.id}),prefix=relay.approvedOrigin+'/diagnostic-file/#';
 if(typeof result?.downloadUrl!=='string'||!result.downloadUrl.startsWith(prefix)||!new RegExp('^[a-f0-9]{32}\\.[A-Za-z0-9_-]{43}$').test(result.downloadUrl.slice(prefix.length))||result.bytes!==bytes||!/^[a-f0-9]{64}$/.test(result.sha256||''))throw Error('下载地址不符合已批准的范围');
 return{url:result.downloadUrl,bytes:result.bytes,sha256:result.sha256,expiresAt:result.expiresAt,downloadVerified:false};
 }catch(error){if(exportId)try{await relay.request('/api/diagnostic-file/cancel',{id:exportId});}catch(_){}throw error;}
}
module.exports={uploadDiagnosticFile};
