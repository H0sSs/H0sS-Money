import * as Crypto from 'expo-crypto';
import { db } from './db';
import { localDate, parseDate } from './dates';
import { validAmount } from './validation';

export const transactionKinds = ['expense','income','debt_owed','debt_owing','repay','collect','transfer','unknown'] as const;
export type TransactionKind = typeof transactionKinds[number];
export const transactionLabels: Record<TransactionKind,string> = {expense:'مصروف',income:'إيراد',debt_owed:'دين لك',debt_owing:'دين عليك',repay:'سداد دين عليك',collect:'تحصيل دين لك',transfer:'تحويل بين حساباتك',unknown:'يحتاج تحديد النوع'};
export type TransactionInput = {kind:TransactionKind;amount:number;description:string;date:string;accountId:number;categoryId?:number|null;note?:string|null;person?:string;debtId?:number|null;toAccountId?:number|null};
const cents=(n:number)=>Math.round(n*100);
// One transaction for the whole recording: no partial income/expense/debt saves.
export async function saveTransactions(items:TransactionInput[]) {
 if(!Array.isArray(items)||!items.length||items.length>50)throw Error('أضف من 1 إلى 50 عملية');
 for(const [i,x] of items.entries()) {
  if(!transactionKinds.includes(x.kind)||x.kind==='unknown')throw Error(`حدد نوع العملية ${i+1}`);
  if(!validAmount(x.amount)||!x.description.trim()||x.description.length>500||(x.note?.length??0)>1000)throw Error(`راجع مبلغ ووصف العملية ${i+1}`);
  parseDate(x.date);
  if((x.kind==='debt_owed'||x.kind==='debt_owing')&&!x.person?.trim())throw Error(`أدخل اسم صاحب الدين في العملية ${i+1}`);
 }
 const saved: {table:string;row:Record<string,any>}[]=[];
 const notifications:{amount:number;date:string;category_id:number|null}[]=[];
 await db.withExclusiveTransactionAsync(async tx=>{
  const before:Record<string,number>={};
  for(const table of undoTables)before[table]=(await tx.getFirstAsync<{id:number}>(`SELECT COALESCE(MAX(id),0) id FROM ${table}`))!.id;
  for(const x of items){
   const value=cents(x.amount)/100;
   if(!validAmount(value))throw Error('المبلغ أقل من أصغر وحدة للعملة');
   if(!await tx.getFirstAsync('SELECT id FROM accounts WHERE id=?',[x.accountId]))throw Error('الحساب غير موجود؛ لم تُحفظ القائمة');
   const uid=Crypto.randomUUID(),description=x.description.trim(),note=x.note?.slice(0,1000)??null;
   if(x.kind==='expense'){
    if(x.categoryId!=null&&!await tx.getFirstAsync('SELECT id FROM categories WHERE id=?',[x.categoryId]))throw Error('الفئة غير موجودة');
    await tx.runAsync('INSERT INTO expenses(uid,amount,description,date,account_id,category_id,note) VALUES(?,?,?,?,?,?,?)',[uid,value,description,x.date,x.accountId,x.categoryId??null,note]);
    notifications.push({amount:value,date:x.date,category_id:x.categoryId??null});
   }else if(x.kind==='income')await tx.runAsync('INSERT INTO incomes(uid,amount,description,date,account_id,note) VALUES(?,?,?,?,?,?)',[uid,value,description,x.date,x.accountId,note??'']);
   else if(x.kind==='debt_owed'||x.kind==='debt_owing'){const details=[description,note].filter(Boolean).join(' — ');if(details.length>1000)throw Error('وصف وملاحظة الدين أطول من 1000 حرف؛ اختصرهما');await tx.runAsync('INSERT INTO debts(uid,person,amount,direction,note) VALUES(?,?,?,?,?)',[uid,x.person!.trim().slice(0,500),value,x.kind==='debt_owed'?'owed':'owing',details]);}
   else if(x.kind==='transfer'){
    if(x.accountId===x.toAccountId||!x.toAccountId||!await tx.getFirstAsync('SELECT id FROM accounts WHERE id=?',[x.toAccountId]))throw Error('اختر حسابًا مستلمًا مختلفًا للتحويل');
    await tx.runAsync('INSERT INTO transfers(uid,amount,date,from_id,to_id,description,note) VALUES(?,?,?,?,?,?,?)',[uid,value,x.date,x.accountId,x.toAccountId,description,note??'']);
   }else{
    const debt=await tx.getFirstAsync<{id:number;person:string;direction:string;remaining:number}>('SELECT d.*, ROUND(d.amount*100)-COALESCE((SELECT SUM(ROUND(p.amount*100)) FROM debt_payments p WHERE p.debt_id=d.id),0) remaining FROM debts d WHERE d.id=?',[x.debtId??-1]);
    if(!debt||debt.direction!==(x.kind==='repay'?'owing':'owed'))throw Error('اختر الدين الصحيح للسداد أو التحصيل');
    if(cents(value)>debt.remaining)throw Error('مبلغ السداد أكبر من المتبقي؛ لم تُحفظ القائمة');
    const details=[description,note].filter(Boolean).join(' — ');if(details.length>1000)throw Error('وصف وملاحظة السداد أطول من 1000 حرف؛ اختصرهما');
    if(x.kind==='repay'){
     await tx.runAsync('INSERT INTO expenses(uid,amount,description,date,account_id,note) VALUES(?,?,?,?,?,?)',[uid,value,'سداد دين: '+debt.person,x.date,x.accountId,details]);
     notifications.push({amount:value,date:x.date,category_id:null});
    }else await tx.runAsync('INSERT INTO incomes(uid,amount,description,date,account_id,note) VALUES(?,?,?,?,?,?)',[uid,value,'تحصيل دين: '+debt.person,x.date,x.accountId,details]);
    await tx.runAsync('INSERT INTO debt_payments(uid,debt_id,amount,date,account_id,entry_uid) VALUES(?,?,?,?,?,?)',[Crypto.randomUUID(),debt.id,value,x.date,x.accountId,uid]);
   }
  }
  for(const table of undoTables)for(const row of await tx.getAllAsync<Record<string,any>>(`SELECT * FROM ${table} WHERE id>?`,[before[table]]))saved.push({table,row});
  await tx.runAsync('INSERT OR REPLACE INTO transaction_undo(id,payload,created_at) VALUES(1,?,?)',[JSON.stringify(saved),new Date().toISOString()]);
 });
 // Budget notifications only after successful commit.
 if(notifications.length)import('./notifications').then(async m=>{for(const x of notifications)await m.checkAndNotify(x);}).catch(()=>{});
}

