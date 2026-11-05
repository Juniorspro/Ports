# El baile del nene del bote («aura farming», Pacu Jalur, Riau, 2025), hecho a mano: un BVH con el esqueleto de la base
# de CMU (el mismo que usan los 2000 emotes de captura) y después emote_bvh.py lo pasa al formato del juego, como a todos.
# Lo que hace: parado en la punta del bote, de lentes; las rodillas marcan el ritmo de los tambores (2 por segundo) con
# la cabeza; un brazo y después el otro se estiran adelante y hacia el costado mientras la muñeca gira en redondo (la
# ola de la mano); la cadera y el pecho acompañan girando hacia el brazo que baila; el otro brazo descansa con el codo
# flojo. 4 s que se repiten sin salto.
# Uso: python3 -I emote_aura.py CARPETA   (deja CARPETA/99/99_01.bvh y CARPETA/cmu-mocap-index-text.txt)
import sys, os, math
OUT = sys.argv[1]
JER = """HIERARCHY
ROOT hip
{
 OFFSET 0.00 0.00 0.00
 CHANNELS 6 Xposition Yposition Zposition Xrotation Zrotation Yrotation
 JOINT abdomen
 {
  OFFSET 0.000000 3.402643 0.000000
  CHANNELS 3 Xrotation Zrotation Yrotation
  JOINT chest
  {
   OFFSET 0.000000 8.438565 -0.680529
   CHANNELS 3 Xrotation Zrotation Yrotation
   JOINT neck
   {
    OFFSET 0.000000 10.207942 -0.272212
    CHANNELS 3 Xrotation Zrotation Yrotation
    JOINT head
    {
     OFFSET 0.000000 3.130431 0.000000
     CHANNELS 3 Xrotation Zrotation Yrotation
     End Site
     {
      OFFSET 0.000000 3.130435 0.000000
     }
    }
   }
   JOINT lCollar
   {
    OFFSET 3.470700 6.669187 -0.816635
    CHANNELS 3 Yrotation Zrotation Xrotation
    JOINT lShldr
    {
     OFFSET 3.198488 0.000000 0.000000
     CHANNELS 3 Zrotation Yrotation Xrotation
     JOINT lForeArm
     {
      OFFSET 10.139888 0.000000 0.000000
      CHANNELS 3 Yrotation Zrotation Xrotation
      JOINT lHand
      {
       OFFSET 8.370511 0.000000 0.000000
       CHANNELS 3 Zrotation Yrotation Xrotation
       End Site
       {
        OFFSET 4.083176 0.000000 0.000000
       }
      }
     }
    }
   }
   JOINT rCollar
   {
    OFFSET -3.470700 6.669187 -0.816635
    CHANNELS 3 Yrotation Zrotation Xrotation
    JOINT rShldr
    {
     OFFSET -3.198488 0.000000 0.000000
     CHANNELS 3 Zrotation Yrotation Xrotation
     JOINT rForeArm
     {
      OFFSET -10.139888 0.000000 0.000000
      CHANNELS 3 Yrotation Zrotation Xrotation
      JOINT rHand
      {
       OFFSET -8.370511 0.000000 0.000000
       CHANNELS 3 Zrotation Yrotation Xrotation
       End Site
       {
        OFFSET -4.083176 0.000000 0.000000
       }
      }
     }
    }
   }
  }
 }
 JOINT lThigh
 {
  OFFSET 5.308129 -1.633274 1.361059
  CHANNELS 3 Xrotation Zrotation Yrotation
  JOINT lShin
  {
   OFFSET -2.041588 -20.007561 0.000000
   CHANNELS 3 Xrotation Zrotation Yrotation
   JOINT lFoot
   {
    OFFSET 0.000000 -19.190928 -1.224953
    CHANNELS 3 Xrotation Yrotation Zrotation
    End Site
    {
     OFFSET 0.000000 -2.449906 4.627600
    }
   }
  }
 }
 JOINT rThigh
 {
  OFFSET -5.308129 -1.633274 1.361059
  CHANNELS 3 Xrotation Zrotation Yrotation
  JOINT rShin
  {
   OFFSET 2.041588 -20.007561 0.000000
   CHANNELS 3 Xrotation Zrotation Yrotation
   JOINT rFoot
   {
    OFFSET 0.000000 -19.190928 -1.224953
    CHANNELS 3 Xrotation Yrotation Zrotation
    End Site
    {
     OFFSET 0.000000 -2.449906 4.627600
    }
   }
  }
 }
}
"""
# Ejes del BVH de CMU: Y arriba, el personaje mira a +Z, su izquierda es +X; los brazos en pose T van a ±X.
# Hombro (Z Y X): Z = -90 baja el brazo izquierdo al costado, Y = -flexión lo lleva adelante (al derecho, signos al revés).
# Codo (Y Z X): Y = -flexión dobla el antebrazo izquierdo hacia adelante. Muñeca (Z Y X): Z dobla la mano, X la gira.
# Muslo (X Z Y): X negativo lo lleva adelante; rodilla X positivo la dobla; tobillo X lo compensa (pie plano).
DUR, FPS = 4.0, 30
N = int(DUR * FPS)
def suave(x): return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))
filas = []
for f in range(N):
    t = f / FPS; fi = 2 * math.pi * t / DUR; b = 2 * math.pi * 2 * t; r = 2 * math.pi * 1 * t
    k = 0.5 - 0.5 * math.cos(b)                      # (las rodillas: abajo en cada golpe del tambor)
    eR, eL = suave((1 + math.sin(fi)) / 2), suave((1 - math.sin(fi)) / 2)   # (qué tanto baila cada brazo)
    a = 7 + 9 * k                                    # (flexión de la cadera y de la rodilla)
    caida = (20.0 + 19.19) * (1 - math.cos(math.radians(a))) - (20.0 + 19.19) * (1 - math.cos(math.radians(7)))
    gira = -11 * math.sin(fi)                        # (cadera y pecho hacia el brazo que baila: el derecho a -X)
    hip = [0.0, 45.0 - caida, 0.0, 3 + 1.5 * k, 3 * math.sin(fi), gira * 0.6]
    abdomen = [4 + 1.5 * k, -2 * math.sin(fi), gira * 0.4]
    chest = [3 + 1.0 * k, -2 * math.sin(fi), gira * 0.5]
    neck = [2 + 2 * k, 0, -6 * math.sin(fi)]
    head = [3 + 4 * k - 2, 5 * math.sin(fi), -8 * math.sin(fi)]
    def brazo(e, lado):
        s = 1 if lado == 'l' else -1              # (izquierdo +X, derecho -X)
        # (en su medio ciclo el brazo barre del costado hacia adelante, como una ola: p va de 0 a 1, y en el otro medio,
        # ya bajando, vuelve suave; antes saltaba de 1 a 0 con el brazo a medio levantar: 23 cm en un cuadro)
        p = 0.5 - 0.5 * math.cos(fi if lado == 'r' else fi - math.pi)
        ola = 0.5 + 0.5 * math.cos(r)
        flex = 8 + e * (38 + 30 * p)                # (adelante: de 8° colgando a ~75° casi a la altura del hombro)
        abd = 10 + e * (62 - 42 * p)                # (al costado: abierto al empezar, cerrándose hacia adelante)
        codo = 26 - 12 * e + 8 * e * (1 - ola)      # (blando: nunca del todo estirado)
        tw = 55 * e * math.sin(r)                   # (la muñeca girando en redondo)
        fm = 30 * e * math.cos(r) + 6
        col = [0, s * (3 + 7 * e), 0]               # (el hombro se levanta un poco)
        sh = [s * (-90 + abd), -s * flex, s * (-15 * e)]   # (Z, Y, X)
        fa = [-s * codo, 0, s * (25 * e * math.sin(r + 0.6))]   # (Y, Z, X)
        ha = [-s * fm, 0, s * tw]                   # (Z, Y, X)
        return col, sh, fa, ha
    lc, ls, lf, lh = brazo(eL, 'l'); rc, rs, rf, rh = brazo(eR, 'r')
    th = [-a, 0, 0]; sn = [2 * a, 0, 0]; ft = [-a, 0, 0]
    v = hip + abdomen + chest + neck + head + lc + ls + lf + lh + rc + rs + rf + rh + th + sn + ft + th + sn + ft
    filas.append(' '.join('%.4f' % x for x in v))
os.makedirs(os.path.join(OUT, '99'), exist_ok=True)
open(os.path.join(OUT, '99', '99_01.bvh'), 'w').write(JER + 'MOTION\nFrames: %d\nFrame Time: %.6f\n' % (N, 1 / FPS) + '\n'.join(filas) + '\n')
open(os.path.join(OUT, 'cmu-mocap-index-text.txt'), 'w').write('99_01 aura farming dance (boat kid) - danc\n')
print('listo', N, 'cuadros')
