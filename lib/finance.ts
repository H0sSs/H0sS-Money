import * as Crypto from 'expo-crypto';
import { db } from './db';
import { localDate, parseDate } from './dates';
import { validAmount } from './validation';

export type Account = { id: number; uid: string; name: string; opening_balance: number; balance: number };
export type Income = { id: number; uid: string; amount: number; description: string; date: string; account_id: number };
export type Debt = { id: number; uid: string; person: string; amount: number; direction: 'owed' | 'owing'; note: string; paid: number };
export type Recurring = { id: number; uid: string; amount: number; description: string; category_id: number | null; account_id: number; next_date: string; cadence: 'monthly' | 'weekly'; anchor_day: number; enabled: number };
const amount = (value: number) => { if (!validAmount(value)) throw Error('أدخل مبلغًا موجبًا صحيحًا'); };
const name = (value: string) => { if (!value.trim() || value.length > 500) throw Error('أدخل اسمًا أو وصفًا صحيحًا'); return value.trim(); };
export async function getAccounts(): Promise<Account[]> {
 return db.getAllAsync<Account>(`SELECT a.*, ROUND(a.opening_balance
  + COALESCE((SELECT SUM(amount) FROM incomes WHERE account_id=a.id),0)
  - COALESCE((SELECT SUM(amount) FROM expenses WHERE account_id=a.id OR (account_id IS NULL AND a.uid='default-cash')),0)
  + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_id=a.id),0)
  - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_id=a.id),0),2) balance FROM accounts a ORDER BY a.id`);
}
export async function createAccount(title: string, opening: number) {
 if (!Number.isFinite(opening) || Math.abs(opening)>1e12) throw Error('الرصيد الافتتاحي غير صالح');
 await db.runAsync('INSERT INTO accounts(uid,name,opening_balance) VALUES(?,?,?)',[Crypto.randomUUID(),name(title),opening]);
}
export async function renameAccount(id: number, title: string) { await db.runAsync('UPDATE accounts SET name=? WHERE id=?',[name(title),id]); }
export async function deleteAccount(id: number) {
 await db.withExclusiveTransactionAsync(async tx => {
  const a=await tx.getFirstAsync<{uid:string}>('SELECT uid FROM accounts WHERE id=?',[id]);
  if(!a || a.uid==='default-cash') throw Error('لا يمكن حذف الحساب الافتراضي');
  const used=await tx.getFirstAsync<{n:number}>(`SELECT (SELECT COUNT(*) FROM expenses WHERE account_id=?) + (SELECT COUNT(*) FROM incomes WHERE account_id=?) + (SELECT COUNT(*) FROM transfers WHERE from_id=? OR to_id=?) + (SELECT COUNT(*) FROM debt_payments WHERE account_id=?) + (SELECT COUNT(*) FROM recurring WHERE account_id=?) n`,[id,id,id,id,id,id]);
  if(used?.n) throw Error('الحساب مرتبط بعمليات؛ انقلها أو احتفظ بالحساب');
  await tx.runAsync('DELETE FROM accounts WHERE id=?',[id]);
 });
}
export async function getIncomes(): Promise<Income[]> { return db.getAllAsync<Income>('SELECT * FROM incomes ORDER BY date DESC,id DESC'); }
export async function createIncome(value: number, description: string, date: string, accountId: number) {
 amount(value);parseDate(date);
 await db.runAsync('INSERT INTO incomes(uid,amount,description,date,account_id) VALUES(?,?,?,?,?)',[Crypto.randomUUID(),value,name(description),date,accountId]);
}
export async function deleteIncome(id: number) {
 const linked=await db.getFirstAsync('SELECT p.id FROM debt_payments p JOIN incomes i ON i.uid=p.entry_uid WHERE i.id=?',[id]);
 if(linked)throw Error('هذه عملية تحصيل دين؛ احذف السداد من صفحة الديون');
 await db.runAsync('DELETE FROM incomes WHERE id=?',[id]);
}
export async function transferMoney(value:number, from:number, to:number, date:string) {
 amount(value);parseDate(date);if(from===to)throw Error('اختر حسابين مختلفين');
 await db.runAsync('INSERT INTO transfers(uid,amount,date,from_id,to_id) VALUES(?,?,?,?,?)',[Crypto.randomUUID(),value,date,from,to]);
}
export async function getDebts(): Promise<Debt[]> {
 return db.getAllAsync<Debt>('SELECT d.*,COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id=d.id),0) paid FROM debts d ORDER BY d.id DESC');
}
export async function createDebt(person:string,value:number,direction:Debt['direction'],note:string) {
 amount(value);if(!['owed','owing'].includes(direction))throw Error('نوع الدين غير صالح');
 await db.runAsync('INSERT INTO debts(uid,person,amount,direction,note) VALUES(?,?,?,?,?)',[Crypto.randomUUID(),name(person),value,direction,note.slice(0,1000)]);
}
export async function payDebt(id:number,value:number,date:string,accountId:number) {
 amount(value);parseDate(date);
 await db.withExclusiveTransactionAsync(async tx=>{
  const debt=await tx.getFirstAsync<Debt>('SELECT d.*,COALESCE((SELECT SUM(amount) FROM debt_payments WHERE debt_id=d.id),0) paid FROM debts d WHERE d.id=?',[id]);
  if(!debt || Math.round(value*100)>Math.round((debt.amount-debt.paid)*100))throw Error('المبلغ أكبر من المتبقي أو الدين غير موجود');
  if(!await tx.getFirstAsync("SELECT id FROM accounts WHERE id=?",[accountId]))throw Error("الحساب غير موجود");
  const uid=Crypto.randomUUID();
  if(debt.direction==='owing')await tx.runAsync('INSERT INTO expenses(uid,amount,description,date,account_id) VALUES(?,?,?,?,?)',[uid,value,'سداد دين: '+debt.person,date,accountId]);
  else await tx.runAsync('INSERT INTO incomes(uid,amount,description,date,account_id) VALUES(?,?,?,?,?)',[uid,value,'تحصيل دين: '+debt.person,date,accountId]);
  await tx.runAsync('INSERT INTO debt_payments(uid,debt_id,amount,date,account_id,entry_uid) VALUES(?,?,?,?,?,?)',[Crypto.randomUUID(),id,value,date,accountId,uid]);
 });
}
export async function getDebtPayments(id:number) { return db.getAllAsync<{id:number;amount:number;date:string}>('SELECT id,amount,date FROM debt_payments WHERE debt_id=? ORDER BY date DESC,id DESC',[id]); }
export async function deleteDebtPayment(id:number) {
 await db.withExclusiveTransactionAsync(async tx=>{
  const payment=await tx.getFirstAsync<{entry_uid:string}>('SELECT entry_uid FROM debt_payments WHERE id=?',[id]);if(!payment)return;
  await tx.runAsync('DELETE FROM debt_payments WHERE id=?',[id]);
  await tx.runAsync('DELETE FROM incomes WHERE uid=?',[payment.entry_uid]);
  await tx.runAsync('DELETE FROM expenses WHERE uid=?',[payment.entry_uid]);
 });
}
export async function deleteDebt(id:number) {
 const payment=await db.getFirstAsync('SELECT id FROM debt_payments WHERE debt_id=?',[id]);
 if(payment)throw Error('احذف عمليات السداد أولًا للحفاظ على الأرصدة');
 await db.runAsync('DELETE FROM debts WHERE id=?',[id]);
}
export async function getRecurring():Promise<Recurring[]> {return db.getAllAsync<Recurring>('SELECT * FROM recurring ORDER BY next_date,id');}
export async function createRecurring(value:number,description:string,date:string,cadence:Recurring['cadence'],accountId:number,categoryId:number|null) {
 amount(value);const d=parseDate(date);if(!['monthly','weekly'].includes(cadence))throw Error('فترة التكرار غير صالحة');
 await db.runAsync('INSERT INTO recurring(uid,amount,description,next_date,cadence,anchor_day,account_id,category_id) VALUES(?,?,?,?,?,?,?,?)',[Crypto.randomUUID(),value,name(description),date,cadence,d.getDate(),accountId,categoryId]);
}
export async function toggleRecurring(id:number,enabled:boolean) {await db.runAsync('UPDATE recurring SET enabled=? WHERE id=?',[enabled?1:0,id]);}
export async function deleteRecurring(id:number) {await db.runAsync('DELETE FROM recurring WHERE id=?',[id]);}
export function nextOccurrence(date:string,cadence:Recurring['cadence'],anchor:number) {
 const d=parseDate(date);if(cadence==='weekly')d.setDate(d.getDate()+7);
 else {d.setDate(1);d.setMonth(d.getMonth()+1);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(anchor,last));}
 return localDate(d);
}
// Runs only while the application is open. UID/date makes retries idempotent.
export async function postRecurring(today=localDate()) {
 parseDate(today);let added=0;
 await db.withExclusiveTransactionAsync(async tx=>{
  const rows=await tx.getAllAsync<Recurring>('SELECT * FROM recurring WHERE enabled=1 AND next_date<=?',[today]);
  for(const r of rows){let date=r.next_date,count=0;
   while(date<=today && count++<120){
    const result=await tx.runAsync('INSERT OR IGNORE INTO expenses(uid,amount,description,date,account_id,category_id) VALUES(?,?,?,?,?,?)',['recurring-'+r.uid+'-'+date,r.amount,r.description,date,r.account_id,r.category_id]);
    added+=result.changes;date=nextOccurrence(date,r.cadence,r.anchor_day);
   }
   await tx.runAsync('UPDATE recurring SET next_date=? WHERE id=?',[date,r.id]);
  }
 });return added;
}
export async function updateIncome(id:number,value:number,description:string,date:string,accountId:number) {
 amount(value);parseDate(date);
 if(await db.getFirstAsync('SELECT p.id FROM debt_payments p JOIN incomes i ON p.entry_uid=i.uid WHERE i.id=?',[id]))throw Error('عدّل تحصيل الدين من صفحة الديون');
 await db.runAsync('UPDATE incomes SET amount=?,description=?,date=?,account_id=? WHERE id=?',[value,name(description),date,accountId,id]);
}
export async function updateDebt(id:number,person:string,value:number,note:string) {
 amount(value);await db.withExclusiveTransactionAsync(async tx=>{const paid=await tx.getFirstAsync<{paid:number}>('SELECT COALESCE(SUM(amount),0) paid FROM debt_payments WHERE debt_id=?',[id]);if(Math.round(value*100)<Math.round((paid?.paid??0)*100))throw Error('الأصل أقل من المبلغ المسدد');await tx.runAsync('UPDATE debts SET person=?,amount=?,note=? WHERE id=?',[name(person),value,note.slice(0,1000),id]);});
}
export async function updateRecurring(id:number,value:number,description:string,date:string,cadence:Recurring['cadence'],accountId:number,categoryId:number|null) {
 amount(value);const d=parseDate(date);if(!['weekly','monthly'].includes(cadence))throw Error('فترة غير صالحة');
 await db.runAsync('UPDATE recurring SET amount=?,description=?,next_date=?,cadence=?,anchor_day=?,account_id=?,category_id=? WHERE id=?',[value,name(description),date,cadence,d.getDate(),accountId,categoryId,id]);
}
export async function getTransfers(){return db.getAllAsync<{id:number;amount:number;date:string;from_id:number;to_id:number}>('SELECT * FROM transfers ORDER BY date DESC,id DESC');}
export async function deleteTransfer(id:number){await db.runAsync('DELETE FROM transfers WHERE id=?',[id]);}
