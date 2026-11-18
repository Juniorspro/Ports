# Catálogo de efectos de los cortos (TikTok, 9:16)

Lo que se usó en cada corto, cómo se hace y dónde está, para reusarlo. Los cortos se graban con `trailer.mjs`. Cada
uno es un módulo de escenas (`corto_*.mjs`) que exporta `FPS`, `ESCENAS` y `CSS`. El montaje (voz, música, efectos,
plantillas) se hace con ffmpeg en scripts aparte.

Cortos hasta ahora:

| Corto | Módulo |
|---|---|
| «Lo tomé literal» | `corto_literal.mjs` |
| «POV: le diste admin a tu amigo» | `corto_admin.mjs` |
| La heladera y la pelota | `corto_heladera.mjs` |
| Chocar a 100 = caer 13 pisos | `corto_choque.mjs` |
| «La venganza de Pepe» (analog horror, 4:3, 2:30) | `corto_pepe.mjs` (+ `montaje/pepe_cuadros.py`, `montaje/pepe_sonido.py`) |

## Cómo se graba

```
ESC=pruebas/corto_X.mjs VW=540 VH=960 DPR=2 RES=100 node pruebas/trailer.mjs URL CARPETA [escenas] [cada]
```

- **Salida:** 1080×1920, un cuadro por paso del juego (el reloj del juego avanza 1/30 s por cuadro, no en tiempo
  real). Cuesta 1,1 a 1,8 s por cuadro en swiftshader.
- **Tandas:** se graba por escenas, en tandas de menos de 10 min.
- **Prueba rápida:** `VW=270 VH=480 DPR=1` y `cada` = 2 o 3.
- **`DESDE` / `HASTA`:** sólo se guardan los cuadros de esa parte, pero la escena corre entera (igual física).
- **Toma limpia** (para la pantalla dividida o la miniatura): un módulo que reexporta las escenas con
  `#trOver{display:none}` y `#hud{display:none}`.
- **Escena:**
  - `t0` y `t1` (segundos del video); `mapa`; `espera` (ms reales después de `preparar`); `antes` (cuadros que corren
    sin grabarse).
  - `preparar` (antes de la espera) y `listo` (después de la espera).
  - `cada`, `cam` y `titulos`, en cada cuadro.
  - `ritmo`: velocidad del juego en ese cuadro (cámara lenta, congelado).
- **Trampas conocidas:**
  - En `cada` no declarar `const i` ni hacer `return`.
  - Los números dentro de un texto anidado en `${CINE('…')}` no se interpolan: van escritos.
  - Contra una pared, el piso se mide con `CO.Pw` (2 m adelante): `CO.P` pega en el techo del edificio.
  - `P.escena` de un NPC es un objeto de los emotes de a dos: con `true` el NPC deja de dibujarse.

## Cámara

| Efecto | Cómo | Corto |
|---|---|---|
| Cámara fija de cine | `CINE(p, mira, giro)` → `DBG.cam`; `DBG.sinVista` saca el arma de la vista | todos |
| Zoom de vértigo (dolly zoom) | `DBG.fov = 2·atan(ancho/2 / d)` mientras la cámara se aleja (d de 7 a 22 m): el auto queda del mismo tamaño y el fondo se estira | choque 2,9–5,6 |
| Grúa | la cámara sube a la par del auto colgado (39 m) | choque 17,4–20 |
| Cámara que cae con el objeto | altura = la del auto + 1,3 m hasta el piso | choque 20–23,4 |
| Cámara que acompaña | posición fija en x, z que sigue al auto, hasta un punto de corte | choque (pared, Pepe) |
| Cámara que persigue un muñeco de trapo | sigue la cadera (`rag.cuerpos.get(Hips)`) con retraso (lerp 0,07–0,14) | choque (final de Pepe) |
| Giro alrededor | `sin(k)` en x y avance en z después del golpe | choque (caída) |
| Repetición | la misma escena desde otro ángulo (arriba de la pared) a 0,33 de velocidad, con «● REPETICIÓN» que titila | choque 13,8–17,4 |
| Cámara lenta / congelado | `ritmo`: 0,25–0,33 en el golpe; 0,004 = cuadro congelado 0,6 s | heladera, choque |
| Temblor | `TRH.temblor(t, t0, fuerza)` en la posición de la cámara | todos |
| Golpe en el cuadro | `CO.lienzo(escala, giro, dx, dy)`: transform CSS del canvas (zoom + sacudón) | todos |
| Tercera persona del jugador | `JUG.tercera = true` + `DBG.cam`: el que explica se ve entero, con la palanca | heladera, choque |
| Primera persona | la cámara del jugador, con `DBG.fovVista` para el arma | literal v2 |

