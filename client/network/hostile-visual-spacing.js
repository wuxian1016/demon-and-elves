'use strict';
// Move only the drawn position of near-coincident bosses; gameplay still uses
// their unchanged coordinates. The demon remains the anchor when present.
const RANGE2 = 32 * 32;
const SLOTS = [[8, 3], [-8, 3], [5, -5], [-5, -5], [10, 0], [-10, 0]];
function create() {
  const offsets = new WeakMap(), counts = [];
  const empty = Object.freeze({x:0,y:0});
  let stamp = 0;
  function step(demon, stones) {
    stamp++;
    if (!stones.length) return;
    counts.length = stones.length + 1;
    counts.fill(0);
    for (let i = 0; i < stones.length; i++) {
      const s = stones[i];
      let best = -1, nearest = RANGE2;
      if (demon) {
        const d = (s.x-demon.x)**2 + (s.y-demon.y)**2;
        if (d < nearest) { best = 0; nearest = d; }
      }
      for (let j = 0; j < i; j++) {
        const b = stones[j], d = (s.x-b.x)**2 + (s.y-b.y)**2;
        if (d < nearest) { best = j+1; nearest = d; }
      }
      if (best < 0) continue;
      const slot = SLOTS[counts[best]++ % SLOTS.length], fade = 1-nearest/RANGE2;
      let shift = offsets.get(s);
      if (!shift) { shift = {x:0,y:0,stamp:0}; offsets.set(s, shift); }
      shift.x = slot[0]*fade; shift.y = slot[1]*fade; shift.stamp = stamp;
    }
  }
  function offset(u) {
    if (!u?.waveStone) return empty;
    const shift = offsets.get(u);
    return shift?.stamp === stamp ? shift : empty;
  }
  return {step,offset};
}
module.exports={create};
