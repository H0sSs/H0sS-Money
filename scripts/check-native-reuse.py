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
assert not subprocess.check_output(['git','diff',base,'HEAD','--',*paths]).strip(),'Native resources/configuration changed'
print('PASS: native dependencies, configuration, assets, plugins and Metro settings unchanged from validated v1.2.4')
