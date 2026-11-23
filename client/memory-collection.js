'use strict';
// A request is not evidence that the platform actually freed memory.
function createMemoryCollector(wx, {clock = Date.now, schedule = setTimeout,
  canCollect = () => true, onResult = () => {}} = {}) {
  let timer = null, pending = null, lastAt = -Infinity;
  function request(reason, {urgent = false} = {}) {
    if (typeof wx?.triggerGC !== 'function') return false;
    if (timer !== null) {
      if (urgent) { pending.urgent = true; pending.reason = reason; }
      return false;
    }
    if (clock() - lastAt < (urgent ? 500 : 10000)) return false;
    if (!urgent && !canCollect()) return false;
    pending = {reason, urgent};
    timer = schedule(() => {
      const job = pending;
      timer = pending = null;
      if (!job.urgent && !canCollect()) return;
      lastAt = clock();
      try { wx.triggerGC(); onResult('requested', String(job.reason)); }
      catch (error) { onResult('unavailable', String(error?.message || error)); }
    }, 0);
    return true;
  }
  return {request};
}
module.exports = {createMemoryCollector};
