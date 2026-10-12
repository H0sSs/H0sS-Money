import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
async function encoded(module: number) {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('تعذر تحميل موارد التقرير');
  // Release Android assets can be bare raw/drawable resource names. Base64
  // reading only accepts file/content/asset URIs; copyAsync supports resources.
  const uri = asset.localUri;
  if (/^(file|content|asset):/.test(uri)) {
    return FileSystem.readAsStringAsync(uri, {encoding:FileSystem.EncodingType.Base64});
  }
  if (!FileSystem.cacheDirectory) throw new Error('تعذر تجهيز موارد التقرير');
  const target = `${FileSystem.cacheDirectory}report-${asset.hash ?? asset.name}.${asset.type}`;
  await FileSystem.copyAsync({from:uri,to:target});
  return FileSystem.readAsStringAsync(target, {encoding:FileSystem.EncodingType.Base64});
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
