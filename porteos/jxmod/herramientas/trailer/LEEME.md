# Tráiler de JXMod 3.0 (34 s)

Todo se renderiza con el juego mismo: el motor abre JXMod en Chromium y controla el tiempo cuadro por cuadro. La
captura toma solo el lienzo de WebGL, así que no sale nada de la interfaz. Encima del juego se agregan efectos propios:
la grieta del cielo, el mar de la playa, las estelas de fuego y la cámara de cine.

## Piezas

| Archivo | Qué hace |
|---|---|
| `cine_motor.js` | Se evalúa dentro del juego. Incluye: la cámara guionada con el ángulo de visión; el suavizado y el desenfoque de movimiento, que promedian 4 subcuadros corridos una fracción de píxel; los brazos con cinemática inversa; el cielo violeta y su luz; la grieta; las cosas que caen con fuego; las explosiones ajustadas; el mar; las estrellas; y los modelos sueltos, como la Physics Gun de mundo. |
| `cine.mjs`, `correr.mjs` | Abren el juego en Ultra con sombras de 4096 y, en cada plano, hacen un previo de 1 a 4,6 s para que se acomode la escena y se carguen las texturas. Después renderizan y mandan los JPEG a ffmpeg, que guarda `vid/<plano>.mp4` (1920×804, 24 cuadros por segundo). |
| `planos/p1…p9` | Un archivo por plano. Cada uno arma la escena (lugar, personaje, cielo, objetos) y define `CINE.escena(t)` con el tiempo del tráiler. |
| `playa_comun.js` | Arma el mar para la playa. Lo usan P8 y P9. |
| `carril.sh` | Renderiza varios planos seguidos. Se corren dos carriles en paralelo. |
| `logo_intro.py` | El logo JXM recortado (solo las letras, sin la placa), con destello cian y falla de señal (0 a 2,04 s). |
| `mezcla.py` | El sonido: la canción del video de 41 s (de 0 a 34 s), las voces y los efectos del juego. La música baja bajo las voces, el destello de la nuclear deja un silencio y el final es un corte seco. |
| `armar_final.py` | Une todo con gradación de color, grano (solo en el brillo), viñeta, barras de cine 2,39:1 y destellos. Con `alta` arma la versión 1080p (dos pasadas, unos 42 MB); con `discord` arma una de 720p de menos de 10 MB. |
| `verificar.py` | Mide el video armado: duración, cuadros, tamaño, negros o cuadros repetidos fuera de lugar, barras negras, destellos y golpes de sonido en su lugar, y recortes de audio. |
| `hoja.py` | Arma una hoja de contacto con las capturas de una carpeta, para revisar un plano de un vistazo. |

## Guion (sincronizado con los golpes de la canción)

| Tiempo | Plano |
|---|---|
| 0–2,04 | Logo. |
| 2,04–9,17 | Primera persona en el desierto. Se mira las manos, que tienen un brillo azul. «Otra vez no…». Un trueno lo hace mirar arriba y en 6,40 el cielo se raja. |
| 9,17–12,33 | Plano abierto: él, chiquito, bajo la grieta. La grieta le habla: «Te encontramos.». |
| 12,33–13,04 | Teleobjetivo: de la grieta salen cosas en llamas. |
| 13,04–13,50 | Negro, con el silencio de la canción. |
| 13,50–16,63 | La lluvia de cosas que explotan mientras él corre hacia la cámara. |
| 16,63–19,04 | Cámara al ras de la arena: cae un barril explosivo y revienta. |
| 19,04–23,38 | La nuclear: el hongo sube debajo de la grieta. |
| 23,38–26,63 | La corrida en teleobjetivo. |
| 26,63–30,88 | La playa: llega a la orilla. «Acá no llegan…». |
| 30,88–34,00 | Cámara baja a su espalda. Cae la Physics Gun, él se da vuelta y la ve. «Es mía.». Corte. |

## Cómo se vuelve a armar

1. Armar el juego (`armar.sh`) y servirlo por HTTP.
2. Extraer el audio del video de 41 s en `audio/cancion41.wav`.
3. Poner las voces en `voces/L1…L4.wav`.
4. Correr los renders en dos carriles a la vez (cada pieza es `plano:primer_cuadro:cuadro_final[:común]`, en cuadros del tráiler):
   - `JX_URL=http://127.0.0.1:8979/JX.html ./carril.sh p1_manos:49:220 p5_barril:399:457 p7_corre:561:639 p9_physgun:741:816:playa_comun.js`
   - `JX_URL=http://127.0.0.1:8979/JX.html ./carril.sh p2_grieta:220:296 p3_salen:296:313 p4_lluvia:324:399 p6_nuclear:457:561 p8_orilla:639:741:playa_comun.js`
5. Correr `python3 logo_intro.py`.
6. Correr la mezcla: `JX_SONIDOS=<paquete>/a python3 mezcla.py`.
7. Armar el video: `python3 armar_final.py alta` y `python3 armar_final.py discord`.
8. Revisarlo: `python3 verificar.py JXMod_trailer_3_0.mp4`.

En esta compu (sin placa de video, todo con el procesador) cada cuadro final tarda unos 6 s con dos carriles en
paralelo. El tráiler entero (756 cuadros de juego) tarda unos 40 minutos.
