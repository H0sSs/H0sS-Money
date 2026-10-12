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
let aiFetch = global.fetch;
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
 vm.runInNewContext(`(function(require,module,exports){${code}\n})`,{console,fetch:(...args)=>aiFetch(...args),AbortController,setTimeout,clearTimeout,FormData})(req,module,module.exports);
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
 assert.equal(validation.csvCell('  =HYPERLINK("https://evil.example")').startsWith('"\''),true);
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
const finance=load('lib/finance.ts');
test('accounts, income, transfers and debt payments keep balances consistent',async()=>{
 await db.initDB();
 const cash=(await finance.getAccounts()).find(a=>a.uid==='default-cash');const before=cash.balance;
 await finance.createAccount('بنك',100);const bank=(await finance.getAccounts()).find(a=>a.name==='بنك');
 await finance.createIncome(200,'راتب','2026-10-11',cash.id);
 const exp=await services.createExpense({amount:50,description:'مشتريات',date:'2026-10-11',accountId:cash.id});
 assert.equal(exp.account_id,cash.id);
 await finance.transferMoney(30,cash.id,bank.id,'2026-10-11');
 assert.equal((await finance.getAccounts()).find(a=>a.id===cash.id).balance,before+120);
 assert.equal((await finance.getAccounts()).find(a=>a.id===bank.id).balance,130);
 await assert.rejects(()=>finance.transferMoney(1,cash.id,cash.id,'2026-10-11'));
 await assert.rejects(()=>finance.deleteAccount(bank.id));
 await finance.createDebt('أحمد',60,'owing','تجربة');const debt=(await finance.getDebts())[0];
 await finance.payDebt(debt.id,20,'2026-10-11',cash.id);
 assert.equal((await finance.getDebts()).find(d=>d.id===debt.id).paid,20);
 await assert.rejects(()=>finance.payDebt(debt.id,41,'2026-10-11',cash.id));
 const linked=(await services.getExpenses()).find(e=>e.description==='سداد دين: أحمد');
 await assert.rejects(()=>services.deleteExpense(linked.id));
 await assert.rejects(()=>services.updateExpense(linked.id,{amount:10}));
 const payment=(await finance.getDebtPayments(debt.id))[0];await finance.deleteDebtPayment(payment.id);
 assert.equal((await finance.getAccounts()).find(a=>a.id===cash.id).balance,before+120);
 await services.deleteExpense(exp.id);await services.restoreExpense(exp);await services.restoreExpense(exp);
 assert.equal((await services.getExpenses()).filter(e=>e.uid===exp.uid).length,1);
});
test('monthly recurrence clamps end of month without drift and posting is idempotent',async()=>{
 assert.equal(finance.nextOccurrence('2024-01-31','monthly',31),'2024-02-29');
 assert.equal(finance.nextOccurrence('2024-02-29','monthly',31),'2024-03-31');
 const account=(await finance.getAccounts())[0];
 await finance.createRecurring(5,'فاتورة','2024-01-31','monthly',account.id,null);
 assert.equal(await finance.postRecurring('2024-03-31'),3);
 assert.equal(await finance.postRecurring('2024-03-31'),0);
 const r=(await finance.getRecurring())[0];assert.equal(r.next_date,'2024-04-30');
 await finance.toggleRecurring(r.id,false);assert.equal(await finance.postRecurring('2024-06-30'),0);
});
test('v3 backup preserves all financial relations, merges idempotently and rejects corrupt payments',async()=>{
 const account=(await finance.getAccounts())[0];
 await finance.createDebt('محمود',40,'owed','');let debt=(await finance.getDebts())[0];await finance.payDebt(debt.id,10,'2026-10-11',account.id);
 const file=await services.exportBackup();let json=JSON.parse(file);assert.equal(json.version,3);
 const oldCounts=Object.fromEntries(Object.entries(json.finance).map(([k,v])=>[k,v.length]));
 await services.importBackup(file,'merge');let again=JSON.parse(await services.exportBackup());for(const k in oldCounts)assert.equal(again.finance[k].length,oldCounts[k]);
 await services.importBackup(file,'replace');again=JSON.parse(await services.exportBackup());for(const k in oldCounts)assert.equal(again.finance[k].length,oldCounts[k]);
 assert.equal((await finance.getDebts()).find(d=>d.person==='محمود').paid,10);
 assert.equal((await finance.getAccounts()).find(a=>a.name==='بنك').balance,130);
 const counts=(await services.getExpenses()).length;
 json.finance.debt_payments[0].amount=999;
 await assert.rejects(()=>services.importBackup(JSON.stringify(json),'replace'));
 assert.equal((await services.getExpenses()).length,counts);
});

