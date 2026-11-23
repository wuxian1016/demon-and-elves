'use strict';
const unpackMask=require('./compact-cloth');
const legacyCloth=require('../network/prepared-cloth');
const lifecycle=require('../network/native-image-decode');

function readMetadataFile(wx) {
 return lifecycle.whenVisible(()=>new Promise((resolve,reject)=>{
  const start=lifecycle.foregroundNow();
  let done=false,timer=null;
  function finish(error,value){
   if(done)return;
   done=true;clearTimeout(timer);
   lifecycle.whenVisible(()=>{if(error)reject(error);else resolve(value);});
  }
  function checkTimeout(){
   if(done)return;
   const left=10000-(lifecycle.foregroundNow()-start);
   if(left<=0){finish(Error('画面元数据读取超时'));return;}
   timer=setTimeout(()=>lifecycle.whenVisible(checkTimeout),left);
  }
  checkTimeout();
  try{
   wx.getFileSystemManager().readFile({filePath:'art163/metadata-lines.deflate.bin',success:r=>finish(null,r.data),fail:e=>finish(Error('画面元数据读取失败：'+(e?.errMsg||e)))});
  }catch(error){finish(error);}
 }));
}

module.exports=async function(wx){
 const started=lifecycle.foregroundNow(),stats={maxPushMs:0,maxParseMs:0,maxTurnMs:0,turns:0,records:0};
 const checkDeadline=()=>{if(lifecycle.foregroundNow()-started>30000)throw Error('画面元数据准备超时');};
 const pause=()=>new Promise(resolve=>setTimeout(resolve,0)).then(()=>lifecycle.whenVisible(checkDeadline));
 const file=await readMetadataFile(wx);
 await pause();const pako=require('./pako-inflate'),packed=new Uint8Array(file),data={layout:{},dragon:{}};
 let pending='',chunks=[];const inflater=new pako.Inflate({raw:true,to:'string',chunkSize:16384});inflater.onData=s=>chunks.push(s);
 for(let i=0;i<packed.length;i+=2048){checkDeadline();let turn=Date.now(),t=turn;inflater.push(packed.subarray(i,i+2048),i+2048>=packed.length);stats.maxPushMs=Math.max(stats.maxPushMs,Date.now()-t);if(inflater.err)throw Error('画面元数据损坏：'+inflater.msg);pending+=chunks.join('');chunks=[];let n;
  while((n=pending.indexOf('\n'))>=0){const line=pending.slice(0,n);pending=pending.slice(n+1);t=Date.now();const [kind,key,index,value]=JSON.parse(line);if(!Object.hasOwn(data,kind)||key==='__proto__'||key==='constructor'||key==='prototype')throw Error('画面元数据字段错误');if(kind==='layout'&&key==='cloth'&&index!==null)value[1]=value[1].runs?legacyCloth.pack(value[1]):unpackMask(value[1],wx);if(index===null)data[kind][key]=value;else{if(!Number.isInteger(index)||index<0||index>10000)throw Error('画面元数据索引错误');(data[kind][key]||(data[kind][key]=[]))[index]=value;}stats.records++;stats.maxParseMs=Math.max(stats.maxParseMs,Date.now()-t);if(Date.now()-turn>=3){stats.maxTurnMs=Math.max(stats.maxTurnMs,Date.now()-turn);stats.turns++;await pause();turn=Date.now();}}
  stats.maxTurnMs=Math.max(stats.maxTurnMs,Date.now()-turn);stats.turns++;await pause();
 }
 if(pending||stats.records!==171||data.layout.revision!==163||data.layout.cloth?.length!==143||Object.keys(data.dragon).length!==6)throw Error('画面元数据不完整');stats.totalMs=lifecycle.foregroundNow()-started;data.stats=stats;return data;
};
