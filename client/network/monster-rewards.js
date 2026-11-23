'use strict';
// Apply once at the kill payout boundary. Cargo refunds, delivery and cards are separate.
module.exports=n=>Number.isFinite(n)&&n>0?Math.ceil(Math.ceil(n*6/5)*5/4):0;
