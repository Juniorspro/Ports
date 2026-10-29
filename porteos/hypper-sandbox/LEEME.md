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
- **Mods con código** (`modapi.js`): el `codigo` de un mod o mapa corre en un cuadro aislado (`sandbox="allow-scripts"`,
  sin ver la página ni lo guardado) y habla con el juego por mensajes con el objeto `rb`: eventos (`inicio`, `tick` a
  15 por segundo, `boton`, `tecla`, `muerte`, `fin`), `rb.jugador`, `rb.mundo`, `rb.crear/mover/borrar/objetos`,
  `rb.explosion`, `rb.arma`, `rb.sonido`, `rb.nota` (sintetizador), `rb.rayo`, `rb.boton` (al HUD), `rb.guardar/leer`,
  `rb.entidad(tipo, [x,y,z], {…})`, `rb.nativo('volar'|'ragdoll'|'scp')`. Valores casi sin límite; archivos de hasta 8 MB.
- **Mods oficiales nativos** (`nativos.js`, botón en el HUD y tecla): **Volar** (G; empuje hacia donde mirás con
  inercia, el cuerpo inclinado con resortes: adelante con la velocidad, de costado hacia la curva, piernas que se
  balancean; pose de Superman a toda velocidad), **Muñeco de trapo** (X; los demás te agarran con la pistola de física
  o la de gravedad: mandan `jalar` por la red y tu cuerpo va hacia ahí en tu juego), **SCP en cuatro patas** (J; una
  esfera pegada a la superficie que pisa, trepa paredes y techos, pasa bordes; pose en cuatro patas con IK de dos
  huesos en brazos y piernas y paso procedural en diagonal: cada pie queda clavado hasta que se aleja de su lugar),
  **Piano gigante** (K) y **Radio YouTube** (L). En la sala los demás ven todo (bits en el estado y entidades en el mundo
  guardado, también los que llegan tarde).
- **Mods del server** (`smods.js`): en una sala el juego baja solo todos los mods publicados (`GET /api/mods?desde=`:
  datos completos sin contar descargas, más la lista de los que siguen publicados) y cada minuto busca los nuevos: apenas
  alguien sube uno, aparece con un aviso. Cada jugador elige con el botón **SM** (tecla M) cuáles usa él, sin límite, y se
  aplican al momento (se guardan aparte de los de un jugador; los que traen código se confirman una vez). Todos ven todo:
  el personaje del mod viaja en el estado, volar/SCP/muñeco por bits, los objetos y entidades por el mundo, las
  explosiones con su tamaño real, y la etiqueta de cada jugador muestra los íconos de sus mods. En la sala la gravedad de
  un mod es sólo del jugador (su salto y su caída) y la cámara lenta no se aplica (el tiempo es de todos).
- **Entidades** (`entidades.js`, formas propias en `geo.js`: mallas con el mismo vértice del juego y triángulos que se
  suman a los choques del mapa): piano (cada tecla suena al pisarla: jugadores, ruedas de autos, objetos), radio
  (`/api/yt` del worker busca en YouTube; un solo reproductor chico para la fuente más cercana, volumen por distancia y
  paredes, salta los videos que no se pueden poner), mega rampa, botón de autos (si el auto de ese botón ya no está,
  aparece otro; con muchos autos se borra el que lleva más tiempo sin usarse), teletransporte, zona de muerte, cartel,
  luz, impulso, meta y música.
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
- Skin de Goku en la tienda (modelo 3D generado aparte y pesado con el esqueleto del Hero; va sólo en el HTML).
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
  `voz`, `geo` (formas propias), `entidades`, `nativos` (mods oficiales), `creador`, `smods` (mods del server), `inicio`
  (RezoBox), `principal`.
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
  trepar una columna; vistas de costado), `piano_radio.mjs`, `creador.mjs`, `celu_mods.mjs`, `red_sm.mjs` (publica mods de prueba en la tienda real, dos jugadores
  eligen con SM, uno sube otro mod en el medio; borra todo al final) y `red_mods.mjs` (cada
  jugador en su propio navegador: si comparten uno, la pestaña de fondo deja de simular).
