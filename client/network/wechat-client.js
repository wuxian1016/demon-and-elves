const {socketFailureFields}=require('./socket-failure-fields');
const {BattleSocket,isBattleBackpressure,isSocketAdmissionBusy} = require('./battle-socket');
const {readCapacityPolicy,legacyRoom}=require('./room-capacity');
const ACTIVE_ROOM = new Set(['loading','development-slice']);
const EXIT_UNCERTAIN = new Set(['TIMEOUT','NETWORK_FAILED','API_UNAVAILABLE','CLOUD_REQUEST_FAILED','CLOUD_REQUEST_TIMEOUT','INVALID_CLOUD_RESPONSE','SERVICE_FAILED','UNKNOWN','REQUEST_SUPERSEDED','ROOM_CHANGED_NO_ACTION','AUTH_REQUIRED','NOT_MEMBER','ROOM_UNAVAILABLE']);
const has = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
// A legacy host leave closes the entire room. Require the room capability unless
// the complete roster proves this is the last human; retry against each fresh revision.
function requiresHostHandoffUpdate(room, playerId) {
  if (!room || room.host !== playerId || room.hostLeavePolicy === 'transfer-or-close-empty-v1') return false;
  const slots = room.slots;
  if (!Array.isArray(slots) || slots.length < 1 || slots.length > 9 || slots.some(p => !p || !['human','ai','empty'].includes(p.kind) || p.kind === 'human' && (typeof p.id !== 'string' || !p.id))) return true;
  const humans = slots.filter(p => p.kind === 'human');
  return humans.length !== 1 || humans[0].id !== playerId;
}

