"use strict";
const {safeCode}=require('./qa-connection');
const STAGES=new Set(['health','heartbeat','snapshot','start','input','push','server','map','scene','render','ui','frame']);
const TRANSIENT=new Set(['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT']);
function safeRequestFailures(rows){
 if(!Array.isArray(rows))return [];
 return rows.slice(-8).filter(r=>Number.isSafeInteger(r?.firstAtMs)&&r.firstAtMs>=0&&Number.isSafeInteger(r?.lastAtMs)&&r.lastAtMs>=r.firstAtMs&&Number.isSafeInteger(r?.count)&&r.count>0).map(r=>({stage:STAGES.has(r.stage)?r.stage:'unknown',code:safeCode(r.code),firstAtMs:r.firstAtMs,lastAtMs:r.lastAtMs,count:Math.min(r.count,1000000),stateAvailable:r.stateAvailable===true}));
}
function recordRequestFailure(client,error,stage){
 const at=client.clock(),rows=safeRequestFailures(client.requestFailures),row={stage:STAGES.has(stage)?stage:'unknown',code:safeCode(error?.message),firstAtMs:at,lastAtMs:at,count:1,stateAvailable:!!client.state},last=rows[rows.length-1];
 if(last&&last.stage===row.stage&&last.code===row.code&&last.stateAvailable===row.stateAvailable&&at>=last.lastAtMs){last.lastAtMs=at;last.count=Math.min(1000000,last.count+1);}else rows.push(row);
 client.requestFailures=safeRequestFailures(rows);
}
module.exports={safeRequestFailures,recordRequestFailure,isTransientRequestError:e=>TRANSIENT.has(e?.message)};
