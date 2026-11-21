#!/usr/bin/env python3
"""Run approved command adapters and issue revision-bound mechanical evidence.

This is not a sandbox, scanner, approval authority or autonomous merge tool.
Run only with reviewed policy in an appropriately isolated execution environment.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import time

TIERS = ('T0', 'T1', 'T2')
REQUIRED = {
    'T0': {'tests', 'secrets'},
    'T1': {'tests', 'secrets', 'lint', 'sast', 'dependencies', 'diff_coverage', 'knowledge'},
    'T2': {'tests', 'secrets', 'lint', 'sast', 'dependencies', 'diff_coverage', 'knowledge', 'types', 'critical_tests'},
}
NA_ALLOWED = {'diff_coverage', 'types', 'dependencies', 'knowledge', 'critical_tests', 'sast'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git(repo, *args):
    return subprocess.check_output(['git', *args], cwd=repo, text=True, stderr=subprocess.PIPE).strip()


def visible_index(repo):
    entries = subprocess.check_output(['git', 'ls-files', '-v', '-z'], cwd=repo).split(b'\0')
    return all(not entry or entry.startswith(b'H ') for entry in entries)


def invoke(check, repo, env, log):
    argv = check.get('argv')
    timeout = check.get('timeout_seconds', 300)
    if not isinstance(argv, list) or not argv or not all(isinstance(x, str) and x for x in argv):
        return {'status': 'ERROR', 'reason': 'argv must be a nonempty string array'}
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 86400:
        return {'status': 'ERROR', 'reason': 'timeout must be between 0 and 86400 seconds'}
    start = time.monotonic()
    try:
        with log.open('x') as stream:
            proc = subprocess.Popen(argv, cwd=repo, env=env, stdout=stream, stderr=subprocess.STDOUT,
                                    start_new_session=(os.name == 'posix'))
            try:
                code = proc.wait(timeout=timeout)
                status = 'PASS' if code == 0 else 'FAIL'
            except subprocess.TimeoutExpired:
                if os.name == 'posix':
                    os.killpg(proc.pid, signal.SIGKILL)
                else:
                    proc.kill()
                proc.wait()
                code, status = None, 'TIMEOUT'
        return {'status': status, 'exit_code': code, 'seconds': round(time.monotonic() - start, 3),
                'log': str(log), 'log_sha256': digest(log.read_bytes()), 'argv': argv}
    except OSError as exc:
        return {'status': 'ERROR', 'reason': str(exc)}


def run(args):
    repo = Path(args.repo).resolve()
    root = Path(git(repo, 'rev-parse', '--show-toplevel')).resolve()
    if root != repo:
        raise ValueError('--repo must identify the repository root')
    out = Path(args.out).resolve()
    if out == repo or repo in out.parents:
        raise ValueError('Evidence output must be outside the repository')
    if out.exists():
        raise ValueError('Use a new output directory for each run; evidence is not overwritten')
    if not visible_index(repo):
        raise ValueError('Final gate requires a fully materialized index without assume-unchanged/skip-worktree flags')
    if git(repo, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Candidate tree is dirty; commit owned changes before the final gate')
    head = git(repo, 'rev-parse', 'HEAD')
    base = git(repo, 'rev-parse', '--verify', args.base + '^{commit}')
    if subprocess.run(['git', 'merge-base', '--is-ancestor', base, head], cwd=repo).returncode:
        raise ValueError('Candidate must integrate the supplied target revision before final validation')
    spec_path = (repo / args.spec).resolve()
    if repo not in spec_path.parents:
        raise ValueError('Spec must be a tracked file inside the repository')
    spec_rel = str(spec_path.relative_to(repo))
    git(repo, 'ls-files', '--error-unmatch', '--', spec_rel)
    spec_bytes = spec_path.read_bytes()
    spec = json.loads(spec_bytes)
    if not isinstance(spec, dict) or spec.get('tier') not in TIERS:
        raise ValueError('Spec requires tier T0, T1 or T2')
    tier = TIERS[max(TIERS.index(spec['tier']), TIERS.index(args.min_tier))]
    policy_path = Path(args.policy).resolve()
    policy_bytes = policy_path.read_bytes()
    policy = json.loads(policy_bytes)
    if not isinstance(policy, dict) or policy.get('version') != 1 or not isinstance(policy.get('checks'), dict):
        raise ValueError('Policy requires version 1 and a checks object')
    checks = policy['checks']
    if not all(re.fullmatch(r'[a-z][a-z0-9_]{0,60}', n) for n in checks):
        raise ValueError('Invalid check name')
    out.mkdir(parents=True)
    os.chmod(out, 0o700)
    env = dict(os.environ, AGENTIC_HEAD=head, AGENTIC_BASE=base, AGENTIC_TIER=tier,
               AGENTIC_EVIDENCE_DIR=str(out))
    results = {}
    for name in sorted(REQUIRED[tier] | set(checks)):
        check = checks.get(name)
        if check is None:
            results[name] = {'status': 'MISSING', 'reason': 'Required adapter absent'}
        elif not isinstance(check, dict):
            results[name] = {'status': 'ERROR', 'reason': 'Check must be an object'}
        elif 'not_applicable' in check:
            reason = check['not_applicable']
            valid = name in NA_ALLOWED and isinstance(reason, str) and bool(reason.strip()) and 'argv' not in check
            results[name] = {'status': 'NOT_APPLICABLE' if valid else 'ERROR', 'reason': reason}
        else:
            results[name] = invoke(check, repo, env, out / (name + '.log'))
    stable = (visible_index(repo) and git(repo, 'rev-parse', 'HEAD') == head
              and not git(repo, 'status', '--porcelain', '--untracked-files=all')
              and policy_path.read_bytes() == policy_bytes and spec_path.read_bytes() == spec_bytes)
    passed = stable and all(v['status'] in ('PASS', 'NOT_APPLICABLE') for v in results.values())
    receipt = {'schema_version': 1, 'generated_at': datetime.now(timezone.utc).isoformat(),
               'head': head, 'base': base, 'tier': tier, 'policy_sha256': digest(policy_bytes),
               'spec_sha256': digest(spec_bytes), 'runner_sha256': digest(Path(__file__).read_bytes()),
               'tree_unchanged': stable, 'result': 'PASS' if passed else 'FAIL',
               'merge_authorized': False, 'checks': results}
    (out / 'gate.json').write_text(json.dumps(receipt, indent=2) + '\n')
    lines = ['# Mechanical quality evidence', '', f'Result: {receipt["result"]}',
             f'Candidate: {head}', f'Target: {base}', f'Tier: {tier}',
             '', 'This report does not authorize merging.', '', '| Check | Result |', '|---|---|']
    lines += [f'| {n} | {v["status"]} |' for n, v in results.items()]
    (out / 'quality.md').write_text('\n'.join(lines) + '\n')
    coverage = results.get('diff_coverage', {'status': 'NOT_REQUIRED'})
    (out / 'coverage.md').write_text('# Coverage evidence\n\n' + f'Status: {coverage["status"]}\n\n'
        + 'See diff_coverage.log and adapter artifacts for measured values. No percentage is inferred.\n')
    print(json.dumps({'result': receipt['result'], 'receipt': str(out / 'gate.json'), 'merge_authorized': False}))
    return 0 if passed else 1


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo', default='.')
    p.add_argument('--policy', required=True)
    p.add_argument('--spec', required=True)
    p.add_argument('--base', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--min-tier', choices=TIERS, default='T0')
    try:
        return run(p.parse_args())
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        print('Gate blocked: ' + str(exc), file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
