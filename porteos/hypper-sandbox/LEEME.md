# Hypper Sandbox → HTML

Motor propio en JS/WebGL (nada del código del juego). Arranca en **WebGL 1** (Ajustes → Gráficos → Motor gráfico, o
`?gl=2` en la dirección, para WebGL 2). Los modelos, texturas, sonidos, íconos y la
lista del menú salen del APK al empaquetar y van **sólo** al HTML privado, nunca al repo.

```sh
# 1) datos del APK (carpeta no confiable, sin ejecutar nada de adentro): assets/bin/Data con los .split unidos
python -I herramientas/exportar.py DATOS SALIDA          # escenas, prefabs, mallas, materiales, texturas
python -I herramientas/anims.py DATOS SALIDA/anims.json   # animaciones genéricas (brazos y armas)
python -I herramientas/audio.py DATOS SALIDA/audio_orig   # FSB5 → ogg
python -I herramientas/sprites.py DATOS SALIDA/sprites    # íconos
python -I herramientas/humanoide.py DATOS SALIDA/humano.json  # animaciones humanoides (músculos) + avatares
python -I herramientas/menuexp.py DATOS level1 SALIDA/menu_ui.json  # el menú real (LobbyCanvas)
python -I herramientas/idiomas.py DATOS SALIDA/loc.json      # tabla de idiomas del juego
python -I herramientas/decodmb.py DATOS 1c5bd90faf82ca84b994ebfa0604f479 1 > CRUDOS/menu_raw.txt   # menú de spawn
#    (también tools_raw/chars_raw/hats_raw/emotes_raw con varios.py y decodmb.py)
python -I herramientas/empaquetar.py SALIDA CRUDOS PAQUETE
# 2) el HTML
MQTT_JS=ruta/mqtt.min.js python3 -I armar.py PAQUETE Hypper.html
```

- **HypperX RezoBox** (nuestra versión): `inicio.js` es el inicio con el aspecto del menú de Garry's Mod (logo con la R de
  Rezona, menú de texto, escenas de fondo en `PAQUETE/fondos/*.jpg`, fuera del repo). La primera vez pide **idioma** (14, en
  `idiomas.js`) y **nombre**. La intro de JXStudios es **procedural** (lienzo, sin video) y se gira con el teléfono parado.
- **Mods y mapas**: tienda con Mods y Mapas, buscador, orden, etiquetas, Explorar/Instalados, instalar, activar, me gusta,
  denunciar, crear un mod con un editor, publicar lo construido (pausa → Guardar guarda también una foto) y subir/bajar archivos.
  Formatos `.rbmod` y `.rbmapa` en `tienda/formato.js` (sólo datos, con límites; lo usan el juego y el servidor).
  Servidor: `tienda/worker.js` + D1 (`schema.sql`, `wrangler.toml`): `GET /api/lista`, `GET /api/item/ID`, `POST /api/publicar`,
  `POST /api/like|denunciar/ID` (3 denuncias = oculto), `POST /api/borrar/ID` con la clave del autor. 5 publicaciones por hora.
  `GET /api/yt?q=` busca música en YouTube para la radio (con la API oficial si se carga el secreto `YT_KEY`; si no, lee
  la página de resultados) y la guarda una hora en caché. `GET /api/mods?desde=` es lo que bajan los servers.
  Emisoras de radio por internet (lista pública de Radio Browser): `GET /api/radio?q=&tag=` busca (sólo emisoras que
  andan, MP3/AAC/OGG, sin HLS), `GET /api/radio/u/ID` da la dirección del audio y `GET /api/radio/play/ID` lo pasa con
  permiso de otro sitio para el sonido 3D (sólo emisoras de esa lista, nunca una dirección cualquiera);
  `GET /api/radio/clic/ID` le avisa a Radio Browser que se escuchó.
  Servers de los jugadores (tabla `salas`): `GET /api/salas` (borra los que llevan 10 minutos sin nadie y lista el resto),
  `POST /api/salas` (crea; el id lo propone el juego porque la clave para entrar se calcula con él; devuelve la clave del
  dueño), `POST /api/salas/ID/vivo` (alguien juega ahí) y `POST /api/salas/ID/borrar` (sólo con la clave del dueño).