class WechatRoomClient {
  constructor({wx, endpoint = '', protocol = 1, compat = '627-room-prototype-1', timeoutMs = 8000, transportKind = 'cloud'} = {}) {
    if(!['cloud','native'].includes(transportKind))throw Error('INVALID_TRANSPORT_KIND');
    Object.assign(this, {wx, endpoint, protocol, compat, timeoutMs, transportKind});
    Object.assign(this, {token: null, playerId: null, room: null, roomVersion: 0, membershipKnown: false,
      pendingInvite: null, busy: null, serial: 0, connected: false, closed: false, state: '未连接联机服务',
      attached: false, inviteSequence: 0, attemptedInvite: 0, lastLaunchInvite: null, invitationState: null,
      autoInvitePromise: null, lobbyPromise: null, refreshPromise: null, writePromise: null, writing: false, requestSerial: 0, connectionSerial: 0});
    this.onShow = event => this.acceptLaunch(event);
    this.listeners = new Set(); this.pendingApiCalls = new Set(); this.joinedInvites = new Map(); this.retiredInvites = new Map();
    this.shareProvider = {get: () => this.invitationPayload()};
  }
  available() { return typeof this.endpoint === 'string' && this.endpoint.length < 2048 && /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[1-9]\d{0,4})?(?:\/[A-Za-z0-9_/-]*)?$/i.test(this.endpoint) && !!this.wx?.login && !!this.wx?.request; }
  attach() {
    if (this.attached || this.closed) return;
    this.attached = true;
    if (this.wx) {
      this.previousShareProvider = this.wx.__demonElvesRoomShare; this.wx.__demonElvesRoomShare = this.shareProvider;
      // Persist only invitation fingerprints across runtime replacements, never credentials.
      this.entryHistory = this.wx.__demonElvesInvitationEntry || (this.wx.__demonElvesInvitationEntry = {cold: null, last: null});
      this.lastLaunchInvite = this.entryHistory.last;
    }
    this.wx?.onShow?.(this.onShow);
    const event = this.wx?.getLaunchOptionsSync?.(), code = event?.query?.invite;
    if (event?.query?.compat === this.compat && typeof code === 'string' && /^[A-Za-z0-9_-]{24}$/.test(code) && this.entryHistory?.cold !== code) {
      if (this.entryHistory) this.entryHistory.cold = code;
      this.acceptLaunch(event);
    }
  }
  dispose() {
    if (this.closed) return;
    this.closed = true; for(const cancel of this.pendingApiCalls)cancel(); this.pendingApiCalls.clear(); this.closeBattle(); this.connected = false;
    if (this.attached) this.wx?.offShow?.(this.onShow);
    if (this.wx?.__demonElvesRoomShare === this.shareProvider) {
      if (this.previousShareProvider === undefined) delete this.wx.__demonElvesRoomShare;
      else this.wx.__demonElvesRoomShare = this.previousShareProvider;
    }
    this.attached = false; this.token = null; this.room = null; this.pendingInvite = null; this.listeners.clear();
  }
  subscribe(listener) { if (typeof listener !== 'function' || this.closed) return () => {}; this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event) { if (!this.closed) for (const listener of [...this.listeners]) { try { listener(event); } catch {} } }
  setInvitation(status, error = null, sequence = this.inviteSequence, code = this.pendingInvite) {
    if (this.closed || sequence !== this.inviteSequence) return;
    this.invitationState = Object.freeze({code, sequence, status, error});
    this.emit({type: 'invitation', invitation: this.invitationState});
  }
  acceptLaunch(event) {
    if (this.closed) return false;
    const q = event?.query;
    if (q?.compat !== this.compat || typeof q.invite !== 'string' || !/^[A-Za-z0-9_-]{24}$/.test(q.invite)) return false;
    if (q.invite === this.lastLaunchInvite &&
        (this.pendingInvite === q.invite && this.autoInvitePromise ||
         this.retiredInvites.get(q.invite) && this.retiredInvites.get(q.invite) === this.room?.id && this.room?.host === this.playerId)) return false;
    this.lastLaunchInvite = q.invite; if (this.entryHistory) this.entryHistory.last = q.invite;
    this.pendingInvite = q.invite; this.inviteSequence++; this.setInvitation('pending'); void this.autoJoinPending(); return true;
  }
  inviteMayCreate(sequence) {
    return Number.isSafeInteger(sequence) && sequence === this.inviteSequence &&
      this.invitationState?.status === 'creating' && this.pendingInvite === this.invitationState?.code;
  }
  retireInvite(code) {
    this.retiredInvites.set(code,null);
    while(this.retiredInvites.size>32)this.retiredInvites.delete(this.retiredInvites.keys().next().value);
    this.joinedInvites.delete(code);
  }
  chooseActiveInvite() {
    return new Promise((resolve,reject)=>{
      if(typeof this.wx?.showModal!=='function') return reject(Error('INVITE_CHOICE_UNAVAILABLE'));
      try {this.wx.showModal({title:'原对局还在进行',content:'可以重连继续原局。选择退出新建，将先退出你在原局的席位，其他玩家继续游戏。',
        showCancel:true,cancelText:'继续原局',confirmText:'退出新建',
        success:r=>r?.confirm===true&&r?.cancel!==true?resolve('exit'):r?.cancel===true?resolve('rejoin'):reject(Error('INVITE_CHOICE_UNAVAILABLE')),
        fail:()=>reject(Error('INVITE_CHOICE_UNAVAILABLE'))});}
      catch {reject(Error('INVITE_CHOICE_UNAVAILABLE'));}
    });
  }
  confirmInviteExit(op) {
    if(this.inviteExit!==op) return;
    this.inviteExit=null;this.closeBattle();this.retireInvite(op.code);
    this.emit({type:'invite-left',roomId:op.roomId});
  }
  async exitForInvite(code,old,isCurrent) {
    if(this.inviteExit) throw Error('ROOM_EXIT_UNCONFIRMED');
    const op={code,roomId:old.id,playerId:this.playerId};this.inviteExit=op;
    try {await this.command('leave',{}, {isCurrent});}
    catch(error) {
      if(!EXIT_UNCERTAIN.has(error.message)){if(this.inviteExit===op)this.inviteExit=null;throw error;}
      this.membershipKnown=false;
      try {if(this.token&&this.playerId===op.playerId)await this.refresh({fresh:true});}
      catch {throw Error('ROOM_EXIT_UNCONFIRMED');}
      if(!this.membershipKnown||this.playerId!==op.playerId||this.room?.id===op.roomId)throw Error('ROOM_EXIT_UNCONFIRMED');
    }
    if(!this.membershipKnown||this.playerId!==op.playerId||this.room?.id===op.roomId)throw Error('ROOM_EXIT_UNCONFIRMED');
    this.confirmInviteExit(op);
  }
  // An explicit server rejection or a matching terminal room may be replaced.
  // Active matches require explicit consent; unrelated rooms are kept.
  autoJoinPending({retry = false} = {}) {
    if (this.closed) return Promise.resolve(null);
    if (this.autoInvitePromise) return this.autoInvitePromise;
    if (!this.pendingInvite) return Promise.resolve(this.room);
    if (retry) this.attemptedInvite = 0;
    this.autoInvitePromise = Promise.resolve().then(async () => {
      while (!this.closed && this.pendingInvite && this.attemptedInvite !== this.inviteSequence) {
        const sequence = this.inviteSequence, code = this.pendingInvite; this.attemptedInvite = sequence;
        try {
          this.setInvitation('connecting', null, sequence, code);
          if (!this.token || !this.connected) await this.login();
          if (this.closed) break;
          if (sequence !== this.inviteSequence) continue;
          // 0.27 includes membership in session/heartbeat. Older servers still recover it safely.
          const priorRoom=this.room;
          if (!this.membershipKnown || this.room || this.inviteExit) await this.refresh({fresh: true});
          if (this.closed) break;
          if (sequence !== this.inviteSequence) continue;
          if(priorRoom&&!this.room&&this.membershipKnown&&!this.inviteExit){
            this.closeBattle();this.emit({type:'invite-left',roomId:priorRoom.id});
          }
          if(this.recoverInviteCreation){
            await this.recoverInviteCreation();
            if(this.closed||sequence!==this.inviteSequence)continue;
          }
          const token=this.token;
          const current=()=>!this.closed&&this.token===token&&sequence===this.inviteSequence;
          const oldExit=this.inviteExit;
          if(oldExit){
            if(oldExit.playerId!==this.playerId||!this.membershipKnown||this.room?.id===oldExit.roomId)throw Error('ROOM_EXIT_UNCONFIRMED');
            this.confirmInviteExit(oldExit);
          }
          let status='joined';
          if (this.room) {
            const old=this.room, replacement=this.retiredInvites.get(code);
            if (replacement===old.id && old.host===this.playerId) status='hosted';
            else {
              if (old.joinCode!==code && old.acceptedInvite!==code && this.joinedInvites.get(code)!==old.id) throw Error('ALREADY_IN_ROOM');
              const ended=r=>r?.id===old.id&&(r.phase==='finished'||r.phase==='lobby'&&r.acceptedInvite===code&&r.inviteReplaced===true);
              if (ended(old)) {
                this.setInvitation('recovering',null,sequence,code);
                await this.exitForInvite(code,old,()=>current()&&ended(this.room));
              } else if(ACTIVE_ROOM.has(old.phase)) {
                this.setInvitation('choosing',null,sequence,code);
                const choice=await this.chooseActiveInvite();
                if(!current())continue;
                if(choice==='exit'){
                  this.setInvitation('leaving',null,sequence,code);
                  await this.exitForInvite(code,old,()=>current()&&this.room?.id===old.id&&this.room?.battleAttempt===old.battleAttempt);
                } else { status='rejoined'; }
              }
              if(!current())continue;
              if(this.retiredInvites.has(code)&&this.room)throw Error('ALREADY_IN_ROOM');
            }
          } else if (!this.retiredInvites.has(code)) {
            this.setInvitation('joining', null, sequence, code);
            this.roomVersion++; // A late heartbeat cannot erase a completed join.
            try {
              const room = await this.request('/api/join', {code});
              if (this.closed) break;
              if (token!==this.token) continue;
              this.setRoom(room); this.joinedInvites.set(code, room.id);
            } catch(e) {
              if(e.message!=='ROOM_UNAVAILABLE') throw e;
              if(!current()) continue;
              this.retireInvite(code);
              await this.refresh({fresh:true});
              if(!current()) continue;
              if(this.room) throw Error('ALREADY_IN_ROOM');
            }
          }
          if (!current()) continue;
          if (!this.room && this.retiredInvites.has(code)) {
            this.setInvitation('creating',null,sequence,code);
            const room = await this.createRoom({inviteSequence:sequence});
            if (room?.host===this.playerId) this.retiredInvites.set(code,room.id);
            if(!current()) continue;
            if(!room || room.host!==this.playerId) throw Error('ALREADY_IN_ROOM');
            status='hosted';
          }
          if (this.room && current()) { this.pendingInvite = null; this.setInvitation(status, null, sequence, code); }
        } catch (e) { this.setInvitation('error', e.message, sequence, code); }
      }
      return ['joined','rejoined','hosted'].includes(this.invitationState?.status) ? this.room : null;
    }).finally(() => {
      this.autoInvitePromise = null;
      if (!this.closed && this.pendingInvite && this.attemptedInvite !== this.inviteSequence) void this.autoJoinPending();
    });
    return this.autoInvitePromise;
  }
  call(method, arg) {
    if(this.closed)return Promise.reject(Error('CLIENT_DISPOSED'));
    return new Promise((resolve, reject) => {
      let done = false, task = null;
      const abort = () => {try{task?.abort?.();}catch{}};
      const finish = (fn, value) => { if (done) return; done = true; clearTimeout(timer); this.pendingApiCalls.delete(cancel); fn(value); };
      const cancel = () => {finish(reject, Error('CLIENT_DISPOSED'));abort();};
      this.pendingApiCalls.add(cancel);
      const timer = setTimeout(() => {finish(reject, Error('TIMEOUT'));abort();}, this.timeoutMs);
      try { task=this.wx[method]({...arg, success: r => finish(resolve, r), fail: e => finish(reject, Error(method === 'login' ? 'LOGIN_FAILED' : /^(CLOUD_(API_UNAVAILABLE|REQUEST_(FAILED|TIMEOUT|DENIED)|ROUTE_DENIED|HEADER_DENIED)|INVALID_CLOUD_RESPONSE)$/.test(e?.errMsg) ? e.errMsg : 'NETWORK_FAILED'))});if(this.closed&&done)abort(); }
      catch { finish(reject, Error('API_UNAVAILABLE')); }
    });
  }
  setRoom(room) {
    if (this.closed) return this.room;
    // Network delivery order is not room revision order.
    if (room && room.id === this.room?.id && room.revision < this.room.revision) return this.room;
    this.room = room; this.membershipKnown = true; this.roomVersion++;
    return room;
  }
  closeBattle() {
    // Retire ownership before native close callbacks settle pending RPCs.
    const socket=this.socket;this.socket=null;this.socketConnecting=null;
    this.battleGeneration=(this.battleGeneration||0)+1;socket?.close();
  }
  openBattle(update) { this.battleUpdate = update; }
  connectionResult(serial, token, connected, state) {
    if (this.closed || token !== this.token || serial < this.connectionSerial) return;
    this.connectionSerial = serial; this.connected = connected;
    if (state) this.state = state;
  }
  handleSocketFailure(e,serial,token){
    this.connectionResult(serial,token,false);
    const transportFailure=e.closeReasonClass!=='ACCESS_DENIED'&&/^(NETWORK_FAILED|SOCKET_(TIMEOUT|HEARTBEAT_STALE|RECEIVE_BACKLOG|UNAVAILABLE|CONNECT_FAILED|TRANSPORT_FAILED|CLOSED|AUTH_SEND_FAILED)|(?:CLOUD|NATIVE)_SOCKET_(FAILED|TIMEOUT|UNAVAILABLE))$/.test(e.message);
    this.battleDiagnostic={stage:['connect','auth','rpc'].includes(e.stage)?e.stage:'rpc',code:transportFailure?e.message:'SOCKET_REJECTED',transport:(this.socketTransportKind||this.transportKind)+'-socket'};this.lastSocketFailureDiagnostic={failureTransportKind:this.socketTransportKind||this.transportKind,failureRecordedAtMs:Date.now(),...socketFailureFields(e),...Object.fromEntries(['socketAttemptStartedAtMs','socketConnectCalledAtMs','socketFailureObservedAtMs'].filter(k=>Number.isSafeInteger(e[k])&&e[k]>=0&&e[k]<=8640000000000000).map(k=>[k,e[k]])),stage:this.battleDiagnostic.stage,code:this.battleDiagnostic.code,...(Number.isSafeInteger(e.sdkCode)?{sdkCode:e.sdkCode}:{}),...(Number.isSafeInteger(e.closeCode)?{closeCode:e.closeCode}:{}),...(typeof e.closeReasonClass==='string'?{closeReasonClass:e.closeReasonClass}:{})};
    if(!transportFailure){this.recordAuthFailure({source:'socket',code:e.message,requestKind:e.stage==='auth'?'socket-auth':'socket-rpc',socketProcess:e.serverInstance||null,credentialDiscarded:!!token&&e.message==='AUTH_REQUIRED'&&token===this.token});this.socketBlockedError=e;if(e.message==='AUTH_REQUIRED'&&token===this.token)this.token=null;this.closeBattle();return false;}
    if(this.closed||token!==this.token)return false;this.socketFailureCount=(this.socketFailureCount||0)+1;const backoff=Math.min(30000,2000*2**Math.min(4,this.socketFailureCount-1));this.socketFallbackUntil=Date.now()+Math.min(30000,Math.max(2000,Math.round(backoff*(.8+Math.random()*.4))));
    // A failed opening attempt has not established a client-side business Socket scope.
    // Retire only that task, so same-session HTTP work already in flight can
    // deliver its real result. Authenticated/room-bound sockets and explicit
    // lifecycle changes retain the original generation invalidation.
    const opening=this.socket;
    const unboundOpening=opening&&opening.token===token&&['connect','auth'].includes(e.stage)&&opening.stage===e.stage&&!opening.ready&&!opening.boundRoomId&&!opening.requestedRoomId&&opening.pending instanceof Map&&opening.pending.size===0;
    if(unboundOpening){this.socket=null;this.socketConnecting=null;opening.close();}
    else this.closeBattle();
    return true;
  }
  observeRouting(headers){
    if(!headers||typeof headers!=='object')return;
    const keys=Object.keys(headers);if(keys.length>128)return;
    const get=name=>headers[keys.find(k=>k.toLowerCase()===name)];
    const instance=get('x-game-instance'),release=get('x-game-release');
    if(typeof instance!=='string'||!/^[0-9a-f]{12}$/.test(instance))return;
    this.lastHttpInstance=instance;this.lastHttpRelease=typeof release==='string'&&/^[a-zA-Z0-9-]{1,64}$/.test(release)?release:null;
    const rows=this.httpInstanceSamples||(this.httpInstanceSamples=[]);if(!rows.some(r=>r.instanceTag===instance&&r.release===this.lastHttpRelease))rows.push({instanceTag:instance,release:this.lastHttpRelease});if(rows.length>8)rows.shift();return {instanceTag:instance,release:this.lastHttpRelease};
  }
  routingReport(){return {scope:'optional ephemeral process tags, not session/player IDs; absent legacy headers mean unknown',httpProcesses:(this.httpInstanceSamples||[]).map(r=>({...r})),socketProcess:this.socket?.serverInstance||null,socketRelease:this.socket?.networkRelease||null};}
  recordAuthFailure({source,code,requestKind,status=null,credentialDiscarded=false,httpProcess=null,socketProcess=null}){
    const known=['AUTH_REQUIRED','LOGIN_REQUIRED','NOT_MEMBER','ROOM_UNAVAILABLE','FORBIDDEN','VERIFIED_IDENTITY_REQUIRED','HTTP_401','HTTP_403'];if(!['http','socket','local'].includes(source))return;if(!known.includes(code)){if(status===401)code='HTTP_401';else if(status===403)code='HTTP_403';else return;}if(!['heartbeat','snapshot','input','socket-auth','socket-rpc','room-create','join','session','other'].includes(requestKind))requestKind='other';
    const s=this.socket,now=Date.now(),rows=this.authFailureSamples||(this.authFailureSamples=[]);
    rows.push({atMs:now,battleGeneration:this.battleGeneration||0,qaGeneration:Number.isSafeInteger(this.qaGeneration)?this.qaGeneration:null,source,code,requestKind,status,credentialDiscarded:!!credentialDiscarded,socketReadyFlag:s?.ready===true,socketBoundFlag:!!s?.boundRoomId&&s.boundRoomId===this.room?.id,lastAuthenticatedRpcAgeMs:Number.isFinite(s?.lastAuthenticatedRpcAt)?Math.max(0,now-s.lastAuthenticatedRpcAt):null,lastPongAgeMs:Number.isFinite(s?.lastPongAt)?Math.max(0,now-s.lastPongAt):null,httpProcess:source==='http'?httpProcess:null,lastKnownHttpProcess:this.lastHttpInstance||null,socketProcess:socketProcess||s?.serverInstance||null,processTagsMatch:source==='http'&&httpProcess&&s?.serverInstance?httpProcess===s.serverInstance:null});
    if(rows.length>8)rows.shift();
  }
  authFailureReport(){return (this.authFailureSamples||[]).map(r=>({...r}));}
  // Only an already-sent moving RPC on this exact authenticated Socket is
  // eligible. No HTTP fallback, new Socket, synthetic receipt or reordered commit.
  beginOrderedNeutral(path,command,headers={},previous){
    const socket=this.socket,token=this.token,roomId=this.room?.id,generation=this.battleGeneration||0;
    if(this.closed||!this.connected||!this.membershipKnown||this.writing||!token||!roomId||this.socketBlockedError||this.socketFallbackUntil>Date.now()||
      !socket?.ready||socket.closed||socket.token!==token||socket.boundRoomId!==roomId||socket.capabilities?.controlFeedback!=='deferred'||
      !(socket.pending instanceof Map)||socket.pending.size>=7||
      path!=='/api/rooms/'+roomId+'/battle/input'||previous?.action!=='joystick'||command?.action!=='joystick'||
      !previous.args||!command.args||!(previous.args.dx||previous.args.dy)||command.args.dx!==0||command.args.dy!==0||
      !Number.isSafeInteger(previous.epoch)||previous.epoch<1||!Number.isSafeInteger(previous.seq)||previous.seq<1||
      command.epoch!==previous.epoch||command.seq!==previous.seq+1)return null;
    if((socket.rpcSentAt||[]).filter(t=>Date.now()-t<1000).length>=26)return null;
    const entries=[...socket.pending.values()].filter(p=>p.method==='input');
    if(entries.length!==1||entries[0].command!==previous||entries[0].roomId!==roomId||!Number.isFinite(entries[0].sendReturnedAt))return null;
    const current=()=>!this.closed&&this.connected&&this.membershipKnown&&this.token===token&&this.room?.id===roomId&&
      (this.battleGeneration||0)===generation&&this.socket===socket;
    const serial=++this.requestSerial;
    return socket.call(roomId,'input',command,{viewRevision:Number(headers['X-Presentation-Revision'])}).then(value=>{
      if(!current())throw Error('REQUEST_SUPERSEDED');
      this.socketFailureCount=0;this.socketFallbackUntil=0;this.connectionResult(serial,token,true,'已连接（联机原型）');
      this.battleTransportObserver?.('socket',{epoch:command.epoch,seq:command.seq,socketAttemptStartedAtMs:socket.attemptStartedAtMs??null});
      return value;
    },error=>{
      if(!current())throw Error('REQUEST_SUPERSEDED');
      // The ordered client retains this command. Ordinary retry owns recovery
      // after the previous command has resolved, including ambiguous send failure.
      throw error;
    });
  }
  async request(path, data, requestHeaders = {}) {
    if (this.closed) throw Error('CLIENT_DISPOSED');
    // Health discovery must not prevent an existing legacy member recovering
    // their current match. Gate only new membership/room writes.
    if((path==='/api/rooms'||path==='/api/join')&&!this.capacityPolicy)throw Error('CAPACITY_BACKEND_UPDATE_REQUIRED');
    if(data!==undefined&&(/\/battle\/(start|next-round)$/.test(path)||data?.type==='seat'&&data.value==='ai')){
      if(legacyRoom(this.room))throw Error('LEGACY_ROOM_RECREATE_REQUIRED');
      if(!this.capacityPolicy)throw Error('CAPACITY_BACKEND_UPDATE_REQUIRED');
    }
    const token = this.token, serial = ++this.requestSerial, route = path.match(/^\/api\/rooms\/([\w-]+)\/battle(\/input)?$/);
    let generation=this.battleGeneration||0;
    const roomId=this.room?.id;
    const current=()=>!this.closed&&this.token===token&&this.room?.id===roomId&&(this.battleGeneration||0)===generation;
    const checkCurrent=()=>{if(route&&!current())throw Error('REQUEST_SUPERSEDED');};
    // Same membership read/lease as HTTP, on the existing authenticated battle
    // Socket only. Lobby/unknown membership/unavailable connection retain HTTP.
    const membershipSocket=path==='/api/heartbeat'&&this.battleUpdate&&this.membershipKnown&&this.connected&&!this.writing&&this.socket?.ready&&!this.socket.closed&&this.socket.token===token&&this.socket.boundRoomId===roomId&&this.socket.capabilities?.membershipHeartbeat&&!(this.socketFallbackUntil>Date.now())?this.socket:null;
    if(membershipSocket){
      try{
        const value=await membershipSocket.call(roomId,'heartbeat');
        if(!current()||this.socket!==membershipSocket)throw Error('REQUEST_SUPERSEDED');
        if(!value||value.roomId!==roomId||value.room?.id!==roomId)throw Error('INVALID_HEARTBEAT');
        this.membershipHeartbeatTransport='socket';(this.membershipHeartbeatCounts??={socket:0,http:0}).socket++;
        this.connectionResult(serial,token,true,'已连接（联机原型）');return value;
      }catch(e){
        if(!current()||this.socket!==membershipSocket)throw Error('REQUEST_SUPERSEDED');
        if(e.message==='REQUEST_SUPERSEDED'||e.message==='SOCKET_BUSY'||isBattleBackpressure(e))throw e;
        if(!this.handleSocketFailure(e,serial,token))throw e;
        generation=this.battleGeneration||0;
      }
    }
    if(route&&this.socketBlockedError)throw this.socketBlockedError;
    if (route && !(this.socketFallbackUntil > Date.now()) && this.wx?.connectSocket && this.available() && token) {
      if (!this.socket || this.socket.closed) {
        const socketGeneration=this.battleGeneration||0;const nextSocket = new BattleSocket(this.wx, this.endpoint.replace(/^https:/, 'wss:').replace(/\/$/, '') + '/api/socket', token, m => { if (this.socket===nextSocket&&this.token===token&&(this.battleGeneration||0)===socketGeneration&&m.roomId === this.room?.id) this.battleUpdate?.(m.type==='round-reset'?{status:'round-reset',roomId:m.roomId,previousEpoch:m.previousEpoch}:m.snapshot,{socket:nextSocket,token,roomId:m.roomId,battleGeneration:socketGeneration}); },{onIdleFailure:e=>{if(!this.closed&&this.socket===nextSocket&&this.token===token)this.handleSocketFailure(e,this.requestSerial,token);}});nextSocket.rpcTimingObserver=sample=>{if(!this.closed&&this.socket===nextSocket&&this.token===token)this.battleServiceObserver?.(sample);};this.socket=nextSocket;
      }
      const socket=this.socket;
      if(!socket.ready){
        // Read-only keyframes and inputs use the already-authorized HTTP route
        // while one socket opens in background; they never wait eight seconds.
        if(!this.socketConnecting){const opening=socket.open();this.socketConnecting=opening;opening.catch(e=>{if(current()&&this.socket===socket)this.handleSocketFailure(e,serial,token);}).finally(()=>{if(this.socketConnecting===opening)this.socketConnecting=null;});}
      }else{
        try { const value=await socket.call(route[1], route[2] ? 'input' : 'snapshot', data,{viewRevision:Number(requestHeaders['X-Presentation-Revision'])});checkCurrent();if(this.socket!==socket)throw Error('REQUEST_SUPERSEDED');socket.boundRoomId=route[1];this.socketFailureCount=0;this.socketFallbackUntil=0;this.connectionResult(serial,token,true,'已连接（联机原型）');if(route[2])this.battleTransportObserver?.('socket',{epoch:data?.epoch,seq:data?.seq,socketAttemptStartedAtMs:socket.attemptStartedAtMs??null});return value; }
        catch (e) {
          checkCurrent();if(this.socket!==socket)throw Error('REQUEST_SUPERSEDED');
          // The server rejected this RPC before applying it. Keep the socket
          // and its push baseline so the room can resume after backpressure.
          // Local admission rejected before send; do not retire or auth-block the
          // authenticated Socket. The ordered caller retains its unsent command.
          if(isSocketAdmissionBusy(e)||e.rpcReply&&(isBattleBackpressure(e)||e.message==='WORLD_LOADING'))throw e;
          if(!this.handleSocketFailure(e,serial,token))throw e;
          generation=this.battleGeneration||0;
        }
      }
    }
    checkCurrent();
    if (!this.available()) throw Error('SERVICE_NOT_CONFIGURED');
    let r;
    if(path==='/api/heartbeat')this.membershipHeartbeatTransport='http';
    try { r = await this.call('request', {url: this.endpoint.replace(/\/$/, '') + path, method: data === undefined ? 'GET' : 'POST', header: {...requestHeaders, 'content-type': 'application/json', ...(token ? {Authorization: 'Bearer ' + token} : {})}, data, timeout: this.timeoutMs}); }
    catch (e) { checkCurrent();this.connectionResult(serial, token, false, '连接中断 · 等待重连'); throw e; }
    checkCurrent();
    if (this.closed) throw Error('CLIENT_DISPOSED');
    if(route&&this.socketBlockedError)throw this.socketBlockedError;
    const responseRoute=this.observeRouting(r.header||r.headers);
    if(r.statusCode===403)this.recordAuthFailure({source:'http',code:r.data?.error||'HTTP_403',requestKind:path==='/api/heartbeat'?'heartbeat':/\/session$/.test(path)?'session':route?(route[2]?'input':'snapshot'):'other',status:403,httpProcess:responseRoute?.instanceTag||null});
    if (r.statusCode === 401) {
      this.recordAuthFailure({source:'http',code:r.data?.error||'HTTP_401',requestKind:path==='/api/heartbeat'?'heartbeat':/\/session$/.test(path)?'session':route?(route[2]?'input':'snapshot'):'other',status:401,httpProcess:responseRoute?.instanceTag||null,credentialDiscarded:!!token&&token===this.token&&serial>=this.connectionSerial});
      this.connectionResult(serial, token, false, '会话校验未通过');
      if (token === this.token && serial >= this.connectionSerial) this.token = null;
    } else if (token) this.connectionResult(serial, token, true, '已连接（联机原型）');
    if (r.statusCode < 200 || r.statusCode >= 300) throw Error(r.data?.error || 'SERVICE_FAILED');
    if (route) this.battleDiagnostic = {stage: route[2] ? 'input' : 'snapshot', code: 'OK', transport: this.transportKind+'-http'};
    if (route?.[2]) this.battleTransportObserver?.('http',{epoch:data?.epoch,seq:data?.seq});
    return r.data;
  }
  async login() {
    if (this.closed) throw Error('CLIENT_DISPOSED');
    if (!this.available()) throw Error('SERVICE_NOT_CONFIGURED');
    if (this.busy) return this.busy;
    this.state = '正在连接';
    this.busy = (async () => {
      try {
        // Independent operations run together: save one full cloud/mobile round trip.
        const [health, r] = await Promise.all([this.request('/api/health'), this.call('login', {})]);
        if (health?.ok !== true || health.storage !== 'memory') throw Error('CLOUD_HEALTH_INVALID');
        this.capacityPolicy=readCapacityPolicy(health);
        if (typeof r.code !== 'string' || !r.code) throw Error('LOGIN_CODE_MISSING');
        this.lobbyRules = health.lobbyRules || null;
        this.state = '云通道已通，正在验证微信身份';
        if (this.pendingInvite) this.setInvitation('authenticating');
        const session = await this.request('/api/wechat/session', {code: r.code, protocol: this.protocol, compat: this.compat});
        if (typeof session.token !== 'string' || session.verified !== true) throw Error('IDENTITY_NOT_VERIFIED');
        if (this.playerId && session.playerId !== this.playerId) { this.setRoom(null); this.joinedInvites.clear(); this.retiredInvites.clear(); }
        this.closeBattle(); this.socketBlockedError=null;this.socketFailureCount=0;this.socketFallbackUntil=0; this.connected = true; this.token = session.token; this.playerId = session.playerId;
        this.lobbyRules = session.lobbyRules || this.lobbyRules;
        this.membershipKnown = has(session, 'room');
        if (this.membershipKnown) this.setRoom(session.room);
        this.state = '已连接（联机原型）';
        if (this.pendingInvite && !this.autoInvitePromise) void this.autoJoinPending({retry: true});
        return session;
      } catch (e) { this.connected = false; this.token = null; this.state = '未连接：' + e.message; throw e; }
      finally { this.busy = null; }
    })();
    return this.busy;
  }
  confirmedLobbyRoom(room=this.room) {
    return !!(this.token&&this.connected&&this.membershipKnown&&room?.id&&room?.host&&Array.isArray(room.slots)&&room.slots.some(s=>s.kind==='human'&&s.id===this.playerId)&&room.slots.some(s=>s.kind==='human'&&s.id===room.host));
  }
  requireLobbyRoom(room=this.room) {if(!this.confirmedLobbyRoom(room))throw Error('ROOM_MEMBERSHIP_UNCONFIRMED');return room;}
  ensureLobby() {
    if (this.closed) return Promise.reject(Error('CLIENT_DISPOSED'));
    if (this.lobbyPromise) return this.lobbyPromise;
    const joinInvitation = async () => {
      if (!this.pendingInvite && !this.autoInvitePromise) return false;
      const room = await this.autoJoinPending({retry: true});
      if (!room) throw Error(this.invitationState?.error || 'INVITE_REQUIRED');
      return true;
    };
    const promise = Promise.resolve().then(async () => {
      // Entering from the home screen is one idempotent connect-and-create flow.
      // Recheck invitation ownership after every await, before any room creation.
      if (await joinInvitation()) return this.requireLobbyRoom();
      if (!this.token) await this.login();
      else {
        try { await this.refresh({fresh: true}); }
        catch (error) { if (error.message !== 'AUTH_REQUIRED') throw error; await this.login(); }
      }
      if (await joinInvitation()) return this.requireLobbyRoom();
      if (!this.membershipKnown) await this.refresh({fresh: true});
      if (await joinInvitation()) return this.requireLobbyRoom();
      if (this.closed) throw Error('CLIENT_DISPOSED');
      if (this.room) return this.requireLobbyRoom();
      this.state = '正在创建好友房间';
      return this.requireLobbyRoom(await this.createRoom());
    });
    this.lobbyPromise = promise;
    promise.finally(() => { if (this.lobbyPromise === promise) this.lobbyPromise = null; }).catch(() => {});
    return promise;
  }
  async createRoom({inviteSequence}={}) {
    if (!this.token){if(this.room)this.recordAuthFailure({source:'local',code:'LOGIN_REQUIRED',requestKind:'room-create'});throw Error('LOGIN_REQUIRED');}
    if (this.autoInvitePromise && !this.inviteMayCreate(inviteSequence) || this.writePromise) throw Error('ROOM_OPERATION_BUSY');
    this.roomVersion++;
    return this.setRoom(await this.request('/api/rooms', {}));
  }
  async joinPending() {
    if (this.closed) throw Error('CLIENT_DISPOSED');
    if (!this.token){if(this.room||this.pendingInvite)this.recordAuthFailure({source:'local',code:'LOGIN_REQUIRED',requestKind:'join'});throw Error('LOGIN_REQUIRED');}
    if (!this.pendingInvite) throw Error('INVITE_REQUIRED');
    if (this.invitationState?.code !== this.pendingInvite) { this.inviteSequence++; this.setInvitation('pending'); }
    const room = await this.autoJoinPending({retry: true});
    if (this.closed) throw Error('CLIENT_DISPOSED');
    if (!room) throw Error(this.invitationState?.error || 'INVITE_REQUIRED');
    return room;
  }
  refresh({fresh = false, duringWrite = false} = {}) {
    if (!this.token){if(this.room)this.recordAuthFailure({source:'local',code:'LOGIN_REQUIRED',requestKind:'heartbeat'});return Promise.reject(Error('LOGIN_REQUIRED'));}
    if (!fresh && this.refreshPromise) return this.refreshPromise;
    const version = this.roomVersion, token = this.token;
    const promise = (async () => {
      const started=this.battleMeasureClock?.();
      const h = await this.request('/api/heartbeat', {});
      if(this.membershipHeartbeatTransport!=='socket'){this.membershipHeartbeatTransport='http';(this.membershipHeartbeatCounts??={socket:0,http:0}).http++;}
      try{this.wx.observeHeartbeatAwaited?.(h);}catch(_){}
      if(!this.closed&&token===this.token&&this.connected&&Number.isFinite(started))this.battleHeartbeatObserver?.(this.battleMeasureClock?.()-started);
      // A successful HTTP request is not proof that an unknown member has no
      // room. Legacy reads may omit membership only if prior state is known
      // or an existing room can be confirmed with the read below.
      if(!has(h,'room')&&!has(h,'roomId')&&!this.room&&!this.membershipKnown)throw Error('ROOM_MEMBERSHIP_UNCONFIRMED');
      let room = this.room;
      if (has(h, 'room')) room = h.room;
      else if (h.roomId) room = await this.request('/api/rooms/' + encodeURIComponent(h.roomId));
      else if (has(h, 'roomId')) room = null;
      else if (room) room = await this.request('/api/rooms/' + encodeURIComponent(room.id));
      if (!this.closed && version === this.roomVersion && token === this.token && (!this.writing || duringWrite)) this.setRoom(room);
      return this.view();
    })();
    this.refreshPromise = promise;
    promise.finally(() => { if (this.refreshPromise === promise) this.refreshPromise = null; }).catch(() => {});
    return promise;
  }
  command(type, extra = {}, {isCurrent = () => true,onIntent = () => {}} = {}) {
    const roomId = this.room?.id, token = this.token, intent = {...extra};
    if (!token || !roomId) return Promise.reject(Error('ROOM_REQUIRED'));
    const run = async () => {
      if (this.closed) throw Error('CLIENT_DISPOSED');
      if (!isCurrent()) throw Error('ROOM_CHANGED_NO_ACTION');
      if (token !== this.token || roomId !== this.room?.id) throw Error('ROOM_REQUIRED');
      this.writing = true; this.roomVersion++;
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (!isCurrent()) throw Error('ROOM_CHANGED_NO_ACTION');
          if (this.closed || token !== this.token || roomId !== this.room?.id) throw Error(this.closed ? 'CLIENT_DISPOSED' : 'ROOM_REQUIRED');
          if (type === 'leave' && requiresHostHandoffUpdate(this.room, this.playerId)) throw Error('HOST_LEAVE_HANDOFF_REQUIRED');
          try {
            const payload={...intent,requestId:'wx_'+Date.now().toString(36)+'_'+(++this.serial),revision:this.room.revision,type};
            onIntent(payload);
            const r=await this.request('/api/rooms/'+encodeURIComponent(roomId),payload);
            if (token !== this.token) throw Error('AUTH_REQUIRED');
            if (roomId !== this.room?.id) throw Error('ROOM_CHANGED_NO_ACTION');
            if (!isCurrent()) throw Error('ROOM_CHANGED_NO_ACTION');
            return this.setRoom(r.closed || r.left ? null : r);
          } catch (error) {
            // Only a definitive rejection is safe to retry. Never replay an uncertain timeout.
            if (attempt === 2 || !['STALE_REVISION', 'RECONNECT_REQUIRED'].includes(error.message)) throw error;
            await this.refresh({fresh: true, duringWrite: true});
          }
        }
      } finally { this.writing = false; }
    };
    const promise = (this.writePromise || Promise.resolve()).catch(() => {}).then(run);
    this.writePromise = promise;
    promise.finally(() => { if (this.writePromise === promise) this.writePromise = null; }).catch(() => {});
    return promise;
  }
  invitationPayload() {
    if (this.closed || !this.available() || !this.connected || !this.token || !/^[A-Za-z0-9_-]{24}$/.test(this.room?.joinCode || '') || this.room.phase !== 'lobby' || !this.capacityPolicy || legacyRoom(this.room) || this.room.host!==this.playerId || !this.room.slots.some(s=>s.kind==='empty')) return null;
    return {title: '恶魔与精灵：6人联机，加入我的队伍', query: 'invite=' + encodeURIComponent(this.room.joinCode) + '&compat=' + encodeURIComponent(this.compat)};
  }
  invite() {
    const payload = this.invitationPayload();
    if (!payload) throw Error('INVITE_UNAVAILABLE');
    if (!this.wx?.shareAppMessage) throw Error('SHARE_UNSUPPORTED');
    this.wx.shareAppMessage(payload); return {status: 'share-ui-requested', joined: false};
  }
  view() { return {status: this.state, invitation: this.invitationState, canInvite: !!(this.invitationPayload() && this.wx?.shareAppMessage), combatReady: false,
    slots: (this.room?.slots || []).map(s => ({kind: s.kind, label: s.kind === 'ai' ? '电脑' : s.kind === 'empty' ? '空位' : s.name, connection: s.kind === 'human' ? s.connection : null, ready: !!s.ready}))}; }
}
module.exports = {WechatRoomClient, requiresHostHandoffUpdate};
