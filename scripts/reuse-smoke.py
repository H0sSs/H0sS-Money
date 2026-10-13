"""Reuse successful PR QA only for an identical repository tree; otherwise test afresh."""
import json, os, subprocess, sys, tempfile
from pathlib import Path

def eligible(run, repository, workflow):
    return (run.get('status') == 'completed' and run.get('conclusion') == 'success'
            and run.get('event') == 'pull_request' and run.get('workflow_id') == workflow
            and run.get('head_repository', {}).get('full_name') == repository)

def api(path):
    return json.loads(subprocess.check_output(['gh', 'api', path], text=True))

def main():
    if os.environ.get('GITHUB_EVENT_NAME') != 'push' or os.environ.get('GITHUB_REF') != 'refs/heads/main':
        return
    repository = os.environ['GITHUB_REPOSITORY']
    current_tree = subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], text=True).strip()
    own = api(f"repos/{repository}/actions/runs/{os.environ['GITHUB_RUN_ID']}")
    runs = api(f"repos/{repository}/actions/workflows/{own['workflow_id']}/runs?event=pull_request&status=success&per_page=20")['workflow_runs']
    for run in runs:
        if not eligible(run, repository, own['workflow_id']):
            continue
        tree = api(f"repos/{repository}/git/commits/{run['head_sha']}")['tree']['sha']
        if tree != current_tree:
            continue
        name = 'android-smoke-evidence-api-' + os.environ['ANDROID_API']
        with tempfile.TemporaryDirectory() as folder:
            subprocess.run(['gh', 'run', 'download', str(run['id']), '--repo', repository, '--name', name, '--dir', folder], check=True)
            evidence = Path(folder)
            for file in ['result.txt', 'exports-result.txt']:
                assert (evidence/file).read_text().startswith('PASS:'), 'Incomplete QA evidence'
            for file in ['report.pdf', 'export-stats.png', 'expenses-redesign.png']:
                assert (evidence/file).stat().st_size > 0, 'Missing native QA evidence'
            import shutil
            shutil.copytree(evidence, 'smoke', dirs_exist_ok=True)
        proof = f"Verified identical tree {current_tree}; original successful PR run {run['id']}\n"
        Path('smoke/reuse-proof.txt').write_text(proof)
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write('reused=true\n')
        print(proof)
        return
    print('No successful PR QA with an identical tree; running the emulator tests.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('QA reuse unavailable; fresh emulator tests will run: ' + str(error), file=sys.stderr)