- **Mods con código** (`modapi.js`): el `codigo` de un mod o mapa corre en un cuadro aislado (`sandbox="allow-scripts"`,
  sin ver la página ni lo guardado) y habla con el juego por mensajes con el objeto `rb`: eventos (`inicio`, `tick` a
  15 por segundo, `boton`, `tecla`, `muerte`, `fin`), `rb.jugador`, `rb.mundo`, `rb.crear/mover/borrar/objetos`,
  `rb.explosion`, `rb.arma`, `rb.sonido`, `rb.nota` (sintetizador), `rb.rayo`, `rb.boton(id, texto o 'ico:nombre')` (al menú
  MOD), `rb.guardar/leer`,
  `rb.entidad(tipo, [x,y,z], {…})`, `rb.nativo('volar'|'ragdoll'|'scp')`. Valores casi sin límite; archivos de hasta 8 MB.
- **Íconos sin emojis** (`iconos.js`; dibujados a mano en SVG plano: `herramientas/iconos.py` escribe `juego/iconos/*.svg`,
  azulejo de un color con el dibujo en blanco y a lo sumo un acento): los mods traen
  `icono: 'ico:nombre'` (o su propia imagen); los emojis de mods viejos se cambian por la imagen que más se parece
  (`ICO_EMOJI_RB` en `formato.js`, también en el servidor al publicar). Los botones usan dibujos SVG del color del texto
  (`glifo(nombre)`), los idiomas muestran su código (ES, EN…), los carteles pueden llevar `prm.ico` y la etiqueta de cada
  jugador muestra las imágenes de sus mods. Los títulos de videos y emisoras se muestran sin emojis.
- **Menú MOD** (`modmenu.js`): un botón **MOD** arriba (tecla U, con el número de activos) despliega dos partes. *Usar*:
  volar, muñeco y SCP se prenden y apagan; el piano se pone; la radio se pone, se lleva en la espalda o se le elige la
  emisora; los botones de los mods de código. *Mods*: todos (los tuyos jugando solo; los del server en una sala), con
  buscador, interruptor que se aplica al momento y **fuerza** (0–200 %) en los que cambian números (gravedad, velocidad,
  salto, tiempo, explosiones: el multiplicador se eleva a la fuerza). Jugando solo pasa por el mismo camino en vivo que en
  una sala (`smAplicar`): la gravedad del mod se suma a la del mapa y el personaje del mod no cambia el tuyo guardado.
  Lo que se ve: un anillo al prender o apagar uno, chispas doradas de Goku (también en los demás que lo usan), polvo al
  despegar con el súper salto, un escudo azul cuando el modo dios frena un golpe y la vista que se abre al correr rápido
  con velocidad. En una sala, el micrófono es un botón chico arriba.
- **Mods oficiales nativos** (`nativos.js`, en el menú MOD y con tecla): **Volar** (G; empuje hacia donde mirás con
  inercia, el cuerpo inclinado con resortes: adelante con la velocidad, de costado hacia la curva, piernas que se
  balancean; pose de Superman a toda velocidad), **Muñeco de trapo** (X; los demás te agarran con la pistola de física
  o la de gravedad: mandan `jalar` por la red y tu cuerpo va hacia ahí en tu juego), **SCP en cuatro patas** (J; una
  esfera pegada a la superficie que pisa, trepa paredes y techos, pasa bordes; pose en cuatro patas con IK de dos
  huesos en brazos y piernas y paso procedural en diagonal: cada pie queda clavado hasta que se aleja de su lugar),
  **Piano gigante** (K) y **Radio 3D** (L). En la sala los demás ven todo (bits en el estado y entidades en el mundo
  guardado, también los que llegan tarde).
