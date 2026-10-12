const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function fixture(uri){
 const copies=[],reads=[];
 const assets={fromModule:n=>({localUri:uri(n),hash:String(n),name:String(n),type:n===1?'png':'ttf',downloadAsync:async()=>{}})};
 const files={cacheDirectory:'file:///cache/',EncodingType:{Base64:'base64'},copyAsync:async x=>copies.push(x),readAsStringAsync:async u=>{reads.push(u);if(!u.startsWith('file:'))throw Error('Unsupported scheme');return 'AQID';}};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('lib/reportAssets.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{})(n=>n==='expo-asset'?{Asset:assets}:n==='expo-file-system/legacy'?files:n.endsWith('.png')?1:n.includes('Regular')?2:3,module,module.exports);
 return {api:module.exports,copies,reads};
}
test('release drawable/raw resources are copied to readable files before Base64 encoding',async()=>{
 const f=fixture(n=>'assets_resource_'+n);const r=await f.api.reportAssets();assert.equal(f.copies.length,3);assert.ok(f.reads.every(u=>u.startsWith('file:///cache/')));assert.equal(r.logo,'data:image/png;base64,AQID');assert.equal(r.font,'AQID');
});
test('file assets do not require copying and a custom image is embedded',async()=>{
 const f=fixture(n=>'file:///assets/'+n);const r=await f.api.reportAssets('data:image/jpeg;base64,AQID');assert.equal(f.copies.length,0);assert.equal(r.logo,'data:image/jpeg;base64,AQID');
});
