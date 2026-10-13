import { KeyboardProvider } from "react-native-keyboard-controller";
import StartupScreen from "@/components/StartupScreen";
import { STARTUP_BACKGROUND } from "@/lib/startup";
import { Text } from "@/components/Typography";
import Guide from "@/components/Guide";
import { postRecurring } from "@/lib/finance";
import { db } from "@/lib/db";
import { useFonts } from "expo-font";
import { QueryClientProvider, focusManager } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import { View, StyleSheet, Pressable, ActivityIndicator, AppState } from "react-native";
import { Alert } from "react-native";
import { queryClient } from "@/lib/query";
import { localDate } from "@/lib/dates";
import { initDB } from "@/lib/db";
import { getSettings } from "@/lib/services";
import {
  initNotifications,
  hasAskedForPermission,
  markPermissionAsked,
  requestNotificationPermission,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { DarkColors, LightColors } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Icon from "@/components/Icon";

SplashScreen.preventAutoHideAsync().catch(() => {});


function LockGate({ onUnlock }: { onUnlock: () => void }) {
  const C = { ...DarkColors, background: STARTUP_BACKGROUND };
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

function ThemedNavigator() {
  const { isDark, colors } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <Guide/><Stack screenOptions={{ headerShown: false, statusBarStyle: isDark ? "light" : "dark" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ArabicRegular: require('../assets/fonts/Tajawal-Regular.ttf'),
    ArabicMedium: require('../assets/fonts/Tajawal-Medium.ttf'),
    ArabicBold: require('../assets/fonts/Tajawal-Bold.ttf'),
  });
  const [initialTheme, setInitialTheme] = useState<'dark'|'light'>('dark');
  const [dbReady, setDbReady] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const appState = useRef(AppState.currentState);
  const backgroundAt = useRef(0);
  const dayRef = useRef(localDate());

  useEffect(() => {
    setBootError(null);
    setDbReady(false);
    setAuthChecked(false);
    initDB()
      .then(async () => {
        setDbReady(true);
        initNotifications().catch(() => {});
        try {
          const settings = await getSettings();
          setInitialTheme(settings.theme === 'light' ? 'light' : 'dark');
          queryClient.setQueryData(['settings'], settings);
          if (settings.fingerprintEnabled) {
            const hasHW = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (hasHW && enrolled) {
              setAuthNeeded(true);
              setAuthChecked(true);
              return;
            }
          }
        } catch (error) { throw error; }
        setAuthChecked(true);
      })
      .catch(() => { setBootError("تعذر تجهيز البيانات. بياناتك لم تُحذف؛ حاول مرة أخرى."); });
  }, [bootAttempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => {
      const previous = appState.current;
      appState.current = next;
      focusManager.setFocused(next === "active");
      if (next === "background") backgroundAt.current = Date.now();
      if (next === "active" && previous !== "active") {
        if (backgroundAt.current && Date.now() - backgroundAt.current >= 15000) {
          getSettings().then(async settings => {
            if (settings.fingerprintEnabled && await LocalAuthentication.isEnrolledAsync()) { setAuthNeeded(true); setAuthenticated(false); }
          }).catch(() => {});
        }
        backgroundAt.current = 0;
        queryClient.invalidateQueries();
      }
    });
    const timer = setInterval(() => { const today = localDate(); if (dayRef.current !== today) { dayRef.current = today; queryClient.invalidateQueries(); } }, 30000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);

  const ready = (fontsLoaded || fontError) && dbReady && authChecked;

  const revealFirstFrame = () => { requestAnimationFrame(() => { SplashScreen.hideAsync().catch(() => {}); }); };

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
  useEffect(()=>{
    if(!canPromptNotifs)return;
    let running=false;
    const process=async()=>{if(running)return;running=true;try{const enabled=await db.getFirstAsync<{value:string}>("SELECT value FROM settings WHERE key='recurringAuto'");if(enabled?.value==='true'){await postRecurring();queryClient.invalidateQueries();}}catch(e){Alert.alert('المصاريف المتكررة',e instanceof Error?e.message:'تعذر تسجيل المستحقات');}finally{running=false;}};
    process();const sub=AppState.addEventListener('change',state=>{if(state==='active')process();});return()=>sub.remove();
  },[canPromptNotifs]);


  if (bootError) return <SafeAreaProvider><StartupScreen onLayout={revealFirstFrame} error message={bootError} onRetry={() => setBootAttempt(value => value + 1)}/></SafeAreaProvider>;

  if (!ready) {
    return (
      <SafeAreaProvider>
        <StartupScreen message={!dbReady ? "تحضير قاعدة البيانات..." : !fontsLoaded ? "تحميل الخطوط..." : "لحظة..."} />
      </SafeAreaProvider>
    );
  }

  if (authNeeded && !authenticated) {
    return (
      <SafeAreaProvider>
        <View style={{flex:1,backgroundColor:STARTUP_BACKGROUND}} onLayout={revealFirstFrame}><LockGate onUnlock={() => setAuthenticated(true)} /></View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary onError={revealFirstFrame}>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent preload={false}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider initialTheme={initialTheme}>
            <View style={{flex:1,backgroundColor:initialTheme==='light'?LightColors.background:DarkColors.background}} onLayout={revealFirstFrame}><ThemedNavigator /></View>
          </ThemeProvider>
        </QueryClientProvider>
        </KeyboardProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