- **Servers** (`red.js`): sin límite de jugadores (0/∞, también los oficiales). Los que crea un jugador se guardan en la
  tienda: siguen en la lista aunque estén vacíos ("vacío · se borra en N min"), se borran solos a los 10 minutos sin
  nadie (el de id más chico de la sala avisa cada minuto que siguen ahí, y cada uno al salir) y sólo su dueño los borra
  (botón rojo en la lista o "Borrar server" en el panel del anfitrión; la clave queda en este navegador, `rb_salas_mias`).
  Al borrarlo se avisa a la sala (`cerrada`); cada uno confirma en la tienda que de verdad se borró y vuelve al menú. El
  dueño entra a su server con clave sin escribirla y es el anfitrión. Sin conexión con la tienda, el server queda como
  antes (mientras haya alguien adentro).
- **Mods del server** (`smods.js`): en una sala el juego baja solo todos los mods publicados (`GET /api/mods?desde=`:
  datos completos sin contar descargas, más la lista de los que siguen publicados) y cada minuto busca los nuevos: apenas
  alguien sube uno, aparece con un aviso. Cada jugador elige con el botón **SM** (tecla M) cuáles usa él, sin límite, y se
  aplican al momento (se guardan aparte de los de un jugador; los que traen código se confirman una vez). Todos ven todo:
  el personaje del mod viaja en el estado, volar/SCP/muñeco por bits, los objetos y entidades por el mundo, las
  explosiones con su tamaño real, y la etiqueta de cada jugador muestra los íconos de sus mods. En la sala la gravedad de
  un mod es sólo del jugador (su salto y su caída) y la cámara lenta no se aplica (el tiempo es de todos).
- **Entidades** (`entidades.js`, formas propias en `geo.js`: mallas con el mismo vértice del juego y triángulos que se
  suman a los choques del mapa): piano (cada tecla suena al pisarla: jugadores, ruedas de autos, objetos), radio
  (abajo), mega rampa, botón de autos (si el auto de ese botón ya no está,
  aparece otro; con muchos autos se borra el que lleva más tiempo sin usarse), teletransporte, zona de muerte, cartel,
  luz, impulso, meta y música.
- **Radio 3D**: la fuente es una emisora por internet (`rb:` + su id) o un video de YouTube. Las emisoras pasan por el
  sonido del juego (`<audio crossOrigin>` → en mono (la música estéreo, con el HRTF, se oía igual de cualquier lado: el
  canal izquierdo iba al oído izquierdo esté donde esté la radio) → parlante chico (pasaaltos 280/210 Hz, cuerpo en
  600 Hz, medios en 1,8 kHz, pasabajos 4,6/6,2 kHz, algo saturado) con un siseo que sube a estática mientras sintoniza →
  panner HRTF que mira para donde miran los parlantes (de atrás, ~8 dB menos) → distancia de verdad (−6 dB cada vez que
  se duplica, desde 3 m; se apaga en el alcance), el aire (menos agudos de lejos), más eco de lejos, filtro detrás de
  paredes y eco del lugar; medido en `radio_espacial.mjs`); suenan las 3 radios más cercanas a la vez y los parlantes laten con el nivel real de la música. Primero se
  prueba la dirección directa (https); si no deja pasar el audio o no arranca en 9 s, va por `/api/radio/play/ID`, y si
  tampoco, la siguiente de la búsqueda. YouTube no deja pasar su sonido por el juego: un video suena desde su reproductor,
  que queda escondido (transparente y detrás de todo; las reglas de YouTube piden que se vea, así que esto corre por
  cuenta del juego), con el volumen por distancia y paredes pero sin 3D (pestaña aparte en el panel, con el aviso). La radio propia se **lleva en la
  espalda** (sale de la física y va pegada al pecho con los huesos de ese cuadro: se mide la espalda con los
  colisionadores del torso del personaje; queda a 1,2 cm en todos) y se **pega donde sea con la pistola de física**
  (clic derecho la congela; antes, con el izquierdo apretado, se volvía a agarrar y descongelar en el cuadro siguiente).
  En la sala la radio de otro es quieta para los demás (la mueve su dueño): pose y congelado viajan con `entp` mientras
  se mueve y quedan en el mundo guardado (giro `q`, congelada `fz`, en la espalda `ll`), así el que entra después la ve igual.
