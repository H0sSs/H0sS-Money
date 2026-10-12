export type AppFont = 'ArabicRegular' | 'ArabicMedium' | 'ArabicBold';
export function fontForStyle(style: {fontFamily?: string; fontWeight?: string | number} = {}, inherited: AppFont = 'ArabicRegular'): AppFont {
  const weight = style.fontWeight === 'bold' ? 700 : style.fontWeight === 'normal' ? 400 : Number(style.fontWeight);
  if (Number.isFinite(weight)) return weight >= 700 ? 'ArabicBold' : weight >= 500 ? 'ArabicMedium' : 'ArabicRegular';
  if (style.fontFamily === 'ArabicBold' || style.fontFamily === 'ArabicMedium' || style.fontFamily === 'ArabicRegular') return style.fontFamily;
  return inherited;
}
