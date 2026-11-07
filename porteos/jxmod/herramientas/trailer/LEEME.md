# Tráiler de JXMod 3.0 (40 s, 4:3 en FHD: 1440×1080)

Todo se renderiza con el juego mismo: el motor abre JXMod en Chromium y controla el tiempo cuadro por cuadro. La
captura toma solo el lienzo de WebGL, así que no sale nada de la interfaz. Encima del juego se agregan efectos propios:
la grieta del cielo, la nuclear volumétrica, el mar de la playa, las estelas de fuego, el meteoro de la Physics Gun y
la cámara de cine. El protagonista es el soldado de fuerzas especiales (SpecialForcesM) y todo lo que hace con el
cuerpo (correr, caminar, quedarse parado, agacharse, darse vuelta, agarrar el arma) es captura de movimiento real de
la biblioteca de CMU que ya trae el juego.

Va en 4:3 a cuadro completo. Cada plano se renderiza directamente en 1440×1080 (no se recorta de un panorámico) y
define cuánto se abre el ángulo de visión para ese formato con `C.aspK`. Con 1,343 (= 1080/804), cada píxel ve lo
mismo que en el panorámico 2,39:1 de 1920×804: el cuadro 4:3 es la franja del medio de ese panorámico, más alta,
y muestra más cielo con la grieta y más piso. El plano 1 (primera persona) usa 1,15 para que las manos se vean más
grandes y no asome el cuerpo abajo. En un lienzo panorámico, `C.aspK` no cambia nada.

## Piezas

| Archivo | Qué hace |
|---|---|
| `cine_motor.js` | Se evalúa dentro del juego. La cámara guionada (y su ajuste por formato, `C.aspK`); la sombra del propio cuerpo apagada en primera persona; el jugador ubicado en el instante exacto de cada subcuadro (`C.suaveJug`); el suavizado y el desenfoque de movimiento (4 subcuadros); la captura de movimiento (`C.locomocion`: el cuerpo avanza lo que el pie apoyado se va para atrás, así los pies no patinan; fundido entre clips que compensa el rumbo de la cadera de cada uno; `C.poseHuesos` para saber dónde queda una mano en un instante); los brazos con cinemática inversa; el cielo violeta y su luz; la grieta; las cosas que caen con fuego; el mar; las estrellas; los modelos sueltos (la Physics Gun de mundo) y **la nuclear**: un volumen con marcha de rayos en una pasada de pantalla completa (bola de fuego, toro que rueda con un domo encima, tallo, falda de polvo; ruido 3D de 64³ repetible; luz de la grieta con sombra, luz del cielo y del suelo, el fuego de adentro que brilla y alumbra el humo; escribe la profundidad de donde entra el rayo, así lo de adelante lo tapa). |
| `cine.mjs`, `correr.mjs` | Abren el juego en Ultra con sombras de 4096 y el personaje pedido (`--skin`, por defecto SpecialForcesM), bajan los clips de captura de movimiento que nombra el plano (`'c:NN_NN'`) y, en cada plano, hacen un previo de 1 a 4,6 s para que se acomode la escena. Después renderizan y mandan los JPEG a ffmpeg (`<carpeta>/<plano>.mp4`, 1440×1080, 24 cuadros por segundo). Con `--muestras` dejan además un JPEG cada 12 cuadros. |
| `planos/p1…p8`, `planos/p9_final.js` | Un archivo por plano. Cada uno arma la escena (lugar, personaje, cielo, objetos) y define `CINE.escena(t)` con el tiempo del tráiler. |
| `playa_comun.js` | Arma el mar para la playa. Lo usan P8 y P9. |
| `carril.sh` | Renderiza varios planos seguidos, en 1440×1080 si no se le dice otra cosa (`W`, `H` y la carpeta `SAL`). Se corren dos o tres carriles en paralelo. |
| `logo_intro.py` | El logo JXM recortado (solo las letras, sin la placa), con destello cian y falla de señal (0 a 2,04 s). |
| `placa_final.py`, `placa/texto.mjs` | La placa del final (37,5 a 40 s): el logo, «BETA LANZADA» y «JXMOD 3.0» con la tipografía del juego (Oswald, que `texto.mjs` pasa a PNG con Chromium), entran de golpe en el golpe de la canción con destello y falla de señal, respiran, los cruza un brillo y se rompen en tiras a negro. |
| `mezcla.py` | El sonido, sin voces: la canción del video de 41 s hasta su final natural, efectos del juego y sintéticos (la onda expansiva, el chillido del meteoro, el golpe en la arena, el zumbido del arma que crece hasta el corte a negro, el dron de suspenso, el golpe de la placa). Necesita `JX_SONIDOS` (la carpeta `a/` del paquete armado del juego). |
| `armar_final.py` | Une todo (960 cuadros, 40,0 s) con la gradación de cine en cada plano del juego: resplandor cálido en las luces fuertes, curva de contraste con las luces suaves, sombras frías y luces cálidas, vibrancia, un píxel de aberración cromática, destellos donde van, viñeta y grano (solo en el brillo). Dos pasadas a 9 Mb/s. |
| `verificar.py` | Mide el video armado: duración, cuadros, tamaño, negros o cuadros repetidos fuera de lugar, destellos y golpes de sonido en su lugar, y recortes de audio. |
| `hoja.py` | Arma una hoja de contacto con las capturas de una carpeta. |
| `mocap/` | Para elegir y ajustar la captura de movimiento: `ver.sh` (fotos de varios clips con el personaje), `leer.py` (lee los clips y mide la cadera), `medir.mjs` (velocidad real de un clip), `patinar.mjs` (cuánto patinan los pies) y `manos.mjs` (lo más bajo que llegan las manos). |

