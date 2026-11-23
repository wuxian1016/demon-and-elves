'use strict';

// Keep ownership through the native callback, including across a background pause.
let previous = Promise.resolve();
let visibilityGate = null;
let signalForeground = null;
let active = null;
let hiddenSince = null, hiddenDuration = 0;

function foregroundNow() { return (hiddenSince ?? Date.now()) - hiddenDuration; }

function whenVisible(run) {
  return visibilityGate ? visibilityGate.then(() => whenVisible(run)) : run();
}

function setHidden(hidden) {
  if (!!visibilityGate === hidden) return;
  if (hidden) {
    hiddenSince = Date.now();
    visibilityGate = new Promise(resolve => { signalForeground = resolve; });
    active?.pause();
    return;
  }
  hiddenDuration += Math.max(0, Date.now() - hiddenSince);
  hiddenSince = null;
  const notify = signalForeground;
  visibilityGate = signalForeground = null;
  active?.resume();
  notify();
}

function readImage(image, source, timeoutMs = 10000, isCurrent) {
  const current = () => !isCurrent || isCurrent();
  const request = previous.then(() => whenVisible(() => {
    if (!current()) return null;
    return new Promise((resolve, reject) => {
      let remaining = timeoutMs;
      let startedAt, timer = null, completed = false, error = null;
      function pause() {
        if (timer === null) return;
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - Math.max(0, Date.now() - startedAt));
      }
      function deliver() {
        active = null;
        const valid = current();
        if (!valid || error) {
          try { image.src = ''; } catch (_) {}
          if (valid && error) reject(error);
          else resolve(null);
        } else resolve(image);
      }
      function resume() {
        if (completed) { deliver(); return; }
        startedAt = Date.now();
        timer = setTimeout(() => finish(Error('图片读取超时：' + source)), remaining);
      }
      function finish(cause) {
        if (completed) return;
        completed = true;
        error = cause;
        pause();
        image.onload = image.onerror = null;
        if (!visibilityGate || !current()) deliver();
      }
      active = {pause, resume, discardObsolete() { if (completed && !current()) deliver(); }};
      resume();
      image.onload = () => finish(null);
      image.onerror = cause => finish(Error('图片读取失败：' + source + ' · ' +
        String(cause?.errMsg || cause?.message || cause?.type || cause)));
      try { image.src = source; } catch (cause) { finish(cause); }
    });
  }));
  previous = request.then(() => {}, () => {});
  return request;
}
readImage.foregroundNow = foregroundNow;
readImage.setHidden = setHidden;
readImage.whenVisible = whenVisible;
readImage.discardObsolete = () => active?.discardObsolete();
module.exports = readImage;
