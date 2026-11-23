'use strict';

const {utf8Bytes} = require('./diagnostic-file-export');
const key = 'forest-qa-freeze-journal-v1';
const intervalMs = 10000;
const maxBytes = 4096;

function readJournal(wx) {
  try {
    const text = wx.getStorageSync?.(key);
    if (typeof text !== 'string' || utf8Bytes(text) > maxBytes) return null;
    const data = JSON.parse(text);
    return data?.schema === 1 && typeof data.current?.boot === 'number' ? data : null;
  } catch (_) {
    return null;
  }
}

function createFreezeJournal(wx, {build, started}) {
  const earlier = readJournal(wx), before = earlier?.current ?? null;
  const previousIncident=before?.kind==='fault'||before?.kind==='gap'?before:
    earlier?.previous?.kind==='fault'||earlier?.previous?.kind==='gap'?earlier.previous:null;
  const priorRecord=previousIncident||before;
  let current = null;
  let committed = before;
  let nextCheckpoint = intervalMs;
  let running = false;
  let pending = null;
  let retry = null;
  let firstIncident = false;
  let writes = 0;
  let failures = 0;

  function send() {
    if (running || !pending || typeof wx.setStorage !== 'function') return;
    const item = pending;
    pending = null;
    const data = {schema: 1, current: item, previous: priorRecord};
    let text = JSON.stringify(data);
    if (utf8Bytes(text) > maxBytes) {
      data.previous = priorRecord && {...priorRecord, trail: []};
      text = JSON.stringify(data);
    }
    if (utf8Bytes(text) > maxBytes) {
      data.current = {...item, trail: []};
      text = JSON.stringify(data);
    }
    if (utf8Bytes(text) > maxBytes) return;

    running = true;
    writes++;
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      running = false;
      if (ok) committed = item;
      else {
        failures++;
        if (item.kind !== 'health' && item === current) retry = item;
      }
      send();
    };
    try {
      wx.setStorage({key, data: text, success: () => finish(true),
        fail: () => finish(false), complete: () => finish(false)});
    } catch (_) {
      finish(false);
    }
  }

  function queue(kind, detail, sample) {
    current = {boot: started, build, kind, ...sample, detail};
    pending = current;
    send();
  }

  function checkpoint(at, sample) {
    if (at < nextCheckpoint) return;
    nextCheckpoint = at + intervalMs;
    if (retry) {
      if(retry===current)pending = retry;
      retry = null;
      send();
    } else if (!firstIncident && sample) queue('health', null, sample());
  }

  function incident(kind, detail, sample) {
    if (firstIncident && kind !== 'fault') return;
    retry = null;
    firstIncident = true;
    queue(kind, detail, sample);
  }

  return {
    checkpoint, incident,
    read: () => ({previous: before, previousIncident, current, committed, writes, failures})
  };
}

module.exports = {createFreezeJournal, key};
