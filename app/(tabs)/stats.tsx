import { Text, TextInput } from "@/components/Typography";
import PageHeader from "@/components/PageHeader";
import { buildStatsReport } from "@/lib/statsReport";
import { reportAssets } from "@/lib/reportAssets";
import { getIncomes, getAccounts } from "@/lib/finance";
import { localDate, parseDate, monthRange } from "@/lib/dates";
import React, { useState, useMemo, useRef } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, useWindowDimensions, Modal, Alert, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Svg, {
  Rect,
  Text as SvgText,
  G,
  Circle,
  Path,
  Line,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { printPdf } from "@/lib/printPdf";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { getStats, getSettings, getMonthComparison, getExpenses, type Expense } from "@/lib/services";
import Icon from "@/components/Icon";

const PERIODS = [
  { key: "week", label: "أسبوع" },
  { key: "month", label: "30 يوم" },
  { key: "calendarMonth", label: "الشهر الحالي" },
  { key: "custom", label: "فترة" },
] as const;

const CHART_W = 340;

function EmptyState({ colors, label }: { colors: any; label: string }) {
  return (
    <View style={{ alignItems: "center", padding: 28 }}>
      <Icon name="bar-chart-2" size={36} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, marginTop: 10, fontFamily: "ArabicRegular" }}>
        {label}
      </Text>
    </View>
  );
}

