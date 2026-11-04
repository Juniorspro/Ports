#!/usr/bin/env python3
"""Sube la versión web de un porteo (empaquetar.py --sitio) a Cloudflare Pages, PRIVADA.

    export CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=…
    python3 subir.py CARPETA --proyecto NOMBRE --clave ARCHIVO [--wrangler RUTA]
    python3 subir.py CARPETA --proyecto NOMBRE --clave ARCHIVO --verificar   (sólo mira, no sube)

Delante de los archivos va _worker.js (el "modo avanzado" de Pages): sin la clave no sale nada, ni
la página ni los bloques. La clave se lee de ARCHIVO; si no existe, se inventa una al azar (16
letras y números sin los que se confunden: ~79 bits) y se guarda ahí. Va al proyecto como secreto
(CLAVE): no queda en el repo ni en lo que se sube. ARCHIVO no puede estar dentro de un repo de git.

El orden es para que el juego no quede a la vista ni un segundo:
  1. el proyecto (si no existe), el secreto CLAVE y "fail closed": en el plan gratis, si un día se
     pasan los 100.000 pedidos, Pages por defecto sirve los archivos SIN pasar por el worker (fail
     open, o sea sin la puerta); cerrado, muestra un error hasta el día siguiente
  2. una subida de PRUEBA, sin el juego: la puerta y archivos de mentira
  3. verificar desde afuera, en la dirección del proyecto y en la de esa subida: sin clave no sale
     nada (tampoco con rutas disfrazadas ni con cookies inventadas o adulteradas), con una clave mala
     tampoco, con la buena sí
  4. recién ahí la subida de verdad, y verificar de nuevo con la página y bloques reales
Si algo falla, corta sin subir el juego.

El token necesita "Cloudflare Pages: Edit" en la cuenta. wrangler: npm install wrangler@4.
"""
import argparse
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AQUI = Path(__file__).resolve().parent
API = "https://api.cloudflare.com/client/v4"
# sin 0/o ni 1/i/l: se dicta y se escribe sin dudas
ALFABETO = "23456789abcdefghjkmnpqrstuvwxyz"
# lo que no va a Cloudflare: el lanzador y las instrucciones son para la compu de uno, y los
# encabezados los pone el worker (_headers no se aplica a lo que contesta un worker)
NO_SUBIR = {"abrir.html", "COMO-SUBIRLO.txt", "_headers", "_worker.js", "_routes.json"}
# lo mismo que LIBRES en _worker.js
LIBRES = ["/sw.js", "/manifest.webmanifest", "/icono-192.png", "/icono-512.png"]
# la sesión en la ruta, como la da el worker a la puerta en un cuadro (SESION en _worker.js)
SESION_RE = r"/__s/\d{1,12}\.[0-9a-f]{64}/"
RUTAS = {"version": 1, "include": ["/*"], "exclude": []}   # todo pasa por el worker
COMPATIBILIDAD = "2026-09-01"
ESPERA = 300   # segundos que puede tardar una subida en verse en la dirección del proyecto


def log(*a):
    print("subir:", *a, flush=True)


