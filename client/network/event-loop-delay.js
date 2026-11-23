'use strict';
// Timer lateness measures event-loop availability including OS/native pauses.
// It is neither CPU utilization nor a decomposition of wire/SDK latency.
function createLoopDelay({clock,schedule=setTimeout,cancel=clearTimeout,intervalMs=50}={}){
 if(typeof clock!=='function'||!Number.isFinite(intervalMs)||intervalMs<10)throw Error('INVALID_LOOP_MONITOR');
 const bounds=[1,5,10,16.67,25,30,50,100,250,500,1000,3000,8000],bins=Array(bounds.length+1).fill(0);
 let active=false,timer=null,due=null,count=0,total=0,max=0,last=null;const slow=[];
 const arm=()=>{due=clock()+intervalMs;timer=schedule(()=>{timer=null;if(!active)return;const at=clock(),delay=Math.max(0,at-due);count++;total+=delay;max=Math.max(max,delay);last=delay;const i=bounds.findIndex(b=>delay<=b);bins[i<0?bounds.length:i]++;if(delay>=25){slow.push({atMs:at,delayMs:delay});if(slow.length>16)slow.shift();}arm();},intervalMs);timer?.unref?.();};
 const percentile=p=>{let n=0;for(let i=0;i<bins.length;i++){n+=bins[i];if(count&&n>=Math.ceil(count*p))return bounds[i]??null;}return null;};
 const summary=()=>({samples:count,lastDelayMs:last,maxDelayMs:count?max:null,meanDelayMs:count?total/count:null,p95UpperBoundMs:percentile(.95),p99UpperBoundMs:percentile(.99),over30Ms:bins.slice(bounds.indexOf(30)+1).reduce((a,b)=>a+b,0),pendingTimerOverdueMs:active&&due!==null?Math.max(0,clock()-due):null});
 return {start(){if(active)return;active=true;arm();},stop(){active=false;if(timer!==null)cancel(timer);timer=null;due=null;},summary,report(){return {...summary(),active,intervalMs,slow:slow.map(r=>({...r})),scope:'monotonic timer callback lateness; includes JS/native/OS scheduling; not pure CPU or network'};}};
}
module.exports={createLoopDelay};
