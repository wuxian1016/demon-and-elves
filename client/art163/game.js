'use strict';const env=require('../runtime');let pending=null;env.runtime.ensureMetadataBN=()=>{if(env.runtime.preparedLayout&&env.window.DRAGON_ATLAS118)return Promise.resolve();if(pending)return pending;pending=require('./chunked-metadata')(wx).then(data=>{env.window.DRAGON_ATLAS118=data.dragon;env.runtime.preparedLayout=data.layout;env.runtime.metadataLoadStatsBN=data.stats;}).catch(error=>{pending=null;throw error;});return pending;};
env.window.ghostModulesBN={ghost_startup:require('./ghost/ghost-startup'),ghost_hud_icons:require('./ghost/ghost-hud-icons'),card_art:require('./ghost/card-art-candidate'),card_ui:require('./ghost/card-native-bridge'),ghost_elf:require('./ghost/ghost-elf'),ghost_flight:require('./ghost/ghost-flight'),ghost_copy:require('./ghost/ghost-copy'),ghost_basic_fx:require('./ghost/ghost-basic-fx'),ghost_relocate:{...require('./ghost/ghost-relocate'),create:(g,o)=>require('./ghost/ghost-relocate').create(g,{...o,terrain:()=>env.window.referenceTerrain?.world,createCanvas:()=>env.document.createElement("canvas"),drawDragon:(c,t)=>env.window.woodlandArt?.character?.(c,t,2,t.visualScale||1)})},approved_guide_entry:require('./ghost/approved-guide-entry'),approved_guide_catalog:require('./ghost/approved-guide-catalog'),robot_factory_models:require('./ghost/robot-factory-models')};

env.window.monsterSpeciesLiteBN=require('./species-fallback-art')(env.Image,(im,name)=>env.runtime.readPreparedPage(im,name));

env.window.terrainEdgePrefetchBN=require('./terrain-edge-prefetch');
env.window.cardEffectHudModuleBN=require('./card-effect-hud');

env.window.soundBankCodecBN=require('./sound-bank-codec');