- **Portada animada** (`herramientas/portada/`): arma una escena en el juego (Goku con el aura y la radio en la espalda,
  gente bailando, autos y la mega rampa de fondo), maneja el reloj a mano (un paso exacto de 0,03 s por cuadro, así sale
  fluida aunque el navegador vaya lento), lee cada cuadro del lienzo a 1920×1080, lo achica a 960×540, funde el final con
  el principio para que el bucle no salte, pone el logo y arma el GIF con ffmpeg (instrucciones en `captura.mjs`). Con
  `VERTICAL=1` sale parada (9:16, 540×960).
- **Mod Cíclope** (`ciclope.js`, oficial): sos Cíclope (modelo 3D generado aparte y pesado con el esqueleto del Hero,
  como Goku; su cabeza es más baja que la del Hero, así que la articulación Head va a la base del cráneo en el nodo y en
  la pose de enlace, y todo lo que está arriba del mentón va con la cabeza). Los lentes rubí se dibujan aparte, con el
  marco del hueso de la cabeza y su escala (igual que la piel), a la altura de los ojos medida en la textura de la cara.
  Botón rojo (tecla H): tocar = láser suave desde los ojos (empuja y lastima poco); mantener 1 s (tiempo real, con el aro
  que se llena) = la definitiva, que ve toda la sala: 6 s de cinemática (cae de rodillas con una mano en el piso, se
  levanta, se saca los lentes y los tira, grita con la cabeza para atrás y el rayo sale al cielo; cuatro planos de
  cámara, los mismos en todos los juegos) y 15 s de rayo adonde apunta (sobre el hombro): explota y hace volar lo que
  toca, con el cielo, el sol y el ambiente rojos para todos. Si pasa a menos de 1,3 m de alguien lo agarra: lo lleva
  volando 3,2 s y el agarrado pasa a primera persona (cámara delante de su cara) con las manos arriba, palmas hacia el
  rayo, grita "no, no, no" (voz generada), ve todo rojo y se come el golpe final (con PvP). 20 s de espera entre
  definitivas; el que la tira no se lastima con sus explosiones. Por la red: `cic` con `u` (empieza), `d` (dirección y
  punta del rayo, 10 por segundo), `v` (agarró a alguien), `l` (láser suave) y `fin`; las explosiones van como siempre.
- **Mod Verity** (`verity.js`, oficial): una compañera con IA. El cuerpo se generó con IA a partir de una foto de la
  original (render con FLUX 3 usando la foto de referencia → modelo 3D con Meshy; `herramientas/verity_glb.py` lo centra,
  lo lleva a una esfera perfecta porque el modelo traía la cara tallada en la malla, gira la cara hacia adelante, le borra
  la cara a la textura y lo mete en el paquete como "Verity"; si el paquete no lo tiene, se usa una esfera hecha en el
  código). La cara tiene las medidas de la original (dos ojos ovalados y la sonrisa fina de lado a lado con remates) y
  es un casquete apenas más grande que la esfera con una textura de canvas que se redibuja con el gesto,
  la boca y la mirada: 14 caras). Tiene su propia cabeza: sola pasea rodando por el piso (gira como una pelota, se aplasta
  al caer), va a mirar autos, props, entidades y jugadores, persigue pelotas y las patea, saluda a los que llegan, se
  duerme si se cansa, piensa en voz alta cada tanto y vuelve con vos si te movés o la llamás. Ocho animaciones en su
  panel (rodar, rebotar, voltereta, bailar, girar, amor, mareo, dormir). Se le habla escribiendo (tecla Y o su botón),
  apretando el botón (micrófono) o por el chat ("Verity, ..."); además escucha siempre el micrófono (reconocimiento de voz
  del navegador, continuo) pero sólo le hace caso a "Hey/Che/Oye Verity" (en muchos idiomas: el nombre se compara por
  distancia de edición, con o sin saludo justo antes). Contesta en el idioma en que le hablan, con voz 3D (la boca sigue
  el volumen) y hace acciones de una lista cerrada (construir con cajas, poner props, la hora, música y video de YouTube,
  emotes, seguir, quedarse, limpiar). Se acuerda de vos en este aparato (`rb_verity`). De noche se pone misteriosa (sin
  sustos; se apaga). El cerebro: la tienda (`/api/verity`, Workers AI con Llama 3.1 8B; el prompt y la revisión de la
  respuesta están en `formato.js`, iguales en la tienda y en el juego) y su voz (`/api/verity/voz`, MeloTTS en WAV de
  22 kHz con caché); tope de 300 charlas y 500 frases por persona por día y 9000 neuronas por día en total (la cuota
  gratis es 10 000), sin cupo contesta 503. Sin la tienda, el juego piensa con un modelo público sin clave
  (Pollinations, una respuesta cada 30 s por conexión: los eventos se contestan con gestos para no gastar ese turno) y
  habla con la voz del navegador. En la sala la tuya viaja en tu estado (`vr`: posición, giro, cara, animación); lo que
  dice va en `verd` y otro jugador le habla con `verq` (por el chat o con la voz, si tiene el micrófono de la sala). Pruebas:
  `verity.mjs`, `red_verity.mjs` y `verity_publica.mjs` (con `TIENDA_SIM` = carpeta con el token y la cuenta de Cloudflare,
  el worker corre de verdad en Node con D1 y caché de mentira).
