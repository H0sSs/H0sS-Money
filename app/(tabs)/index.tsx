import { useRouter } from "expo-router";
import { getAccounts } from "@/lib/finance";
import PageHeader from "@/components/PageHeader";
import { numericInput, validAmount } from "@/lib/validation";
import { localDate, parseDate } from "@/lib/dates";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withSpring,
} from "react-native-reanimated";
import Icon from "@/components/Icon";
import MonthlyGoalRing from "@/components/MonthlyGoalRing";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getExpenses,
  getStats,
  createExpense,
  getCategories,
  getSettings,
  getCategoryHint,
  getWeeklySummary,
} from "@/lib/services";
import { parseVoiceExpense, generateVoiceSummary } from "@/lib/ai";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function formatArabicDate(dateStr: string) {
  const d = parseDate(dateStr);
  return d.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" });
}

// ─── Today Summary Card ───────────────────────────────────────
function TodaySummary({ colors }: { colors: any }) {
  const today = localDate();
  const { data: stats } = useQuery({
    queryKey: ["stats", "day", today],
    queryFn: () => getStats("day", today),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  const currency = settings?.currency ?? "EGP";
  const total = stats?.total ?? 0;
  const count = stats?.count ?? 0;

  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleVoiceSummary = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }
    try {
      setIsSpeaking(true);
      const provider = settings?.aiProvider ?? "gemini";
      const text = await generateVoiceSummary(total, count, currency, provider);
      Speech.speak(text, {
        language: "ar",
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch {
      const fallback = `أنفقت اليوم ${total.toFixed(2)} ${currency}`;
      Speech.speak(fallback, { language: "ar", onDone: () => setIsSpeaking(false) });
    }
  };

  return (
    <View style={[s.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.summaryRow}>
        <View>
          <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>إنفاق اليوم</Text>
          <Text style={[s.summaryAmount, { color: colors.text }]}>
            {total.toFixed(2)}{" "}
            <Text style={{ color: colors.primary, fontSize: 18 }}>{currency}</Text>
          </Text>
          <Text style={[s.summaryCount, { color: colors.textSecondary }]}>{count} عملية</Text>
        </View>
        <Pressable
          onPress={handleVoiceSummary}
          style={[s.speakBtn, { backgroundColor: isSpeaking ? colors.primary + "30" : colors.surfaceAlt, borderColor: colors.primary }]}
          hitSlop={12}
        >
          <Icon name={isSpeaking ? "volume-x" : "volume-2"} size={18} color={colors.primary} />
          <Text style={[s.speakBtnText, { color: colors.primary }]}>{isSpeaking ? "إيقاف" : "اسمع"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Weekly Summary Card (Task #8) ────────────────────────────
function WeeklySummaryCard({ colors }: { colors: any }) {
  const { data: summary } = useQuery({ queryKey: ["weeklySummary"], queryFn: () => getWeeklySummary() });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const currency = settings?.currency ?? "EGP";

  if (!summary || summary.count === 0) return null;

  const up = summary.diff > 0;
  const trendColor = up ? colors.error : "#10B981";
  const trendIcon = up ? "trending-up" : "trending-down";

  return (
    <View style={[s.weeklyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.weeklyHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="calendar" size={14} color={colors.primary} />
          <Text style={[s.weeklyTitle, { color: colors.primary }]}>ملخص آخر 7 أيام</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Icon name={trendIcon} size={13} color={trendColor} />
          <Text style={{ color: trendColor, fontSize: 12, fontFamily: "ArabicBold" }}>
            {summary.diffPct > 0 ? "+" : ""}{summary.diffPct.toFixed(0)}%
          </Text>
        </View>
      </View>
      <Text style={[s.weeklyTotal, { color: colors.text }]}>
        {summary.total.toFixed(2)} <Text style={{ color: colors.primary, fontSize: 14 }}>{currency}</Text>
      </Text>
      <Text style={[s.weeklySub, { color: colors.textSecondary }]}>
        {summary.count} عملية • متوسط {summary.avgPerDay.toFixed(2)} {currency}/يوم
      </Text>
      {summary.topCategory && (
        <View style={[s.weeklyRow, { borderTopColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <View style={[s.weeklyDot, { backgroundColor: summary.topCategory.color }]} />
            <Text style={[s.weeklyRowLabel, { color: colors.textSecondary }]}>أكثر فئة</Text>
            <Text style={[s.weeklyRowValue, { color: colors.text }]} numberOfLines={1}>
              {summary.topCategory.name}
            </Text>
          </View>
          <Text style={[s.weeklyRowAmt, { color: colors.primary }]}>
            {summary.topCategory.pct.toFixed(0)}%
          </Text>
        </View>
      )}
      {summary.topDay && (
        <View style={[s.weeklyRow, { borderTopColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Icon name="zap" size={12} color={colors.primary} />
            <Text style={[s.weeklyRowLabel, { color: colors.textSecondary }]}>أعلى يوم</Text>
            <Text style={[s.weeklyRowValue, { color: colors.text }]} numberOfLines={1}>
              {summary.busiestDayLabel}
            </Text>
          </View>
          <Text style={[s.weeklyRowAmt, { color: colors.primary }]}>
            {summary.topDay.total.toFixed(2)} {currency}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Confirm Expense Modal ────────────────────────────────────
interface ParsedData {
  amount: number | null;
  description: string;
  categoryName: string | null;
  note: string | null;
  transcript: string;
}

interface ConfirmModalProps {
  visible: boolean;
  parsed: ParsedData | null;
  categories: Array<{ id: number; name: string; icon: string; color: string }>;
  saving: boolean;
  colors: any;
  onCancel: () => void;
  onSave: (data: { amount: number; description: string; categoryId: number | null; note: string | null; date: string; accountId: number }) => void;
}

function ConfirmExpenseModal({ visible, parsed, categories, saving, colors, onCancel, onSave }: ConfirmModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [date,setDate]=useState(localDate());
  const [account,setAccount]=useState(0);
  const {data:accounts=[]}=useQuery({queryKey:['accounts'],queryFn:getAccounts});

  React.useEffect(() => {
    if (parsed) {
      setAmount(parsed.amount != null ? String(parsed.amount) : "");
      setDescription(parsed.description ?? "");
      setNote(parsed.note ?? "");
      setDate(localDate());
      setAccount(0);
      const matched = categories.find(
        (c) => parsed.categoryName && c.name.toLowerCase().includes(parsed.categoryName.toLowerCase())
      );
      setSelectedCategoryId(matched?.id ?? null);
    }
  }, [parsed, categories]);

  const handleSave = () => {
    const num = numericInput(amount);
    if (!validAmount(num) || !description.trim()) {
      Alert.alert("خطأ", "المبلغ والوصف مطلوبان");
      return;
    }
    try{parseDate(date);}catch(e){Alert.alert("التاريخ غير صالح",e instanceof Error?e.message:"");return;}
    const accountId=account||accounts[0]?.id;if(!accountId){Alert.alert("حساب مفقود","أضف حسابًا أولًا");return;}
    onSave({ amount: num, description: description.trim(), categoryId: selectedCategoryId, note: note.trim() || null, date,accountId });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.modalOverlay}>
        <ScrollView keyboardShouldPersistTaps="handled" style={{maxHeight:"90%"}} contentContainerStyle={[s.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[s.modalTitle, { color: colors.text }]}>تأكيد المصروف</Text>

          {!!parsed?.transcript && (
            <View style={[s.transcriptBox, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}>
              <Icon name="mic" size={14} color={colors.primary} />
              <Text style={[s.transcriptText, { color: colors.textSecondary }]} numberOfLines={2}>
                {parsed.transcript}
              </Text>
            </View>
          )}

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>المبلغ</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>الوصف</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={description}
            onChangeText={setDescription}
            placeholder="وصف المصروف"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[s.fieldLabel,{color:colors.textSecondary}]}>تاريخ المصروف YYYY-MM-DD</Text>
          <TextInput accessibilityLabel="تاريخ المصروف" value={date} onChangeText={setDate} style={[s.input,{color:colors.text,backgroundColor:colors.surfaceAlt,borderColor:colors.border,writingDirection:'ltr'}]}/>
          <Text style={[s.fieldLabel,{color:colors.textSecondary}]}>الحساب</Text>
          <ScrollView horizontal contentContainerStyle={{gap:8}} style={{marginBottom:10}}>{accounts.map(a=><Pressable key={a.id} onPress={()=>setAccount(a.id)} style={{padding:10,borderRadius:12,borderWidth:1,borderColor:(account||accounts[0]?.id)===a.id?colors.primary:colors.border}}><Text style={{color:colors.text,fontFamily:'ArabicRegular'}}>{a.name}</Text></Pressable>)}</ScrollView>
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>الفئة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {categories.map((cat) => {
              const sel = selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  style={[s.catChip, { backgroundColor: sel ? cat.color + "25" : colors.surfaceAlt, borderColor: sel ? cat.color : colors.border }]}
                  onPress={() => setSelectedCategoryId(sel ? null : cat.id)}
                >
                  <Icon name={cat.icon} size={13} color={sel ? cat.color : colors.textSecondary} />
                  <Text style={[s.catChipText, { color: sel ? cat.color : colors.textSecondary }]}>{cat.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>ملاحظة (اختياري)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
            value={note}
            onChangeText={setNote}
            placeholder="ملاحظة إضافية"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={s.modalActions}>
            <Pressable style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onCancel}>
              <Text style={[s.cancelBtnText, { color: colors.textSecondary }]}>إلغاء</Text>
            </Pressable>
            <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <Text style={[s.saveBtnText, { color: colors.buttonText }]}>حفظ</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Home Screen ──────────────────────────────────────────────
export default function HomeScreen() {
  const router=useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const [isPreparing, setIsPreparing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: getCategories });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const { data: monthStats } = useQuery({ queryKey: ["stats", "calendarMonth"], queryFn: () => getStats("calendarMonth") });

  const today = localDate();
  const weekAgo = localDate(new Date(Date.now() - 7 * 864e5));
  const { data: recentExpenses = [] } = useQuery({
    queryKey: ["expenses", "recent"],
    queryFn: () => getExpenses({ startDate: weekAgo }),
  });

  const createMutation = useMutation({
    mutationFn: (data: { amount: number; description: string; categoryId: number | null; note: string | null; date: string; accountId:number }) =>
      createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["monthCompare"] });
      queryClient.invalidateQueries({ queryKey: ["weeklySummary"] });
      queryClient.invalidateQueries({ queryKey: ["notif-log"] });
      setShowModal(false);
      setParsedData(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (e: Error) => Alert.alert("خطأ", e.message),
  });

  const startPulse = () => {
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.6, { duration: 800, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 200 })),
      -1, false
    );
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 400 }), withTiming(0, { duration: 600 })),
      -1, false
    );
  };

  const stopPulse = () => {
    pulseScale.value = withTiming(1, { duration: 200 });
    pulseOpacity.value = withTiming(0, { duration: 200 });
  };

  const micBtnStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }], opacity: pulseOpacity.value }));

  const startRecording = async () => {
    if (isParsing || isRecording || isPreparing) return;
    setIsPreparing(true);
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("تنبيه", "يجب السماح للتطبيق بالوصول إلى الميكروفون");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      scale.value = withSpring(0.9);
      startPulse();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn("recording start failed", err);
      Alert.alert("خطأ", "فشل بدء التسجيل");
    } finally { setIsPreparing(false); }
  };

  const stopRecording = async () => {
    if (isParsing || !isRecording) return;
    setIsParsing(true);
    try {
      setIsRecording(false);
      stopPulse();
      scale.value = withSpring(1);
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;
      if (!uri) return;
      const ext = uri.split(".").pop()?.toLowerCase() ?? "m4a";
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const provider = settings?.aiProvider ?? "gemini";
      const result = await parseVoiceExpense(base64, ext, provider, categories, uri, settings?.speechProvider ?? "gemini");
      const hintId = await getCategoryHint(result.description);
      if (hintId && !result.categoryName) {
        const cat = categories.find((c) => c.id === hintId);
        if (cat) result.categoryName = cat.name;
      }
      setParsedData(result);
      setShowModal(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ غير معروف";
      Alert.alert("خطأ في التسجيل", msg);
    } finally {
      setIsParsing(false);
    }
  };

  const currency = settings?.currency ?? "EGP";
  const today_label = formatArabicDate(today);
  const monthlyGoal = settings?.monthlyGoal ?? null;

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }} showsVerticalScrollIndicator={false}>
        <PageHeader title="مصروفك تحت السيطرة" subtitle={today_label} icon="home" logo={settings?.logoBase64 || settings?.logoUri} />

        <TodaySummary colors={colors} />
        <View style={{flexDirection:'row',gap:8,marginHorizontal:16,marginBottom:12}}>{[{label:'الحسابات',section:'accounts'},{label:'إضافة دخل',section:'income'}].map(x=><Pressable key={x.section} onPress={()=>router.push({pathname:'/finance',params:{section:x.section}})} style={{flex:1,padding:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:12}}><Text style={{color:colors.primary,textAlign:'center',fontFamily:'ArabicBold'}}>{x.label}</Text></Pressable>)}</View>

        <View style={[s.micSection, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 28, marginHorizontal: 16, marginBottom: 20 }]}>
          <Text style={[s.micHint, { color: colors.textSecondary }]}>
            {isRecording ? "جاري التسجيل... اضغط للإيقاف" : isPreparing ? "تجهيز الميكروفون..." : isParsing ? "جاري التحليل..." : "اضغط للتسجيل"}
          </Text>

          <View style={s.micWrapper}>
            <Animated.View style={[s.pulse, pulseStyle, { backgroundColor: colors.primary }]} />
            <AnimatedPressable
              style={[s.micBtn, micBtnStyle, { backgroundColor: colors.primary }]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isParsing || isPreparing}
            >
              {isParsing ? (
                <ActivityIndicator color={colors.background} size="large" />
              ) : (
                <Icon name={isRecording ? "square" : "mic"} size={36} color={colors.background} />
              )}
            </AnimatedPressable>
          </View>

          <Text style={[s.exampleText, { color: colors.textSecondary }]}>
            مثال: "اشتريت قهوة بـ 50 جنيه"
          </Text>
        </View>

        <Pressable onPress={() => { setParsedData({ amount: null, description: "", categoryName: null, note: null, transcript: "" }); setShowModal(true); }} style={{ marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 }}><Icon name="plus" size={18} color={colors.primary} /><Text style={{ color: colors.text, fontWeight: "700" }}>إضافة مصروف يدويًا</Text></Pressable>
        <WeeklySummaryCard colors={colors} />

        {monthlyGoal != null && monthlyGoal > 0 && (
          <MonthlyGoalRing
            used={Number(monthStats?.total ?? 0)}
            goal={monthlyGoal}
            currency={currency}
            colors={colors}
          />
        )}

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>آخر المصاريف</Text>
        </View>

        {recentExpenses.length === 0 ? (
          <View style={[s.emptyBox, { borderColor: colors.border }]}>
            <Icon name="inbox" size={32} color={colors.textSecondary} />
            <Text style={[s.emptyText, { color: colors.textSecondary }]}>لا توجد مصاريف بعد</Text>
          </View>
        ) : (
          recentExpenses.slice(0, 8).map((exp) => (
            <View key={exp.id} style={[s.expenseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[s.expCatDot, { backgroundColor: exp.category?.color ?? colors.primary }]} />
              <View style={{ flex: 1 }}>
                <Text style={[s.expDesc, { color: colors.text }]} numberOfLines={1}>{exp.description}</Text>
                <Text style={[s.expCat, { color: colors.textSecondary }]}>{exp.category?.name ?? "بدون فئة"}</Text>
              </View>
              <Text style={[s.expAmount, { color: colors.primary }]}>{Number(exp.amount).toFixed(2)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <ConfirmExpenseModal
        visible={showModal}
        parsed={parsedData}
        categories={categories}
        saving={createMutation.isPending}
        colors={colors}
        onCancel={() => { setShowModal(false); setParsedData(null); }}
        onSave={(data) => createMutation.mutate(data)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  appName: { fontSize: 22, fontFamily: "ArabicBold" },
  dateText: { fontSize: 13, fontFamily: "ArabicRegular" },
  summaryCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: 22, borderWidth: 1, padding: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13, fontFamily: "ArabicRegular", marginBottom: 4 },
  summaryAmount: { fontSize: 36, fontFamily: "ArabicBold" },
  summaryCount: { fontSize: 13, fontFamily: "ArabicRegular", marginTop: 2 },
  speakBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  speakBtnText: { fontSize: 13, fontFamily: "ArabicBold" },
  micSection: { alignItems: "center", paddingVertical: 24 },
  micHint: { fontSize: 15, fontFamily: "ArabicRegular", marginBottom: 24, textAlign: "center" },
  micWrapper: { position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  pulse: { position: "absolute", width: 100, height: 100, borderRadius: 34, opacity: 0 },
  micBtn: { width: 100, height: 100, borderRadius: 34, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#F0B429", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  exampleText: { fontSize: 13, fontFamily: "ArabicRegular", textAlign: "center", marginTop: 4 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "ArabicBold" },
  emptyBox: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "ArabicRegular" },
  expenseRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  expCatDot: { width: 10, height: 10, borderRadius: 5 },
  expDesc: { fontSize: 14, fontFamily: "ArabicRegular" },
  expCat: { fontSize: 12, fontFamily: "ArabicRegular", marginTop: 2 },
  expAmount: { fontSize: 16, fontFamily: "ArabicBold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  modalTitle: { fontSize: 18, fontFamily: "ArabicBold", textAlign: "center", marginBottom: 16 },
  transcriptBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  transcriptText: { flex: 1, fontSize: 13, fontFamily: "ArabicRegular" },
  fieldLabel: { fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, fontFamily: "ArabicRegular", marginBottom: 4, textAlign: "right" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
  catChipText: { fontSize: 12, fontFamily: "ArabicRegular" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  cancelBtnText: { fontSize: 15, fontFamily: "ArabicRegular" },
  saveBtn: { flex: 2, borderRadius: 14, padding: 14, alignItems: "center" },
  saveBtnText: { fontSize: 15, fontFamily: "ArabicBold" },
  weeklyCard: { marginHorizontal: 16, marginBottom: 20, borderRadius: 22, borderWidth: 1, padding: 20 },
  weeklyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  weeklyTitle: { fontSize: 12, fontFamily: "ArabicBold", textTransform: "uppercase",  },
  weeklyTotal: { fontSize: 26, fontFamily: "ArabicBold" },
  weeklySub: { fontSize: 12, fontFamily: "ArabicRegular", marginTop: 4 },
  weeklyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 10, marginTop: 10, borderTopWidth: 1 },
  weeklyDot: { width: 9, height: 9, borderRadius: 5 },
  weeklyRowLabel: { fontSize: 11, fontFamily: "ArabicRegular" },
  weeklyRowValue: { fontSize: 12, fontFamily: "ArabicRegular", flex: 1 },
  weeklyRowAmt: { fontSize: 13, fontFamily: "ArabicBold" },
});
