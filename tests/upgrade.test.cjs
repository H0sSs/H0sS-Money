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

native.exec(`CREATE TABLE categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,icon TEXT NOT NULL,color TEXT NOT NULL,budget REAL,created_at TEXT DEFAULT (datetime('now')));CREATE TABLE expenses(id INTEGER PRIMARY KEY AUTOINCREMENT,amount REAL NOT NULL,description TEXT NOT NULL,category_id INTEGER REFERENCES categories(id),note TEXT,date TEXT NOT NULL,created_at TEXT DEFAULT (datetime('now')));CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);INSERT INTO categories(id,name,icon,color) VALUES(1,'قهوة','coffee','#123456');INSERT INTO expenses(id,amount,description,category_id,date) VALUES(5,12.5,'قديم',1,'2026-10-11');INSERT INTO settings VALUES('theme','light');PRAGMA user_version=1;`);
const databaseModule=load('lib/db.ts'),services=load('lib/services.ts'),finance=load('lib/finance.ts');
test('upgrade of an existing v1 installation preserves money, categories, preference and stable identity',async()=>{
 await databaseModule.initDB();assert.equal(native.prepare('PRAGMA user_version').get().user_version,3);
 const old=(await services.getExpenses())[0];assert.equal(old.id,5);assert.equal(old.amount,12.5);assert.equal(old.category.name,'قهوة');assert.ok(old.uid);assert.ok(old.account_id);
 assert.equal((await services.getSettings()).theme,'light');assert.equal((await finance.getAccounts())[0].balance,-12.5);
 const backup=await services.exportBackup();await services.importBackup(backup,'replace');const restored=(await services.getExpenses())[0];assert.equal(restored.uid,old.uid);assert.equal(restored.amount,12.5);assert.equal((await finance.getAccounts())[0].balance,-12.5);
});
