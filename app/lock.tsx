import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import Icon from "@/components/Icon";
import { DarkColors } from "@/lib/theme";

export default function LockScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "authenticating" | "failed">("idle");

  const authenticate = async () => {
    setStatus("authenticating");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "افتح H0sS-Money",
        cancelLabel: "إلغاء",
        fallbackLabel: "استخدم الرمز السري",
        disableDeviceFallback: false,
      });
      if (result.success) {
        router.replace("/(tabs)");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
  };

  useEffect(() => {
    authenticate();
  }, []);

  const C = DarkColors;

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <View style={s.inner}>
        <View style={[s.iconCircle, { backgroundColor: C.primary + "20", borderColor: C.primary }]}>
          <Icon name="lock" size={40} color={C.primary} />
        </View>
        <Text style={[s.title, { color: C.text }]}>H0sS-Money</Text>
        <Text style={[s.subtitle, { color: C.textSecondary }]}>
          {status === "authenticating" ? "جاري التحقق..." : status === "failed" ? "فشل التحقق — حاول مجدداً" : "اضغط للفتح"}
        </Text>

        {status === "authenticating" ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 32 }} />
        ) : (
          <Pressable
            style={[s.btn, { backgroundColor: C.primary }]}
            onPress={authenticate}
          >
            <Icon name="fingerprint" size={22} color={C.background} />
            <Text style={[s.btnText, { color: C.background }]}>فتح بالبصمة</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  inner: { alignItems: "center", gap: 16 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 240 },
  btn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20, marginTop: 16 },
  btnText: { fontSize: 17, fontFamily: "Inter_700Bold" },
});
