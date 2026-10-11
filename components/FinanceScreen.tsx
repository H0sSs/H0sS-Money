import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal, Alert, Switch, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { localDate, parseDate } from '@/lib/dates';
import { numericInput } from '@/lib/validation';
import { getCategories, getSettings, updateSetting } from '@/lib/services';
import * as F from '@/lib/finance';
import { db } from '@/lib/db';
import PageHeader from './PageHeader';
import Icon from './Icon';
const titles:Record<string,string>={accounts:'الحسابات والأرصدة',income:'الدخل',debts:'الديون والسداد',recurring:'المصاريف المتكررة'};
export default function FinanceScreen(){
 const {section='accounts'}=useLocalSearchParams<{section:string}>();const current=titles[section]?section:'accounts';
 const {colors:c}=useTheme();const insets=useSafeAreaInsets();const router=useRouter();const client=useQueryClient();
 const [form,setForm]=useState<string|null>(null),[target,setTarget]=useState<any>(null),[busy,setBusy]=useState(false);
 const [value,setValue]=useState(''),[description,setDescription]=useState(''),[date,setDate]=useState(localDate()),[note,setNote]=useState('');
 const [account,setAccount]=useState(0),[to,setTo]=useState(0),[category,setCategory]=useState<number|null>(null),[direction,setDirection]=useState<'owed'|'owing'>('owing'),[cadence,setCadence]=useState<'monthly'|'weekly'>('monthly');
 const {data:accounts=[]}=useQuery({queryKey:['accounts'],queryFn:F.getAccounts});
 const {data:transfers=[]}=useQuery({queryKey:["transfers"],queryFn:F.getTransfers});
 const {data:incomes=[],isLoading:incomeLoading}=useQuery({queryKey:['incomes'],queryFn:F.getIncomes});
 const {data:debts=[],isLoading:debtsLoading}=useQuery({queryKey:['debts'],queryFn:F.getDebts});
 const {data:recurring=[]}=useQuery({queryKey:['recurring'],queryFn:F.getRecurring});
 const {data:categories=[]}=useQuery({queryKey:['categories'],queryFn:getCategories});
 const {data:settings}=useQuery({queryKey:['settings'],queryFn:getSettings});
 const {data:auto=false}=useQuery({queryKey:['recurring-auto'],queryFn:async()=> (await db.getFirstAsync<{value:string}>("SELECT value FROM settings WHERE key='recurringAuto'"))?.value==='true'});
 const {data:payments=[]}=useQuery({queryKey:['payments',target?.id],queryFn:()=>F.getDebtPayments(target.id),enabled:form==='pay'&&!!target});
 const currency=settings?.currency??'EGP';
 const text={color:c.text,fontFamily:'ArabicRegular',textAlign:'right' as const};
 const card={backgroundColor:c.surface,borderColor:c.border,borderWidth:1,borderRadius:18,padding:16,marginBottom:12,gap:10};
 const selectedAccount=account||accounts[0]?.id;
 async function run(fn:()=>Promise<unknown>,close=true){if(busy)return;setBusy(true);try{await fn();await client.invalidateQueries();if(close)setForm(null);}catch(e){Alert.alert('تعذر الإكمال',e instanceof Error?e.message:'حاول مرة أخرى');}finally{setBusy(false);}}
 function open(kind:string,row?:any){setTarget(row??null);setValue(row?String(row.opening_balance??row.amount??''):'');setDescription(row?.name??row?.description??row?.person??'');setDate(row?.date??row?.next_date??localDate());setNote(row?.note??'');setAccount(row?.account_id??accounts[0]?.id??0);setTo(accounts[1]?.id??0);setCategory(row?.category_id??null);setDirection(row?.direction??'owing');setCadence(row?.cadence??'monthly');setForm(kind);}
 function remove(label:string,fn:()=>Promise<unknown>){Alert.alert('تأكيد الحذف',label,[{text:'إلغاء',style:'cancel'},{text:'حذف',style:'destructive',onPress:()=>run(fn,false)}]);}
 function button(label:string,press:()=>void,secondary=false){return <Pressable accessibilityRole="button" disabled={busy} onPress={press} style={{padding:12,borderRadius:12,backgroundColor:secondary?c.surfaceAlt:c.primary,borderWidth:1,borderColor:c.border,alignItems:'center',minHeight:44}}><Text style={{...text,color:secondary?c.text:c.buttonText,fontFamily:'ArabicBold'}}>{label}</Text></Pressable>;}
 function choices(items:{id:any;name:string}[],chosen:any,pick:(id:any)=>void){return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingVertical:6}}>{items.map(i=><Pressable key={i.id} onPress={()=>pick(i.id)} style={{padding:10,borderRadius:12,borderWidth:1,borderColor:chosen===i.id?c.primary:c.border,backgroundColor:chosen===i.id?c.primary+'15':c.surfaceAlt}}><Text style={{...text,color:chosen===i.id?c.primary:c.text}}>{i.name}</Text></Pressable>)}</ScrollView>;}
 function field(label:string,v:string,set:(s:string)=>void,numeric=false){return <View style={{gap:4}}><Text style={text}>{label}</Text><TextInput accessibilityLabel={label} value={v} onChangeText={set} keyboardType={numeric?'decimal-pad':'default'} autoCapitalize="none" placeholder={label} placeholderTextColor={c.textSecondary} style={{...text,backgroundColor:c.surfaceAlt,borderColor:c.border,borderWidth:1,borderRadius:12,padding:12,writingDirection:numeric?'ltr':'auto'}}/></View>;}
 async function save(){const n=numericInput(value);const a=selectedAccount;if(form!=='accounts'&&!a)throw Error('أضف حسابًا أولًا');
  if(form==='accounts'){if(target)await F.renameAccount(target.id,description);else await F.createAccount(description,n);}
  if(form==='income'){parseDate(date);if(target)await F.updateIncome(target.id,n,description,date,a);else await F.createIncome(n,description,date,a);}
  if(form==='transfer')await F.transferMoney(n,a,to,date);
  if(form==='debts'){if(target)await F.updateDebt(target.id,description,n,note);else await F.createDebt(description,n,direction,note);}
  if(form==='pay')await F.payDebt(target.id,n,date,a);
  if(form==='recurring'){if(target)await F.updateRecurring(target.id,n,description,date,cadence,a,category);else await F.createRecurring(n,description,date,cadence,a,category);}
 }
 const hints:Record<string,string>={accounts:'الرصيد = الافتتاحي + الدخل − المصروفات + صافي التحويلات. كل الحسابات تستخدم عملة العرض نفسها.',income:'سجّل دخلك واختر الحساب المستلم. الدخل منفصل عن إحصائيات المصاريف.',debts:'تسجيل أصل الدين للتتبع فقط؛ لا يغيّر الرصيد. السداد يسجّل مصروفًا أو دخلًا حسب اتجاه الدين.',recurring:'المصروفات المستحقة تُسجّل عند فتح التطبيق إذا فعّلت التلقائي. لا يوجد تنفيذ أثناء إغلاق التطبيق.'};
 return <View style={{flex:1,paddingTop:insets.top,backgroundColor:c.background}}>
  <ScrollView contentContainerStyle={{paddingBottom:insets.bottom+24}} keyboardShouldPersistTaps="handled">
   <PageHeader title={titles[current]} subtitle={hints[current]} icon="credit-card" actions={<Pressable accessibilityLabel="رجوع" onPress={()=>router.back()} style={{padding:12}}><Icon name="arrow-left" size={22} color={c.text}/></Pressable>}/>
   <View style={{paddingHorizontal:16}}>
    {button(current==='accounts'?'إضافة حساب':current==='income'?'إضافة دخل':current==='debts'?'إضافة دين':'إضافة مصروف متكرر',()=>open(current))}
    <View style={{height:14}}/>
    {current==='accounts'&&<>{button('تحويل بين الحسابات',()=>open('transfer'),true)}<View style={{height:12}}/>{accounts.map(a=><View key={a.id} style={card}><Text style={{...text,fontFamily:'ArabicBold'}}>{a.name}</Text><Text style={{...text,color:c.primary,fontSize:25,writingDirection:'ltr'}}>{a.balance.toFixed(2)} {currency}</Text><Text style={{...text,color:c.textSecondary}}>افتتاحي: {a.opening_balance.toFixed(2)}</Text><View style={{flexDirection:'row',gap:12}}>{button('تعديل الاسم',()=>open('accounts',a),true)}{a.uid!=='default-cash'&&button('حذف',()=>remove('حذف الحساب إذا لم يكن مرتبطًا بعمليات؟',()=>F.deleteAccount(a.id)),true)}</View></View>)}<Text style={{...text,fontFamily:'ArabicBold',marginBottom:12}}>التحويلات</Text>{transfers.map(t=><View key={t.id} style={card}><Text style={text}>{accounts.find(a=>a.id===t.from_id)?.name} ← {accounts.find(a=>a.id===t.to_id)?.name}</Text><Text style={text}>{t.date} · {t.amount.toFixed(2)} {currency}</Text>{button('حذف التحويل',()=>remove('حذف التحويل يعيد حساب رصيد الحسابين.',()=>F.deleteTransfer(t.id)),true)}</View>)}</>}
    {current==='income'&&<><Text style={{...text,color:c.primary,fontSize:22,marginBottom:12}}>إجمالي الدخل: {incomes.reduce((s,i)=>s+i.amount,0).toFixed(2)} {currency}</Text>{incomeLoading?<ActivityIndicator color={c.primary}/>:!incomes.length?<Text style={text}>لا يوجد دخل مسجّل. أضف أول عملية من الزر أعلاه.</Text>:incomes.map(i=><View key={i.id} style={card}><Text style={{...text,fontFamily:'ArabicBold'}}>{i.description}</Text><Text style={{...text,color:c.success}}>{i.amount.toFixed(2)} {currency}</Text><Text style={{...text,color:c.textSecondary}}>{i.date} · {accounts.find(a=>a.id===i.account_id)?.name}</Text><View style={{flexDirection:'row',gap:12}}>{button('تعديل',()=>open('income',i),true)}{button('حذف',()=>remove('حذف الدخل سيحدّث رصيد الحساب.',()=>F.deleteIncome(i.id)),true)}</View></View>)}</>}
    {current==='debts'&&<>{debtsLoading?<ActivityIndicator color={c.primary}/>:!debts.length?<Text style={text}>لا توجد ديون مسجّلة.</Text>:debts.map(d=><View key={d.id} style={card}><Text style={{...text,fontFamily:'ArabicBold'}}>{d.person} · {d.direction==='owing'?'عليك':'لك'}</Text><Text style={{...text,color:c.primary,fontSize:22}}>المتبقي: {Math.max(0,d.amount-d.paid).toFixed(2)} {currency}</Text><Text style={{...text,color:c.textSecondary}}>الأصل {d.amount.toFixed(2)} · المسدد {d.paid.toFixed(2)}</Text>{!!d.note&&<Text style={text}>{d.note}</Text>}<View style={{flexDirection:'row',gap:8}}>{button('السداد والسجل',()=>open('pay',d))}{button('تعديل',()=>open('debts',d),true)}{button('حذف',()=>remove('حذف الدين غير المسدد؟',()=>F.deleteDebt(d.id)),true)}</View></View>)}</>}
    {current==='recurring'&&<><View style={card}><Text style={text}>التسجيل التلقائي عند فتح التطبيق</Text><Switch accessibilityLabel="تفعيل التسجيل التلقائي" value={auto} onValueChange={v=>run(()=>updateSetting('recurringAuto',String(v)),false)}/><Text style={{...text,color:c.textSecondary}}>تفعيل هذا الخيار قد يسجل عدة استحقاقات فاتت. راجع تواريخ القوالب أولًا.</Text>{button('تسجيل المستحقات الآن',()=>run(async()=>{const n=await F.postRecurring();Alert.alert('تم',`سُجّلت ${n} عملية مستحقة`);},false),true)}</View>{!recurring.length?<Text style={text}>أضف اشتراكًا أو فاتورة أسبوعية أو شهرية.</Text>:recurring.map(r=><View key={r.id} style={card}><Text style={{...text,fontFamily:'ArabicBold'}}>{r.description}</Text><Text style={text}>{r.amount.toFixed(2)} {currency} · {r.cadence==='monthly'?'شهري':'أسبوعي'}</Text><Text style={{...text,color:c.textSecondary}}>الاستحقاق التالي: {r.next_date}</Text><Switch accessibilityLabel={`تفعيل ${r.description}`} value={!!r.enabled} onValueChange={v=>run(()=>F.toggleRecurring(r.id,v),false)}/><View style={{flexDirection:'row',gap:12}}>{button('تعديل',()=>open('recurring',r),true)}{button('حذف القالب',()=>remove('حذف القالب لا يحذف المصاريف السابقة.',()=>F.deleteRecurring(r.id)),true)}</View></View>)}</>}
   </View>
  </ScrollView>
  <Modal visible={!!form} animationType="slide" onRequestClose={()=>!busy&&setForm(null)}>
   <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1,backgroundColor:c.background,paddingTop:insets.top}}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,paddingBottom:insets.bottom+40,gap:14}}>
     <Text style={{...text,fontFamily:'ArabicBold',fontSize:23}}>{form==='pay'?'سداد أو تحصيل':form==='transfer'?'تحويل بين الحسابات':titles[form??'accounts']}</Text>
     {form!=='pay'&&form!=='transfer'&&field(form==='accounts'?'اسم الحساب':form==='debts'?'اسم الشخص':'الوصف',description,setDescription)}
     {!(form==='accounts'&&target)&&field(form==='accounts'?'الرصيد الافتتاحي':form==='pay'?'مبلغ السداد':'المبلغ',value,setValue,true)}
     {form!=='accounts'&&form!=='debts'&&field('التاريخ YYYY-MM-DD',date,setDate)}
     {['income','pay','transfer','recurring'].includes(form??'')&&<><Text style={text}>الحساب</Text>{choices(accounts,selectedAccount,setAccount)}</>}
     {form==='transfer'&&<><Text style={text}>الحساب المستلم</Text>{choices(accounts,to,setTo)}</>}
     {form==='debts'&&<>{!target&&choices([{id:'owing',name:'دين عليك'},{id:'owed',name:'دين لك'}],direction,setDirection)}{field('ملاحظة',note,setNote)}</>}
     {form==='recurring'&&<>{choices([{id:'monthly',name:'شهري'},{id:'weekly',name:'أسبوعي'}],cadence,setCadence)}<Text style={text}>الفئة</Text>{choices([{id:null,name:'بدون فئة'},...categories],category,setCategory)}</>}
     {form==='pay'&&<><Text style={text}>المتبقي: {target?Math.max(0,(debts.find(d=>d.id===target.id)?.amount??target.amount)-(debts.find(d=>d.id===target.id)?.paid??target.paid)).toFixed(2):'0'} {currency}</Text>{payments.map(p=><View key={p.id} style={card}><Text style={text}>{p.date} · {p.amount.toFixed(2)} {currency}</Text>{button('حذف السداد وتحديث الرصيد',()=>remove('سيُحذف أيضًا المصروف أو الدخل المرتبط.',()=>F.deleteDebtPayment(p.id)),true)}</View>)}</>}
     {busy?<ActivityIndicator color={c.primary}/>:button('حفظ',()=>run(save))}
     {button('إلغاء',()=>setForm(null),true)}
    </ScrollView>
   </KeyboardAvoidingView>
  </Modal>
 </View>;
}
