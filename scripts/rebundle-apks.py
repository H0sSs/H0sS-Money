"""Re-use verified native APK containers for a strictly JS-only report hotfix."""
from pathlib import Path
import zipfile,hashlib,subprocess,os
root=Path('output');root.mkdir(exist_ok=True)
bundle=Path('/tmp/hoss-index.android.bundle').read_bytes()
assert bundle[:8]==bytes.fromhex('c61fbc03c103191f'), 'Expected Hermes bytecode'
tools=Path(os.environ['ANDROID_HOME'])/'build-tools/36.0.0'
def sig(name):return name.startswith('META-INF/') and (name.endswith(('.RSA','.DSA','.EC','.SF')) or name=='META-INF/MANIFEST.MF')
for variant in ['arm64','universal']:
 folder=Path('base-apks')/('H0sS-Money-release-'+variant)
 src=folder/f'H0sS-Money-1.2.3-{variant}.apk'
 assert hashlib.sha256(src.read_bytes()).hexdigest()==(folder/'SHA256SUMS.txt').read_text().split()[0]
 subprocess.run([str(tools/'apksigner'),'verify',str(src)],check=True)
 unsigned=Path('/tmp')/(variant+'-unsigned.apk');aligned=Path('/tmp')/(variant+'-aligned.apk')
 with zipfile.ZipFile(src) as old,zipfile.ZipFile(unsigned,'w') as new:
  before=old.read('assets/index.android.bundle');assert bundle[:12]==before[:12], 'Hermes bytecode version changed'
  expected={}
  for entry in old.infolist():
   if sig(entry.filename):continue
   payload=bundle if entry.filename=='assets/index.android.bundle' else old.read(entry.filename)
   if entry.filename!='assets/index.android.bundle':expected[entry.filename]=hashlib.sha256(payload).digest()
   entry.extra=b'';new.writestr(entry,payload)
 subprocess.run([str(tools/'zipalign'),'-P','16','-f','4',str(unsigned),str(aligned)],check=True)
 out=root/f'H0sS-Money-1.2.3-{variant}.apk'
 subprocess.run([str(tools/'apksigner'),'sign','--ks','android/app/debug.keystore','--ks-pass','pass:android','--key-pass','pass:android','--out',str(out),str(aligned)],check=True)
 with zipfile.ZipFile(out) as final:
  assert set(final.namelist())-{n for n in final.namelist() if sig(n)}==set(expected)|{'assets/index.android.bundle'}
  assert all(hashlib.sha256(final.read(n)).digest()==digest for n,digest in expected.items()), 'Native container changed'
  assert final.read('assets/index.android.bundle')==bundle
 signature=subprocess.check_output([str(tools/'apksigner'),'verify','--verbose','--print-certs',str(out)],text=True)
 assert 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c' in signature
 badge=subprocess.check_output([str(tools/'aapt'),'dump','badging',str(out)],text=True)
 assert "versionName='1.2.3'" in badge and "versionCode='6'" in badge and 'application-debuggable' not in badge
 target=root/variant;target.mkdir();out.rename(target/out.name)
 (target/'SHA256SUMS.txt').write_text(hashlib.sha256((target/out.name).read_bytes()).hexdigest()+'  '+out.name+'\n')
 (target/'signature.txt').write_text(signature);(target/'package.txt').write_text(badge)
 (target/'SIGNING-NOTE.txt').write_text('QA ONLY: development certificate. Private signing required before publication.\n')
 (target/'native-reuse.txt').write_text(f'PASS: all {len(expected)} unchanged native/resource entries match the validated base APK; only Hermes bundle/signatures replaced; bytecode version unchanged; 16 KB alignment checked.\n')
 print((target/'native-reuse.txt').read_text())
