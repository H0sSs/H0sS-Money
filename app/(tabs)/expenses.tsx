import { KeyboardAwareScrollViewCompat, KeyboardAvoidingViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { Text, TextInput } from "@/components/Typography";
import {getAccounts} from "@/lib/finance";
import PageHeader from "@/components/PageHeader";
import { numericInput, validAmount } from "@/lib/validation";
import { localDate, parseDate } from "@/lib/dates";
import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, StyleSheet, FlatList, SectionList, Pressable, Alert, Modal, ScrollView, ActivityIndicator, Platform, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "@/contexts/ThemeContext";
import { getExpenses, deleteExpense, updateExpense, getCategories, getSettings, exportExpensesCSV, restoreExpense, createExpense } from "@/lib/services";
import type { Expense, Category } from "@/lib/services";

function formatDate(dateStr: string) {
  return parseDate(dateStr).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

function groupByDate(expenses: Expense[]): Record<string, Expense[]> {
  return expenses.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {} as Record<string, Expense[]>);
}

interface EditModalProps {
  visible: boolean;
  expense: Expense | null;
  categories: Category[];
  colors: any;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { amount: number; description: string; categoryId: number | null; note: string | null; date: string; accountId:number }) => void;
}

function EditExpenseModal({ visible, expense, categories, colors, saving, onClose, onSave }: EditModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [catId, setCatId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [account,setAccount]=useState(0);
  const {data:accounts=[]}=useQuery({queryKey:["accounts"],queryFn:getAccounts});

  React.useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setDescription(expense.description);
      setNote(expense.note ?? "");
      setCatId(expense.category_id ?? null);
      setDate(expense.date);
      setAccount(expense.account_id??0);
    }
  }, [expense]);

  const handleSave = () => {
    const num = numericInput(amount);
    if (!validAmount(num) || !description.trim()) {
      Alert.alert("خطأ", "المبلغ والوصف مطلوبان");
      return;
    }
    const accountId=account||accounts[0]?.id;if(!accountId){Alert.alert("حساب مفقود","اختر حسابًا");return;}
    onSave({ amount: num, description: description.trim(), categoryId: catId, note: note.trim() || null, date,accountId });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingViewCompat style={s.overlay}>
        <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" style={{maxHeight:"90%"}} contentContainerStyle={[s.sheet, { backgroundColor: colors.surface }]}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.sheetTitle, { color: colors.text }]}>تعديل المصروف</Text>

          <Text style={[s.label, { color: colors.textSecondary }]}>المبلغ</Text>
          <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.label, { color: colors.textSecondary }]}>الوصف</Text>
          <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={description} onChangeText={setDescription} placeholder="وصف" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.label, { color: colors.textSecondary }]}>الفئة</Text>
          <FlatList
            horizontal data={categories} keyExtractor={(c) => String(c.id)} showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => {
              const sel = catId === item.id;
              return (
                <Pressable onPress={() => setCatId(sel ? null : item.id)}
                  style={[s.chip, { backgroundColor: sel ? item.color + "25" : colors.surfaceAlt, borderColor: sel ? item.color : colors.border }]}>
                  <Text style={[s.chipText, { color: sel ? item.color : colors.textSecondary }]}>{item.name}</Text>
                </Pressable>
              );
            }}
            style={{ marginBottom: 12 }}
          />

          <Text style={[s.label, { color: colors.textSecondary }]}>التاريخ (YYYY-MM-DD)</Text>
          <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={date} onChangeText={setDate} placeholder="2025-01-01" placeholderTextColor={colors.textSecondary} />

          <Text style={[s.label,{color:colors.textSecondary}]}>الحساب</Text><ScrollView horizontal contentContainerStyle={{gap:8}}>{accounts.map(a=><Pressable key={a.id} onPress={()=>setAccount(a.id)} style={{padding:10,borderWidth:1,borderColor:(account||accounts[0]?.id)===a.id?colors.primary:colors.border,borderRadius:10}}><Text style={{color:colors.text,fontFamily:'ArabicRegular'}}>{a.name}</Text></Pressable>)}</ScrollView>
          <Text style={[s.label, { color: colors.textSecondary }]}>ملاحظة</Text>
          <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={note} onChangeText={setNote} placeholder="اختياري" placeholderTextColor={colors.textSecondary} />

          <View style={s.actions}>
            <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[s.cancelText, { color: colors.textSecondary }]}>إلغاء</Text>
            </Pressable>
            <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={[s.saveText, { color: colors.buttonText }]}>حفظ</Text>}
            </Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      </KeyboardAvoidingViewCompat>
    </Modal>
  );
}