def morir(msg):
    print(f"subir: ERROR: {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def normal(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def legible(c):
    return "-".join(c[i:i + 4] for i in range(0, len(c), 4))


def la_clave(archivo):
    p = Path(archivo).resolve()
    if subprocess.run(["git", "-C", str(p.parent if p.parent.exists() else "/"), "rev-parse"],
                      capture_output=True).returncode == 0:
        morir(f"{p} está dentro de un repo de git: la clave no puede quedar ahí")
    if p.exists():
        c = normal(p.read_text(encoding="utf-8"))
        if len(c) < 12:
            morir(f"la clave de {p} es muy corta (mínimo 12 letras o números)")
        return c
    c = "".join(secrets.choice(ALFABETO) for _ in range(16))
    p.parent.mkdir(parents=True, exist_ok=True)
    with os.fdopen(os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as f:
        f.write(legible(c) + "\n")
    log(f"clave nueva, guardada en {p}")
    return c


class Cloudflare:
    def __init__(self, token, cuenta):
        self.token, self.cuenta = token, cuenta

    def __call__(self, metodo, ruta, datos=None):
        req = urllib.request.Request(API + ruta, method=metodo,
                                     data=None if datos is None else json.dumps(datos).encode(),
                                     headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            try:
                return json.load(e)
            except ValueError:
                return {"success": False, "errors": [{"code": e.code, "message": str(e.reason)}]}

    def proyecto(self, nombre):
        return self("GET", f"/accounts/{self.cuenta}/pages/projects/{nombre}")


class _SinSeguir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None   # las redirecciones se miran, no se siguen


_abridor = urllib.request.build_opener(_SinSeguir)


def pedir(url, metodo="GET", cookie=None, formulario=None, aceptar=None):
    cab = {"User-Agent": "porteo-subir/1", "Cache-Control": "no-cache"}
    if cookie:
        cab["Cookie"] = cookie
    if aceptar:
        cab["Accept"] = aceptar
    cuerpo = None
    if formulario is not None:
        cuerpo = urllib.parse.urlencode(formulario).encode()
        cab["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=cuerpo, method=metodo, headers=cab)
    for intento in range(4):
        try:
            with _abridor.open(req, timeout=120) as r:
                return r.status, r.headers, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.headers, e.read()
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if intento == 3:
                return 0, {}, str(e).encode()
            time.sleep(2 ** intento)


def pedir_firme(url, metodo="GET", cookie=None, formulario=None, aceptar=None):
    """pedir, pero con paciencia para lo que no es una respuesta de la subida: recién subida, algún
    nodo de Cloudflare todavía no la tiene y contesta 404 o 5xx unos segundos. Nada de eso deja ver
    el juego (eso sería un 200), así que se reintenta; si sigue, queda la última respuesta."""
    for intento in range(6):
        e, cab, cuerpo = pedir(url, metodo, cookie, formulario, aceptar)
        if e not in (0, 404) and e < 500:
            break
        time.sleep(3)
    return e, cab, cuerpo


def es_puerta(estado, cuerpo):
    return estado == 401 and b'name="clave"' in cuerpo


def entrar(base, clave):
    """La cookie de sesión, entrando como una persona (con guiones y en mayúsculas), o None."""
    e, cab, _ = pedir_firme(base + "/__entrar", "POST", formulario={"clave": legible(clave).upper()})
    m = re.match(r"(porteo=\d+\.[0-9a-f]{64})", cab.get("Set-Cookie", "") if e == 303 else "")
    return (m.group(1), cab.get("Set-Cookie", "")) if m else (None, "")


def entrar_en_ruta(base, clave, formulario=False):
    """Como entra la puerta adentro de un cuadro: la sesión en la ruta ("/__s/<vence>.<firma>"), sin
    cookie. Con formulario=True, como el formulario de reserva (redirección en vez de JSON)."""
    datos = {"clave": legible(clave).upper(), "ruta": "1"}
    if formulario:
        e, cab, _ = pedir_firme(base + "/__entrar", "POST", formulario=datos)
        ruta = cab.get("Location", "") if e == 303 else ""
    else:
        e, cab, cuerpo = pedir_firme(base + "/__entrar", "POST", formulario=datos, aceptar="application/json")
        try:
            ruta = json.loads(cuerpo).get("ruta", "") if e == 200 else ""
        except ValueError:
            ruta = ""
    return (ruta[:-1], cab) if re.fullmatch(SESION_RE, ruta) else (None, cab)


def firma(clave, vence):
    """La de la sesión, como la hace el worker: para probar una vencida con la firma buena."""
    return hmac.new(clave.encode(), f"sesion|{vence}".encode(), hashlib.sha256).hexdigest()


def enmarcable(cab):
    """Que la respuesta se pueda mostrar en un cuadro (Rezona, los visores de HTML del teléfono)."""
    csp = cab.get("Content-Security-Policy", "") or ""
    return not cab.get("X-Frame-Options") and "frame-ancestors" not in csp


def disfrazadas(ruta):
    """La misma ruta escrita de otras maneras: la puerta no se tiene que poder rodear."""
    v = [ruta, ruta + "?x=1", "/" + ruta]
    if len(ruta) > 1:
        v.append("/%{:02X}{}".format(ord(ruta[1]), ruta[2:]))
        v.append("/./" + ruta[1:])
    return v


def verificar(base, clave, privados, libres=()):
    """privados: {ruta: los bytes que tiene que dar con la clave, o None si sólo no tiene que cerrar}.
    Muere si algo de la puerta no anda; si anda, devuelve la cookie."""
    fallas = []
    # 1. sin clave no sale nada, ni pidiéndolo de costado
    for ruta, contenido in privados.items():
        for v in disfrazadas(ruta):
            e, _, cuerpo = pedir_firme(base + v)
            if not es_puerta(e, cuerpo):
                fallas.append(f"sin clave, GET {v} dio {e}")
            elif contenido and contenido[:4096] in cuerpo:
                fallas.append(f"sin clave, GET {v} dejó ver el contenido")
        e, _, _ = pedir_firme(base + ruta, "HEAD")
        if e != 401:
            fallas.append(f"sin clave, HEAD {ruta} dio {e}")
    una = next(iter(privados))
    # 2. cookies inventadas no sirven
    vence = int(time.time()) + 3600
    for falsa in (f"porteo={vence}.{'0' * 64}", f"porteo=1.{'a' * 64}", "porteo=", "porteo=x"):
        e, _, cuerpo = pedir_firme(base + una, cookie=falsa)
        if not es_puerta(e, cuerpo):
            fallas.append(f"con la cookie inventada {falsa[:20]}… dio {e}")
    # 3. una clave mala tampoco
    e, cab, cuerpo = pedir_firme(base + "/__entrar", "POST", formulario={"clave": "no-es-esta-" + secrets.token_hex(4)})
    if not es_puerta(e, cuerpo) or cab.get("Set-Cookie"):
        fallas.append(f"con una clave mala dio {e}")
    # 4. con la buena sí
    cookie, galleta = entrar(base, clave)
    if not cookie:
        fallas.append("con la clave buena no dio la cookie")
    else:
        for atributo in ("HttpOnly", "Secure", "SameSite=Lax"):
            if atributo.lower() not in galleta.lower():
                fallas.append(f"a la cookie le falta {atributo}")
        for ruta, contenido in privados.items():
            e, cab, cuerpo = pedir_firme(base + ruta, cookie=cookie)
            if contenido is None:
                if e in (0, 401) or e >= 500:
                    fallas.append(f"con clave, {ruta} dio {e}")
            elif e != 200 or cuerpo != contenido:
                fallas.append(f"con clave, {ruta} dio {e} ({len(cuerpo)} bytes, esperaba {len(contenido)})")
            elif ruta.startswith("/b/") and "private" not in cab.get("Cache-Control", ""):
                fallas.append(f"{ruta} sin Cache-Control private")
        # 5. la misma cookie con la firma tocada, no
        adulterada = cookie[:-1] + ("1" if cookie[-1] == "0" else "0")
        e, _, cuerpo = pedir_firme(base + una, cookie=adulterada)
        if not es_puerta(e, cuerpo):
            fallas.append(f"con la cookie adulterada dio {e}")
    # 6. lo libre pasa sin clave (es lo que el navegador pide sin cookies para instalar la app)
    for ruta in libres:
        e, _, _ = pedir_firme(base + ruta)
        if e != 200:
            fallas.append(f"sin clave, {ruta} (libre) dio {e}")
    # 7. adentro de un cuadro: la sesión en la ruta. Sin una firma buena y vigente, sólo la puerta
    vence = int(time.time()) + 3600
    for falsa in (f"/__s/{vence}.{'0' * 64}", f"/__s/1.{'a' * 64}", "/__s/x", "/__s",
                  f"/__s/{int(time.time()) - 60}.{firma(clave, int(time.time()) - 60)}"):
        for v in (falsa + una, falsa + "/"):
            e, cab, cuerpo = pedir_firme(base + v)
            if not es_puerta(e, cuerpo):
                fallas.append(f"con la ruta inventada o vencida {v[:30]}… dio {e}")
    e, cab, cuerpo = pedir_firme(base + "/__entrar", "POST", formulario={"clave": "no-es-esta", "ruta": "1"},
                                 aceptar="application/json")
    if e != 401 or b"/__s/" in cuerpo or cab.get("Set-Cookie"):
        fallas.append(f"con una clave mala, en un cuadro dio {e}")
    prefijo, _ = entrar_en_ruta(base, clave)
    reserva, _ = entrar_en_ruta(base, clave, formulario=True)
    if not prefijo or not reserva:
        fallas.append("con la clave buena, en un cuadro no dio la ruta" + ("" if prefijo else " (JSON)") + ("" if reserva else " (formulario)"))
    else:
        for ruta, contenido in privados.items():
            e, cab, cuerpo = pedir_firme(base + prefijo + ruta)
            if contenido is None:
                if e in (0, 401) or e >= 500:
                    fallas.append(f"en un cuadro, {ruta} dio {e}")
                elif 300 <= e < 400 and not cab.get("Location", "").startswith(prefijo + "/"):
                    fallas.append(f"en un cuadro, {ruta} redirige fuera de la sesión: {cab.get('Location')}")
            elif e != 200 or cuerpo != contenido:
                fallas.append(f"en un cuadro, {ruta} dio {e} ({len(cuerpo)} bytes, esperaba {len(contenido)})")
            elif not enmarcable(cab):
                fallas.append(f"en un cuadro, {ruta} no se deja mostrar en un cuadro")
        adulterada = prefijo[:-1] + ("1" if prefijo[-1] == "0" else "0")
        e, _, cuerpo = pedir_firme(base + adulterada + una)
        if not es_puerta(e, cuerpo):
            fallas.append(f"con la ruta adulterada dio {e}")
        e, cab, _ = pedir_firme(base + prefijo)
        if e != 308 or cab.get("Location") != prefijo + "/":
            fallas.append(f"la ruta de la sesión sin la barra dio {e} → {cab.get('Location')}")
        for ruta in libres:
            e, _, _ = pedir_firme(base + prefijo + ruta)
            if e != 200:
                fallas.append(f"en un cuadro, {ruta} (libre) dio {e}")
    e, cab, _ = pedir_firme(base + una)
    if not enmarcable(cab):
        fallas.append("la puerta no se deja mostrar en un cuadro (X-Frame-Options o frame-ancestors)")
    if fallas:
        morir(f"la puerta de {base} no está bien:\n  " + "\n  ".join(fallas))
    log(f"{base}: sin clave no sale nada; con la clave sí, también en un cuadro ({len(privados)} rutas)")
    return cookie


def esperar(base, clave, pagina):
    """Hasta que la dirección muestre (con la clave) esta página: una subida tarda en verse."""
    fin = time.time() + ESPERA
    while time.time() < fin:
        cookie, _ = entrar(base, clave)
        if cookie:
            e, _, cuerpo = pedir(base + "/", cookie=cookie)
            if e == 200 and cuerpo == pagina:
                return
        time.sleep(5)
    morir(f"{base} no mostró la subida nueva en {ESPERA} s")


def kv_registro(cf, titulo):
    """El id del KV donde el worker guarda lo que cuenta la página (se crea si no existe)."""
    r = cf("GET", f"/accounts/{cf.cuenta}/storage/kv/namespaces?per_page=100")
    for n in r.get("result") or []:
        if n.get("title") == titulo:
            return n["id"]
    r = cf("POST", f"/accounts/{cf.cuenta}/storage/kv/namespaces", {"title": titulo})
    if not r.get("success"):
        morir(f"no se pudo crear el KV {titulo}: {r.get('errors')}")
    log(f"KV nuevo para el registro: {titulo}")
    return r["result"]["id"]


def preparar_proyecto(cf, nombre, clave, kv=None):
    r = cf.proyecto(nombre)
    if r.get("success"):
        p = r["result"]
        if p.get("source"):
            morir(f"el proyecto {nombre} está conectado a un repo: no lo piso")
        d = p.get("latest_deployment") or {}
        mensaje = ((d.get("deployment_trigger") or {}).get("metadata") or {}).get("commit_message") or ""
        if d and not mensaje.startswith("porteo:"):
            morir(f"el proyecto {nombre} ya existe y no lo subió un porteo: elegí otro nombre")
    else:
        r = cf("POST", f"/accounts/{cf.cuenta}/pages/projects", {"name": nombre, "production_branch": "main"})
        if not r.get("success"):
            morir(f"no se pudo crear el proyecto {nombre}: {r.get('errors')}")
        log(f"proyecto nuevo: {nombre}")
    conf = {"env_vars": {"CLAVE": {"type": "secret_text", "value": clave}}, "fail_open": False,
            "compatibility_date": COMPATIBILIDAD}
    if kv:
        conf["kv_namespaces"] = {"REGISTRO": {"namespace_id": kv}}
    r = cf("PATCH", f"/accounts/{cf.cuenta}/pages/projects/{nombre}",
           {"deployment_configs": {"production": conf, "preview": conf}})
    if not r.get("success"):
        morir(f"no se pudo configurar {nombre}: {r.get('errors')}")
    # se vuelve a leer: lo que importa es lo que quedó, no lo que se pidió. La lectura tarda unos
    # segundos en mostrar el cambio (a veces da el proyecto sin variables): se insiste un rato
    fin = time.time() + 60
    while True:
        p = cf.proyecto(nombre)["result"]
        faltas = []
        for entorno in ("production", "preview"):
            c = p["deployment_configs"][entorno]
            if c.get("fail_open") is not False:
                faltas.append(f"{entorno}: no quedó en fail closed")
            if ((c.get("env_vars") or {}).get("CLAVE") or {}).get("type") != "secret_text":
                faltas.append(f"{entorno}: no quedó el secreto CLAVE")
            if kv and ((c.get("kv_namespaces") or {}).get("REGISTRO") or {}).get("namespace_id") != kv:
                faltas.append(f"{entorno}: no quedó atado el KV del registro")
        if not faltas:
            break
        if time.time() > fin:
            morir("; ".join(faltas))
        time.sleep(5)
    log(f"{nombre}: secreto CLAVE puesto, fail closed")
    return p


def ultima_subida(cf, nombre):
    """La subida más nueva del proyecto, de producción o de vista previa."""
    r = cf("GET", f"/accounts/{cf.cuenta}/pages/projects/{nombre}/deployments?per_page=1")
    return (r.get("result") or [{}])[0] if r.get("success") else {}


def desplegar(cf, nombre, carpeta, mensaje, wrangler, rama="main"):
    """Sube la carpeta; rama "main" es producción, cualquier otra una vista previa con su dirección."""
    antes = ultima_subida(cf, nombre).get("id")
    env = dict(os.environ, CLOUDFLARE_API_TOKEN=cf.token, CLOUDFLARE_ACCOUNT_ID=cf.cuenta,
               WRANGLER_SEND_METRICS="false", CI="true")
    r = subprocess.run([wrangler, "pages", "deploy", str(carpeta), "--project-name", nombre, "--branch", rama,
                        "--commit-message", mensaje, "--commit-dirty=true"],
                       cwd=carpeta.parent, env=env, capture_output=True, text=True)
    if r.returncode:
        morir("wrangler falló:\n" + (r.stdout + r.stderr)[-3000:])
    # la API tarda en mostrar la subida nueva (como con la configuración): se insiste un rato antes
    # de darla por perdida
    fin = time.time() + 90
    while True:
        d = ultima_subida(cf, nombre)
        if d.get("id") and d["id"] != antes:
            break
        if time.time() > fin:
            morir("wrangler terminó pero no aparece la subida nueva:\n" + (r.stdout + r.stderr)[-2000:])
        time.sleep(5)
    log(f"subido ({mensaje}): {d['url']}")
    return d["url"].rstrip("/")


def con_puerta(destino):
    shutil.copyfile(AQUI / "_worker.js", destino / "_worker.js")
    (destino / "_routes.json").write_text(json.dumps(RUTAS), encoding="utf-8")


def armar(destino, carpeta):
    """La carpeta a subir: la del sitio (con enlaces duros, no ocupa lugar) más la puerta."""
    for f in sorted(carpeta.rglob("*")):
        rel = f.relative_to(carpeta)
        if rel.as_posix() in NO_SUBIR:
            continue
        d = destino / rel
        if f.is_dir():
            d.mkdir(parents=True, exist_ok=True)
            continue
        d.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(f, d)
        except OSError:
            shutil.copyfile(f, d)
    con_puerta(destino)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("carpeta", help="la salida de empaquetar.py --sitio")
    ap.add_argument("--proyecto", required=True, help="nombre del proyecto de Pages (se crea si no existe)")
    ap.add_argument("--clave", required=True, help="archivo con la clave (si no existe se inventa una); fuera de todo repo")
    ap.add_argument("--wrangler", default="wrangler")
    ap.add_argument("--verificar", action="store_true", help="no sube nada: sólo verifica la puerta del sitio ya subido")
    ap.add_argument("--registro-kv", metavar="TITULO", help="un KV de la cuenta (se crea si no existe) donde el worker guarda lo "
                    "que cuenta la página (empaquetar.py --registro __registro); se lee con registro.py")
    a = ap.parse_args()
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    cuenta = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
    if not token or not cuenta:
        morir("faltan CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID")
    carpeta = Path(a.carpeta)
    if not (carpeta / "index.html").is_file() or not (carpeta / "b").is_dir():
        morir(f"{carpeta} no parece la salida de empaquetar.py --sitio (falta index.html o b/)")
    clave = la_clave(a.clave)
    cf = Cloudflare(token, cuenta)

    bloques = sorted((carpeta / "b").iterdir(), key=lambda f: f.stat().st_size)
    reales = {"/": (carpeta / "index.html").read_bytes(), "/index.html": None,
              f"/b/{bloques[0].name}": bloques[0].read_bytes(), f"/b/{bloques[-1].name}": bloques[-1].read_bytes()}

    if a.verificar:
        r = cf.proyecto(a.proyecto)
        if not r.get("success"):
            morir(f"no existe el proyecto {a.proyecto}")
        verificar("https://" + r["result"]["subdomain"], clave, reales, LIBRES)
        return

    # 1. el proyecto, el secreto y fail closed, antes de subir nada
    p = preparar_proyecto(cf, a.proyecto, clave, kv_registro(cf, a.registro_kv) if a.registro_kv else None)
    base = "https://" + p["subdomain"]

    with tempfile.TemporaryDirectory(prefix="porteo-cf-") as tmp:
        tmp = Path(tmp)
        # 2. la prueba: la puerta con archivos de mentira
        prueba = tmp / "prueba"
        (prueba / "b").mkdir(parents=True)
        falsos = {"/": f"<!doctype html><title>prueba</title>porteo-prueba {secrets.token_hex(8)}\n".encode(),
                  "/index.html": None, "/b/prueba.bin": secrets.token_bytes(4096)}
        (prueba / "index.html").write_bytes(falsos["/"])
        (prueba / "b" / "prueba.bin").write_bytes(falsos["/b/prueba.bin"])
        (prueba / "sw.js").write_text("// prueba\n", encoding="utf-8")
        con_puerta(prueba)
        # como vista previa (su propia dirección, con el mismo secreto y fail closed): subida a
        # producción, mientras duraba la prueba el sitio de verdad no estaba (y quien entrara en ese
        # minuto se llevaba la página de prueba y su sw.js de mentira)
        url = desplegar(cf, a.proyecto, prueba, "porteo: prueba de la puerta (sin el juego)", a.wrangler, rama="prueba-puerta")
        # 3. verificarla
        esperar(url, clave, falsos["/"])
        verificar(url, clave, falsos, ["/sw.js"])

        # 4. la de verdad, y verificar otra vez
        real = tmp / "real"
        armar(real, carpeta)
        url = desplegar(cf, a.proyecto, real, "porteo: versión web", a.wrangler)
        for b in (url, base):
            esperar(b, clave, reales["/"])
            verificar(b, clave, reales, LIBRES)
    log(f"listo: {base}/  (la clave está en {Path(a.clave).resolve()})")


if __name__ == "__main__":
    main()
