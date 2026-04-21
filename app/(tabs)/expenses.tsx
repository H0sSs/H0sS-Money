import React, { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert,
  Modal, TextInput, ActivityIndicator, Platform, Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "@/contexts/ThemeContext";
import { getExpenses, deleteExpense, updateExpense, getCategories, getSettings, exportExpensesCSV } from "@/lib/services";
import type { Expense, Category } from "@/lib/services";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
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
  onSave: (data: { amount: number; description: string; categoryId: number | null; note: string | null; date: string }) => void;
}

function EditExpenseModal({ visible, expense, categories, colors, saving, onClose, onSave }: EditModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [catId, setCatId] = useState<number | null>(null);
  const [date, setDate] = useState("");

  React.useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setDescription(expense.description);
      setNote(expense.note ?? "");
      setCatId(expense.category_id ?? null);
      setDate(expense.date);
    }
  }, [expense]);

  const handleSave = () => {
    const num = parseFloat(amount);
    if (!num || isNaN(num) || !description.trim()) {
      Alert.alert("خطأ", "المبلغ والوصف مطلوبان");
      return;
    }
    onSave({ amount: num, description: description.trim(), categoryId: catId, note: note.trim() || null, date });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.surface }]}>
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

          <Text style={[s.label, { color: colors.textSecondary }]}>ملاحظة</Text>
          <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={note} onChangeText={setNote} placeholder="اختياري" placeholderTextColor={colors.textSecondary} />

          <View style={s.actions}>
            <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[s.cancelText, { color: colors.textSecondary }]}>إلغاء</Text>
            </Pressable>
            <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={[s.saveText, { color: colors.background }]}>حفظ</Text>}
            </Pressable>
          </View>
        </View>
      </View>
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
    const cutoffStr = cutoff ? cutoff.toISOString().split("T")[0] : null;
    const q = search.trim().toLowerCase();
    return allExpenses.filter((e) => {
      if (cutoffStr && e.date < cutoffStr) return false;
      if (catFilter != null && e.category_id !== catFilter) return false;
      if (q) {
        const hay = `${e.description} ${e.note ?? ""} ${e.category?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allExpenses, search, dateFilter, catFilter]);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const currency = settings?.currency ?? "EGP";

  const deleteMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
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
      const csv = await exportExpensesCSV();
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
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const filterActive = !!search.trim() || dateFilter !== "all" || catFilter !== null;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <View style={[s.topBar, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]}>المصاريف</Text>
          <Text style={[s.subtitle, { color: colors.textSecondary }]}>{expenses.length} عملية • إجمالي {total.toFixed(2)} {currency}</Text>
        </View>
        <Pressable onPress={handleExport} disabled={isExporting} style={[s.exportBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}>
          {isExporting ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="download" size={16} color={colors.primary} />}
          <Text style={[s.exportText, { color: colors.primary }]}>تصدير</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <View style={[s.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder="ابحث في الوصف، الملاحظة، أو الفئة..."
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
                <Text style={{ color: sel ? colors.primary : colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" }}>{item.label}</Text>
              </Pressable>
            );
          }}
        />
        {categories.length > 0 && (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 8, gap: 8 }}
            data={[{ id: -1, name: "كل الفئات", icon: "tag", color: colors.primary, budget: null, created_at: "" }, ...categories]}
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
                  <Text style={{ color: sel ? item.color : colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium" }}>{item.name}</Text>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : expenses.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Icon name="inbox" size={48} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 }}>لا توجد مصاريف بعد</Text>
        </View>
      ) : (
        <FlatList
          data={dates}
          keyExtractor={(d) => d}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 20, paddingTop: 8 }}
          renderItem={({ item: date }) => (
            <View>
              <View style={[s.dateSep, { borderBottomColor: colors.border }]}>
                <Text style={[s.dateLabel, { color: colors.textSecondary, backgroundColor: colors.background }]}>
                  {formatDate(date)}
                </Text>
              </View>
              {grouped[date].map((exp) => (
                <View
                  key={exp.id}
                  style={[
                    filterActive ? s.rowCompact : s.row,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[s.catDot, { backgroundColor: exp.category?.color ?? colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.desc, { color: colors.text }]} numberOfLines={1}>{exp.description}</Text>
                    {!filterActive && (
                      <Text style={[s.cat, { color: colors.textSecondary }]}>{exp.category?.name ?? "بدون فئة"}</Text>
                    )}
                    {!filterActive && exp.note ? (
                      <Text style={[s.note, { color: colors.textSecondary }]} numberOfLines={1}>{exp.note}</Text>
                    ) : null}
                  </View>
                  <Text style={[filterActive ? s.amountCompact : s.amount, { color: colors.primary }]}>
                    {Number(exp.amount).toFixed(2)}
                  </Text>
                  <Pressable onPress={() => setEditExpense(exp)} hitSlop={10} style={{ marginLeft: 8 }}>
                    <Icon name="edit-2" size={filterActive ? 14 : 16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(exp.id, exp.description)} hitSlop={10} style={{ marginLeft: 8 }}>
                    <Icon name="trash-2" size={filterActive ? 14 : 16} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        />
      )}

      <EditExpenseModal
        visible={!!editExpense}
        expense={editExpense}
        categories={categories}
        colors={colors}
        saving={updateMutation.isPending}
        onClose={() => setEditExpense(null)}
        onSave={(data) => editExpense && updateMutation.mutate({ id: editExpense.id, data })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  exportText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dateSep: { borderBottomWidth: 1, marginHorizontal: 16, marginVertical: 8, alignItems: "flex-end" },
  dateLabel: { fontSize: 12, fontFamily: "Inter_500Medium", paddingHorizontal: 8, marginBottom: -8 },
  row: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  rowCompact: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 4, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  amountCompact: { fontSize: 13, fontFamily: "Inter_700Bold" },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  desc: { fontSize: 14, fontFamily: "Inter_500Medium" },
  cat: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  note: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, fontStyle: "italic" },
  amount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 4, textAlign: "right" },
  chip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  chipText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  saveBtn: { flex: 2, borderRadius: 14, padding: 14, alignItems: "center" },
  saveText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "right", paddingVertical: 4 },
  filterChip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
});
