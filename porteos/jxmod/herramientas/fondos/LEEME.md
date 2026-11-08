# Fotos de fondo (menú principal y pantalla de carga) — evento 3.0

Las fotos de fondo se sacan del juego mismo, en Ultra, sin interfaz ni arma en la mano (salvo las de primera persona,
que muestran la Physics Gun). En los mapas del juego se ve el evento 3.0: la grieta en el cielo y cosas que salen de
ella prendidas fuego (la estela, el humo, una explosión o algo ardiendo en el piso). gm_construct y gm_flatgrass van con
el cielo celeste de GMod y sin grieta, como en el juego.

| Archivo | Qué hace |
|---|---|
| `foto_motor.js` | Se evalúa dentro del juego. Maneja el tiempo (sin `requestAnimationFrame`: avanza de a 1/60 s sin dibujar hasta el instante de la foto), arma la escena (`FOTO.armar`), saca la foto con 8 pasadas corridas una fracción de píxel (puntos de Halton) promediadas para suavizar los bordes (`FOTO.foto`) y mide qué quedó en el cuadro (`FOTO.medir`: dónde está la grieta y cada cosa que cae, de qué tamaño, dónde está el sol). |
| `escenas.mjs` | Las 18 escenas: 6 del menú (`m*`, lo importante a la derecha porque el menú tapa el tercio izquierdo) y 12 de la pantalla de carga (`c*`, una por mapa; arriba van el título y el consejo). Cada una: mapa, hora (el sol detrás o al costado de la cámara), dónde va la grieta en la pantalla, props, gente (parada mirando la grieta o corriendo) y lo que cae, con la fracción de su vuelo en el instante de la foto (más de 1: ya cayó). Todo con semilla: la misma escena sale igual cada vez. |
| `fondos.mjs` | Abre el juego en Chromium, carga cada mapa, arma la escena y guarda `<nombre>.png` (1280×720) y `<nombre>.json` (lo medido). |
| `instalar.py` | Pone las fotos en el paquete del juego (fuera del repo): `PAQUETE/fondos/` (menú) y `PAQUETE/carga/N_<nombre>.jpg` (el nombre es el de `FONDO_MAPA` en `juego/rbmenus.js`); guarda las anteriores en `PAQUETE/fondos_anterior/` y `PAQUETE/carga_anterior/`. La de la pizzería queda la que estaba. |

Lo que cae sale de la grieta: desde un punto en su dirección a 1,7 veces la distancia a la que cae, con el tiempo de
caer esa altura, así cruza el cielo en diagonal con la estela a la vista (si sale del fondo de la grieta, por la
perspectiva queda pegado a ella casi todo el vuelo). Para las fotos las partículas van más juntas (`GFX.part` 3,5).

Qué se ve de cada foto: en la compu (16:9), toda. En un celular de 20:9 se recorta un quinto del alto: el menú la
centra (con zoom lento hasta 1,13) y la pantalla de carga la encuadra al 35 % del alto (zoom hasta 1,06), así que en la
de carga se ve del 9 al 85 % de la foto en el peor momento. Por eso la grieta va entre el 18 y el 30 % del alto y lo
del piso arriba del 80 %; `medir.py` revisa las 18 con esas zonas.

## Cómo se vuelven a sacar

1. Armar el juego y servirlo por HTTP (`python3 -m http.server`).
2. `node fondos.mjs http://127.0.0.1:PUERTO/JX.html CARPETA [--solo m1_,c4_] [--n 8]` (con `--n 1`, una pasada: para
   probar encuadres rápido). En esta compu (sin placa de video) cada foto tarda 10–30 s más lo que tarda en cargar su mapa.
3. `python3 -I instalar.py CARPETA PAQUETE` y volver a armar el juego (las fotos van adentro del HTML en WebP).
4. `node pruebas/fondos_30.mjs URL_HTML`: que estén las 6 del menú y las 13 de carga, cada mapa con la suya, su nombre
   («map: gm_construct») y la versión en la pantalla de carga.
