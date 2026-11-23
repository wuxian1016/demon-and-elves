'use strict';
const aliases = require('./prepared-file-aliases');
module.exports = function preparedPagePath(name) {
  const file = aliases[name] || name;
  const sprite = /^sprite-(\d+)\./.exec(file);
  if (!sprite) return 'art163/' + file;
  const directory = Number(sprite[1]) <= 168 ? 'match-sprites-a/' : 'match-sprites-b/';
  return directory + file;
};
