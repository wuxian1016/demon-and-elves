// Build a profiling copy of the project's own QA wx host (read from argv[2]), write to argv[3].
const fs=require('fs');
let s=fs.readFileSync(process.argv[2],'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw Error('patch anchor missing: '+a.slice(0,60)); s=s.replace(a,b); };
// configurable pixel ratio + counters
rep("graphics=null,clockStart=null}={}) {", "graphics=null,clockStart=null,pixelRatio=1,counters=null}={}) {\n  const C=counters||{storageWrites:0,storageBytes:0,timers:0,timerOrigins:new Map(),canvases:0,fileWrites:0};");
rep("pixelRatio:1,safeArea", "pixelRatio,safeArea");
rep("const put = (key, data) => {\n    report('key:write', key);", "const put = (key, data) => {\n    report('key:write', key);\n    C.storageWrites++; try{C.storageBytes+=JSON.stringify(data).length;}catch(_){}");
rep("    writeFile(options) {\n      let target;", "    writeFile(options) {\n      C.fileWrites++;\n      let target;");
rep("    setTimeout(fn, ms) {\n      const handle", "    setTimeout(fn, ms) {\n      C.timers++; if(C.traceTimers){const st=(new Error().stack.split('\\n')[2]||'').replace(/^.*\\/client\\//,'').replace(/\\)$/,'');C.timerOrigins.set(st,(C.timerOrigins.get(st)||0)+1);}\n      const handle");
rep("    if (graphics) return graphics.canvas(width, height);", "    C.canvases++;\n    if (graphics) return graphics.canvas(width, height);");
rep("  return {\n    access, notices,", "  return {\n    counters:C, box,\n    access, notices,");
fs.writeFileSync(process.argv[3],s);
console.log('patched ok');