- **Skins riggeados de verdad** (`herramientas/skin_meshy.py`): el modelo 3D se riggea aparte (esqueleto tipo mixamo con
  sus pesos) y se lleva a la pose de enlace del Hero girando cada hueso con sus propios pesos, sin estirar la malla (lo
  que dejaba los brazos "espaguetizados"); las articulaciones del juego van donde quedan en esa malla y la cadera a la
  altura de la del Hero. Así entraron Goku y Cíclope rehechos y seis nuevos: Astronauta, Ninja, Robot, Zombi, Bombera y
  Pirata. Los datos van sólo en el HTML.
- **Emotes nuevos** (`herramientas/emote_meshy.py`, `emotes.js`): 28 animaciones (bailes, gestos y acciones) pasadas
  al esqueleto del juego como rotaciones locales a 20 cuadros por segundo más la cadera, sin la deriva horizontal; andan
  en todos los personajes. Panel por categorías (Todos, Bailes, Gestos, Acciones, Clásicos, Míos, Tienda) con
  miniaturas sacadas del personaje del lobby (el cuadro que mejor muestra la pose). En la tienda, la pestaña Emotes
  muestra los incluidos y los de la gente (formato `.rbanim`); se instalan y quedan en "Míos".
- **Editor de animaciones** (`animedit.js`): tu personaje delante, puntos en las articulaciones (tocás uno y lo girás
  arrastrando, o con tres deslizadores; la cadera además sube y se corre), línea de tiempo con claves que se mueven
  arrastrando (lo que cambiás en un momento sin clave crea una), mezcla suave entre claves, repetir o no, espejo (copia
  un lado al otro reflejado en el marco del esqueleto), empezar desde cualquier emote, y cámara grabada en las claves
  para verla como cinemática. Guarda en "Míos" (con foto), exporta `.rbanim` y publica en la tienda. En una sala los
  demás lo ven aunque no lo tengan: si es de la tienda lo bajan, si no se lo piden al que lo hizo (`animq`/`anim`).
- **Props nuevos** (`herramientas/prop_glb.py`): 15 modelos generados (sofá, mesa, silla, cama, heladera, inodoro,
  farol, banco, semáforo, cama elástica, pelota, aro de básquet, arcade, palmera, roca) a su altura real, con su
  textura, su masa y colliders a medida (`col=mesa`: tabla y patas; `col=tronco`: se pasa entre las hojas; `col=aro`:
  la pelota pasa por el aro; `col=pila`: postes con base plana; `col=esfera`). La pelota rebota (`rs`) y la cama
  elástica te hace rebotar (`sal`, con su "boing"). Menú de props con buscador, sección **Mods** primero y las
  categorías nuevas (Casa, Calle, Diversión, Naturaleza).
