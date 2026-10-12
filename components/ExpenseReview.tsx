import { Text, TextInput } from "@/components/Typography";
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, View } from "react-native";
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAccounts } from '@/lib/finance';
import { localDate, parseDate } from '@/lib/dates';
import { numericInput, validAmount } from '@/lib/validation';
import type { ParsedExpense } from '@/lib/ai';
import type { ExpenseInput } from '@/lib/services';

type Category = { id: number; name: string; color: string };
type Draft = { amount: string; description: string; note: string; categoryId: number | null; date: string; accountId: number };
type Props = { visible: boolean; parsed: ParsedExpense[] | null; categories: Category[]; saving: boolean; colors: any; onCancel: () => void; onSave: (items: ExpenseInput[]) => void };

export default function ExpenseReview({ visible, parsed, categories, saving, colors: c, onCancel, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Draft[]>([]);
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  useEffect(() => {
    setItems((parsed ?? []).map(item => ({ amount: item.amount == null ? '' : String(item.amount), description: item.description, note: item.note ?? '', categoryId: categories.find(cat => cat.name === item.categoryName)?.id ?? null, date: localDate(), accountId: 0 })));
  }, [parsed]);
  const patch = (index: number, data: Partial<Draft>) => setItems(previous => previous.map((item, i) => i === index ? { ...item, ...data } : item));
  const text = { color: c.text, fontFamily: 'ArabicRegular', textAlign: 'right' as const };
  const input = { ...text, backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 };
  const label = { ...text, color: c.textSecondary, marginBottom: 6 };
  const total = items.reduce((sum, item) => sum + (validAmount(numericInput(item.amount)) ? numericInput(item.amount) : 0), 0);
  function save() {
    if (saving) return;
    try {
      if (!items.length) throw new Error('أضف صنفًا واحدًا على الأقل');
      const data = items.map((item, i) => {
        const amount = numericInput(item.amount);
        if (!validAmount(amount) || !item.description.trim()) throw new Error(`أكمل المبلغ والوصف للصنف ${i + 1}`);
        parseDate(item.date);
        const accountId = item.accountId || accounts[0]?.id;
        if (!accountId) throw new Error('الحساب غير متاح بعد؛ حاول مرة أخرى');
        return { amount, description: item.description.trim(), note: item.note.trim() || null, categoryId: item.categoryId, date: item.date, accountId };
      });
      onSave(data);
    } catch (error) { Alert.alert('راجع المصاريف', error instanceof Error ? error.message : 'أكمل البيانات'); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!saving) onCancel(); }}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000080' }}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '90%' }} contentContainerStyle={{ padding: 20, paddingBottom: 20 + insets.bottom, backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <Text style={{ ...text, fontFamily: 'ArabicBold', fontSize: 22, marginBottom: 12 }}>مراجعة المصاريف — {items.length} صنف</Text>
        {!!parsed?.[0]?.transcript && <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.surfaceAlt, marginBottom: 16 }}>
          <Text style={{ ...label, fontFamily: 'ArabicBold' }}>النص المسموع</Text><Text style={text}>{parsed[0].transcript}</Text>
          <Text style={{ ...label, marginTop: 8 }}>راجع أن كل ما قلته موجود. يمكنك تعديل كل صنف أو حذفه أو إضافة صنف مفقود.</Text>
        </View>}
        <Text style={{ ...label, marginBottom: 16 }}>إجمالي المبالغ المكتملة: {total.toFixed(2)} — كل صنف يُحفظ كعملية مستقلة</Text>
        {items.map((item, i) => <View key={i} style={{ padding: 14, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Pressable disabled={saving || items.length === 1} accessibilityLabel={`حذف الصنف ${i + 1}`} onPress={() => setItems(previous => previous.filter((_, index) => index !== i))} style={{ padding: 10, opacity: items.length === 1 ? .4 : 1 }}><Text style={{ ...text, color: c.error }}>حذف الصنف</Text></Pressable>
            <Text style={{ ...text, fontFamily: 'ArabicBold' }}>صنف {i + 1}</Text>
          </View>
          <Text style={label}>المبلغ{!validAmount(numericInput(item.amount)) ? ' — مطلوب' : ''}</Text>
          <TextInput accessibilityLabel={`مبلغ الصنف ${i + 1}`} editable={!saving} style={input} value={item.amount} onChangeText={amount => patch(i, { amount })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={c.textSecondary} />
          <Text style={label}>الوصف</Text>
          <TextInput accessibilityLabel={`وصف الصنف ${i + 1}`} editable={!saving} style={input} value={item.description} onChangeText={description => patch(i, { description })} maxLength={500} placeholder="وصف المصروف" placeholderTextColor={c.textSecondary} />
          <Text style={label}>تاريخ المصروف YYYY-MM-DD</Text>
          <TextInput accessibilityLabel={`تاريخ الصنف ${i + 1}`} editable={!saving} style={[input, { writingDirection: 'ltr' }]} value={item.date} onChangeText={date => patch(i, { date })} maxLength={10} />
          <Text style={label}>الحساب</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>{accounts.map(account => <Pressable key={account.id} disabled={saving} onPress={() => patch(i, { accountId: account.id })} style={{ padding: 10, borderWidth: 1, borderRadius: 12, borderColor: (item.accountId || accounts[0]?.id) === account.id ? c.primary : c.border }}><Text style={text}>{account.name}</Text></Pressable>)}</ScrollView>
          <Text style={label}>الفئة</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 12 }}>{categories.map(category => <Pressable key={category.id} disabled={saving} accessibilityLabel={`فئة الصنف ${i + 1}: ${category.name}`} onPress={() => patch(i, { categoryId: item.categoryId === category.id ? null : category.id })} style={{ padding: 10, borderWidth: 1, borderRadius: 12, borderColor: item.categoryId === category.id ? category.color : c.border, backgroundColor: item.categoryId === category.id ? category.color + '25' : c.surfaceAlt }}><Text style={text}>{category.name}</Text></Pressable>)}</ScrollView>
          <Text style={label}>ملاحظة (اختياري)</Text>
          <TextInput accessibilityLabel={`ملاحظة الصنف ${i + 1}`} editable={!saving} style={input} value={item.note} onChangeText={note => patch(i, { note })} maxLength={1000} />
        </View>)}
        <Pressable disabled={saving || items.length >= 50} onPress={() => setItems(previous => [...previous, { amount: '', description: '', note: '', categoryId: null, date: localDate(), accountId: 0 }])} style={{ padding: 14, borderWidth: 1, borderColor: c.primary, borderRadius: 14, marginBottom: 16 }}><Text style={{ ...text, color: c.primary, textAlign: 'center' }}>إضافة صنف آخر</Text></Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable disabled={saving} onPress={onCancel} style={{ flex: 1, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: c.border }}><Text style={{ ...text, textAlign: 'center' }}>إلغاء</Text></Pressable>
          <Pressable disabled={saving} onPress={save} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: c.primary }}>{saving ? <ActivityIndicator color={c.buttonText} /> : <Text style={{ ...text, color: c.buttonText, fontFamily: 'ArabicBold', textAlign: 'center' }}>حفظ</Text>}</Pressable>
        </View>
      </ScrollView>
    </View>
  </Modal>;
}
