'use strict';
// Keep the packaged render hook compatible; the user requested no top-screen QA overlay.
// Test identity and service safeguards are retained in the client and backend.
function drawQaBadge() {}
module.exports = {drawQaBadge};