- **Menú MOD por categorías**: "Personaje y jugabilidad" (se prenden y apagan) y "Assets y props" (radio, piano,
  pantalla y los mods de la gente que ponen props: no se prenden, están siempre en Props → Mods). El creador de mods
  tiene el tipo y, para los assets, los props que ponen (`tipo` en `.rbmod`).
- **Pantalla de YouTube 3D** (`pantalla.js`): una tele (de 1,2 a 8 m) que pasa el video de verdad. El reproductor de
  YouTube va detrás del juego con una matriz CSS proyectiva que lleva sus esquinas a donde cae la pantalla en la
  imagen; el lienzo (con alfa) deja un hueco transparente sólo donde se ve, recortado con la profundidad de la escena,
  así lo que pasa por delante la tapa. Se agarra y se pega con la pistola de física; en la sala todos ven el mismo
  video al mismo tiempo; las demás pantallas muestran la tapa del video.
- **Controles como el Hypper original** (`hud.js`): cada botón en el lugar del PlayerCanvas del juego (referencia
  1280×720, escalado como su CanvasScaler) con íconos propios en vector: pausa y chat arriba a la izquierda, props a la
  izquierda al medio, disparo grande, saltar y borrar abajo, arma, cámara y emotes arriba a la derecha; con la pistola de
  física girar, congelar, acercar y alejar; en un auto pedales, doblar, freno de mano y bajarse.
- **Mapas propios** (`herramientas/mapas_rb.py`), además de los del juego, que siguen todos: Llanura (con una placita),
  Colinas (lago y playa), Isla, Ciudad RB (manzanas, calles con líneas, veredas, edificios, plaza y parque), Médanos
  (con oasis) y Luna (cráteres, gravedad baja, cielo negro sin nubes ni brillo de aire). Las texturas base son imágenes
  generadas, vueltas sin costura y llevadas al color de cada mapa; las líneas de la calle, las juntas y las ventanas se
  dibujan encima. Cada triángulo del terreno toma pasto, arena, tierra o roca según altura y pendiente.
- **Rendimiento para jugar en alto**: resolución dinámica en todas las calidades (también las elegidas a mano; se
  apaga en Ajustes): con menos de ~48 cuadros baja la resolución interna antes que los efectos (hasta el 60 % de la
  elegida) y la vuelve a subir cuando sobra, midiendo en tiempo real. Tope de píxeles por calidad (pantallas enormes o
  muy densas). En pantallas densas (1,5 puntos del lienzo por punto o más) la oclusión ambiental va a un cuarto de
  resolución y sin FXAA (ya no se ven serruchos). Sombras suaves con atajo: primero la mitad de las muestras y, si
  todas dan luz o todas sombra, listo (el filtro entero sólo en los bordes). Los celulares de gama alta arrancan en alto.
- **Mega rampa**: la caída de arriba es una parábola (la trayectoria de un auto que sale a ~30 m/s: el que llega más
  lento baja apoyado), recta a 52°, curva de abajo amplia (~3 g a 50 m/s), recta y salto final. Los autos chocan con
  los triángulos de las formas propias sólo vértice contra cara con la normal de la cara (`hullTri` en `fisica.js`):
  con las aristas internas se trababan y volcaban a 35 m/s. Mapa oficial "Mega rampa" en Pasto plano: seis autos en
  abanico mirando a la boca, cada uno con su botón, y teletransportes abajo para volver a subir.
- **Creador de mapas** (`creador.js`, "Crear un mapa" en el inicio): volás libre sobre un mapa del juego; props con el
  menú de siempre, puntos de aparición con su rol, roles (color, personaje, vida, velocidad, salto, armas), entidades con
  sus parámetros, datos del mapa; guardar (queda en Comunidad con foto), probar (te hace elegir rol) y publicar.
- **Audio espacial y voz** (`audio.js`, `voz.js`): cada sonido sale de su lugar (HRTF de cerca), se apaga detrás de
  paredes y tiene eco según el lugar; micrófono por cercanía con WebRTC (señales por la sala), la voz sale de quien habla.
