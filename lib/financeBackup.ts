import type { SQLiteDatabase } from 'expo-sqlite';
import { db } from './db';
import { validAmount } from './validation';
import { parseDate } from './dates';
const tables=['accounts','incomes','transfers','debts','debt_payments','recurring'] as const;
export async function exportFinanceBackup() {
 const result:Record<string,any[]>={};for(const table of tables)result[table]=await db.getAllAsync(`SELECT * FROM ${table}`);return result;
}
export function validateFinanceBackup(data:any) {
 if(data.version!==3)return;
 const f=data.finance;if(!f || tables.some(t=>!Array.isArray(f[t])))throw Error('البيانات المالية في النسخة غير صالحة');
 for(const t of tables){const ids=new Set(),uids=new Set();for(const r of f[t]){
  if(!Number.isSafeInteger(r.id)||r.id<=0||ids.has(r.id)||typeof r.uid!=='string'||!r.uid||uids.has(r.uid))throw Error('معرفات البيانات المالية غير صالحة');ids.add(r.id);uids.add(r.uid);
 }}
 const optionalText=(v:any,max=1000)=>{if(v!==undefined&&(typeof v!=='string'||v.length>max))throw Error('ملاحظة أو وصف مالي غير صالح');};
 for(const r of f.incomes)optionalText(r.note);for(const r of f.transfers){optionalText(r.note);optionalText(r.description,500);}
 const accounts=new Set(f.accounts.map((r:any)=>r.id)),cats=new Set(data.categories.map((r:any)=>r.id));
 const account=(id:any)=>{if(!accounts.has(id))throw Error('حساب مفقود في النسخة');};
 const text=(v:any)=>{if(typeof v!=='string'||!v.trim()||v.length>1000)throw Error('نص مالي غير صالح');};
 if(!f.accounts.some((r:any)=>r.uid==='default-cash'))throw Error('الحساب الافتراضي مفقود');
 for(const r of f.accounts){text(r.name);if(!Number.isFinite(r.opening_balance)||Math.abs(r.opening_balance)>1e12)throw Error('رصيد غير صالح');}
 for(const r of [...f.incomes,...f.transfers,...f.debts,...f.debt_payments,...f.recurring])if(!validAmount(r.amount))throw Error('مبلغ مالي غير صالح');
 for(const r of f.incomes){text(r.description);parseDate(r.date);account(r.account_id);}
 for(const r of f.transfers){account(r.from_id);account(r.to_id);parseDate(r.date);if(r.from_id===r.to_id)throw Error('تحويل غير صالح');}
 for(const r of f.debts){text(r.person);if(!['owed','owing'].includes(r.direction)||typeof r.note!=='string')throw Error('دين غير صالح');}
 const entries=new Map([...data.expenses,...f.incomes].map((e:any)=>[e.uid,e]));const entrySeen=new Set();
 for(const r of f.debt_payments){const debt=f.debts.find((d:any)=>d.id===r.debt_id);const entry:any=entries.get(r.entry_uid);
  if(!debt||!entry||entrySeen.has(r.entry_uid)||entry.amount!==r.amount||entry.date!==r.date||entry.account_id!==r.account_id||!(debt.direction==='owed'?f.incomes:data.expenses).some((e:any)=>e.uid===r.entry_uid))throw Error('ربط سداد الدين غير صالح');
  entrySeen.add(r.entry_uid);parseDate(r.date);account(r.account_id);
 }
 for(const d of f.debts)if(Math.round(f.debt_payments.filter((p:any)=>p.debt_id===d.id).reduce((s:number,p:any)=>s+p.amount,0)*100)>Math.round(d.amount*100))throw Error('سداد أكبر من الدين');
 for(const r of f.recurring){text(r.description);parseDate(r.next_date);account(r.account_id);if(!['monthly','weekly'].includes(r.cadence)||!Number.isInteger(r.anchor_day)||r.anchor_day<1||r.anchor_day>31||![0,1].includes(r.enabled)||(r.category_id!=null&&!cats.has(r.category_id)))throw Error('مصروف متكرر غير صالح');}
 for(const e of data.expenses)account(e.account_id);
}
export async function importFinanceBackup(tx:SQLiteDatabase,data:any,categories:Map<number,number>,mode:'merge'|'replace') {
 if(mode==='replace')await tx.execAsync('DELETE FROM debt_payments; DELETE FROM recurring; DELETE FROM transfers; DELETE FROM incomes; DELETE FROM debts; DELETE FROM accounts;');
 await tx.runAsync("INSERT OR IGNORE INTO accounts(uid,name) VALUES('default-cash','النقدية')");
 const f=data.version===3?data.finance:null;const accounts=new Map<number,number>();const debts=new Map<number,number>();
 if(!f)return accounts;
 for(const a of f.accounts){await tx.runAsync('INSERT OR IGNORE INTO accounts(uid,name,opening_balance) VALUES(?,?,?)',[a.uid,a.name,a.opening_balance]);const id=(await tx.getFirstAsync<{id:number}>('SELECT id FROM accounts WHERE uid=?',[a.uid]))!.id;accounts.set(a.id,id);if(mode==='replace')await tx.runAsync('UPDATE accounts SET name=?,opening_balance=? WHERE id=?',[a.name,a.opening_balance,id]);}
 for(const i of f.incomes)await tx.runAsync('INSERT OR IGNORE INTO incomes(uid,amount,description,date,account_id,note) VALUES(?,?,?,?,?,?)',[i.uid,i.amount,i.description,i.date,accounts.get(i.account_id)!,i.note??'']);
 for(const t of f.transfers)await tx.runAsync('INSERT OR IGNORE INTO transfers(uid,amount,date,from_id,to_id,description,note) VALUES(?,?,?,?,?,?,?)',[t.uid,t.amount,t.date,accounts.get(t.from_id)!,accounts.get(t.to_id)!,t.description??'',t.note??'']);
 for(const d of f.debts){await tx.runAsync('INSERT OR IGNORE INTO debts(uid,person,amount,direction,note) VALUES(?,?,?,?,?)',[d.uid,d.person,d.amount,d.direction,d.note]);debts.set(d.id,(await tx.getFirstAsync<{id:number}>('SELECT id FROM debts WHERE uid=?',[d.uid]))!.id);}
 for(const p of f.debt_payments)await tx.runAsync('INSERT OR IGNORE INTO debt_payments(uid,debt_id,amount,date,account_id,entry_uid) VALUES(?,?,?,?,?,?)',[p.uid,debts.get(p.debt_id)!,p.amount,p.date,accounts.get(p.account_id)!,p.entry_uid]);
 for(const r of f.recurring)await tx.runAsync('INSERT OR IGNORE INTO recurring(uid,amount,description,category_id,account_id,next_date,cadence,anchor_day,enabled) VALUES(?,?,?,?,?,?,?,?,?)',[r.uid,r.amount,r.description,r.category_id==null?null:categories.get(r.category_id)!,accounts.get(r.account_id)!,r.next_date,r.cadence,r.anchor_day,r.enabled]);
 const invalid=await tx.getFirstAsync('SELECT d.id FROM debts d WHERE ROUND((SELECT COALESCE(SUM(amount),0) FROM debt_payments WHERE debt_id=d.id)*100)>ROUND(d.amount*100)');if(invalid)throw Error('دمج النسخة يؤدي لسداد أكبر من الدين');
 return accounts;
}