## Texto

| Efecto | Cómo | Corto |
|---|---|---|
| Subtítulos de a una palabra | `CO.cap(t)`: blancos con borde negro, cada palabra entra con un rebote; tiempos por sílabas de la frase (`PAL`) y emoji por palabra (`ESP`) | todos |
| Texto pintado en el mundo | `CO.texto3D(id, html, 4 puntos, t0, t1, 'pintado')`: homografía (eliminación de Gauss) → `matrix3d`; en paredes («100 KM/H», «USÁ EL CINTURÓN») y en el piso («¿EXAGERADO?») | choque |
| Cartel parado en el aire | `texto3D` con `ey = arriba`, de frente a la cámara (ojo: si `ex` apunta al revés sale espejado) | choque (100 KM/H 💥) |
| Regla de pisos | `CO.regla`: SVG con una marca por piso proyectada al mundo (`clipDe`) y el número; el último en rojo | choque |
| Velocímetro | `CO.velocimetro`: SVG con aguja que lee la velocidad real del cuerpo; después de soltar muestra la máxima (si no, baja a 9 un cuadro en el golpe) | choque |
| Chat del juego | `CO.chat`: las últimas 4 líneas, 7,5 s cada una, con «ding» de Discord en el montaje | todos |
| Avisos de muerte (killfeed) | `CO.kill`: «🧱 Pared ➜ 💀 Pepe» arriba a la derecha | admin, choque |
| Globo de un NPC | `npcDecir(P, 'estoy bien 👍')` (en el `#hud`) | choque |
| Sticker que rebota | `CO.sticker` (también la tarjeta final «PEPE VOLVERÁ 💀» y «+ Seguir») | todos |
| Texto de arriba fijo | `CO.top()` («ESTO TE PUEDE SALVAR LA VIDA 🚗») | heladera, choque |

## Composición (en el montaje)

| Efecto | Cómo | Corto |
|---|---|---|
| Plantillas de pantalla verde | `chromakey=0x05BA06:0.13:0.07`, recortadas de la cabeza a donde termina el cuerpo (medido: la última fila que no es verde) y apoyadas en el borde de abajo | admin, choque |
| El de la tarjeta detrás de una mesa del juego | PNG con alfa por cuadro (numpy, `tarjeta_png.py`): sin el verde, la cabeza reconstruida, color ajustado, la sombra aparte; la mesa del juego tapa la parte de abajo | heladera |
| Pantalla dividida | `dividir6.mjs`: Chromium compone dos tomas limpias (pared arriba, caída abajo) con la línea blanca, etiquetas, el «=» que salta, destello y temblor; los dos golpes sincronizados (fuente = golpe + (t − 28,9)·0,55) | choque 27,5–31,5 |
| Rebobinado VHS | `vhs6.py`: los cuadros del golpe al revés y al doble, colores corridos, franjas desplazadas, barra de tracking, líneas de barrido, ruido y «◀◀ REBOBINANDO» | choque 2,6–2,9 |
| Aberración en los golpes | `rgbashift=rh=-9:bh=9` 0,22 s en cada golpe | todos |
| Temblor del cuadro entero | `crop` con x, y que oscilan y se apagan | heladera |
| Desenfoque de movimiento | `tmix`, sólo dentro de un movimiento continuo (nunca a través de un corte) | literal |

## Juego (lo que el motor ya hace y luce en video)

