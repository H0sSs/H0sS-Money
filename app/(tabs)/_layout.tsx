import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import Icon from "@/components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(12, insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 66 + bottomPadding,
          paddingTop: 10,
          paddingBottom: bottomPadding,
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "ArabicRegular",
          fontSize: 12,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: "الإحصائيات", tabBarIcon: ({ color, size }) => <Icon name="bar-chart-2" size={size} color={color} /> }} />
      <Tabs.Screen name="expenses" options={{ title: "المصاريف", tabBarIcon: ({ color, size }) => <Icon name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: "الإعدادات", tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
