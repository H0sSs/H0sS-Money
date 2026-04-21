import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

interface Props {
  used: number;
  goal: number;
  currency: string;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    textSecondary: string;
    primary: string;
    border: string;
    error: string;
  };
}

export default function MonthlyGoalRing({ used, goal, currency, colors }: Props) {
  const pct = goal > 0 ? Math.min(1, used / goal) : 0;
  const remaining = Math.max(0, goal - used);
  const over = used > goal;
  const ringColor = over ? colors.error : pct > 0.8 ? "#F59E0B" : colors.primary;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(pct, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textSecondary }]}>الهدف الشهري</Text>
      <View style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ringColor} stopOpacity="1" />
              <Stop offset="1" stopColor={ringColor} stopOpacity="0.6" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.surfaceAlt}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="url(#ringGrad)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={CIRC}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.pct, { color: ringColor }]}>{Math.round(pct * 100)}%</Text>
          <Text style={[styles.used, { color: colors.text }]}>{used.toFixed(0)}</Text>
          <Text style={[styles.of, { color: colors.textSecondary }]}>من {goal.toFixed(0)} {currency}</Text>
        </View>
      </View>
      <Text style={[styles.footer, { color: over ? colors.error : colors.textSecondary }]}>
        {over
          ? `⚠️ تجاوزت الهدف بـ ${(used - goal).toFixed(0)} ${currency}`
          : `متبقي ${remaining.toFixed(0)} ${currency} هذا الشهر`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
  },
  title: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  pct: { fontSize: 22, fontFamily: "Inter_700Bold" },
  used: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  of: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  footer: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 14, textAlign: "center" },
});
