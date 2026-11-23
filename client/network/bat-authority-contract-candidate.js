'use strict';
// Candidate contract only. Not imported by startup; never enables client-side multiplayer simulation.
const VERSION='bat-authority-candidate-1';
const ENTITY_FIELDS=Object.freeze(['waveBat','enemyKind','airborne','airDefenseKindBN','batStateBN','batTimeBN','batNextHitBN','batAttackStartBN','batLastHitBN','batRootBN','batGroundedBN','batNetImmuneBN','batNetVisualBN']);
const SERVER_ONLY=Object.freeze(['batCargoBN','batDeliveredBN','batDeliveriesBN','batResourceCreditsBN','batSettledBN','batWaveSerialBN','batDeliveryCycleBN','batStatsBN']);
function extendPresentation(schema){return {...schema,ENTITY_FIELDS:[...new Set([...schema.ENTITY_FIELDS,...ENTITY_FIELDS])],WORLD_FIELDS:[...schema.WORLD_FIELDS],RECORD_FIELDS:[...schema.RECORD_FIELDS]};}
function validateBuildIntent(intent){if(!intent||Object.keys(intent).some(k=>!['type','building','x','y','seq'].includes(k))||intent.type!=='build'||!['antiAirTowerBN','netTowerBN'].includes(intent.building)||!Number.isFinite(intent.x)||!Number.isFinite(intent.y)||!Number.isSafeInteger(intent.seq)||intent.seq<1)throw Error('INVALID_BAT_BUILD_INTENT');return {type:'build',building:intent.building,x:intent.x,y:intent.y,seq:intent.seq};}
function authorityReady({isServer,featureEnabled,engineHashVerified,schemaVersion,checkpointRoundtripVerified,ownerSettlementVerified}={}){return isServer===true&&featureEnabled===true&&engineHashVerified===true&&schemaVersion===VERSION&&checkpointRoundtripVerified===true&&ownerSettlementVerified===true;}
module.exports={VERSION,ENTITY_FIELDS,SERVER_ONLY,extendPresentation,validateBuildIntent,authorityReady};
