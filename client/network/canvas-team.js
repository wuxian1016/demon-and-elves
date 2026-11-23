const {safeCode}=require('./qa-connection');
const {seatColor}=require('./seat-colors');
const {MAX_PLAYERS,roomSeatCount,legacyRoom}=require('./room-capacity');
const {requiresHostHandoffUpdate} = require('./wechat-client');
const cloudErrorText = code => ({
  CAPACITY_BACKEND_UPDATE_REQUIRED:'请先更新6人房间后端，再连接联机', LEGACY_ROOM_RECREATE_REQUIRED:'旧9席房间请结束后重建6人房，当前对局不变',
  CLOUD_HEALTH_INVALID: '云服务返回异常，请核对服务配置', CLOUD_API_UNAVAILABLE: '微信云接口不可用，请更新微信后重试',
  CLOUD_REQUEST_FAILED: '云通道请求失败，请检查云权限或网络', LOCAL_HOST_ONLY: '云网关Host不匹配，需服务端适配',
  ORIGIN_DENIED: '云网关Origin被拒，需核对安全配置', IDENTITY_VERIFICATION_FAILED: '微信身份验证失败，请核对服务端配置',
  LOGIN_FAILED: '微信登录失败，请重试', TIMEOUT: '连接超时，请检查网络后重试', NETWORK_FAILED: '连接失败，请重试并记录错误',
  HOST_LEAVE_HANDOFF_REQUIRED: '服务端尚未支持房主移交，已保留当前队伍，请更新联机服务后重试',
  HOST_ONLY: '只有房主可以更改难度或开始游戏', INVALID_DIFFICULTY: '难度选项无效，请刷新房间', DIFFICULTY_LOCKED: '已经开局，不能更改难度', NOT_READY: '受邀玩家在线并准备后，房主才能开始', BACKEND_UPDATE_REQUIRED: '请先更新 0.28 后端，再开始游戏', STALE_REVISION: '队伍已变化，请稍后重试',
  BATTLE_UNAVAILABLE: '战斗暂不可用，请连接服务后重试', PROTOTYPE_DISABLED: '此服务尚未开启联机战斗',
  ROOM_MEMBERSHIP_UNCONFIRMED:'云会话已响应，但房间席位未确认，请重试连接',
  ROOM_EXIT_UNCONFIRMED: '还未确认退出原对局，点重试查询状态', INVITE_CHOICE_UNAVAILABLE: '没能打开对局选择，请重试',
  ROOM_UNAVAILABLE: '邀请房间已关闭或不存在，请让房主重新邀请', ROOM_FULL: '房间已满，请房主移除电脑或空出席位后重试',
  HUMAN_LIMIT: '最多6人，含房主；最多邀请5位好友', BATTLE_ROSTER_LOCKED: '该房间已经开局，请等待下一局邀请',
  ALREADY_IN_ROOM: '你已在其他房间，请先退出原房间再接受邀请', INVITE_REQUIRED: '请从好友分享的邀请进入',
  ROOM_CREATION_UNCONFIRMED: '建房结果待确认，请稍后重试', QA_SESSION_UNCONFIRMED: '测试会话结果待确认，请稍后重试',
  INVITE_INVALID: '邀请信息不完整，请让房主重新分享', LOGIN_REQUIRED: '请先连接服务', AUTH_REQUIRED: '登录已失效，请重新连接'
}[code] || code);
const hit = (b, p) => b && p && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
const difficultyOptions = [{id: 'easy', label: '简单'}, {id: 'medium', label: '中等'}, {id: 'crazy', label: '疯狂'}, {id: 'super', label: '超级挑战'}];
const CLIENT_MARK = '入口恢复 QA078';
const ENTRY_TRANSIENT=new Set(['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT','SERVICE_FAILED','SERVICE_OVERLOADED','SERVER_CLOSING']);
const COLD_HEALTH_TRANSIENT = new Set(['TIMEOUT','NETWORK_FAILED','CLOUD_REQUEST_TIMEOUT','CLOUD_REQUEST_FAILED','SERVICE_FAILED','SERVICE_OVERLOADED','SERVER_CLOSING']);
const battlePhase = room => ['loading', 'development-slice', 'finished'].includes(room?.phase);

