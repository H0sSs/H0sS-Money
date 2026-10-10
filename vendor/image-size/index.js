// Metro 0.83 passes either a file path or a Buffer. The patched v2 parser
// accepts bytes only; keep Metro's synchronous path API at this boundary.
const fs = require('node:fs');
const core = require('image-size-core');
function imageSize(input) {
  return core.imageSize(typeof input === 'string' ? fs.readFileSync(input) : input);
}
module.exports = imageSize;
module.exports.default = imageSize;
module.exports.imageSize = imageSize;
module.exports.disableTypes = core.disableTypes;
module.exports.types = core.types;
