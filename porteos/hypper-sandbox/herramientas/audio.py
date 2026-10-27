import UnityPy,sys,os,fsb5,io
env=UnityPy.load(sys.argv[1]); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
for o in env.objects:
    if o.type.name!='AudioClip': continue
    a=o.read()
    try:
        data=a.m_AudioData
        if not data:
            r=a.m_Resource; src=r.m_Source
            p=os.path.join(sys.argv[1],os.path.basename(src))
            with open(p,'rb') as f: f.seek(r.m_Offset); data=f.read(r.m_Size)
        f=fsb5.FSB5(bytes(data))
        for s in f.samples:
            b=f.rebuild_sample(s)
            nm=a.m_Name.replace('/','_').replace(' ','_')
            open(os.path.join(out,nm+'.'+f.get_sample_extension()),'wb').write(b)
            print('ok',nm,len(b),s.frequency,s.channels)
    except Exception as e: print('falla',a.m_Name,e)