- **Destrucción de autos** (`destruccion.js`):
  - abolladuras reales, chispas, vidrios y pedazos;
  - ruedas que se sueltan y ruedan;
  - humo con menos del 60 % de vida y fuego con menos del 25 %;
  - el auto que explota, se infla y arde.
  - Para un auto «ya chocado» en una escena: `desAbollar(o, trompa, adentro, 0,46, 1,4)` y `o.veh.vida` (130 humea,
    70 arde).
- **Explosiones:** destello, onda, bola de fuego, columna de humo, escombros, brasas, quemadura y fuego en el piso.
- **Muñeco de trapo:** `npcTumbar(P, velocidad)`. Con `P.ia.ragT = 1e9` no se levanta. `CO.seguirRag(P)` lleva
  `P.pos` a la cadera; si no, lejos de donde apareció no se dibuja.
- **NPC llevado por un auto:** cada cuadro, `P.pos` en el techo medido en la malla (`vehCols(V).cortes(x, z)`) y la
  cápsula sin choques (`npcB.noPhys`). Corre en el lugar: queda gracioso.
- **Velocidad de verdad:** `o.b.damp = -0.02` saca el roce del aire. Así, 39,33 m de caída dan 99,47 km/h.

## Sonido

- **Voz:** Loquendo «Jorge» (athanshock), una línea por archivo. Las pausas se miden con `silencedetect` para cortar
  una línea en dos.
- **Música:** Kevin MacLeod (incompetech):
  - «Local Forecast – Elevator»: el dato;
  - «Fluffing a Duck»: Pepe;
  - «Monkeys Spinning Monkeys»: admin;
  - «Sneaky Snitch»: heladera.
  - Siempre con `sidechaincompress` bajo la voz y cortes en los momentos de suspenso.
- **Choques del juego:** `son6/` (sacados con `son_juego.mjs` del mismo `desSonido` del juego): fuerte, golpe y
  vidrio, 3 variantes. En cámara lenta, con `asetrate` más grave.
- **Memes (MyInstants):**
  - de golpe: vine boom (y bass boost), metal pipe, bonk;
  - de paso: fast whoosh y transition whoosh (al revés para el rebobinado), record scratch;
  - reacciones: the rock eyebrow, auuugh, sad violin;
  - avisos: anime pop, iPhone ding, Discord notification, cash register;
  - otros: crickets, oh no no no, Windows XP error.
- **Final:** `alimiter` + `loudnorm I=-14 TP=-1.5`.

## Plantillas de pantalla verde (`memes_gs/`, 576×1024)

| Plantilla | Qué es | Dónde termina el cuerpo | Corto |
|---|---|---|---|
| `tarjeta` | El que golpea la mesa con la tarjeta | — | admin, heladera |
| `seguro` | «¿Seguro?», el de remera que inclina la cabeza | 932 | choque |
| `chocado` | Sorprendido, remera «JUST SAY YES» | 816 | choque |
| `enserio` | Con auriculares, «¿en serio?» | 878 | choque |
| `bean` | — | — | admin |
| `como` | — | — | sin usar |
| `gira` | — | — | sin usar |
| `tunegocio` | — | — | sin usar |
| `tanbueno` | — | — | sin usar |
| `nopuedomas` | — | — | sin usar |
| `laptop` | — | — | sin usar |

## Miniaturas

`mini.cjs` saca la captura en Chromium de un HTML de 1080×1920: tomas limpias + texto blanco con borde negro +
elementos (círculo rojo, flecha, «=»).

## Pepe

A Pepe siempre le pasa algo al final (se repite en todos los videos):

- **Choque:** va corriendo arriba del techo del auto a 100 y se estampa contra la pared.
- **Final del choque:** «estoy bien 👍», explota el auto y lo vuela (cierra con «PEPE VOLVERÁ 💀»).
- **La venganza de Pepe:** Pepe vuelve (1.047 muertes) y se venga del que filma; al final le cae la heladera otra vez
  («PRUEBA Nº 1.049») y aparece otro Pepe atrás. Cierra con «TE TOCA».
