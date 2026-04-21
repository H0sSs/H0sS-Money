import React, { createContext, useContext, useState, useEffect } from "react";
import { DarkColors, LightColors, ThemeColors } from "@/lib/theme";
import { getSettings, updateSetting } from "@/lib/services";

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

  useEffect(() => {
    getSettings().then((s) => setIsDark(s.theme !== "light")).catch(() => {});
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await updateSetting("theme", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DarkColors : LightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
