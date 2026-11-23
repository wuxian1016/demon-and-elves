const {safeRows}=require('./cloud-response-diagnostics');
'use strict';
const {socketFailureFields}=require('./socket-failure-fields');
const {safeRequestFailures}=require('./request-failures');
const {safeCode}=require('./qa-connection');

// Only numeric observations and fixed labels enter the export. These bounded
// samples stay in memory until the player copies them from the settings menu.
const MAX_SAMPLES = 120;
const METRICS = ['inputQueueMs', 'inputCommitJsMs', 'commandAckMs', 'inputRequestMs','inputServerElapsedMs', 'inputFailureMs', 'heartbeatMs','socketRttMs','socketProbeServerWorkMs', 'snapshotGapMs', 'snapshotRequestMs', 'snapshotPollStartGapMs', 'snapshotTicks', 'logicJsMs', 'localFeedbackMs', 'stickIntentToDrawMs', 'heartbeatWarning'];

class MatchDiagnostics {
  constructor() { this.reset(); }
  reset() {
    this.samples = Object.fromEntries(METRICS.map(key => [key, {values: [], count: 0}]));
    this.windows = {draw: [], ui: []};
    this.overload = 0;
    this.transport = {socket: 0, http: 0};
  }
  record(key, value) {
    const sample = this.samples[key];
    if (!sample || !Number.isFinite(value) || value < 0) return;
    sample.values[sample.count++ % MAX_SAMPLES] = value;
  }
  window(kind, report) {
    const list = this.windows[kind];
    if (!list) return;
    const fields = kind === 'draw'
      ? ['elapsedMs', 'frames', 'renderFps', 'frameP95Ms', 'maxFrameGapMs', 'drawJsMs', 'packetJsMs', 'maxPacketJsMs', 'applyJsMs', 'snapshotAgeMs', 'maxInputAckMs', 'inputs', 'receipts', 'rejected']
      : ['elapsedMs', 'tasks', 'cpuMs', 'maxTaskMs', 'commits', 'latencyMs', 'maxQueue', 'superseded'];
    const entry=Object.fromEntries(fields.filter(k => Number.isFinite(report[k])).map(k => [k, report[k]]));
    if(kind==='draw'){
      for(const k of ['menu','intro','gameReady','hidden','resyncing'])if(typeof report[k]==='boolean')entry[k]=report[k];
      if(['start','prep','hunt','win','lose'].includes(report.phase))entry.phase=report.phase;
      entry.contextAtFlush=true;
    }
    list.push(entry);
    if (list.length > 4) list.shift();
  }
  export(role, connection = null) {
    const summary = {};
    for (const [key, {values, count}] of Object.entries(this.samples)) {
      if (!values.length) continue;
      const sorted = values.slice().sort((a,b) => a-b);
      const p95 = sorted[Math.ceil(sorted.length * .95) - 1];
      summary[key] = {samples: sorted.length, count, p95: Math.round(p95 * 10) / 10};
    }
    const safeConnection={cloudResponseFailures:safeRows(connection?.cloudResponseFailures),requestFailures:safeRequestFailures(connection?.requestFailures)};for(const key of ['transportKind','httpTransportKind','socketTransportKind','failureTransportKind'])if(['cloud','native'].includes(connection?.[key]))safeConnection[key]=connection[key];
    if(connection&&typeof connection==='object'){
      Object.assign(safeConnection,socketFailureFields(connection));
      for(const key of ['socketReady','socketBound','gameReady','menuOpen','clientHidden','resyncing','fatal'])if(typeof connection[key]==='boolean')safeConnection[key]=connection[key];
      for(const key of ['fallbackRemainingMs','snapshotAgeMs'])if(Number.isFinite(connection[key]))safeConnection[key]=Math.max(0,Math.min(key==='fallbackRemainingMs'?30000:180000,Math.round(connection[key])));
      // Local wall-clock observations, not network timings or server clock proof.
      for(const key of ['lastHeartbeatFailureAtMs','failureRecordedAtMs','diagnosticExportedAtMs','socketAttemptStartedAtMs','socketConnectCalledAtMs','socketFailureObservedAtMs'])if(Number.isSafeInteger(connection[key])&&connection[key]>=0&&connection[key]<=8640000000000000)safeConnection[key]=connection[key];
      if(['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT'].includes(connection.lastHeartbeatFailureCode))safeConnection.lastHeartbeatFailureCode=connection.lastHeartbeatFailureCode;
      if(['connect','auth','rpc'].includes(connection.failureStage))safeConnection.failureStage=connection.failureStage;
      if(Number.isSafeInteger(connection.sdkCode))safeConnection.sdkCode=connection.sdkCode;
      if(Number.isSafeInteger(connection.closeCode)&&connection.closeCode>=0&&connection.closeCode<=65535)safeConnection.closeCode=connection.closeCode;
      if(['AUTH_TIMEOUT','SESSION_ENDED','INVALID_SESSION_OR_MESSAGE','REPLACED','SLOW_CLIENT','CLIENT_CLOSED','ACCESS_DENIED','TIMEOUT','OTHER','EMPTY'].includes(connection.closeReasonClass))safeConnection.closeReasonClass=connection.closeReasonClass;
      if(Number.isInteger(connection.loadStep)&&connection.loadStep>=0&&connection.loadStep<=5)safeConnection.loadStep=connection.loadStep;
      if(typeof connection.errorCode==='string'&&connection.errorCode)safeConnection.errorCode=safeCode(connection.errorCode);
      if(['server','map','scene','render','ui','frame'].includes(connection.loadFailureStage))safeConnection.loadFailureStage=connection.loadFailureStage;
      const allowed=/^(?:NETWORK_FAILED|SOCKET_(?:TIMEOUT|UNAVAILABLE|CONNECT_FAILED|TRANSPORT_FAILED|CLOSED|AUTH_SEND_FAILED|SEND_DENIED|REJECTED)|(?:CLOUD|NATIVE)_SOCKET_(?:FAILED|TIMEOUT|DENIED|UNAVAILABLE))$/;
      if(typeof connection.failureCode==='string'&&allowed.test(connection.failureCode))safeConnection.failureCode=connection.failureCode;
    }
    return JSON.stringify({schema: 1, hudNetworkSource:'heartbeatMs', diagnosticBuild:'qa162bn4-lock-camera-wall-hot-render-20261118-1', role: role === 'host' ? 'host' : 'guest', connection:safeConnection, transport: this.transport,
      summary, overload: this.overload, windows: this.windows});
  }
}
module.exports = {MatchDiagnostics};
