import React, { useState, useMemo, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Modal, Alert, ActivityIndicator } from "react-native";
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
import ViewShot, { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { getStats, getSettings, getMonthComparison, getExpenses, type Expense } from "@/lib/services";
import Icon from "@/components/Icon";

const PERIODS = [
  { key: "week", label: "أسبوع" },
  { key: "month", label: "30 يوم" },
] as const;

const CHART_W = 340;

function EmptyState({ colors, label }: { colors: any; label: string }) {
  return (
    <View style={{ alignItems: "center", padding: 28 }}>
      <Icon name="bar-chart-2" size={36} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, marginTop: 10, fontFamily: "Inter_400Regular" }}>
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
  if (!data || data.length === 0) return <EmptyState colors={colors} label="لا توجد بيانات لعرضها" />;

  const width = CHART_W;
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
            <SvgText x={padL - 6} y={y + 3} fontSize={9} fill={colors.textSecondary} textAnchor="end" fontFamily="Inter_400Regular">
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
            fontFamily="Inter_400Regular"
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
      <Svg width={size} height={size}>
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
        <SvgText
          x={cx}
          y={cy - 4}
          fontSize={11}
          fill={colors.textSecondary}
          textAnchor="middle"
          fontFamily="Inter_400Regular"
        >
          الإجمالي
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 14}
          fontSize={16}
          fill={colors.text}
          textAnchor="middle"
          fontFamily="Inter_700Bold"
        >
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : Math.round(total)}
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 28}
          fontSize={9}
          fill={colors.textSecondary}
          textAnchor="middle"
          fontFamily="Inter_400Regular"
        >
          {currency}
        </SvgText>
      </Svg>

      <View style={{ marginTop: 14, gap: 4, alignSelf: "stretch" }}>
        {data.slice(0, 6).map((seg) => {
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
              <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                {seg.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                {pct.toFixed(0)}%
              </Text>
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 70, textAlign: "left" }}>
                {Number(seg.total).toFixed(2)}
              </Text>
              <Icon name="chevron-left" size={14} color={colors.textSecondary} />
            </Pressable>
          );
        })}
        <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 }}>
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
  const width = CHART_W;
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
    <Svg width={width} height={height}>
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

      <SvgText x={cxPrev + barW / 2} y={padT + innerH - prevH - 6} fontSize={11} fill={colors.text} textAnchor="middle" fontFamily="Inter_600SemiBold">
        {previous.total >= 1000 ? `${(previous.total / 1000).toFixed(1)}k` : Math.round(previous.total)}
      </SvgText>
      <SvgText x={cxCur + barW / 2} y={padT + innerH - curH - 6} fontSize={11} fill={colors.primary} textAnchor="middle" fontFamily="Inter_600SemiBold">
        {current.total >= 1000 ? `${(current.total / 1000).toFixed(1)}k` : Math.round(current.total)}
      </SvgText>

      <SvgText x={cxPrev + barW / 2} y={height - 18} fontSize={11} fill={colors.text} textAnchor="middle" fontFamily="Inter_600SemiBold">
        {monthName(previous.month)}
      </SvgText>
      <SvgText x={cxPrev + barW / 2} y={height - 5} fontSize={9} fill={colors.textSecondary} textAnchor="middle" fontFamily="Inter_400Regular">
        الشهر السابق
      </SvgText>

      <SvgText x={cxCur + barW / 2} y={height - 18} fontSize={11} fill={colors.text} textAnchor="middle" fontFamily="Inter_600SemiBold">
        {monthName(current.month)}
      </SvgText>
      <SvgText x={cxCur + barW / 2} y={height - 5} fontSize={9} fill={colors.textSecondary} textAnchor="middle" fontFamily="Inter_400Regular">
        الشهر الحالي
      </SvgText>
    </Svg>
  );
}

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const router = useRouter();
  const { colors } = useTheme();
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [drillDate, setDrillDate] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"image" | "pdf" | null>(null);
  const shotRef = useRef<View>(null);

  const today = new Date().toISOString().split("T")[0];
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", period, today],
    queryFn: () => getStats(period, today),
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
    const days = period === "week" ? 7 : 30;
    const map = new Map(stats.byDay.map((d) => [d.date, d.total]));
    const out: { date: string; total: number }[] = [];
    const end = new Date(today);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const k = d.toISOString().split("T")[0];
      out.push({ date: k, total: map.get(k) ?? 0 });
    }
    return out;
  }, [stats, period, today]);

  const diffPositive = (compare?.diff ?? 0) >= 0;

  const { data: drillExpenses = [] } = useQuery({
    queryKey: ["expenses", "drill", drillDate],
    queryFn: () => (drillDate ? getExpenses({ startDate: drillDate, endDate: drillDate }) : Promise.resolve([])),
    enabled: !!drillDate,
  });

  const shareAsImage = async () => {
    try {
      setExporting("image");
      const uri = await captureRef(shotRef, { format: "png", quality: 0.95, result: "tmpfile" });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "إحصائيات H0sS-Money" });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      setExporting(null);
    }
  };

  const shareAsPdf = async () => {
    try {
      setExporting("pdf");
      const total = Number(stats?.total ?? 0).toFixed(2);
      const cnt = stats?.count ?? 0;
      const periodLabel = period === "week" ? "آخر 7 أيام" : "آخر 30 يوم";
      const catRows = (stats?.byCategory ?? [])
        .map((c) => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color};margin-left:8px"></span>${c.name}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:left">${c.total.toFixed(2)} ${currency}</td></tr>`)
        .join("");
      const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>H0sS-Money</title>
        <style>
          body{font-family:-apple-system,system-ui,sans-serif;padding:32px;color:#0a0a0a}
          h1{color:#F0B429;margin:0 0 4px} .sub{color:#666;font-size:13px;margin-bottom:24px}
          .card{border:1px solid #e5e7eb;border-radius:14px;padding:20px;margin-bottom:16px}
          .big{font-size:32px;color:#F0B429;font-weight:700} table{width:100%;border-collapse:collapse}
          .compare{display:flex;gap:24px} .compare>div{flex:1}
        </style></head><body>
        <h1>H0sS-Money</h1><div class="sub">تقرير الإحصائيات — ${periodLabel} — ${new Date().toLocaleDateString("ar-EG")}</div>
        <div class="card"><div style="color:#666;font-size:12px">إجمالي الإنفاق</div><div class="big">${total} ${currency}</div><div style="color:#666;font-size:13px;margin-top:6px">${cnt} عملية · بمتوسط يومي ${(Number(stats?.total ?? 0) / (period === "week" ? 7 : 30)).toFixed(2)} ${currency}</div></div>
        <div class="card"><h3 style="margin-top:0">توزيع الفئات</h3><table>${catRows || '<tr><td style="padding:8px;color:#999">لا توجد بيانات</td></tr>'}</table></div>
        ${compare ? `<div class="card"><h3 style="margin-top:0">مقارنة شهرية</h3><div class="compare"><div><div style="color:#666;font-size:12px">${compare.previous.month}</div><div style="font-size:22px;font-weight:600">${compare.previous.total.toFixed(2)} ${currency}</div></div><div><div style="color:#666;font-size:12px">${compare.current.month}</div><div style="font-size:22px;font-weight:600;color:#F0B429">${compare.current.total.toFixed(2)} ${currency}</div></div></div><div style="margin-top:12px;padding:12px;background:${diffPositive ? "#fef2f2" : "#f0fdf4"};border-radius:10px;color:${diffPositive ? "#b91c1c" : "#15803d"};font-weight:600">${diffPositive ? "زاد" : "قل"} الإنفاق بـ ${Math.abs(compare.diff).toFixed(2)} ${currency} (${compare.diffPct >= 0 ? "+" : ""}${compare.diffPct.toFixed(1)}%)</div></div>` : ""}
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const can = await Sharing.isAvailableAsync();
      if (can) await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "تقرير H0sS-Money PDF" });
    } catch (e) {
      Alert.alert("خطأ", e instanceof Error ? e.message : "فشل التصدير");
    } finally {
      setExporting(null);
    }
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background, paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView ref={shotRef as any} contentContainerStyle={{ paddingBottom: tabBarHeight + 20, backgroundColor: colors.background }} showsVerticalScrollIndicator={false}>
        <View style={[s.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <View>
            <Text style={[s.title, { color: colors.text }]}>الإحصائيات</Text>
            <Text style={[s.subtitle, { color: colors.textSecondary }]}>نظرة احترافية على إنفاقك</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={shareAsImage} disabled={!!exporting} style={[s.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {exporting === "image" ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="image" size={16} color={colors.primary} />}
            </Pressable>
            <Pressable onPress={shareAsPdf} disabled={!!exporting} style={[s.shareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {exporting === "pdf" ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="file-text" size={16} color={colors.primary} />}
            </Pressable>
          </View>
        </View>

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
            تطور الإنفاق ({period === "week" ? "آخر 7 أيام" : "آخر 30 يوم"})
          </Text>
          {isLoading ? null : <LineChart data={filledByDay} colors={colors} onPointPress={setDrillDate} />}
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6 }}>
            اضغط على نقطة لعرض تفاصيل اليوم
          </Text>
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
                  <Text style={{ color: colors.text, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
                    {diffPositive ? "زاد إنفاقك" : "قل إنفاقك"} عن الشهر الماضي بـ
                  </Text>
                </View>
                <Text
                  style={{
                    color: diffPositive ? "#EF4444" : "#10B981",
                    fontSize: 18,
                    fontFamily: "Inter_700Bold",
                    marginTop: 4,
                  }}
                >
                  {Math.abs(compare.diff).toFixed(2)} {currency}{" "}
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.textSecondary }}>
                    ({compare.diffPct >= 0 ? "+" : ""}
                    {compare.diffPct.toFixed(1)}%)
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
              {period === "week"
                ? (Number(stats.total) / 7).toFixed(2)
                : (Number(stats.total) / 30).toFixed(2)}{" "}
              <Text style={{ fontSize: 14 }}>{currency}</Text>
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!drillDate} transparent animationType="slide" onRequestClose={() => setDrillDate(null)}>
        <View style={s.drillOverlay}>
          <View style={[s.drillSheet, { backgroundColor: colors.surface }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8 }}>
              <Pressable
                onPress={() => {
                  if (!drillDate) return;
                  const d = new Date(drillDate);
                  d.setDate(d.getDate() - 1);
                  setDrillDate(d.toISOString().split("T")[0]);
                }}
                hitSlop={10}
                style={{ padding: 6, borderRadius: 8, backgroundColor: colors.background }}
              >
                <Icon name="chevron-right" size={20} color={colors.primary} />
              </Pressable>
              <Text style={{ color: colors.text, fontSize: 15, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" }}>
                {drillDate ? new Date(drillDate).toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "long" }) : ""}
              </Text>
              <Pressable
                onPress={() => {
                  if (!drillDate) return;
                  const d = new Date(drillDate);
                  d.setDate(d.getDate() + 1);
                  const next = d.toISOString().split("T")[0];
                  const today = new Date().toISOString().split("T")[0];
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
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_400Regular" }}>إجمالي اليوم</Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 }}>
                {drillExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toFixed(2)} {currency}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{drillExpenses.length} عملية</Text>
            </View>
            {drillExpenses.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontFamily: "Inter_700Bold", marginBottom: 8 }}>أكبر 3 مصاريف</Text>
                {[...drillExpenses]
                  .sort((a, b) => Number(b.amount) - Number(a.amount))
                  .slice(0, 3)
                  .map((e, idx) => (
                    <View key={`top-${e.id}`} style={[s.topRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      <View style={[s.topRank, { backgroundColor: colors.primary + "22" }]}>
                        <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Inter_700Bold" }}>{idx + 1}</Text>
                      </View>
                      <View style={[s.drillDot, { backgroundColor: e.category?.color ?? colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>{e.description}</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{e.category?.name ?? "بدون فئة"}</Text>
                      </View>
                      <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "Inter_700Bold" }}>{Number(e.amount).toFixed(2)}</Text>
                    </View>
                  ))}
              </View>
            )}
            {drillExpenses.length > 3 && (
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 8 }}>
                كل العمليات
              </Text>
            )}
            <ScrollView style={{ maxHeight: 320 }}>
              {drillExpenses.length === 0 ? (
                <Text style={{ color: colors.textSecondary, textAlign: "center", padding: 20, fontFamily: "Inter_400Regular" }}>
                  لا توجد عمليات في هذا اليوم
                </Text>
              ) : drillExpenses.map((e: Expense) => (
                <View key={e.id} style={[s.drillRow, { borderColor: colors.border }]}>
                  <View style={[s.drillDot, { backgroundColor: e.category?.color ?? colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontFamily: "Inter_500Medium" }} numberOfLines={1}>{e.description}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{e.category?.name ?? "بدون فئة"}</Text>
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 15, fontFamily: "Inter_700Bold" }}>{Number(e.amount).toFixed(2)}</Text>
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
  title: { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  periodBar: { flexDirection: "row", marginHorizontal: 16, marginBottom: 16, borderRadius: 14, padding: 4, borderWidth: 1, gap: 4 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  periodText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  card: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, borderWidth: 1, padding: 18 },
  cardLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  bigAmount: { fontSize: 32, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  diffBox: { marginTop: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
});
