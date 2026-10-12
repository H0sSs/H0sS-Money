import { Text, TextInput } from "@/components/Typography";
import Constants from "expo-constants";
import BackupStatus from "@/components/BackupStatus";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as LocalAuthentication from "expo-local-authentication";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import PageHeader from "@/components/PageHeader";
import AISettings from "@/components/AISettings";
import { numericInput, validAmount } from "@/lib/validation";
import { localDate, parseDate } from "@/lib/dates";
import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, Alert, ActivityIndicator, Switch, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getSettings, updateSetting, getExpenses, createExpense, updateExpense, deleteExpense, getStats,
  exportBackup, importBackup,
} from "@/lib/services";
import { saveAPIKey, getAPIKey } from "@/lib/ai";
import {
  requestNotificationPermission,
  requestPermissions as requestNotifPerms,
  getNotificationLog,
  clearNotificationLog,
  type NotificationLogEntry,
} from "@/lib/notifications";
import type { Category, Expense } from "@/lib/services";
import {
  connectDrive,
  clearDriveAuth,
  uploadBackupToDrive,
  listDriveBackups,
  restoreFromDriveFile,
  deleteDriveBackup,
  type DriveBackupFile,
} from "@/lib/drive";

const ICONS = ["coffee", "truck", "shopping-bag", "film", "file-text", "heart", "wind", "book", "zap", "star", "more-horizontal", "tag", "home", "music", "gift", "dollar-sign", "sun", "moon"];
const PALETTE = ["#F97316", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#EF4444", "#6B7280", "#F59E0B", "#14B8A6", "#06B6D4", "#84CC16", "#F0B429"];

interface CategoryModalProps {
  visible: boolean;
  category: Category | null;
  colors: any;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string; budget?: number | null }) => void;
}

