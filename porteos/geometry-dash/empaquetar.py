#!/usr/bin/env python3
"""Saca del APK de Geometry Dash 2.2 lo que usa nuestro motor: hojas de sprites (webp + marcos en
JSON), fuentes, animaciones, partículas, niveles y sonidos. Uso:
    python3 -I empaquetar.py RUTA/assets SALIDA/sitio
Nada de esto va al repo: sale a SALIDA/sitio/datos."""
import json, os, re, sys, subprocess, plistlib, concurrent.futures as cf
from PIL import Image

ORIGEN, SITIO = sys.argv[1], sys.argv[2]
DATOS = os.path.join(SITIO, "datos")
for d in ("tex", "ico", "son", "mus", "sfx"):
    os.makedirs(os.path.join(DATOS, d), exist_ok=True)

num = lambda s: [float(x) for x in re.findall(r"-?[\d.]+", s)]


def marcos(plist):
    """Formato 3 de cocos2d → {nombre: [x, y, w, h, rotado, offX, offY, srcW, srcH]} (en píxeles hd)."""
    out = {}
    for n, f in plist.get("frames", {}).items():
        if "textureRect" in f:
            x, y, w, h = num(f["textureRect"])
            ox, oy = num(f["spriteOffset"])
            sw, sh = num(f["spriteSourceSize"])
            rot = f.get("textureRotated")
        else:  # formatos 1 y 2 (hojas viejas)
            x, y, w, h = num(f["frame"])
            ox, oy = num(f["offset"])
            sw, sh = num(f["sourceSize"])
            rot = f.get("rotated")
        out[n] = [int(x), int(y), int(w), int(h), 1 if rot else 0, ox, oy, int(sw), int(sh)]
    return out


def webp(src, dst, q=90):
    im = Image.open(src).convert("RGBA")
    im.save(dst, "WEBP", quality=q, alpha_quality=100, method=5)
    return im.size


def leer_plist(p):
    with open(p, "rb") as f:
        return plistlib.loads(f.read().lstrip())  # las AnimDesc empiezan con un salto de línea


def fnt(p):
    """BMFont de texto → {lh, base, page, chars: {id: [x,y,w,h,xo,yo,xa]}, kern}."""
    r = {"chars": {}, "kern": {}}
    for ln in open(p, encoding="latin-1"):
        k = ln.split(" ", 1)[0]
        a = dict(re.findall(r'(\w+)=("[^"]*"|\S+)', ln))
        if k == "common":
            r["lh"], r["base"] = int(a["lineHeight"]), int(a["base"])
        elif k == "page":
            r["page"] = a["file"].strip('"')
        elif k == "char":
            r["chars"][a["id"]] = [int(a[c]) for c in ("x", "y", "width", "height", "xoffset", "yoffset", "xadvance")]
        elif k == "kerning":
            r["kern"][a["first"] + "," + a["second"]] = int(a["amount"])
    return r


def main():
    archivos = os.listdir(ORIGEN)
    hojas, fuentes, otros = {}, {}, {}
    trabajos = []
    with cf.ThreadPoolExecutor(8) as ex:
        # hojas de sprites hd (las que tienen plist de marcos) y pngs sueltos hd
        for a in sorted(archivos):
            if not a.endswith("-hd.png"):
                continue
            base = a[:-7]
            pl = os.path.join(ORIGEN, base + "-hd.plist")
            dst = os.path.join(DATOS, "tex", base + ".webp")
            trabajos.append(ex.submit(webp, os.path.join(ORIGEN, a), dst))
            if os.path.exists(pl):
                hojas[base] = marcos(leer_plist(pl))
            else:
                hojas[base] = None  # textura suelta (fondos, pisos, fuentes)
        # las que el juego trae sólo en baja resolución (estelas, fuego de la nave, partículas)
        sd = []
        for a in sorted(archivos):
            if a.endswith(".png") and not a.endswith("-hd.png") and not a.endswith("-ipadhd.png") and a[:-4] + "-hd.png" not in archivos:
                base = a[:-4]
                trabajos.append(ex.submit(webp, os.path.join(ORIGEN, a), os.path.join(DATOS, "tex", base + ".webp")))
                hojas[base] = None; sd.append(base)
        for a in archivos:
            if a.endswith("-hd.fnt"):
                fuentes[a[:-7]] = fnt(os.path.join(ORIGEN, a))
            elif a.endswith(".plist") and not a.endswith("-hd.plist") and not os.path.exists(
                    os.path.join(ORIGEN, a[:-6] + "-hd.png")) and not os.path.exists(os.path.join(ORIGEN, a[:-6] + ".png")):
                otros[a[:-6]] = leer_plist(os.path.join(ORIGEN, a))  # animaciones y partículas
        # íconos del jugador: cada uno su hojita, se cargan cuando hacen falta
        ico = {}
        icd = os.path.join(ORIGEN, "icons")
        for a in sorted(os.listdir(icd)):
            if a.endswith("-hd.plist"):
                b = a[:-9]
                ico[b] = marcos(leer_plist(os.path.join(icd, a)))
                trabajos.append(ex.submit(webp, os.path.join(icd, b + "-hd.png"), os.path.join(DATOS, "ico", b + ".webp")))
        for t in trabajos:
            t.result()
    # plist con datos que no son de marcos (p. ej. partículas guardadas como .plist con png al lado)
    for a in archivos:
        if a.endswith(".plist") and a[:-6] not in otros and "-hd" not in a and a[:-6] not in hojas:
            try:
                d = leer_plist(os.path.join(ORIGEN, a))
                if "frames" not in d:
                    otros[a[:-6]] = d
            except Exception:
                pass
    niveles = {a[:-4]: re.sub(r"[^A-Za-z0-9_=+/-]", "", open(os.path.join(ORIGEN, "levels", a), "rb").read().decode("latin-1")) for a in os.listdir(os.path.join(ORIGEN, "levels"))}
    def limpio(o):
        if isinstance(o, dict):
            return {k: limpio(v) for k, v in o.items()}
        if isinstance(o, list):
            return [limpio(v) for v in o]
        if isinstance(o, bytes):
            return None
        return o
    json.dump({"hojas": hojas, "fuentes": fuentes, "otros": limpio(otros), "iconos": ico, "niveles": niveles, "sd": sd},
              open(os.path.join(DATOS, "datos.json"), "w"), separators=(",", ":"))
    objetos()
    audio()


