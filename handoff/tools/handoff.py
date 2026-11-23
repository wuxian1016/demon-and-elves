#!/usr/bin/env python3
"""Build/verify/restore a pinned private game handoff. Python 3.11+, offline."""
import argparse, hashlib, json, os, re, shutil, stat, sys, tempfile, unicodedata, zipfile
from pathlib import Path, PurePosixPath

META='BUNDLE.json'
PIN='latest/source.sha256'
HEX=re.compile(r'^[0-9a-f]{64}$')
ENTRY_LIMIT=256*1024*1024
TOTAL_LIMIT=1024*1024*1024
FORBID={'.git','.env','.DS_Store','__MACOSX','project.private.config.json','keys.json','node_modules','__pycache__'}
SECRET_SUFFIX={'.key','.pem','.pfx','.p12','.cer','.crt','.mobileprovision','.save','.sqlite','.db','.log','.tap'}
def ck(test,msg):
 if not test: raise ValueError(msg)
def sha(b): return hashlib.sha256(b).hexdigest()
def digest(f):
 with f.open('rb') as h:return hashlib.file_digest(h,'sha256').hexdigest()
def verify_name(n):
 p=PurePosixPath(n)
 ck(n and n.isprintable() and not p.is_absolute() and p.as_posix()==n and all(c not in n for c in '\\:'),'Unsafe entry path: '+repr(n))
 ck(all(x not in {'.','..'} and x.lower() not in {f.lower() for f in FORBID} and not x.startswith('.env.') for x in p.parts),'Forbidden entry path: '+repr(n))
 ck(p.suffix.lower() not in SECRET_SUFFIX and not re.search(r'(?i)\.save(?:\.|$)|private[-_ ]?key|signing[-_ ]?secret',n),'Non-distributable archive path: '+repr(n))
 return n
def collisions(names):
 seen=set()
 for n in names:
  n=unicodedata.normalize('NFC',verify_name(n)).casefold()
  ck(n not in seen,'Duplicate/colliding path: '+n);seen.add(n)
 for n in seen:
  bits=n.split('/')
  ck(all('/'.join(bits[:i]) not in seen for i in range(1,len(bits))),'File/directory collision: '+n)
def manifest(b,pin):
 ck(HEX.fullmatch(pin) is not None and sha(b)==pin,'Client manifest digest differs from trusted pin')
 rows={}
 for line in b.decode('utf8').splitlines():
  h,n=line.split('  ',1)
  ck(HEX.fullmatch(h) and n not in rows,'Invalid or duplicate client manifest path')
  rows[verify_name(n)]=h
 ck(rows,'Empty manifest')
 collisions(rows)
 return rows
def verified_tree(root,m):
 ck(root.is_dir() and not root.is_symlink(),'Source client must be a real directory')
 got={}
 for f in root.rglob('*'):
  ck(not f.is_symlink(),'Unexpected source symlink')
  if f.is_file():got[f.relative_to(root).as_posix()]=f
 ck(got.keys()==m.keys(),'Source exact path set differs from trusted manifest')
 for n,f in got.items():ck(digest(f)==m[n],'Source content mismatch: '+n)
 return got
def game_options(root,files):
 g=json.loads((root/'project.config.json').read_text());opts=g.get('packOptions',{})
 allrows=[e for key in ('include','ignore') for e in opts.get(key,[])]
 if not all(e.get('type')=='file' for e in allrows):return {'raw_filter_estimate_available':False}
 inc={e['value'] for e in opts.get('include',[])};ign={e['value'] for e in opts.get('ignore',[])}-inc
 ext=ign&files.keys();raw=sum(f.stat().st_size for f in files.values())
 return dict(raw_filter_estimate_available=True,raw_source_bytes=raw,source_excluded_from_sdk_estimate_file_count=len(ext),
  source_excluded_from_sdk_estimate_bytes=sum(files[n].stat().st_size for n in ext),raw_after_client_build_exclusions_bytes=sum(f.stat().st_size for n,f in files.items() if n not in ext),
  note='Archive keeps every source byte; this file filter is a size estimate, not official WeChat packaging.')
def info(name):
 x=zipfile.ZipInfo(name,(2020,1,1,0,0,0));x.create_system=3;x.external_attr=(stat.S_IFREG|0o644)<<16
 x.compress_type=zipfile.ZIP_DEFLATED
 return x
def encoded(o):return (json.dumps(o,sort_keys=True,ensure_ascii=False,indent=2)+'\n').encode()
def allowed_ns(n):
 return n in {PIN,'README.md','START-HERE.md','BUILD-INDEX.json'} or n.startswith(('latest/client/','latest/qa/','latest/docs/','latest/tools/','docs/','assets-reference/','evidence/','config/','conversation/','tools-and-skills/'))
