import { Text, TextInput } from "@/components/Typography";
import React, { useState, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Alert, Linking } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting } from "@/lib/services";
import { getAPIKey, saveAPIKey, testAIConnection, type AIProvider } from "@/lib/ai";
import { useTheme } from "@/contexts/ThemeContext";
import Icon from "./Icon";
const PROVIDERS: { id: AIProvider; label: string; subtitle: string }[] = [
  { id: "gemini", label: "Gemini", subtitle: "Gemini 2.5 Flash" },
  { id: "openai", label: "OpenAI", subtitle: "GPT-4o mini" },
  { id: "zai", label: "Z.ai", subtitle: "GLM-5" },
];
function KeyRow({ provider }: { provider: typeof PROVIDERS[number] }) {
  const { colors: c } = useTheme();
  const [key, setKey] = useState(""); const [show, setShow] = useState(false); const [status,setStatus]=useState<string|null>(null); const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { getAPIKey(provider.id).then(value => setKey(value ?? "")).catch(() => {}); }, [provider.id]);
  async function run(test: boolean) {
    setBusy(test ? "test" : "save");
    try { if (!key.trim()) throw new Error("أدخل المفتاح أولًا"); if (test) await testAIConnection(provider.id, key); else await saveAPIKey(provider.id, key); setStatus(test?"آخر اختبار: الاتصال ناجح":"المفتاح محفوظ؛ اختبر الاتصال للتأكد"); Alert.alert("تم", test ? "الاتصال بالنموذج يعمل" : "تم حفظ المفتاح بأمان"); }
    catch (error) { setStatus(error instanceof Error?error.message:"تعذر الاتصال"); Alert.alert("تعذر الإكمال", error instanceof Error ? error.message : "حاول مرة أخرى"); }
    finally { setBusy(null); }
  }
  return <View style={{ marginTop: 18, gap: 8 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.text, fontWeight: "700" }}>{provider.label}</Text><Text style={{ color: c.textSecondary, fontSize: 12 }}>{provider.subtitle}</Text></View>
    <Text style={{color:c.textSecondary,fontFamily:"ArabicRegular",textAlign:"right",fontSize:12}}>{status??(key?"المفتاح موجود؛ لم يُختبر في هذه الجلسة":"المفتاح غير مضاف")}</Text>
    <View style={{ backgroundColor: c.surfaceAlt, borderRadius: 14, borderWidth: 1, borderColor: c.border, flexDirection: "row", alignItems: "center" }}>
      <TextInput accessibilityLabel={`مفتاح ${provider.label}`} value={key} onChangeText={setKey} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} placeholder="API Key" placeholderTextColor={c.textSecondary} style={{ flex: 1, padding: 14, color: c.text }} />
      <Pressable accessibilityLabel={show ? "إخفاء المفتاح" : "إظهار المفتاح"} onPress={() => setShow(!show)} style={{ padding: 14 }}><Icon name={show ? "eye-off" : "eye"} color={c.textSecondary} size={18} /></Pressable>
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>{[false, true].map(test => <Pressable key={String(test)} disabled={!!busy} onPress={() => run(test)} style={{ flex: 1, alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: test ? c.surfaceAlt : c.primary }}>{busy === (test ? "test" : "save") ? <ActivityIndicator color={test ? c.text : c.buttonText} /> : <Text style={{ color: test ? c.text : c.buttonText, fontWeight: "700" }}>{test ? "اختبار الاتصال" : "حفظ المفتاح"}</Text>}</Pressable>)}</View>
  </View>;
}
export default function AISettings() {
  const { colors: c } = useTheme(); const client = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const set = async (key: string, value: string) => { try { await updateSetting(key, value); await client.invalidateQueries({ queryKey: ["settings"] }); } catch { Alert.alert("خطأ", "تعذر حفظ الاختيار"); } };
  function choices(speech: boolean) {
    const selected = speech ? settings?.speechProvider : settings?.aiProvider;
    return <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>{PROVIDERS.filter(p => !speech || p.id !== "zai").map(p => <Pressable key={p.id} onPress={() => set(speech ? "speechProvider" : "aiProvider", p.id)} style={{ flex: 1, alignItems: "center", paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: selected === p.id ? c.primary : c.border, backgroundColor: selected === p.id ? c.primary + "18" : c.surfaceAlt }}><Text style={{ color: selected === p.id ? c.primary : c.text, fontWeight: "700" }}>{p.label}</Text></Pressable>)}</View>;
  }
  return <View>
    <Text style={{ color: c.text, fontWeight: "700", textAlign: "right" }}>تحليل المصروف</Text>{choices(false)}
    <Text style={{ color: c.text, fontWeight: "700", textAlign: "right", marginTop: 20 }}>تحويل الصوت إلى نص</Text>{choices(true)}
    <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 20, textAlign: "right", marginTop: 12 }}>عند اختيار Gemini للصوت والتحليل، يُستخدم طلب واحد للتسجيل. حدود الدقيقة واليوم تختلف حسب النموذج والمشروع ويمكن مراجعتها في AI Studio. GLM-5 يحلل النص؛ التسجيل الصوتي يستخدم مفتاح Gemini أو OpenAI. الطلبات ترسل للمزوّد المختار وتحتاج إنترنت.</Text>
    <Pressable onPress={() => Linking.openURL("https://aistudio.google.com/usage?tab=rate-limit")} style={{padding:12}}><Text style={{color:c.primary,textAlign:"center"}}>مراجعة حدود Gemini الفعلية ↗</Text></Pressable>
    {PROVIDERS.map(p => <KeyRow key={p.id} provider={p} />)}
    <Pressable onPress={() => Linking.openURL("https://z.ai/manage-apikey/apikey-list")} style={{ marginTop: 18, padding: 12 }}><Text style={{ color: c.primary, textAlign: "center", fontWeight: "700" }}>الحصول على مفتاح Z.ai ↗</Text></Pressable>
  </View>;
}
