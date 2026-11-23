'use strict';
// One authoritative seat allocation: UI swatch, elf cloth and ownership flags.
// Colors are assigned by fixed room seat, never by current host/viewer or rank.
const SEAT_COLORS=Object.freeze(['#53D982','#F4CE46','#4B8FE8','#ED924D','#B07BE8','#E5ECEF','#EF7FB2','#4BD6D4','#E65D64']);
const seatColor=seat=>SEAT_COLORS[seat]||SEAT_COLORS[0];
module.exports={SEAT_COLORS,seatColor};