- **La venganza de Pepe 2 (cinta 3):** en la «Lección 7: todos vuelven» lo atropella un auto de costado; tres
  segundos después está parado otra vez en el mismo lugar.

## Analog horror (4:3, «La venganza de Pepe»)

### Cómo se grabó
```
ESC=pruebas/corto_pepe.mjs VW=720 VH=540 DPR=1 RES=100 node pruebas/trailer.mjs URL CARPETA escena
```
- **El VHS es el del mod Viewfinder** (Found Footage & Camcorder SWEP, Workshop 3780178294), montado dentro de la
  escena (`gmInstalar`) y con la cámara en la mano. Ajustes por consola (`vfCmd`, Lua del cliente):
  - `ffcam_vhs_aspect 2`: 4:3;
  - `ffcam_vhs_format 1`: VHS gastado;
  - `ffcam_vhs_signal_profile 2`: el shader compatible (0,8 s por cuadro contra 4,5 s del de alta fidelidad, y casi
    igual en cinta);
  - `ffcam_osd_font 2`: VCR OSD Mono;
  - la fecha propia (18.11.1998 03:12) con `ffcam_vhs_osd_realtime 0`;
  - `ffcam_tape_damage` de 0,3 a 1 según el miedo.
- **Visión nocturna y lámpara:** `FFCam.SetNightVision(true, true)` y `FFCam.SetLampMode(0/1/2)` se mandan con la
  cámara ya en la mano (en la previa y al empezar a grabar); antes no hacen nada. Para ver lejos:
  `ffcam_lamp_range 2.6` y `ffcam_nv_brightness 1.05`.
- **Zoom de verdad:** el gatillo (`ENT.disparo`) mueve el zoom del mod; el motor aplica el `view.fov` de su
  `CalcView` (arreglado para esto). El indicador «x1.0 … x5.0» sale en el OSD.
- **Títulos, contador, alerta, «PLAY»:** van dibujados dentro del OSD del mod (`FFCam.DrawViewfinder` envuelto), así
  pasan por la cinta como el REC. Son operaciones `r` (rectángulo) y `t` (texto) en fracciones del cuadro (`TX`).
  Las placas a pantalla llena ponen la cámara mirando el pasto de cerca (cuesta poco dibujar).
- **Pintado en la pared:** `cam.Start3D2D` en `PostDrawOpaqueRenderables` («1.047», «PEPE SIEMPRE VUELVE»). Va
  arriba de las puertas: el humo negro del auto lo tapa en visión nocturna.
- **Velocidad:** de noche, ~2 s por cuadro con tres navegadores a la vez (0,43 s por cuadro efectivo). Por eso las
  tomas son de ≤ 7,6 s y los cortes entre tomas se tapan con desgarros de cinta. Los NPC tardan ~1,5 s en
  materializarse (salen blancos): previa de 75 cuadros o tapar los primeros.
- **Pepe:** su posición es la cadera (0,95 m sobre el piso), así que la cara está a cadera + 0,66 m. Se fija en x, z
  cada cuadro (`CO.fijo`), así la IA no lo mueve. Las caras de cerca se iluminan con `luzTemporal` (el infrarrojo
  sale adelante del lente).

### Efectos de imagen (`montaje/pepe_cuadros.py`)
- **Pepe deformado en 3D** (`CO.deformar(P, k)`, en el juego, con la luz y la cinta de la escena): en `poseExtra`,
  después de la animación, el cuello ×(1 + 1,45k) de alto y más fino, la cabeza ×(1 + 0,85k) de alto y más angosta,
  torcida de costado (eje X local del hueso `Head`; el Z la tira para atrás) y con un temblor. El modelo no tiene
  mandíbula: la boca se hace en el montaje. Va gradual en las tomas (k de 0 a 1) y entero en los sustos; con la
  cabeza más alta, la cámara tiene que mirar un poco más arriba.
