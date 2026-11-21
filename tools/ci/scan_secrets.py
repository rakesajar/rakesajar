#!/usr/bin/env python3
"""Scan tracked files for likely committed secrets. Exit 1 on any finding.

Local rules, no network. Findings print path:line and the rule name, never the matched value.
"""
import re
import subprocess
import sys
from pathlib import Path

RULES = {
    'private-key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----'),
    'aws-access-key': re.compile(r'\b(?:AKIA|ASIA)[0-9A-Z]{16}\b'),
    'github-token': re.compile(r'\bgh[pousr]_[A-Za-z0-9]{36,}\b'),
    'anthropic-key': re.compile(r'\bsk-ant-[A-Za-z0-9_-]{20,}'),
    'openai-key': re.compile(r'\bsk-(?:proj-)?[A-Za-z0-9]{32,}\b'),
    'google-api-key': re.compile(r'\bAIza[0-9A-Za-z_-]{35}\b'),
    'slack-token': re.compile(r'\bxox[abprs]-[A-Za-z0-9-]{10,}'),
    'stripe-key': re.compile(r'\b[sr]k_live_[A-Za-z0-9]{20,}'),
    'generic-assignment': re.compile(
        r'(?i)\b(?:api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\b\s*[:=]\s*["\'][^"\'\s]{12,}["\']'
    ),
}
SKIP_SUFFIXES = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.woff', '.woff2', '.ico', '.pdf', '.zip'}
SKIP_FILES = {'site/package-lock.json'}


def main() -> int:
    root = Path(subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip())
    files = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).split(b'\0')
    findings = []
    for raw in files:
        if not raw:
            continue
        rel = raw.decode()
        path = root / rel
        if rel in SKIP_FILES or path.suffix.lower() in SKIP_SUFFIXES or not path.is_file():
            continue
        try:
            text = path.read_text(encoding='utf-8')
        except (UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for name, rule in RULES.items():
                if rule.search(line):
                    findings.append(f'{rel}:{lineno}: {name}')
    if findings:
        print('Possible secrets found:\n  ' + '\n  '.join(findings))
        return 1
    print(f'Secret scan passed ({len(files)} tracked paths checked).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