- Lector de Unity: UnityPy 1.25 compilado desde fuente (`pip --no-binary :all:`), fsb5 para el audio.
- Gráficos por calidad (Ajustes → Gráficos, o `?gfx=` en la dirección): **patata** y **bajo** (luz difusa como el
  juego), **medio** (luz física GGX, sombras del sol en 1 cascada), **alto** (2 cascadas con PCF, HDR, oclusión
  ambiental, resplandor, nubes, FXAA) y **ultra** (3 cascadas con sombras suaves PCSS, relieve desde la textura,
  niebla con el sol, rayos de sol). En automático baja la resolución y, si no alcanza, la calidad.
- `gl` junta todo lo que se dibuja en una lista y la usa varias veces; `sombras` (cascadas en un atlas, con copia del
  mapa fijo que sólo se rehace cuando cambia el casillero o el sol), `post` (HDR, SSAO, bloom, rayos, ACES, FXAA),
  `dia` (hora del día: sol, atardecer, noche con luna, estrellas y faros), `anfitrion` (pestaña Host: hora, ciclo,
  PvP, Nextbots, topes, desactivar spawn, echar, limpiar; llega a toda la sala), `marcas` (marcas de frenada).
- Choques: una forma por cada collider del juego (cajas, esferas, cápsulas, mallas convexas) en cuerpos compuestos:
  puertas con hueco, contenedores abiertos, mesas con patas. Autos que no vuelcan al doblar.
- Animación: armas del juego en la mano en tercera persona, disparo/recarga/golpe en el torso, salto, aterrizaje,
  agacharse, pies apoyados en el piso; cámara con balanceo, golpe al caer y agacharse suave.
- WebGL 1: los shaders se pasan a GLSL 1.00 al compilar; usa las extensiones que haya (VAO, textura de profundidad,
  derivadas, `frag_depth`, half float) y si falta alguna baja sólo esa parte (sombras, oclusión, relieve). Si el
  aparato tiene pocos uniforms la piel se calcula en la CPU. Texturas no potencia de 2 se reescalan.
- Sombras sin rayas (acné): sesgo según la inclinación de la superficie respecto del sol (derivadas de la posición
  proyectadas en el mapa de la cascada), así no depende del `polygonOffset` de cada placa.
- Locomoción: para cada skin se mide hacia dónde y a qué velocidad pisa cada clip (y su espejo) y con pasos cortos
  (mezclado con estar parado); el ritmo sigue a la velocidad real. Los pies se clavan donde pisan (punto entre el
  tobillo y la punta, IK de dos huesos) y se sueltan al levantar el pie. Cambios de estado (correr/quieto/aire/
  sentado/emote/arma, cambio brusco de dirección, una acción que corta a otra) con transición inercial
  amortiguada; el giro del cuerpo se mezcla del mismo lado del cuaternión (antes daba media vuelta en un cuadro).
- Skin de Goku en la tienda (modelo 3D generado aparte y pesado con el esqueleto del Hero; va sólo en el HTML). Igual
  Cíclope (y su grito, generado).
- Dibujo: el cielo, las marcas y las líneas desatan la malla de WebGL sin avisarle a la caché (`R.vaoAct`); si lo
  primero transparente usaba la misma malla que lo último opaco, se dibujaba sin malla (`GL_INVALID_OPERATION`).
- Arranque: la intro de JXStudios (video WebM/MP4 adentro del HTML, con la imagen del logo si el aparato no lo
  reproduce) en lugar de "Cargando"; mientras tanto se lee el paquete. A prueba de fallas: cada paso queda anotado; si
  algo se rompe se prueba solo con el otro motor (WebGL 1 ↔ 2) y después con la calidad más baja, y si igual no anda
  se ve el error en pantalla. Si el navegador no trae DecompressionStream, el gzip se abre en JS; si una placa no
  acepta un shader, se usa una versión más simple.
