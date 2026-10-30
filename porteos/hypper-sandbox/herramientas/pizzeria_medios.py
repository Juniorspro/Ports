# Sonidos y sustos en video de la noche en la pizzería (juego/noche.js), sumados a un paquete del juego:
# - de "FNAF In Real Time" (sacados con UnityPy a .ogg y .webm): ventilador, zumbido de las luces, puertas, golpes de
#   Foxy, apagón, campanas de las 6, estática, cámaras, pasos, risas de chicos, la llamada de la primera noche (en
#   castellano y en inglés) y los sustos (Freddy, Bonnie, Chica, Foxy y el del apagón)
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
       ('fn_llamada_es', OGG + '/MESSAGE 1 VO_SPANISH.ogg', 0, None, 24, 22050), ('fn_llamada_en', OGG + '/MESSAGE 1 VO.ogg', 0, None, 24, 22050),
       ('fn_risa', HWS + '/laugh1.wav', 0, None, 40, 22050), ('fn_ollas', HWS + '/potsnpans.wav', 0, None, 40, 22050),
       ('fn_respira', HWS + '/breath.wav', 0, None, 40, 22050), ('fn_cajita', HWS + '/song.wav', 0, None, 40, 22050),
       ('fn_grito', HWS + '/jumpscare.wav', 0, 2.2, 56, 44100), ('fn_corre1', HWS + '/run1.wav', 0, None, 48, 22050), ('fn_corre2', HWS + '/run4.wav', 0, None, 48, 22050)]
tot = 0
for n, f, a, b, kb, hz in SON:
    o = PK + '/a/' + n + '.mp3'; cut = ['-ss', str(a)] + (['-to', str(b)] if b else [])
    ff(*cut, '-i', f, '-ac', '1', '-ar', str(hz), '-c:a', 'libmp3lame', '-b:a', '%dk' % kb, o); tot += os.path.getsize(o)
print('sonidos', len(SON), tot // 1000, 'KB')
# sustos: los primeros segundos de cada video (después el original queda en negro), con su sonido
VI = [('fn_susto_freddy', 'FREDDY JUMPSCARE CLASSIC', 1.0), ('fn_susto_bonnie', 'bonnieadventuresound', 2.0), ('fn_susto_chica', 'chicaclassicsound_SHORT', 1.4),
      ('fn_susto_foxy', 'foxyadventuresound', 2.0), ('fn_susto_apagon', 'FREDDY JUMPSCARE POWEROUT', 0.6)]
tv = 0
for n, f, dur in VI:
    o = PK + '/v/' + n + '.mp4'
    ff('-i', VID + '/' + f + '.webm', '-t', str(dur), '-vf', 'scale=640:360:force_original_aspect_ratio=increase,crop=640:360', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
       '-crf', '27', '-preset', 'slow', '-c:a', 'aac', '-ac', '1', '-b:a', '64k', '-movflags', '+faststart', o); tv += os.path.getsize(o)
print('videos', len(VI), tv // 1000, 'KB')
