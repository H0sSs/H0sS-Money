import {db} from './db';
export async function checkDataIntegrity(){
 let result!:{issues:string[];checkedAt:string};
 await db.withExclusiveTransactionAsync(async tx=>{
  const issues:string[]=[];
  const check=await tx.getAllAsync<Record<string,string>>('PRAGMA integrity_check');
  if(check.some(r=>Object.values(r)[0]!=='ok'))issues.push('قاعدة البيانات تحتاج استعادة نسخة احتياطية سليمة');
  if((await tx.getAllAsync('PRAGMA foreign_key_check')).length)issues.push('توجد عمليات مرتبطة بحساب أو فئة أو دين مفقود');
  const links=await tx.getAllAsync(`SELECT p.id FROM debt_payments p JOIN debts d ON d.id=p.debt_id LEFT JOIN expenses e ON e.uid=p.entry_uid LEFT JOIN incomes i ON i.uid=p.entry_uid WHERE (d.direction='owing' AND (e.id IS NULL OR ROUND(e.amount*100)!=ROUND(p.amount*100) OR e.date!=p.date OR e.account_id!=p.account_id OR i.id IS NOT NULL)) OR (d.direction='owed' AND (i.id IS NULL OR ROUND(i.amount*100)!=ROUND(p.amount*100) OR i.date!=p.date OR i.account_id!=p.account_id OR e.id IS NOT NULL))`);
  if(links.length)issues.push(`${links.length} عملية سداد أو تحصيل غير متطابقة مع حركة الحساب`);
  if(await tx.getFirstAsync('SELECT d.id FROM debts d WHERE ROUND(d.amount*100)<COALESCE((SELECT SUM(ROUND(p.amount*100)) FROM debt_payments p WHERE p.debt_id=d.id),0) LIMIT 1'))issues.push('يوجد دين تجاوز مجموع سداده أصل الدين');
  if(await tx.getFirstAsync('SELECT uid FROM incomes INTERSECT SELECT uid FROM expenses'))issues.push('يوجد معرف حركة مكرر بين الإيرادات والمصروفات');
  for(const table of ['expenses','incomes','transfers','debts','debt_payments','recurring'])if(await tx.getFirstAsync(`SELECT id FROM ${table} WHERE amount<=0 OR amount>1000000000000 LIMIT 1`))issues.push(`مبالغ غير صالحة في ${table}`);
  result={issues,checkedAt:new Date().toISOString()};
 });
 return result;
}