def pack(a):
 ck(not a.manifest.is_symlink() and a.client.is_dir(),'Invalid source inputs')
 mbytes=a.manifest.read_bytes();m=manifest(mbytes,a.pin);files=verified_tree(a.client,m)
 ck(not a.out.exists(),'Output directory already exists; use an empty destination name')
 source,output=a.client.resolve(),a.out.resolve()
 ck(source!=output and source not in output.parents,'Output must be outside the pinned client')
 ck(a.stage not in {'FINAL','TEST'} or a.freeze_note,'TEST or FINAL requires a separately provided freeze statement')
 ck(not a.freeze_note or ('/' not in a.freeze_note and '\\' not in a.freeze_note),'Freeze note must not contain local paths')
 root=a.support.resolve();ck(root.is_dir(),'Missing curated support source')
 payload={f'latest/client/{p}':f for p,f in files.items()}
 sm={}
 sections={'qa':'latest/qa','tools':'latest/tools','docs':'docs','assets-reference':'assets-reference','evidence':'evidence','config':'config','conversation':'conversation','tools-and-skills':'tools-and-skills'}
 for section,namespace in sections.items():
  for f in sorted((root/section).rglob('*')):
   ck(not f.is_symlink(),'Support proof must not contain symlinks')
   if not f.is_file():continue
   n=verify_name(namespace+'/'+f.relative_to(root/section).as_posix())
   ck(a.stage=='INTERIM' or 'INTERIM' not in f.name.upper(),'Remove interim-only evidence')
   ck(f.suffix in {'.cjs','.mjs','.py','.md','.sb','.sh','.json','.jsonl','.yaml','.sha256','.png','.jpeg','.bin','.skill'} or f.name in {'LICENSE','EVIDENCE-SHA256SUMS'},'Unexpected support entry: '+n)
   ck(f.stat().st_size<=12*1024*1024,'Unexpected support size')
   blob=f.read_bytes()
   # Support docs/fixtures never carry private coordinates, real ad IDs, or remote access secrets.
   if f.suffix not in {'.png','.jpeg','.bin','.skill'}:
    ck(not re.search(rb'/Users/|/private/tmp/|adunit-[a-z0-9]{10,}|file_[0-9a-f]{20,}|libfile_fde3_',blob),'Support contains unredacted paths or SDK identifiers: '+n)
   sm[n]=blob
 for n in ('START-HERE.md','BUILD-INDEX.json'):
  f=root/n;ck(f.exists() and not f.is_symlink(),'Missing updated owner handoff index: '+n);sm[n]=f.read_bytes()
 sm['latest/tools/handoff.py']=Path(__file__).read_bytes()
 sm[PIN]=mbytes
 sm['README.md']=(f'# 恶魔与精灵 · 离线开发交接包 · {a.stage}\n\n'
                '先读 START-HERE.md；客户端在 latest/client；冒烟在 latest/qa；交接资料在 docs。\n'
                '本包不是微信测试二维码，也不等于已发布版本。先按附带校验工具验证后恢复。\n'
                '如属两卷，校验和恢复时同时提供所有 ZIP；不要把不同构建混用。\n').encode()
 entries={**{n:{'sha256':m[n.removeprefix('latest/client/')],'bytes':f.stat().st_size} for n,f in payload.items()},
          **{n:{'sha256':sha(f),'bytes':len(f)} for n,f in sm.items()}}
 collisions(entries); ck(sum(e['bytes'] for e in entries.values())<=TOTAL_LIMIT,'Unexpected payload size')
 fileset=sorted(entries)
 if a.volumes==2:
  order=sorted(fileset,key=lambda n:(-entries[n]['bytes'],n))
  vol=[[],[]]; sums=[0,0]
  for n in order:
   i=0 if sums[0]<=sums[1] else 1
   vol[i].append(n);sums[i]+=entries[n]['bytes']
  vol=[sorted(q) for q in vol]
 else:vol=[fileset]
 meta={'schema':1,'stage':a.stage,'source_sha256':a.pin,'files':entries,'volumes':vol,'freeze_note':a.freeze_note,
       'shipped_reference':a.shipped_ref,'build_size':game_options(a.client,files),'no_backend_included':True}
 a.out.mkdir(parents=True)
 archive=[]
 try:
  for idx,paths in enumerate(vol,1):
   f=a.out/(f'{a.stage}-demon-elves-handoff'+(f'-{idx}-of-{len(vol)}' if len(vol)>1 else '')+'.zip')
   with zipfile.ZipFile(f,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    z.writestr(info(META),encoded(meta))
    for n in paths:
     with z.open(info(n),'w') as member:
      if n in sm:member.write(sm[n])
      else:
       with payload[n].open('rb') as b:shutil.copyfileobj(b,member)
   archive.append(f)
  verify(archive,a.pin,None,a.stage)
  (a.out/'SHA256SUMS').write_text(''.join(f'{digest(z)}  {z.name}\n' for z in archive))
  for z in archive:print(z.name,z.stat().st_size,digest(z))
  print(json.dumps(meta['build_size'],ensure_ascii=False))
 except BaseException:
  shutil.rmtree(a.out,ignore_errors=True);raise
def verify(paths,pin,dest=None,stage=None):
 zs=[zipfile.ZipFile(p,'r') for p in paths]
 tmp=None
 try:
  metas=[]
  for z in zs:
   names=z.namelist();collisions(names);ck(META in names,'Missing bundle metadata')
   for member in z.infolist():
    ck(not member.is_dir() and not (member.flag_bits&1) and (member.external_attr>>16)&0o170000==0o100000,'Unexpected entry type or encryption')
    ck(member.file_size<=ENTRY_LIMIT,'Large archive entry rejected')
   ck(z.getinfo(META).file_size<=5*1024*1024,'Oversize bundle metadata')
   metas.append(z.read(META))
  ck(all(m==metas[0] for m in metas),'Cannot mix volumes from different bundles')
  m=json.loads(metas[0]);ck(m.get('schema')==1 and m['source_sha256']==pin and m['stage'] in ('INTERIM','TEST','FINAL'),'Wrong bundle identity')
  ck(not stage or m['stage']==stage,'Stage mismatch')
  files=m['files'];collisions(files)
  ck(all(allowed_ns(n) for n in files),'Unexpected bundle namespace')
  declared=[frozenset(x) for x in m['volumes']]
  flat=[n for k in m['volumes'] for n in k]
  ck(len(flat)==len(files) and set(flat)==set(files),'Invalid bundle volume layout')
  actual=[frozenset(z.namelist())-{META} for z in zs]
  ck(len(actual)==len(declared) and set(actual)==set(declared),'Missing or duplicate bundle volume')
  ck(sum(v['bytes'] for v in files.values())<=TOTAL_LIMIT and PIN in files,'Invalid declared total')
  if dest is not None:
   ck(not dest.exists(),'Refusing to overwrite an existing restore path')
   dest.parent.mkdir(parents=True,exist_ok=True)
   tmp=Path(tempfile.mkdtemp(prefix='.handoff-verify-',dir=dest.parent))
  sourcebytes=None
  for z in zs:
   for f in z.infolist():
    n=f.filename
    if n==META:continue
    v=files[n];ck(v['bytes']==f.file_size and HEX.fullmatch(v['sha256']),'Entry size/hash metadata mismatch: '+n)
    out=(tmp/n) if tmp else None
    if out:out.parent.mkdir(parents=True,exist_ok=True)
    with z.open(f,'r') as inp:
     h=hashlib.sha256()
     if n==PIN:sourcebytes=inp.read();h.update(sourcebytes)
     if out:
      with out.open('xb') as target:
       if n==PIN:target.write(sourcebytes)
       else:
        for buf in iter(lambda:inp.read(1024*1024),b''):h.update(buf);target.write(buf)
     elif n!=PIN:
      for buf in iter(lambda:inp.read(1024*1024),b''):h.update(buf)
     ck(h.hexdigest()==v['sha256'],'Archive payload hash mismatch: '+n)
  md=manifest(sourcebytes,pin)
  inside={n.removeprefix('latest/client/'):v['sha256'] for n,v in files.items() if n.startswith('latest/client/')}
  ck(inside==md,'Source tree does not match independent pinned manifest')
  if tmp:
   verified_tree(tmp/'latest/client',md)
   ck(not dest.exists(),'Restore target appeared mid-operation')
   tmp.rename(dest);tmp=None
  print(m['stage'],pin,len(md),'source paths verified')
 finally:
  for z in zs:z.close()
  if tmp:shutil.rmtree(tmp,ignore_errors=True)
def main():
 p=argparse.ArgumentParser(description=__doc__);cmd=p.add_subparsers(dest='cmd',required=True)
 c=cmd.add_parser('pack')
 for name in ('client','manifest','support','out'):c.add_argument('--'+name,type=Path,required=True)
 c.add_argument('--pin',required=True);c.add_argument('--stage',choices=['INTERIM','TEST','FINAL'],required=True)
 c.add_argument('--volumes',type=int,choices=[1,2],default=1);c.add_argument('--freeze-note',default='')
 c.add_argument('--shipped-ref',default=None,help='Optional earlier official manifest SHA only, not a source tree')
 for action in ('verify','restore'):
  r=cmd.add_parser(action);r.add_argument('--pin',required=True);r.add_argument('--stage',choices=['INTERIM','TEST','FINAL'])
  if action=='restore':r.add_argument('--out',required=True,type=Path)
  r.add_argument('archives',nargs='+',type=Path)
 a=p.parse_args()
 if a.cmd=='pack':
  ck(a.shipped_ref is None or HEX.fullmatch(a.shipped_ref),'A shipped ref must only be a SHA-256')
  pack(a)
 else:verify(a.archives,a.pin,getattr(a,'out',None),a.stage)
if __name__=='__main__':
 try:main()
 except (ValueError,OSError,KeyError,TypeError,zipfile.BadZipFile) as e: sys.exit(str(e))
