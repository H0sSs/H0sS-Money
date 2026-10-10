const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const native = new DatabaseSync(':memory:');
let failInsert = false;
const database = {
  execAsync: async sql => native.exec(sql),
  getFirstAsync: async (sql,args=[]) => native.prepare(sql).get(...args) ?? null,
  getAllAsync: async (sql,args=[]) => native.prepare(sql).all(...args),
  runAsync: async (sql,args=[]) => { if(failInsert && sql.startsWith('INSERT INTO categories')) throw Error('disk error'); const r=native.prepare(sql).run(...args); return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }; },
  withExclusiveTransactionAsync: async fn => { native.exec('BEGIN'); try { await fn(database); native.exec('COMMIT'); } catch(e) { native.exec('ROLLBACK'); throw e; } },
};
const cache = new Map();
const secure = new Map();
const mocks = {
  'expo-file-system/legacy': {},
  'react-native': {Platform:{OS:'android'}},
  'expo-sqlite': {openDatabaseAsync:async()=>database},
  'expo-crypto': {randomUUID:crypto.randomUUID, CryptoDigestAlgorithm:{SHA256:'sha256'}, digestStringAsync:async(_,s)=>crypto.createHash('sha256').update(s).digest('hex')},
  'expo-secure-store': {getItemAsync:async k=>secure.get(k)??null,setItemAsync:async(k,v)=>secure.set(k,v)},
};
function load(file){
 file=path.resolve(file); if(cache.has(file)) return cache.get(file);
 const module={exports:{}}; cache.set(file,module.exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const req=name=>mocks[name]??(name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name));
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,fetch:global.fetch,AbortController,setTimeout,clearTimeout,FormData})(req,module,module.exports);
 cache.set(file,module.exports);return module.exports;
}
const dates=load('lib/dates.ts'), validation=load('lib/validation.ts'), db=load('lib/db.ts'), services=load('lib/services.ts'), ai=load('lib/ai.ts');
test('local calendar dates across Cairo DST, leap month, and year boundary',()=>{
 process.env.TZ='Africa/Cairo'; assert.equal(dates.localDate(new Date('2026-10-09T22:30:00Z')),'2026-10-10');
 assert.equal(dates.monthRange('2024-02-15').end,'2024-02-29');
 assert.equal(dates.shiftDate('2026-01-01',-1),'2025-12-31');
 assert.throws(()=>dates.parseDate('2026-02-30'));
});
test('Arabic amounts, CSV escaping and HTML escaping',()=>{
 assert.equal(validation.numericInput('١٢٫٥٠'),12.5); assert.equal(validation.validAmount(-2),false);
 assert.equal(validation.csvCell('قال "أهلا"'),'"قال ""أهلا"""');
 assert.equal(validation.csvCell('=SUM(A1)'),'"\'=SUM(A1)"');
 assert.equal(validation.escapeHtml('<b>&'),'&lt;b&gt;&amp;');
});
test('AI output preserves valid amounts and rejects hallucinated categories',()=>{
 const r=ai.validateParsedExpense('{"amount":"٥٠","description":"قهوة","categoryName":"غير موجود"}','قهوة بخمسين',[{name:'أكل'}]);
 assert.equal(r.amount,50); assert.equal(r.categoryName,null);
 assert.equal(ai.validateParsedExpense('{"amount":-50}','نص',[]).amount,null);
 assert.throws(()=>ai.validateParsedExpense('not json','نص',[]));
});
test('database migration, month boundaries, safe merge, deduplication, rollback and secret filtering',async()=>{
 await db.initDB();
 await database.runAsync("INSERT INTO expenses(uid,amount,description,date) VALUES(?,?,?,?)",['local-1',10,'local','2026-10-01']);
 await database.runAsync("INSERT INTO expenses(uid,amount,description,date) VALUES(?,?,?,?)",['local-2',25,'sept','2026-09-30']);
 assert.equal((await services.getStats('calendarMonth','2026-10-10')).total,10);
 const file=JSON.stringify({version:2,categories:[{id:1,name:'test',icon:'tag',color:'#123456'}],expenses:[{id:1,uid:'remote-1',amount:30,description:'other',date:'2026-10-10',category_id:1}],settings:[{key:'driveAccessToken',value:'evil'}]});
 let r=await services.importBackup(file,'merge'); assert.equal(r.expenses,1);
 r=await services.importBackup(file,'merge'); assert.equal(r.expenses,0);
 assert.equal((await services.getExpenses()).length,3);
 const before=await services.exportBackup();
 await assert.rejects(()=>services.importBackup('{"version":2,"categories":[],"expenses":[{"amount":-1}]}','replace'));
 assert.equal((await services.getExpenses()).length,3);
 failInsert=true; await assert.rejects(()=>services.importBackup(file,'replace')); failInsert=false;
 assert.equal((await services.getExpenses()).length,3);
 assert.equal(await database.getFirstAsync("SELECT * FROM settings WHERE key='driveAccessToken'"),null);
 assert.ok(before.includes('remote-1'));
 const old=JSON.stringify({version:1,categories:[],expenses:[{id:1,amount:9,description:'legacy',date:'2026-10-10'}]});
 assert.equal((await services.importBackup(old,'merge')).expenses,1); assert.equal((await services.importBackup(old,'merge')).expenses,0);
});
