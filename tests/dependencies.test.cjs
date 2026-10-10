const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('router parses Arabic and malformed URLs with the patched CommonJS decoder', () => {
  const query = require('query-string');
  assert.equal(query.parse('category=%D8%A3%D9%83%D9%84').category, 'أكل');
  assert.equal(query.parse('x=%E0%A4%A').x, '%E0%A4%A');
  const malformed = '%E0%A4'.repeat(5000);
  assert.equal(query.parse('x=' + malformed).x, malformed);
});

test('updated build dependencies retain Metro image and Xcode UUID APIs', () => {
  const imageSize = require('image-size').default;
  const dimensions = imageSize(fs.readFileSync('assets/images/icon.png'));
  assert.equal(dimensions.width, 1024);
  assert.equal(dimensions.height, 1024);
  assert.deepEqual(imageSize('assets/images/icon.png'), dimensions);
  const uuid = require('uuid');
  assert.ok(uuid.validate(uuid.v4()));
});
