import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { createContext, useContext, useState, useEffect } from "react";
import { DarkColors, LightColors, ThemeColors } from "@/lib/theme";
import { getSettings, updateSetting } from "@/lib/services";
import { StatusBar } from "expo-status-bar";

type ThemeContextType = {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  colors: DarkColors,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const client = useQueryClient();
  useEffect(() => { if (settings) setIsDark(settings.theme !== "light"); }, [settings?.theme]);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    try { await updateSetting("theme", next ? "dark" : "light"); await client.invalidateQueries({ queryKey: ["settings"] }); } catch { setIsDark(!next); }
  };

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DarkColors : LightColors, isDark, toggleTheme }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
