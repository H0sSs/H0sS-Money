import * as Print from 'expo-print';

// Some Android WebViews disappear without resolving Expo's native promise.
// Retry PDF creation once; a late result never opens a second share dialog.
export async function printPdf(options: Print.FilePrintOptions, timeoutMs = 30000): Promise<Print.FilePrintResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Print.printToFileAsync(options),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('تعذر تجهيز PDF في الوقت المحدد؛ حاول مرة أخرى أو صدّر CSV')), timeoutMs);
        }),
      ]);
    } catch (error) {
      if (attempt === 1) throw error;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  throw new Error('تعذر تجهيز PDF');
}
