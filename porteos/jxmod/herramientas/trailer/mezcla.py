# mezcla del tráiler v2 (40,0 s, 48 kHz estéreo): la canción hasta su final natural (golpe en 37,5 y silencio después
# de 39,5) + efectos del juego y sintéticos, sin voces. El silencio de la nuclear, la onda expansiva, el meteoro de la
# Physics Gun, el zumbido del arma que crece hasta el corte a negro (36,92), el golpe de la placa final y limitador
import subprocess, numpy as np, wave, sys, os
SR = 48000; DUR = 40.0; N = int(SR * DUR)
A = os.environ.get('JX_SONIDOS', '') + '/'   # (la carpeta a/ del paquete armado del juego: los .mp3)
AQUI = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

def cargar(ruta):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-i', ruta, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True)
    return np.frombuffer(p.stdout, np.float32).reshape(-1, 2).copy()
_c = {}
def snd(n):
    if n not in _c: _c[n] = cargar(A + n + '.mp3')
    return _c[n]
def remuestrear(x, k):   # k > 1: más agudo y corto
    n = int(len(x) / k); t = np.arange(n) * k
    i = np.minimum(t.astype(int), len(x) - 2); f = (t - i)[:, None]
    return x[i] * (1 - f) + x[i + 1] * f
def filtro(x, lo=None, hi=None):
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(len(x), 1 / SR)[:, None]
    H = np.ones_like(f)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * H, n=len(x), axis=0).astype(np.float32)
def reverb(x, dur=2.0, mezcla=0.35, pre=0.02, brillo=6000):
    n = int(dur * SR); t = np.arange(n) / SR
    ir = rng.standard_normal((n, 2)).astype(np.float32) * np.exp(-t / (dur / 6.9))[:, None]
    ir = filtro(ir, hi=brillo); ir[:int(pre * SR)] = 0; ir /= np.sqrt((ir ** 2).sum(0, keepdims=True)) + 1e-9
    L = len(x) + n; F = 1 << int(np.ceil(np.log2(L)))
    y = np.fft.irfft(np.fft.rfft(x, F, axis=0) * np.fft.rfft(ir, F, axis=0), F, axis=0)[:L]
    out = np.zeros((L, 2), np.float32); out[:len(x)] += x * (1 - mezcla); out += y * mezcla * 1.6
    return out
def env(x, ent=0.005, sal=0.05):
    n = len(x); e = np.ones(n, np.float32)
    a = min(n, int(ent * SR)); s = min(n, int(sal * SR))
    if a: e[:a] = np.linspace(0, 1, a)
    if s: e[-s:] *= np.linspace(1, 0, s)
    return x * e[:, None]
def paneo(x, p):   # -1 izq, 1 der
    l = np.cos((p + 1) * np.pi / 4); r = np.sin((p + 1) * np.pi / 4)
    m = x.mean(1); return np.stack([m * l * 1.414, m * r * 1.414], 1).astype(np.float32)
def db(g): return 10 ** (g / 20)

mus = np.zeros((N, 2), np.float32); fx = np.zeros((N, 2), np.float32)
def poner(dst, x, t, g=0.0):
    i = int(t * SR)
    if i >= N: return
    if i < 0: x = x[-i:]; i = 0
    n = min(len(x), N - i); dst[i:i + n] += x[:n] * db(g)
