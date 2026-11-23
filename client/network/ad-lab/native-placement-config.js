'use strict';
// Internal WeChat develop/trial COW only; native-host rejects release/other SDK.
// Template deliberately remains off until its actual safe rendered bounds are verified.
module.exports=Object.freeze({
 enabled:true,
 rewardId:'adunit-32a885456955dd60',
 interstitialId:'adunit-d88ec8709c1736ba',
 lobbyId:'adunit-e9b3ceb2269a8363',
 manualSaveGate:true,
 towerRecovery:true,
 vehicleHealth:v=>Math.ceil(v.maxHp/2)
});

