# Versión web privada en Cloudflare Pages

Para el dueño de un porteo que quiere jugarlo desde una dirección propia sin que quede a la vista
de nadie más. La versión web (`empaquetar.py --sitio`) se sube a **su** cuenta de Cloudflare con
una puerta delante: sin la clave no sale ni la página ni un byte del juego.

```sh
export CLOUDFLARE_API_TOKEN=…   # de la cuenta, con "Cloudflare Pages: Edit"
export CLOUDFLARE_ACCOUNT_ID=…
python3 subir.py CARPETA --proyecto NOMBRE --clave ~/claves/NOMBRE.txt --wrangler RUTA/A/wrangler
python3 subir.py CARPETA --proyecto NOMBRE --clave ~/claves/NOMBRE.txt --verificar   # sólo mira
```

- `_worker.js` es la puerta (el "modo avanzado" de Pages: atiende todos los pedidos antes que los
  archivos). Muestra una página para poner la clave; con la clave buena deja una cookie firmada que
  dura un año, así el juego instalado arranca sin red y no la vuelve a pedir. También entra con un
  enlace `https://…/#clave=XXXX-XXXX-XXXX-XXXX` (lo de después del `#` no viaja al servidor).
- La clave: si el archivo de `--clave` no existe, se inventa una al azar (16 letras y números, ~79
  bits) y se guarda ahí. Va al proyecto como secreto `CLAVE`; nunca al repo ni a lo que se sube.
  Cambiarla (borrar el archivo y volver a subir) cierra todas las sesiones.
- `subir.py` pone el proyecto en **fail closed**: en el plan gratis, si un día se pasan los 100.000
  pedidos, Pages por defecto sirve los archivos sin pasar por el worker. Cerrado, da un error hasta
  el día siguiente.
- Antes de subir el juego sube una prueba sin el juego y verifica desde afuera (en la dirección del
  proyecto y en la de la subida) que sin la clave no sale nada, ni con rutas disfrazadas ni con
  cookies inventadas o adulteradas; después de subirlo, lo mismo con la página y bloques reales.
- Pasan sin clave sólo `sw.js`, el manifest y los íconos (el navegador los puede pedir sin cookies
  para instalar la app; no tienen nada del juego).
- **Adentro de otra página** (Rezona y los visores de HTML del teléfono muestran el archivo en un
  cuadro; el lanzador abre ahí el juego en un cuadro propio) la cookie no sirve: no viaja a un
  cuadro de otro sitio, y el WebView de Android ni la guarda. Ahí la puerta entra con un `fetch` y
  la sesión va en la ruta, `/__s/<vence>.<firma>/` (la misma firma que la cookie): como todo lo de la
  página es relativo, cuelga solo de esa ruta. Por eso la puerta no manda `X-Frame-Options` (con eso
  Rezona mostraba `ERR_BLOCKED_BY_RESPONSE`): sin la clave, en un cuadro también se ve sólo la
  puerta. `subir.py` verifica también esto (rutas inventadas, vencidas o adulteradas no entran).

## Descargas (el APK, el HTML único)

Pages no sirve archivos de más de 25 MiB. `descargas.py` parte los archivos grandes en pedazos de
20 MB dentro del sitio (`descargas/`, detrás de la misma puerta) con una página que los baja, los une
en el teléfono, comprueba el SHA-256 y los guarda con su nombre: el APK se baja con un toque.

```sh
python3 -I descargas.py SITIO juego.apk juego.html --titulo "Mi juego"   # antes de subir.py
```

## Qué le pasa al teléfono de otro

La página puede contar lo que pasa (`empaquetar.py --registro __registro`, ver
`herramientas/porteo/registro.js`): qué teléfono y navegador, si hay WebGL 2, qué GPU, hasta dónde
llegó la carga y los errores. El worker lo recibe en `/__registro` (sólo con sesión) y lo guarda en
un KV de la cuenta si se sube con `--registro-kv TITULO` (14 días). Para leerlo:

```sh
python3 registro.py TITULO [--horas 24]
```

También sale en `wrangler pages deployment tail`, pero ahí, con muchos pedidos juntos (la carga de
los bloques), Cloudflare se saltea algunos.

Si la cuenta tiene Cloudflare Access (Zero Trust) activado, es una alternativa igual de buena: entrar
con el mail en vez de una clave. Hay que activarlo a mano en el panel.