function LineChart({
  data,
  colors,
  onPointPress,
}: {
  data: { date: string; total: number }[];
  colors: any;
  onPointPress?: (date: string) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  if (!data || data.length === 0) return <EmptyState colors={colors} label="لا توجد بيانات لعرضها" />;
  const width = Math.min(600, Math.max(220, screenWidth - 72));
  const height = 180;
  const padL = 36;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const niceMax = Math.ceil(maxVal / 5) * 5 || maxVal;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = padL + i * stepX;
    const y = padT + innerH - (d.total / niceMax) * innerH;
    return { x, y, ...d };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x},${padT + innerH} L ${points[0].x},${padT + innerH} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Choose ~6 x labels to avoid crowding
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={0.35} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {gridLines.map((g, i) => {
        const y = padT + innerH * g;
        const val = niceMax * (1 - g);
        return (
          <G key={i}>
            <Line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke={colors.border} strokeWidth={1} opacity={0.5} />
            <SvgText x={padL - 6} y={y + 3} fontSize={9} fill={colors.textSecondary} textAnchor="end" fontFamily="ArabicRegular">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
            </SvgText>
          </G>
        );
      })}

      <Path d={areaD} fill="url(#areaGrad)" />
      <Path d={pathD} stroke={colors.primary} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <G key={i} onPress={() => p.total > 0 && onPointPress?.(p.date)}>
          <Circle cx={p.x} cy={p.y} r={10} fill="transparent" />
          <Circle
            cx={p.x}
            cy={p.y}
            r={p.total > 0 ? 3.4 : 0}
            fill={colors.background}
            stroke={colors.primary}
            strokeWidth={2}
          />
        </G>
      ))}

      {points.map((p, i) =>
        i % labelStep === 0 || i === points.length - 1 ? (
          <SvgText
            key={`l-${i}`}
            x={p.x}
            y={height - 8}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="middle"
            fontFamily="ArabicRegular"
          >
            {p.date.slice(5)}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcSlicePath(cx: number, cy: number, rIn: number, rOut: number, startAngle: number, endAngle: number) {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const oStart = polarToCartesian(cx, cy, rOut, startAngle);
  const oEnd = polarToCartesian(cx, cy, rOut, endAngle);
  const iEnd = polarToCartesian(cx, cy, rIn, endAngle);
  const iStart = polarToCartesian(cx, cy, rIn, startAngle);
  return [
    `M ${oStart.x} ${oStart.y}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${oEnd.x} ${oEnd.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${rIn} ${rIn} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

function DonutChart({
  data,
  total,
  colors,
  currency,
  onSlicePress,
}: {
  data: { categoryId?: number | null; name: string; color: string; total: number }[];
  total: number;
  colors: any;
  currency: string;
  onSlicePress?: (seg: { categoryId?: number | null; name: string }) => void;
}) {
  if (!data || data.length === 0 || total <= 0)
    return <EmptyState colors={colors} label="لا توجد فئات بعد" />;

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const stroke = 22;
  const rIn = r - stroke / 2;
  const rOut = r + stroke / 2;

  let offset = 0;
  const circumference = 2 * Math.PI * r;
  let angleAcc = 0;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}><View pointerEvents="none" style={{ position: "absolute", top: 62, left: 25, right: 25, alignItems: "center" }}><Text style={{ color: colors.textSecondary, fontFamily: "ArabicRegular", fontSize: 11 }}>الإجمالي</Text><Text style={{ color: colors.text, fontFamily: "ArabicBold", fontSize: 20, writingDirection: "ltr" }}>{total.toFixed(2)}</Text><Text style={{ color: colors.textSecondary, fontSize: 11 }}>{currency}</Text></View><Svg width={size} height={size}>
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          <Circle cx={cx} cy={cy} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" opacity={0.4} />
          {data.map((seg, i) => {
            const pct = seg.total / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const el = (
              <Circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                stroke={seg.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += dash;
            return el;
          })}
        </G>
        {data.map((seg, i) => {
          const pct = seg.total / total;
          const sweep = pct * 360;
          const start = angleAcc;
          const end = angleAcc + Math.min(sweep, 359.999);
          angleAcc = end;
          const d = arcSlicePath(cx, cy, rIn, rOut, start, end);
          return (
            <Path
              key={`hit-${i}`}
              d={d}
              fill="transparent"
              onPress={() => onSlicePress?.(seg)}
            />
          );
        })}
      </Svg></View>

      <View style={{ marginTop: 14, gap: 4, alignSelf: "stretch" }}>
        {data.map((seg) => {
          const pct = (seg.total / total) * 100;
          return (
            <Pressable
              key={seg.name}
              onPress={() => onSlicePress?.(seg)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 6,
                paddingHorizontal: 6,
                borderRadius: 8,
                backgroundColor: pressed ? colors.background : "transparent",
              })}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: seg.color }} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "ArabicRegular" }}>
                {seg.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular" }}>
                {pct.toFixed(0)}%
              </Text>
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "ArabicBold", minWidth: 70, textAlign: "left" }}>
                {Number(seg.total).toFixed(2)}
              </Text>
              <Icon name="chevron-left" size={14} color={colors.textSecondary} />
            </Pressable>
          );
        })}
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "ArabicRegular", textAlign: "center", marginTop: 4 }}>
          اضغط على فئة لعرض مصاريفها
        </Text>
      </View>
    </View>
  );
}

function CompareBars({
  current,
  previous,
  colors,
}: {
  current: { month: string; total: number };
  previous: { month: string; total: number };
  colors: any;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(600, Math.max(220, screenWidth - 72));
  const height = 160;
  const padB = 36;
  const padT = 18;
  const innerH = height - padT - padB;
  const max = Math.max(current.total, previous.total, 1);

  const barW = 70;
  const cxPrev = width / 2 - barW - 18;
  const cxCur = width / 2 + 18;

  const prevH = (previous.total / max) * innerH;
  const curH = (current.total / max) * innerH;

  const monthName = (m: string) => {
    const [, mm] = m.split("-");
    const names = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    return names[parseInt(mm, 10) - 1] ?? m;
  };

  return (
    <View><Svg width={width} height={height-25}>
      <Defs>
        <LinearGradient id="curBar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity={1} />
          <Stop offset="1" stopColor={colors.primary} stopOpacity={0.55} />
        </LinearGradient>
        <LinearGradient id="prevBar" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.textSecondary} stopOpacity={0.85} />
          <Stop offset="1" stopColor={colors.textSecondary} stopOpacity={0.4} />
        </LinearGradient>
      </Defs>

      <Rect x={cxPrev} y={padT + innerH - prevH} width={barW} height={prevH} rx={10} fill="url(#prevBar)" />
      <Rect x={cxCur} y={padT + innerH - curH} width={barW} height={curH} rx={10} fill="url(#curBar)" />

      <SvgText x={cxPrev + barW / 2} y={padT + innerH - prevH - 6} fontSize={11} fill={colors.text} textAnchor="middle" fontFamily="ArabicBold">
        {previous.total >= 1000 ? `${(previous.total / 1000).toFixed(1)}k` : previous.total.toFixed(2)}
      </SvgText>
      <SvgText x={cxCur + barW / 2} y={padT + innerH - curH - 6} fontSize={11} fill={colors.primary} textAnchor="middle" fontFamily="ArabicBold">
        {current.total >= 1000 ? `${(current.total / 1000).toFixed(1)}k` : current.total.toFixed(2)}
      </SvgText>

    </Svg><View style={{ flexDirection: "row", justifyContent: "center", gap: 36 }}>{[previous,current].map((m,i)=><View key={m.month} style={{ width: barW, alignItems: "center" }}><Text style={{ color: colors.text, fontFamily: "ArabicBold", fontSize: 12 }}>{monthName(m.month)}</Text><Text style={{ color: colors.textSecondary, fontFamily: "ArabicRegular", fontSize: 10 }}>{i===0?"الشهر السابق":"الشهر الحالي"}</Text></View>)}</View></View>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<"week" | "month" | "calendarMonth" | "custom">("calendarMonth");
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"image" | "pdf" | null>(null);
  const shotRef = useRef<View>(null);
  const exportInFlight = useRef(false);

  const today = localDate();
  const [startInput,setStartInput]=useState(monthRange().start);
  const [endInput,setEndInput]=useState(today);
  const [customRange,setCustomRange]=useState({start:monthRange().start,end:today});
  const range = period==='custom' ? customRange : period==='calendarMonth' ? monthRange(today) : {start:localDate(new Date(parseDate(today).setDate(parseDate(today).getDate()-(period==='week'?6:29)))),end:today};
  const calendarMs=(s:string)=>{const d=parseDate(s);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());};
  const dayCount=Math.round((calendarMs(range.end)-calendarMs(range.start))/86400000)+1;
  const periodLabel=period==='week'?'آخر 7 أيام':period==='month'?'آخر 30 يوم':period==='calendarMonth'?'الشهر الحالي':range.start+' — '+range.end;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", period, today, range.start,range.end],
    queryFn: () => getStats(period, today, range),
  });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => getSettings() });
  const { data: compare, isLoading: compareLoading } = useQuery({
    queryKey: ["monthCompare", today],
    queryFn: () => getMonthComparison(today),
  });
  const currency = settings?.currency ?? "EGP";

  // Fill missing days with zero for a continuous line
  const filledByDay = useMemo(() => {
    if (!stats?.byDay) return [];
    const days = dayCount;
    const map = new Map(stats.byDay.map((d) => [d.date, d.total]));
    const out: { date: string; total: number }[] = [];
    const end = parseDate(range.end);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const k = localDate(d);
      out.push({ date: k, total: map.get(k) ?? 0 });
    }
    return out;
  }, [stats, period, today, range.start,range.end]);

  const diffPositive = (compare?.diff ?? 0) > 0;
  const diffPctLabel = compare?.diffPct == null ? "لا يوجد إنفاق سابق لحساب النسبة" : `(${compare.diffPct >= 0 ? "+" : ""}${compare.diffPct.toFixed(1)}%)`;

  const { data: drillExpenses = [] } = useQuery({
    queryKey: ["expenses", "drill", drillDate],
    queryFn: () => (drillDate ? getExpenses({ startDate: drillDate, endDate: drillDate }) : Promise.resolve([])),
    enabled: !!drillDate,
  });

  const shareAsImage = async () => {
    if (exportInFlight.current || !stats || isLoading || compareLoading) return;
    exportInFlight.current = true;
    try {
      setExporting("image");
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const uri = await captureRef(shotRef, { format: "png", quality: 1, result: "tmpfile" });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "إحصائيات H0sS-Money" });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      exportInFlight.current = false;
      setExporting(null);
    }
  };

  const shareAsPdf = async () => {
    if (exportInFlight.current || !stats || isLoading || compareLoading) return;
    exportInFlight.current = true;
    try {
      setExporting("pdf");
      const [expenses, incomes, accounts, assets] = await Promise.all([
        getExpenses({startDate:range.start,endDate:range.end}), getIncomes(), getAccounts(),
        reportAssets(settings?.logoBase64),
      ]);
      const html = buildStatsReport({start:range.start,end:range.end,label:periodLabel,currency,days:dayCount,
        stats, compare, expenses, incomes:incomes.filter(x=>x.date>=range.start&&x.date<=range.end), accounts,...assets});
      const { uri } = await printPdf({ html, width:595, height:842 });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "تقرير H0sS-Money PDF" });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      exportInFlight.current = false;
      setExporting(null);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView removeClippedSubviews={false} contentContainerStyle={{ paddingBottom: tabBarHeight + 20, backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
        <PageHeader title="صورة أوضح لإنفاقك" subtitle="تتبّع الاتجاهات واستكشف تفاصيل كل يوم وفئة" icon="bar-chart-2" actions={<>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable accessibilityLabel="تصدير الإحصائيات صورة" onPress={shareAsImage} disabled={!!exporting || isLoading || compareLoading || !stats} style={[s.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {exporting === "image" ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="image" size={16} color={colors.primary} />}
            </Pressable>
            <Pressable accessibilityLabel="تصدير تقرير PDF" onPress={shareAsPdf} disabled={!!exporting || isLoading || compareLoading || !stats} style={[s.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {exporting === "pdf" ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="file-text" size={16} color={colors.primary} />}
            </Pressable>
          </View>
        </>} />
        <Pressable accessibilityLabel="فتح التقرير المالي الشامل" onPress={()=>router.push({pathname:'/reports',params:{start:range.start,end:range.end}})} style={{marginHorizontal:18,marginBottom:12,padding:14,borderRadius:14,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}><Text style={{color:colors.primary,textAlign:'center',fontFamily:'ArabicBold'}}>التقرير المالي الشامل · PDF وCSV</Text></Pressable>
        <View style={[s.periodBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              style={[s.periodBtn, period === p.key && { backgroundColor: colors.primary }]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[s.periodText, { color: period === p.key ? colors.background : colors.textSecondary }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {period==='custom'&&<View style={[s.card,{backgroundColor:colors.surface,borderColor:colors.border,gap:8}]}>
          <Text style={{color:colors.text,fontFamily:'ArabicRegular',textAlign:'right'}}>من / إلى — YYYY-MM-DD</Text>
          <TextInput accessibilityLabel="بداية فترة الإحصائيات" value={startInput} onChangeText={setStartInput} style={{color:colors.text,padding:12,borderWidth:1,borderColor:colors.border,borderRadius:10,writingDirection:'ltr'}}/>
          <TextInput accessibilityLabel="نهاية فترة الإحصائيات" value={endInput} onChangeText={setEndInput} style={{color:colors.text,padding:12,borderWidth:1,borderColor:colors.border,borderRadius:10,writingDirection:'ltr'}}/>
          <Pressable onPress={()=>{try{const a=calendarMs(startInput),b=calendarMs(endInput);if(b<a||b-a>729*86400000)throw Error('اختر فترة مرتبة لا تزيد عن 730 يومًا');setCustomRange({start:startInput,end:endInput});}catch(e){Alert.alert('فترة غير صالحة',e instanceof Error?e.message:'راجع التاريخ');}}} style={{padding:12,backgroundColor:colors.primary,borderRadius:10}}><Text style={{color:colors.buttonText,textAlign:'center',fontFamily:'ArabicBold'}}>تطبيق الفترة</Text></Pressable>
        </View>}
        <View ref={shotRef} collapsable={false} style={{backgroundColor:colors.background,paddingTop:18,paddingBottom:18}}>
        <View style={{paddingHorizontal:20,marginBottom:16,flexDirection:'row',alignItems:'center',gap:12}}>
          <Image source={settings?.logoBase64 || settings?.logoUri ? {uri:settings.logoBase64 || settings.logoUri!} : require('../../assets/images/icon.png')} style={{width:56,height:56,borderRadius:14}} resizeMode="contain" />
          <View style={{flex:1,alignItems:'flex-end'}}><Text style={{color:colors.primary,fontWeight:'700',fontSize:16}}>H0sS · MONEY</Text><Text style={{color:colors.text,fontFamily:'ArabicBold'}}>تقرير الإحصائيات · {periodLabel}</Text><Text style={{color:colors.textSecondary,fontSize:11}}>{range.start} — {range.end}</Text></View>
        </View>
        {/* Total + line chart */}
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
            <View>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>إجمالي الإنفاق</Text>
              <Text style={[s.bigAmount, { color: colors.primary }]}>
                {Number(stats?.total ?? 0).toFixed(2)} <Text style={{ fontSize: 16 }}>{currency}</Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.cardLabel, { color: colors.textSecondary }]}>عدد العمليات</Text>
              <Text style={[s.bigAmount, { color: colors.text }]}>{stats?.count ?? 0}</Text>
            </View>
          </View>
          <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 6 }]}>
            تطور الإنفاق ({periodLabel})
          </Text>
          {isLoading ? null : <LineChart data={filledByDay} colors={colors} onPointPress={setDrillDate} />}
          {exporting !== "image" && <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "ArabicRegular", textAlign: "center", marginTop: 6 }}>
            اضغط على نقطة لعرض تفاصيل اليوم
          </Text>}
        </View>

        {/* Donut chart */}
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 12 }]}>توزيع المصاريف على الفئات</Text>
          <DonutChart
            data={stats?.byCategory ?? []}
            total={stats?.total ?? 0}
            colors={colors}
            currency={currency}
            onSlicePress={(seg) => {
              if (seg.categoryId == null) return;
              Haptics.selectionAsync();
              router.push({ pathname: "/(tabs)/expenses", params: { categoryId: String(seg.categoryId), categoryName: seg.name } });
            }}
          />
        </View>

        {/* Month comparison */}
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 4 }]}>مقارنة شهرية</Text>
          <Text style={[s.cardLabel, { color: colors.textSecondary, marginBottom: 10 }]}>
            الشهر الحالي مقابل الشهر السابق
          </Text>
          {compareLoading ? (
            <EmptyState colors={colors} label="جاري الحساب..." />
          ) : compare ? (
            <>
              <CompareBars
                current={compare.current}
                previous={compare.previous}
                colors={colors}
              />
              <View style={[s.diffBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon
                    name={diffPositive ? "trending-up" : "trending-down"}
                    size={18}
                    color={diffPositive ? "#EF4444" : "#10B981"}
                  />
                  <Text style={{ color: colors.text, fontSize: 13, fontFamily: "ArabicBold" }}>
                    {compare.diff === 0 ? "لم يتغير إنفاقك عن الشهر الماضي" : `${diffPositive ? "زاد إنفاقك" : "قل إنفاقك"} عن الشهر الماضي بـ`}
                  </Text>
                </View>
                <Text
                  style={{
                    color: diffPositive ? "#EF4444" : "#10B981",
                    fontSize: 18,
                    fontFamily: "ArabicBold",
                    marginTop: 4,
                  }}
                >
                  {Math.abs(compare.diff).toFixed(2)} {currency}{" "}
                  <Text style={{ fontSize: 12, fontFamily: "ArabicRegular", color: colors.textSecondary }}>
                    {diffPctLabel}
                  </Text>
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Daily average */}
        {stats?.total !== undefined && (
          <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.sectionTitle, { color: colors.text, marginBottom: 12 }]}>المتوسط اليومي</Text>
            <Text style={[s.bigAmount, { color: colors.primary, fontSize: 26 }]}>
              {(Number(stats.total) / dayCount).toFixed(2)}{" "}
              <Text style={{ fontSize: 14 }}>{currency}</Text>
            </Text>
          </View>
        )}
        <Text style={{color:colors.textSecondary,textAlign:'center',fontFamily:'ArabicRegular',fontSize:11,marginTop:8}}>H0sS-Money · {dayCount} يومًا · العملة {currency}</Text>
        </View>
      </ScrollView>

      <Modal visible={!!drillDate} transparent animationType="slide" onRequestClose={() => setDrillDate(null)}>
        <View style={s.drillOverlay}>
          <View style={[s.drillSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (!drillDate) return;
                  const d = parseDate(drillDate);
                  d.setDate(d.getDate() - 1);
                  setDrillDate(localDate(d));
                }}
                hitSlop={10}
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.background }}
              >
                <Icon name="chevron-right" size={20} color={colors.primary} />
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 15, fontFamily: "ArabicBold", flex: 1, textAlign: "center" }}>
                {drillDate ? parseDate(drillDate).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </Text>
              <Pressable
                onPress={() => {
                  if (!drillDate) return;
                  const d = parseDate(drillDate);
                  d.setDate(d.getDate() + 1);
                  const next = localDate(d);
                  const today = localDate();
                  if (next > today) return;
                  setDrillDate(next);
                }}
                hitSlop={10}
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.background }}
              >
                <Icon name="chevron-left" size={20} color={colors.primary} />
              </Pressable>
              <Pressable onPress={() => setDrillDate(null)} hitSlop={10} style={{ padding: 6 }}>
                <Icon name="x" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={[s.diffBox, { borderColor: colors.border, backgroundColor: colors.background, marginTop: 0, marginBottom: 14 }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular" }}>إجمالي اليوم</Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontFamily: "ArabicBold", marginTop: 4 }}>
                {drillExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)} {currency}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{drillExpenses.length} عملية</Text>
            </View>
            {drillExpenses.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: "ArabicBold", marginBottom: 8 }}>أكبر 3 مصاريف</Text>
                {[...drillExpenses]
                  .sort((a, b) => Number(b.amount) - Number(a.amount))
                  .slice(0, 3)
                  .map((e, idx) => (
                    <View key={`top-${e.id}`} style={[s.topRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <View style={[s.topRank, { backgroundColor: colors.primary + "22" }]}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "ArabicBold" }}>{idx + 1}</Text>
                      </View>
                      <View style={[s.drillDot, { backgroundColor: e.category?.color ?? colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontFamily: "ArabicBold" }} numberOfLines={1}>{e.description}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{e.category?.name ?? "بدون فئة"}</Text>
                      </View>
                      <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "ArabicBold" }}>{Number(e.amount).toFixed(2)}</Text>
                    </View>
                  ))}
              </View>
            )}
            {drillExpenses.length > 3 && (
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 8 }}>
                كل العمليات
              </Text>
            )}
            <ScrollView style={{ maxHeight: 320 }}>
              {drillExpenses.length === 0 ? (
                <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 20, fontFamily: "ArabicRegular" }}>
                  لا توجد عمليات في هذا اليوم
                </Text>
              ) : drillExpenses.map((e: Expense) => (
                <View key={e.id} style={[s.drillRow, { borderColor: colors.border }]}>
                  <View style={[s.drillDot, { backgroundColor: e.category?.color ?? colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: "ArabicRegular" }} numberOfLines={1}>{e.description}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{e.category?.name ?? "بدون فئة"}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "ArabicBold" }}>{Number(e.amount).toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  shareBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  drillOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  drillSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: "80%" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  drillRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  topRank: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  drillDot: { width: 10, height: 10, borderRadius: 5 },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontFamily: "ArabicBold" },
  subtitle: { fontSize: 12, fontFamily: "ArabicRegular", marginTop: 2 },
  periodBar: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 4, borderWidth: 1, gap: 4 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  periodText: { fontSize: 11, fontFamily: "ArabicBold" },
  card: { marginHorizontal: 16, marginBottom: 14, borderRadius: 22, borderWidth: 1, padding: 20 },
  cardLabel: { fontSize: 12, fontFamily: "ArabicRegular", marginBottom: 4 },
  bigAmount: { fontSize: 32, fontFamily: "ArabicBold" },
  sectionTitle: { fontSize: 16, fontFamily: "ArabicBold" },
  diffBox: { marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
});
