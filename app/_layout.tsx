import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Alert } from "react-native";
import { initDB } from "@/lib/db";
import { getSettings } from "@/lib/services";
import {
  initNotifications,
  hasAskedForPermission,
  markPermissionAsked,
  requestNotificationPermission,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DarkColors } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Icon from "@/components/Icon";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5000, retry: 1, gcTime: 300000 } },
});

function LoadingScreen({ message }: { message: string }) {
  const C = DarkColors;
  return (
    <View style={[lock.container, { backgroundColor: C.background }]}>
      <View style={lock.inner}>
        <View style={[lock.circle, { backgroundColor: C.primary + "20", borderColor: C.primary }]}>
          <Text style={{ color: C.primary, fontSize: 36, fontWeight: "700" }}>H</Text>
        </View>
        <Text style={[lock.title, { color: C.text }]}>H0sS-Money</Text>
        <ActivityIndicator color={C.primary} size="small" style={{ marginTop: 12 }} />
        <Text style={[lock.sub, { color: C.textSecondary, marginTop: 6 }]}>{message}</Text>
      </View>
    </View>
  );
}

function LockGate({ onUnlock }: { onUnlock: () => void }) {
  const C = DarkColors;
  const [status, setStatus] = useState<"idle" | "working" | "failed">("idle");

  const tryAuth = async () => {
    setStatus("working");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "افتح H0sS-Money",
        cancelLabel: "إلغاء",
        fallbackLabel: "الرمز السري",
        disableDeviceFallback: false,
      });
      if (result.success) { onUnlock(); return; }
    } catch {}
    setStatus("failed");
  };

  useEffect(() => { tryAuth(); }, []);

  return (
    <View style={[lock.container, { backgroundColor: C.background }]}>
      <View style={lock.inner}>
        <View style={[lock.circle, { backgroundColor: C.primary + "20", borderColor: C.primary }]}>
          <Icon name="lock" size={44} color={C.primary} />
        </View>
        <Text style={[lock.title, { color: C.text }]}>H0sS-Money</Text>
        <Text style={[lock.sub, { color: C.textSecondary }]}>
          {status === "working" ? "جاري التحقق..." : status === "failed" ? "فشل — حاول مجدداً" : "مقفل"}
        </Text>
        {status === "working" ? (
          <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 32 }} />
        ) : (
          <Pressable style={[lock.btn, { backgroundColor: C.primary }]} onPress={tryAuth}>
            <Icon name="fingerprint" size={22} color={C.background} />
            <Text style={[lock.btnText, { color: C.background }]}>فتح بالبصمة</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const lock = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  inner: { alignItems: "center", gap: 16 },
  circle: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", marginTop: 8 },
  sub: { fontSize: 15, textAlign: "center", maxWidth: 240 },
  btn: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20, marginTop: 16 },
  btnText: { fontSize: 17, fontWeight: "700" },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("../assets/fonts/Inter-Regular.otf"),
    Inter_500Medium: require("../assets/fonts/Inter-Medium.otf"),
    Inter_600SemiBold: require("../assets/fonts/Inter-SemiBold.otf"),
    Inter_700Bold: require("../assets/fonts/Inter-Bold.otf"),
  });
  const [dbReady, setDbReady] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [forceShow, setForceShow] = useState(false);

  // Safety timeout: never block UI more than 5 seconds
  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    initDB()
      .then(async () => {
        setDbReady(true);
        initNotifications().catch(() => {});
        try {
          const settings = await getSettings();
          if (settings.fingerprintEnabled) {
            const hasHW = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHW && enrolled) {
              setAuthNeeded(true);
              setAuthChecked(true);
              return;
            }
          }
        } catch {}
        setAuthChecked(true);
      })
      .catch(() => { setDbReady(true); setAuthChecked(true); });
  }, []);

  const ready = (fontsLoaded || fontError) && dbReady && authChecked;

  useEffect(() => {
    if (ready || forceShow) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready, forceShow]);

  // Ask for notification permission once on first launch (after DB ready & unlocked)
  const canPromptNotifs = ready && (!authNeeded || authenticated);
  useEffect(() => {
    if (!canPromptNotifs) return;
    (async () => {
      try {
        if (await hasAskedForPermission()) return;
        await markPermissionAsked();
        Alert.alert(
          "تنبيهات الميزانية",
          "نبهك لما تقترب من الهدف الشهري أو تتجاوز ميزانية فئة. تقدر تطفّيها من الإدارة في أي وقت.",
          [
            { text: "مش دلوقتي", style: "cancel" },
            {
              text: "تفعيل",
              onPress: async () => {
                const granted = await requestNotificationPermission();
                if (granted) await setNotificationsEnabled(true);
              },
            },
          ]
        );
      } catch {}
    })();
  }, [canPromptNotifs]);

  if (!ready && !forceShow) {
    return (
      <SafeAreaProvider>
        <LoadingScreen message={!dbReady ? "تحضير قاعدة البيانات..." : !fontsLoaded ? "تحميل الخطوط..." : "لحظة..."} />
      </SafeAreaProvider>
    );
  }

  if (authNeeded && !authenticated) {
    return (
      <SafeAreaProvider>
        <LockGate onUnlock={() => setAuthenticated(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              </Stack>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