- **Screamer rojo** (`deformar`): sólo con los píxeles reales de la cara, nada dibujado encima:
  - los ojos se agrandan y se «derriten» hacia abajo;
  - la abertura de los labios se estira hasta ser una boca larga;
  - la cara se retuerce alrededor de la nariz;
  - lo estirado se oscurece (queda hueco).

  Después, rojo con contraste y viñeta. Dura 6–19 cuadros y lleva 1–2 cuadros invertidos.
- **Desgarro** (`desgarro`): franjas corridas, canales separados, ruido, rayas blancas y la imagen que rueda. Se
  usa en todos los cortes, con intensidad 0,35 → 1 → 0,3.
- **Quemado arcoíris** (`arcoiris`): sobreexpuesto, canales muy corridos, líneas estiradas.
- **Estática**, **negro con franja que rueda**, y **negro con ojos** (`ojos`: 3 cuadros subliminales).

### Sonido (`montaje/pepe_sonido.py`)
- **Sólo grabaciones reales** (MyInstants): gritos (FNAF, jump scare), estática de TV, la VHS que carga, glitches,
  respiración, latidos, susurros, «tape stop», choque, golpe de cuerpo, hueso, stingers, zumbido de oído y el EAS real.
  Del EAS: 2 ráfagas + 0,9 s del tono antes de la voz, y las ráfagas de cierre al final. También el viento y el
  motor del zoom del propio Viewfinder.
- **Patrón de los sustos (medido en 7 videos):** casi silencio (-37 a -40 dB) y de golpe +21 a +36 dB.
- **Voces** (athanshock), todas medidas:
  - alerta: Jorge, 2 semitonos más grave y lento, con eco de transmisión, 93 Hz (las de referencia: 100–117 Hz,
    casi monótonas);
  - instructivo: Soledad, con temblor de cinta (vibrato 0,55 Hz + 6,2 Hz);
  - el que filma: Diego, con el micrófono de la cámara (banda 300–3600 Hz);
  - mensaje escondido: «me acuerdo de todos ustedes», al revés y grave;
  - voz robot que se entiende: `afftfilt` con la fase en cero (ventana de 2048, solapamiento 0,78: un zumbido parejo
    de ~98 Hz) mezclado con la voz limpia (0,45 limpia + 1,0 robot) y `acrusher` suave. La envolvente del habla
    queda 98 % igual a la limpia.
- **Música en reversa:** «Local Forecast» al revés, más lenta (×0,82), gastada (`acrusher`, vibrato, eco). Va en el
  corte, bajo «Pepe está contando», lejos (filtrada) cuando aparecen los Pepes, cuando el instructivo del final se da
  vuelta y antes de «TE TOCA».
- **Sincronía:** se recorta el silencio inicial de cada efecto (el comienzo es la primera muestra al 12 % del
  máximo); los golpes caen a ±20 ms del cuadro.
- **Cuidado:** `loud-static.mp3` viene roto (picos ×108 al decodificar), así que va `televison-static.mp3`. Cada
  sonido lleva `asoftclip=type=hard` antes de mezclar.
- **Final:** loudnorm en dos pasadas (I -15, LRA 20, para que los gritos peguen) + `alimiter`.

### Parte 2 («CINTA 3», `corto_pepe2.mjs`)
- **Adentro del edificio de gm_construct:** galería techada de 40 m (x de -19 a 21, z ≈ 28,5) y un salón hasta
  z 35,7. El piso de adentro está a -3,66 y `pisoBajo` devuelve el techo (1,63): el jugador va con `CO.yoI` y los NPC
  con `CO.fijoI`, que también les fija la altura (si no, alguno se cae por el piso).
- **Trae todo de la parte 1** (`BASE = { VF, COMUN, RELOJ }` exportado de `corto_pepe.mjs`); sólo cambia la fecha
  (21.11.1998 02:58).
- **`CO.pose(P, o)`**, la deformación entera en el modelo: cuello y cabeza estirados (k), la cabeza torcida de
  costado (`lado`), girada sobre el cuello (`giro`: π es el búho; en tres tirones), echada para atrás (`pitch`),
  brazos largos (`brazos`) y temblor.
