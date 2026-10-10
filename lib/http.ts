export async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  catch (error) { if (controller.signal.aborted) throw new Error("انتهت مهلة الاتصال؛ حاول مجددًا"); throw error; }
  finally { clearTimeout(timer); }
}
