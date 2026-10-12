const fs=require('fs'),assert=require('node:assert/strict');
const base='android/app/src/main/res/';const styles=fs.readFileSync(base+'values/styles.xml','utf8');
assert.match(styles,/name="windowSplashScreenAnimatedIcon">@drawable\/hoss_launch_mark/);
assert.match(styles,/name="android:windowBackground">@drawable\/hoss_launch_background/);
assert.match(styles,/name="android:forceDarkAllowed">false/);
const vector=fs.readFileSync(base+'drawable/hoss_launch_mark.xml','utf8');assert.ok(vector.startsWith('<vector'));assert.ok(!vector.includes('<bitmap'));assert.ok(vector.includes('viewportWidth="288"'));
const layer=fs.readFileSync(base+'drawable/hoss_launch_background.xml','utf8');assert.ok(layer.includes('@color/splashscreen_background'));assert.ok(layer.includes('android:gravity="center"'));
for(const variant of ['values','values-night']){const p=base+variant+'/colors.xml';if(fs.existsSync(p))assert.match(fs.readFileSync(p,'utf8'),/name="splashscreen_background">#102D39/);}
console.log('PASS: native vector launch mark, uniform day/night background and system bars');
