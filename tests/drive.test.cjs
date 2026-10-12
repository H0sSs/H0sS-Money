const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function fixture(){
 const calls=[],stored=new Map(),settings={};let result={type:'success',data:{user:{email:'qa@example.invalid'}}};
 const sdk={configure:x=>calls.push(['configure',x]),hasPlayServices:async()=>true,signIn:async()=>result,getTokens:async()=>({accessToken:'qa-token'}),signOut:async()=>calls.push(['signOut'])};
 const mocks={'@react-native-google-signin/google-signin':{GoogleSignin:sdk,statusCodes:{}},'expo-secure-store':{setItemAsync:async(k,v)=>stored.set(k,v),deleteItemAsync:async k=>stored.delete(k)},'react-native':{Platform:{OS:'android'}},'expo-auth-session':{makeRedirectUri:()=>''},'expo-web-browser':{maybeCompleteAuthSession:()=>{}},'./services':{updateSetting:async(k,v)=>{settings[k]=v},getSettings:async()=>settings},'./dates':{},'./http':{}};
 const module={exports:{}};const code=ts.transpileModule(fs.readFileSync('lib/drive.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(`(function(require,module,exports){${code}})`,{URLSearchParams,Date})(n=>mocks[n]??require(n),module,module.exports);
 return {api:module.exports,calls,stored,settings,cancel:()=>{result={type:'cancelled'}}};
}
test('Android Drive uses account picker/scopes without a Web Client ID and clears auth after a cold SDK start',async()=>{
 const f=fixture();assert.equal(await f.api.connectDrive(),true);assert.equal(f.calls[0][1].webClientId,undefined);assert.equal(f.calls[0][1].scopes[0],'https://www.googleapis.com/auth/drive.file');assert.equal(f.settings.googleClientId,undefined);assert.equal(f.settings.driveAccountEmail,'qa@example.invalid');assert.equal(f.stored.get('drive_access_token'),'qa-token');
 f.calls.length=0;await f.api.clearDriveAuth();assert.equal(f.calls[0][0],'configure');assert.equal(f.calls[1][0],'signOut');assert.equal(f.stored.size,0);assert.equal(f.settings.driveNativeAuth,'false');
});
test('cancelled Google account selection does not persist credentials or connection state',async()=>{
 const f=fixture();f.cancel();assert.equal(await f.api.connectDrive(),false);assert.equal(f.stored.size,0);assert.equal(f.settings.driveNativeAuth,undefined);
});
