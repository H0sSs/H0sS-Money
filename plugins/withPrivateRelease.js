const {withAppBuildGradle,withAndroidManifest,withDangerousMod}=require('@expo/config-plugins');
const fs=require('fs');const path=require('path');
module.exports=function(config){
 config=withAppBuildGradle(config,c=>{
  const marker='// HOSS_PRIVATE_RELEASE';if(c.modResults.contents.includes(marker))return c;
  const signing=`${marker}\n    def hossKeyPath = System.getenv('HOSS_KEYSTORE_PATH')\n    if (System.getenv('HOSS_REQUIRE_PRIVATE_SIGNING') == 'true' && !hossKeyPath) { throw new GradleException('Private release keystore required') }\n    signingConfigs {\n        if (hossKeyPath) {\n            hossRelease {\n                storeFile file(hossKeyPath)\n                storePassword System.getenv('HOSS_KEYSTORE_PASSWORD')\n                keyAlias System.getenv('HOSS_KEY_ALIAS')\n                keyPassword System.getenv('HOSS_KEY_PASSWORD')\n            }\n        }`;
  c.modResults.contents=c.modResults.contents.replace('    signingConfigs {',signing);
  c.modResults.contents=c.modResults.contents.replace(/release\s*\{([\s\S]*?)signingConfig signingConfigs\.debug/, 'release {$1signingConfig hossKeyPath ? signingConfigs.hossRelease : signingConfigs.debug');
  return c;
 });
 config=withAndroidManifest(config,c=>{
  const app=c.modResults.manifest.application[0].$;app['android:allowBackup']='false';app['android:usesCleartextTraffic']='false';app['android:fullBackupContent']='@xml/hoss_backup_rules';app['android:dataExtractionRules']='@xml/hoss_extraction_rules';return c;
 });
 return withDangerousMod(config,['android',async c=>{
  const dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/res/xml');fs.mkdirSync(dir,{recursive:true});
  const exclusions=['root','file','database','sharedpref','external'].map(d=>`<exclude domain="${d}" path="."/>`).join('');
  fs.writeFileSync(path.join(dir,'hoss_backup_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><full-backup-content>${exclusions}</full-backup-content>`);
  fs.writeFileSync(path.join(dir,'hoss_extraction_rules.xml'),`<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${exclusions}</cloud-backup><device-transfer>${exclusions}</device-transfer></data-extraction-rules>`);
  return c;
 }]);
};
