import { Text, TextInput } from "@/components/Typography";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAccounts, getDebts } from '@/lib/finance';
import { localDate, parseDate } from '@/lib/dates';
import { numericInput, validAmount } from '@/lib/validation';
import type { ParsedTransaction } from '@/lib/ai';
import {findSimilarTransactions,transactionKinds,transactionLabels,type TransactionKind,type TransactionInput} from '@/lib/transactions';

type Category = { id: number; name: string; color: string };
type Draft = {kind:TransactionKind;person:string;debtId:number|null;toAccountId:number|null; amount: string; description: string; note: string; categoryId: number | null; date: string; accountId: number };
type Props = { visible: boolean; parsed: ParsedTransaction[] | null; categories: Category[]; saving: boolean; colors: any; onCancel: () => void; onSave: (items: TransactionInput[]) => void };

export default function ExpenseReview({ visible, parsed, categories, saving, colors: c, onCancel, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Draft[]>([]);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const { data: debts = [] } = useQuery({queryKey:['debts'],queryFn:getDebts});
  const matchingDebt=(item:Draft)=>{const matches=debts.filter(d=>d.direction===(item.kind==='repay'?'owing':'owed')&&d.amount>d.paid&&d.person.trim()===item.person.trim());return item.debtId??(matches.length===1?matches[0].id:null);};
  useEffect(() => {
    setItems((parsed ?? []).map(item => ({kind:item.kind,person:item.person??'',debtId:null,toAccountId:null, amount: item.amount == null ? '' : String(item.amount), description: item.description, note: item.note ?? '', categoryId: categories.find(cat => cat.name === item.categoryName)?.id ?? null, date: item.date??localDate(), accountId: 0 })));
  }, [parsed]);
  const patch = (index: number, data: Partial<Draft>) => setItems(previous => previous.map((item, i) => i === index ? { ...item, ...data } : item));
  const text = { color: c.text, fontFamily: 'ArabicRegular', textAlign: 'right' as const };
  const input = { ...text, backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 };
  const label = { ...text, color: c.textSecondary, marginBottom: 6 };
  const subtotal=(kind:TransactionKind)=>items.filter(x=>x.kind===kind).reduce((sum,x)=>sum+(validAmount(numericInput(x.amount))?Math.round(numericInput(x.amount)*100):0),0)/100;
  const income=subtotal('income')+subtotal('collect'),expense=subtotal('expense')+subtotal('repay');
  const [checking,setChecking]=useState(false);
  async function save() {
    if (saving||checking) return;
    setChecking(true);
    try {
      if (!items.length) throw new Error('أضف صنفًا واحدًا على الأقل');
      const data = items.map((item, i) => {
        const amount = numericInput(item.amount);
        if (!validAmount(amount) || !item.description.trim()) throw new Error(`أكمل المبلغ والوصف للصنف ${i + 1}`);
        parseDate(item.date);
        const accountId = item.accountId || accounts[0]?.id;
        if (!accountId) throw new Error('الحساب غير متاح بعد؛ حاول مرة أخرى');
        if(item.kind==='unknown')throw Error(`حدد نوع العملية ${i+1}`);
        if(['debt_owed','debt_owing'].includes(item.kind)&&!item.person.trim())throw Error(`أدخل اسم الشخص للعملية ${i+1}`);
        if(['repay','collect'].includes(item.kind)&&!matchingDebt(item))throw Error(`اختر الدين للعملية ${i+1}`);
        if(item.kind==='transfer'&&(!item.toAccountId||item.toAccountId===accountId))throw Error(`اختر حسابًا مستلمًا مختلفًا للعملية ${i+1}`);
        return {kind:item.kind,person:item.person.trim(),debtId:matchingDebt(item),toAccountId:item.toAccountId, amount, description: item.description.trim(), note: item.note.trim() || null, categoryId: item.categoryId, date: item.date, accountId };
      });
      const warnings=await findSimilarTransactions(data);
      if(warnings.length)Alert.alert('عمليات متشابهة',warnings.join('\n')+'\nراجع القائمة؛ يمكنك حفظها إذا كانت عمليات مختلفة فعلًا.',[{text:'مراجعة',style:'cancel'},{text:'حفظ رغم التشابه',onPress:()=>onSave(data)}]);
      else onSave(data);
    } catch (error) { Alert.alert('راجع العمليات', error instanceof Error ? error.message : 'أكمل البيانات'); } finally {setChecking(false);}
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!saving) onCancel(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '90%' }} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom, backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <Text style={{ ...text, fontFamily: 'ArabicBold', fontSize: 22, marginBottom: 12 }}>مراجعة العمليات — {items.length} صنف</Text>
        {!!parsed?.[0]?.transcript && <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt, marginBottom: 16 }}>
          <Text style={{ ...label, fontFamily: 'ArabicBold' }}>النص المسموع</Text><Text style={text}>{parsed[0].transcript}</Text>
          <Text style={{ ...label, marginTop: 8 }}>راجع أن كل ما قلته موجود. يمكنك تعديل كل صنف أو حذفه أو إضافة صنف مفقود.</Text>
        </View>}
        <Text style={{ ...label, marginBottom: 16 }}>إيرادات: {income.toFixed(2)} · مصروفات: {expense.toFixed(2)} · صافي الحركة: {((Math.round(income*100)-Math.round(expense*100))/100).toFixed(2)}</Text>
        {items.map((item, i) => <View key={i} style={{ padding: 14, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Pressable disabled={saving || items.length === 1} accessibilityLabel={`حذف الصنف ${i + 1}`} onPress={() => setItems(previous => previous.filter((_, index) => index !== i))} style={{ padding: 10, opacity: items.length === 1 ? .4 : 1 }}><Text style={{ ...text, color: c.error }}>حذف الصنف</Text></Pressable>
            <Text style={{ ...text, fontFamily: 'ArabicBold' }}>صنف {i + 1}</Text>
          </View>
          <Text style={label}>نوع العملية</Text>
          <ScrollView horizontal contentContainerStyle={{gap:8}} style={{marginBottom:12}}>{transactionKinds.filter(k=>k!=='unknown').map(kind=><Pressable key={kind} accessibilityRole="button" accessibilityState={{selected:item.kind===kind}} disabled={saving||checking} accessibilityLabel={`نوع الصنف ${i+1}: ${transactionLabels[kind]}`} onPress={()=>patch(i,{kind,debtId:null})} style={{padding:10,borderRadius:12,borderWidth:1,borderColor:item.kind===kind?c.primary:c.border,backgroundColor:item.kind===kind?c.primary+'25':c.surfaceAlt}}><Text style={text}>{transactionLabels[kind]}</Text></Pressable>)}</ScrollView>
          {item.kind==='unknown'&&<Text style={{...label,color:c.error}}>النوع غير واضح؛ اختره قبل الحفظ.</Text>}
          {['debt_owed','debt_owing','repay','collect'].includes(item.kind)&&<><Text style={label}>اسم الشخص</Text><TextInput accessibilityLabel={`اسم الشخص للصنف ${i+1}`} editable={!saving} style={input} value={item.person} onChangeText={person=>patch(i,{person,debtId:null})} maxLength={500}/><Text style={label}>{item.kind==='debt_owed'||item.kind==='debt_owing'?'أصل الدين للتتبع فقط؛ لا يضاف للإيرادات أو المصروفات.':'اختر الدين المسجل؛ السداد أو التحصيل يحدّث المتبقي والحساب معًا.'}</Text></>}
          {['repay','collect'].includes(item.kind)&&<ScrollView horizontal style={{marginBottom:12}} contentContainerStyle={{gap:8}}>{debts.filter(d=>d.direction===(item.kind==='repay'?'owing':'owed')&&d.amount>d.paid).map(d=><Pressable key={d.id} disabled={saving||checking} onPress={()=>patch(i,{debtId:d.id,person:d.person})} style={{padding:10,borderWidth:1,borderRadius:12,borderColor:matchingDebt(item)===d.id?c.primary:c.border}}><Text style={text}>{d.person} · المتبقي {(d.amount-d.paid).toFixed(2)}</Text></Pressable>)}</ScrollView>}
          <Text style={label}>المبلغ{!validAmount(numericInput(item.amount)) ? ' — مطلوب' : ''}</Text>
          <TextInput accessibilityLabel={`مبلغ الصنف ${i + 1}`} editable={!saving} style={input} value={item.amount} onChangeText={amount => patch(i, { amount })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSecondary} />
          <Text style={label}>الوصف</Text>
          <TextInput accessibilityLabel={`وصف الصنف ${i + 1}`} editable={!saving} style={input} value={item.description} onChangeText={description => patch(i, { description })} maxLength={500} placeholder="وصف العملية" placeholderTextColor={c.textSecondary} />
          <Text style={label}>تاريخ العملية YYYY-MM-DD</Text>
          <TextInput accessibilityLabel={`تاريخ الصنف ${i + 1}`} editable={!saving} style={[input, { writingDirection: 'ltr' }]} value={item.date} onChangeText={date => patch(i, { date })} maxLength={10} />
          <Text style={label}>الحساب</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>{accounts.map(account => <Pressable key={account.id} disabled={saving||checking} onPress={() => patch(i, { accountId: account.id })} style={{ padding: 10, borderWidth: 1, borderRadius: 12, borderColor: (item.accountId || accounts[0]?.id) === account.id ? c.primary : c.border }}><Text style={text}>{account.name}</Text></Pressable>)}</ScrollView>
          {item.kind==='transfer'&&<><Text style={label}>الحساب المستلم</Text><ScrollView horizontal contentContainerStyle={{gap:8}} style={{marginBottom:12}}>{accounts.filter(a=>a.id!==(item.accountId||accounts[0]?.id)).map(a=><Pressable key={a.id} disabled={saving||checking} onPress={()=>patch(i,{toAccountId:a.id})} style={{padding:10,borderWidth:1,borderRadius:12,borderColor:item.toAccountId===a.id?c.primary:c.border}}><Text style={text}>{a.name}</Text></Pressable>)}</ScrollView></>}
          {item.kind==='expense'&&<><Text style={label}>الفئة</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>{categories.map(category => <Pressable key={category.id} disabled={saving||checking} accessibilityLabel={`فئة الصنف ${i + 1}: ${category.name}`} onPress={() => patch(i, { categoryId: item.categoryId === category.id ? null : category.id })} style={{ padding: 10, borderWidth: 1, borderRadius: 12, borderColor: item.categoryId === category.id ? category.color : c.border, backgroundColor: item.categoryId === category.id ? category.color + '25' : c.surfaceAlt }}><Text style={text}>{category.name}</Text></Pressable>)}</ScrollView>
          </>}
          <Text style={label}>ملاحظة (اختياري)</Text>
          <TextInput accessibilityLabel={`ملاحظة الصنف ${i + 1}`} editable={!saving} style={input} value={item.note} onChangeText={note => patch(i, { note })} maxLength={1000} />
        </View>)}
        <Pressable disabled={saving || items.length >= 50} onPress={() => setItems(previous => [...previous, {kind:'expense',person:'',debtId:null,toAccountId:null, amount: '', description: '', note: '', categoryId: null, date: localDate(), accountId: 0 }])} style={{ padding: 14, borderWidth: 1, borderColor: c.primary, borderRadius: 14, marginBottom: 16 }}><Text style={{ ...text, color: c.primary, textAlign: 'center' }}>إضافة صنف آخر</Text></Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable disabled={saving||checking} onPress={onCancel} style={{ flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.border }}><Text style={{ ...text, textAlign: 'center' }}>إلغاء</Text></Pressable>
          <Pressable disabled={saving||checking} onPress={save} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: c.primary }}>{saving ? <ActivityIndicator color={c.buttonText} /> : <Text style={{ ...text, color: c.buttonText, fontFamily: 'ArabicBold', textAlign: 'center' }}>حفظ</Text>}</Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