TRIGGERS22 = {1913: "eZoomBtn", 1914: "eStaticBtn", 1916: "eOffsetBtn", 2015: "eCamRotBtn", 2062: "eEdgeBtn", 2925: "eCamModeBtn", 2016: "eCamGuideBtn",
              1917: "eReverseBtn", 2900: "eGameRotBtn", 1934: "eSongBtn", 3602: "eSFXBtn", 3603: "eEditSFXBtn", 3605: "eEditSongBtn", 1935: "eTimeWarpBtn",
              2066: "eGravity", 3600: "eEndBtn", 3022: "eTeleportBtn", 1912: "eRandomBtn", 2068: "eAdvRandomBtn", 3607: "eSequenceBtn", 3614: "eTimeBtn",
              3615: "eTimeEventBtn", 3617: "eTimeControlBtn", 3619: "eItemEditBtn", 3620: "eItemCompBtn", 3641: "eItemPersBtn", 3618: "eResetBtn",
              2067: "eScaleComBtn", 3006: "eAreaMoveBtn", 3007: "eAreaRotateBtn", 3008: "eAreaScaleBtn", 3009: "eAreaFadeBtn", 3010: "eAreaTintBtn",
              3011: "eEAreaMoveBtn", 3012: "eEAreaRotateBtn", 3013: "eEAreaScaleBtn", 3014: "eEAreaFadeBtn", 3015: "eEAreaTintBtn", 3024: "eAreaStopBtn",
              3016: "eAdvFollowBtn", 3660: "eEditAdvFollowBtn", 3661: "eReAdvFollowBtn", 3032: "eKeyframeBtn", 2903: "eGradientBtn", 2904: "eShaderBtn",
              2905: "eSh_ShockWaveBtn", 2907: "eSh_ShockLineBtn", 2909: "eSh_GlitchBtn", 2910: "eSh_ChromaticBtn", 2911: "eSh_ChromaticGlitchBtn",
              2912: "eSh_PixelateBtn", 2913: "eSh_LensCircleBtn", 2914: "eSh_RadialBlurBtn", 2915: "eSh_MotionBlurBtn", 2916: "eSh_BulgeBtn",
              2917: "eSh_PinchBtn", 2919: "eSh_GrayscaleBtn", 2920: "eSh_SepiaBtn", 2921: "eSh_InvertColorBtn", 2922: "eSh_HueBtn", 2923: "eSh_EditColorBtn",
              2924: "eSh_SplitScreenBtn", 3608: "eSpawnParticleBtn", 3017: "eEnterMoveBtn", 3018: "eEnterRotateBtn", 3019: "eEnterScaleBtn",
              3020: "eEnterFadeBtn", 3021: "eEnterTintBtn", 3023: "eEnterStopBtn", 2065: "eCParticleBtn", 3642: "eBPMBtn", 1915: "eeNone2Btn", 3029: "eChangeBG", 3030: "eChangeG", 3031: "eChangeMG", 2999: "eSetupMGBtn",
              3606: "eBGSpeedBtn", 3612: "eMGSpeedBtn", 3604: "eEventLinkBtn", 3609: "eInstantCollisionBtn", 3640: "eCollisionStateBtn",
              3613: "eUISettingsBtn", 3662: "eLinkVisibleBtn", 2899: "eOptionsBtn", 1932: "ePlayerControlBtn", 2901: "eGPOffsetBtn"}


