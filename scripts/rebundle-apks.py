"""Re-use verified native APK containers for a strictly JS-only application update."""
from pathlib import Path
import zipfile,hashlib,subprocess,os,runpy,json,re
patch_manifest=runpy.run_path("scripts/patch-apk-version.py")["patch_manifest"]
root=Path('output');root.mkdir(exist_ok=True)
bundle=Path('/tmp/hoss-index.android.bundle').read_bytes()
assert bundle[:8]==bytes.fromhex('c61fbc03c103191f'), 'Expected Hermes bytecode'
version=os.environ['HOSS_APK_VERSION']
version_code=os.environ['HOSS_VERSION_CODE']
base_version=os.environ.get('HOSS_BASE_VERSION',version)
base_code=os.environ.get('HOSS_BASE_CODE',version_code)
private_key=os.environ.get('HOSS_KEYSTORE_PATH')
assert private_key, 'Private signing key required'
expected_cert=os.environ['HOSS_CERTIFICATE_SHA256']
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
def sig(name):return name.startswith('META-INF/') and (name.endswith(('.RSA','.DSA','.EC','.SF')) or name=='META-INF/MANIFEST.MF')
for variant in ['arm64','universal']:
 folder=Path('base-apks')/('H0sS-Money-release-'+variant)
 src=folder/f'H0sS-Money-{base_version}-{variant}.apk'
 assert hashlib.sha256(src.read_bytes()).hexdigest()==(folder/'SHA256SUMS.txt').read_text().split()[0]
 subprocess.run([str(tools/'apksigner'),'verify',str(src)],check=True)
 unsigned=Path('/tmp')/(variant+'-unsigned.apk');aligned=Path('/tmp')/(variant+'-aligned.apk')
 with zipfile.ZipFile(src) as old,zipfile.ZipFile(unsigned,'w') as new:
  before=old.read('assets/index.android.bundle');assert bundle[:12]==before[:12], 'Hermes bytecode version changed'
  expected={}
  for entry in old.infolist():
   if sig(entry.filename):continue
   payload=bundle if entry.filename=='assets/index.android.bundle' else old.read(entry.filename)
   if entry.filename=='AndroidManifest.xml' and base_version!=version:payload=patch_manifest(payload,base_version,version,int(base_code),int(version_code))
   if entry.filename=='assets/app.config' and base_version!=version:
    config=json.loads(payload);assert config['version']==base_version and config['android']['versionCode']==int(base_code)
    text=payload.decode();text,n=re.subn(r'("version"\s*:\s*")'+re.escape(base_version)+r'(")',lambda m:m[1]+version+m[2],text);assert n==1
    text,n=re.subn(r'("versionCode"\s*:\s*)'+re.escape(base_code)+r'(?=\s*[,}])',lambda m:m[1]+version_code,text);assert n==1
    config['version']=version;config['android']['versionCode']=int(version_code);assert json.loads(text)==config
    payload=text.encode()

   if entry.filename!='assets/index.android.bundle':expected[entry.filename]=hashlib.sha256(payload).digest()
   entry.extra=b'';new.writestr(entry,payload)
 subprocess.run([str(tools/'zipalign'),'-P','16','-f','4',str(unsigned),str(aligned)],check=True)
 out=root/f'H0sS-Money-{version}-{variant}.apk'
 signing=['--ks',private_key,'--ks-key-alias',os.environ['HOSS_KEY_ALIAS'],'--ks-pass','env:HOSS_KEYSTORE_PASSWORD','--key-pass','env:HOSS_KEY_PASSWORD']
 subprocess.run([str(tools/'apksigner'),'sign',*signing,'--out',str(out),str(aligned)],check=True)
 subprocess.run([str(tools/'zipalign'),'-P','16','-c','4',str(out)],check=True)
 with zipfile.ZipFile(out) as final:
  assert set(final.namelist())-{n for n in final.namelist() if sig(n)}==set(expected)|{'assets/index.android.bundle'}
  assert all(hashlib.sha256(final.read(n)).digest()==digest for n,digest in expected.items()), 'Native container changed'
  assert final.read('assets/index.android.bundle')==bundle
 signature=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(out)],text=True)
 assert expected_cert in signature
 badge=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(out)],text=True)
 assert f"versionName='{version}'" in badge and f"versionCode='{version_code}'" in badge and 'application-debuggable' not in badge
 target=root/variant;target.mkdir();out.rename(target/out.name)
 (target/'SHA256SUMS.txt').write_text(hashlib.sha256((target/out.name).read_bytes()).hexdigest()+'  '+out.name+'\n')
 (target/'signature.txt').write_text(signature);(target/'package.txt').write_text(badge)
 (target/'SIGNING-NOTE.txt').write_text('Private H0sS-Money release certificate.\n')
 (target/'native-reuse.txt').write_text(f'PASS: all {len(expected)} unchanged native/resource entries match the validated base APK; only Hermes bundle, version attributes and signatures replaced; bytecode version unchanged; 16 KB alignment checked.\n')
 print((target/'native-reuse.txt').read_text())
