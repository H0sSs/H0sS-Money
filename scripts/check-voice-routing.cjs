const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const cache = new Map();
let calls = [];
const transcript = 'قهوة بعشرين وتاكسي بتلاتين وخضار بمية';
const expenses = [
  { amount: 20, description: 'قهوة', categoryName: 'أكل' },
  { amount: 30, description: 'تاكسي', categoryName: 'مواصلات' },
  { amount: 100, description: 'خضار', categoryName: 'تسوق' },
];
async function fetchMock(url, init) {
  calls.push(url);
  let text = JSON.stringify({ expenses });
  if (url.includes('/audio/transcriptions')) {
    return { ok: true, json: async () => ({ text: transcript }) };
  }
  if (url.includes('generativelanguage')) {
    const body = JSON.parse(init.body);
    if (body.contents[0].parts.some(p => p.inlineData)) text = transcript;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
  }
  return { ok: true, json: async () => ({ choices: [{ message: { content: text } }] }) };
}
function loadModule(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext('(function(require,module,exports){' + code + '\n})', {
    fetch: fetchMock, AbortController, setTimeout, clearTimeout, FormData,
  })(name => name === 'expo-secure-store'
    ? { getItemAsync: async () => 'mock-key' }
    : loadModule(path.resolve(path.dirname(file), name + '.ts')), module, module.exports);
  cache.set(file, module.exports);
  return module.exports;
}
(async () => {
  const ai = loadModule(path.join(root, 'lib/ai.ts'));
  for (const speech of ['gemini', 'openai']) {
    for (const provider of ['gemini', 'openai', 'zai']) {
      calls = [];
      const result = await ai.parseVoiceExpense(
        'AA==', 'm4a', provider,
        [{ name: 'أكل' }, { name: 'مواصلات' }, { name: 'تسوق' }],
        'file:///mock.m4a', speech,
      );
      assert.deepEqual(Array.from(result, r => r.amount), [20, 30, 100]);
      assert.deepEqual(Array.from(result, r => r.categoryName), ['أكل', 'مواصلات', 'تسوق']);
      assert.equal(result.length, 3);
      assert.equal(calls.length, 2);
      assert.equal(result[2].transcript, transcript);
      console.log('PASS mocked speech ' + speech + ' -> analysis ' + provider + ': all 3 items');
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