test('multi-item AI validation preserves every price and category and never silently drops an item',()=>{
 const categories=[{name:'أكل'},{name:'مواصلات'},{name:'تسوق'}];
 const raw=JSON.stringify({expenses:[{amount:'٢٠',description:'قهوة',categoryName:'أكل'},{amount:30,description:'تاكسي',categoryName:'مواصلات'},{amount:null,description:'خضار',categoryName:'غير موجود'}]});
 const result=ai.validateParsedExpenses(raw,'قهوة بعشرين وتاكسي بتلاتين وخضار',categories);
 assert.equal(result.length,3);assert.deepEqual(Array.from(result,r=>r.amount),[20,30,null]);assert.deepEqual(Array.from(result,r=>r.categoryName),['أكل','مواصلات',null]);
 assert.equal(result[2].description,'خضار');assert.equal(result[2].transcript,'قهوة بعشرين وتاكسي بتلاتين وخضار');
 assert.equal(ai.validateParsedExpenses('{"amount":15,"description":"شاي"}','شاي',categories).length,1);
 for(const value of [{expenses:[]},{expenses:null},{expenses:[null]},{expenses:Array.from({length:51},()=>({amount:1,description:'صنف'}))}])assert.throws(()=>ai.validateParsedExpenses(JSON.stringify(value),'نص',categories));
 assert.throws(()=>ai.validateParsedExpenses('{"expenses":[{"amount":10},','نص',categories));
});
test('Gemini, OpenAI and GLM-5 analysis all request and return multiple separate expenses',async()=>{
 const response=JSON.stringify({expenses:[{amount:20,description:'قهوة',categoryName:'أكل'},{amount:30,description:'تاكسي',categoryName:'مواصلات'},{amount:100,description:'خضار',categoryName:'تسوق'}]});
 try{
  for(const provider of ['gemini','openai','zai']){
   await ai.saveAPIKey(provider,'test-only-key');
   aiFetch=async(url,init)=>{
    const body=JSON.parse(init.body);const prompt=provider==='gemini'?body.contents[0].parts[0].text:body.messages[0].content;
    assert.ok(prompt.includes('جميع المصاريف'));assert.ok(prompt.includes('expenses'));assert.ok(prompt.includes('لا تخترع أسعارًا'));
    if(provider==='zai')assert.equal(body.model,'glm-5');
    return {ok:true,json:async()=>provider==='gemini'?{candidates:[{content:{parts:[{text:response}]}}]}:{choices:[{message:{content:response}}]}};
   };
   const result=await ai.parseTextExpense('قهوة بعشرين وتاكسي بتلاتين وخضار بمية',provider,[{name:'أكل'},{name:'مواصلات'},{name:'تسوق'}]);
   assert.deepEqual(Array.from(result,r=>r.amount),[20,30,100]);assert.equal(result.length,3);
  }
 }finally{aiFetch=global.fetch;secure.clear();}
});
test('batch expense save commits all categories and prices or rolls back the entire list',async()=>{
 await db.initDB();const cash=(await finance.getAccounts()).find(a=>a.uid==='default-cash');
 const categories=await services.getCategories();assert.ok(categories.length>=2);
 const before=(await services.getExpenses()).length;
 const result=await services.createExpenses([{amount:19.75,description:'batch-coffee',categoryId:categories[0].id,date:'2026-10-11',accountId:cash.id},{amount:7.25,description:'batch-bus',categoryId:categories[1].id,date:'2026-10-11',accountId:cash.id}]);
 assert.equal(result.length,2);assert.equal(result[0].category_id,categories[0].id);assert.equal(result[1].category_id,categories[1].id);assert.equal(result[0].amount+result[1].amount,27);assert.notEqual(result[0].uid,result[1].uid);
 assert.equal((await services.getExpenses()).length,before+2);
 await assert.rejects(()=>services.createExpenses([{amount:10,description:'must-rollback',accountId:cash.id},{amount:20,description:'bad-account',accountId:2147483647}]));
 assert.equal((await services.getExpenses()).length,before+2);assert.ok(!(await services.getExpenses()).some(e=>e.description==='must-rollback'));
 await assert.rejects(()=>services.createExpenses([{amount:10,description:'valid'},{amount:0,description:'missing price'}]));assert.equal((await services.getExpenses()).length,before+2);
 await assert.rejects(()=>services.createExpenses([]));
});