function CategoryModal({ visible, category, colors, saving, onClose, onSave }: CategoryModalProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("tag");
  const [color, setColor] = useState("#F0B429");
  const [budget, setBudget] = useState("");

  React.useEffect(() => {
    if (category) {
      setName(category.name);
      setIcon(category.icon);
      setColor(category.color);
      setBudget(category.budget != null ? String(category.budget) : "");
    } else {
      setName(""); setIcon("tag"); setColor("#F0B429"); setBudget("");
    }
  }, [category, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>{category ? "تعديل الفئة" : "فئة جديدة"}</Text>

            <Text style={[s.label, { color: colors.textSecondary }]}>الاسم</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={name} onChangeText={setName} placeholder="اسم الفئة" placeholderTextColor={colors.textSecondary} />

            <Text style={[s.label, { color: colors.textSecondary }]}>الميزانية الشهرية (اختياري)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={budget} onChangeText={setBudget} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />

            <Text style={[s.label, { color: colors.textSecondary }]}>اللون</Text>
            <View style={s.colorGrid}>
              {PALETTE.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)}
                  style={[s.colorDot, { backgroundColor: c }, color === c && s.colorSel]} />
              ))}
            </View>

            <Text style={[s.label, { color: colors.textSecondary }]}>الأيقونة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              {ICONS.map((ic) => (
                <Pressable key={ic} onPress={() => setIcon(ic)}
                  style={[s.iconChip, { backgroundColor: icon === ic ? color + "30" : colors.surfaceAlt, borderColor: icon === ic ? color : colors.border }]}>
                  <Icon name={ic} size={18} color={icon === ic ? color : colors.textSecondary} />
                </Pressable>
              ))}
            </ScrollView>

            <View style={s.actions}>
              <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>إلغاء</Text>
              </Pressable>
              <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} disabled={saving}
                onPress={() => {
                  if (!name.trim()) { Alert.alert("خطأ", "الاسم مطلوب"); return; }
                  if (budget && !validAmount(numericInput(budget))) { Alert.alert("خطأ", "الميزانية يجب أن تكون مبلغًا موجبًا"); return; }
                  onSave({ name: name.trim(), icon, color, budget: budget ? numericInput(budget) : null });
                }}>
                {saving ? <ActivityIndicator size="small" color={colors.background} /> :
                  <Text style={[s.saveText, { color: colors.buttonText }]}>حفظ</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface ExpenseModalProps {
  visible: boolean;
  expense: Expense | null;
  categories: Category[];
  colors: any;
  saving: boolean;
  onClose: () => void;
  onSave: (data: { amount: number; description: string; categoryId: number | null; date: string; note?: string }) => void;
}

function ExpenseModal({ visible, expense, categories, colors, saving, onClose, onSave }: ExpenseModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localDate());
  const [categoryId, setCategoryId] = useState<number | null>(null);

  React.useEffect(() => {
    if (expense) {
      setAmount(String(expense.amount));
      setDescription(expense.description);
      setNote(expense.note ?? "");
      setDate(expense.date);
      setCategoryId(expense.category_id ?? null);
    } else {
      setAmount(""); setDescription(""); setNote("");
      setDate(localDate());
      setCategoryId(null);
    }
  }, [expense, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <ScrollView>
          <View style={[s.sheet, { backgroundColor: colors.surface }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>{expense ? "تعديل المصروف" : "إضافة مصروف"}</Text>

            <Text style={[s.label, { color: colors.textSecondary }]}>المبلغ (EGP)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />

            <Text style={[s.label, { color: colors.textSecondary }]}>الوصف</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={description} onChangeText={setDescription} placeholder="وصف المصروف" placeholderTextColor={colors.textSecondary} />

            <Text style={[s.label, { color: colors.textSecondary }]}>التاريخ (YYYY-MM-DD)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={date} onChangeText={setDate} placeholder="2025-01-01" placeholderTextColor={colors.textSecondary} />

            <Text style={[s.label, { color: colors.textSecondary }]}>الفئة</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <Pressable onPress={() => setCategoryId(null)}
                style={[s.catChip, { backgroundColor: categoryId === null ? colors.primary + "25" : colors.surfaceAlt, borderColor: categoryId === null ? colors.primary : colors.border }]}>
                <Text style={{ color: categoryId === null ? colors.primary : colors.textSecondary, fontSize: 13, fontFamily: "ArabicRegular" }}>بدون</Text>
              </Pressable>
              {categories.map((c) => (
                <Pressable key={c.id} onPress={() => setCategoryId(c.id)}
                  style={[s.catChip, { backgroundColor: categoryId === c.id ? c.color + "25" : colors.surfaceAlt, borderColor: categoryId === c.id ? c.color : colors.border }]}>
                  <Icon name={c.icon} size={14} color={categoryId === c.id ? c.color : colors.textSecondary} />
                  <Text style={{ color: categoryId === c.id ? c.color : colors.textSecondary, fontSize: 13, fontFamily: "ArabicRegular", marginLeft: 4 }}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[s.label, { color: colors.textSecondary }]}>ملاحظة (اختياري)</Text>
            <TextInput style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              value={note} onChangeText={setNote} placeholder="ملاحظة..." placeholderTextColor={colors.textSecondary} />

            <View style={s.actions}>
              <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={[s.cancelText, { color: colors.textSecondary }]}>إلغاء</Text>
              </Pressable>
              <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} disabled={saving}
                onPress={() => {
                  const amt = numericInput(amount);
                  if (!amount || isNaN(amt) || amt <= 0) { Alert.alert("خطأ", "أدخل مبلغاً صحيحاً"); return; }
                  if (!description.trim()) { Alert.alert("خطأ", "الوصف مطلوب"); return; }
                  onSave({ amount: amt, description: description.trim(), categoryId, date, note: note.trim() || undefined });
                }}>
                {saving ? <ActivityIndicator size="small" color={colors.background} /> :
                  <Text style={[s.saveText, { color: colors.buttonText }]}>حفظ</Text>}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function SettingRow({ label, children, colors, last }: { label: string; children: React.ReactNode; colors: any; last?: boolean }) {
  return (
    <View style={[s.settingRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text style={[s.settingLabel, { color: colors.text }]}>{label}</Text>
      <View style={{ alignItems: "flex-end" }}>{children}</View>
    </View>
  );
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? insets.bottom;
  const { colors, isDark, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [googleClientId, setGoogleClientId] = useState("");
  const router = useRouter();
  const params = useLocalSearchParams<{panel?:string}>();
  const [panel] = useState<'home'|'all'|'money'|'ai'|'settings'|'backup'>(()=>['money','ai','settings','backup'].includes(params.panel??'')?params.panel as 'money'|'ai'|'settings'|'backup':'home');
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [expModal, setExpModal] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [showOKey, setShowOKey] = useState(false);
  const [showGKey, setShowGKey] = useState(false);
  const [savingKey, setSavingKey] = useState<"openai" | "gemini" | null>(null);
  const [goalInput, setGoalInput] = useState("");
  const [busyBackup, setBusyBackup] = useState<"export" | "import" | null>(null);
  const [driveModal, setDriveModal] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveBackupFile[]>([]);
  const [logModal, setLogModal] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: monthStats } = useQuery({ queryKey: ["stats", "calendarMonth"], queryFn: () => getStats("calendarMonth") });
  const { data: recentExpenses = [] } = useQuery({ queryKey: ["expenses", "recent-admin"], queryFn: () => getExpenses({ limit: 5 }) });
  const { data: notifLog = [], refetch: refetchLog } = useQuery<NotificationLogEntry[]>({
    queryKey: ["notif-log"],
    queryFn: () => getNotificationLog(50),
  });

  const openDriveRestore = async () => {
    setDriveModal(true);
    setDriveLoading(true);
    const r = await listDriveBackups();
    setDriveLoading(false);
    if (!r.ok) {
      Alert.alert("خطأ", r.error ?? "");
      setDriveModal(false);
      return;
    }
    setDriveFiles(r.files ?? []);
  };

  const askRestoreMode = (file: DriveBackupFile) => {
    Alert.alert(file.name, "اختر طريقة الاستعادة:", [
      { text: "إلغاء", style: "cancel" },
      { text: "دمج", onPress: async () => {
        const r = await restoreFromDriveFile(file.id, "merge");
        Alert.alert(r.ok ? "✓" : "خطأ", r.ok ? "تمت الاستعادة" : (r.error ?? ""));
        if (r.ok) { setDriveModal(false); queryClient.invalidateQueries(); }
      }},
      { text: "استبدال", style: "destructive", onPress: async () => {
        const r = await restoreFromDriveFile(file.id, "replace");
        Alert.alert(r.ok ? "✓" : "خطأ", r.ok ? "تمت الاستعادة" : (r.error ?? ""));
        if (r.ok) { setDriveModal(false); queryClient.invalidateQueries(); }
      }},
    ]);
  };

  const askDeleteBackup = (file: DriveBackupFile) => {
    Alert.alert("حذف", `حذف "${file.name}" من Drive؟`, [
      { text: "إلغاء", style: "cancel" },
      { text: "حذف", style: "destructive", onPress: async () => {
        const r = await deleteDriveBackup(file.id);
        if (r.ok) {
          setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
        } else {
          Alert.alert("خطأ", r.error ?? "");
        }
      }},
    ]);
  };

  React.useEffect(() => {
    getAPIKey("openai").then((k) => { if (k) setOpenaiKey(k); }).catch(() => {});
    getAPIKey("gemini").then((k) => { if (k) setGeminiKey(k); }).catch(() => {});
  }, []);

  React.useEffect(() => { setGoogleClientId(settings?.googleClientId ?? ""); }, [settings?.googleClientId]);

  React.useEffect(() => {
    if (settings?.monthlyGoal != null) setGoalInput(String(settings.monthlyGoal));
  }, [settings?.monthlyGoal]);

  const handleExportBackup = async () => {
    try {
      setBusyBackup("export");
      const json = await exportBackup();
      const stamp = localDate();
      const path = FileSystem.cacheDirectory + `hossmoney-backup-${stamp}.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await updateSetting("localLastBackupAt",String(Date.now()));
      await queryClient.invalidateQueries({queryKey:["backup-status"]});
      const can = await Sharing.isAvailableAsync();
      if (can) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "نسخة احتياطية H0sS-Money" });
      } else {
        Alert.alert("تم الحفظ", path);
      }
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setBusyBackup(null);
    }
  };

  const handleImportBackup = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const uri = res.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      Alert.alert("استيراد", "اختر طريقة الاستيراد:", [
        { text: "إلغاء", style: "cancel" },
        { text: "دمج (إضافة)", onPress: () => doImport(json, "merge") },
        { text: "استبدال الكل", style: "destructive", onPress: () => doImport(json, "replace") },
      ]);
    } catch (e: any) {
      Alert.alert("خطأ", e.message ?? "فشل الاستيراد");
    }
  };

  const doImport = async (json: string, mode: "merge" | "replace") => {
    try {
      setBusyBackup("import");
      const r = await importBackup(json, mode);
      queryClient.invalidateQueries();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("تم ✓", `تم استيراد ${r.expenses} مصروف و ${r.categories} فئة`);
    } catch (e: any) {
      Alert.alert("خطأ", e.message);
    } finally {
      setBusyBackup(null);
    }
  };

  const handleSaveGoal = async () => {
    const v = numericInput(goalInput);
    if (goalInput && (isNaN(v) || v < 0)) { Alert.alert("خطأ", "أدخل رقماً صحيحاً"); return; }
    await setSetting("monthlyGoal", goalInput && v > 0 ? String(v) : "");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const createCatMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCatModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setCatModal(false);
      setEditingCat(null);
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const deleteCatMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (error: Error) => Alert.alert("خطأ", error.message),
  });

  const createExpMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
      setExpModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const updateExpMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
      setExpModal(false);
      setEditingExp(null);
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const deleteExpMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
    },
  });

  const handleSaveKey = async (provider: "openai" | "gemini") => {
    const key = provider === "openai" ? openaiKey : geminiKey;
    if (!key.trim()) { Alert.alert("خطأ", "أدخل المفتاح"); return; }
    setSavingKey(provider);
    try { await saveAPIKey(provider, key.trim()); Alert.alert("تم ✓", "تم حفظ المفتاح بأمان"); }
    catch { Alert.alert("خطأ", "فشل حفظ المفتاح"); }
    setSavingKey(null);
  };

  const setSetting = async (key: string, value: string) => {
    await updateSetting(key, value);
    queryClient.invalidateQueries({ queryKey: ["settings"] });
  };

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = await manipulateAsync(result.assets[0].uri, [{ resize: { width: 512 } }], { compress: 0.8, format: SaveFormat.PNG, base64: true });
        if (!asset.base64) throw new Error("الصورة غير صالحة");
        await setSetting("logoBase64", `data:${"image/png"};base64,${asset.base64}`);
        await setSetting("logoUri", "");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert("خطأ", "فشل اختيار الصورة");
    }
  };

  const currency = settings?.currency ?? "EGP";
  const fingerprint = settings?.fingerprintEnabled ?? false;
  const notifsEnabled = settings?.notificationsEnabled ?? false;

  const handleToggleNotifs = async (v: boolean) => {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert("صلاحية مرفوضة", "فعّل صلاحية الإشعارات من إعدادات الجهاز عشان تستقبل تنبيهات الميزانية.");
        return;
      }
    }
    await setSetting("notificationsEnabled", v ? "true" : "false");
    Haptics.selectionAsync();
  };
  const aiProvider = settings?.aiProvider ?? "openai";
  const logoUri = settings?.logoBase64 || settings?.logoUri || null;
  if(panel==='home')return <View style={[s.container,{backgroundColor:colors.background,paddingTop:insets.top}]}><ScrollView contentContainerStyle={{paddingBottom:tabBarHeight+20}}><PageHeader title="الإعدادات" subtitle="اختر القسم الذي تريد إدارته" icon="settings"/>
   {[{title:'الأموال',rows:[['الإيرادات والمصروفات','ledger','grid'],['الحسابات والأرصدة','accounts','credit-card'],['الدخل','income','trending-up'],['الديون والسداد','debts','users'],['المصاريف المتكررة','recurring','repeat']]},{title:'التطبيق',rows:[['الميزانيات والفئات','money','tag'],['الذكاء الاصطناعي','ai','cpu'],['النسخ والبيانات','backup','database'],['المظهر والأمان','settings','shield']]}].map(group=><View key={group.title} style={{paddingHorizontal:16,marginBottom:16}}><Text style={{color:colors.textSecondary,fontFamily:'ArabicBold',textAlign:'right',marginBottom:10}}>{group.title}</Text><View style={{borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}>{group.rows.map(([label,id,icon],i)=><Pressable key={id} onPress={()=>router.push({pathname:['ledger','accounts','income','debts','recurring'].includes(id)?'/finance':'/settings',params:['ledger','accounts','income','debts','recurring'].includes(id)?{section:id}:{panel:id}})} style={{flexDirection:'row',alignItems:'center',gap:12,padding:16,borderTopWidth:i?1:0,borderColor:colors.border}}><Icon name="chevron-left" size={18} color={colors.textSecondary}/><Text style={{flex:1,textAlign:'right',color:colors.text,fontFamily:'ArabicBold'}}>{label}</Text><Icon name={icon} size={20} color={colors.primary}/></Pressable>)}</View></View>)}
   <Text style={{color:colors.textSecondary,textAlign:'center',fontFamily:'ArabicRegular',fontSize:12}}>H0sS-Money {Constants.expoConfig?.version ?? '1.2.3'} · بياناتك محفوظة محليًا</Text>
  </ScrollView></View>;


  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }} showsVerticalScrollIndicator={false}>
        <PageHeader title={panel==='money'?'الميزانيات والفئات':panel==='ai'?'الذكاء الاصطناعي':panel==='backup'?'النسخ والبيانات':'المظهر والأمان'} subtitle="إعدادات واضحة، وكل تغيير محفوظ على جهازك" icon="settings" actions={<Pressable accessibilityLabel="رجوع للإعدادات" onPress={()=>router.back()} style={{padding:12}}><Icon name="arrow-left" size={22} color={colors.text}/></Pressable>} />

        {(panel === "all" || panel === "settings") && <>
        {/* Logo */}
        <Text style={[s.sec, { color: colors.primary }]}>شعارك داخل التطبيق</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "center" }]}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={s.logoPreview} resizeMode="contain" />
          ) : (
            <View style={[s.logoPlaceholder, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Icon name="image" size={32} color={colors.textSecondary} />
              <Text style={[s.logoPlaceholderText, { color: colors.textSecondary }]}>لا يوجد شعار</Text>
            </View>
          )}
          <Pressable style={[s.logoBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}
            onPress={handlePickLogo}>
            <Icon name="upload" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontFamily: "ArabicBold", fontSize: 14, marginLeft: 6 }}>
              {logoUri ? "تغيير الشعار" : "رفع شعار"}
            </Text>
          </Pressable>
          {logoUri && (
            <Pressable onPress={async () => { await setSetting("logoBase64", ""); await setSetting("logoUri", ""); }} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.error, fontSize: 12, fontFamily: "ArabicRegular" }}>إزالة الشعار</Text>
            </Pressable>
          )}
        </View>

        </>}
        {(panel === "all" || panel === "ai") && <>
        <Text style={[s.sec, { color: colors.primary }]}>الذكاء الاصطناعي</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><AISettings /></View>

        </>}
        {(panel === "all" || panel === "settings") && <>
        {/* Settings */}
        <Text style={[s.sec, { color: colors.primary }]}>إعدادات التطبيق</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow label="الوضع الداكن" colors={colors}>
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </SettingRow>
          <SettingRow label="قفل بالبصمة" colors={colors}>
            <Switch value={fingerprint} onValueChange={async (v) => {
                if (v) {
                  if (!(await LocalAuthentication.hasHardwareAsync()) || !(await LocalAuthentication.isEnrolledAsync())) { Alert.alert("البصمة غير جاهزة", "أضف بصمة من إعدادات الجهاز أولًا"); return; }
                  const result = await LocalAuthentication.authenticateAsync({ promptMessage: "تأكيد تفعيل القفل", disableDeviceFallback: false });
                  if (!result.success) return;
                }
                await setSetting("fingerprintEnabled", v ? "true" : "false");
              }}
              trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </SettingRow>
          <SettingRow label="تنبيهات الميزانية" colors={colors}>
            <Switch value={notifsEnabled} onValueChange={handleToggleNotifs}
              trackColor={{ true: colors.primary }} thumbColor="#fff" />
          </SettingRow>
          <SettingRow label="العملة" colors={colors} last>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["EGP", "USD", "SAR"].map((c) => (
                <Pressable key={c} onPress={() => setSetting("currency", c)}
                  style={[s.currBtn, { backgroundColor: currency === c ? colors.primary : colors.surfaceAlt, borderColor: currency === c ? colors.primary : colors.border }]}>
                  <Text style={{ color: currency === c ? colors.background : colors.textSecondary, fontSize: 12, fontFamily: "ArabicBold" }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </SettingRow>
        </View>

        </>}
        {(panel === "all" || panel === "money") && <>
        {/* Monthly Savings Goal */}
        <Text style={[s.sec, { color: colors.primary }]}>الهدف الشهري</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
            حدد سقف إنفاق شهري وراقب تقدمك (اتركه فارغاً للتعطيل)
          </Text>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TextInput
              style={[s.keyInput, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text, flex: 1 }]}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="numeric"
              placeholder={`مثال: 5000 ${currency}`}
              placeholderTextColor={colors.textSecondary}
            />
            <Pressable style={[s.keyBtn, { backgroundColor: colors.primary, paddingHorizontal: 18, marginBottom: 0 }]} onPress={handleSaveGoal}>
              <Text style={{ color: colors.buttonText, fontFamily: "ArabicBold", fontSize: 13 }}>حفظ</Text>
            </Pressable>
          </View>
          {settings?.monthlyGoal != null && (
            <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 10, fontFamily: "ArabicRegular" }}>
              ✓ الحلقة المتحركة تظهر في الشاشة الرئيسية
            </Text>
          )}
        </View>

        </>}
        {(panel === "all" || panel === "settings") && <>
        {/* Notifications Log */}
        <Text style={[s.sec, { color: colors.primary }]}>سجل التنبيهات</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
            آخر التنبيهات اللي وصلت لك ({notifLog.length})
          </Text>
          {notifLog.length === 0 ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular", textAlign: "center", paddingVertical: 8 }}>
              لا توجد تنبيهات بعد
            </Text>
          ) : (
            <>
              {notifLog.slice(0, 3).map((n, i) => (
                <View key={n.id} style={[s.logRow, i < Math.min(2, notifLog.length - 1) && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.logTitle, { color: colors.text }]} numberOfLines={1}>{n.title}</Text>
                    <Text style={[s.logBody, { color: colors.textSecondary }]} numberOfLines={1}>{n.body}</Text>
                  </View>
                  <Text style={[s.logDate, { color: colors.textSecondary }]}>
                    {new Date(n.created_at + "Z").toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                  </Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <Pressable
                  style={[s.keyBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, flex: 1, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }]}
                  onPress={() => { refetchLog(); setLogModal(true); }}
                >
                  <Icon name="list" size={14} color={colors.text} />
                  <Text style={{ color: colors.text, fontFamily: "ArabicBold", fontSize: 12 }}>عرض الكل</Text>
                </Pressable>
                <Pressable
                  style={[s.keyBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.error, paddingHorizontal: 14, marginBottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                  onPress={() => Alert.alert("مسح السجل", "حذف كل التنبيهات؟", [
                    { text: "إلغاء", style: "cancel" },
                    { text: "مسح", style: "destructive", onPress: async () => {
                      await clearNotificationLog();
                      refetchLog();
                    }},
                  ])}
                >
                  <Icon name="trash-2" size={14} color={colors.error} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        </>}
        {(panel === "all" || panel === "backup") && <>
        <BackupStatus/>
        {/* Google Drive Backup */}
        <Text style={[s.sec, { color: colors.primary }]}>نسخ Google Drive</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!settings?.driveAccessToken && !settings?.driveNativeAuth ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: "ArabicRegular", marginBottom: 12, lineHeight: 22 }}>
                اختر حساب Google الموجود على هاتفك ووافق على حفظ نسخ التطبيق. التطبيق يطلب الوصول للملفات التي ينشئها فقط.
              </Text>
              {Platform.OS !== "android" && <TextInput style={[s.input, {backgroundColor:colors.surfaceAlt,borderColor:colors.border,color:colors.text,marginBottom:10}]} placeholder="Google OAuth Client ID" value={googleClientId} onChangeText={setGoogleClientId} autoCapitalize="none" autoCorrect={false}/>}
              <Pressable
                style={[s.keyBtn, { backgroundColor: colors.primary, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }]}
                disabled={driveLoading}
                onPress={async () => {
                  const cid = googleClientId.trim();
                  if (Platform.OS !== "android" && !cid) { Alert.alert("تنبيه", "أدخل Client ID أولاً"); return; }
                  let ok = false;
                  setDriveLoading(true);
                  try { ok = await connectDrive(cid); } catch (error) { Alert.alert("ربط Google", error instanceof Error ? error.message : "فشل الربط"); return; } finally { setDriveLoading(false); }
                  if (ok) {
                    Alert.alert("✓", "تم الربط بنجاح");
                    queryClient.invalidateQueries({ queryKey: ["settings"] });
                  }
                }}
              >
                <Icon name="link" size={15} color={colors.background} />
                <Text style={{ color: colors.buttonText, fontFamily: "ArabicBold", fontSize: 13 }}>{driveLoading ? "جارٍ الربط..." : "الربط بحساب Google"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontFamily: "ArabicBold" }}>متصل ✓ {settings.driveAccountEmail ?? ""}</Text>
                {settings.driveLastBackupAt && (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, fontFamily: "ArabicRegular" }}>
                    آخر نسخة: {new Date(Number(settings.driveLastBackupAt)).toLocaleString("ar-EG")}
                  </Text>
                )}
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4, fontFamily: "ArabicRegular" }}>
                  النسخ يدوي فقط — اضغط "ارفع الآن" متى أردت
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  style={[s.keyBtn, { backgroundColor: colors.primary, flex: 1, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }]}
                  onPress={async () => {
                    const r = await uploadBackupToDrive();
                    Alert.alert(r.ok ? "✓" : "خطأ", r.ok ? `تم رفع ${r.fileName}` : (r.error ?? ""));
                    if (r.ok) queryClient.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  <Icon name="upload-cloud" size={14} color={colors.background} />
                  <Text style={{ color: colors.buttonText, fontFamily: "ArabicBold", fontSize: 12 }}>ارفع الآن</Text>
                </Pressable>
                <Pressable
                  style={[s.keyBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, flex: 1, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }]}
                  onPress={openDriveRestore}
                >
                  <Icon name="download-cloud" size={14} color={colors.text} />
                  <Text style={{ color: colors.text, fontFamily: "ArabicBold", fontSize: 12 }}>استرجع نسخة</Text>
                </Pressable>
                <Pressable
                  style={[s.keyBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.error, paddingHorizontal: 12, marginBottom: 0, alignItems: "center", justifyContent: "center" }]}
                  onPress={async () => {
                    await clearDriveAuth();
                    queryClient.invalidateQueries({ queryKey: ["settings"] });
                  }}
                >
                  <Icon name="log-out" size={14} color={colors.error} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        </>}
        {(panel === "all" || panel === "backup") && <>
        {/* Backup & Restore */}
        <Text style={[s.sec, { color: colors.primary }]}>النسخ الاحتياطي</Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 12 }]}>
            احفظ كل بياناتك (مصاريف + فئات + إعدادات) في ملف JSON تقدر ترجعه على أي جهاز
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              style={[s.keyBtn, { backgroundColor: colors.primary, flex: 1, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }]}
              onPress={handleExportBackup}
              disabled={busyBackup !== null}
            >
              {busyBackup === "export" ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Icon name="download" size={15} color={colors.background} />
                  <Text style={{ color: colors.buttonText, fontFamily: "ArabicBold", fontSize: 13 }}>تصدير نسخة</Text>
                </>
              )}
            </Pressable>
            <Pressable
              style={[s.keyBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primary, flex: 1, marginBottom: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }]}
              onPress={handleImportBackup}
              disabled={busyBackup !== null}
            >
              {busyBackup === "import" ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Icon name="upload" size={15} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontFamily: "ArabicBold", fontSize: 13 }}>استيراد</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        </>}
        {(panel === "all" || panel === "money") && <>
        {/* Categories */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 8, marginBottom: 8 }}>
          <Text style={[s.sec, { marginHorizontal: 0, marginTop: 0, color: colors.primary }]}>الفئات ({categories.length})</Text>
          <Pressable onPress={() => { setEditingCat(null); setCatModal(true); }}
            style={[s.addBtn, { backgroundColor: colors.primary + "20", borderColor: colors.primary }]}>
            <Icon name="plus" size={15} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "ArabicBold" }}>إضافة</Text>
          </Pressable>
        </View>

        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {categories.map((cat, idx) => (
            <View key={cat.id}
              style={[s.catRow, idx < categories.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[s.catIcon, { backgroundColor: cat.color + "20" }]}>
                <Icon name={cat.icon} size={18} color={cat.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.catName, { color: colors.text }]}>{cat.name}</Text>
                {cat.budget != null && (
                  <Text style={[s.catBudget, { color: colors.textSecondary }]}>
                    ميزانية: {Number(cat.budget).toFixed(0)} {currency}/شهر
                  </Text>
                )}
              </View>
              <Pressable onPress={() => { setEditingCat(cat); setCatModal(true); }} hitSlop={10} style={{ marginLeft: 10 }}>
                <Icon name="edit-2" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={() => Alert.alert("حذف", `حذف "${cat.name}"؟`, [
                { text: "إلغاء", style: "cancel" },
                { text: "حذف", style: "destructive", onPress: () => deleteCatMutation.mutate(cat.id) },
              ])} hitSlop={10} style={{ marginLeft: 10 }}>
                <Icon name="trash-2" size={16} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </View>
        </>}
      </ScrollView>

      <CategoryModal
        visible={catModal}
        category={editingCat}
        colors={colors}
        saving={createCatMutation.isPending || updateCatMutation.isPending}
        onClose={() => { setCatModal(false); setEditingCat(null); }}
        onSave={(data) => editingCat ? updateCatMutation.mutate({ id: editingCat.id, data }) : createCatMutation.mutate(data)}
      />

      <ExpenseModal
        visible={expModal}
        expense={editingExp}
        categories={categories}
        colors={colors}
        saving={createExpMutation.isPending || updateExpMutation.isPending}
        onClose={() => { setExpModal(false); setEditingExp(null); }}
        onSave={(data) => editingExp ? updateExpMutation.mutate({ id: editingExp.id, data }) : createExpMutation.mutate(data)}
      />

      {/* Drive backup picker modal */}
      <Modal visible={driveModal} transparent animationType="slide" onRequestClose={() => setDriveModal(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: colors.surface, maxHeight: "80%" }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>اختر النسخة للاسترجاع</Text>
            {driveLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 30 }} />
            ) : driveFiles.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingVertical: 20, fontFamily: "ArabicRegular" }}>
                لا توجد نسخ احتياطية على Drive
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {driveFiles.map((f) => (
                  <View key={f.id} style={[s.driveRow, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={() => askRestoreMode(f)} style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 13, fontFamily: "ArabicBold" }} numberOfLines={1}>{f.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 3, fontFamily: "ArabicRegular" }}>
                        {new Date(f.createdTime).toLocaleString("ar-EG")}
                        {f.size ? ` • ${Math.round(Number(f.size) / 1024)} KB` : ""}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => askDeleteBackup(f)} hitSlop={10} style={{ paddingHorizontal: 8 }}>
                      <Icon name="trash-2" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={[s.cancelBtn, { borderColor: colors.border, marginTop: 14 }]}
              onPress={() => setDriveModal(false)}
            >
              <Text style={[s.cancelText, { color: colors.textSecondary }]}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Notification log full modal */}
      <Modal visible={logModal} transparent animationType="slide" onRequestClose={() => setLogModal(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: colors.surface, maxHeight: "85%" }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>سجل التنبيهات ({notifLog.length})</Text>
            {notifLog.length === 0 ? (
              <Text style={{ color: colors.textSecondary, textAlign: "center", paddingVertical: 20, fontFamily: "ArabicRegular" }}>
                لا توجد تنبيهات
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 480 }}>
                {notifLog.map((n) => (
                  <View key={n.id} style={[s.logFullRow, { borderBottomColor: colors.border }]}>
                    <Text style={{ color: colors.text, fontSize: 13, fontFamily: "ArabicBold" }}>{n.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4, fontFamily: "ArabicRegular" }}>{n.body}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 6, fontFamily: "ArabicRegular" }}>
                      {new Date(n.created_at + "Z").toLocaleString("ar-EG")}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable
              style={[s.cancelBtn, { borderColor: colors.border, marginTop: 14 }]}
              onPress={() => setLogModal(false)}
            >
              <Text style={[s.cancelText, { color: colors.textSecondary }]}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 22, fontFamily: "ArabicBold" },
  sec: { fontSize: 15, fontFamily: "ArabicBold", textAlign: "right", marginHorizontal: 20, marginTop: 22, marginBottom: 12 },
  card: { marginHorizontal: 16, borderRadius: 22, borderWidth: 1, padding: 20, marginBottom: 4 },
  cardLabel: { fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 2 },
  label: { fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 6 },
  keyRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  keyInput: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "ArabicRegular" },
  keyBtn: { borderRadius: 12, padding: 12, alignItems: "center", marginBottom: 4 },
  provBtn: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  settingLabel: { fontSize: 14, fontFamily: "ArabicRegular" },
  currBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  catRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  catIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catName: { fontSize: 14, fontFamily: "ArabicRegular" },
  catBudget: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorSel: { borderWidth: 3, borderColor: "#fff", elevation: 4 },
  iconChip: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", marginRight: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 18, fontFamily: "ArabicBold", textAlign: "center", marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "ArabicRegular", marginBottom: 4, textAlign: "right" },
  actions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "ArabicRegular" },
  saveBtn: { flex: 2, borderRadius: 14, padding: 14, alignItems: "center" },
  saveText: { fontSize: 15, fontFamily: "ArabicBold" },
  statsRow: { flexDirection: "row" },
  statBox: { flex: 1, alignItems: "center", paddingVertical: 8 },
  statVal: { fontSize: 26, fontFamily: "ArabicBold" },
  statLbl: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 2 },
  catStatRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catStatName: { flex: 1, fontSize: 13, fontFamily: "ArabicRegular" },
  catStatAmt: { fontSize: 13, fontFamily: "ArabicBold" },
  logoPreview: { width: 100, height: 100, borderRadius: 20, marginBottom: 12 },
  logoPlaceholder: { width: 100, height: 100, borderRadius: 20, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  logoPlaceholderText: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 6 },
  logoBtn: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  expRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  expDesc: { fontSize: 13, fontFamily: "ArabicRegular" },
  expDate: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 2 },
  expAmt: { fontSize: 14, fontFamily: "ArabicBold" },
  emptyText: { fontSize: 13, fontFamily: "ArabicRegular", textAlign: "center", paddingVertical: 16 },
  catChip: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  logRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  logTitle: { fontSize: 12, fontFamily: "ArabicBold" },
  logBody: { fontSize: 11, fontFamily: "ArabicRegular", marginTop: 2 },
  logDate: { fontSize: 10, fontFamily: "ArabicRegular" },
  logFullRow: { paddingVertical: 12, borderBottomWidth: 1 },
  driveRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
});
