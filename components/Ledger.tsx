import React,{useState} from 'react';
import {View,ScrollView,Pressable,ActivityIndicator} from 'react-native';
import {Text,TextInput} from './Typography';
import {useQuery} from '@tanstack/react-query';
import {getLedger} from '@/lib/transactions';
import {localDate,monthRange,shiftDate,parseDate} from '@/lib/dates';
import {useTheme} from '@/contexts/ThemeContext';
import type {Account} from '@/lib/finance';
export default function Ledger({accounts,currency,onIncome,onExpense}:{accounts:Account[];currency:string;onIncome:()=>void;onExpense:()=>void}){
 const {colors:c}=useTheme();const [period,setPeriod]=useState('month'),[accountId,setAccount]=useState(0),[page,setPage]=useState(0);
 const [start,setStart]=useState(monthRange().start),[end,setEnd]=useState(localDate());
 const today=localDate();let range: {start?:string;end?:string}=period==='all'?{}:period==='day'?{start:today,end:today}:period==='week'?{start:shiftDate(today,-6),end:today}:period==='custom'?{start,end}:monthRange(today);
 let error='';try{if(range.start)parseDate(range.start);if(range.end)parseDate(range.end);if(range.start&&range.end&&range.start>range.end)error='بداية الفترة بعد نهايتها';}catch{error='أدخل تاريخًا صحيحًا بصيغة YYYY-MM-DD';}
 const query=useQuery({queryKey:['ledger',period,range.start,range.end,accountId,page],queryFn:()=>getLedger({...range,accountId:accountId||undefined,page}),enabled:!error});
 const data=query.data;const text={color:c.text,textAlign:'right' as const,fontFamily:'ArabicRegular'};
 const choice=(id:string,label:string)=><Pressable key={id} accessibilityRole="button" onPress={()=>{setPeriod(id);setPage(0);}} style={{padding:12,borderWidth:1,borderRadius:12,borderColor:period===id?c.primary:c.border,backgroundColor:period===id?c.primary+'20':c.surfaceAlt}}><Text style={text}>{label}</Text></Pressable>;
 const columns=[{key:'date',label:'التاريخ',width:100},{key:'description',label:'البيان والحساب',width:200},{key:'income',label:'الإيراد',width:100},{key:'expense',label:'المصروف',width:100},{key:'net',label:'الصافي التراكمي',width:120}];
 return <View style={{gap:14}}>
  <View style={{flexDirection:'row',gap:10}}>{[['إضافة إيراد',onIncome],['إضافة مصروف',onExpense]].map(([label,fn])=><Pressable key={String(label)} accessibilityRole="button" onPress={fn as ()=>void} style={{flex:1,padding:14,borderRadius:12,backgroundColor:c.primary}}><Text style={{...text,textAlign:'center',color:c.buttonText,fontFamily:'ArabicBold'}}>{String(label)}</Text></Pressable>)}</View>
  <ScrollView horizontal contentContainerStyle={{gap:8}}>{[['day','اليوم'],['week','أسبوع'],['month','الشهر الحالي'],['all','كل الفترات'],['custom','فترة محددة']].map(([id,label])=>choice(id,label))}</ScrollView>
  {period==='custom'&&<View style={{gap:8}}>{[['من تاريخ',start,setStart],['إلى تاريخ',end,setEnd]].map(([label,value,set])=><TextInput key={String(label)} accessibilityLabel={String(label)} placeholder={String(label)+' YYYY-MM-DD'} placeholderTextColor={c.textSecondary} value={value as string} onChangeText={v=>{(set as (s:string)=>void)(v);setPage(0);}} style={{...text,padding:12,borderWidth:1,borderColor:c.border,borderRadius:12,writingDirection:'ltr'}}/>)}</View>}
  <ScrollView horizontal contentContainerStyle={{gap:8}}>{[{id:0,name:'كل الحسابات'},...accounts].map(a=><Pressable key={a.id} onPress={()=>{setAccount(a.id);setPage(0);}} style={{padding:10,borderWidth:1,borderRadius:12,borderColor:a.id===accountId?c.primary:c.border}}><Text style={text}>{a.name}</Text></Pressable>)}</ScrollView>
  {!!error&&<Text style={{...text,color:c.error}}>{error}</Text>}
  {query.isLoading?<ActivityIndicator color={c.primary}/>:query.isError?<Text style={{...text,color:c.error}}>تعذر تحميل الجدول. {query.error instanceof Error?query.error.message:''}</Text>:!error&&data&&<>
   <View style={{backgroundColor:c.surfaceAlt,padding:16,borderRadius:16,gap:8}}><Text style={{...text,color:c.success}}>الإيرادات: {data.income.toFixed(2)} {currency}</Text><Text style={{...text,color:c.error}}>المصروفات: {data.expense.toFixed(2)} {currency}</Text><Text accessibilityLabel="صافي الدخل" style={{...text,fontFamily:'ArabicBold',fontSize:24,color:data.net<0?c.error:c.primary}}>صافي الدخل: {data.net.toFixed(2)} {currency}</Text></View>
   <Text style={{...text,color:c.textSecondary}}>الصافي = الإيرادات المسجلة − المصروفات المسجلة للفترة والحساب المختارين. يشمل التحصيل والسداد المسجلين، ولا يشمل أصل الدين أو الرصيد الافتتاحي أو التحويلات بين حساباتك. حرّك الجدول أفقيًا لعرض كل الأعمدة.</Text>
   <ScrollView horizontal><View style={{width:620,borderWidth:1,borderColor:c.border,borderRadius:12,overflow:'hidden'}}>
    <View style={{flexDirection:'row',backgroundColor:c.surfaceAlt}}>{columns.map(col=><Text key={col.key} style={{...text,width:col.width,padding:10,fontFamily:'ArabicBold'}}>{col.label}</Text>)}</View>
    {data.rows.map(row=><View key={row.uid} style={{flexDirection:'row',borderTopWidth:1,borderColor:c.border,alignItems:'center'}}>{columns.map(col=><Text key={col.key} style={{...text,width:col.width,padding:10,color:col.key==='income'?c.success:col.key==='expense'?c.error:c.text,writingDirection:col.key==='description'?'auto':'ltr'}}>{col.key==='description'?row.description+'\n'+row.account:col.key==='date'?row.date:(row[col.key as 'income'|'expense'|'net']).toFixed(2)}</Text>)}</View>)}
    {!data.rows.length&&<Text style={{...text,padding:20}}>لا توجد عمليات في هذه الفترة.</Text>}
    <View style={{flexDirection:'row',borderTopWidth:2,borderColor:c.primary,backgroundColor:c.surfaceAlt}}>{['إجمالي الفترة','',data.income.toFixed(2),data.expense.toFixed(2),data.net.toFixed(2)].map((value,i)=><Text key={i} style={{...text,width:columns[i].width,padding:10,fontFamily:'ArabicBold'}}>{value}</Text>)}</View>
   </View></ScrollView>
   <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Pressable disabled={!page} onPress={()=>setPage(p=>p-1)} style={{padding:12,opacity:page?1:.4}}><Text style={text}>السابق</Text></Pressable><Text style={text}>صفحة {page+1} · {data.count} عملية</Text><Pressable disabled={(page+1)*50>=data.count} onPress={()=>setPage(p=>p+1)} style={{padding:12,opacity:(page+1)*50<data.count?1:.4}}><Text style={text}>التالي</Text></Pressable></View>
  </>}
 </View>;
}
