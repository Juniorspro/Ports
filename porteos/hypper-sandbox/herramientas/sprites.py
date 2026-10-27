import UnityPy,sys,os,json
env=UnityPy.load(sys.argv[1]); out=sys.argv[2]; os.makedirs(out,exist_ok=True)
idx=[]; vistos=set()
for o in env.objects:
    if o.type.name not in('Sprite',): continue
    try:
        s=o.read(); im=s.image; n=s.m_Name
        k=n; j=1
        while k in vistos: j+=1; k='%s_%d'%(n,j)
        vistos.add(k)
        fn=k.replace('/','_').replace(' ','_')+'.png'; im.save(os.path.join(out,fn)); idx.append((k,fn,im.size))
    except Exception as e: print('falla',e)
# texturas sueltas de íconos de armas
for o in env.objects:
    if o.type.name=='Texture2D':
        t=o.read()
        if t.m_Name in('Revolver','Pistol','Smg','RPG','Sniper','Bat','Crossbow','Shotgun','Akm','GravityGun'):
            fn='W_'+t.m_Name+'.png'; t.image.save(os.path.join(out,fn)); idx.append(('W_'+t.m_Name,fn,(t.m_Width,t.m_Height)))
json.dump(idx,open(os.path.join(out,'_indice.json'),'w'))
print(len(idx))
