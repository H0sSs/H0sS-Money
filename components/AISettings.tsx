import { Text, TextInput } from "@/components/Typography";
import React, { useState, useEffect } from "react";
import { View, Pressable, ActivityIndicator, Alert, Linking } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSetting } from "@/lib/services";
import { getAPIKey, saveAPIKey, testAIConnection, getModel,saveModel,listGeminiModels, type ModelRole, type AIProvider } from "@/lib/ai";
import { useTheme } from "@/contexts/ThemeContext";
import Icon from "./Icon";
const PROVIDERS: { id: AIProvider; label: string; subtitle: string }[] = [
  { id: "gemini", label: "Gemini", subtitle: "النموذج قابل للاختيار" },
  { id: "openai", label: "OpenAI", subtitle: "النموذج قابل للاختيار" },
  { id: "zai", label: "Z.ai", subtitle: "النموذج قابل للاختيار" },
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
    <ModelSettings />
    {PROVIDERS.map(p => <KeyRow key={p.id} provider={p} />)}
    <Pressable onPress={() => Linking.openURL("https://z.ai/manage-apikey/apikey-list")} style={{ marginTop: 18, padding: 12 }}><Text style={{ color: c.primary, textAlign: "center", fontWeight: "700" }}>الحصول على مفتاح Z.ai ↗</Text></Pressable>
  </View>;
}

function ModelSettings(){
 const {colors:c}=useTheme();const [models,setModels]=useState<Record<ModelRole,string>>({gemini:'',openai:'',zai:'',speech:''}),[available,setAvailable]=useState<string[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{Promise.all((['gemini','openai','zai','speech'] as ModelRole[]).map(async role=>[role,await getModel(role)])).then(entries=>setModels(Object.fromEntries(entries))).catch(()=>{});},[]);
 async function save(){setBusy(true);try{for(const role of ['gemini','openai','zai','speech'] as ModelRole[])await saveModel(role,models[role]);Alert.alert('تم','تم حفظ النماذج؛ اختبر اتصال المزود، ثم جرّب تسجيلًا قصيرًا.');}catch(e){Alert.alert('النموذج',e instanceof Error?e.message:'تعذر الحفظ');}finally{setBusy(false);}}
 async function list(){setBusy(true);try{const rows=await listGeminiModels();setAvailable(rows);if(!rows.length)Alert.alert('النماذج','لم يرجع المزود نماذج متوافقة مع التوليد');}catch(e){Alert.alert('النماذج',e instanceof Error?e.message:'تعذر جلب القائمة');}finally{setBusy(false);}}
 return <View style={{marginTop:20,gap:12}}><Text style={{color:c.text,fontFamily:'ArabicBold',textAlign:'right'}}>اختيار النماذج</Text><Text style={{color:c.textSecondary,textAlign:'right',lineHeight:23}}>غيّر معرف النموذج إذا لم يكن متاحًا لمشروعك. اختر نماذج تدعم واجهات التحليل الحالية والصوت؛ القائمة لا تضمن حصة مجانية. احفظ الاختيار قبل اختبار الاتصال. نموذج OpenAI الصوتي منفصل، وGemini يستخدم نفس النموذج للصوت والتحليل. مفاتيحك واختيارات النماذج لا تُضمّن في النسخ الاحتياطية.</Text>{([['gemini','نموذج Gemini'],['openai','نموذج OpenAI للتحليل'],['zai','نموذج Z.ai'],['speech','نموذج OpenAI لتحويل الصوت']] as [ModelRole,string][]).map(([role,label])=><View key={role}><Text style={{color:c.textSecondary,textAlign:'right',marginBottom:6}}>{label}</Text><TextInput accessibilityLabel={label} editable={!busy} value={models[role]} onChangeText={v=>setModels(prev=>({...prev,[role]:v}))} autoCapitalize="none" autoCorrect={false} maxLength={120} style={{padding:14,borderRadius:12,backgroundColor:c.surfaceAlt,color:c.text,writingDirection:'ltr'}}/></View>)}<Pressable disabled={busy} onPress={list} style={{padding:14,borderRadius:12,borderWidth:1,borderColor:c.border}}><Text style={{color:c.primary,textAlign:'center'}}>جلب نماذج Gemini بالمفتاح المحفوظ</Text></Pressable>{available.map(id=><Pressable disabled={busy} key={id} onPress={()=>setModels(prev=>({...prev,gemini:id}))} style={{padding:10,borderRadius:10,backgroundColor:models.gemini===id?c.primary+'20':c.surfaceAlt}}><Text style={{color:c.text}}>{id}</Text></Pressable>)}<Pressable disabled={busy} onPress={save} style={{padding:14,borderRadius:12,backgroundColor:c.primary}}>{busy?<ActivityIndicator color={c.buttonText}/>:<Text style={{color:c.buttonText,textAlign:'center'}}>حفظ اختيار النماذج</Text>}</Pressable></View>;
}