def lazo(x, dur):   # repetir con fundido cruzado hasta dur
    n = int(dur * SR); out = np.zeros((n, 2), np.float32); cf = max(1, min(int(0.4 * SR), len(x) // 3)); pos = 0
    fc = cf / SR
    while pos < n:
        seg = env(x.copy(), fc, fc); m = min(len(seg), n - pos); out[pos:pos + m] += seg[:m]; pos += max(1, len(x) - cf)
    return out

# ---------------- la canción (0–40 s del video de 41 s: termina sola, con el golpe de 37,5) ----------------
can = cargar(os.path.join(AQUI, 'audio', 'cancion41.wav'))[:N]
mus[:len(can)] = can

# ---------------- efectos ----------------
def boom(dur=2.5, f=38, g=0.0):   # golpe grave sintético (sub + clic)
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * (f + 25 * np.exp(-t * 18)) * t) * np.exp(-t * 2.2)
    c = rng.standard_normal(n) * np.exp(-t * 60) * 0.5
    x = (s + c).astype(np.float32); return np.stack([x, x], 1) * db(g)
def silbido(dur, f0, f1, g=0.0, ruido=True):   # zumbido que sube (algo que cae)
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f0 * (f1 / f0) ** (t / dur); ph = 2 * np.pi * np.cumsum(fr) / SR
    x = np.sin(ph) * 0.3
    if ruido:
        nz = filtro(np.stack([rng.standard_normal(n)] * 2, 1).astype(np.float32), lo=300, hi=4000)[:, 0]; x = x + nz * 0.5 * (t / dur)
    x = (x * (t / dur) ** 1.5).astype(np.float32); return np.stack([x, x], 1) * db(g)
def chispa(dur=0.5, g=0.0):   # crepitar eléctrico
    n = int(dur * SR); x = rng.standard_normal(n).astype(np.float32) * (rng.random(n) < 0.04)
    x = filtro(np.stack([x, x], 1), lo=1800, hi=12000); t = np.arange(n) / SR
    return x * np.exp(-t * 4)[:, None] * db(g)

# viento del desierto (2,06–13,05), sube con la grieta
vi = lazo(snd('AM_viento1'), 11.2); t = np.arange(len(vi)) / SR; vi *= (0.35 + 0.65 * np.clip((t - 3) / 7, 0, 1))[:, None]
poner(fx, env(vi, 1.0, 0.25), 2.0, -14)
# el logo: golpe grave y crepitar en 0,09; tirón en 1,66
poner(fx, boom(2.2, 34), 0.09, -3); poner(fx, chispa(0.6), 0.09, -10); poner(fx, remuestrear(snd('GG_Launch1'), 0.7), 1.64, -16)
# respiración y el brillo de las manos
poner(fx, filtro(snd('fn_aliento'), hi=6000), 2.5, -20); poner(fx, filtro(snd('fn_aliento'), hi=6000), 5.5, -19)
for tt, g in [(3.24, -20), (4.82, -22), (5.21, -19)]: poner(fx, remuestrear(snd('GG_Hold'), 1.6)[:int(0.8 * SR)], tt, g); poner(fx, chispa(0.4), tt, g - 2)
# el trueno sordo (6,00) y la grieta que se raja (6,40): crujido seco, golpe enorme, chisporroteo
poner(fx, filtro(remuestrear(snd('NK_rumble'), 0.8), hi=900), 5.9, -10)
cr = filtro(np.stack([rng.standard_normal(int(0.25 * SR))] * 2, 1).astype(np.float32), lo=1500) * np.exp(-np.arange(int(0.25 * SR)) / SR * 22)[:, None]
poner(fx, cr, 6.40, -6); poner(fx, boom(3.5, 30), 6.40, 0); poner(fx, filtro(remuestrear(snd('NK_abomb'), 0.75), hi=2500), 6.40, -6); poner(fx, chispa(1.2), 6.40, -6)
for tt in [7.19, 7.98, 9.16]: poner(fx, boom(2.0, 36), tt, -5); poner(fx, remuestrear(snd('GG_Launch3'), 0.6), tt, -12); poner(fx, chispa(0.8), tt, -9)
# el zumbido de la grieta (6,4–13,05), grave y con vaivén
hum = lazo(remuestrear(snd('GG_Hold'), 0.5), 6.7); t = np.arange(len(hum)) / SR; hum *= (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * t))[:, None] * np.clip(t / 1.5, 0, 1)[:, None]
poner(fx, env(filtro(hum, hi=2500), 0.5, 0.06), 6.4, -14)
# salen las cosas (12,31): silbidos que se acercan
poner(fx, silbido(0.74, 220, 900, -10), 12.31, 0)
# --- la lluvia (13,50–16,65) ---
def explosion(tt, g=0.0, lejos=False):
    x = snd('GrenadeExplode')
    if lejos: x = filtro(remuestrear(x, 0.85), hi=1800)
    poner(fx, x, tt, g); poner(fx, boom(1.6, 40), tt, g - (8 if lejos else 2))
