import base64,re,sys,glob,os,json
shell=open('shell.html').read(); eng=open('engine.js').read()
b=lambda p:base64.b64encode(open('a/'+p,'rb').read()).decode()
shell=re.sub(r'__F_([a-z0-9-]+)__',lambda m:b(m.group(1)+'.woff2'),shell)
shell=re.sub(r'__I_([A-Za-z]+)__',lambda m:b(m.group(1)+'.png'),shell)
os.makedirs('out',exist_ok=True)
ids=sys.argv[1:] or [os.path.basename(f)[:-3] for f in sorted(glob.glob('roteiros/*.js'))]
for i in ids:
    r=open(f'roteiros/{i}.js').read()
    m=re.search(r"title:'([^']*)'",r); d=re.search(r"desc:'([^']*)'",r)
    h=shell.replace('__ENGINE__',eng).replace('__ROTEIRO__',r).replace('__TITLE__',m.group(1) if m else i).replace('__DESC__',d.group(1) if d else '')
    open(f'out/{i}.html','w').write(h); print('built',i)
