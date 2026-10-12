import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
async function encoded(module: number) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('تعذر تحميل موارد التقرير');
  return FileSystem.readAsStringAsync(asset.localUri, {encoding:FileSystem.EncodingType.Base64});
}
export async function reportAssets(customLogo?:string|null) {
  const [logo,font,boldFont] = await Promise.all([
    encoded(require('../assets/images/icon.png')),
    encoded(require('../assets/fonts/Tajawal-Regular.ttf')),
    encoded(require('../assets/fonts/Tajawal-Bold.ttf')),
  ]);
  // Settings may store a local URI or raw base64; PDF must embed a data URI.
  let image = `data:image/png;base64,${logo}`;
  if (customLogo?.startsWith('data:image/')) image = customLogo;
  return {logo:image,font,boldFont};
}
