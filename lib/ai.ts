import * as SecureStore from "expo-secure-store";

export type AIProvider = "openai" | "gemini";

export type ParsedExpense = {
  amount: number | null;
  description: string;
  categoryName: string | null;
  note: string | null;
  transcript: string;
};

// ─── Secure Key Storage ───────────────────────────────────────
export async function saveAPIKey(provider: AIProvider, key: string) {
  await SecureStore.setItemAsync(`${provider}_api_key`, key);
}

export async function getAPIKey(provider: AIProvider): Promise<string | null> {
  return SecureStore.getItemAsync(`${provider}_api_key`);
}

// ─── OpenAI ───────────────────────────────────────────────────
async function transcribeWithOpenAI(
  audioBase64: string,
  format: string,
  apiKey: string
): Promise<string> {
  const mimeMap: Record<string, string> = {
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  const mime = mimeMap[format] ?? "audio/mp4";

  const binaryStr = atob(audioBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });

  const formData = new FormData();
  formData.append("file", blob as any, `recording.${format}`);
  formData.append("model", "gpt-4o-mini-transcribe");
  formData.append("language", "ar");
  formData.append("response_format", "json");
  formData.append(
    "prompt",
    "تسجيل صوتي لمصروف مالي. مثال: اشتريت سجاير بـ 50 جنيه، دفعت فاتورة كهرباء 200 جنيه."
  );

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI transcription failed: ${err}`);
  }
  const data = await resp.json();
  return data.text ?? "";
}

async function parseWithOpenAI(
  transcript: string,
  categoryNames: string,
  apiKey: string
): Promise<Omit<ParsedExpense, "transcript">> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `أنت مساعد لاستخراج بيانات المصاريف من النص العربي والإنجليزي.
استخرج:
1. amount: المبلغ بالجنيه المصري (رقم فقط)
2. description: وصف قصير
3. categoryName: الفئة الأنسب من: ${categoryNames || "أكل، مواصلات، تسوق، أخرى"}
4. note: ملاحظة إضافية أو null
أجب بـ JSON فقط: {"amount": number|null, "description": "string", "categoryName": "string|null", "note": "string|null"}`,
        },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`OpenAI parse failed: ${await resp.text()}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { amount: null, description: transcript, categoryName: null, note: null };
  } catch {
    return { amount: null, description: transcript, categoryName: null, note: null };
  }
}

// ─── Gemini ───────────────────────────────────────────────────
async function transcribeWithGemini(
  audioBase64: string,
  format: string,
  apiKey: string
): Promise<string> {
  const mimeMap: Record<string, string> = {
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  const mime = mimeMap[format] ?? "audio/mp4";

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mime, data: audioBase64 } },
              {
                text: "استمع لهذا التسجيل الصوتي العربي وانسخ ما يقوله الشخص حرفياً بدون أي تفسير أو إضافات. أعد النص المنطوق فقط.",
              },
            ],
          },
        ],
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini transcription failed: ${await resp.text()}`);
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function parseWithGemini(
  transcript: string,
  categoryNames: string,
  apiKey: string
): Promise<Omit<ParsedExpense, "transcript">> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `استخرج بيانات المصروف من: "${transcript}"
الفئات المتاحة: ${categoryNames}
أجب بـ JSON فقط بدون أي نص آخر:
{"amount": رقم_أو_null, "description": "وصف قصير", "categoryName": "اسم_الفئة_أو_null", "note": "ملاحظة_أو_null"}`,
              },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!resp.ok) throw new Error(`Gemini parse failed: ${await resp.text()}`);
  const data = await resp.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { amount: null, description: transcript, categoryName: null, note: null };
  } catch {
    return { amount: null, description: transcript, categoryName: null, note: null };
  }
}

// ─── Main Parse Function ──────────────────────────────────────
export async function parseVoiceExpense(
  audioBase64: string,
  format: string,
  provider: AIProvider,
  categories: { name: string }[]
): Promise<ParsedExpense> {
  const apiKey = await getAPIKey(provider);
  if (!apiKey) {
    throw new Error(
      provider === "openai"
        ? "يرجى إضافة OpenAI API Key من لوحة الإدارة"
        : "يرجى إضافة Gemini API Key من لوحة الإدارة"
    );
  }

  const categoryNames = categories.map((c) => c.name).join(", ");
  let transcript: string;
  let parsed: Omit<ParsedExpense, "transcript">;

  if (provider === "openai") {
    transcript = await transcribeWithOpenAI(audioBase64, format, apiKey);
    parsed = await parseWithOpenAI(transcript, categoryNames, apiKey);
  } else {
    transcript = await transcribeWithGemini(audioBase64, format, apiKey);
    parsed = await parseWithGemini(transcript, categoryNames, apiKey);
  }

  return { ...parsed, transcript };
}

// ─── Voice Summary (Feature D) ────────────────────────────────
export async function generateVoiceSummary(
  total: number,
  count: number,
  currency: string,
  provider: AIProvider
): Promise<string> {
  const baseText = `أنفقت اليوم ${total.toFixed(2)} ${currency} في ${count} عملية`;
  if (provider === "openai") {
    const apiKey = await getAPIKey("openai");
    if (!apiKey) return baseText;
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "أنت مساعد مالي شخصي. رد بجملة واحدة قصيرة باللغة العربية الدارجة المصرية." },
            { role: "user", content: `ملخص اليوم: ${baseText}. اعمل تعليق قصير مشجع.` },
          ],
          max_tokens: 80,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.choices?.[0]?.message?.content ?? baseText;
      }
    } catch { /* fall through */ }
  }
  return baseText;
}
