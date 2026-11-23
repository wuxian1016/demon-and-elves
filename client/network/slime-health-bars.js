'use strict';

// The sprite and its health bar share the same render-only offset. Store only
// geometry (not entity references); one scratch list and three batched fills.
function draw(ctx, visible, spacing, outline, rects) {
  rects.length = 0;
  for (const h of visible) {
    if (!h.waveHound || h.waveRangedTrollBN || h.waveGriffinBN || h.waveBat || h.waveStone || h.waveMammothBN || h.dead ||
        !Number.isFinite(h.hp) || !Number.isFinite(h.maxHp) || h.hp <= 0 || h.hp >= h.maxHp) continue;
    const scale = h.slimeVisualScale568(), width = 28 * scale;
    const hop = (h.slimeHop || 0) / 585, jump = hop < 1 ? Math.sin(hop * Math.PI) : 0;
    const off = spacing.offset(h);
    const x = h.x + off.x - width / 2, y = h.y + off.y - 32 * scale - jump * 12;
    const green = Math.min(width, Math.max(1, Math.round(width * h.hp / h.maxHp)));
    rects.push(x, y, width, green);
  }
  if (!rects.length) return;
  ctx.beginPath();
  for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i] - 2, rects[i + 1] - 2, rects[i + 2] + 4, 8);
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i], rects[i + 1], rects[i + 2], 4);
  ctx.fillStyle = '#3E3E3E';
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < rects.length; i += 4) ctx.rect(rects[i], rects[i + 1], rects[i + 3], 4);
  ctx.fillStyle = '#4CAF50';
  ctx.fill();
}

module.exports = { draw };
