#!/usr/bin/env python3
"""Arma la página: index.html con los módulos de juego/ en orden y los paquetes de datos.
Uso: python3 -I armar.py SALIDA/sitio
- b/inicio-HASH.bin: lo que hace falta para arrancar (datos, tabla de objetos, hojas, fuentes,
  efectos de sonido) en un solo pedido; b/iconos-HASH.bin: todos los íconos del jugador.
- lo que se pide cuando hace falta (fondos, pisos, música, la biblioteca de sonidos) queda en datos/.
El nombre lleva el hash del contenido: el navegador lo guarda para siempre y una versión nueva se
baja sola."""
import hashlib, json, os, re, struct, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
MODULOS = ["nucleo.js", "nivel.js", "mundo.js", "particulas.js", "perfil.js", "jugador.js", "triggers.js", "juego.js",
           "oficiales.js", "ui.js", "menus.js", "editor.js", "editor2.js", "online.js", "principal.js"]
DIFERIDAS = re.compile(r"^(game_bg|groundSquare|fg_|tutorial|promo|mapPromo|dialogIcon|PlayerExplosion|GJ_ShopSheet|GauntletSheet|SecretSheet|TreasureRoomSheet|TowerSheet|DungeonSheet|WorldSheet|GJ_PathSheet|gjFont\d|fps_images|gk-icon)")
sitio = sys.argv[1]
datos = os.path.join(sitio, "datos")


def paquete(nombre, archivos):
    """[4 bytes: largo del índice][índice JSON {ruta: [desde, largo]}][archivos uno atrás del otro]"""
    idx, cuerpo, pos = {}, [], 0
    for ruta in archivos:
        b = open(os.path.join(datos, ruta), "rb").read()
        idx[ruta] = [pos, len(b)]; cuerpo.append(b); pos += len(b)
    cab = json.dumps(idx, separators=(",", ":")).encode()
    todo = struct.pack("<I", len(cab)) + cab + b"".join(cuerpo)
    h = hashlib.sha256(todo).hexdigest()[:12]
    os.makedirs(os.path.join(sitio, "b"), exist_ok=True)
    for viejo in os.listdir(os.path.join(sitio, "b")):
        if viejo.startswith(nombre + "-"):
            os.remove(os.path.join(sitio, "b", viejo))
    destino = f"b/{nombre}-{h}.bin"
    open(os.path.join(sitio, destino), "wb").write(todo)
    print(destino, len(todo))
    return destino


meta = json.load(open(os.path.join(datos, "datos.json")))
inicio = ["datos.json", "objetos.json"]
for n, h in meta["hojas"].items():
    if not DIFERIDAS.match(n):
        inicio.append(f"tex/{n}.webp")
inicio += [f"son/{a}" for a in sorted(os.listdir(os.path.join(datos, "son")))]
# arranque: lo mínimo para la pantalla de carga del juego (logo, barra, fuentes), con sus marcos
ARR_HOJAS = ["GJ_LaunchSheet", "GJ_gradientBG", "slidergroove", "sliderBar"]
ARR_FUENTES = ["bigFont", "goldFont", "chatFont"]
arr = {"hojas": {n: meta["hojas"].get(n) for n in ARR_HOJAS}, "fuentes": {n: meta["fuentes"][n] for n in ARR_FUENTES}, "sd": meta.get("sd", [])}
json.dump(arr, open(os.path.join(datos, "arranque.json"), "w"), separators=(",", ":"))
arranque = ["arranque.json"] + [f"tex/{n}.webp" for n in ARR_HOJAS] + [f"tex/{meta['fuentes'][n]['page'].replace('-hd.png', '').replace('.png', '')}.webp" for n in ARR_FUENTES]
paq = {"arranque": paquete("arranque", arranque), "inicio": paquete("inicio", inicio),
       "iconos": paquete("iconos", [f"ico/{a}" for a in sorted(os.listdir(os.path.join(datos, "ico")))])}
locales = sorted(int(a[:-4]) for a in os.listdir(os.path.join(datos, "mus")) if a[:-4].isdigit())

js = []
for m in MODULOS:
    p = os.path.join(AQUI, "juego", m)
    js.append("(()=>{" + open(p, encoding="utf-8").read() + "\n})();")
html = """<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Geometry Dash</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#lienzo{position:fixed;inset:0;width:100%;height:100%;display:block}
#tapa{position:fixed;inset:0;background:#000;color:#fff;font:16px sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
#tapa div{width:50%;height:6px;background:#333;border-radius:3px;overflow:hidden}#carga{height:100%;width:0;background:#7f0}</style></head>
<body><canvas id="lienzo"></canvas><div id="tapa">Cargando<div><div id="carga"></div></div></div>
<script>window.GD_PAQUETES=""" + json.dumps(paq) + ";window.GD_CANCIONES_LOCALES=" + json.dumps(locales) + ";</script><script>" + "\n".join(js) + """</script></body></html>"""
open(os.path.join(sitio, "index.html"), "w", encoding="utf-8").write(html)
print("index.html", len(html))
