'use strict';
const {createCloudContainerWx} = require('./cloud-container-transport');
const {preconnectCloudSession}=require('./cloud-preconnect');
const {CanvasTeam} = require('./canvas-team');
const {createQaManualClient} = require('./qa-manual-client');
const {installCanvasInput} = require('./canvas-input');
const {createGestureRecovery} = require('./input-gesture-recovery');
const {installSaveBackdropGuard} = require('./save-backdrop-guard');
const {installSessionActions}=require('../session-actions');
module.exports = function install(wx, env, {enableBattlePrototype = true} = {}) {
  const resetGesture=createGestureRecovery({runtime:env.runtime,getInput:()=>env.window.originalNetwork627?.input});
  const gate = installCanvasInput(wx,{resetGesture,freezeTrace:env.runtime.freezeTrace}), previous = env.runtime.attach;
  const priorityInput=(kind,event)=>{const boot=env.runtime.startupInput627;if(!boot?.active())return false;try{boot.touch?.(kind,event);}catch(_){}if(kind==='end')boot.end(event);return true;};
  gate.priorityInput=priorityInput;
  let controller = null, battle = null, backdropGuard = null, sessionActions = null;
  function attach(game) {
    previous.call(this, game);
    battle?.dispose(); controller?.dispose();backdropGuard?.dispose();sessionActions?.dispose();
    sessionActions=installSessionActions({game,runtime:env.runtime,wx,onInvalidate:()=>controller?.exitConfirming?.cancel()});
    backdropGuard=installSaveBackdropGuard(game);
    const room = createQaManualClient(wx);
    const team = controller = new CanvasTeam({game, runtime: env.runtime, wx, client: room, gate});
    void preconnectCloudSession(room);
    battle = null;
    function matchForRoom() {
      if (team.dead || controller !== team) throw Error('BATTLE_UNAVAILABLE');
      if (battle) return battle;
      const {FullGameClient} = require('./full-game-client');
      const {FullGameBattle} = require('./full-game-battle');
      const authority = new FullGameClient(room, {enabled: enableBattlePrototype, requireLoadingBarrier: true});
      const match = new FullGameBattle({game, cooperativePresentation: true, runtime: env.runtime, hooks: env.window.originalNetwork627, art: env.window.woodlandArt, topology: env.window.referenceTerrain, monotonic: typeof env.performance?.now === 'function' ? () => env.performance.now() : undefined, wx, gate, team, client: authority});
      battle = match;
      return match;
    }
    team.battleEnabled = enableBattlePrototype;
    team.nextRound=()=>matchForRoom().nextRound();
    team.startBattle = async () => {
      if (team.dead || !team.home() || !team.allowed('start')) throw Error('BATTLE_UNAVAILABLE');
      // AuthoritativeClient refreshes membership before choosing POST /battle/start
      // (host/all-ready only) or GET /battle (already-started match, any member).
      // Prepare the online shim before the asynchronous art barrier; the first playable frame stays synchronous-load free.
      const match = matchForRoom();
      await env.runtime.ensureMatchArtsBN?.();
      if (team.dead || !team.home() || !team.allowed('start')) throw Error('BATTLE_UNAVAILABLE');
      await match.start();
      if (team.dead) { match.dispose(); return; }

    };
  }
  env.runtime.attach = attach;
  return {get controller() {return controller;}, get battle() {return battle;}, dispose() {
    battle?.dispose(); controller?.dispose();backdropGuard?.dispose();backdropGuard=null;sessionActions?.dispose();sessionActions=null;
    if(gate.resetGesture===resetGesture)gate.resetGesture=null;
    if(gate.priorityInput===priorityInput)gate.priorityInput=null;
    if (env.runtime.attach === attach) env.runtime.attach = previous;
  }};
};
