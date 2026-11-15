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
| `instalar.py` | Pone las fotos en el paquete del juego (fuera del repo): `PAQUETE/fondos/` (menú) y `PAQUETE/carga/N_<nombre>.jpg` (el nombre es el de `FONDO_MAPA` en `juego/rbmenus.js`); guarda las anteriores en `PAQUETE/fondos_anterior/` y `PAQUETE/carga_anterior/`. La de la pizzería queda la que estaba. Con `--video`, los fondos animados (abajo). |
| `video.mjs` | Los fondos animados del menú: saca los cuadros de cada escena del menú que tiene `video` en `escenas.mjs` (abajo). |
| `bucle.py` | Arma el bucle de cada fondo animado (el empalme), lo mide y lo codifica en MP4 (H.264); deja también su primer cuadro como foto. |

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

## Fondos animados del menú (video.mjs y bucle.py)

Las 6 escenas del menú (`m*`) también van en video: detrás del menú clásico se ve la escena en movimiento (el juego las
reproduce con `juego/fondovideo.js`; la foto de cada una es el primer cuadro de su video). Cada escena tiene en `escenas.mjs`
un `video`: `{ L, cam: { lado, frente, alto, foco }, caidas: [[cosa, adelante, lado, salida, explosión]], corren: [[skin,
[adelante, lado] desde, [adelante, lado] hasta, salida, velocidad]] }`.

**El bucle sin que se note**: la escena es periódica, de L = 10 s (`foto_motor.js`, `FOTO.armarVideo` y `FOTO.videoPaso`):
- la cámara recorre una elipse chica (`lado` de costado, `frente` adelante y atrás, `alto` arriba y abajo al doble de ritmo)
  mirando siempre al mismo punto, a `foco` metros: lo de cerca se corre contra lo de lejos y la grieta, en el infinito, casi
  no se mueve;
- lo que cae sale de la grieta a su hora (`salida`, en segundos dentro de la vuelta) y cada lanzamiento hace latir la grieta;
  lo que explota se consume en la explosión; lo que no, queda en el piso hasta que vuelve a caer el mismo en la vuelta
  siguiente: en el golpe (con el polvo y el fuego) el de la vuelta anterior se saca. Para que el que se saca quede adentro del
  polvo, lo que cae rueda menos que en el juego (el envión y el giro al 35 %: queda a 0,4–1,4 m de donde pegó; el lavarropas
  de City, a 1,75 m) y lo que explota va lejos (más de 10 m) de lo que yace;
- el azar (las chispas, el humo, cómo gira lo que cae) tiene una semilla por paso según dónde cae en la vuelta: con una sola
  semilla por vuelta, una chispa de más que quedó de la anterior corría todos los números que venían después y la vuelta
  salía distinta (lo que yace, 25 cm corrido). Las pasadas de dibujo guardan y devuelven el estado del azar y el reloj;
- la gente que mira repite su reposo un número entero de veces por vuelta (el de GMod dura 5 s: 2 por vuelta); la que corre
  cruza la pantalla de un borde al otro por el piso (la animación del juego pisa sin patinar) y, fuera de cuadro, vuelve a
  empezar con la animación desde cero;
- nadie se lastima ni se rompe nada (las explosiones sólo empujan lo que cayó);
- las nubes y el cielo tienen un reloj propio que va y vuelve (el del juego más L/2π·sen(2πt/L)): en el medio van a la
  velocidad del juego, se frenan y vuelven, y a los L segundos el cielo es exactamente el del principio (con el reloj del
  juego, el cielo del cuadro 300 contra el del 0 daba 18 niveles de diferencia y el fundido se veía como un cielo doble; así,
  0,6 —lo que queda es el pulso de las vetas de la grieta—). La textura de las nubes se pinta entera en cada cuadro;
- el latido de la grieta en cada lanzamiento sube en 0,35 s (en el juego, de golpe: pasa cada 2 a 4 minutos; acá, cada 2 s,
  de golpe era un fogonazo de todo el cielo cada 2 s, 12 niveles de un cuadro al siguiente).

**Las nubes** (también en las fotos): la textura de las nubes (`cielos.js`) se pinta de a franjas entre cuadro y cuadro con
`requestAnimationFrame`, que el motor anula para manejar el tiempo: quedaban como se habían pintado al cargar el mapa, a la
hora de la carga y quietas (en las fotos de la 3.6, Ciudad, Desierto, City y Desert salieron sin nubes: la textura estaba
vacía; en el primer render de City de noche, nubes blancas de día). Ahora `FOTO.armar` la pinta entera con la hora de la
escena y `FOTO.paso` pinta la franja después de cada cuadro dibujado, como el juego.

Se calientan dos vueltas sin grabar (en la segunda, una pasada cada medio segundo para que el navegador ya tenga las texturas)
y se graban L + 1 s. Cada vuelta empieza igual que la anterior (`video.mjs` guarda la «huella» de cada una: dónde yace cada
cosa y cuántas partículas hay; las 6 escenas dan la vuelta 2 y la 3 idénticas). Lo que no es periódico por sí solo —el pulso
que corre por las vetas de la grieta, que va con el reloj del juego a frecuencias que no entran en 10 s— lo empalma `bucle.py`:
los primeros cuadros del bucle son el final de la vuelta fundido con su principio, de a poco, durante 1 s.

**Cada cuadro**: 4 pasadas (`--n 4 --t 4`): 4 instantes en medio cuadro (lo rápido queda corrido, como con el obturador de una
cámara) cada uno corrido una fracción de píxel distinta (puntos de Halton), promediadas en números con coma.

### Cómo se vuelven a sacar

1. Armar el juego y servirlo por HTTP (cualquier armado: lo que dibuja es el juego).
2. `node video.mjs http://127.0.0.1:PUERTO/index.html CARPETA [--solo m1_,m3_]` (con `--W 640 --H 360 --n 1 --t 1`, para
   probar escenas rápido). En esta compu (sin placa de video y compartida) cada cuadro tardó unos 9 s con 3 a la vez: las 6
   escenas, en 3 tandas de 2 en paralelo, unas 2 horas.
3. `python3 -I bucle.py CARPETA m1_FlatGrass` (y cada una): el bucle, lo medido (diferencia entre cuadros seguidos, del último
   al primero, lo que no se repite solo) y `m1_FlatGrass.mp4`, `m1_FlatGrass_foto.png` (su primer cuadro ya decodificado).
4. `python3 -I instalar.py --video CARPETA PAQUETE` y volver a armar el juego: los videos van al lado del juego en
   `fondos/` (no adentro del HTML) y las fotos adentro, como siempre.
5. `node pruebas/fondos_video.mjs URL_HTML` y `node pruebas/fondos_30.mjs URL_HTML`.