test('spending changes never invent a percentage from a zero baseline',()=>{
 assert.equal(services.expenseChangePercent(39.5,0),null);assert.equal(services.expenseChangePercent(0,0),0);assert.equal(services.expenseChangePercent(0,50),-100);assert.equal(services.expenseChangePercent(150,100),50);assert.throws(()=>services.expenseChangePercent(-1,0));
});

const errors=load('lib/aiErrors.ts');
test('quota messages distinguish minute/day/zero/billing and do not leak error text',()=>{
 const quota=(id,value)=>({error:{details:[{'@type':'type.googleapis.com/google.rpc.QuotaFailure',violations:[{quotaId:id,quotaValue:value}]},{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'21.5s'}]}});
 assert.match(errors.quotaMessage(quota('RequestsPerMinute',10)),/حد الطلبات أو الرموز في الدقيقة/);
 assert.match(errors.quotaMessage(quota('RequestsPerMinute',10)),/22 ثانية/);
 assert.match(errors.quotaMessage(quota('RequestsPerDay',1500)),/حد اليوم/);
 assert.match(errors.quotaMessage(quota('RequestsPerDay',0)),/صفر/);
 assert.match(errors.quotaMessage({error:{code:'insufficient_quota'}}),/رصيد/);
 assert.match(errors.quotaMessage({error:{message:'secret-api-key'}}),/لا يمكن تأكيد/);
 assert.ok(!errors.quotaMessage({error:{message:'secret-api-key'}}).includes('secret-api-key'));
});
test('Gemini voice extraction uses one request, preserves all items, and rejects missing transcripts',async()=>{
 await ai.saveAPIKey('gemini','test-key'); let calls=0;
 try {
  aiFetch=async(url,init)=>{calls++; const body=JSON.parse(init.body); assert.equal(body.generationConfig.responseMimeType,'application/json'); assert.ok(body.contents[0].parts.some(p=>p.inlineData)); return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({transcript:'قهوة عشرين وتاكسي ثلاثين',expenses:[{amount:20,description:'قهوة'},{amount:30,description:'تاكسي'}]})}]}}]})};};
  const result=await ai.parseVoiceExpense('AA==','m4a','gemini',[],'file:///mock','gemini');
  assert.equal(calls,1);assert.deepEqual(Array.from(result,x=>x.amount),[20,30]);assert.equal(result[1].transcript,'قهوة عشرين وتاكسي ثلاثين');
  aiFetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'{"expenses":[{"amount":20}]}'}]}}]})});
  await assert.rejects(()=>ai.parseVoiceExpense('AA==','m4a','gemini',[],'file:///mock','gemini'),/كلامًا واضحًا/);
  aiFetch=async()=>{calls++;return {ok:false,status:429,json:async()=>({error:{details:[{violations:[{quotaId:'RequestsPerMinute'}]}]}})};};calls=0;
  await assert.rejects(()=>ai.parseVoiceExpense('AA==','m4a','gemini',[],'file:///mock','gemini'),/في الدقيقة/);assert.equal(calls,1);
 } finally {aiFetch=global.fetch;secure.clear();}
});
const report=load('lib/statsReport.ts');
test('PDF report escapes descriptions, includes every operation and scoped income net',()=>{
 const html=report.buildStatsReport({start:'2026-10-01',end:'2026-10-12',label:'الشهر',currency:'EGP',days:12,logo:'data:image/png;base64,AA',font:'AA',boldFont:'AA',stats:{total:39.5,count:2,byDay:[{date:'2026-10-01',total:39.5}],byCategory:[{name:'أكل',total:39.5}]},expenses:[{date:'2026-10-01',amount:20,description:'<script>bad</script>'},{date:'2026-10-02',amount:19.5,description:'LAST-OPERATION',note:'تفاصيل'}],incomes:[{amount:100,date:'2026-10-03',description:'الراتب',account_id:1}],accounts:[{id:1,name:'نقدي'}]});
 assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!html.includes('<script>bad</script>'));assert.ok(html.includes('LAST-OPERATION'));assert.ok(html.includes('60.50'));assert.ok(html.includes('الراتب'));assert.ok(html.includes('font/ttf;base64'));assert.ok(html.includes('table-header-group'));
});
const transactions=load('lib/transactions.ts');
test('financial voice validator preserves income, expense, both debt directions and repayments without guessing uncertain types',()=>{
 const raw=JSON.stringify({transactions:[{kind:'income',amount:'١٠٠٠',description:'راتب'},{kind:'expense',amount:20,description:'قهوة',categoryName:'أكل'},{kind:'debt_owing',amount:200,description:'دين',person:'أحمد'},{kind:'debt_owed',amount:90,description:'دين',person:'سارة'},{kind:'repay',amount:50,person:'أحمد'},{kind:'collect',amount:10,person:'سارة'},{kind:'invented',amount:null,description:'غير واضح'}]});
 const result=ai.validateParsedTransactions(raw,'كل التسجيل',[{name:'أكل'}]);
 assert.deepEqual(Array.from(result,r=>r.kind),['income','expense','debt_owing','debt_owed','repay','collect','unknown']);assert.equal(result[0].amount,1000);assert.equal(result[2].person,'أحمد');assert.equal(result[6].amount,null);
 assert.throws(()=>ai.validateParsedTransactions('{"transactions":[null]}','نص',[]));assert.throws(()=>ai.validateParsedTransactions('{"transactions":[]}','نص',[]));
});
test('all six provider combinations route a mixed financial recording and Gemini keeps one request',async()=>{
 const response={transcript:'قبضت ألف واشتريت قهوة بعشرين وعليا لأحمد ميتين',transactions:[{kind:'income',amount:1000,description:'دخل'},{kind:'expense',amount:20,description:'قهوة'},{kind:'debt_owing',amount:200,description:'دين',person:'أحمد'}]};
 try{
  for(const p of ['gemini','openai','zai'])await ai.saveAPIKey(p,'mock-key');
  for(const speech of ['gemini','openai'])for(const provider of ['gemini','openai','zai']){
   let calls=0;aiFetch=async(url,init)=>{calls++;if(url.includes('/audio/transcriptions'))return{ok:true,json:async()=>({text:response.transcript})};const b=JSON.parse(init.body);
    if(speech==='gemini'&&provider!=='gemini'&&url.includes('generativelanguage'))return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:response.transcript}]}}]})};
    const prompt=provider==='gemini'?b.contents[0].parts.find(x=>x.text).text:b.messages[0].content;
    assert.ok(prompt.includes('debt_owed')&&prompt.includes('repay')&&prompt.includes('2026-10-12'));return{ok:true,json:async()=>provider==='gemini'?{candidates:[{content:{parts:[{text:JSON.stringify(response)}]}}]}:{choices:[{message:{content:JSON.stringify(response)}}]}};
   };
   const result=await ai.parseVoiceTransactions('AA==','m4a',provider,[],'file:///mock',speech,'2026-10-12');assert.deepEqual(Array.from(result,x=>x.kind),['income','expense','debt_owing']);assert.equal(calls,speech==='gemini'&&provider==='gemini'?1:2);
  }
 }finally{aiFetch=global.fetch;secure.clear();}
});
test('mixed recording commits correct tables, cents, balances and all-or-nothing debt payments',async()=>{
 const cash=(await finance.getAccounts())[0],before=cash.balance,date='2026-10-12';
 const common={date,accountId:cash.id};
 await transactions.saveTransactions([{...common,kind:'income',amount:1000,description:'mixed-salary'},{...common,kind:'expense',amount:20,description:'mixed-coffee'},{...common,kind:'debt_owing',amount:200,description:'mixed-debt',person:'mixed-person'}]);
 assert.equal((await finance.getAccounts())[0].balance,before+980);
 const debt=(await finance.getDebts()).find(d=>d.person==='mixed-person');assert.equal(debt.amount,200);
 const ledger=await transactions.getLedger({start:date,end:date,accountId:cash.id});assert.equal(ledger.income,1000);assert.equal(ledger.expense,20);assert.equal(ledger.net,980);assert.equal(ledger.count,2);
 await assert.rejects(()=>transactions.saveTransactions([{...common,kind:'income',amount:50,description:'rollback-income'},{...common,kind:'repay',amount:201,description:'bad',debtId:debt.id}]));
 assert.ok(!(await finance.getIncomes()).some(i=>i.description==='rollback-income'));assert.equal((await finance.getDebts()).find(d=>d.id===debt.id).paid,0);
 await transactions.saveTransactions([{...common,kind:'repay',amount:50,description:'سداد',debtId:debt.id}]);assert.equal((await finance.getDebts()).find(d=>d.id===debt.id).paid,50);assert.equal((await finance.getAccounts())[0].balance,before+930);
 await assert.rejects(()=>transactions.saveTransactions([{...common,kind:'collect',amount:1,description:'wrong direction',debtId:debt.id}]));
 await assert.rejects(()=>transactions.saveTransactions([{...common,kind:'unknown',amount:1,description:'unknown'}]));
 await assert.rejects(()=>transactions.saveTransactions([{...common,kind:'debt_owed',amount:1,description:'missing person'}]));
});
test('ledger pagination and date/account filters retain totals and running net across pages; transfers never count as income',async()=>{
 const cash=(await finance.getAccounts())[0],bank=(await finance.getAccounts()).find(a=>a.name==='بنك'),date='2026-10-13';
 await transactions.saveTransactions(Array.from({length:50},(_,i)=>({kind:'income',amount:.10,description:'cent-'+i,date,accountId:cash.id})));
 await transactions.saveTransactions([{kind:'expense',amount:.20,description:'cent-expense',date,accountId:cash.id},{kind:'transfer',amount:3,description:'internal transfer',date,accountId:cash.id,toAccountId:bank.id},{kind:'income',amount:7,description:'bank-income',date,accountId:bank.id}]);
 const first=await transactions.getLedger({start:date,end:date,accountId:cash.id}),second=await transactions.getLedger({start:date,end:date,accountId:cash.id,page:1});
 assert.equal(first.rows.length,50);assert.equal(second.rows.length,1);assert.equal(first.income,5);assert.equal(first.expense,.20);assert.equal(first.net,4.8);assert.equal(second.rows[0].net,4.8);assert.equal(second.count,51);assert.equal((await transactions.getLedger({start:date,end:date})).income,12);
 await assert.rejects(()=>transactions.getLedger({start:'2026-10-14',end:date}));
});
test('voice debt collection links income to its payment and deleting payment restores cash and debt',async()=>{
 const cash=(await finance.getAccounts())[0],before=cash.balance,date='2026-10-14';
 await transactions.saveTransactions([{kind:'debt_owed',amount:60,description:'دين',person:'collection-person',date,accountId:cash.id}]);
 const debt=(await finance.getDebts()).find(d=>d.person==='collection-person');
 await transactions.saveTransactions([{kind:'collect',amount:30,description:'تحصيل',debtId:debt.id,date,accountId:cash.id}]);
 assert.equal((await finance.getAccounts())[0].balance,before+30);assert.equal((await finance.getDebts()).find(d=>d.id===debt.id).paid,30);
 const income=(await finance.getIncomes()).find(i=>i.description==='تحصيل دين: collection-person');await assert.rejects(()=>finance.deleteIncome(income.id));
 const payment=(await finance.getDebtPayments(debt.id))[0];await finance.deleteDebtPayment(payment.id);assert.equal((await finance.getAccounts())[0].balance,before);assert.equal((await finance.getDebts()).find(d=>d.id===debt.id).paid,0);
});
test('financial voice notes and transfer descriptions survive migration, table display and backup/restore',async()=>{
 const cash=(await finance.getAccounts())[0],bank=(await finance.getAccounts()).find(a=>a.name==='بنك'),date='2026-10-15';
 await transactions.saveTransactions([{kind:'income',amount:1,description:'income-note-test',note:'receipt-42',date,accountId:cash.id},{kind:'transfer',amount:1,description:'transfer-description',note:'internal-note',date,accountId:cash.id,toAccountId:bank.id}]);
 assert.equal((await finance.getIncomes()).find(i=>i.description==='income-note-test').note,'receipt-42');assert.equal((await finance.getTransfers())[0].note,'internal-note');
 assert.ok((await transactions.getLedger({start:date,end:date})).rows.some(r=>r.description.includes('receipt-42')));
 const file=await services.exportBackup();await services.importBackup(file,'replace');assert.equal((await finance.getIncomes()).find(i=>i.description==='income-note-test').note,'receipt-42');assert.equal((await finance.getTransfers()).find(t=>t.description==='transfer-description').note,'internal-note');
 const legacy=JSON.parse(file);for(const i of legacy.finance.incomes)delete i.note;for(const t of legacy.finance.transfers){delete t.note;delete t.description;}await services.importBackup(JSON.stringify(legacy),'replace');assert.equal((await finance.getIncomes()).find(i=>i.description==='income-note-test').note,'');
});
