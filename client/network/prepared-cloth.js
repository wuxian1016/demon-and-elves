'use strict';

// Store the painted runs from each ownership mask once, in their original order.
function pack(mask) {
  if (!mask.runs) return mask;
  const { w, h, count, runs } = mask;
  let bytes = 0;
  for (const [, values] of runs) bytes += values.length;
  const samples = new Uint8Array(bytes);
  const offsets = new Uint32Array(runs.length * 2);
  let cursor = 0;
  for (let i = 0; i < runs.length; i++) {
    const [start, values] = runs[i];
    offsets[2 * i] = start;
    samples.set(values, cursor);
    cursor += values.length;
    offsets[2 * i + 1] = cursor;
  }
  return { w, h, count, offsets, samples };
}

function visit(mask, write) {
  if (!mask.offsets) {
    for (let i = 0; i < mask.alpha.length; i++) {
      if (mask.alpha[i]) write(i, mask.shade[i], mask.alpha[i]);
    }
    return;
  }
  let cursor = 0;
  for (let i = 0; i < mask.offsets.length; i += 2) {
    let pixel = mask.offsets[i];
    const end = mask.offsets[i + 1];
    for (; cursor < end; cursor += 2, pixel++) {
      write(pixel, mask.samples[cursor], mask.samples[cursor + 1]);
    }
  }
}

function paint(mask, data, rgb) {
  visit(mask, (pixel, shade, alpha) => {
    if (!alpha) return;
    const at = 4 * pixel;
    for (let k = 0; k < 3; k++) data[at + k] = Math.min(255, Math.round(rgb[k] * shade / 200));
    data[at + 3] = alpha;
  });
}

// The diagnostics sampler and art exporter expose full, randomly indexable masks.
function dense(mask) {
  if (!mask || !mask.offsets) return mask;
  const { w, h, count } = mask;
  const alpha = new Uint8Array(w * h), shade = new Uint8Array(w * h);
  visit(mask, (pixel, value, opacity) => { shade[pixel] = value; alpha[pixel] = opacity; });
  return { w, h, count, shade, alpha };
}

module.exports = { pack, paint, dense };