## Guion (sincronizado con los golpes de la canción)

| Tiempo | Plano |
|---|---|
| 0–2,04 | Logo. |
| 2,04–9,17 | Primera persona en el desierto. Se mira las manos, que tienen un brillo azul. Un trueno lo hace mirar arriba y en 6,40 el cielo se raja. |
| 9,17–12,33 | Plano abierto: él, chiquito, bajo la grieta. |
| 12,33–13,04 | Teleobjetivo: de la grieta salen cosas en llamas. |
| 13,04–13,50 | Negro, con el silencio de la canción. |
| 13,50–16,63 | La lluvia de cosas que explotan mientras él corre hacia la cámara (corrida real, CMU 127_07). |
| 16,63–19,04 | Cámara al ras de la arena: cae un barril explosivo y revienta. |
| 19,04–23,38 | La nuclear: la bola de fuego nace en el piso, sube y se abre en el hongo; la onda expansiva le llega (20,92) con una ráfaga de arena. |
| 23,38–26,63 | La corrida en teleobjetivo, con el hongo detrás. |
| 26,63–30,88 | La playa: llega caminando, encorvado y cansado (CMU 105_26), y se queda mirando el mar (CMU 111_28). |
| 30,88–34,00 | Cámara baja a su espalda. Desde el sol baja la Physics Gun como un meteoro azul, le pasa al lado de la cabeza (se agacha, CMU 77_09) y se estrella en la arena entre él y la cámara (31,45). Se levanta y se da vuelta (CMU 69_16). |
| 34,00–36,92 | Cámara baja al lado del arma, clavada de punta en la arena: él se agacha y estira la mano (CMU 26_09, en cámara lenta) hasta la cola del arma; cuando la toca, el arma se enciende. Corte a negro. |
| 36,92–37,50 | Negro y silencio. |
| 37,50–40,00 | En el golpe de la canción: JXM, «BETA LANZADA», «JXMOD 3.0». Se rompe a negro. |

## Cómo se vuelve a armar

1. Armar el juego (`armar.sh`) y servirlo por HTTP.
2. Extraer el audio del video de 41 s en `audio/cancion41.wav`.
3. Correr los renders en tres carriles a la vez (cada pieza es `plano:primer_cuadro:cuadro_final[:común]`, en cuadros del tráiler):
   - `SAL=vid2 JX_URL=http://127.0.0.1:8979/JX.html ./carril.sh p1_manos:49:220 p8_orilla:639:741:playa_comun.js p9_final:741:886:playa_comun.js`
   - `SAL=vid2 JX_URL=http://127.0.0.1:8978/JX.html ./carril.sh p2_grieta:220:296 p4_lluvia:324:399 p6_nuclear:457:561`
   - `SAL=vid2 JX_URL=http://127.0.0.1:8977/JX.html ./carril.sh p5_barril:399:457 p7_corre:561:639`
   - P3 (sin personaje) y el logo van en `vid43/`: `SAL=vid43 ./carril.sh p3_salen:296:313` y `python3 logo_intro.py`.
4. Correr `node placa/texto.mjs` y `python3 placa_final.py`.
5. Correr la mezcla: `JX_SONIDOS=<paquete>/a python3 mezcla.py`.
6. Armar el video: `python3 armar_final.py`.
7. Revisarlo: `python3 verificar.py JXMod_trailer_3_0.mp4`.

En esta compu (sin placa de video, todo lo dibuja el procesador) cada cuadro de 1440×1080 tarda de 9 a 15 s con tres
carriles en paralelo; los planos con la nuclear, algo más.
