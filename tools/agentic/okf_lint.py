#!/usr/bin/env python3
"""Check the project's OKF profile, not full OKF semantic conformance."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

MARKER = '<!-- agentic-delivery:generated-index -->'


def instant(value):
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('timestamp requires a timezone')
    return dt


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('bundle')
    p.add_argument('--fix-index', action='store_true')
    args = p.parse_args()
    try:
        import yaml
    except ImportError:
        print('PyYAML is required; use an approved installation, no automatic installation.', file=sys.stderr)
        return 2
    root = Path(args.bundle).resolve()
    if not root.is_dir():
        print('Knowledge bundle missing', file=sys.stderr)
        return 2
    errors, warnings, concepts = [], [], []
    for path in sorted(root.rglob('*.md')):
        if root not in path.resolve().parents:
            errors.append(str(path) + ': path escapes bundle')
            continue
        if path.name in ('index.md', 'log.md'):
            continue
        rel = path.relative_to(root).as_posix()
        text = path.read_text()
        fm = re.match(r'\A---\s*\n(.*?)\n---\s*(?:\n|$)', text, re.S)
        try:
            data = yaml.safe_load(fm.group(1)) if fm else None
            if not isinstance(data, dict) or not isinstance(data.get('type'), str) or not data['type'].strip():
                raise ValueError('nonempty type and YAML frontmatter required')
            generated = data.get('generated')
            if generated is not None and (not isinstance(generated, dict) or not isinstance(generated.get('by'), str) or not generated['by'].strip()):
                raise ValueError('generated requires a nonempty string by actor')
            if generated is not None and not generated.get('at'):
                warnings.append(rel + ': generation time missing; freshness cannot be evaluated')
            generated_at = instant(generated['at']) if generated and generated.get('at') else None
            verified = data.get('verified', [])
            if isinstance(verified, dict):
                verified = [verified]
            if not isinstance(verified, list):
                raise ValueError('verified must be events or one event mapping')
            for event in verified:
                if not isinstance(event, dict) or not isinstance(event.get('by'), str) or not event['by'].strip() or not event.get('at'):
                    raise ValueError('verification event requires by and at')
                if generated_at and instant(event['at']) < generated_at:
                    warnings.append(rel + ': verification predates current content')
                else:
                    instant(event['at'])
            if data.get('stale_after') and instant(data['stale_after']) <= datetime.now(timezone.utc):
                warnings.append(rel + ': stale_after has elapsed')
            if data.get('status', 'stable') not in ('draft', 'stable', 'deprecated'):
                warnings.append(rel + ': unfamiliar lifecycle status')
            title = str(data.get('title', path.stem)).replace('\n', ' ')
            concepts.append((rel, title))
            for target in re.findall(r'\]\(([^\s)]+)\)', text):
                if '://' in target or target.startswith(('#', 'mailto:')):
                    continue
                target = target.split('#', 1)[0]
                dest = root / target.lstrip('/') if target.startswith('/') else path.parent / target
                if root not in dest.resolve().parents and dest.resolve() != root:
                    warnings.append(rel + ': external local link ' + target)
                elif not dest.exists():
                    warnings.append(rel + ': broken link ' + target)
        except (ValueError, TypeError, yaml.YAMLError) as exc:
            errors.append(rel + ': ' + str(exc))
    if args.fix_index and not errors:
        target = root / 'index.md'
        if target.is_symlink():
            errors.append('Refusing symlinked index')
        elif target.exists() and MARKER not in target.read_text():
            errors.append('Refusing to replace curated index; update it manually')
        else:
            content = '# Knowledge index\n\n' + MARKER + '\n\n'
            content += ''.join(f'- [{title}]({rel})\n' for rel, title in concepts)
            target.write_text(content)
    print(json.dumps({'errors': errors, 'warnings': warnings, 'concepts': len(concepts)}, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
