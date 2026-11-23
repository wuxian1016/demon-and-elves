'use strict';
// Only omitted clocks use this factory. Explicitly injected clocks stay untouched.
function createDefaultClock(){
 const native=typeof performance!=='undefined'&&performance&&typeof performance.now==='function'?performance:null;
 if(native)return native.now.bind(native);
 const origin=Date.now();let elapsed=0;
 return ()=>elapsed=Math.max(elapsed,Date.now()-origin);
}
module.exports={createDefaultClock};