EXTRA22 = {2063: {"t": "checkpoint_d_01_001.png", "z": 3, "c2": 1011, "ty": 40, "hb": ["B", 30.0, 60.0, 0.0, 0.0]},
           3610: {"t": "edit_eDamageSquare_001.png", "ty": 2, "hb": ["B", 30.0, 30.0, 0.0, 0.0]},
           3611: {"t": "edit_eDamageCircle_001.png", "ty": 2, "hb": ["C", 15.0, 0.0, 0.0, 0.0]},
           2069: {"t": "edit_eForceBlock01_001.png", "ty": 40, "hb": ["B", 30.0, 30.0, 0.0, 0.0]},
           3645: {"t": "edit_eForceBlock02_001.png", "ty": 40, "hb": ["C", 15.0, 0.0, 0.0, 0.0]},
           3643: {"t": "edit_ePlayerTouchBtn_001.png", "ty": 40, "hb": ["B", 30.0, 30.0, 0.0, 0.0]}}


def objetos():
    """Tabla de objetos (id → textura, capa, colores, hijos, caja de choque). El juego la tiene en el
    binario; mientras no esté, se arma con los datos públicos de dos reimplementaciones (se bajan al
    armar, no van al repo): OpenGD trae el tipo de objeto y gdclone la caja y los sprites hijos."""
    import urllib.request
    cache = os.path.join(SITIO, "..", "ref")
    os.makedirs(cache, exist_ok=True)
    fuentes = {"opengd": "https://raw.githubusercontent.com/Open-GD/OpenGD/main/Content/Custom/object.json",
               "gdclone": "https://raw.githubusercontent.com/opstic/gdclone/main/assets/data/object.json"}
    d = {}
    for k, u in fuentes.items():
        f = os.path.join(cache, k + ".json")
        if not os.path.exists(f):
            urllib.request.urlretrieve(u, f)
        d[k] = json.load(open(f))
    canal = {"Base": "b", "Detail": "d", "Black": "k", "base": "b", "detail": "d", "black": "k"}
    out = {}
    for i in set(d["opengd"]) | set(d["gdclone"]):
        a, b = d["opengd"].get(i, {}), d["gdclone"].get(i, {})
        o = {"t": b.get("texture") or a.get("texture_name"), "z": b.get("default_z_layer", a.get("default_z_layer", 0)),
             "o": b.get("default_z_order", a.get("default_z_order", 0)),
             "c1": b.get("default_base_color_channel", a.get("default_primary_channel", 0)),
             "c2": b.get("default_detail_color_channel", a.get("default_secondary_channel", -1)),
             "ct": canal.get(b.get("color_type") or a.get("color_channel"), ""), "ty": a.get("object_type", 7)}
        if b.get("swap_base_detail"):
            o["sw"] = 1
        if "opacity" in b:
            o["op"] = b["opacity"]
        hb = b.get("hitbox")
        if hb:
            o["hb"] = [hb.get("type", "Box")[0], hb.get("width", hb.get("radius", 0)), hb.get("height", 0), hb.get("x", 0), hb.get("y", 0)]
        def hijos(cs):
            return [[c["texture"], c.get("x", 0), c.get("y", 0), c.get("z", 0), c.get("rot", 0), c.get("scale_x", 1), c.get("scale_y", 1),
                     int(c.get("flip_x", False)), int(c.get("flip_y", False)), c.get("anchor_x", 0), c.get("anchor_y", 0),
                     canal.get(c.get("color_type"), ""), c.get("opacity", 1)] + ([hijos(c["children"])] if c.get("children") else [])
                    for c in cs]
        if b.get("children"):
            o["h"] = hijos(b["children"])
        out[int(i)] = o
    # los triggers de la 2.2 no están en esas tablas: su dibujo del editor por nombre
    for i, t in TRIGGERS22.items():
        if i not in out or not out[i].get("t"):
            out[i] = {"t": f"edit_{t}_001.png", "z": 3, "o": 0, "c1": 0, "c2": -1, "ct": "", "ty": 7}
    # objetos de la 2.2 con función propia (tipo 2 = peligro, 40 = especial): caja de choque y sprite del editor
    for i, d in EXTRA22.items():
        if i not in out or not out[i].get("t"):
            out[i] = dict({"z": 3, "o": 0, "c1": 0, "c2": -1, "ct": ""}, **d)
    json.dump(out, open(os.path.join(DATOS, "objetos.json"), "w"), separators=(",", ":"))


def audio():
    """Música a Opus de 64 kb/s; los efectos y la biblioteca quedan en su Vorbis (ya son chicos)."""
    tareas = []
    for a in os.listdir(ORIGEN):
        if a.endswith(".mp3"):
            tareas.append((os.path.join(ORIGEN, a), os.path.join(DATOS, "mus", a[:-4] + ".ogg"), True))
        elif a.endswith(".ogg"):
            tareas.append((os.path.join(ORIGEN, a), os.path.join(DATOS, "son", a), False))
    for sub, dst in (("songs", "mus"), ("sfx", "sfx")):
        for a in os.listdir(os.path.join(ORIGEN, sub)):
            tareas.append((os.path.join(ORIGEN, sub, a), os.path.join(DATOS, dst, a), False))

    def una(t):
        src, dst, enc = t
        if os.path.exists(dst):
            return
        if enc:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-c:a", "libopus", "-b:a", "64k", dst], check=True)
        else:
            with open(src, "rb") as i, open(dst, "wb") as o:
                o.write(i.read())
    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(una, tareas))


if len(sys.argv) > 3 and sys.argv[3] == "objetos":
    objetos()
else:
    main()
