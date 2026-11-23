'use strict';

// Resizing either dimension discards the native surface. On rotation, shrink
// before growing so the intermediate surface cannot exceed either endpoint.
module.exports = function resizeCanvasBacking(canvas, width, height) {
  if (canvas.height > height) canvas.height = height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height < height) canvas.height = height;
};