for tt, g, lej in [(13.50, 2, False), (14.68, -6, True), (15.47, -2, False), (16.26, -8, True)]: explosion(tt, g, lej); poner(fx, silbido(0.45, 300, 1400, -14), tt - 0.45, 0)
for tt in [14.29, 15.87]: poner(fx, snd('CB_Impact1'), tt, -4); poner(fx, boom(1.0, 55), tt, -8); poner(fx, silbido(0.4, 300, 1200, -15), tt - 0.4, 0)
for i in range(14): tt = 13.6 + i * 0.22 + rng.random() * 0.1; explosion(tt, -18 - rng.random() * 6, True)
# pasos en la arena y respiración agitada (13,5–16,9 y 23,4–26,6)
def pasos(t0, t1, cada, g):
    tt = t0; i = 0
    while tt < t1: poner(fx, snd('PS_sand%d' % (1 + i % 4)), tt, g); tt += cada; i += 1
pasos(13.55, 16.9, 0.31, -10); poner(fx, snd('fn_corre1'), 13.6, -14); poner(fx, snd('fn_corre2'), 15.2, -14)
# --- el barril (16,65–19,02) ---
poner(fx, silbido(0.5, 260, 1100, -10), 17.34, 0); poner(fx, snd('PS_metal2'), 17.84, -2); poner(fx, boom(0.8, 60), 17.84, -6); poner(fx, snd('PS_metal4'), 18.02, -8)
explosion(18.63, 4); poner(fx, boom(3.0, 28), 18.63, 0)
for i in range(6): explosion(16.8 + i * 0.35, -16, True)
# --- la nuclear (19,02): el destello calla todo (zumbido en los oídos), después llega el estruendo y la onda ---
pit = np.sin(2 * np.pi * 3800 * np.arange(int(1.6 * SR)) / SR).astype(np.float32); pit = np.stack([pit, pit], 1) * np.exp(-np.arange(len(pit)) / SR * 1.6)[:, None]
poner(fx, pit, 19.02, -24)
poner(fx, remuestrear(snd('NK_tsar'), 0.9), 19.75, 0); poner(fx, boom(4.0, 26), 19.75, 1); poner(fx, filtro(snd('NK_onda'), hi=3000), 20.6, -2); poner(fx, filtro(remuestrear(snd('NK_rumble'), 0.7), hi=700), 20.0, -4)
# --- la corrida (23,36–26,6) ---
pasos(23.4, 26.55, 0.30, -9); poner(fx, snd('fn_corre1'), 23.5, -12); poner(fx, snd('fn_corre2'), 25.0, -12)
poner(fx, lazo(snd('AM_rafaga1'), 3.3) * 0.8, 23.36, -10)
for tt in [23.8, 24.6, 25.33, 25.95]: explosion(tt, -9 if tt > 25 else -14, tt < 25)
# --- la playa (26,6–34): olas (ruido con la marea cada 6,5 s), brisa, pasos cansados, respiración ---
n = int(4.3 * SR); t = np.arange(n) / SR
ola = filtro(np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1).astype(np.float32), lo=150, hi=2600)
ola *= (0.35 + 0.65 * np.clip(np.sin(2 * np.pi * (t / 6.5) - 0.6), 0, 1) ** 1.5 + 0.1 * np.sin(2 * np.pi * t / 2.9))[:, None]
poner(fx, env(ola, 0.15, 0.02), 26.6, -15); poner(fx, env(lazo(snd('AG_Lago'), 4.3), 0.2, 0.02), 26.6, -12)
poner(fx, env(lazo(snd('AM_viento2'), 10.4), 0.3, 0.02) , 26.6, -20)
pasos(26.75, 28.5, 0.58, -13); poner(fx, filtro(snd('fn_aliento'), hi=5000), 27.2, -12); poner(fx, filtro(snd('fn_respira'), hi=5000), 28.7, -12)
# --- la onda expansiva de la nuclear le llega (20,92): ráfaga de arena y viento, retumbo ---
raf = lazo(snd('AM_rafaga2'), 2.6); tt = np.arange(len(raf)) / SR; raf *= (np.clip(tt / 0.12, 0, 1) * np.exp(-np.maximum(tt - 0.4, 0) * 1.4))[:, None]
poner(fx, raf, 20.92, -2); poner(fx, filtro(remuestrear(snd('NK_onda'), 0.85), hi=2200), 20.88, -3); poner(fx, boom(2.2, 32), 20.92, -4)
are = filtro(np.stack([rng.standard_normal(int(2.4 * SR))] * 2, 1).astype(np.float32), lo=2500, hi=11000); tt = np.arange(len(are)) / SR
poner(fx, are * (np.clip(tt / 0.1, 0, 1) * np.exp(-tt * 1.3))[:, None], 20.95, -16)
# --- el final (30,86–36,92) ---
# las olas y la brisa siguen hasta el corte
n = int(6.2 * SR); tt = np.arange(n) / SR
ola = filtro(np.stack([rng.standard_normal(n), rng.standard_normal(n)], 1).astype(np.float32), lo=150, hi=2600)
ola *= (0.35 + 0.65 * np.clip(np.sin(2 * np.pi * ((tt + 4.26) / 6.5) - 0.6), 0, 1) ** 1.5)[:, None]
poner(fx, env(ola, 0.02, 0.005), 30.86, -17); poner(fx, env(lazo(snd('AG_Lago'), 6.2), 0.02, 0.005), 30.86, -14)
# el meteoro: chillido que crece y se acerca (sube de tono), con crepitar eléctrico
poner(fx, silbido(0.55, 380, 2300, -6, ruido=True), 30.92, 0)
poner(fx, filtro(silbido(0.5, 90, 260, -8, ruido=False), hi=400), 30.97, 0)
for i in range(6): poner(fx, chispa(0.18, -12), 31.05 + i * 0.065, 0)
# el golpe (31,45): estampido, crujido, arena que salta y llueve, chispazo de la gun
poner(fx, boom(2.6, 34), 31.45, 2); poner(fx, filtro(snd('PL_caida1'), hi=3500), 31.45, 0); poner(fx, snd('GrenadeExplode'), 31.45, -6)
cr = filtro(np.stack([rng.standard_normal(int(0.3 * SR))] * 2, 1).astype(np.float32), lo=1200) * np.exp(-np.arange(int(0.3 * SR)) / SR * 18)[:, None]
poner(fx, cr, 31.45, -3); poner(fx, snd('PG_Off'), 31.47, -3); poner(fx, chispa(1.2), 31.45, -4)
llu = filtro(np.stack([rng.standard_normal(int(1.6 * SR)) * (rng.random(int(1.6 * SR)) < 0.08)] * 2, 1).astype(np.float32), lo=1800, hi=9000)
tt = np.arange(len(llu)) / SR; poner(fx, llu * np.exp(-tt * 2.2)[:, None], 31.75, -10)
# el pitido en los oídos después del golpe (tensión)
pit = np.sin(2 * np.pi * 4200 * np.arange(int(2.2 * SR)) / SR).astype(np.float32); pit = np.stack([pit, pit], 1) * (np.exp(-np.arange(len(pit)) / SR * 1.2))[:, None]
poner(fx, pit, 31.5, -30)
# se da vuelta: pasos en la arena
for tt0 in [32.72, 33.08, 33.46]: poner(fx, snd('PS_sand%d' % (1 + int(tt0 * 10) % 4)), tt0, -13)
# el zumbido del arma: late y crece hasta que él la toca; ahí sube de tono y se dispara; corte seco en 36,92
hum = lazo(snd('PG_Hold'), 5.4); tt = np.arange(len(hum)) / SR
hum *= ((0.75 + 0.25 * np.sin(2 * np.pi * 1.08 * tt)) * np.clip(tt / 0.6, 0, 1) * (0.5 + 0.5 * np.clip((tt - 1.5) / 3.3, 0, 1)))[:, None]
poner(fx, env(hum, 0.01, 0.002), 31.52, -15)
sube = remuestrear(lazo(snd('PG_Hold'), 1.4), 0.75); sube = remuestrear(sube, 1.0)
k = np.linspace(1.0, 2.2, int(0.62 * SR)); idx = np.clip(np.cumsum(k).astype(int), 0, len(sube) - 2); sub = sube[idx] * np.linspace(0.4, 1.0, len(idx))[:, None]
poner(fx, env(sub, 0.05, 0.002), 36.30, -6); poner(fx, chispa(0.62), 36.30, -6); poner(fx, snd('GG_Pickup'), 36.28, -8)
# el dron de suspenso (33,4–36,92): grave que crece y sube un poco, con aire
n = int(3.52 * SR); tt = np.arange(n) / SR; fr = 42 + 10 * (tt / 3.52) ** 2
dr = np.sin(2 * np.pi * np.cumsum(fr) / SR) * 0.8 + filtro(np.stack([rng.standard_normal(n)] * 2, 1).astype(np.float32), lo=60, hi=500)[:, 0] * 0.35
dr = (dr * (tt / 3.52) ** 1.6).astype(np.float32); poner(fx, env(np.stack([dr, dr], 1), 0.3, 0.002), 33.4, -7)
# el corte: un soplo suave al pasar a la toma de cerca (34,0)
wh = filtro(np.stack([rng.standard_normal(int(0.5 * SR))] * 2, 1).astype(np.float32), lo=400, hi=3000); tt = np.arange(len(wh)) / SR
poner(fx, wh * (np.sin(np.pi * tt / 0.5) ** 2)[:, None], 33.78, -20)
# --- la placa final (37,5): golpe grave, falla digital; y la falla al romperse (39,6) ---
def falla(dur, g):
    n = int(dur * SR); x = np.repeat(rng.standard_normal(n // 64 + 1), 64)[:n] * (rng.random(n // 400 + 1).repeat(400)[:n] < 0.6)
    x = filtro(np.stack([x, x], 1).astype(np.float32), lo=600, hi=9000); return x * db(g)
poner(fx, boom(2.4, 30), 37.5, 3); poner(fx, falla(0.22, -10), 37.5, 0); poner(fx, chispa(0.5), 37.5, -8); poner(fx, falla(0.12, -16), 38.0, 0)
poner(fx, falla(0.4, -14), 39.6, 0)

# ---------------- mezcla: el silencio de la nuclear; del corte a negro (36,92) a la placa (37,5) sólo queda la canción ----------------
t = np.arange(N) / SR
calla = np.where((t >= 19.02) & (t < 19.75), 0.35 + 0.65 * np.clip((t - 19.02) / 0.73, 0, 1) ** 2, 1.0)   # (el destello: todo apagado, vuelve)
fx[(t >= 36.92) & (t < 37.5)] = 0
mix = mus * db(-2.5) * calla[:, None] + fx * db(-4) * calla[:, None]
# negro de 13,05 a 13,50: sólo la canción
neg = (t >= 13.05) & (t < 13.5); mix[neg] = mus[neg] * db(-2.5)
# limitador suave y normalización a −1 dBFS
pk = np.abs(mix).max(); mix = mix / max(pk, 1e-6) * 1.4; mix = np.tanh(mix) / np.tanh(1.4); mix *= db(-1.0)
# final: los últimos 5 ms bajan para no hacer clic
mix[-int(0.005 * SR):] *= np.linspace(1, 0, int(0.005 * SR))[:, None]
out = os.path.join(AQUI, 'audio', 'mezcla.wav')
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
rms = lambda a, b: 20 * np.log10(np.sqrt((mix[int(a * SR):int(b * SR)] ** 2).mean()) + 1e-9)
print('listo', out, 'pico', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS')
for a, b, n in [(0, 2.06, 'logo'), (2.06, 6.4, 'manos'), (6.4, 9.16, 'grieta'), (9.16, 13.05, 'grieta 2'), (13.5, 19.02, 'lluvia'), (19.02, 23.36, 'nuclear'), (23.36, 26.6, 'corre'), (26.6, 30.86, 'playa'), (30.86, 34, 'meteoro'), (34, 36.92, 'la agarra'), (36.92, 37.5, 'negro'), (37.5, 40, 'placa')]: print(f'  {n:11s} {rms(a, b):6.1f} dB RMS')
