#!/usr/bin/env python3
"""Exact, single-occurrence text replacement for the minified client files.
usage: edit.py <file> <old-file> <new-file>   (old/new read from files to avoid shell quoting issues)"""
import sys
path, old_p, new_p = sys.argv[1:4]
s = open(path, encoding='utf-8').read()
old = open(old_p, encoding='utf-8').read()
new = open(new_p, encoding='utf-8').read()
n = s.count(old)
if n != 1:
    sys.exit(f"ABORT: expected exactly 1 occurrence, found {n} in {path}")
open(path, 'w', encoding='utf-8').write(s.replace(old, new, 1))
print(f"ok: {path.split('/client/')[-1]} ({len(old)} -> {len(new)} chars)")