class CanvasTeam {
  constructor({game, runtime, wx, client, gate, schedule = setTimeout, cancel = clearTimeout}) {
    gate.controller?.dispose();
    Object.assign(this, {game, runtime, wx, client, gate, schedule, cancel});
    Object.assign(this, {open: false, seatChoice: null, busy: false, hidden: false, dead: false, down: null, timer: null, polling: false,
      refreshPromise: null, pendingAction: null, error: '', errorCode: null, pollError: '', lastEnteredRoom: null, lastEnteredAttemptKey: null, battleEnabled: false});
    this.controlMotionBN = require('./native-control-motion')();
    this.original = game.draw;
    const self = this;
    this.wrapper = function(...args) { const result = self.original.apply(this, args); self.draw(); require('./qa-badge').drawQaBadge(self.runtime); return result; };
    game.draw = this.wrapper;
    gate.controller = this;
    // Subscribe before attach: cold-launch invitations may arrive synchronously.
    this.unsubscribe = client.subscribe?.(event => {
      if (this.dead || this.exitRequested) return;
      if(event.type==='cold-connection'){
        if(this.open)this.wake();
        return;
      }
      if(event.type!=='invitation')return;
      this.open = true;
      if(event.invitation?.status==='rejoined')this.lastEnteredAttemptKey=null;
      this.down = null;
      this.wake();
      this.planPoll(0);
    });
    client.attach();
    this.hide = () => { this.controlMotionBN.cancel(); this.hidden = true; this.down = null; this.seatChoice = null; this.stopPoll(); };
    this.reconnectColdHealth = () => {
      const c=this.client, error=c.connectionDiagnostic;
      if(!this.open||this.hidden||this.dead||this.busy||this.exitRequested||c.token||c.pendingSessionOp||
        error?.stage!=='health'||error.status!=='failed'||!COLD_HEALTH_TRANSIENT.has(error.code))return false;
      void this.enterLobby({automatic:true});
      return true;
    };
    this.show = () => {
      this.hidden=false;this.down=null;this.wake();
      if(!this.reconnectColdHealth())this.planPoll(0);
    };
    this.networkChange = event => {if(event?.isConnected===true)this.reconnectColdHealth();};
    wx.onHide?.(this.hide);
    wx.onShow?.(this.show);
    wx.onNetworkStatusChange?.(this.networkChange);
  }
  home() { return !this.networkBattleActive && this.game.state === 'start' && !this.game.sessionMenuOpen && !this.game.saveSlotsPanel && !this.game.roundStarting; }
  battleEntryKey(room = this.client.room, starting = false) {
    if (!room) return null;
    const attempt = Number.isSafeInteger(room.battleAttempt) ? room.battleAttempt : 0;
    return room.id + ':' + (attempt + (starting ? 1 : 0));
  }
  me() { return this.client.room?.slots?.find(s => s.kind === 'human' && s.id === this.client.playerId); }
  inviting() { return ['pending', 'connecting', 'authenticating', 'joining', 'recovering', 'choosing', 'leaving', 'creating'].includes(this.client.invitationState?.status); }
  allReady() {
    const room = this.client.room, humans = room?.slots?.filter(s => s.kind === 'human') || [];
    return humans.length > 0 && room.allReady !== false && humans.every(s => s.connection === 'connected' && (s.id === room.host || s.ready));
  }
  layout() {
    const v = this.runtime.viewport(), width = v.width, height = v.fullHeight || v.height;
    const sl = v.safeLeft || 0, sr = v.safeRight || 0, st = Math.max(v.safeTop || 0, v.capsule?.bottom || 0), sb = v.safeBottom || 0;
    const x = sl + 8, y = st + 8, w = width - sl - sr - 16, h = height - y - sb - 8;
    const panel = {x, y, w, h}, entry = {id: 'open', x: x + w - 136, y, w: 136, h: 42};
    const close = {id: 'close', x: x + w - 126, y: y + 8, w: 118, h: 40};
    const gap = 6, inRoom = !!this.client.room, cardColumns = inRoom && w >= 500 && roomSeatCount(this.client.room)>MAX_PLAYERS ? 5 : 3;
    const seatCount=roomSeatCount(this.client.room), cardRows = Math.ceil(seatCount / cardColumns), cardW = (w - 24 - gap * (cardColumns - 1)) / cardColumns, top = y + (inRoom ? 128 : 86);
    const difficulty = inRoom ? difficultyOptions.map((option, i) => ({id: 'difficulty', value: option.id, text: option.label,
      x: x + 12 + i * (w - 18) / 4, y: y + 87, w: (w - 42) / 4, h: 36})) : [];
    // In-room controls use one action row; landscape seats use two rows.
    // Reconnect replaces ready while offline, keeping all controls in bounds.
    const names = inRoom ? [...(!this.client.connected || this.client.pendingRoomCreation || this.client.invitationState?.status==='error' ? [['retryLobby', '重试']] : this.client.room.host !== this.client.playerId ? [['ready', '准备']] : [])] : !this.busy ? [['retryLobby', '连接房间']] : [];
    if (inRoom && this.client.room.fogPolicy!=='multiplayer-off-v1' && typeof this.client.room.fogEnabled === 'boolean') {
      const enabled = this.client.room.fogEnabled;
      names.unshift(['fog', enabled ? '迷雾：开启' : '迷雾：关闭', !enabled]);
    }
    const columns = Math.max(1, names.length), actionRows = 1;
    const actionW = (w - 24 - gap * (columns - 1)) / columns, footer = y + h - (actionRows * 40 + 80);
    const cardH = (footer - top - gap * (cardRows - 1)) / cardRows;
    const cards = Array.from({length: seatCount}, (_, i) => ({id: 'seat', slot: i, x: x + 12 + i % cardColumns * (cardW + gap),
      y: top + Math.floor(i / cardColumns) * (cardH + gap), w: cardW, h: cardH}));
    const actions = names.map(([id, text, value], i) => ({id, text, value, x: x + 12 + i % columns * (actionW + gap),
      y: footer + 4 + Math.floor(i / columns) * 40, w: actionW, h: 36}));
    if (inRoom) actions.push({id: 'start', text: this.startLabel(), x: x + 12, y: footer + actionRows * 40 + 4, w: w - 24, h: 40});
    const help = {x: x + 12, y: footer + actionRows * 40 + 46, w: w - 24, h: 32};
    const choicePanel = {x: x + Math.max(8, (w - 310) / 2), y: y + (h - 212) / 2, w: Math.min(310, w - 16), h: 212};
    const choices = this.seatChoice ? [['seatInvite', '邀请好友'], ['seatAI', '电脑队友'], ['seatCancel', '取消']].map(([id, text], i) =>
      ({id, text, x: choicePanel.x + 12, y: choicePanel.y + 64 + i * 46, w: choicePanel.w - 24, h: 40})) : [];
    return {width, height, panel, entry, close, cards, actions, difficulty, help, choices, choicePanel, key: [width, height, sl, sr, st, sb, inRoom, this.client.room?.id, this.client.room?.phase, this.client.room?.fogEnabled, this.client.connected, this.seatChoice?.slot, this.seatChoice?.revision].join(':')};
  }
  choiceValid() {
    const r = this.client.room, choice = this.seatChoice;
    return !!choice && r?.id === choice.roomId && r.revision === choice.revision &&
      r.phase === 'lobby' && !!this.client.capacityPolicy && !legacyRoom(r) && r.host === this.client.playerId && r.slots[choice.slot]?.kind === 'empty' && this.client.connected;
  }
  allowed(id, slot) {
    const c = this.client, r = c.room, me = this.me();
    if (id === 'open') return !this.exitRequested;
    // Entry cancellation is safe; other writes must settle before leaving.
    if (id === 'close') return !this.exitRequested && !this.exitConfirming && (!this.busy || !!this.entryOperation);
    if (id === 'seatCancel') return !!this.seatChoice;
    if (id === 'seatInvite' || id === 'seatAI') return this.choiceValid() && (id !== 'seatInvite' || c.view().canInvite);
    if (this.seatChoice) return false;
    if (this.inviting()) return false;
    if (id === 'retryLobby') return c.available() && (!r || !c.connected || c.pendingRoomCreation || c.invitationState?.status==='error');
    if (id === 'login') return c.available() && (!c.token || !c.connected);
    // A failed invitation can be retried even if its login failed.
    if (id === 'join') return !!c.pendingInvite && !r && c.available();
    if (!c.connected || c.pendingRoomCreation) return false;
    if (id === 'create') return !!c.token && !r;
    if (id === 'invite') return false;
    if (id === 'fog') return !!me && r.phase === 'lobby' && r.host === c.playerId && typeof r.fogEnabled === 'boolean';
    if (id === 'difficulty') return !!me && r.phase === 'lobby' && r.host === c.playerId && r.difficultyRules === 'host-lobby-difficulty-v1';
    if (id === 'ready') return !!me && r.host !== c.playerId && me.connection === 'connected' && r.phase === 'lobby';
    if (id === 'leave') return !!r && ['lobby', 'finished'].includes(r.phase);
    if (id === 'seat') return !!r && r.phase === 'lobby' && (r.slots[slot]?.kind==='ai'||!!c.capacityPolicy&&!legacyRoom(r)) && r.host === c.playerId && Number.isInteger(slot) && slot >= 0 && !!r.slots[slot] && r.slots[slot].kind !== 'human';
    if (id === 'start') return this.battleEnabled && typeof this.startBattle === 'function' && !!me && !!c.token &&
      ((r.phase==='finished'?!legacyRoom(r)&&r.host===c.playerId:battlePhase(r)) || r.phase === 'lobby' && !!c.capacityPolicy && !legacyRoom(r) && r.host === c.playerId && c.lobbyRules === 'host-exempt-ready-v1' && this.allReady());
    return false;
  }
  enabled(id, slot) {
    // Background heartbeat is not a user operation and must not flash/disable buttons.
    return !this.dead && (id === 'open' || id === 'close' || !this.busy) && this.allowed(id, slot);
  }
  wake() { if (!this.dead) { this.game.wxUiDirty = true; this.runtime.wake?.(); } }
  stopPoll() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  entryNow(){return this.entryClock?.()??Date.now();}
  entryReport(){return this.entryObservation?{...this.entryObservation}:null;}
  planPoll(ms = 1000) {
    this.stopPoll();
    if (this.dead || this.hidden || this.networkBattleActive || this.busy || this.inviting() || (!this.open && !this.client.room)||this.entryRetryBlocked&&!this.client.confirmedLobbyRoom?.()) return;
    this.timer = this.schedule(() => { this.timer = null; void this.refresh(); }, Math.max(ms,(this.entryRetryAt||0)-this.entryNow()));
  }
  displayKey() { return JSON.stringify([this.client.connected, this.client.view(), this.client.room?.host, this.client.room?.phase, this.client.room?.difficulty, this.client.room?.difficultyRules, this.client.room?.fogEnabled, this.error, this.pollError]); }
  async refresh() {
    if (this.polling) return this.refreshPromise;
    if (this.dead || this.hidden || this.networkBattleActive || this.busy || this.inviting()) { this.planPoll(); return; }
    if(this.open&&(!this.client.token||!this.client.room||!this.me())){
      if(!this.entryRetryBlocked&&this.entryNow()>=(this.entryRetryAt||0))await this.enterLobby({automatic:true});
      else this.planPoll();
      return;
    }
    this.polling = true;
    const before = this.displayKey(), version = this.client.roomVersion;
    this.refreshPromise = (async () => {
      try {
        await this.client.refresh(); this.pollError = '';
        if (this.seatChoice && !this.choiceValid()) { this.seatChoice = null; this.down = null; this.error = '房间或席位已变化，请重新选择空位'; }
        if (this.client.connected && ['TIMEOUT', 'NETWORK_FAILED', 'CLOUD_REQUEST_FAILED'].includes(this.errorCode)) { this.error = ''; this.errorCode = null; }
      }
      catch (error) { if (version === this.client.roomVersion) this.pollError = cloudErrorText(error.message); }
      finally {
        this.polling = false;
        this.refreshPromise = null;
        if (!this.dead && before !== this.displayKey()) this.wake();
        this.planPoll();
      }
    })();
    await this.refreshPromise;
    // Both the host's second device and invited members follow a started match.
    // Remember entry so the battle's explicit "返回大厅" remains usable.
    if (!this.dead && !this.hidden && !this.busy && this.home() && ['loading', 'development-slice'].includes(this.client.room?.phase) &&
        this.battleEntryKey() !== this.lastEnteredAttemptKey) await this.activate({id: 'start'});
  }
  blockUnsupportedHostLeave() {
    if (!requiresHostHandoffUpdate(this.client.room, this.client.playerId)) return false;
    this.errorCode='HOST_LEAVE_HANDOFF_REQUIRED';this.error=cloudErrorText(this.errorCode);
    this.game.toast={text:this.error,time:5000};this.wake();return true;
  }
  confirmMatchExit(expectedRoom, isCurrent = () => true) {
    if (this.exitConfirming) return this.exitConfirming.promise;
    const token = this.client.token, roomId = expectedRoom?.id, attempt = expectedRoom?.battleAttempt;
    if (!roomId || this.dead || this.client.room?.id !== roomId || typeof this.wx.showModal !== 'function') return Promise.resolve(false);
    if (this.blockUnsupportedHostLeave()) return Promise.resolve(false);
    const host = this.client.room.host === this.client.playerId;
    let resolve;
    const confirmation = {promise: new Promise(done => { resolve = done; })};
    this.exitConfirming = confirmation;
    const finish = confirmed => {
      if (this.exitConfirming !== confirmation) return;
      this.exitConfirming = null;
      const current = !this.dead && this.client.token === token && this.client.room?.id === roomId && this.client.room?.battleAttempt === attempt && isCurrent();
      const permitted=confirmed === true && current && !this.blockUnsupportedHostLeave();
      resolve(permitted);this.wake();
    };
    confirmation.cancel = () => finish(false);
    try {
      this.wx.showModal({title:'确认退出游戏',showCancel:true,confirmText:'确认退出',cancelText:'继续游戏',
        content:host?'确认退出后将离开当前对局，不会自动重连回本局。仍有玩家时房主将自动移交，其他玩家继续游戏；无人时关闭房间。是否退出？':'确认退出后将离开当前对局，不会自动重连回本局，其他玩家继续游戏。是否退出？',
        success:result=>finish(result?.confirm === true && result?.cancel !== true),fail:()=>finish(false)});
    } catch (_) { finish(false); }
    return confirmation.promise;
  }
  async finishExit(expectedRoom, isCurrent = () => true, {sessionCurrent=isCurrent,onIntent}={}) {
    if (!isCurrent()) throw Error('ROOM_CHANGED_NO_ACTION');
    // Membership alone cannot identify the result of an uncertain create request.
    if (this.client.pendingRoomCreation && (!expectedRoom || this.client.pendingRoomCreationRoomId !== expectedRoom.id)) throw Error('ROOM_CREATION_UNCONFIRMED');
    if (!expectedRoom) {
      if (this.client.room) throw Error('ROOM_CHANGED_NO_ACTION');
      this.open = false; return;
    }
    if (this.client.room?.id !== expectedRoom.id) throw Error('ROOM_CHANGED_NO_ACTION');
    await this.client.refresh({fresh:true});
    if (!sessionCurrent()) throw Error('ROOM_CHANGED_NO_ACTION');
    if (this.client.room?.id !== expectedRoom.id) {
      if (!this.client.room) {
        if (this.client.pendingRoomCreation) throw Error('ROOM_CREATION_UNCONFIRMED');
        this.open = false; return;
      }
      throw Error('ROOM_CHANGED_NO_ACTION');
    }
    if (this.client.pendingRoomCreation && this.client.pendingRoomCreationRoomId !== expectedRoom.id) throw Error('ROOM_CREATION_UNCONFIRMED');
    if (requiresHostHandoffUpdate(this.client.room, this.client.playerId)) throw Error('HOST_LEAVE_HANDOFF_REQUIRED');
    await this.client.command('leave', {}, {isCurrent,onIntent});
    if (this.client.room) throw Error('ROOM_EXIT_UNCONFIRMED');
    this.open=false;this.seatChoice=null;this.down=null;
  }
  async exitLobby() {
    // Cancelling an unfinished connection defers membership cleanup until its
    // exact result is known. A restored active match still requires confirmation.
    if (this.exitRequested || this.exitConfirming) return;
    if (this.entryOperation) { this.exitRequested=true;this.open=false;this.wake();return; }
    const currentRoom=this.client.room, token=this.client.token, attempt=currentRoom?.battleAttempt;
    const current=()=>!this.dead&&this.client.token===token&&this.client.room?.id===currentRoom?.id&&this.client.room?.battleAttempt===attempt;
    const confirmed=!!currentRoom&&battlePhase(currentRoom);
    if (confirmed && (!await this.confirmMatchExit(currentRoom,current) || !current())) return;
    if (!current()) return;
    this.exitRequested=true;this.seatChoice=null;this.down=null;
    this.busy=true;this.pendingAction={id:'leave'};this.stopPoll();this.wake();
    try {
      const expected=currentRoom||(this.client.autoInvitePromise?await this.client.autoInvitePromise:null);
      const expectedToken=currentRoom?token:this.client.token, expectedAttempt=currentRoom?attempt:expected?.battleAttempt;
      const same=()=>!this.dead&&this.client.token===expectedToken&&this.client.room?.id===expected?.id&&this.client.room?.battleAttempt===expectedAttempt;
      if (!same()) throw Error('ROOM_CHANGED_NO_ACTION');
      if (!confirmed&&expected&&battlePhase(expected)&&(!await this.confirmMatchExit(expected,same)||!same())) return;
      await this.finishExit(expected,same);
    }
    catch(error) { if(!this.dead){this.open=true;this.error=cloudErrorText(error.message);this.errorCode=error.message;} }
    finally { this.exitRequested=false;this.busy=false;this.pendingAction=null;this.wake();this.planPoll(); }
  }
  async enterLobby({automatic=false}={}) {
    if(this.busy)return this.entryOperation;
    if(!automatic){this.entryRetryBlocked=false;this.entryRetryAt=0;this.entryFailures=0;this.entryStartedAt=this.entryNow();}
    if(automatic&&(this.entryRetryBlocked||(this.entryFailures||0)>=3||Number.isFinite(this.entryStartedAt)&&this.entryNow()-this.entryStartedAt>=90000)){this.entryRetryBlocked=true;this.error=(this.error||'连接未完成')+' · 自动恢复已暂停，请点连接房间重试';this.entryObservation={...this.entryObservation,elapsedMs:Math.max(0,this.entryNow()-this.entryStartedAt),outcome:'paused',membershipConfirmed:false};this.wake();return;}
    if(!Number.isFinite(this.entryStartedAt))this.entryStartedAt=this.entryNow();
    const entryAttempt=(this.entryFailures||0)+1;this.entryObservation={startedAtMs:this.entryStartedAt,elapsedMs:Math.max(0,this.entryNow()-this.entryStartedAt),attempts:entryAttempt,outcome:'pending',membershipConfirmed:false,scope:'entry establishment, not steady-state RTT or continuous Socket liveness'};
    this.busy = true; this.pendingAction = {id: 'connect'}; this.error = ''; this.errorCode = null; this.stopPoll(); this.wake();
    try {
      const operation=this.client.ensureLobby();this.entryOperation=operation;const room=await operation;
      this.client.requireLobbyRoom?.(room);this.entryFailures=0;this.entryRetryAt=0;this.entryRetryBlocked=false;this.pollError='';this.entryObservation={...this.entryObservation,elapsedMs:Math.max(0,this.entryNow()-this.entryStartedAt),outcome:'confirmed',membershipConfirmed:true};
      if(this.exitRequested){
        const token=this.client.token,attempt=room?.battleAttempt,current=()=>!this.dead&&this.client.token===token&&this.client.room?.id===room?.id&&this.client.room?.battleAttempt===attempt;
        if(!current())throw Error('ROOM_CHANGED_NO_ACTION');
        if(room&&battlePhase(room)&&(!await this.confirmMatchExit(room,current)||!current())){if(!this.dead)this.open=true;return;}
        await this.finishExit(room,current);
      }
    }
    catch (error) {
      if (!this.dead) {
        if (this.exitRequested && (this.client.room || this.client.pendingRoomCreation)) this.open = true;
        const code = this.exitRequested && this.client.pendingRoomCreation ? 'ROOM_CREATION_UNCONFIRMED' : error.message;
        this.error = cloudErrorText(code); this.errorCode = code;
        const c=this.client,uncertain=c.pendingSessionOp&&c.pendingSessionOp.outcome!=='success'||c.pendingRoomCreation&&c._creationOp?.outcome!=='success'||c._joinOp&&c._joinOp.outcome!=='success';
        this.entryRetryBlocked=!ENTRY_TRANSIENT.has(code)||!!uncertain;
        this.entryFailures=(this.entryFailures||0)+1;this.entryRetryAt=this.entryNow()+Math.min(30000,2000*2**Math.min(4,this.entryFailures-1));
        if(this.entryFailures>=3||this.entryNow()-this.entryStartedAt>=90000){this.entryRetryBlocked=true;this.error+=' · 自动恢复已暂停，请点连接房间重试';}
        this.entryObservation={...this.entryObservation,elapsedMs:Math.max(0,this.entryNow()-this.entryStartedAt),outcome:this.entryRetryBlocked?'paused':'failed',membershipConfirmed:false,lastError:safeCode(code)};
      }
    }
    finally { this.entryOperation=null;this.exitRequested=false;this.busy = false; this.pendingAction = null; this.wake(); this.planPoll(); }
  }
  async activate(button) {
    if (!this.enabled(button.id, button.slot)) return;
    if (button.id === 'open') {
      this.open = true; this.wake();
      if (!this.busy) await this.enterLobby();
      return;
    }
    if (button.id === 'close' || button.id === 'leave') { await this.exitLobby(); return; }
    if (button.id === 'retryLobby') { await this.enterLobby(); return; }
    if (button.id === 'seatCancel') { this.seatChoice = null; this.down = null; this.wake(); return; }
    if (button.id === 'seat' && this.client.room.slots[button.slot].kind === 'empty') {
      this.seatChoice = {roomId: this.client.room.id, revision: this.client.room.revision, slot: button.slot};
      this.down = null; this.error = ''; this.errorCode = null; this.wake(); return;
    }
    this.busy = true;
    this.pendingAction = {id: button.id, ready: !this.me()?.ready, value: button.value};
    this.error = ''; this.errorCode = null;
    this.stopPoll();
    this.wake();
    try {
      // Do not queue taps behind a slow heartbeat. The client protects writes from
      // late reads and retries definitive revision conflicts with the same intent.
      // Keeping share synchronous also preserves WeChat's native user gesture.
      if (this.dead || this.hidden || !this.allowed(button.id, button.slot)) return;
      const c = this.client;
      if (button.id === 'login' || button.id === 'retryLobby') await c.ensureLobby();
      if (button.id === 'create') await c.createRoom();
      if (button.id === 'join') {
        if (c.autoJoinPending) await c.autoJoinPending({retry: true});
        else { if (!c.token) await c.login(); await c.joinPending(); }
      }
      if (button.id === 'seatInvite' || button.id === 'seatAI') {
        const choice = this.seatChoice; this.seatChoice = null; this.down = null;
        if (button.id === 'seatInvite') { c.invite(); this.error = '已请求分享，好友加入后自动分配空位；未添加电脑'; }
        else await c.command('seat', {slot: choice.slot, value: 'ai'});
      }
      if (button.id === 'invite') { c.invite(); this.error = '已请求分享，请给好友保留空位；以实际入房为准'; }
      if (button.id === 'difficulty' && difficultyOptions.some(o => o.id === button.value) && button.value !== c.room.difficulty) await c.command('difficulty', {value: button.value});
      if (button.id === 'fog' && button.value !== c.room.fogEnabled) await c.command('fog', {value: button.value});
      if (button.id === 'ready') await c.command('ready', {value: this.pendingAction.ready});
      if (button.id === 'leave') await c.command('leave');
      if (button.id === 'seat') await c.command('seat', {slot: button.slot, value: c.room.slots[button.slot].kind === 'ai' ? 'empty' : 'ai'});
      if (button.id === 'start') {
        if(c.room.phase==='finished'&&typeof this.nextRound==='function'){await this.nextRound();return;}const roomId = c.room.id; await this.startBattle();
        if (!this.dead) {
          this.lastEnteredRoom = roomId;
          // POST /start may leave the local lobby snapshot unchanged until its
          // next heartbeat. A successful new host start increments exactly once.
          this.lastEnteredAttemptKey = this.battleEntryKey(c.room, c.room?.phase === 'lobby' && c.room?.host === c.playerId);
        }
      }
    } catch (error) { if (!this.dead) { this.error = cloudErrorText(error.message); this.errorCode = error.message; } }
    finally { this.busy = false; this.pendingAction = null; this.wake(); this.planPoll(); }
  }
  startLabel() {
    const r = this.client.room;
    if (r?.phase === 'loading') return '查看战斗加载';
    if (r?.phase === 'finished') return r.host===this.client.playerId?'再开一局 · 房主':'等待房主再开一局';
    if (r?.phase === 'development-slice') return '返回联机战斗';
    if (r && r.host !== this.client.playerId) return '等待房主开始';
    return '开始游戏 · 房主';
  }
  helpLines() {
    const c = this.client, r = c.room, me = this.me();
    if (this.inviting()) return ['正在接受好友邀请，请稍候', '入房后点击准备，等待房主开始'];
    if (!c.connected) return [this.busy ? '正在自动连接，请稍候' : '连接未完成，可重试或退出回主界面', '好友邀请会优先加入，不另建房'];
    if (!r) return [this.busy ? '正在连接并创建房间，好友邀请会优先加入' : '点击多人模式会自动建房，好友邀请优先加入', '共6席（含房主），最多邀请5位好友；电脑也占席位'];
    if (legacyRoom(r)&&['lobby','finished'].includes(r.phase)) return ['旧9席房间保留原成员，不自动移除', '本局结束后，请房主退出并重建6人房间'];
    if (!c.capacityPolicy&&r.phase==='lobby') return ['请先更新6人房间后端，再创建或开始新局', '已有对局可按原席位继续，不会自动移除成员'];
    if (r.phase === 'finished') return ['对局已结束，房主可保留队伍再开一局', '返回大厅后队友重新准备，房主开始新局'];
    if (r.phase === 'loading') return ['战斗正在加载，可查看进度或稍后返回', '房主和队友会进入同一场权威战斗'];
    if (battlePhase(r)) return ['对局已经开始，点击上方按钮返回战斗', '保留原席位，断线重连后继续'];
    if (c.lobbyRules !== 'host-exempt-ready-v1') return ['请先更新 0.28 后端，再开始游戏', '房主无需准备，受邀玩家准备后即可开始'];
    if (r.difficultyRules !== 'host-lobby-difficulty-v1') return ['请先更新 0.28 后端，才能选择难度', '房主无需准备，受邀玩家准备后即可开始'];
    const guests = r.slots.filter(s => s.kind === 'human' && s.id !== r.host), ready = guests.filter(s => s.ready && s.connection === 'connected').length;
    const offline = r.slots.findIndex(s => s.kind === 'human' && s.connection !== 'connected');
    const first = this.pendingAction?.id === 'difficulty' ? '正在应用难度，请稍候；以服务器确认为准' : this.pendingAction?.id === 'ready' ? (this.pendingAction.ready ? '正在确认准备，请稍候' : '正在取消准备，请稍候') :
      offline >= 0 ? `玩家 ${offline + 1} 掉线，等待重连` : r.host !== c.playerId && !me?.ready ? `请点击“准备” · 队友已准备 ${ready}/${guests.length}` :
      this.allReady() ? (r.host === c.playerId ? '队友已准备，可以开始游戏' : '你已准备，等待房主开始') : `等待队友准备 · ${ready}/${guests.length}（房主免准备）`;
    return [first, this.battleEnabled ? (r.slots.every(s => s.kind !== 'empty') && r.slots.some(s => s.kind === 'ai') ?
      '6席已满：房主可移除电脑，给好友留出空位' : '难度由房主选择；更改难度后队友需重新准备') : '此版本尚未启用联机战斗'];
  }
  statusText() {
    const invitation = this.client.invitationState, diagnostic = this.client.connectionDiagnostic;
    const connectionError = code => code && diagnostic?.status === 'failed' && diagnostic.code === code && this.client.connectionStatusText?.();
    if (invitation?.status === 'error') return connectionError(invitation.error) || cloudErrorText(invitation.error);
    if (invitation?.status === 'pending') return '已收到好友邀请';
    if (invitation?.status === 'authenticating') return '正在确认身份，随后自动加入好友房间';
    if (invitation?.status === 'connecting') return '收到好友邀请，正在连接服务';
    if (invitation?.status === 'joining') return '正在加入好友房间';
    if(invitation?.status==='choosing')return '原对局仍在进行，请选择继续或退出新建';
    if(invitation?.status==='leaving')return '正在确认退出原对局';
    if (invitation?.status === 'recovering') return '原对局已结束，正在退出旧房间';
    if (invitation?.status === 'creating') return '原邀请已失效，正在为你创建房间';
    if (invitation?.status === 'hosted' && this.client.room?.host === this.client.playerId) return '已创建房间，你现在可以邀请好友';
    if (this.error || this.pollError) return this.error ? connectionError(this.errorCode) || this.error : this.pollError;
    if(this.pendingAction?.id==='connect'&&diagnostic?.status==='pending'){
      if(diagnostic.stage==='health')return '正在连接云服务…';
      if(diagnostic.stage==='session')return '云服务已响应，正在建立会话…';
    }
    if (this.pendingAction?.id === 'difficulty') return '正在应用难度，请稍候…';
    const c = this.client, r = c.room, index = r?.slots?.findIndex(s => s.kind === 'human' && s.id === c.playerId);
    if(r&&!c.confirmedLobbyRoom?.())return '房间席位尚未确认，请重试连接';
    return r ? `队伍 ${r.slots.filter(s => s.kind !== 'empty').length}/${roomSeatCount(r)}席 · 真人${r.slots.filter(s=>s.kind==='human').length} · ${index >= 0 ? '你是玩家 ' + (index + 1) : '正在确认席位'} · ${c.connected ? '已连接' : '等待重连'}` : c.view().status;
  }
  seatLines(slot) {
    const c = this.client, s = c.room?.slots?.[slot] || {kind: 'empty'};
    if (s.kind !== 'human') return [s.kind === 'ai' ? `${slot + 1} · 电脑队友` : `${slot + 1} · 空位`, '',
      this.enabled('seat', slot) ? (s.kind === 'ai' ? '点按移除电脑' : '点按邀请或加电脑') : s.kind === 'ai' ? '电脑队友' : '等待队友'];
    const self = s.id === c.playerId, host = s.id === c.room.host;
    return [`玩家 ${slot + 1}${self ? ' · 你' : ''}`, host ? '房主' : '受邀玩家',
      s.connection === 'connected' ? `在线 · ${host ? '无需准备' : self && this.pendingAction?.id === 'ready' ? '正在确认…' : s.ready ? '已准备' : '未准备'}` : '掉线 · 等待重连'];
  }
  touch(kind, event) {
    if (this.dead || this.hidden || !this.home()) { this.controlMotionBN.cancel(); this.down = null; return false; }
    const L = this.layout(), points = kind === 'end' ? event.changedTouches : event.touches, p = points?.[0];
    const point = p ? {x: p.clientX ?? p.x, y: p.clientY ?? p.y} : null;
    const controls = this.open ? (this.seatChoice ? L.choices : [L.close, ...L.actions, ...L.difficulty, ...L.cards]) : [L.entry];
    if (kind === 'cancel' || (event.touches?.length || 0) > 1) { this.controlMotionBN.cancel(); const consume = this.open || !!this.down; this.down = null; return consume; }
    if (kind === 'start') { const b = controls.find(b => hit(b, point)); this.controlMotionBN.start(b,b&&this.enabled(b.id,b.slot)); this.down = b && this.enabled(b.id, b.slot) ? {b, p: point, key: L.key, id: p.identifier} : null; return this.open || !!b; }
    if (kind === 'move') { if (this.down && (!point || Math.hypot(point.x - this.down.p.x, point.y - this.down.p.y) > 8 || L.key !== this.down.key)) this.down.cancel = true; if(this.down?.cancel)this.controlMotionBN.cancel(); return this.open || !!this.down; }
    if (kind === 'end') { const down = this.down; this.down = null; this.controlMotionBN.release(!!(down&&!down.cancel&&point&&down.key===L.key&&(p.identifier??0)===(down.id??0)&&hit(down.b,point))); if (down && !down.cancel && point && down.key === L.key && (p.identifier ?? 0) === (down.id ?? 0) && hit(down.b, point)) void this.activate(down.b); return this.open || !!down; }
    return this.open;
  }
  draw() {
    if (this.dead || this.hidden) return;
    if (!this.home()) { this.open = false; this.seatChoice = null; this.down = null; return; }
    const L = this.layout(), c = this.game.ctx || this.game.canvas.getContext('2d');
    if (this.down && this.down.key !== L.key) {this.down = null;this.controlMotionBN.cancel();}
    c.save();
    c.setTransform(this.game.canvas.width / L.width, 0, 0, this.game.canvas.height / L.height, 0, 0);
    const box = (b, color, border = '#b59b63') => { b=this.controlMotionBN.pose(b); c.fillStyle = color; c.fillRect(b.x, b.y, b.w, b.h); c.strokeStyle = border; c.lineWidth = 1; c.strokeRect(b.x, b.y, b.w, b.h); };
    const text = (s, b, dy, size = 13, color = '#edf4e8') => { b=this.controlMotionBN.pose(b);dy*=b.motionScale;size*=b.motionScale; c.save(); c.beginPath(); c.rect(b.x + 4*b.motionScale, b.y, b.w - 8*b.motionScale, b.h); c.clip(); c.fillStyle = color; c.font = size + 'px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(String(s), b.x + 8*b.motionScale, b.y + dy, b.w - 16*b.motionScale); c.restore(); };
    if (!this.open) { box(L.entry, '#20553d'); text('多人模式', L.entry, 21, 12); c.restore(); return; }
    c.fillStyle = 'rgba(0,0,0,.78)'; c.fillRect(0, 0, L.width, L.height);
    box(L.panel, '#19332c'); text(legacyRoom(this.client.room)?'历史9席对局':'多人房间 · 6人', {...L.panel, w: L.panel.w - 144}, 27, 18);
    const canClose = this.enabled('close');
    box(L.close, canClose ? '#28674a' : '#39453e');
    text(this.exitRequested ? '正在退出…' : '退出回主界面', L.close, 20, 12, canClose ? '#fff' : '#a9b6ac');
    text(this.statusText(), {...L.panel, y: L.panel.y + 43, h: 22}, 11, 12, '#f0d39a');
    const latency=this.client.lobbyLatency?.();
    const metrics=Number.isFinite(latency)?Math.round(latency)+' ms':'--';
    text(`帧率 --  ·  网络延迟 ${metrics}  ·  ${CLIENT_MARK}`, {...L.panel,y:L.panel.y+65,h:20},10,13,'#d8f4e8');
    for (const b of L.difficulty) {
      const selected = this.client.room?.difficulty === b.value, enabled = this.enabled('difficulty');
      box(b, selected ? '#785b22' : enabled ? '#28674a' : '#39453e', selected ? '#ffde87' : '#b59b63');
      text((selected ? '✓ ' : '') + b.text, b, 18, 12, selected ? '#fff0bc' : enabled ? '#fff' : '#a9b6ac');
    }
    for (const b of L.cards) {
      const s = this.client.room?.slots?.[b.slot] || {kind: 'empty'}, lines = this.seatLines(b.slot), self = s.kind === 'human' && s.id === this.client.playerId;
      box(b, s.kind === 'human' ? '#285647' : s.kind === 'ai' ? '#4b4b2b' : '#233c32', self ? '#8fe0ad' : '#b59b63');
      {const p=this.controlMotionBN.pose(b),s=p.motionScale;c.fillStyle=seatColor(b.slot);c.fillRect(p.x+s,p.y+s,3*s,p.h-2*s);}
      if (b.h < 62) {
        text(lines[0] + (lines[1] ? ' · ' + lines[1] : ''), b, b.h * .29, 11, self ? '#a8ffc7' : '#edf4e8');
        text(lines[2], b, b.h * .74, 11, '#d1dfd4');
      } else {
        text(lines[0], b, 17, 12, self ? '#a8ffc7' : '#edf4e8');
        text(lines[1], b, 37, 12, '#f0d39a');
        text(lines[2], b, 56, 11, '#d1dfd4');
        if (s.kind === 'human' && s.name && !/^(临时测试玩家|微信玩家)$/.test(s.name) && b.h > 90) text(s.name, b, 79, 11, '#c3d1c5');
      }
    }
    for (const b of L.actions) {
      const enabled = this.enabled(b.id), label = b.id === 'retryLobby' && this.client.token && !this.client.connected ? '重新连接' :
        b.id === 'ready' && this.client.room?.host === this.client.playerId ? '房主免准备' :
        b.id === 'ready' && this.pendingAction?.id === 'ready' ? (this.pendingAction.ready ? '正在准备…' : '正在取消…') :
        b.id === 'ready' && this.me()?.ready ? '取消准备' : b.id === 'start' && this.busy ? '正在处理…' : b.text;
      box(b, enabled ? b.id === 'start' ? '#427f35' : '#28674a' : '#39453e');
      text(label, b, b.h / 2, b.id === 'start' ? 15 : 12, enabled ? '#fff' : '#a9b6ac');
    }
    this.helpLines().forEach((line, i) => text(line, L.help, 8 + i * 16, 11, '#d6bc87'));
    if (this.seatChoice) {
      c.fillStyle = 'rgba(0,0,0,.75)'; c.fillRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
      box(L.choicePanel, '#19332c');
      c.fillStyle=seatColor(this.seatChoice.slot);c.fillRect(L.choicePanel.x+1,L.choicePanel.y+1,3,L.choicePanel.h-2);
      text('空位 ' + (this.seatChoice.slot + 1) + ' · 选择队友', L.choicePanel, 22, 17);
      text('好友加入后自动分配空位', L.choicePanel, 46, 12, '#f0d39a');
      for (const b of L.choices) {
        const enabled = this.enabled(b.id);
        box(b, enabled ? '#28674a' : '#39453e'); text(b.text, b, 20, 14, enabled ? '#fff' : '#a9b6ac');
      }
    }
    c.restore();
  }
  dispose() {
    if (this.dead) return;
    this.controlMotionBN.cancel();
    this.dead = true; this.exitConfirming?.cancel(); this.seatChoice = null; this.stopPoll(); this.down = null; this.unsubscribe?.();this.wx.offNetworkStatusChange?.(this.networkChange);
    if (this.gate.controller === this) this.gate.controller = null;
    if (this.game.draw === this.wrapper) this.game.draw = this.original;
    this.wx.offHide?.(this.hide); this.wx.offShow?.(this.show); this.client.dispose();
  }
}
module.exports = {CanvasTeam};
