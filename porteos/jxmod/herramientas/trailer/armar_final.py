# armado final del tráiler en 4:3 FHD (1440×1080): logo + 9 planos + negro antes del golpe, gradación, grano (sólo en
# el brillo), viñeta, destellos (grieta, primer impacto, barril, nuclear) y el audio mezclado; 34,0 s exactos.
# Uso: python3 armar_final.py   → JXMod_trailer_3_0.mp4 (dos pasadas a 9,6 Mb/s, unos 42 MB; audio AAC 320k)
import subprocess, os, sys, json
AQ = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(AQ, 'vid43')
W, H = 1440, 1080
# (plano, cuadros, filtro extra con el tiempo local del plano)
planos = [
    ('p1_manos', 171, "fade=t=in:st=0:d=0.45,eq=brightness='0.30*exp(-(t-4.358)*16)*gte(t\\,4.358)':eval=frame"),
    ('p2_grieta', 76, ''),
    ('p3_salen', 17, ''),
    ('NEGRO', 11, ''),
    ('p4_lluvia', 75, "eq=brightness='0.22*exp(-t*9)':eval=frame"),
    ('p5_barril', 58, "eq=brightness='0.20*exp(-(t-2.005)*10)*gte(t\\,2.005)':eval=frame"),
    ('p6_nuclear', 104, "eq=brightness='0.55*exp(-t*4.5)':contrast='1-0.25*exp(-t*4.5)':eval=frame"),
    ('p7_corre', 78, ''),
    ('p8_orilla', 102, ''),
    ('p9_physgun', 75, ''),
]
ent, fc, n = ['-i', os.path.join(V, 'p0_logo.mp4')], [], 1
fc.append(f"[0:v]setpts=PTS-STARTPTS,fps=24,format=yuv444p,noise=c0s=4:c0f=t,trim=end_frame=49,setsar=1[s0]")
partes = ['[s0]']
for i, (nom, nf, extra) in enumerate(planos, 1):
    if nom == 'NEGRO':
        fc.append(f"color=c=black:s={W}x{H}:r=24:d={nf / 24:.6f},format=yuv444p,setsar=1[s{i}]"); partes.append(f'[s{i}]'); continue
    ent += ['-i', os.path.join(V, nom + '.mp4')]
    g = f"[{n}:v]setpts=PTS-STARTPTS,fps=24,trim=end_frame={nf},format=yuv444p"
    g += ",eq=contrast=1.07:saturation=1.05:gamma=0.97"            # (un poco más de contraste, negros más profundos)
    g += ",colorbalance=rs=-0.02:bs=0.03:rh=0.02:bh=-0.02"          # (sombras frías, luces apenas cálidas)
    if extra: g += ',' + extra
    g += ",vignette=angle=PI/5:mode=forward,noise=c0s=5:c0f=t,setsar=1"
    fc.append(g + f"[s{i}]"); partes.append(f'[s{i}]'); n += 1
fc.append(''.join(partes) + f"concat=n={len(partes)}:v=1:a=0,format=yuv420p[v]")
ent += ['-i', os.path.join(AQ, 'audio', 'mezcla.wav')]
out = os.path.join(AQ, 'JXMod_trailer_3_0.mp4')
vid = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '9600k', '-maxrate', '16000k', '-bufsize', '24000k', '-tune', 'film', '-profile:v', 'high']
base = ['ffmpeg', '-y', '-loglevel', 'error'] + ent + ['-filter_complex', ';'.join(fc), '-map', '[v]']
comun = ['-t', '34.0', '-r', '24'] + vid + ['-passlogfile', os.path.join(AQ, 'pase')]
# dos pasadas para clavar el tamaño
subprocess.run(base + comun + ['-pass', '1', '-an', '-f', 'mp4', '/dev/null'], check=True)
subprocess.run(base + ['-map', f'{n}:a'] + comun + ['-pass', '2', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out], check=True)
for f in os.listdir(AQ):
    if f.startswith('pase'): os.remove(os.path.join(AQ, f))
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_name,width,height,nb_read_frames,r_frame_rate', '-of', 'json', out], capture_output=True, text=True).stdout)
print(out); print(json.dumps(pr, indent=1))