- **`CO.sigue(id, p, r, c)`:** luz que sigue a un NPC lejos u oscuro (se agrega a `LUCES_T` y se renueva cada
  cuadro); sin eso, de noche al fondo del pasillo no se ve nada.
- **`CO.caraAlta(P)`:** la cara de un NPC estirado calculada (cadera + 1,38 con `escVis` 1,3): `md.W` queda viejo
  cuando el NPC no se dibuja, así que la cámara que «levanta» Pepe mira desde ahí.
- **Apagones** que lo dejan cada vez más cerca, la batería que se acaba y «SIN SEÑAL».
- **El auto de costado:** el auto que viene de lejos se cae fuera del mapa; se lo pone de costado
  (`Quat.axis(0, 1, 0, π/2)`) con la altura fija y se lo empuja.
- **Montaje** (`montaje/pepe2_cuadros.py`, `montaje/pepe2_sonido.py`): las mismas deformaciones de píxeles con la
  boca en una zona suavizada (smoothstep), las caras de cada screamer marcadas a mano (ojos, boca, alto), y en el
  sonido el «Carefree» al revés, código Morse real («TE TOCA», pitidos grabados: punto 55 ms, raya estirada con
  `atempo`) y 152 sonidos en total.
- **Lo que dice la voz tiene que seguir la historia:** «Nadie se va de este servidor» (Pepe deformado) y «Pepe ya no
  está solo» (antes de la lección final).
- **La instructora también en robot** (las lecciones 6 y 7): la misma cadena que la voz robot de la parte 1 (`afftfilt`
  con la fase en cero, 0,45 limpia + 1,0 robot, `acrusher`) y después el temblor de cinta. Queda 6,5 dB más baja: se
  sube para que la mezcla no cambie. La envolvente del habla queda 95 % igual a la limpia: se entiende.

### La huida, con realismo (f7 a f13)
- **Corre de verdad y hacia lo abierto:** sale del salón por la puerta al campo de pasto del sur (`RUTA`, 48 m) a 6,2 m/s.
  La cámara es la del guion (`CO.camCorre`): en la mano, a 1,45 m, con un rebote por paso (1,6 + 0,3·v pasos por
  segundo), el vaivén de costado cada dos pasos y el temblor de la mano; quieto, la respiración agitada. Mira para atrás
  sin dejar de correr (la posición sigue el camino; antes caminaba hacia el que lo perseguía).
- **Los que persiguen corren con la animación:** `CO.mueve(P, x, z, yaw, vx, vz)` pone la posición y la velocidad, y
  la IA queda en el modo `'guion'` (no hace nada), así la velocidad llega a la animación: corre, camina o corre de
  espaldas (Lucas, con la cara dada vuelta hacia nico) según la velocidad y para dónde mira el cuerpo. Nada de
  stop-motion: a saltos parecía que el video tenía lag.
- **Continuidad:** cada toma empieza donde terminó la anterior (`CO.geo()`: dónde frena, dónde retrocede; f9 imprime
  dónde cae y f10 a f13 pasan ahí mismo, con nico tirado en el pasto donde cayó). Nada vuelve al salón.
- **La lámpara del Viewfinder con la cámara del guion:** el mod la apunta desde `FFCam.CameraOrigin`, que sale de su
  `CalcView`; con `DBG.cam` no se actualiza y la luz quedaba donde empezó la toma (el pasto se oscurecía mientras
  corría). Se le pasan `FFCam.CameraOrigin` y `FFCam.CameraAngles` en cada cuadro. Modo 1 (infrarrojo) con
  `ffcam_lamp_brightness 0.2` y `ffcam_nv_brightness 0.85`: si no, el pasto que ilumina queda blanco sin textura. Se
  prende al salir: adentro, con las paredes al lado, quema todo.
- **La ropa blanca** (Lucas) con la lámpara a 2 m queda blanca entera: a 3 m o más.
- **Disco:** cada video son ~400 MB de cuadros. Con el disco lleno Chromium falla con «Failed to fetch» o «Execution
  context was destroyed»: borrar los cuadros de los videos ya entregados.
