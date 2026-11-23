'use strict';
const boot=require('./startup-guard');
boot.run(wx,()=>require('./game-startup'));
