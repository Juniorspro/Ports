# armado final del tráiler: logo + 9 planos (1920×804 → barras de cine en 1920×1080) + negro antes del golpe,
# gradación, grano, viñeta, destellos (grieta, primer impacto, barril, nuclear), audio mezclado; 34,0 s exactos.
# Uso: python3 armar_final.py alta|discord
#   alta    → 1920×1080, dos pasadas a 9,6 Mb/s (≈ 42 MB), audio AAC 320k
#   discord → 1280×720, dos pasadas a 1,95 Mb/s (< 10 MB), audio AAC 128k
import subprocess, os, sys, json
AQ = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(AQ, 'vid')
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
calidad = sys.argv[1] if len(sys.argv) > 1 else 'alta'
alta = calidad == 'alta'
grano = 4 if alta else 2          # (grano sólo en la luminancia; en la versión chica, menos: a 2 Mb/s el grano se come los bits)
ent, fc, n = ['-i', os.path.join(V, 'p0_logo.mp4')], [], 1
fc.append(f"[0:v]setpts=PTS-STARTPTS,fps=24,format=yuv444p,noise=c0s={grano}:c0f=t,trim=end_frame=49,setsar=1[s0]")
partes = ['[s0]']
for i, (nom, nf, extra) in enumerate(planos, 1):
    if nom == 'NEGRO':
        fc.append(f"color=c=black:s=1920x1080:r=24:d={nf / 24:.6f},format=yuv444p,setsar=1[s{i}]"); partes.append(f'[s{i}]'); continue
    ent += ['-i', os.path.join(V, nom + '.mp4')]
    g = f"[{n}:v]setpts=PTS-STARTPTS,fps=24,trim=end_frame={nf},format=yuv444p"
    g += ",eq=contrast=1.07:saturation=1.05:gamma=0.97"            # (un poco más de contraste, negros más profundos)
    g += ",colorbalance=rs=-0.02:bs=0.03:rh=0.02:bh=-0.02"          # (sombras frías, luces apenas cálidas)
    if extra: g += ',' + extra
    g += f",vignette=angle=PI/5:mode=forward,noise=c0s={grano + 1}:c0f=t,pad=1920:1080:0:138:black,setsar=1"
    fc.append(g + f"[s{i}]"); partes.append(f'[s{i}]'); n += 1
fin = f"concat=n={len(partes)}:v=1:a=0"
fin += ",format=yuv420p[v]" if alta else ",scale=1280:720:flags=lanczos,format=yuv420p[v]"
fc.append(''.join(partes) + fin)
ent += ['-i', os.path.join(AQ, 'audio', 'mezcla.wav')]
if alta:
    out = os.path.join(AQ, 'JXMod_trailer_3_0.mp4')
    vid = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '9600k', '-maxrate', '16000k', '-bufsize', '24000k', '-tune', 'film', '-profile:v', 'high']
    aud = ['-c:a', 'aac', '-b:a', '320k']
else:
    out = os.path.join(AQ, 'JXMod_trailer_3_0_discord.mp4')
    vid = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '1950k', '-maxrate', '2600k', '-bufsize', '4000k', '-tune', 'film', '-profile:v', 'high']
    aud = ['-c:a', 'aac', '-b:a', '128k']
base = ['ffmpeg', '-y', '-loglevel', 'error'] + ent + ['-filter_complex', ';'.join(fc), '-map', '[v]']
comun = ['-t', '34.0', '-r', '24'] + vid + ['-passlogfile', os.path.join(AQ, 'pase_' + calidad)]
# dos pasadas para clavar el tamaño
subprocess.run(base + comun + ['-pass', '1', '-an', '-f', 'mp4', '/dev/null'], check=True)
subprocess.run(base + ['-map', f'{n}:a'] + comun + ['-pass', '2'] + aud + ['-movflags', '+faststart', out], check=True)
for f in os.listdir(AQ):
    if f.startswith('pase_' + calidad): os.remove(os.path.join(AQ, f))
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_name,width,height,nb_read_frames,r_frame_rate', '-of', 'json', out], capture_output=True, text=True).stdout)
print(out); print(json.dumps(pr, indent=1))