type DateFilter = "all" | "today" | "week" | "month";

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [deleted,setDeleted]=useState<Expense|null>(null);
  const [accountFilter,setAccountFilter]=useState<number|null>(null);
  const {data:accounts=[]}=useQuery({queryKey:["accounts"],queryFn:getAccounts});
  const [sortOrder,setSortOrder]=useState<"newest"|"oldest"|"largest">("newest");
  const [showFilters,setShowFilters]=useState(false);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [catFilter, setCatFilter] = useState<number | null>(null);
  const params = useLocalSearchParams<{ categoryId?: string; categoryName?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.categoryId) {
      const id = Number(params.categoryId);
      if (!Number.isNaN(id)) {
        setCatFilter(id);
        setDateFilter("all");
        setSearch("");
        router.setParams({ categoryId: undefined, categoryName: undefined });
      }
    }
  }, [params.categoryId]);

  const { data: allExpenses = [], isLoading } = useQuery({ queryKey: ["expenses"], queryFn: () => getExpenses() });

  const expenses = React.useMemo(() => {
    const today = new Date();
    let cutoff: Date | null = null;
    if (dateFilter === "today") { cutoff = new Date(); cutoff.setHours(0, 0, 0, 0); }
    else if (dateFilter === "week") { cutoff = new Date(); cutoff.setDate(today.getDate() - 6); }
    else if (dateFilter === "month") { cutoff = new Date(); cutoff.setDate(today.getDate() - 29); }
    const cutoffStr = cutoff ? localDate(cutoff) : null;
    const q = search.trim().toLowerCase();
    return allExpenses.filter((e) => {
      if (cutoffStr && (e.date < cutoffStr || e.date > localDate(today))) return false;
      if (catFilter != null && (catFilter===-2?e.category_id!==null:e.category_id!==catFilter)) return false;
      if(accountFilter!==null&&e.account_id!==accountFilter)return false;
      if (q) {
        const hay = `${e.description} ${e.note ?? ""} ${e.category?.name ?? ""} ${e.amount} ${e.date} ${accounts.find(a=>a.id===e.account_id)?.name??""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a,b)=>sortOrder==="largest"?b.amount-a.amount||b.date.localeCompare(a.date):sortOrder==="oldest"?a.date.localeCompare(b.date):b.date.localeCompare(a.date));
  }, [allExpenses, search, dateFilter, catFilter,sortOrder,accountFilter,accounts]);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const currency = settings?.currency ?? "EGP";

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: (_,id) => {
      setDeleted(allExpenses.find(e=>e.id===id)??null);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError:(e:Error)=>Alert.alert("تعذر الحذف",e.message),
  });

  const cloneMutation=useMutation({mutationFn:createExpense,onSuccess:()=>{queryClient.invalidateQueries();setEditExpense(null);},onError:(e)=>Alert.alert('تعذر الإضافة',e.message)});
  const restoreMutation=useMutation({mutationFn:restoreExpense,onSuccess:()=>{setDeleted(null);queryClient.invalidateQueries();},onError:e=>Alert.alert('تعذر الاستعادة',e.message)});
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
      setEditExpense(null);
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const handleDelete = (id: number, desc: string) => {
    Alert.alert("حذف المصروف", `هل تريد حذف "${desc}"؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const csv = await exportExpensesCSV(expenses);
      const path = FileSystem.cacheDirectory + "hossmoney_export.csv";
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: "تصدير المصاريف" });
      } else {
        await Share.share({ message: csv, title: "H0sS-Money — المصاريف" });
      }
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const grouped = groupByDate(expenses);
  const dates = Object.keys(grouped).sort((a, b) => sortOrder==="oldest"?a.localeCompare(b):sortOrder==="largest"?Math.max(...grouped[b].map(e=>e.amount))-Math.max(...grouped[a].map(e=>e.amount)):b.localeCompare(a));
  const total = expenses.reduce((sum, e) => sum + Math.round(Number(e.amount)*100), 0)/100;
  const filterActive = !!search.trim() || dateFilter !== "all" || catFilter !== null||accountFilter!==null;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <PageHeader title="سجل المصاريف" subtitle="راجع إنفاقك وتابع تفاصيل كل عملية" icon="list" actions={<><Pressable accessibilityLabel="إضافة مصروف" onPress={()=>setEditExpense({id:-1,uid:"",amount:0,description:"",category_id:null,note:null,date:localDate(),created_at:""})} style={[s.exportBtn,{borderColor:colors.border}]}><Icon name="plus" color={colors.primary} size={20}/></Pressable>
        <Pressable onPress={handleExport} disabled={isExporting} style={[s.exportBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}>
          {isExporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="download" size={16} color={colors.primary} />}
          <Text style={[s.exportText, { color: colors.primary }]}>تصدير</Text>
        </Pressable>
      </>} />
      <View style={{marginHorizontal:16,padding:16,borderRadius:20,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,gap:6}}>
        <Text style={{color:colors.textSecondary,fontFamily:'ArabicRegular',textAlign:'right'}}>إجمالي المصاريف المعروضة</Text>
        <Text style={{color:colors.primary,fontFamily:'ArabicBold',fontSize:26,textAlign:'right'}}>{total.toFixed(2)} {currency}</Text>
        <Text style={{color:colors.textSecondary,fontFamily:'ArabicRegular',textAlign:'right'}}>{expenses.length} عملية · متوسط العملية {expenses.length?(total/expenses.length).toFixed(2):'0.00'} {currency}</Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            accessibilityLabel="بحث المصاريف" maxLength={200}
            placeholder="ابحث بالوصف، المبلغ، الفئة أو الحساب..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Icon name="x" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <Pressable onPress={()=>setShowFilters(!showFilters)} style={{paddingVertical:12}}><Text style={{color:colors.primary,textAlign:'right',fontFamily:'ArabicBold'}}>{showFilters?'إخفاء الفلاتر':'الفلاتر'}{filterActive?' · مفعّلة':''}</Text></Pressable>
        {showFilters&&<>
        <ScrollView horizontal contentContainerStyle={{gap:8,marginBottom:8}}>{[{id:0,name:'كل الحسابات'},...accounts].map(a=><Pressable key={a.id} onPress={()=>setAccountFilter(a.id||null)} style={[s.filterChip,{borderColor:(accountFilter??0)===a.id?colors.primary:colors.border}]}><Text style={{color:colors.text,fontFamily:'ArabicRegular'}}>{a.name}</Text></Pressable>)}</ScrollView>
        <ScrollView horizontal contentContainerStyle={{gap:8}}>{([{value:'newest',label:'الأحدث'},{value:'oldest',label:'الأقدم'},{value:'largest',label:'الأعلى في كل يوم'}] as const).map(x=><Pressable key={x.value} onPress={()=>setSortOrder(x.value)} style={[s.filterChip,{borderColor:sortOrder===x.value?colors.primary:colors.border}]}><Text style={{color:colors.text,fontFamily:'ArabicRegular'}}>{x.label}</Text></Pressable>)}</ScrollView>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 10, gap: 8 }}
          data={[
            { key: "today", label: "اليوم", val: "today" as DateFilter },
            { key: "week", label: "آخر 7 أيام", val: "week" as DateFilter },
            { key: "month", label: "آخر 30 يوم", val: "month" as DateFilter },
            { key: "all", label: "الكل", val: "all" as DateFilter },
          ]}
          keyExtractor={(i) => i.key}
          renderItem={({ item }) => {
            const sel = dateFilter === item.val;
            return (
              <Pressable
                onPress={() => setDateFilter(item.val)}
                style={[s.filterChip, { backgroundColor: sel ? colors.primary + "25" : colors.surface, borderColor: sel ? colors.primary : colors.border }]}
              >
                <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular" }}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
        {categories.length > 0 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 8, gap: 8 }}
            data={[{ id: -1, name: "كل الفئات", icon: "tag", color: colors.primary, budget: null, created_at: "" },{id:-2,name:"بدون فئة",icon:"tag",color:colors.textSecondary,budget:null,created_at:""}, ...categories]}
            keyExtractor={(c) => String(c.id)}
            renderItem={({ item }) => {
              const isAll = item.id === -1;
              const sel = (isAll && catFilter === null) || catFilter === item.id;
              return (
                <Pressable
                  onPress={() => setCatFilter(isAll ? null : item.id)}
                  style={[s.filterChip, { backgroundColor: sel ? item.color + "25" : colors.surface, borderColor: sel ? item.color : colors.border, flexDirection: "row", alignItems: "center", gap: 5 }]}
                >
                  {!isAll && <Icon name={item.icon} size={12} color={sel ? item.color : colors.textSecondary} />}
                  <Text style={{ color: sel ? item.color : colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular" }}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
        )}
        </>}
      </View>
      {filterActive&&<Pressable onPress={()=>{setSearch('');setCatFilter(null);setDateFilter('all');setAccountFilter(null);}} style={{paddingHorizontal:20,paddingBottom:8}}><Text style={{color:colors.primary,fontFamily:'ArabicRegular',textAlign:'right'}}>مسح جميع الفلاتر</Text></Pressable>}
      {!!deleted&&<View style={{marginHorizontal:16,padding:12,borderRadius:12,backgroundColor:colors.surfaceAlt,flexDirection:'row',alignItems:'center',gap:10}}><Pressable disabled={restoreMutation.isPending} onPress={()=>restoreMutation.mutate(deleted)}><Text style={{color:colors.primary,fontFamily:'ArabicBold'}}>تراجع عن الحذف</Text></Pressable><Text style={{flex:1,textAlign:'right',color:colors.text,fontFamily:'ArabicRegular'}} numberOfLines={1}>{deleted.description}</Text><Pressable accessibilityLabel="إغلاق التراجع" onPress={()=>setDeleted(null)}><Icon name="x" color={colors.textSecondary} size={18}/></Pressable></View>}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : expenses.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Icon name="inbox" size={48} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontFamily: "ArabicRegular", fontSize: 15 }}>{filterActive?"لا توجد نتائج مطابقة للفلاتر":"لا توجد مصاريف بعد"}</Text>
          <Pressable onPress={()=>{if(filterActive){setSearch("");setDateFilter("all");setCatFilter(null);setAccountFilter(null);}else setEditExpense({id:-1,uid:"",amount:0,description:"",category_id:null,note:null,date:localDate(),created_at:""});}}><Text style={{color:colors.primary,fontFamily:"ArabicBold"}}>{filterActive?"مسح الفلاتر":"إضافة أول مصروف"}</Text></Pressable>
        </View>
      ) : (
        <SectionList
          sections={dates.map(date=>({date,data:grouped[date]}))}
          keyExtractor={exp=>String(exp.id)} stickySectionHeadersEnabled={false}
          contentContainerStyle={{paddingBottom:tabBarHeight+20,paddingTop:8}}
          renderSectionHeader={({section})=><View style={[s.dateSep,{borderBottomColor:colors.border}]}><Text style={[s.dateLabel,{color:colors.textSecondary,backgroundColor:colors.background}]}>{formatDate(section.date)} · {(section.data.reduce((sum,e)=>sum+Math.round(e.amount*100),0)/100).toFixed(2)} {currency}</Text></View>}
          renderItem={({item:exp})=><View style={{marginHorizontal:16,marginBottom:10,padding:16,borderRadius:18,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,gap:10}}>
            <View style={{flexDirection:'row-reverse',alignItems:'flex-start',gap:12}}>
              <View style={{padding:10,borderRadius:12,backgroundColor:(exp.category?.color??colors.primary)+'20'}}><Icon name={exp.category?.icon??'tag'} size={20} color={exp.category?.color??colors.primary}/></View>
              <View style={{flex:1}}><Text style={[s.desc,{color:colors.text}]} numberOfLines={2}>{exp.description}</Text><Text style={[s.cat,{color:colors.textSecondary}]}>{exp.category?.name??'بدون فئة'} · {accounts.find(a=>a.id===exp.account_id)?.name??'نقدي'}</Text></View>
              <View style={{maxWidth:'40%'}}><Text style={[s.amount,{color:colors.primary}]}>{Number(exp.amount).toFixed(2)}</Text><Text style={{color:colors.textSecondary,fontFamily:'ArabicRegular',fontSize:11,textAlign:'center'}}>{currency}</Text></View>
            </View>
            {!!exp.note&&<Text style={[s.note,{color:colors.textSecondary}]} numberOfLines={3}>{exp.note}</Text>}
            <View style={{flexDirection:'row-reverse',gap:8,borderTopWidth:1,borderTopColor:colors.border,paddingTop:8}}>
              <Pressable accessibilityLabel={'تعديل '+exp.description} onPress={()=>setEditExpense(exp)} style={{padding:8,flexDirection:'row-reverse',gap:6,alignItems:'center'}}><Icon name="edit-2" color={colors.primary} size={16}/><Text style={{color:colors.primary,fontFamily:'ArabicRegular',fontSize:12}}>تعديل</Text></Pressable>
              <Pressable accessibilityLabel={'تكرار '+exp.description} onPress={()=>setEditExpense({...exp,id:-1,uid:'',date:localDate()})} style={{padding:8,flexDirection:'row-reverse',gap:6,alignItems:'center'}}><Icon name="copy" color={colors.textSecondary} size={16}/><Text style={{color:colors.textSecondary,fontFamily:'ArabicRegular',fontSize:12}}>تكرار</Text></Pressable>
              <Pressable accessibilityLabel={'حذف '+exp.description} disabled={deleteMutation.isPending} onPress={()=>handleDelete(exp.id,exp.description)} style={{padding:8,flexDirection:'row-reverse',gap:6,alignItems:'center'}}><Icon name="trash-2" color={colors.error} size={16}/><Text style={{color:colors.error,fontFamily:'ArabicRegular',fontSize:12}}>حذف</Text></Pressable>
            </View>
          </View>}
        />
      )}

      <EditExpenseModal
        visible={!!editExpense}
        expense={editExpense}
        categories={categories}
        colors={colors}
        saving={updateMutation.isPending||cloneMutation.isPending}
        onClose={() => setEditExpense(null)}
        onSave={(data) => {if(editExpense?.id===-1)cloneMutation.mutate(data);else if(editExpense)updateMutation.mutate({id:editExpense.id,data});}}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "ArabicBold" },
  subtitle: { fontSize: 12, fontFamily: "ArabicRegular", marginTop: 2,textAlign:"right" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  exportText: { fontSize: 13, fontFamily: "ArabicBold" },
  dateSep: { borderBottomWidth: 1, marginHorizontal: 16, marginVertical: 8, alignItems: "flex-end" },
  dateLabel: { fontSize: 12, fontFamily: "ArabicRegular", paddingHorizontal: 8, marginBottom: -8 },
  row: { flexDirection: "row-reverse", alignItems: "center", flexWrap:"wrap", marginHorizontal: 16, marginBottom: 8, borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  rowCompact: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  amountCompact: { fontSize: 13, fontFamily: "ArabicBold" },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  desc: { fontSize: 14, fontFamily: "ArabicBold",textAlign:"right" },
  cat: { fontSize: 12, fontFamily: "ArabicRegular", marginTop: 2,textAlign:"right" },
  note: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 2, fontStyle: "italic" },
  amount: { fontSize: 15, fontFamily: "ArabicBold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { maxHeight:"85%", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontFamily: "ArabicBold", textAlign: "center", marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "ArabicRegular", marginBottom: 4, textAlign: "right" },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 12, fontFamily: "ArabicRegular" },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "ArabicRegular" },
  saveBtn: { flex: 2, borderRadius: 14, padding: 14, alignItems: "center" },
  saveText: { fontSize: 15, fontFamily: "ArabicBold" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "ArabicRegular", textAlign: "right", paddingVertical: 4 },
  filterChip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
});
