import subprocess,sys
for l in open(sys.argv[1]):
    a,b=l.split()
    r=subprocess.run([sys.executable,'-I',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'decodmb.py'),sys.argv[2],a,b],capture_output=True,text=True)
    print(r.stdout.replace('\n','|')[:700])
