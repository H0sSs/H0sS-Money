const {withBaseMod,withDangerousMod}=require('@expo/config-plugins');
const fs=require('fs'),path=require('path');
const background='#102D39';
// Native vector has no embedded rectangular background; all launch layers share one color.
module.exports=config=>{
 config=withBaseMod(config,{platform:'android',mod:'styles',async action(c){
  c=await c.modRequest.nextMod(c);
  const splash=c.modResults.resources.style.find(s=>s.$.name==='Theme.App.SplashScreen');
  if(!splash)throw Error('Android launch theme missing');
  const values={'windowSplashScreenBackground':background,'windowSplashScreenAnimatedIcon':'@drawable/hoss_launch_mark','android:windowBackground':'@drawable/hoss_launch_background','android:statusBarColor':background,'android:navigationBarColor':background,'android:windowLightStatusBar':'false','android:windowLightNavigationBar':'false','android:forceDarkAllowed':'false'};
  for(const [name,value]of Object.entries(values)){let item=splash.item.find(x=>x.$.name===name);if(item)item._=value;else splash.item.push({$: {name},_:value});}
  return c;
 }});
 return withDangerousMod(config,['android',async c=>{
  const root=path.join(c.modRequest.platformProjectRoot,'app/src/main/res');const dir=path.join(root,'drawable');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'hoss_launch_mark.xml'),`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="288dp" android:height="288dp" android:viewportWidth="288" android:viewportHeight="288"><path android:pathData="M192,101 L192,86 A16,16 0,0 0,176 70 L96,70 A20,20 0,0 0,76 90 L76,198 A20,20 0,0 0,96 218 L176,218 A16,16 0,0 0,192 202 L192,187 M96,90 L188,90 A16,16 0,0 1,204 106 L204,125 M204,173 L204,198 M182,125 L210,125 L210,173 L182,173 A24,24 0,0 1,182 125 Z" android:fillColor="#00000000" android:strokeColor="#65E0CE" android:strokeWidth="10" android:strokeLineCap="round" android:strokeLineJoin="round"/><path android:pathData="M109,114 L109,172 M147,114 L147,172 M109,143 L147,143" android:fillColor="#00000000" android:strokeColor="#F5FAF9" android:strokeWidth="9" android:strokeLineCap="round"/><path android:pathData="M183,145 A4,4 0,1 0,183 153 A4,4 0,1 0,183 145" android:fillColor="#65E0CE"/></vector>`);
  fs.writeFileSync(path.join(dir,'hoss_launch_background.xml'),`<layer-list xmlns:android="http://schemas.android.com/apk/res/android"><item android:drawable="@color/splashscreen_background"/><item android:drawable="@drawable/hoss_launch_mark" android:gravity="center"/></layer-list>`);
  return c;
 }]);
};
