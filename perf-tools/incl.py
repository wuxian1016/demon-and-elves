import json, sys, re, collections
prof = json.load(open(sys.argv[1])); pat = re.compile(sys.argv[2]) if len(sys.argv) > 2 else None
nodes = {n['id']: n for n in prof['nodes']}; parent = {}
for n in prof['nodes']:
    for c in n.get('children', []): parent[c] = n['id']
def name(n):
    cf = n['callFrame']; u = re.sub(r'^.*/client/', '', cf['url']); u = re.sub(r'^.*/harness/', 'H:', u)
    return f"{cf['functionName'] or '(anon)'} {u}:{cf['lineNumber']+1}"
dt = prof['timeDeltas']; total = sum(dt)
incl = collections.Counter(); selfc = collections.Counter()
for i, sid in enumerate(prof['samples']):
    d = dt[i] if i < len(dt) else 0
    seen = set(); nid = sid; first = True
    while nid is not None:
        k = name(nodes[nid])
        if first: selfc[k] += d; first = False
        if k not in seen: incl[k] += d; seen.add(k)
        nid = parent.get(nid)
print('total ms', round(total/1000, 1))
for k, v in incl.most_common(400):
    if pat and not pat.search(k): continue
    if not pat and not re.search(r'js/|network/|art163/|runtime', k): continue
    print(f'{v/total*100:6.1f}%  {k}')
