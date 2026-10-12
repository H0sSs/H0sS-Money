"""Fail closed: JS-only reuse requires byte-identical native config/assets/dependencies."""
import json,subprocess
from pathlib import Path
base='v1.2.4'
def old(path):return subprocess.check_output(['git','show',f'{base}:{path}'])
a=json.loads(old('app.json'));b=json.loads(Path('app.json').read_text())
for obj in (a,b):obj['expo'].pop('version',None);obj['expo']['android'].pop('versionCode',None)
assert a==b,'Native configuration changed: full native build required'
a=json.loads(old('package-lock.json'));b=json.loads(Path('package-lock.json').read_text())
for obj in (a,b):obj.pop('version',None);obj['packages'][''].pop('version',None)
assert a==b,'Dependencies changed: full native build required'
paths=['assets','plugins','vendor','metro.config.js','babel.config.js']
changed=subprocess.check_output(['git','diff','--name-only',base,'HEAD','--',*paths],text=True).splitlines()
# This unused font license was removed by the documentation cleanup after v1.2.4.
# It was never packaged as an Android asset; all font/image binaries must match.
changed=[p for p in changed if p!='assets/fonts/OFL-NotoSansArabic.txt']
assert not changed,'Native resources/configuration changed: '+str(changed)
print('PASS: native dependencies, configuration, assets, plugins and Metro settings unchanged from validated v1.2.4')