- `juego/`: `nucleo` (matemática), `gl` (dibujo), `datos` (paquete), `modelo`, `fisica` (XPBD), `mundo`
  (mapa y choques), `jugador`, `objetos`, `vista` (arma en la mano), `audio`, `efectos`, `armas`,
  `vehiculos`, `herramientas` (Tool Gun), `personas` (skins, emotes, muñeco), `humano` (clips humanoides:
  músculos → huesos), `red` (MQTT: salas, lista de servidores por presencia retenida), `entrada` (incluye el
  giro a horizontal), `ui`, `menu` (dibuja el LobbyCanvas exportado con HTML), `idiomas`, `modapi` (mods con código),
  `voz`, `geo` (formas propias), `entidades`, `pantalla` (pantalla de YouTube), `nativos` (mods oficiales), `ciclope` (mod
  Cíclope), `verity` (mod Verity), `animedit` (editor de animaciones), `emotes`, `hud` (controles), `idiomas3` (textos de la versión 8),
  `creador`, `smods` (mods del server), `inicio` (RezoBox), `principal`.
- Pruebas: `pruebas/escena.mjs` (guion de pasos), `dbg.mjs` (corre un .js en la página: `fisica_choques.js`,
  `vehiculos.js`, `pies.js`, `camara.js`, `marcas.js` devuelven números), `red2.mjs` (tres jugadores, broker local
  aedes: sala oficial, lista, servidor con clave y sin PvP), `red3.mjs` (anfitrión: hora y reglas por la red,
  spawn bloqueado, echar), `barrido.mjs` (8 mapas × 5 calidades, errores de consola), `celu.mjs` (teléfono táctil,
  `acostado` o `parado` para el giro de 90°), `pasos.mjs` (cuánto patina el pie apoyado, m/s, por velocidad y
  dirección), `saltos.mjs` (cuánto salta cada hueso de un cuadro al otro en todos los cambios de estado), `arranque.mjs`
  (abre el HTML como la gente, con fallas simuladas en `PRE`: sin WebGL 1, sin DecompressionStream, etc.).
  De RezoBox (`node prueba.mjs HTML carpeta`, con `NODE_PATH` hacia playwright): `tienda.mjs` (bienvenida, idiomas,
  publicar y borrar en la tienda real), `mods_api.mjs`, `voz.mjs`, `rampa.mjs` (un auto baja la mega rampa: cabeceo
  contra la pendiente, ruedas y contactos cuadro a cuadro), `nativos.mjs` y `nativos_lado.mjs` (volar, muñeco, SCP:
  trepar una columna; vistas de costado), `piano_radio.mjs`, `radio3d.mjs` (menú MOD, emisora en 3D con nivel y volumen por distancia, espalda medida en
  varios personajes, pegarla en una pared con la pistola de física, YouTube aparte y ningún emoji en la pantalla; `celu`
  para el teléfono), `red_radio.mjs` (otro la oye, la ve en tu espalda y congelada en el mismo lugar, el que entra
  después también), `mods_vivo.mjs` (menú MOD: prender y apagar en vivo, fuerza, buscador, aura, polvo, escudo y vista;
  `celu`), `red_servers.mjs` (crear un server, 0/∞, vacío con la cuenta de 10 minutos, borrado solo, clave, sólo el
  dueño lo borra y los de adentro vuelven al menú; con credenciales de Cloudflare adelanta el reloj en la base),
  `radio_espacial.mjs` (lo que sale por cada oído con una música de prueba estéreo: de qué lado, el retraso entre oídos,
  la distancia, de atrás, el parlante chico y la estática), `ciclope.mjs` (el personaje, el láser, la definitiva con sus
  planos, el rayo que agarra a un muñeco, el cielo rojo y que todo vuelva; `celu` con el dedo de verdad),
  `red_ciclope.mjs` (otro ve la cinemática, el rayo lo agarra: primera persona, manos, rojo, vuela, golpe final), `creador.mjs`, `celu_mods.mjs`, `red_sm.mjs` (publica mods de prueba en la tienda real, dos jugadores
  eligen con SM, uno sube otro mod en el medio; borra todo al final), `red_pantalla.mjs` (la pantalla con el mismo
  video, tamaño y lugar para el otro, que no la puede agarrar; un emote hecho en el editor que el otro pide y ve) y `red_mods.mjs` (cada
  jugador en su propio navegador: si comparten uno, la pestaña de fondo deja de simular).
