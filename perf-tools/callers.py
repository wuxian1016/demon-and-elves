import json, sys, re, collections
prof = json.load(open(sys.argv[1])); target = re.compile(sys.argv[2])
nodes = {n['id']: n for n in prof['nodes']}; parent = {}
for n in prof['nodes']:
    for c in n.get('children', []): parent[c] = n['id']
def name(n):
    cf = n['callFrame']; u = re.sub(r'^.*/client/', '', cf['url']); u = re.sub(r'^.*/harness/', 'H:', u)
    return f"{cf['functionName'] or '(anon)'} {u}:{cf['lineNumber']+1}"
dt = prof['timeDeltas']; total = sum(dt)
by = collections.Counter(); selfc = collections.Counter()
for i, sid in enumerate(prof['samples']):
    d = dt[i] if i < len(dt) else 0
    chain = []; nid = sid
    while nid is not None: chain.append(name(nodes[nid])); nid = parent.get(nid)
    selfc[chain[0]] += d
    for k, nm in enumerate(chain):
        if target.search(nm):
            caller = ' < '.join(chain[k+1:k+3]); by[caller] += d; break
print('callers of', sys.argv[2])
for k, v in by.most_common(12): print(f'{v/total*100:6.1f}%  {k}')
if len(sys.argv) > 3:
    print('self top')
    for k, v in selfc.most_common(int(sys.argv[3])): print(f'{v/total*100:6.1f}%  {k}')