export type LedgerFilter={start?:string;end?:string;accountId?:number;page?:number};
export type LedgerRow={uid:string;date:string;description:string;account:string;income:number;expense:number;net:number;kind:string};
export async function getLedger(filter:LedgerFilter={}) {
 if(filter.start)parseDate(filter.start);if(filter.end)parseDate(filter.end);
 if(filter.start&&filter.end&&filter.start>filter.end)throw Error('بداية الفترة بعد نهايتها');
 const conditions:string[]=[],args:(string|number)[]=[];
 if(filter.start){conditions.push('date>=?');args.push(filter.start);}if(filter.end){conditions.push('date<=?');args.push(filter.end);}if(filter.accountId){conditions.push('account_id=?');args.push(filter.accountId);}
 const where=conditions.length?'WHERE '+conditions.join(' AND '):'';
 const cte=`WITH entries AS (
  SELECT i.uid,i.date,i.description||CASE WHEN COALESCE(i.note,'')!='' THEN char(10)||i.note ELSE '' END description,i.account_id,ROUND(i.amount*100) incoming,0 outgoing,CASE WHEN EXISTS(SELECT 1 FROM debt_payments p WHERE p.entry_uid=i.uid) THEN 'collect' ELSE 'income' END kind FROM incomes i
  UNION ALL SELECT e.uid,e.date,e.description||CASE WHEN COALESCE(e.note,'')!='' THEN char(10)||e.note ELSE '' END,COALESCE(e.account_id,(SELECT id FROM accounts WHERE uid='default-cash')),0,ROUND(e.amount*100),CASE WHEN EXISTS(SELECT 1 FROM debt_payments p WHERE p.entry_uid=e.uid) THEN 'repay' ELSE 'expense' END FROM expenses e
 ), filtered AS (SELECT * FROM entries ${where})`;
 const totals=await db.getFirstAsync<{income:number;expense:number;count:number}>(cte+' SELECT COALESCE(SUM(incoming),0)/100.0 income,COALESCE(SUM(outgoing),0)/100.0 expense,COUNT(*) count FROM filtered',args);
 const page=Math.max(0,Math.floor(filter.page??0));
 const rows=await db.getAllAsync<LedgerRow>(cte+`, running AS (SELECT *,SUM(incoming-outgoing) OVER(ORDER BY date,uid ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)/100.0 net FROM filtered) SELECT r.uid,r.date,r.description,a.name account,r.incoming/100.0 income,r.outgoing/100.0 expense,r.net,r.kind FROM running r LEFT JOIN accounts a ON a.id=r.account_id ORDER BY r.date,r.uid LIMIT 50 OFFSET ?`,[...args,page*50]);
 return {rows,income:totals?.income??0,expense:totals?.expense??0,net:cents((totals?.income??0)-(totals?.expense??0))/100,count:totals?.count??0,page};
}

