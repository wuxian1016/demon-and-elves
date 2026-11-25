#!/usr/bin/env python3
# usage: cpurun.py <url> <out.json> [timeout]  -> runs wkrun, samples CPU time of the WebKit processes it spawns
import subprocess, sys, time, re, json, os
url, out = sys.argv[1], sys.argv[2]; timeout = sys.argv[3] if len(sys.argv) > 3 else '900'
def snap():
    o = subprocess.run(['ps', '-axo', 'pid=,time=,comm='], capture_output=True, text=True).stdout
    res = {}
    for line in o.splitlines():
        m = re.match(r'\s*(\d+)\s+(\S+)\s+(.*)$', line)
        if not m: continue
        pid, t, comm = int(m[1]), m[2], m[3]
        if 'com.apple.WebKit' not in comm and not comm.endswith('wkrun'): continue
        parts = t.split(':'); sec = 0.0
        for p in parts: sec = sec * 60 + float(p)
        res[pid] = (sec, comm)
    return res
before = set(snap())
here = os.path.dirname(os.path.abspath(__file__))
p = subprocess.Popen([os.path.join(here, 'wkrun'), url, timeout, out], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
last = {}
import threading
lines = []
marks = {}
def reader():
    for l in p.stdout:
        l = l.rstrip(); lines.append(l)
        if l in ('MEASURE_START', 'MEASURE_END'):
            marks[l] = {pid: v for pid, v in snap().items() if pid not in before}
th = threading.Thread(target=reader, daemon=True); th.start()
while p.poll() is None:
    for pid, v in snap().items():
        if pid not in before: last[pid] = v
    time.sleep(0.25)
th.join(timeout=2)
tot = {}
if 'MEASURE_START' in marks and 'MEASURE_END' in marks:
    a, b = marks['MEASURE_START'], marks['MEASURE_END']
    last = {pid: (b[pid][0] - a.get(pid, (0,))[0], b[pid][1]) for pid in b}
for pid, (sec, comm) in last.items():
    k = 'GPU' if 'GPU' in comm else 'WebContent' if 'WebContent' in comm else 'Networking' if 'Networking' in comm else 'UI' if comm.endswith('wkrun') else comm
    tot[k] = round(tot.get(k, 0) + sec, 2)
print('CPU seconds:', tot, '| lines:', [l for l in lines if l.startswith(('FAILED', 'ERROR', 'CERR'))][:5])
try:
    r = json.loads(open(out).read().strip().splitlines()[-1]); r['cpu'] = tot
    open(out, 'w').write(json.dumps(r) + '\n'); print('summary', r['summary']['tot'], 'frames', r['summary']['frames'])
except Exception as e: print('no result', e, lines[-5:])
