"""Resolve the latest published base, then verify its APKs before native reuse."""
import argparse, hashlib, json, os, re, subprocess
from pathlib import Path

CERTIFICATE = '8967c433f04f9e2879f88a95f92c95d268316163d84db3442ef221f415fae91c'
APP_PATHS = ['app', 'components', 'contexts', 'lib', 'assets', 'plugins', 'vendor',
             'app.json', 'package.json', 'package-lock.json', 'babel.config.js',
             'metro.config.js', 'tsconfig.json', 'expo-env.d.ts']

def metadata(release):
    assert not release.get('draft') and not release.get('prerelease'), 'Base must be a public stable release'
    tag = release['tag_name']
    assert re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', tag), 'Unsupported base version'
    base = json.loads(subprocess.check_output(['git', 'show', f'{tag}:app.json']))
    current = json.loads(Path('app.json').read_text())
    base_version, base_code = base['expo']['version'], base['expo']['android']['versionCode']
    version, code = current['expo']['version'], current['expo']['android']['versionCode']
    assert tag == 'v' + base_version, 'Tag and source version disagree'
    assert re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', version), 'Unsupported target version'
    assert type(code) is int and type(base_code) is int and code > 0 and base_code > 0
    published = version == base_version
    if published:
        assert code == base_code, 'Published version code changed; bump the version'
        subprocess.run(['git', 'diff', '--exit-code', tag, 'HEAD', '--', *APP_PATHS],
                       check=True, stdout=subprocess.DEVNULL)
    else:
        assert code > base_code, 'New releases need a higher Android versionCode'
    assets = {}
    for variant in ['arm64', 'universal']:
        name = f'H0sS-Money-{base_version}-{variant}.apk'
        asset = next((a for a in release['assets'] if a['name'] == name), None)
        assert asset and re.fullmatch(r'sha256:[0-9a-f]{64}', asset.get('digest', '')), f'Missing checksum: {name}'
        assets[variant] = {'name': name, 'sha256': asset['digest'][7:], 'size': asset['size']}
    return {'version': version, 'code': str(code), 'base_tag': tag,
            'base_version': base_version, 'base_code': str(base_code),
            'published': 'true' if published else 'false', 'assets': assets}

def verify(data, directory, sdk):
    tools = Path(sdk) / 'build-tools/36.0.0'
    for variant, expected in data['assets'].items():
        folder = directory / f'H0sS-Money-release-{variant}'
        apk = folder / expected['name']
        assert apk.stat().st_size == expected['size'], f'Wrong size: {variant}'
        with apk.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        assert digest == expected['sha256'], f'Checksum mismatch: {variant}'
        signature = subprocess.check_output([str(tools/'apksigner'), 'verify', '--verbose', '--print-certs', str(apk)], text=True)
        assert CERTIFICATE in signature, f'Wrong private release certificate: {variant}'
        badge = subprocess.check_output([str(tools/'aapt'), 'dump', 'badging', str(apk)], text=True)
        assert "name='com.hossmoney.app'" in badge and 'application-debuggable' not in badge
        assert f"versionName='{data['base_version']}'" in badge
        assert f"versionCode='{data['base_code']}'" in badge
        subprocess.run([str(tools/'zipalign'), '-P', '16', '-c', '4', str(apk)], check=True)
        (folder/'SHA256SUMS.txt').write_text(digest + '  ' + apk.name + '\n')
        print(f'PASS: {variant} {data["base_tag"]}, checksum, private certificate, version and 16 KB alignment')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'verify'])
    parser.add_argument('--release-json')
    parser.add_argument('--metadata', default='build-base.json')
    parser.add_argument('--directory', default='base-apks')
    args = parser.parse_args()
    if args.mode == 'prepare':
        data = metadata(json.loads(Path(args.release_json).read_text()))
        Path(args.metadata).write_text(json.dumps(data))
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
                for key in ['version', 'code', 'base_tag', 'base_version', 'base_code', 'published']:
                    f.write(f'{key}={data[key]}\n')
        print(f'PASS: base {data["base_tag"]}; target {data["version"]}/{data["code"]}; already published={data["published"]}')
    else:
        verify(json.loads(Path(args.metadata).read_text()), Path(args.directory), os.environ['ANDROID_HOME'])

if __name__ == '__main__':
    main()