const undoTables=['expenses','incomes','debts','debt_payments','transfers'] as const;
export async function getLastRecording() { return db.getFirstAsync<{created_at:string;payload:string}>('SELECT * FROM transaction_undo WHERE id=1'); }
export async function undoLastRecording(){
 await db.withExclusiveTransactionAsync(async tx=>{
  const batch=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM transaction_undo WHERE id=1');
  if(!batch)throw Error('لا توجد قائمة محفوظة من الرئيسية للتراجع عنها');
  const entries:{table:string;row:Record<string,any>}[]=JSON.parse(batch.payload);
  for(const x of entries){
   if(!undoTables.includes(x.table as any))throw Error('سجل التراجع غير صالح');
   const current=await tx.getFirstAsync<Record<string,any>>(`SELECT * FROM ${x.table} WHERE uid=?`,[x.row.uid]);
   if(!current||Object.keys(x.row).some(k=>current[k]!==x.row[k]))throw Error('تم تعديل أو حذف بعض العمليات؛ التراجع متوقف لحماية بياناتك');
   if(x.table==='debts'){
    const payments=await tx.getAllAsync<{uid:string}>('SELECT uid FROM debt_payments WHERE debt_id=?',[x.row.id]);
    if(payments.some(p=>!entries.some(e=>e.table==='debt_payments'&&e.row.uid===p.uid)))throw Error('تم سداد هذا الدين بعد التسجيل؛ احذف السداد أولًا');
   }
  }
  for(const table of ['debt_payments','expenses','incomes','transfers','debts'])for(const x of entries.filter(e=>e.table===table))await tx.runAsync(`DELETE FROM ${table} WHERE uid=?`,[x.row.uid]);
  await tx.runAsync('DELETE FROM transaction_undo');
 });
}
export async function findSimilarTransactions(items:TransactionInput[]):Promise<string[]>{
 const warnings:string[]=[];
 for(const [i,x] of items.entries()){
  const previous=items.slice(0,i).some(y=>y.kind===x.kind&&cents(y.amount)===cents(x.amount)&&y.date===x.date&&y.accountId===x.accountId&&y.description.trim()===x.description.trim()&&y.person===x.person&&y.debtId===x.debtId&&y.toAccountId===x.toAccountId);
  const table=x.kind==='income'?'incomes':x.kind==='expense'?'expenses':null;
  const match=table?await db.getFirstAsync(`SELECT id FROM ${table} WHERE ROUND(amount*100)=? AND date=? AND account_id=? AND trim(description)=? LIMIT 1`,[cents(x.amount),x.date,x.accountId,x.description.trim()]):null;
  if(previous||match)warnings.push(`العملية ${i+1}: ${x.description} (${x.amount.toFixed(2)}) تشبه عملية ${previous?'في نفس القائمة':'مسجلة بالفعل'}`);
 }
 return warnings;
}
