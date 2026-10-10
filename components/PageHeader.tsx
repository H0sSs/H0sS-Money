import React from "react";
import { View, Text, Image } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import Icon from "./Icon";
export default function PageHeader({ title, subtitle, icon, actions, logo }: { title: string; subtitle: string; icon: string; actions?: React.ReactNode; logo?: string | null }) {
  const { colors: c } = useTheme();
  return <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
      {actions}
      <View style={{ flex: 1, alignItems: "flex-end", gap: 4 }}>
        <Text style={{ color: c.primary, fontSize: 10, letterSpacing: 2, fontWeight: "700" }}>H0sS · MONEY</Text>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: 27, fontWeight: "800", textAlign: "right" }}>{title}</Text>
      </View>
      <View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: c.primary + "16", borderWidth: 1, borderColor: c.primary + "30", alignItems: "center", justifyContent: "center" }}>{logo ? <Image source={{ uri: logo }} style={{ width: 42, height: 42, borderRadius: 14 }} /> : <Icon name={icon} size={24} color={c.primary} />}</View>
    </View>
    <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 12 }}>{subtitle}</Text>
  </View>;
}
