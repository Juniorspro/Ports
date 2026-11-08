# Pone las fotos sacadas con fondos.mjs en el paquete del juego (fuera del repo): las del menú en PAQUETE/fondos/ y las de
# la pantalla de carga en PAQUETE/carga/N_<nombre>.jpg (el nombre es el que usa FONDO_MAPA en rbmenus.js). Antes guarda
# las que había en PAQUETE/<carpeta>_anterior/ (copias nuevas: los archivos del paquete pueden ser enlaces duros
# compartidos con otros paquetes, así que no se escriben encima: se borran y se crean de nuevo).
# uso: python3 -I instalar.py CARPETA_PNG PAQUETE [--sin-respaldo]
import os, sys, shutil
from PIL import Image
SAL, PK = sys.argv[1], sys.argv[2]
respaldo = '--sin-respaldo' not in sys.argv
# las del menú y las de carga, en el orden en que van (las de carga: índice_nombre, como antes; la pizzería queda la que estaba)
MENU = ['m1_FlatGrass', 'm2_RB_Ciudad', 'm3_RB_Isla', 'm4_RB_Desierto', 'm5_City', 'm6_Desert']
CARGA = ['c0_rb_flatgrass', 'c1_rb_ciudad', 'c2_rb_city', 'c3_rb_desert', 'c4_rb_isla', 'c5_rb_mars', None, 'c7_rb_construct', 'c8_rb_gmflatgrass',
         'c9_rb_desierto', 'c10_rb_llanura', 'c11_rb_colinas', 'c12_rb_luna']
def poner(carpeta, nombres, nombre_dest, guardar):
    D = os.path.join(PK, carpeta); os.makedirs(D, exist_ok=True)
    if respaldo:
        A = D + '_anterior'
        if not os.path.isdir(A): shutil.copytree(D, A, copy_function=shutil.copy)   # (copia de verdad, no enlaces)
    viejos = sorted(os.listdir(D))
    for f in viejos:
        if not any(f.endswith('_' + g + '.jpg') for g in guardar): os.unlink(os.path.join(D, f))   # (desenlaza: los otros paquetes no cambian)
    for i, n in enumerate(nombres):
        if n is None: continue
        dest = os.path.join(D, nombre_dest(i, n))
        if os.path.exists(dest): os.unlink(dest)
        Image.open(os.path.join(SAL, n + '.png')).convert('RGB').save(dest, 'JPEG', quality=92, optimize=True, progressive=True)
    print(carpeta, sorted(os.listdir(D)))
poner('fondos', MENU, lambda i, n: f'{i + 1}_{n.split("_", 1)[1]}.jpg', [])
poner('carga', CARGA, lambda i, n: f'{i}_{n.split("_", 1)[1]}.jpg', ['rb_pizzeria'])
