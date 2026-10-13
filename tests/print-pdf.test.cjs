const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function fixture(printToFileAsync){
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('lib/printPdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{setTimeout,clearTimeout})(()=>({printToFileAsync}),module,module.exports);
 return module.exports.printPdf;
}
test('a successful native PDF is returned without a second render',async()=>{
 let calls=0;
 const pdf=fixture(async()=>{calls++;return {uri:'file:///ok.pdf'};});
 assert.equal((await pdf({html:'report'},10)).uri,'file:///ok.pdf');
 assert.equal(calls,1);
});
test('a lost WebView gets one retry and its late result cannot replace the new PDF',async()=>{
 let calls=0,finishOld;
 const pdf=fixture(()=>++calls===1?new Promise(r=>finishOld=r):Promise.resolve({uri:'file:///retry.pdf'}));
 const result=await pdf({html:'report'},5);
 finishOld({uri:'file:///old.pdf'});
 await Promise.resolve();
 assert.equal(result.uri,'file:///retry.pdf');assert.equal(calls,2);
});
test('two lost native renders reject instead of leaving the export busy forever',async()=>{
 let calls=0;
 const pdf=fixture(()=>{calls++;return new Promise(()=>{});});
 await assert.rejects(pdf({html:'report'},5),/CSV/);
 assert.equal(calls,2);
});
