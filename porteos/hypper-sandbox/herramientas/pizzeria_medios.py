# Sonidos y sustos en video de la noche en la pizzería (juego/noche.js), sumados a un paquete del juego:
# - de "FNAF In Real Time" (sacados con UnityPy a .ogg y .webm): ventilador, zumbido de las luces, puertas, golpes de
#   Foxy, apagón, campanas de las 6, estática, cámaras, pasos, risas de chicos, respiración en la ventana, el error de
#   los botones, la pantalla de Game Over, las llamadas de las noches 1 a 4 (en castellano y en inglés, con sonido de
#   teléfono) y los sustos (Freddy, Bonnie, Chica, Foxy y el del apagón)
# - del pack Help Wanted de GMod (cl3nr): risa de Freddy, ollas de Chica, respiración, cajita de música, grito
# Todo en mono y con poco peso: mp3 (lo decodifica cualquier navegador) y mp4 H.264 a 640x360.
# Uso: python3 -I pizzeria_medios.py PAQUETE OGG_IRT VIDEO_IRT SONIDOS_HW
import sys, os, subprocess
PK, OGG, VID, HWS = sys.argv[1:5]
os.makedirs(PK + '/a', exist_ok=True); os.makedirs(PK + '/v', exist_ok=True)
def ff(*a): subprocess.run(['ffmpeg', '-nostdin', '-loglevel', 'error', '-y', *a], check=True)
# nombre, archivo, desde, hasta (s), kbps, Hz
SON = [('fn_ventilador', OGG + '/FANLOOP.ogg', 0, None, 40, 22050), ('fn_zumbido', OGG + '/BallastHumMedium2.ogg', 0, 4.3, 40, 22050),
       ('fn_puerta', OGG + '/office_doors.ogg', 0, None, 56, 44100), ('fn_golpe', OGG + '/foxydoorbang.ogg', 0, None, 56, 44100),
       ('fn_foxycorre', OGG + '/foxy run realtime.ogg', 0, None, 56, 44100), ('fn_apagon', OGG + '/powerdown.ogg', 0, 7, 48, 22050),
       ('fn_6am', OGG + '/chimes 2.ogg', 0, 10, 48, 22050), ('fn_estatica', OGG + '/titlestatic.ogg', 2, 5, 32, 22050),
       ('fn_blip', OGG + '/Blip3.ogg', 0, None, 48, 22050), ('fn_tablet', OGG + '/Camera Leave.ogg', 0, None, 48, 22050),
       ('fn_ambiente', OGG + '/FNAFIRT_amb_longform_greensynth_01.ogg', 0, None, 32, 22050), ('fn_ninos', OGG + '/Laugh Giggle Girl 1d.ogg', 0, None, 40, 22050),
       ('fn_paso1', OGG + '/step1.ogg', 0, None, 48, 22050), ('fn_paso2', OGG + '/step2.ogg', 0, None, 48, 22050), ('fn_paso3', OGG + '/step4.ogg', 0, None, 48, 22050),
       ('fn_aliento', OGG + '/Sound_Ideas,_Vocals_-_Breaths_-_Strained_Breaths_-_CU_-_Male,_Very_Strained,_Whispery,_Voice_Struggling_To_Get_Out,_Spooky,_Vampire_Or_Ghoul_Like_29.ogg', 0, None, 40, 22050),
       ('fn_error', OGG + '/Error.ogg', 0, None, 48, 22050), ('fn_gameover', OGG + '/deathscreen_FINAL.ogg', 0, 6, 40, 22050),
       ('fn_risa', HWS + '/laugh1.wav', 0, None, 40, 22050), ('fn_ollas', HWS + '/potsnpans.wav', 0, None, 40, 22050),
       ('fn_respira', HWS + '/breath.wav', 0, None, 40, 22050), ('fn_cajita', HWS + '/song.wav', 0, None, 40, 22050),
       ('fn_grito', HWS + '/jumpscare.wav', 0, 2.2, 56, 44100), ('fn_corre1', HWS + '/run1.wav', 0, None, 48, 22050), ('fn_corre2', HWS + '/run4.wav', 0, None, 48, 22050)]
tot = 0
for n, f, a, b, kb, hz in SON:
    o = PK + '/a/' + n + '.mp3'; cut = ['-ss', str(a)] + (['-to', str(b)] if b else [])
    af = ['-af', 'afade=t=out:st=%g:d=1.5' % (b - a - 1.5)] if n == 'fn_gameover' else []
    ff(*cut, '-i', f, *af, '-ac', '1', '-ar', str(hz), '-c:a', 'libmp3lame', '-b:a', '%dk' % kb, o); tot += os.path.getsize(o)
print('sonidos', len(SON), tot // 1000, 'KB')
# llamadas: banda de teléfono (300 a 3500 Hz) a 16 kHz y 16 kbps (con 8 kbps la voz se rompe: medido, 30 dB de distorsión
# contra 10); la de la noche 3 son dos partes seguidas
LLAM = {1: ['MESSAGE 1 VO'], 2: ['NIGHT 2 VO MONO'], 3: ['NIGHT 3 PRE 1 VO MONO', 'NIGHT 3 PRE 2 VO MONO'], 4: ['NIGHT 4 VO MONO']}
tl = 0
for n, partes in LLAM.items():
    for idi, suf in (('en', ''), ('es', '_SPANISH')):
        ent = []
        for p in partes: ent += ['-i', OGG + '/' + p + suf + '.ogg']
        cad = ''.join('[%d:a]aformat=channel_layouts=mono,aresample=16000%s[p%d];' % (i, ',apad=pad_dur=0.6' if i < len(partes) - 1 else '', i) for i in range(len(partes)))
        cad += ''.join('[p%d]' % i for i in range(len(partes))) + 'concat=n=%d:v=0:a=1,highpass=f=280,lowpass=f=3500,loudnorm=I=-18:TP=-2[o]' % len(partes)
        o = PK + '/a/fn_llamada%d_%s.mp3' % (n, idi)
        ff(*ent, '-filter_complex', cad, '-map', '[o]', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '16k', o); tl += os.path.getsize(o)
print('llamadas', len(LLAM) * 2, tl // 1000, 'KB')
# sustos: los primeros segundos de cada video (después el original queda en negro), con su sonido
VI = [('fn_susto_freddy', 'FREDDY JUMPSCARE CLASSIC', 1.0), ('fn_susto_bonnie', 'bonnieadventuresound', 2.0), ('fn_susto_chica', 'chicaclassicsound_SHORT', 1.4),
      ('fn_susto_foxy', 'foxyadventuresound', 2.0), ('fn_susto_apagon', 'FREDDY JUMPSCARE POWEROUT', 0.6)]
tv = 0
for n, f, dur in VI:
    o = PK + '/v/' + n + '.mp4'
    ff('-i', VID + '/' + f + '.webm', '-t', str(dur), '-vf', 'scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
       '-crf', '27', '-preset', 'slow', '-c:a', 'aac', '-ac', '1', '-b:a', '64k', '-movflags', '+faststart', o); tv += os.path.getsize(o)
print('videos', len(VI), tv // 1000, 'KB')
