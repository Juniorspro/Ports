# armado final del tráiler v2 en 4:3 FHD (1440×1080), 40,0 s: logo + 9 planos + negro antes del golpe + el final
# (meteoro, la agarra, corte a negro) + la placa «BETA LANZADA». Gradación de cine en cada plano del juego: resplandor
# cálido en las luces fuertes (halación), curva de contraste con las luces suaves, sombras frías y luces cálidas,
# vibrancia, un píxel de aberración cromática, destellos donde van, viñeta y grano (sólo en el brillo).
# Uso: python3 armar_final.py   → JXMod_trailer_3_0.mp4 (dos pasadas a 9,0 Mb/s, unos 45 MB; audio AAC 320k)
import subprocess, os, json
AQ = os.path.dirname(os.path.abspath(__file__)); V2, V43 = os.path.join(AQ, 'vid2'), os.path.join(AQ, 'vid43')
W, H, FPS = 1440, 1080, 24
# (archivo, cuadros, filtro extra con el tiempo local del plano, ¿gradación de juego?)
planos = [
    (os.path.join(V43, 'p0_logo.mp4'), 49, '', False),
    (os.path.join(V2, 'p1_manos.mp4'), 171, "eq=brightness='0.30*exp(-(t-4.358)*16)*gte(t\\,4.358)':eval=frame", True),
    (os.path.join(V2, 'p2_grieta.mp4'), 76, '', True),
    (os.path.join(V43, 'p3_salen.mp4'), 17, '', True),
    ('NEGRO', 11, '', False),
    (os.path.join(V2, 'p4_lluvia.mp4'), 75, "eq=brightness='0.22*exp(-t*9)':eval=frame", True),
    (os.path.join(V2, 'p5_barril.mp4'), 58, "eq=brightness='0.20*exp(-(t-2.005)*10)*gte(t\\,2.005)':eval=frame", True),
    (os.path.join(V2, 'p6_nuclear.mp4'), 104, "eq=brightness='0.50*exp(-t*6)':contrast='1-0.2*exp(-t*6)':eval=frame", True),
    (os.path.join(V2, 'p7_corre.mp4'), 78, '', True),
    (os.path.join(V2, 'p8_orilla.mp4'), 102, '', True),
    # (el golpe de la Physics Gun en 31,45 → 0,575 s del plano; y el arma que se enciende justo antes del corte)
    (os.path.join(V2, 'p9_final.mp4'), 145, "eq=brightness='0.30*exp(-(t-0.575)*9)*gte(t\\,0.575)+0.16*pow(min(max((t-5.82)/0.22\\,0)\\,1)\\,2)':eval=frame", True),
    ('NEGRO', 14, '', False),
    (os.path.join(V2, 'p10_placa.mp4'), 60, '', False),
]
assert sum(p[1] for p in planos) == 960, sum(p[1] for p in planos)
GRADO = ("format=gbrp,split=2[a{i}][b{i}];"
         "[b{i}]curves=all='0/0 0.62/0 1/1',gblur=sigma=26,colorchannelmixer=rr=1.0:gg=0.84:bb=0.70[h{i}];"
         "[a{i}][h{i}]blend=all_mode=screen:all_opacity=0.30,"
         "curves=all='0/0 0.25/0.215 0.5/0.5 0.78/0.805 1/0.97',"
         "colorbalance=rs=-0.04:gs=-0.01:bs=0.05:rm=0.01:bm=-0.01:rh=0.03:gh=0.01:bh=-0.03,"
         "vibrance=intensity=0.12,rgbashift=rh=-1:bh=1,format=yuv444p")
ent, fc, n, partes = [], [], 0, []
for i, (arch, nf, extra, juego) in enumerate(planos):
    if arch == 'NEGRO':
        fc.append(f"color=c=black:s={W}x{H}:r={FPS}:d={nf / FPS:.6f},format=yuv444p,setsar=1[s{i}]"); partes.append(f'[s{i}]'); continue
    ent += ['-i', arch]
    g = f"[{n}:v]setpts=PTS-STARTPTS,fps={FPS},trim=end_frame={nf},"
    if juego:
        g += GRADO.format(i=i)
        if extra: g += ',' + extra
        g += ",vignette=angle=PI/5:mode=forward,noise=c0s=5:c0f=t,setsar=1"
    else:
        g += "format=yuv444p,noise=c0s=3:c0f=t,setsar=1"
    fc.append(g + f"[s{i}]"); partes.append(f'[s{i}]'); n += 1
fc.append(''.join(partes) + f"concat=n={len(partes)}:v=1:a=0,format=yuv420p[v]")
ent += ['-i', os.path.join(AQ, 'audio', 'mezcla.wav')]
out = os.path.join(AQ, 'JXMod_trailer_3_0.mp4')
vid = ['-c:v', 'libx264', '-preset', 'slow', '-b:v', '9000k', '-maxrate', '15000k', '-bufsize', '22000k', '-tune', 'film', '-profile:v', 'high']
base = ['ffmpeg', '-y', '-loglevel', 'error'] + ent + ['-filter_complex', ';'.join(fc), '-map', '[v]']
comun = ['-t', '40.0', '-r', str(FPS)] + vid + ['-passlogfile', os.path.join(AQ, 'pase')]
# dos pasadas para clavar el tamaño
subprocess.run(base + comun + ['-pass', '1', '-an', '-f', 'mp4', '/dev/null'], check=True)
subprocess.run(base + ['-map', f'{n}:a'] + comun + ['-pass', '2', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', out], check=True)
for f in os.listdir(AQ):
    if f.startswith('pase'): os.remove(os.path.join(AQ, f))
pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'format=duration,size:stream=codec_name,width,height,nb_read_frames,r_frame_rate', '-of', 'json', out], capture_output=True, text=True).stdout)
print(out); print(json.dumps(pr, indent=1))
