const {validateSnapshot} = require('./world-presentation');
const BATTLE_VERSION = '627-net14';
const SOURCE_627 = 'ee99ae6ae3940690703921e35eb2abbd824c0d1a35b819d7507eebf728bdbd8f';
class AuthoritativeClient {
  constructor(room, {enabled = false, clock = Date.now, schedule = setTimeout, cancel = clearTimeout, loadingTimeoutMs = 45000} = {}) {
    Object.assign(this, {room, enabled, clock, schedule, cancel, loadingTimeoutMs});
    this.state = this.previous = this.pending = this.epoch = this.timer = null;
    this.at = 0; this.busy = this.polling = this.active = this.fatal = this.hidden = false;
    this.status = '战斗服务未连接'; this.error = null; this.loading = null;
    this.lastHeartbeat = this.lastSnapshotAt = -Infinity; this.generation = 0; this.loadingSince = clock();
    this.listeners = new Set();
  }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify() { for (const listener of [...this.listeners]) { try { listener(this); } catch (_) {} } }
  path(suffix = '') { return '/api/rooms/' + encodeURIComponent(this.room.room.id) + '/battle' + suffix; }
  apply(s) {
    if (s?.status === 'failed') throw Object.assign(Error(s.error || 'WORLD_FAILED'), {worldFailed: true});
    if (s?.status === 'loading') {
      if (this.state) throw Error('BATTLE_SESSION_MISMATCH');
      if (Number.isSafeInteger(s.battleAttempt) && s.battleAttempt >= 1) this.battleAttempt = s.battleAttempt;
      const elapsedMs = Math.max(0, this.clock() - this.loadingSince);
      if (elapsedMs >= this.loadingTimeoutMs) throw Error('INITIALIZATION_TIMEOUT');
      const stageProgress = s.stageProgress && Number.isSafeInteger(s.stageProgress.done) && Number.isSafeInteger(s.stageProgress.total) && s.stageProgress.total > 0 && s.stageProgress.done >= 0 && s.stageProgress.done <= s.stageProgress.total ? {done: s.stageProgress.done, total: s.stageProgress.total} : null;
      this.loading = {stage: typeof s.stage === 'string' ? s.stage : 'world', elapsedMs, stageProgress};
      this.status = '权威世界正在初始化 · 已等待 ' + Math.floor(elapsedMs / 1000) + ' 秒';
      this.error = null; this.notify(); return false;
    }
    if (s?.protocol !== 1 || s.battleVersion !== BATTLE_VERSION || s.sourceHash !== SOURCE_627) throw Error('BATTLE_VERSION_MISMATCH');
    if (s.id !== this.room.room?.id || (this.epoch !== null && s.epoch !== this.epoch)) throw Error('BATTLE_SESSION_MISMATCH');
    validateSnapshot(s);
    if (!s.players.some(p => p.id === this.room.playerId)) throw Error('INVALID_SNAPSHOT');
    if (this.state && (s.mapChecksum !== this.state.mapChecksum || s.tick < this.state.tick && s.revision > this.state.revision || s.dragonAnimation.serial < this.state.dragonAnimation.serial && s.revision > this.state.revision)) throw Error('INVALID_SNAPSHOT');
    if (this.state && s.revision === this.state.revision && s.hash && this.state.hash && s.hash !== this.state.hash) throw Error('INVALID_SNAPSHOT');
    const wasConnected = this.room.connected;
    this.lastSnapshotAt = this.clock(); this.room.connected = true;
    if (this.state && s.revision <= this.state.revision) {
      if (this.error || !wasConnected || this.status === '正在重新连接权威世界…') { this.error = null; this.status = this.connectedStatus(); this.notify(); }
      return false;
    }
    this.epoch = s.epoch; this.previous = this.state; this.previousIndex = {};
    this.state = s; this.at = this.clock(); this.loading = null; this.error = null;
    this.status = this.connectedStatus(); this.notify(); return true;
  }
  connectedStatus() { return this.state?.outcome ? (this.state.outcome.winner === 'elves' ? '全队胜利' : '全队失败') : '已连接 · 权威战斗原型'; }
  fail(e,sourceStage=this.requestStage) {
    this.initializationFailed = !this.state && (e.worldFailed || /^(INITIALIZATION_TIMEOUT|WORLD_INITIALIZATION_FAILED|WORKER_)/.test(e.message));
    this.error = e.message; this.diagnostic = {stage: sourceStage || 'snapshot', code: /^[A-Z][A-Z0-9_]{0,63}$/.test(e.message) ? e.message : 'BATTLE_FAILED'}; this.status = this.diagnostic.code + ' · ' + this.diagnostic.stage; this.room.connected = false;
    if (/^(AUTH_REQUIRED|LOGIN_REQUIRED|ROOM_UNAVAILABLE|NOT_MEMBER)$/.test(e.message)) {
      this.fatal = true; this.pending = null;
      this.status = '会话或房间已失效，请重新登录；房间不存在时需要重新组队';
    } else if (e.worldFailed || /VERSION_MISMATCH|SESSION_MISMATCH|MAP_MISMATCH|INVALID_SNAPSHOT|WORLD_FAILED|WORLD_INITIALIZATION_FAILED|WORLD_CLOSED|SIMULATION_|INITIALIZATION_TIMEOUT|WORKER_/.test(e.message)) this.fatal = true;
    if (this.fatal) this.stopTimer();
    this.notify(); if (this.initializationFailed) this.plan();
  }
  bindPush(gen) {
    this.room.openBattle?.(s => {
      if (this.active && !this.hidden && !this.fatal && gen === this.generation) {
        try { this.apply(s); } catch (e) { this.fail(e,'push'); }
      }
    });
  }
  async start() {
    if (!this.enabled || !this.room.available() || !this.room.token || !this.room.room) throw Error('BATTLE_UNAVAILABLE');
    this.stopTimer(); this.active = true; this.hidden = this.fatal = false;
    this.polling = this.busy = this.retrying = false;
    this.state = this.previous = this.epoch = this.pending = null; this.previousIndex = {};
    this.initializationFailed = false; this.battleAttempt = this.room.room?.battleAttempt || 0;
    this.error = null; this.loadingSince = this.clock(); this.lastSnapshotAt = this.lastHeartbeat = -Infinity;
    this.loading = {stage: 'connection', elapsedMs: 0}; this.status = '正在连接权威世界…';
    const gen = ++this.generation; let sourceStage='heartbeat'; this.notify(); this.bindPush(gen);
    try {
      this.requestStage = 'heartbeat'; await this.room.refresh(); if (gen !== this.generation) return;
      const snapshotOnly=this.room.room?.host !== this.room.playerId || ['loading', 'development-slice', 'finished'].includes(this.room.room?.phase);
      sourceStage = snapshotOnly ? 'snapshot' : 'start'; this.requestStage = sourceStage;
      const s = snapshotOnly ? await this.room.request(this.path()) : await this.room.request(this.path('/start'), {...this.startOptions?.(),...(this.room.room?.battleStatus?.retryable?{retry:true}:{})});
      if (gen === this.generation) this.apply(s);
    } catch (e) { if (gen === this.generation) this.fail(e,sourceStage); throw e; }
    finally { if (gen === this.generation) this.plan(); }
  }
  async refresh() {
    if (!this.active || this.hidden || this.fatal || this.polling) return;
    this.polling = true; const gen = this.generation;
    try {
      if (!this.state && this.clock() - this.loadingSince >= this.loadingTimeoutMs) throw Error('INITIALIZATION_TIMEOUT');
      if (this.clock() - this.lastHeartbeat >= 3000 || !this.room.connected) { this.requestStage = 'heartbeat'; await this.room.refresh(); this.lastHeartbeat = this.clock(); }
      if (gen !== this.generation) return;
      if (!this.room.room) throw Error('BATTLE_SESSION_MISMATCH');
      // A socket can remain open without delivering pushes. Probe it periodically
      // rather than treating ready=true as proof that the world is advancing.
      const freshPush = this.room.socket?.ready && this.state && this.clock() - this.lastSnapshotAt < 2000;
      this.requestStage = 'snapshot';
      const s = freshPush ? null : await this.room.request(this.path());
      if (gen !== this.generation) return;
      if (s) this.apply(s);
      this.room.connected = true;
      if (this.pending) await this.sendPending();
    } catch (e) { if (gen === this.generation) this.fail(e); }
    finally { if (gen === this.generation) { this.polling = false; this.plan(); } }
  }
  async retry() {
    if (!this.active || this.hidden || this.polling || this.busy || this.retrying) return;
    const gen = this.generation; let sourceStage='heartbeat'; this.retrying = true;
    // An explicit retry can restart only an initialization that the server marked
    // retryable, while its host is still in the lobby. Live epochs are never reset.
    this.room.closeBattle?.(); this.fatal = false; this.error = null;
    this.loadingSince = this.clock(); this.lastSnapshotAt = this.lastHeartbeat = -Infinity;
    this.status = '正在重新连接权威世界…'; this.bindPush(this.generation); this.notify();
    try {
      await this.room.refresh(); if (gen !== this.generation || !this.active) return;
      if (!this.state && this.room.room?.phase === 'lobby' && this.room.room.host === this.room.playerId && this.room.room.battleStatus?.retryable) {
        sourceStage='start'; const s = await this.room.request(this.path('/start'), {...this.startOptions?.(),retry:true});
        if (gen === this.generation) { this.apply(s); this.plan(); }
      } else await this.refresh();
    } catch (e) { if (gen === this.generation) { this.fail(e,sourceStage); this.plan(); } }
    finally { if (gen === this.generation) this.retrying = false; }
  }
  async watchHostRetry() {
    if (!this.active || this.hidden || !this.fatal || !this.initializationFailed || this.state || this.polling) return;
    const gen = this.generation; this.polling = true;
    try {
      await this.room.refresh(); if (gen !== this.generation || !this.active) return;
      if (this.room.room?.battleAttempt > (this.battleAttempt || 0) && ['loading', 'development-slice', 'finished'].includes(this.room.room?.phase)) {
        this.battleAttempt = this.room.room.battleAttempt;
        this.fatal = false; this.error = null; this.loadingSince = this.clock(); this.lastSnapshotAt = -Infinity;
        this.status = '房主正在重新加载，正在同步…'; this.notify();
      }
    } catch (_) { /* Keep the specific initialization error visible. */ }
    finally { if (gen === this.generation) { this.polling = false; this.plan(); } }
  }
  async input(command) {
    if (!this.active || this.fatal || this.hidden || !this.room.connected || !this.state || this.state.outcome) throw Error('INPUT_UNAVAILABLE');
    if (this.pending) throw Error('INPUT_AWAITING_ACK');
    const me = this.state.players.find(p => p.id === this.room.playerId);
    if (me.dead || me.connected === false) throw Error('PLAYER_UNAVAILABLE');
    this.pending = {...command, epoch: this.epoch, seq: me.lastSeq + 1}; return this.sendPending();
  }
  async sendPending() {
    if (this.busy || !this.pending) return;
    this.busy = true; const command = this.pending, gen = this.generation;
    try {
      this.requestStage = 'input'; const r = await this.room.request(this.path('/input'), command);
      if (gen !== this.generation) return;
      if (r.receipt?.seq !== command.seq) throw Error('INVALID_SNAPSHOT');
      this.apply(r.snapshot); this.pending = null;
      this.status = r.receipt.accepted ? '指令已确认' : r.receipt.error; this.notify(); return r.receipt;
    } catch (e) { if (gen === this.generation) this.fail(e,'input'); throw e; }
    finally { if (gen === this.generation) this.busy = false; }
  }
  positions(key) {
    const list = this.state?.[key] || []; if (!this.previous || !this.room.connected) return list;
    const t = Math.min(1, Math.max(0, (this.clock() - this.at) / 150)); if (t >= 1) return list;
    const old = this.previousIndex[key] || (this.previousIndex[key] = new Map((this.previous[key] || []).map(p => [p.id, p])));
    return list.map(p => { const a = old.get(p.id); if (!a || a.dead !== p.dead || Math.hypot(a.x - p.x, a.y - p.y) > 256) return p; return {...p, x: a.x + (p.x - a.x) * t, y: a.y + (p.y - a.y) * t}; });
  }
  stopTimer() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  plan() {
    this.stopTimer(); if (!this.active || this.hidden) return;
    if (!this.fatal) this.timer = this.schedule(() => { this.timer = null; void this.refresh(); }, 500);
    else if (this.initializationFailed && !this.state && this.room.room?.host !== this.room.playerId) this.timer = this.schedule(() => { this.timer = null; void this.watchHostRetry(); }, 1500);
  }
  hide() { this.room.closeBattle?.(); this.hiddenAt = this.clock(); this.hidden = true; this.stopTimer(); }
  show() { if (this.hidden) this.loadingSince += Math.max(0, this.clock() - this.hiddenAt); this.hidden = false; this.room.connected = false; this.lastHeartbeat = this.lastSnapshotAt = -Infinity; this.notify(); void this.refresh(); }
  dispose() {
    this.room.closeBattle?.(); this.generation++; this.active = false;
    this.polling = this.busy = this.retrying = false;
    this.pending = this.state = this.previous = this.epoch = this.loading = null; this.previousIndex = {}; this.stopTimer();
  }
}
module.exports = {AuthoritativeClient, BATTLE_VERSION, SOURCE_627};
