import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/contexts/ThemeContext";
import Icon from "@/components/Icon";

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const isIOS = Platform.OS === "ios";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
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
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "الرئيسية", tabBarIcon: ({ color, size }) => <Icon name="mic" size={size} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: "الإحصائيات", tabBarIcon: ({ color, size }) => <Icon name="bar-chart-2" size={size} color={color} /> }} />
      <Tabs.Screen name="expenses" options={{ title: "المصاريف", tabBarIcon: ({ color, size }) => <Icon name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="admin" options={{ title: "الإدارة", tabBarIcon: ({ color, size }) => <Icon name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
