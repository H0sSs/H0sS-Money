const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext('(function(module,exports){'+ts.transpileModule(fs.readFileSync('lib/typography.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+'})')(m,m.exports);
const {fontForStyle}=m.exports;
test('shared typography preserves nested weights and selects real font faces instead of synthetic bold',()=>{
 assert.equal(fontForStyle(),'ArabicRegular');
 assert.equal(fontForStyle({},'ArabicBold'),'ArabicBold');
 assert.equal(fontForStyle({fontFamily:'ArabicRegular'},'ArabicBold'),'ArabicRegular');
 assert.equal(fontForStyle({fontWeight:'500'}),'ArabicMedium');
 assert.equal(fontForStyle({fontWeight:'600',fontFamily:'ArabicRegular'}),'ArabicMedium');
 assert.equal(fontForStyle({fontWeight:'bold'}),'ArabicBold');
 assert.equal(fontForStyle({fontWeight:'normal'},'ArabicBold'),'ArabicRegular');
});
test('bundled font resources are genuine TTF assets and startup backgrounds match in both modes',()=>{
 for(const name of ['Regular','Medium','Bold']){
  const bytes=fs.readFileSync('assets/fonts/Tajawal-'+name+'.ttf');
  assert.equal(bytes.readUInt32BE(0),0x00010000);assert.ok(bytes.length>30000);
 }
 const expo=JSON.parse(fs.readFileSync('app.json','utf8')).expo;
 const splash=expo.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')[1];
 assert.equal(expo.backgroundColor,expo.splash.backgroundColor);
 assert.equal(splash.backgroundColor,splash.dark.backgroundColor);
 assert.equal(splash.backgroundColor,expo.backgroundColor);
});
