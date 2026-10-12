import { escapeHtml as e } from './validation';
import type { Expense, StatsResult, MonthCompareResult } from './services';
export type ReportData = {
  start: string; end: string; label: string; currency: string; days: number;
  stats: StatsResult; compare?: MonthCompareResult; expenses: Expense[];
  incomes: {amount:number;description:string;date:string;account_id:number}[];
  accounts: {id:number;name:string}[]; logo: string; font: string; boldFont: string;
};
export function buildStatsReport(d: ReportData): string {
  const money = (v:number) => `<bdi dir="ltr">${Number(v).toFixed(2)} <small>${e(d.currency)}</small></bdi>`;
  const income = d.incomes.reduce((sum,x)=>sum+x.amount,0);
  const account = (id?:number|null) => e(d.accounts.find(a=>a.id===id)?.name ?? '—');
  const rows = (items:string[],empty:string,cols=3) => items.join('') || `<tr><td colspan="${cols}" class="empty">${empty}</td></tr>`;
  const categoryRows = d.stats.byCategory.map(c=>`<tr><td>${e(c.name)}</td><td>${money(c.total)}</td><td>${d.stats.total>0?(c.total/d.stats.total*100).toFixed(1):'0.0'}%</td></tr>`);
  const expenses = d.expenses.map(x=>`<tr><td class="date">${e(x.date)}</td><td>${e(x.description)}</td><td>${e(x.category?.name??'غير مصنف')}</td><td>${account(x.account_id)}</td><td>${money(x.amount)}</td><td>${e(x.note??'—')}</td></tr>`);
  const incomes = d.incomes.map(x=>`<tr><td class="date">${e(x.date)}</td><td>${e(x.description)}</td><td>${account(x.account_id)}</td><td>${money(x.amount)}</td></tr>`);
  const daily = d.stats.byDay.map(x=>`<tr><td class="date">${e(x.date)}</td><td>${money(x.total)}</td></tr>`);
  const compare = d.compare;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير H0sS-Money</title><style>
  @font-face{font-family:ReportArabic;src:url(data:font/ttf;base64,${d.font})} @font-face{font-family:ReportArabic;src:url(data:font/ttf;base64,${d.boldFont});font-weight:700}
  @page{size:A4;margin:14mm 12mm 16mm} *{box-sizing:border-box} body{font-family:ReportArabic,sans-serif;color:#18333f;margin:0;font-size:10px;line-height:1.6}
  header{display:flex;align-items:center;gap:14px;border-bottom:3px solid #20aa97;padding-bottom:14px;margin-bottom:18px} header img{width:64px;height:64px;object-fit:contain} h1{font-size:24px;margin:0} .brand{color:#168b7d;font-weight:bold;direction:ltr;text-align:right;font-size:12px} .muted{color:#617580}
  .metrics{display:flex;gap:8px;margin:14px 0}.metric{flex:1;background:#f0f7f6;border:1px solid #d7e8e4;border-radius:10px;padding:12px}.value{font-size:19px;font-weight:bold;white-space:nowrap} small{font-size:9px} h2{font-size:15px;border-right:4px solid #20aa97;padding-right:9px;margin:22px 0 9px;break-after:avoid}
  table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:12px} th{background:#18333f;color:white;text-align:right;padding:8px} td{padding:7px;border-bottom:1px solid #e1e9ec;overflow-wrap:anywhere;vertical-align:top} tbody tr:nth-child(even){background:#f6f9fa} tr{break-inside:avoid} thead{display:table-header-group}.date{direction:ltr;text-align:right}.empty{color:#617580;text-align:center;padding:20px}.note{background:#f0f7f6;padding:10px;border-radius:8px} footer{break-inside:avoid;margin-top:14px;border-top:1px solid #d7e8e4;padding-top:8px;color:#617580;font-size:9px}
  </style></head><body><header><img src="${e(d.logo)}"/><div><div class="brand">H0sS · MONEY</div><h1>تقريرك المالي</h1><div>${e(d.label)}</div><div class="muted">من <bdi>${e(d.start)}</bdi> إلى <bdi>${e(d.end)}</bdi> · ${d.days} يومًا</div></div></header>
  <div class="metrics"><div class="metric">المصروفات<div class="value">${money(d.stats.total)}</div></div><div class="metric">الإيرادات<div class="value">${money(income)}</div></div><div class="metric">صافي الفترة<div class="value">${money(income-d.stats.total)}</div></div></div>
  <div class="note">${d.stats.count} عملية مصروف · المتوسط اليومي: ${money(d.stats.total/d.days)} · متوسط العملية: ${money(d.stats.count?d.stats.total/d.stats.count:0)}<br/>الصافي = إيرادات الفترة − مصروفاتها؛ لا يمثل رصيد الحسابات أو يشمل التحويلات بينها.</div>
  <h2>توزيع المصروفات على الفئات</h2><table><thead><tr><th>الفئة</th><th>الإنفاق</th><th>النسبة</th></tr></thead><tbody>${rows(categoryRows,'لا توجد مصروفات في هذه الفترة')}</tbody></table>
  ${compare?`<h2>مقارنة الأشهر التقويمية</h2><div class="note">مقارنة مستقلة عن فترة التقرير المختارة: ${e(compare.previous.month)} (${money(compare.previous.total)}) مقابل ${e(compare.current.month)} (${money(compare.current.total)}).<br/>الفرق: ${money(compare.diff)} · ${compare.diffPct===null?'لا يوجد إنفاق سابق لحساب النسبة':`${compare.diffPct.toFixed(1)}%`}</div>`:''}
  <h2>تفاصيل جميع المصروفات (${d.expenses.length})</h2><table><colgroup><col style="width:15%"/><col style="width:23%"/><col style="width:14%"/><col style="width:14%"/><col style="width:16%"/><col style="width:18%"/></colgroup><thead><tr><th>التاريخ</th><th>الوصف</th><th>الفئة</th><th>الحساب</th><th>المبلغ</th><th>ملاحظة</th></tr></thead><tbody>${rows(expenses,'لا توجد مصروفات',6)}</tbody></table>
  <h2>تفاصيل الإيرادات (${d.incomes.length})</h2><table><thead><tr><th>التاريخ</th><th>الوصف</th><th>الحساب</th><th>المبلغ</th></tr></thead><tbody>${rows(incomes,'لا توجد إيرادات',4)}</tbody></table>
  <h2>الإنفاق في الأيام التي بها عمليات</h2><table><thead><tr><th>اليوم</th><th>المبلغ</th></tr></thead><tbody>${rows(daily,'لا توجد عمليات',2)}</tbody></table>
  <footer>أُنشئ بواسطة H0sS-Money · ${e(new Date().toLocaleString('ar-EG'))} · العملة: ${e(d.currency)}<br/>التقرير يعكس البيانات المسجلة في التطبيق، ولا يحول بين العملات.</footer></body></html>`;
}
