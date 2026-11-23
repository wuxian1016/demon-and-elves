'use strict';
const SOURCES=new Set(['unknown','cloud-init','route-check','sdk-call','sdk-fail','native-error','native-close','task-result','rpc-send','rpc-send-throw','task-state']);
const CLASSES=new Set(['ACCESS_DENIED','TIMEOUT','TLS_CERTIFICATE','TLS_PROTOCOL','DNS','CONNECTION_REFUSED','CONNECTION_RESET','NETWORK_UNREACHABLE','INVALID_TASK','API_UNAVAILABLE','UNKNOWN']);
function classify(error){
 let value='';try{value=typeof error?.errMsg==='string'?error.errMsg:typeof error?.message==='string'?error.message:'';}catch{return'UNKNOWN';}
 const text=value.slice(0,512);
 // Text hints only, never conclusions about the underlying root cause.
 if(/certificate|CERT_(?:AUTHORITY|DATE|COMMON_NAME|INVALID)|证书/i.test(text))return'TLS_CERTIFICATE';
 if(/\bTLS\b|\bSSL\b|SSL_|TLS_/i.test(text))return'TLS_PROTOCOL';
 if(/ENOTFOUND|EAI_AGAIN|NAME_NOT_RESOLVED|\bDNS\b|域名解析/i.test(text))return'DNS';
 if(/ECONNREFUSED|connection refused/i.test(text))return'CONNECTION_REFUSED';
 if(/ECONNRESET|connection reset|socket hang up/i.test(text))return'CONNECTION_RESET';
 if(/ENETUNREACH|EHOSTUNREACH|network.*unreachable|网络不可达/i.test(text))return'NETWORK_UNREACHABLE';
 if(/denied|forbidden|permission|unauthori[sz]ed|\b40[13]\b/i.test(text))return'ACCESS_DENIED';
 if(/timeout|timed out/i.test(text))return'TIMEOUT';
 if(text==='INVALID_CLOUD_SOCKET')return'INVALID_TASK';
 if(text==='CLOUD_SOCKET_UNAVAILABLE'||text==='CLOUD_API_UNAVAILABLE')return'API_UNAVAILABLE';
 return'UNKNOWN';
}
function socketFailureFields(value){const out={};if(SOURCES.has(value?.socketFailureSource))out.socketFailureSource=value.socketFailureSource;if(CLASSES.has(value?.socketFailureClass))out.socketFailureClass=value.socketFailureClass;return out;}
function observeSocketFailure(source,error){return{socketFailureSource:SOURCES.has(source)?source:'unknown',socketFailureClass:classify(error)};}
module.exports={socketFailureFields,observeSocketFailure};
