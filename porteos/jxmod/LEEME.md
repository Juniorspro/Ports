# JXMod (juego web)

Motor propio en JS/WebGL (nada del código del juego). Arranca en **WebGL 2** (si el aparato no lo tiene o no arranca,
vuelve solo a WebGL 1; Ajustes → Gráficos → Motor gráfico, o `?gl=1` en la dirección, para elegir WebGL 1). Los modelos, texturas, sonidos, íconos y la
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
MQTT_JS=ruta/mqtt.min.js python3 -I armar.py PAQUETE JXMod.html
```

- **Definitive RezoBox** (nuestra versión, antes JXMod): el logo es la R de Rezona + "definitive rezobox"
  (`juego/logo_dr.webp`, Nunito Black como el logo anterior). `inicio.js` es el inicio con el aspecto del menú de
  Garry's Mod (menú de texto, escenas de fondo en `PAQUETE/fondos/*.jpg`, fuera del repo, botoncitos abajo y paneles
  claros); el menú de JXMod sigue armado abajo pero nunca se muestra. `rbmenus.js`: Multijugador (lista con buscador,
  entrar, clave en una ventanita, crear server con nombre/clave/modo/mapa, borrar los tuyos) y Personajes (skins y
  gorros con el personaje en 3D a la derecha, se gira arrastrando), con los mismos paneles. La primera vez pide
  **idioma** (14) y **nombre**.
- **Mapas de Garry's Mod: gm_construct y gm_flatgrass** (`herramientas/gmod.py`, con srctools; categoría GMod en la
  lista de mapas, con ícono y fondo de carga sacados de capturas del juego). Del BSP: el mundo (caras con sus texturas,
  las de mezcla con la segunda textura y el peso por vértice, los terrenos con desplazamientos sin los triángulos tapados
  por el piso), colisiones (también caras de cielo y pinceles invisibles, sin triángulos degenerados), props, agua, luces,
  sol, niebla, apariciones, el cielo 3D de construct (la ciudad de fondo, geometría de verdad ×16 alrededor de la cámara
  del cielo, sin choque; la vista llega a 950 m) y el cielo de caja (6 caras). Uso:
  `python-con-srctools -I gmod.py PAQUETE PAQUETE_NUEVO CARPETA_GMOD10 [POSTURAS.json] [FOTOS]`.
- **La palanca (crowbar) de Half-Life 2 / GMod**: en primera persona el v_crowbar de verdad con sus animaciones (sacar,
  quieto en bucle, golpe al aire, tres golpes que pegan, guardar) a la escala del FOV de la vista de Source; golpe con
  alcance de 1,95 m (daño 25, empuja lo que pega), sus sonidos (silbido, golpe a superficie, carne), en red (el otro ve
  el golpe y lo oye), suelta como prop y en el menú de armas con su ícono.
- **Posturas de GMod en tercera persona y agarre de verdad, en todos los personajes**: las posturas de `male_anims.mdl`
  (quieto, golpe y recarga de cada tipo de arma) se hornean a clips humanoides (`herramientas/gmod_posturas.mjs`: busca
  los músculos del Hero que dejan cada segmento como en GMod; los músculos sirven para todos los personajes). El arma va
  en la mano como en GMod (el hueso de la mano del arma sobre el de la mano), en el marco anatómico de cada mano
  (muñeca, nudillos, palma) y a la escala de esa mano. Los dedos: cada falange apunta como en GMod y después la mano se
  cierra sobre el mango de verdad (el pedazo del arma que queda dentro de la mano, muestreado sobre las aristas) hasta
  dejar articulaciones y puntas donde las tiene GMod, sin meterse en el mango (`agarre.mjs`: con la palanca, índice,
  medio y anular rodean el mango 210-250° en casi todos, como GMod; nada se mete adentro). Hay esqueletos con el hueso de
  la mano a mitad del antebrazo: si la palma mide más de 1,5 dedos, la muñeca se pone 1,15 dedos atrás del nudillo.
  Los skins generados no tenían pesos en los dedos (la mano entera era un mitón): `herramientas/dedos_meshy.py` reparte
  los vértices de cada mano entre las falanges (y el pulgar, lo que sobresale de la palma) y pone esos huesos donde
  están los dedos de la malla, así cierran la mano.
  **La cabeza mira adonde miran los ojos del jugador de GMod** en cada cuadro de cada postura (el punto `eyes` de
  `male_02.mdl`, que cuelga del hueso de la cabeza): antes se copiaba sólo la dirección del cuello, la cabeza lo seguía
  y el personaje miraba al piso con todas las armas (28-48° abajo; en GMod, de 2° arriba a 20° abajo). Del cuello se
  copia sólo cuánto se inclina adelante y girar o ladear cuello y cabeza cuesta un poco (si no, el horneado torcía el
  cuello al tope y la cabeza lo compensaba). Con el Hero cada postura queda a ≤1,1° de la mirada de GMod y en todos
  los personajes a ≤7,2°. Parado con un arma de GMod, el torso apunta al frente aunque la cadera se mueva con la
  animación de quieto (la de mirar alrededor la gira hasta 35° y el arma giraba con ella), como el `aim_yaw` de GMod: la
  columna se gira sobre la vertical del mundo y en toda la vuelta la mirada se mueve ≤4,9° y el arma ≤5,3° (antes, 40°).
  Ese giro es parte de la pose: en los cambios de estado (arrancar a caminar, cambiar de arma) se mezcla igual que ella,
  sin saltos (a 60 cuadros por segundo, el pecho gira ≤1,7° por cuadro).
- **Las armas de GMod: Tool Gun, Physics Gun y Gravity Gun**, en lugar de la taser, la láser y la de gravedad: las
  vistas de primera persona con sus animaciones (sacar, quieto, disparo; la Physics Gun "sujeta" con su zumbido mientras
  agarra algo; la Gravity Gun levanta, sostiene zumbando, lanza con su disparo y suena en seco si no hay nada adelante),
  sus sonidos e íconos, y en tercera persona el modelo del mundo en la mano: la Tool Gun con la postura de pistola, la
  Physics Gun (con la piel azul) y la Gravity Gun con las dos manos, como en GMod.
- **Las armas de Half-Life 2** en lugar de las del juego: pistola, .357, SMG, AR2 (en lugar de la AKM), escopeta (con la
  corredera después del tiro), ballesta, RPG y francotirador: la vista de cada una (v_) con sus animaciones (sacar,
  quieto, disparo, recarga), sus sonidos, el ícono y el modelo del mundo (w_) en la mano con la postura de GMod de su
  tipo.
- Del conversor: con `$selfillum` el alfa de la textura es la máscara de lo que brilla, no transparencia (la Physics Gun
  salía negra); las caras de los modelos de Source se orientan por su giro (Source las dibuja en sentido horario) y las
  normales de vértice que quedan hacia adentro se dan vuelta: a la Gravity Gun del mundo le faltaba el cuerpo (un tercio
  de sus normales iban al revés).
- **Personajes nuevos: Rick, Rick Prime, Finn y Jake**, fieles a la serie: cada uno generado desde una imagen oficial de
  referencia (imagen en pose T → modelo 3D riggeado → `skin_meshy.py`), con su retrato. **Cada uno con su alto**:
  `skin_meshy.py --alto K` achica la raíz del personaje (todo lo de abajo la sigue: huesos, cadera de las animaciones,
  bailes, gorro, muñeco de trapo) y guarda el tamaño (`DATA.tam`): Jake mide 0,44 del Hero (llega a la cintura de Finn),
  Finn 0,8 (un nene) y los Rick son altos. Jugando con uno bajito la cápsula es más baja (Jake pasa por abajo de una mesa
  a 1,2 m), los ojos van a su altura (`--ojo`), la cámara de tercera persona se acerca, y para los demás su cápsula y su
  nombre arriba también son de su tamaño (un tiro por arriba de la cabeza de Jake no le pega). `skins_nuevos.mjs`.
- **Menos lag con mucha gente** (medido con 24 jugadores repartidos entre 6 y 48 m, en el navegador de pruebas):
  medio de 340 mil a 67 mil triángulos por cuadro (97 → 41 dibujos, 6,7 → 13,6 cuadros por segundo) y alto de 557 mil a
  97 mil (141 → 79 dibujos, 3,9 → 7,1):
  - cada personaje tiene una versión simplificada al 20 % de los triángulos (`herramientas/lod_skins.py`, con pyfqmr):
    la malla se suelda por posición y se simplifica entera, y cada triángulo nuevo toma la isla de UV del original más
    cercano (proyectado ahí: UV, normal y pesos), así las costuras no se corren; mismos huesos. Se usa cuando el
    personaje ocupa menos del 20 % del alto de la pantalla (12 % en ultra, 30 % en bajo, y en patata —la de los
    celulares de 2 GB o muy flojos— los demás siempre con la simplificada: sus mallas enteras ni se suben a la placa;
    medido con 12 jugadores en patata: 5 de 5 a la vista con la simplificada). Suma 2,9 MB al
    HTML (54,8 MB; una sola versión: dos sumaban 4,5);
  - los que no se ven (fuera de la cámara y a más de 4 m) no se animan ni se dibujan (el tiempo se junta para cuando
    vuelven), los de más de 40 m se animan un cuadro sí y uno no, y los de más de 22 m (35 en alto y ultra) no hacen
    sombra.
- **Titileos negros en el celular**: cambiar el tamaño del lienzo lo borra, y la resolución dinámica lo hacía después de
  dibujar el cuadro (el navegador mostraba el cuadro vacío, negro). Ahora se hace al empezar el cuadro siguiente, sólo si
  cambió, y la resolución ya no sube y baja cada segundo (para subir hacen falta dos segundos seguidos con resto y 3 s
  desde el último cambio). Si el aparato pierde el contexto de WebGL (sin memoria, o en segundo plano mucho tiempo) ya no
  queda negro: deja de dibujar y recarga cuando el navegador lo devuelve.
- **Memoria (celulares de 2 GB)**: después de cargar, el paquete suelta los datos y las mallas comprimidas que ya se
  leyeron: queda en 16,5 MB en vez de ~38.
- **Emotes de a dos** (Emotes → Juntos; `juego/juntos.js`, prueba `pruebas/juntos.mjs`, 7/7): dar la mano, chocar los
  cinco, consolar, ir de la mano, tirar del brazo, ayudar a levantarse y bailar salsa, con capturas de CMU de dos
  personas grabadas juntas (el sujeto A y el B). Ponete frente a alguien (jugador o NPC, a menos de 3 m) y elegí uno: le
  aparece un cartel (Aceptar o E) y lo hacen los dos ubicados como se grabó (el que pidió no se mueve; un NPC acepta
  solo). Como los esqueletos del juego no son los de las personas grabadas, al empezar se calcula con los dos esqueletos
  reales el momento del contacto y se corre al segundo para que se toquen: medido, en el apretón las manos derechas quedan
  a 2,3 cm, en el choque de cinco a 5,9 cm y al consolar las manos a 19 cm de los hombros. Mientras dura, el cuerpo sigue
  la captura entera y al terminar cada uno queda donde terminó (sin volver de golpe y sin empujarse). En la sala lo ven
  todos.
- **Bucles de los emotes, otra vez**: al empalmar se repetía el tramo de 1,5 s que mejor empalmaba aunque el baile durara
  9 s (un pedacito); ahora el tramo empieza en el primer cuarto y termina en el último (cubre del 51 al 96 % del clip,
  mediana 76 %), y el empalme es por inercialización: al dar la vuelta, cada hueso arranca con la diferencia exacta del
  salto y la va soltando (0,3 a 0,8 s según el salto), sin mezclar poses lejanas (los giros de la salsa, un pie dado vuelta
  en la captura). Medido en los 748 que se repiten: el 99,2 % no gira más de 12° por encima de lo que gira la captura sola;
  los 4 peores giran 46-49° en un cuadro (antes, 177°).
- **V1 y V2 de ULTRAKILL** (Personajes): generados desde imágenes de referencia de la wiki (pose T con las alas
  plegadas), riggeados, con dedos para agarrar la palanca y las armas, versión simplificada y voz de robot; miden 0,95 del
  Hero (1,80 y 1,86 m). `skins_dn.mjs V1,V2`: 5/6 (caminando, lo más bajo de V2 baja 3,4 cm más que el Hero: 4 mm más que
  el margen de la prueba).
- **Bocina** (`vehiculos.js`; prueba `pruebas/bocina_bici.mjs`, 7/7): manejando, H en la compu o el botón del parlante en el
  celular, mientras se mantiene. Sintetizada (no hay sonido en el paquete): los autos, dos tonos (370 y 466 Hz) en diente
  de sierra filtrados; la policía más aguda; la moto un tono agudo; la bici un timbre (ring ring). Sale del vehículo (3D) y
  en la sala la oyen los demás mientras la tocás.
- **Bici con cohete** (Vehículos → Motorcycle): modelo generado (imagen → 3D) y hecho vehículo de dos ruedas con
  `herramientas/vehiculo_prop.py` (controlador, asiento, puntos de la suspensión calculados para que las ruedas apoyen
  justo con su masa, tobera del cohete y una caja de choque en el cuadro). A pedal llega a ~13 m/s; con Shift (o el botón
  del cohete en el celular) el cohete empuja hasta 48 m/s (pasa los 25 en 3 s, sin volcar) con fuego, humo, luz y el
  ruido del cohete de HL2; en la sala los demás lo ven y lo oyen.
- **Emotes que no se buguean** (`emotes.js`; prueba `pruebas/emotes_lugar.mjs`, los 2203: 2175 de captura y 28 del
  paquete, reproducidos a 30 cuadros por segundo). Medido antes → después:
  - **En el lugar**: las capturas traen el viaje de la persona (caminar, correr, girar) y la cadera se iba del jugador
    (p95 3,57 m, hasta 5,7) y volvía de golpe. Ahora a la cadera se le resta (sólo en horizontal) una recta ajustada a
    ±0,6 s y queda el vaivén: p95 0,41 m, máximo 0,45.
  - **Sin la pose T**: el cuadro 0 de las 2175 capturas es el de referencia del BVH (pose T); se veía al empezar y en
    cada vuelta. Se saca al cargar.
  - **Pies dados vuelta**: errores de la conversión (un pie que gira ~170° y queda así varios cuadros) se corrigen
    siguiendo la continuidad de cada hueso.
  - **Empalme al repetirse**: se repite el tramo que mejor empalma (el peor hueso pesa más) con un fundido de 0,25 s (en
    los clips cortos, después de dar la vuelta). Un hueso que giraba más de 12° por encima de lo normal al empalmar:
    695 de 722 → 3 de 748; más de 45°: 648 → 0.
- **Miniaturas de los emotes** (`emoMini`/`emoMiniSVG`; `pruebas/emotes_minis.mjs` las hace, `emotes_minis_panel.mjs`
  5/5): cada una de las 2175 de captura tiene su silueta en su pose más característica (la que más aparta manos y pies de
  estar parado, y otra bien distinta clarita atrás para que se note el movimiento), hecha con el esqueleto del juego y
  vista en 3/4, sobre el color de su categoría. Van en el catálogo (164 KB: 64 letras cada una) y el panel se arma en
  ~35 ms; las animaciones tuyas la hacen al verlas.
- **Tienda en íconos cuadrados** (`inicio.js` `tiendaDibujar`; prueba `pruebas/tienda_iconos.mjs`, 12/12 en compu y
  celular): Mods, Mapas y Emotes ya no son una lista de tarjetas con textos y botones: son íconos cuadrados por secciones
  (Mods: oficiales de jugar, oficiales que ponen cosas y los de la gente; Mapas: oficiales y de la gente; Emotes: por
  categoría), 7 por fila en la compu y 9 en el celular acostado, con una marca azul en los prendidos y verde en los
  instalados. Tocar uno abre su **ficha**: ícono grande, nombre, autor, descargas y me gusta, etiquetas, la descripción
  entera y los botones (Instalar, Quitar, Activado, Jugar, Me gusta, Denunciar, Exportar); Volver vuelve a la grilla.
- **Menú MOD en íconos cuadrados** (como los ajustes rápidos de un celular): tocar el ícono prende o apaga el mod (con la
  marca azul arriba a la derecha) y la fuerza de los prendidos que la tienen va abajo, una fila cada uno.
- **Sin rastro del nombre viejo en los menús**: los textos heredados que decían "JXMod" dicen RezoBox y las fotos se
  guardan como `rezobox_….png`.
- **NPC con actitud: Tool Gun → Actitud** (`juego/npc.js`; prueba `pruebas/npc.mjs`, 15/15): clic en el piso pone un
  NPC (clic derecho: elegís el personaje y la actitud de los próximos); clic sobre un NPC abre su panel, donde **escribís
  cómo actúa** ("agresivo, que nos persiga corriendo") o tocás una rápida (Agresivo, Amigo, Miedoso, Bailarín, Guardia,
  Pasea, Quieto). Lo escrito lo entiende al instante un lector local (palabras clave en español, inglés, portugués y
  otros) y después lo afina la **IA gratis** (tus claves, los modelos libres sin clave de OVHcloud y LLM7, o Pollinations;
  medido: Llama 3.3 70B contestó en ~2 s) con modo (quieto, pasear, seguir, perseguir, huir, bailar, guardia, mirar), a
  quién (el más cerca, vos u otro NPC), velocidad, si pega y cuánto, qué dice (globito arriba de la cabeza), si salta y
  su vida.
  - Caminan y chocan como el jugador (la misma cápsula contra el mapa, los props y la gente: se reusa
    `jugadorMoverChocar` con los datos del NPC), saltan lo bajo, rodean lo que no pueden saltar (un contenedor de 3 m: llega
    en < 9 s) y no se tiran de un barranco de más de 4 m. Agresivo: llega desde 14 m en 3,9 s y patea (−10 de vida).
  - **Muñeco de trapo**: un tiro lo lastima; uno fuerte (≥ 40), la patada, la Gravity Gun o la catapulta lo tiran y a los
    ~3 s se levanta; muerto queda tirado 15 s. La Physics Gun lo levanta (cuelga y patalea) y al soltarlo cae.
  - En la sala, cada uno mueve sus NPC y los demás los ven (6 veces por segundo, con su emote y si están tirados); un golpe
    a un NPC ajeno le llega a su dueño; la actitud se le puede cambiar a uno ajeno (se la manda al dueño). Hasta 24 por
    jugador. 12 persiguiendo cuestan 0,26 ms por cuadro. El tacho y Remove los borran.
- **Censura del chat** (siempre; `juego/censura.js`, prueba `pruebas/censura.mjs`, 8/8): un filtro local, al instante y
  sin internet, tapa (una * por letra) insultos, groserías, contenido sexual y odio en español, inglés, portugués, francés,
  alemán, italiano, turco, indonesio, tagalo y ruso aunque vengan disfrazados (mayúsculas, acentos, letras repetidas
  "puuuta", números por letras "sh1t", letras separadas "p.u.t.a", frases "kill yourself") y datos personales
  (teléfonos de 8 números o más, mails), sin tocar palabras normales (computadora, putting, Nigeria, vergüenza, Bob, "te
  voy a matar en el juego"). Pasa por ahí todo lo que se ve: tus mensajes, los de los demás (aunque usen una versión
  vieja) y los nombres. Además la **IA gratis revisa cada mensaje tuyo** antes de mandarlo: si contesta en 1,5 s sale lo
  que tapó; si tarda, sale con el filtro local y cuando contesta se corrige el renglón para todos. Lo que devuelve la IA
  sólo puede tapar letras del mensaje (si escribe otra cosa se descarta) y se pasa otra vez por el filtro local. Medido:
  Llama 3.3 70B tapó "gordo asqueroso" e "inútil" (que el filtro local no tiene) en 1,6-1,8 s.
- **El celular es un mod** (oficial "Celular", viene instalado y prendido; `juego/celumano.js`, prueba
  `pruebas/celu_mano.mjs`, 27/27): da el arma Celular. O (o su botón) lo saca y lo guarda (vuelve al arma de antes); en
  primera persona se ve en la mano derecha (no a pantalla completa: 59 % del alto en la compu, 70 % en el celular y ahí
  más al centro, sin tapar los botones de saltar y disparar), con la pantalla de siempre (sus apps) pegada justo encima
  del celular 3D con una transformación de perspectiva (las esquinas coinciden a 0,4 px): se toca ahí mismo, y en la
  compu clic para usarlo (aparece el puntero), clic en las apps y Esc o clic en el juego para volver a mirar. Se sigue
  caminando. La mano es la de la vista "Hands" del juego: cinemática inversa del brazo, la palma apoyada atrás, los dedos
  juntos y apoyados en la espalda (se doblan o estiran hasta tocarla: ninguno la atraviesa), el pulgar por el canto
  derecho; la pose se calcula una vez (la mano y el celular cuestan 0,03 ms por cuadro). En tercera persona va chico en
  la esquina y el personaje lo sostiene delante del pecho, mirando la pantalla (la misma cinemática inversa con sus
  propios huesos: probado en los 48 personajes, de Jake a BoiledOne, sin dedos que atraviesen el celular); los de la
  sala también se ven con el celular en la mano. Apagando el mod se va el arma y el botón.
- **Más optimización** (física y peso del HTML):
  - **El código del juego va comprimido** dentro del HTML (`armar.py`: gzip en base64; un arranque chico, sin comprimir,
    lo descomprime en segundo plano con el descompresor del navegador y lo ejecuta; sin descompresor usa el gzip en JS de
    `juego/inflar.js`; `JS_PLANO=1` arma el de antes). La biblioteca de la sala (mqtt, 369 KB) va adentro del mismo gzip,
    justo antes del juego, y las fotos de fondo (pantalla de carga e inicio) van en WebP calidad 82 en vez de JPEG (un
    32 % menos, sin diferencia a la vista: PSNR ≥ 37,8 dB). **El HTML pasa de 29,9 a 28,3 MB.** Medido bajando el HTML a
    3 MB/s: listo en 13,5 s en vez de 13,9; abierto como archivo, igual que antes (dentro del ruido de ±0,5 s). Las
    pruebas de intro, pantalla de carga y sala (`red2.mjs`, 13/13) siguen sin errores.
  - **El solver de contactos no crea basura**: corre cada contacto 12 veces por paso y antes creaba unos 20 vectores en
    cada una; ahora usa vectores de trabajo, con las mismas cuentas en el mismo orden. Las direcciones de las aristas de
    cada cuerpo se giran una vez por paso (no una vez por par) y cada par de cuerpos recuerda el último eje que los
    separó: si sigue separándolos no se vuelve a buscar (en una pila resuelve el 47 % de los pares con una sola prueba).
    La física da **exactamente lo mismo** (la huella de posiciones y giros de una pila de 48 props y 6 autos después de
    600 pasos es idéntica bit a bit) y cuesta un 7-9 % menos.
- **Addons de Garry's Mod** (cualquiera del Workshop; `juego/gmod_formatos.js`, `gmod.js`, `gmod_lua.js`, `gmod_prelude.js`,
  `gmod_api.js`, `gmod_cargar.js`, `gmod_tienda.js`, `gmod_server.js`; pruebas `pruebas/gmod_addon.mjs`, `gmod_lua.mjs` 13/13
  y `gmod_votar.mjs` 13/13). Antes de escribir nada se analizaron 111 addons populares de todas las categorías (qué
  archivos traen y qué API de Lua usan) y se leen todos esos formatos en el navegador, sin programas aparte:
  - **Archivos**: `.gma` (comprimido o no: el LZMA se descomprime en otro hilo), modelos `.mdl` + `.vvd` + `.vtx` (malla,
    materiales, huesos y adjuntos), choque `.phy` (piezas convexas en el espacio de cada hueso y la masa; los props
    estáticos vienen girados 90° y se detecta solo), texturas `.vtf` (7.0–7.5, DXT1/3/5 y sin comprimir) con su `.vmt`,
    sonidos `.wav` (PCM y ADPCM), `.mp3`/`.ogg`, imágenes `.png`/`.jpg` y los `.lua`. Lo bajado queda en el navegador
    (IndexedDB): no se vuelve a bajar.
  - **Lua propio**: un Lua 5.1 escrito acá que traduce cada archivo a JS (con lo que agrega GMod: `!=`, `&&`, `||`, `//`,
    `/* */`, `continue`, `goto`); compila el 99,9 % de los .lua de esos addons. Corre aislado (no ve nada del juego salvo
    la API) y con un tope de pasos por llamada (un bucle infinito corta ese script, no el juego).
  - **La API de GMod** (nombres y comportamiento de la wiki pública, escrito de nuevo): Vector, Angle, Color, Entity,
    Player, Weapon, PhysObj, ents, player, util (trazas, efectos), timer, hook, net, umsg, sound, surface y draw (la HUD
    en un lienzo encima del juego), file (data/ en el navegador), cvars, concommand, scripted_ents, weapons, effects,
    baseclass, list, language, vgui (paneles que aceptan todo), weapon_base, base_anim/base_gmodentity/base_ai/base_nextbot
    y el gamemode sandbox con sus hooks, más los cientos de constantes (ACT_, KEY_, MASK_...). Como en GMod, el server y
    el cliente tienen cada uno su tabla de cada entidad y sus hooks y timers; lo que falta de la API no rompe el addon
    (no hace nada y queda anotado para saber qué agregar).
  - **Se carga como GMod**: lua/autorun (los dos lados), autorun/server, autorun/client, después lua/weapons,
    lua/entities y lua/effects (archivo suelto o carpeta con init/cl_init/shared). Las armas y entidades que se pueden
    poner aparecen en la pestaña GMod del menú de props con su nombre y su ícono; un arma va a la mano (si su ViewModel es
    uno de HL2, el del juego con sus animaciones) y dispara, recarga y suena con su código; una entidad se pone con su
    SpawnFunction, tiene cuerpo, cae, piensa (Think), recibe daño, choques (PhysicsCollide) y Usar (E). Si un addon
    necesita modelos de otro, lo avisa.
  - **Medido** con los 76 addons de esa muestra que traen Lua, en una partida simulada (cargar, poner cada entidad, dar
    cada arma y disparar 3 s): **75 sin ningún error de Lua (99 %)**; el que queda depende de otro addon que no estaba
    (GPhone). El Lua cuesta 0,03 ms por cuadro en promedio (el peor, 0,7 ms). En el juego de verdad, Nyan Gun + HBOMBS:
    0,08 ms por cuadro.
  - **Tienda GMod** (Mods y mapas → GMod): el Workshop entero (34 600 addons), con buscador, categorías (armas,
    entidades, NPC, vehículos, herramientas, modelos, efectos...), orden (más suscriptos, tendencia, mejor votados,
    nuevos, actualizados), ficha con foto, suscriptos, tamaño, etiquetas y descripción, Instalar con progreso, Quitar e
    Importar .gma. Steam sólo da como archivo directo uno de cada dos (los más viejos y famosos: M9K, Nyan Gun, FA:S,
    PAC...); **los demás (31 de los 60 más suscriptos: VJ Base, Lightsabers, simfphys, Wiremod, la Base Pack de
    TDMCars...) se bajan dentro de la tienda por SteamPipe** (`tienda/steampipe.js` + `juego/gmod_pipe.js`): la tienda
    (el worker de Cloudflare, gratis y sin tarjeta) entra **anónima** a Steam por su WebSocket (como un servidor dedicado
    de GMod: sin cuenta ni contraseña), pide la clave del depósito 4000 y el código del manifiesto (`/api/gmod/pipe/ID`) y
    se va; el CDN de Steam no deja pedir desde una página, así que la tienda le pone el permiso (`/api/gmod/cdn/...`, sólo
    servidores `*.steamcontent.com` y sólo manifiestos y pedazos). Lo pesado lo hace el juego: baja el manifiesto, descifra
    los nombres, baja los pedazos de a 6, los descifra (AES-256 con WebCrypto), los descomprime en otro hilo (zstd con
    fzstd, LZMA o zip), comprueba cada uno con su SHA-1 y el .gma entero con el suyo. Steam rechaza ese WebSocket si viene
    desde una página (mira el origen), por eso hace falta la tienda. Medido: VJ Base (82 MB) 9,7 s, WAC (88 MB) 13 s,
    Lightsabers (41 MB) 10,6 s en el navegador, sin trabar el juego mientras baja (salto máximo de cuadro 197 ms en el
    navegador de prueba por software); `pruebas/gmod_pipe.mjs` (14/14). Además se instalan solos los **"Required items"**
    que el autor marcó en la página del Workshop (`/api/gmod/requiere/ID`; sin tienda, leyendo la página con el lector), hasta
    dos niveles: un pack de autos de TDMCars trae su Base Pack y los autos salen con pintura, vidrios y luces
    (`pruebas/gmod_requeridos.mjs`, 4/4: 4 autos, 0 texturas faltantes de 139 materiales). Si la tienda no está
    desplegada, los que no tienen archivo directo se siguen importando desde la compu (el .gma de `garrysmod/addons`).
    La tienda se despliega sola: Cloudflare (Workers Builds) está conectado a este repo y a la rama
    `claude/ports-continuation-dm754a`, carpeta `porteos/jxmod/tienda`; cada push la vuelve a desplegar. Steam no deja que una página le pida
    la búsqueda ni los detalles, pero su servidor de archivos (`cdn.steamusercontent.com`) sí deja bajar los .gma: por eso
    la tienda anda sin ningún puente con un **catálogo** que va al lado del HTML (`web/rb/gm_cat.*.bin`, lo arma
    `herramientas/gmod_catalogo.mjs` recorriendo los más suscriptos de cada categoría: nombre, foto, tamaño, suscriptos,
    etiquetas, descripción corta y la dirección del archivo) y baja directo de Steam. Si está desplegado el puente de la
    tienda (`/api/gmod/buscar`, `/detalles`, `/archivo/ID`, sólo hacia los servidores de Steam), busca en vivo en todo el
    Workshop. Sin el puente propio, la búsqueda en vivo de **todo** el Workshop (500 000 addons, con categorías y orden)
    lee la página de búsqueda de Steam con el lector público r.jina.ai (deja pedir desde una página; sólo se le pasa la
    dirección de Steam) y completa cada resultado con el catálogo; la ficha de uno que no está en el catálogo se llena
    sola con su página (suscriptos, tamaño, etiquetas, descripción). Si el lector no responde, la tienda sigue con el
    catálogo. Prueba sin worker ni puente público: `pruebas/gmod_sin_puente.mjs` (10/10).
  - **El contenido base desde Steam** (`juego/gmod_steam.js`, `/api/gmod/base`): lo que un addon da por hecho y no
    está en la biblioteca de al lado del HTML (Kleiner y los ciudadanos de HL2, props de HL2 y sus episodios, armas y
    props de CS:S) se busca en el depósito 4021 del servidor dedicado de GMod (app 4020: gratis y anónimo, como lo baja
    cualquier server; trae `sourceengine/` con HL2, sus episodios y CS:S, y los .vpk de GMod). La tienda da la clave y el
    código; el juego baja el manifiesto y los índices de los .vpk (3,5 MB la primera vez, 74 934 archivos) y, de cada
    archivo, sólo los pedazos de 1 MB del .vpk donde está; de entrada sólo lo que nombran las armas del addon y lo demás
    cuando se usa (la biblioteca ya rehacía lo que esperaba). Todo queda guardado en el aparato: la segunda vez no se
    baja nada. Medido con 8 addons reales (`pruebas/gmod_base_steam.mjs`, 6/6): los modelos que faltaban bajan de 59 a
    21 (14 al volver a abrir; los que quedan son de Portal y de otros addons), Kleiner, los ciudadanos, la bengala, la C4
    y la máquina de Tides salen con malla y texturas, 54 MB la primera vez para los 8 y 0 la segunda.
  - **Lo que da cada addon, como en GMod** (`gmPropsMenu` en `juego/gmod.js`): en el menú van sus armas, entidades,
    NPCs, vehículos y modelos de jugador, y como props sólo los modelos con física (`.phy`) que no son otra cosa del
    addon: ya no aparecen el modelo de mundo de sus armas (que sólo caía y no se agarraba), manos ni pedazos rotos (213
    de 742 modelos de 86 addons reales salen del menú). Un arma tirada en el piso (`ents.Create("weapon_...")` desde Lua,
    de un mod o de HL2) cae con su modelo y **pasando por encima se agarra**, como en GMod (`pruebas/gmod_arma_suelo.mjs`,
    5/5). Props contra el piso: 60/60 de los del menú y 66/66 de los que se sacaron quedan apoyados, ninguno lo atraviesa
    (`pruebas/gmod_props_piso.mjs`, 86 addons). Medido con la tienda publicada: los 210 addons más suscriptos se pueden
    bajar (130 directo y 80 por SteamPipe) y 99 de los 100 primeros de hasta 200 MB se instalan en el navegador
    (`pruebas/gmod_instalar_tanda.mjs`; el que no, un mapa de 192 MB que tardó más de 4 minutos con la máquina cargada).
  - **Addons del server por votación** (panel SM → GMod del server): se busca cualquier addon y se toca Solicitar; a
    todos los de la sala les llega un aviso y, tocándolo, ven el addon con Aceptar y Rechazar. Si la mayoría de los que
    estaban acepta (o a los 60 s hay más sí que no) queda activo en ese server para siempre: todos lo bajan y lo montan,
    el que entra después también, y al irse del server se desmonta (salvo que lo tengas instalado vos). La lista queda
    retenida en la sala (MQTT), en cada navegador y en la tienda (`/api/gmod/sala/ID`); quien la tenga la vuelve a
    publicar si falta. Probado con cuatro jugadores: pedir, aceptar, montar en los tres, rechazar otro, uno que entra
    después y volver con otra sesión (13/13).
  - **Contenido base de GMod y HL2** (`web/rb/gm_lib.*`, lo arma `herramientas/gmod_base.py`; `juego/gmod_lib.js`):
    lo que los addons dan por hecho (manos c_arms, armas y props de HL2, sprites, efectos, sonidos) en trozos que se
    bajan por rango, sólo lo que pide cada addon. Las dependencias de otros addons (bases de FA:S, WAC, TFA...) se
    instalan solas.
  - **Dibujo 3D de Lua, efectos y balas** (`juego/gmod_render.js`, `gmod_vista.js`): render.*, cam.*, mesh, 3D2D,
    partículas, EFFECT, FireBullets con trazadoras y Callback, y la vista propia de cada arma con sus animaciones.
  - **Modelos de jugador como personaje** (`juego/gmod_pm.js`): los .mdl de models/player (o de AddValidModel) aparecen
    en la pestaña GMod; tocándolo sos ése. Por dentro sigue el Hero (física, animaciones, emotes, armas, muñeco de
    trapo) y cada hueso ValveBiped copia su giro, alineado al reposo, con IK de brazos y piernas: manos a 0 cm del arma
    y pies a ≤ 5 mm del piso en todas las poses medidas (Kermit, Iron Man, Nicolas Cage). Sin ValveBiped (Doge), sus
    propias secuencias.
  - **NPCs y vehículos de las listas** (`juego/gmod_spawn.js`): los NPC con su modelo y actitud según la clase (los
    combine persiguen y pegan); los autos se arman del .mdl y su script (carrocería, ruedas que giran, suspensión,
    asiento, masa), los botes con apoyos.
  - **Nextbots** (`juego/gmod_nextbot.js`): el Lua tiene corrutinas de verdad (las funciones se compilan también como
    generadoras: coroutine.yield para en el medio de llamadas anidadas); RunBehaviour, locomoción, Path sin malla de
    navegación (recta a la meta, con piso y obstáculos) y el modelo animado con sus secuencias. Andan SCP-096, SCP-049,
    Walter y Doge.
  - Lo que no se puede: contenido que Steam no deja bajar directo (el Base Pack de TDMCars: sus autos quedan grises) y
    texturas de Counter-Strike: Source. Falta: mapas `.bsp` del Workshop, modos de juego y las herramientas de la Tool
    Gun. Tanda de prueba: `pruebas/gmod_tanda.mjs` (armas, entidades, modelos de jugador, NPCs y vehículos).
    **Medido con los 30 más suscriptos de armas, entidades, NPCs y vehículos: 27/30 andan (90 %)**; armas 45/45, modelos
    de jugador 5/5, NPCs 5/5, vehículos 8/8, entidades 25/30. Los que quedan: el cartel del Minecraft SWEP (errores de
    su Lua), una entidad de Drones y las de Spiderman's Swep (usan texturas de Counter-Strike: Source).
- **Bombas nucleares** (Props → Nucleares; `juego/nucleares.js`, catálogo `herramientas/nucleares.json`, prueba
  `pruebas/nucleares.mjs`, 11/11): 117 bombas y ensayos de verdad (EE. UU., URSS, Reino Unido, Francia, China, India,
  Pakistán, Corea del Norte y algunas de ficción), cada una con su nombre, país, año, potencia (de 10 t a 100 Mt) y tipo,
  con los modelos del HBOMBS de Garry's Mod (18 modelos: Little Boy, Fat Man, Gadget, Tsar, Ivy Mike, Castle Bravo…) y sus
  sonidos. E la arma (sirena y 10 s, 15 en las de megatones; armada, también explota con un golpe fuerte). La explosión
  va escalada a los mapas (radio = 16 × raíz cúbica de los kilotones: Little Boy 40 m, 1 Mt 160 m, Tsar 590 m): destello
  que encandila, bola de fuego (muerte segura adentro), una onda que avanza y empuja, rompe y lastima todo lo que
  alcanza (2,3 radios; nada de afuera), el estruendo con la demora del sonido (medido: 0,42 s a 135 m), el hongo que sube
  y queda flotando (se dibuja aparte del sistema de partículas: 0,18 ms por cuadro uno de megatones) y radiación en las
  de superficie. En el aire la bola no toca el piso; la subterránea no encandila y levanta polvo; la del espacio es un
  destello y una esfera en el cielo. En la sala, el que la tenía avisa y cada uno la ve y recibe lo suyo.
  Sus modelos, texturas y sonidos van en un paquete aparte (`web/rb/p_nuk.*.rbp`, 2,5 MB; prueba
  `pruebas/nuk_paquete.mjs`, 6/6): el HTML sigue pesando lo mismo que antes de las bombas (29,9 MB). Se baja al abrir
  Props → Nucleares o al aparecer una; una puesta antes de que llegue ya choca y cae igual, porque los datos llevan los
  puntos de su casco de choque (los mismos que saldrían de la malla: los 117 cuerpos dan idénticos), y un sonido que
  todavía no llegó suena apenas llega.
- **Maquinitas como las del Hunter** (`juego/maquinitas.js`, prueba `pruebas/maq_vivo.mjs`, 6/6): jugando, el juego se ve
  en vivo en la pantalla 3D del gabinete (el puente de adentro del juego copia su lienzo 8 veces por segundo, en 256 ×
  192, como píxeles en memoria: nada de recursos de la GPU compartidos entre el juego y el mundo, que al cerrar el juego
  tiraban el contexto de WebGL). A la sala va una foto chica (160 × 120, JPEG, ~1,5 mil letras) hasta 4 veces por segundo,
  sólo si hay alguien a menos de 60 m; los demás ven el juego en ese gabinete y al que juega parado adelante, inclinado
  lo justo (los altos más) con la mano izquierda en la palanca y la derecha en los botones (cinemática inversa con sus
  huesos). El que juega queda quieto pegado al panel mientras juega; al dejar de jugar, a los 3 s vuelve la tapa.
- **Filtro de YouTube** (radio y tele; `juego/censura.js`, prueba `pruebas/yt_filtro.mjs`, 8/8): una búsqueda con algo de
  la lista de la censura (menos los insultos suaves: una canción puede llamarse "Stupid Love") o de contenido adulto, gore
  o drogas, en varios idiomas y disfrazada ("p0rn", "s.e.x.y", "+18", "xxx"), no se hace ni sale a internet y el panel
  avisa; de los resultados se sacan al instante los que tienen eso en el título o el canal, y la IA gratis revisa la lista
  y saca lo que no es para un juego con chicos (sexual o insinuante, desnudos, gore o violencia real, drogas, odio,
  autolesión). Lo que pone otro en la sala, un mapa o Verity se revisa igual (si no trae título se lo pide a YouTube); lo
  vetado no suena ni se ve en tu aparato, y si la IA lo veta después, se corta. 24 búsquedas malas bloqueadas y 60 títulos
  normales (canciones, juegos, memes, "Sexta sinfonía", "Middlesex") sin bloquear de más. La búsqueda del worker pide
  además `safeSearch=strict` a la API de YouTube (cuando se vuelva a desplegar).
- **Autos que chocaban contra nada** (`juego/fisica.js`, `juego/mundo.js`, prueba `pruebas/auto_fantasma.mjs`): en los
  terrenos de muchos triángulos el auto frenaba de golpe sin nada adelante (en Colinas 19 de 24 recorridos, en Llanura 16
  de 24). Eran choques falsos contra las aristas internas del piso: el chasis "chocaba" de costado con el borde de un
  triángulo plano, y con el margen de lo que puede moverse en un cuadro (0,7 m a 32 m/s) eso frenaba aunque el auto
  pasara por arriba. Ahora cada arista del mapa se clasifica (lisa: el vecino sigue casi en el mismo plano o sube; filosa:
  borde suelto o cae más de 15°), con el vecino exacto que la comparte o, si no hay (uniones en T), con rayitos cortos; en
  una arista lisa sólo cuenta la cara del triángulo, y el margen contra cada triángulo es lo que el cuerpo se acerca a ese
  triángulo (no hacia cualquier lado). Resultado: 0 frenazos fantasma en los 17 mapas (24 recorridos por mapa); los que
  quedan son de verdad (paredes, palmeras, subir de golpe una rampa de 44°, quedar encajado bajo una mesa, caer de un
  salto). Las celdas de la grilla con miles de triángulos (rocas) tienen una subgrilla, así que la física no cuesta más:
  8 autos en Colinas, 1,0-1,2 ms por paso (antes 1,2-1,4 ms; `pruebas/fisica_costo.mjs`).
- **El celular** (`juego/celular.js`, como el de GTA 5; prueba `pruebas/celular.mjs`, 7/7): el botón al lado del chat
  (o la O) lo sube desde abajo a la derecha con sus apps: **Objetos** (como el celu de Simple Sandbox 2: tocás uno y
  aparece adelante tuyo, el celular sigue abierto), **Memes** (el pad; la I abre directo ahí), **Jugadores** (los de la
  sala; el dueño del server puede **echar** a alguien: le llega, sale y no puede volver a entrar a ese server por 30
  minutos; si igual manda, se lo vuelve a echar y no se lo dibuja), **Emotes**, **Cámara**, **Mods** y **Ajustes**. Se
  puede caminar con el celular abierto; tocar afuera, la X o el botón de inicio lo guarda.
- **Catapulta** (como la de Simple Sandbox 3; Props → Diversión; `juego/artefactos.js`, prueba `pruebas/artefactos.mjs`,
  9/9): E la dispara: el brazo gira sobre su eje y lo que está en la cuchara (una caja, un muñeco, gente o vos) sale
  volando para adelante y arriba (una caja pasa los 8 m); el brazo vuelve solo. Modelo generado (imagen → 3D) en dos
  piezas: la base con su choque de chasis y el brazo, que gira sobre el eje de la base (la cuchara se busca en la malla:
  la punta más ancha).
- **La bomba de Rick Prime** (el aparato Omega de Rick and Morty; Props → Diversión): E abre la lista de personajes y
  elegís a cuál borrar; cuenta 5 segundos con pitidos y luz verde y explota en un destello verde que elimina a **todos**
  los de ese personaje (gente de la partida, NPC, otros jugadores y vos si sos ese), sin tocar a nadie más. En la sala la
  catapulta y la bomba pasan para todos.
- **Emotes en primera persona** (`pruebas/emote_primera.mjs`, 4/4): hacer un emote ya no pasa a tercera persona: se ve
  tu cuerpo (con la cabeza achicada a nada) sin el arma en la mano, y la cámara sigue al hueso de la cabeza (16 cm
  adelante) para que se vea el baile desde tus ojos. Al terminar vuelve todo.
- **Tool Gun → Cámara** (`pruebas/camara_tool.mjs`, 7/7): clic pone una cámara en un trípode, congelada, con el lente
  hacia donde mirás; clic derecho mira por tus cámaras una por una (desde el lente, con la inclinación que tenías al
  ponerla; se ve tu cuerpo entero y no el arma) y después vuelve a tus ojos. Si la borrás o cambiás de arma, volvés a
  tus ojos. Los demás ven las cámaras (son objetos); lo que se ve por cada una es de cada uno.
- **Patadas** (`juego/patadas.js`; prueba `pruebas/patadas.mjs`, 11/11): F a pie (en un vehículo F sigue siendo bajar) o el
  botón del pie en el celular. Es la patada del juego (el clip "Kick", su tramo del golpe al doble de velocidad: 0,64 s,
  casi quieto mientras dura). A los 0,2 s, con la pierna estirada: empuja los props que tenés adelante (la caja sale a
  9 m/s), le saca 20 de vida a la gente (con el golpe, su voz y un empujón), tira lejos a los muñecos; no se repite antes de
  0,75 s. En primera persona se ve la pierna (el cuerpo a la vista con la cabeza y los brazos achicados a nada, que
  tapaban la cámara) y vuelve todo al terminar. Los demás la ven por el estado del jugador.
- **Menús**: todo menú grande tiene una X arriba a la derecha; tocar afuera lo cierra y se sigue jugando (el chat también,
  sin mandar nada); poner un prop no cierra el menú de props (`pruebas/menus_x.mjs`, 6/6).
- **gm_construct**: parado en una loma ya no te resbalás (los pies sobre piso caminable se sacan sólo para arriba; antes
  bajabas hasta 1,2 m en 5 s), y nadar con la cámara un poco hacia abajo (hasta 20°, como queda en el celular) te deja en
  la superficie en vez de llevarte al fondo; más inclinada se bucea (`pruebas/nado_lomas.mjs`, 5/5).
- **Agarrar**: girar se prende y se apaga con un toque (no hay que mantener); sosteniendo algo con la pistola de física o la
  de gravedad aparece el botón **volver** (R en la compu) que lo deja donde estaba al agarrarlo; la tele, la radio o el
  piano propios se borran con el tacho (Supr en la compu) apuntándolos (`pruebas/agarre_volver.mjs`, 5/5).
- **Sonidos de HL2 de lo que hacés**: saltar (el paso), caer (golpe sordo; de muy alto, el quejido), cambiar de arma, usar
  sin nada adelante, arrancar a correr, la linterna; los pasos propios suenan más (`pruebas/sonidos_accion.mjs`, 7/7).
- **HTML liviano: paquetes aparte** (`herramientas/remotos.py`, `datos.js` `rbAsegurar`; prueba `pruebas/paquetes.mjs`,
  8/8): los personajes que no son el Hero y los mapas grandes (mallas y texturas; la pizzería con sus animatrónicos y sus
  sonidos) y los sonidos de los memes salen del HTML a archivos sueltos en `web/rb/` (56, 27 MB en total). El juego
  los baja cuando hacen falta: al entrar a un mapa o con un personaje (la pantalla de carga muestra los MB), cuando otro
  jugador usa uno (mientras tanto se ve el Hero y cambia solo al llegar) y al abrir el pad de memes. Se guardan en la caché
  del navegador (el nombre lleva el contenido: nunca quedan viejos). Abierto desde GitHub los busca al lado; abierto como
  archivo, en GitHub (hace falta internet la primera vez). **El HTML pasó de 62,9 a 27,6 MB.** `RB_ENTERO=1` arma el de
  antes, con todo adentro.
- **Lo que apuntás brilla sólo en los bordes, en azul** (como la Gravity Gun) en vez de teñirse entero; el menú de props
  ya no se cierra al poner uno (abajo dice qué pusiste y cuántos).
- **Personajes de terror analógico** (Personajes; prueba `pruebas/skins_dn.mjs Bon,Sha,Alternate,Partygoer,Bacteria`):
  Bon y Sha (The Walten Files), un Alternate (The Mandela Catalogue), un Partygoer y la Bacteria (The Backrooms). Imagen
  en pose T desde la referencia de la wiki (o desde la descripción), modelo 3D riggeado (Meshy), `skin_meshy.py --alto`
  (Bon 2,24 m con las orejas, Sha 1,96, Alternate 1,82, Partygoer 1,94, Bacteria 2,47), `dedos_meshy.py` y LOD.
  Voces: Bon y Sha de robot, los otros de monstruo.
- **Pies que no se hunden** (`personas.js`): el alto del tobillo se cuenta desde la suela de verdad (lo más bajo de la
  malla en reposo, que en algunos personajes baja del 0) y cada pie apoya también sobre su talón y su punta (tomados de
  la malla de cada uno): al caminar, el talón o la punta de un pie largo (un disfraz, zapatos) ya no bajan del piso.
  Caminando, lo más bajo del Hero pasó de 11,5 cm abajo del piso a 6,2 (el Hero, los 5 nuevos y Jeppy, Sunman y
  Filbus: entre 4,2 y 7,3).
- **Pad de memes** (`juego/memes.js`; prueba `pruebas/memes.mjs`, 11/11): el botón al lado del chat (o la I) abre un
  soundboard con 36 memes (Vine boom, Bruh, Oof, el tubo de metal, MLG, Emotional damage, Sus, Taco Bell, Ete sech,
  Chupapi, Eso Tilín...). Tocar uno lo hace sonar desde tu personaje para los que están cerca (3D, con oclusión) y sale
  en el chat con su botoncito de color; uno cada 0,8 s. Los incluidos van en el paquete (485 KB, mono 48 kbps) y se
  decodifican recién al tocarlos (todos juntos ocupan ~15 MB decodificados). **Mis memes**: cualquier audio corto del
  aparato (hasta 8 s y 400 KB) queda guardado en el navegador; en la sala viaja de a pedazos la primera vez que suena y
  del otro lado suena cuando termina de llegar. Los de los demás se pueden silenciar (siguen saliendo en el chat).
- **Sonidos de los personajes y del ambiente** (`juego/sonidos.js`, los de Half-Life 2 de GMod 10; prueba
  `pruebas/sonidos.mjs`, 11/11):
  - **Pasos según el piso**: cada triángulo del mapa (y cada caja de choque) sabe de qué es: en los mapas de GMod, su
    `$surfaceprop` de Source (lo mismo que usa HL2: el terreno de gm_construct suena a arena, el piso de adentro a
    hormigón); en los otros, por el nombre del material (pasto, tierra, arena, metal, madera, baldosa, grava u hormigón);
    parado sobre un prop, el del prop. El paso se alarga con la velocidad (0,72 m caminando: 1,75 pasos por segundo; 1,5 m
    corriendo a 6 m/s: 3,75) y al caer suena uno fuerte. Los tuyos, en la cabeza; los de los demás (y los NPC), donde están.
  - **Voces** de dolor y de muerte según el personaje: hombre o mujer (los ciudadanos de HL2), robot (Robot y los
    animatrónicos) o monstruo (zombi, The Boiled One, Sunman, Filbus); tirado ya no habla. Algunos emotes hablan: el saludo
    ("hi"), el festejo, el no y el grito.
  - **Ambiente por mapa**: viento y pájaros en el campo (ranas y bichos de noche), viento fuerte con ráfagas en el
    desierto y en Marte, la ciudad con camiones que pasan, el zumbido de adentro en las bases y la estación, un tono en la
    Luna; bajo techo, el de afuera más bajo; en la pizzería, los suyos. Los bucles ya no hacen un hueco al dar la vuelta (el
    silencio que trae el mp3 en las puntas se saltea).
- **Maquinitas con juegos HTML** (`juego/maquinitas.js`; prueba `pruebas/maquinitas.mjs`, 13/13): el gabinete Arcade se
  usa (E o el botón de usar: "E: Jugar") y abre la **biblioteca**: los juegos que trae RezoBox (Serpiente, Ladrillos y
  Meteoros, hechos para el juego), **Mis juegos** (importar un .html o una dirección https; se guardan en el navegador,
  IndexedDB, hasta 3 MB), los **de la sala** y los **de la comunidad** (la tienda). El juego elegido queda puesto en el
  gabinete (su tapa se ve en la pantalla de la maquinita) y se juega **en el medio de la pantalla con el mundo atrás**
  (ocupa un tercio): el HUD de siempre se va y en el celular aparecen **la palanca, la cruceta, A B X Y, Select y Start**,
  que le llegan al juego como **teclas de PC** (Flechas + Espacio/Z/X/C, WASD + Espacio/E/F/Q, o mouse tocando la
  pantalla del juego; se cambia en la barra de arriba y queda guardado en el juego). En la PC, el teclado va directo.
  - **Aislado**: cada juego corre en un iframe sandbox sin permiso de mismo origen (no puede leer la página, tus claves
    ni tu almacenamiento: probado); un puente chico adentro recibe las teclas (con su keyCode, para los juegos viejos) y
    le da un localStorage en memoria para que los récords no rompan el juego.
  - **En la sala**: el gabinete avisa qué juego tiene (también en el estado del mundo, para los que entran después) y
    quien lo puso le pasa el HTML a quien lo quiera jugar, comprimido y de a pedazos de 24 mil letras (8 por segundo).
  - **La comunidad**: "Publicar" sube tus juegos a la tienda con el formato nuevo `rezobox-juego` (`tienda/formato.js`
    y `worker.js`); **la tienda de internet tiene que volver a desplegarse** (`wrangler deploy` en `tienda/`) para
    aceptarlos y listarlos: hasta entonces la pestaña Comunidad lo dice y no muestra nada equivocado.
- **Materiales "sin luz" negros en calidad Media**: sin posproceso, los sombreadores sin sol nunca recibían la exposición
  (quedaba en 0) y las tapas de YouTube de las pantallas, por ejemplo, salían negras. Ahora se pone en todos.
- The Boiled One: el vaivén al deslizarse es más chico (4,2 % ± 0,8 % del alto): con ±1,5 %, según en qué momento
  arrancaba, a veces bajaba a menos de 2 cm del piso.
- **15 props de Half-Life 2** (Props → HL2; prueba `pruebas/props_hl2.mjs`, 8/8): sandía, barril explosivo, barril,
  caja de madera, caja de cartón, cono, neumático, bloque de cemento, carrito, bidón de nafta, garrafa, sierra circular,
  radiador, lavarropas y contenedor de basura, con sus modelos y texturas de HL2 (bajados de adentro del RAR de GMod 10
  en archive.org archivo por archivo con `herramientas/bajar_hl2.py`) y su ícono. Cada uno con la masa de HL2, su densidad para el agua (la sandía, el barril, la
  caja y el neumático flotan; el bloque, la sierra, el carrito y el radiador se hunden) y su sonido de golpe; el barril
  rojo, el bidón y la garrafa explotan a los tiros. Los redondos chocan con un casco "fino" (los extremos en 48
  direcciones parejas en vez de 14): apoyan con la malla a ≤ 2 cm del piso (antes la sandía se hundía 5,5 cm y el
  carrito 10). El conversor ahora lee los .vmt con valores de varias partes sin comillas y con fin de línea de Windows.
- **Agua de verdad** (`juego/agua.js`; prueba `pruebas/agua.mjs`, 22/22): el lago de gm_construct (el volumen de agua
  que trae el mapa) y lo que tienen adentro los recipientes nuevos de Props → Agua (cubeta, tina y dos bañeras de HL2).
  - **Nadar** como en Source: se va hacia donde mira la cámara, el salto sube y agacharse baja; sin tocar nada flota con
    los ojos 12 cm afuera; al caer el agua frena enseguida (se hunde 40 cm y vuelve). Vadeando con el agua a medio cuerpo
    se camina más lento (59 % a 1 m). Debajo del agua: niebla de cerca del color del agua (16 m), sin cielo, el sonido de
    abajo del agua y el aire dura 12 s; después se ahoga de a 10 por segundo, como en HL2. Salir: saltando contra la
    orilla. El cuerpo nada con dos capturas de CMU (la brazada acostado, 126_04, y flotando parado, 79_02) mezcladas por la
    velocidad y en el tramo que mejor se repite; acostado, la cadera va 8 cm abajo del agua.
  - **Lo que flota**: el empuje con 27 puntos por cuerpo (los que caen adentro de su forma) una vez por paso de física
    (20 cosas en el agua: 0,06 ms por paso). La madera (los props livianos) flota como mucho a 700 kg/m³, como en GMod
    (la caja: 71 % abajo); lo liviano, como corcho (el sofá: 25 %); lo muy pesado se hunde; los muñecos flotan como una
    persona. El agua frena los giros y el subir y bajar: un sofá que cae al lago queda quieto en ~5 s. Al entrar rápido,
    salpica (gotas, espuma y el sonido de HL2).
  - **Recipientes**: se llenan metidos en el agua (la cubeta: 41 l en menos de 4 s), pesan con el agua, no pierden
    parados y se vuelcan por el punto más bajo del borde: chorro de gotas con su sonido, que caen en otro recipiente (se
    suma) o en el piso, donde hacen un **charco** que corre hacia lo bajo (una grilla de 6×6 m de agua poco profunda, con
    2 mm que se quedan en cada celda como la tensión superficial) y se seca solo. En una bañera con agua las cosas flotan
    adentro (las bañeras chocan con paredes; la cubeta y la tina, con su casco).
  - **El dibujo**: ondas que se mueven (cuatro trenes de ondas en el sombreador, más suaves a lo lejos), Fresnel (de
    frente se ve el fondo, de costado refleja), el brillo del sol y, en Alto y Ultra, **el reflejo de la escena** (dibujada
    espejada a un tercio o a la mitad de la resolución, con el plano cercano oblicuo para cortar lo de abajo del agua). Se
    ve de abajo al bucear. Anda en todas las calidades y en WebGL 1.
- **2175 emotes de captura de movimiento** (la base de CMU, conversión BVH "Poser-friendly" de B. Hahne, dominio
  público) con **panel por secciones**: Todos, Favoritos, Recientes, Clásicos, Bailes, Gestos, Acciones, Peleas,
  Deportes, Acrobacias, Animales, Caminar y correr, Otros, Míos y Tienda, con buscador (en todas las secciones), la
  cuenta de cuántos hay, la estrella para guardar favoritos y los últimos 30 usados (guardados en el navegador). Se
  dibujan de a 120 tarjetas (con "Ver más") para que el celular no se trabe.
  - `herramientas/emote_bvh.py` los pasa al esqueleto del juego como `emote_meshy.py` (cada hueso copia la orientación
    de su equivalente, con la diferencia entre la pose T del BVH y la de enlace del Hero; Spine1 a mitad de camino), a
    15 cuadros por segundo y hasta 20 s, en el lugar. La altura de la cadera se mide sobre el piso de cada captura (lo
    más bajo del cuerpo en cada cuadro, el 20 % más bajo); acostado o en cuatro patas sobre algo (una cama) se baja
    hasta apoyar. No van los que no tienen nombre ("Unknown"), los que necesitan muebles u objetos que en el juego no
    están (camas, sillas, escaleras, juegos de plaza...) ni los que tienen saltos de los marcadores.
  - No van en el HTML: cada uno es un archivo chico (gzip, rotaciones y cadera como diferencias int16 con los bytes en
    planos, ~13 KB) en `web/emotes/cmu/` (29 MB los 2175), al lado del HTML; en el HTML va sólo el catálogo (nombre,
    sección, duración). Se bajan la primera vez que se eligen (de al lado del HTML, o de githack si se abre como
    archivo) y quedan guardados en el navegador. Andan en red (el otro jugador baja el mismo).
  - En un emote de captura ninguna parte del cuerpo queda abajo del piso (cadera, torso, cabeza, manos, puntas de los
    dedos, rodillas, pies: se sube lo que haga falta). `pruebas/emotes_cmu.mjs` 11/11 (catálogo, secciones, buscador,
    favoritos, se bajan y decodifican cuaterniones válidos, el cuerpo se mueve, pies en el piso en caminatas, bailes y
    peleas, acostado o rodando sin flotar ni hundirse).
- **Carga más rápida y HTML más liviano**: con los cinco personajes nuevos adentro el HTML pesa 51,8 MB (sin el filtro
  de abajo serían 55,6). Bajando a 3 MB/s con la CPU 4 veces más lenta (como un celular), el juego queda listo a los
  18,7 s en vez de 22,4 s, y lo que falta después de que termina de bajar pasó de 3,4 s a 1,1 s:
  - el código del juego va antes que el paquete: mientras el HTML sigue bajando arranca el motor gráfico (WebGL y los
    shaders), cada pedazo de 1 MB del paquete se decodifica apenas termina de llegar y la parte de las mallas entra al
    descompresor del navegador a medida que llega; los datos (lo primero del paquete) se leen apenas están enteros;
  - los índices de los triángulos van como diferencias en zigzag con los bytes en planos, en el mismo lugar y con el
    mismo largo (`armar.py`), y el juego los vuelve a armar al cargar (`desfiltrarIndices`): las mallas comprimidas
    bajan de 19,9 a 17,1 MB. Lo que queda en memoria es idéntico byte a byte (Adler-32 igual al del paquete).
- **Personajes de Doctor Nowhere: Jeppy Jothers, Uncle Jeppy, Sunman, Filbus y The Boiled One**, fieles a las
  referencias de la wiki (la imagen en pose T de cada uno se comparó con la referencia y la descripción: Jeppy con la
  cabeza de sol, la nariz rosa y las botas; Uncle Jeppy con 11 rayos ondulados, frac y zapatos enrulados; Sunman con
  los rayos finos, los ojos chicos y la sonrisa ancha; Filbus con la galera y patas de silla; The Boiled One como en el
  original: una columna negra altísima con púas, sin brazos ni piernas, la cara roja derretida y pelos negros). Cada uno
  con su alto: Jeppy 1,64 m (canon 1,68), Uncle Jeppy 2,15 m, Sunman 2,5 m, Filbus 1,8 m, The Boiled One 2,9 m.
  - **The Boiled One tiene manos flotantes y se desliza**: el modelo vino sin riggear y `herramientas/rig_flotante.py`
    le arma el esqueleto: el cuerpo pesa en la columna (y los pelos en la cabeza), cada mano suelta pesa en su hueso de
    la mano, los brazos son invisibles (van del hombro a la muñeca) y las piernas quedan adentro de la base. Así sostiene
    armas, saluda y baila con las manos sueltas. `skin_meshy.py --flota` lo marca en `DATA.tam`: no usa las animaciones
    de caminar ni correr (sigue con la de quieto), al moverse se inclina hacia donde va (hasta 9°) y se despega del piso
    3-8 cm con un vaivén lento; al frenar se vuelve a apoyar; no se agacha (sin piernas se hundiría) ni clava los pies.
  - A Uncle Jeppy el modelo 3D le dejó manchas en relieve en vez de la cara: `herramientas/cara_glb.py` aplana esos
    bultos contra el plano de la cara (un disco inclinado: mira hacia arriba, como en la descripción) y la repinta
    proyectando de frente la imagen de la que salió (ojos cerrados, nariz de pico y sonrisa).
  - **Los altos chocan como el Hero**: el cuerpo para chocar no pasa de 1,9 m, así pasan por las puertas (Sunman pasa
    por una de 2,05 m); se ven más altos y los ojos van a su altura, pero abajo de un techo, una viga o una puerta bajan
    antes de llegar (se mira arriba donde está y donde va a estar en medio segundo), a lo sumo 2 m/s y sin saltos.
  `pruebas/skins_dn.mjs` (altos, pies apoyados parados y caminando, el deslizamiento de The Boiled One, la puerta).
- **Cuerpos que desaparecían de cerca**: algunos personajes (SpecialForces, Prisoner, Engineer, Soldier) tienen la malla
  en centímetros que los huesos agrandan ×100 y la esfera para descartar lo que no se ve medía 2 cm: al mirar de cerca
  una mano, sin la cadera en pantalla, desaparecía el cuerpo entero (quedaba el arma flotando). Ahora el radio lleva la
  escala de la piel.
- **Controles en el celular**: en un aparato sólo táctil ya arrancan los de la pantalla (antes primero se veía la fila
  de la compu con las teclas). Tamaño elegible en Ajustes (60 a 120 %, de entrada 80 %: los del JXMod quedaban
  grandes); se achican en el mismo lugar (el centro de cada botón no se mueve) y la barra de armas, la vida, la palanca
  y el estado de Verity siguen la misma escala.
  **Disparar y moverte ya no da vuelta la cámara**: el botón de disparo deja mirar arrastrando, pero tomaba también el
  dedo de la palanca (los dedos que se mueven en un mismo evento llegan todos juntos) y la cámara saltaba hasta 172°
  de golpe. Ahora cada control atiende sólo su dedo (el disparo, desde que lo apretás: sin perder el primer tramo ni
  guardar el dedo de un toque cancelado), y el retroceso del arma no pasa del tope de mirar arriba
  (`pruebas/disparo_mover.mjs`, acostado y parado).
- **Mods oficiales desde la tienda**: ya no vienen todos puestos (la tienda quedaba vacía). En Mods y mapas → Explorar
  aparecen primero los oficiales en orden (Verity, Goku, la radio, la tele, el piano, volar, Cíclope, muñeco, SCP, salto,
  velocidad, luna, dios, cámara lenta, munición, explosiones) y después los de la gente; se instalan con un toque (los que
  cambian cómo jugás quedan prendidos) y se quitan. `INST.of` guarda los oficiales instalados; la primera vez con esto
  quedan los que ya tenías prendidos. Instalados: los prendidos primero y después por nombre (igual en el menú MOD).
  En los servers siguen estando todos (SM). Sin assets instalados, la sección Mods del menú de props dice dónde se consiguen.
- **Tele**: el hueco del video se recorta con la prueba de profundidad de la placa (una máscara con la profundidad de la
  escena pegada) en vez de leer la textura de profundidad, que en muchos celulares tiene poca precisión y daba franjas
  negras parejas; la tapa de atrás va al fondo del marco. Si el video se frena solo (el navegador lo pausaba al no
  verse, o se cortó la carga) sigue, y si quedó más de 6 s atrás salta al tiempo de todos.
- **HUD**: se reacomoda cuando cambia cuáles botones hay (no cuántos): si aparecía SM y se iba otro a la vez, SM quedaba
  sin ubicar encima de pausa.
- **Pantalla de carga estilo Garry's Mod** (en `template.html`, antes del juego y sin depender de él): capturas del juego
  de fondo que se van fundiendo (`PAQUETE/carga/N_rb_mapa.jpg`, fuera del repo; `armar.py` las mete), el logo, consejos,
  la consola con cada paso terminado y lo que cargó (tiempos y números reales: archivos, MB, modelos, animaciones,
  mapas, resolución), el estado ("Montando el contenido...", "Compilando shaders...") y la barra abajo. El paquete va
  en pedazos de 1 MB, así mientras baja el HTML se ve "Descargando el juego... 12.0 / 27.4 MB" (el 40 % de la barra);
  antes se quedaba en 0 % todo lo que tardaba en bajar. Vigilante: si un paso no avanza en 25 s, o el juego no llega a
  arrancar, muestra qué pasó con Reintentar, Modo liviano y Seguir esperando. Al entrar a una partida o a un server
  vuelve a aparecer (`entrarConCarga`): nombre del server, la captura de su mapa, "Recuperando la info del server",
  "Cargando el mapa" y "Enviando la info del cliente" hasta que conecta (4 s como mucho).
- **La intro de JXStudios** (volvió): antes de la pantalla de carga, mientras baja el juego, la intro procedural de
  siempre (chispas, el aro cromado que se dibuja, el monograma JXS, «JXStudios», «J X S T U D I O S» con las líneas) y al
  final el logo de Definitive RezoBox; dura 5,8 s y se saltea tocándola. Si el juego termina de cargar antes, la pantalla
  de carga espera a que termine. En las pruebas (`?test`) no sale.
- **Celular parado: todo girado 90° desde el primer cuadro.** Antes el giro lo ponía el juego al terminar de cargar, así
  que mientras bajaba (en un celular, buena parte del rato) la pantalla de carga se veía derecha. Ahora lo pone la pantalla
  de carga apenas abre, con la misma regla que el juego; sus medidas usan las del ancho y alto girados (`--vw`, `--vh` y las
  clases `bajo`/`angosto` en vez de media queries, que miran el aparato parado).
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
  duerme si se cansa y piensa en voz alta cada tanto. Es un bot: no sigue a nadie (salvo que se lo pidan, un minuto) y va
  hasta el que le habla. Se la agarra con la pistola de física o la de gravedad (tiene un cuerpo de esfera: congelado
  mientras anda sola; agarrada la mueve la pistola, tirada cae y rebota hasta quedarse quieta y vuelve a flotar, y con
  clic derecho queda congelada en el aire 20 s); los tiros la empujan. Ocho animaciones en su
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
  habla con la voz del aparato (si el aparato tiene una voz natural, como las de Edge o las "mejoradas" del iPhone,
  se usa ésa antes que la de la tienda). En cada sala hay una sola Verity para todos, aunque nadie tenga el mod: la
  maneja un jugador (el que ya la tenía o, si nadie, el de id más chico; los demás esperan su turno) y viaja en su
  estado (`vr`: posición, giro, cara, animación); si se va, la sigue otro desde donde estaba. Lo que dice va en `verd`;
  los demás le hablan con `verq` (chat, panel o voz), le piden animaciones con `vera`, la llaman con `verw` y, si la
  agarran o la empujan, mandan dónde está con `verg`. Cualquiera le puede pedir cosas (la hora no: es de cada uno). Pruebas:
  `verity.mjs`, `red_verity.mjs` y `verity_publica.mjs` (con `TIENDA_SIM` = carpeta con el token y la cuenta de Cloudflare,
  el worker corre de verdad en Node con D1 y caché de mentira).
  **Gemini**: con la clave de Google AI Studio del dueño como secreto del worker (`GEMINI_KEY`, nunca en el juego ni en
  el repo) Verity piensa (`gemini-3.5-flash-lite`) y habla (`gemini-3.8-flash-lite-tts`, voz natural en cualquier idioma)
  para todos en los tres primeros servers (`VERITY_PREMIUM`) y, en cualquier lado, para el que tenga el permiso del
  dueño: un terminal secreto (aparece buscando "terminal" en los props) donde se escribe su código; la tienda lo revisa
  (`/api/verity/llave`, 10 intentos por día; el código y el permiso salen de la clave con HMAC, no hace falta otro
  secreto) y devuelve un permiso firmado. Topes: 4000 charlas y 1200 frases por día con Gemini. Además cada jugador puede
  poner su propia clave en el panel de Verity (sección IA, con un tutorial en los 14 idiomas): el juego le habla directo
  a Google desde su aparato. Prueba: `verity_gemini.mjs`.
  **Verity crea** (`veritycrea.js`): mods (efectos y mecánicas en código para la API de mods), construcciones (props y
  entidades a medida delante tuyo o, en el creador de mapas, donde mirás) y animaciones (las arma en el editor). Se le
  pide charlando (la acción `crear`; en una sala, la Verity del que la maneja se lo manda al que lo pidió con `verc` y
  él lo crea con su cerebro), desde su panel (Crear mod / Construir / Animación), con el botón Verity del creador de mapas
  y el del editor de animaciones; "cambiar" rehace lo último. El pedido (`/api/verity/crear`, 30 por persona por día)
  sigue la IA elegida (tus claves, la tienda, los gratis sin clave y, al final, Workers AI o Pollinations). Lo que vuelve se revisa (`verityCreacion` en `formato.js`): el mod pasa por
  `validarRB`, su código se compila antes (si falla se le pide que lo arregle una vez) y corre aislado como cualquier mod;
  la construcción usa el tamaño real de cada prop (apoyado por su base, sin huecos); la animación son direcciones de
  brazos y muslos en el marco del personaje, codos y rodillas en grados (0 = derecho) y giros de cuerpo, torso y cabeza,
  que se pasan a huesos midiendo el muñeco del editor (sirve para cualquier personaje). Prueba: `verity_crea.mjs`
  (17 poses medidas en 4 personajes, construcción, mod; con `GEMINI` y `TIENDA_SIM`, de punta a punta).
  **Qué IA piensa (menú IA de su panel)**: Auto, Gemini, DeepSeek, Gratis sin clave o Mis claves. Las del dueño van en
  la tienda como secretos y son para todos (Gemini `GEMINI_KEY`; `DEEPSEEK_KEY`; opcionales `GROQ_KEY`, `CEREBRAS_KEY`,
  `OPENROUTER_KEY`, `MISTRAL_KEY`, `GITHUB_MODELS_KEY`; el modelo se cambia con `*_MODEL`); `/api/verity/ias` dice cuáles
  andan (una sin cupo o sin saldo descansa y se usa la siguiente; al final, Workers AI). Ya puestos para todos, sin
  clave y desde la conexión de cada jugador: OVHcloud AI Endpoints (gpt-oss-120b, Llama 3.3 70B, Qwen; 2 por minuto por
  modelo), LLM7 y Pollinations (`VERITY_LIBRES`). Cada uno puede sumar su clave de Google AI Studio, DeepSeek, Groq,
  OpenRouter, Mistral o Cerebras (`VERITY_CLAVES`; el juego les habla directo, la clave queda en su aparato). Todos
  piensan sin apuro: Gemini con `thinkingLevel: high` (charla con `gemini-3.5-flash-lite`, crear con `gemini-3.5-flash`
  y 65 536 tokens), los gpt-oss con `reasoning_effort: high` al crear, y crear no tiene corte práctico (15 minutos);
  las construcciones llegan a 600 props y 40 entidades, las animaciones a 60 s. Una respuesta cortada a la mitad se
  rescata hasta el último elemento entero (`rbCerrar`). Para crear, Gemini contesta en partes
  (`streamGenerateContent`, `verityLeerSSE`): llegan los resúmenes de lo que piensa, así se sabe que sigue vivo; si un
  modelo se queda callado 2 minutos se corta y se prueba el siguiente; y la tienda le manda al juego un espacio cada
  10 s mientras tanto, para que ninguna conexión se corte por quieta. En la capa gratis de Google cada modelo tiene su
  tope por día (los Flash, 20 pedidos por día cada uno; los Flash-Lite, bastante más): se turnan (`VERITY_GEMINI_CREA`,
  `VERITY_GEMINI_VOCES`), uno sin cupo del día queda afuera hasta el otro día, uno saturado o sin cupo por minuto unos
  minutos, y cuando no queda ninguno siguen los gratis sin clave.
  **La X**: mientras Verity habla, piensa, te escucha o crea (con el tiempo que lleva), arriba a la derecha aparece su
  cartelito con una X que la corta (voz, respuesta pendiente, creación). El panel se desplaza por dentro con la X
  siempre visible en la esquina; los cuadros de crear, tutorial y terminal también tienen su X arriba.
- **Skins riggeados de verdad** (`herramientas/skin_meshy.py`): el modelo 3D se riggea aparte (esqueleto tipo mixamo con
  sus pesos) y se lleva a la pose de enlace del Hero girando cada hueso con sus propios pesos, sin estirar la malla (lo
  que dejaba los brazos "espaguetizados"); las articulaciones del juego van donde quedan en esa malla y la cadera a la
  altura de la del Hero. Así entraron Goku y Cíclope rehechos y seis nuevos: Astronauta, Ninja, Robot, Zombi, Bombera y
  Pirata. Después, seis de Dragon Ball junto a Goku en Personajes: Broly (legendario), Vegeta, Gohan (adolescente, SSJ2),
  Piccolo, Freezer y Trunks del futuro (imagen en pose T → modelo 3D riggeado → `skin_meshy.py`; el retrato sale de la
  misma imagen). Los datos van sólo en el HTML; `skin_meshy.py` también copia los fondos de la pantalla de carga.
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
- **Controles como el original** (`hud.js`): cada botón en el lugar del PlayerCanvas del juego (referencia
  1280×720, escalado como su CanvasScaler) con íconos propios en vector: pausa y chat arriba a la izquierda, props a la
  izquierda al medio, disparo grande, saltar y borrar abajo, arma, cámara y emotes arriba a la derecha; con la pistola de
  física girar, congelar, acercar y alejar; en un auto pedales, doblar, freno de mano y bajarse.
- **Controles a gusto** (`juego/controles.js`, Ajustes → Controles): **Teclado**: cada acción con su tecla (se toca y
  se aprieta la nueva; si estaba en otra acción, se cambian; "volver a los de fábrica"). **Pantalla táctil**: "Editar
  los botones" muestra todos los botones (a pie o en vehículo) y cada uno se arrastra a donde se quiera y se agranda o
  achica con dos dedos o con la barra; se guarda en el aparato; también el tamaño de todos y el de la palanca. **Tienda
  de controles**: se publican los propios con un nombre y se buscan y usan los de otros (botones, tamaños y teclas;
  `/api/controles` en la tienda, todo revisado: sólo números y nombres de teclas). **Botones de los mods**: con un arma
  de un mod de GMod en la mano aparece apuntar (el secundario) y hasta 4 botones con lo que mira su Lua (E, F, zoom,
  correr, caminar...: `IN_*` y `KEY_*` del arma y de su base), que le llegan al Lua como esas teclas y también se pueden
  mover. Prueba: `pruebas/controles.mjs` (11/11: la X salta y el espacio ya no, el botón queda donde se arrastró con
  ±0,1 px y 1,5 veces más grande, sigue igual al volver a abrir, publicar, encontrar y usar de la tienda, M9K agrega
  apuntar, E y correr y apretarlos le llega al Lua).
- **Teléfono parado (el juego girado 90°)**: el celular en la mano, la HUD que dibujan los addons, `ScrW`/`ScrH`,
  `ToScreen`, el editor de animaciones y girar el personaje en Personajes usan las medidas del juego girado (`VW()`,
  `VH()`, `tX`, `tY`), no las del aparato: antes el panel del celular quedaba de costado y el celular en la mano se veía
  negro. Prueba: `pruebas/girado.mjs` (11/11: las esquinas del celular en la pantalla iguales a las de un teléfono
  acostado del mismo tamaño, ±0 px; el panel justo encima del celular 3D en el aparato; la pantalla se ve; la HUD de los
  addons a 873×393; arrastrar gira el personaje). La versión de antes daba 6/11.
- **Cámara libre (L y R) y primera persona**: si algo pasa a primera persona con la cámara libre puesta (el botón de la
  cámara, un emote, un mod), la cámara libre se apaga y la vista vuelve a los ojos, mirando hacia donde miraba la cámara
  libre. Antes, con R, se agarraba algo con la pistola de física y al tocar la cámara la vista quedaba a 7 m del cuerpo
  con el arma de primera persona (`girado.mjs`: a 0 cm de los ojos; antes 689 cm con R y 310 cm con L).
- **Colisiones medidas** (`pruebas/colisiones.mjs`, en FlatGrass y gm_construct): tiros de una caja y un barril a 15, 40
  y 80 m/s contra el piso y contra la pared (cuadro a cuadro, el centro no puede cruzar ninguna superficie del mapa), una
  pila de 5 cajas y 3 barriles (nada metido más de 3 cm) y el jugador caminando contra una caja, un auto y una caja
  congelada (no más de 5 cm). Dos arreglos: lo que se mete en otra cosa **en el mismo cuadro** ahora sale entero (antes
  salía a 4 m/s como lo que ya estaba metido; con pocos subpasos, en el celular, una caja a 80 m/s se metía 70 cm y
  atravesaba el piso), y al bajar del borde de una caja suelta el pie ya no queda 20 cm adentro durante un cuadro.
  Resultado: 5/5 en los dos mapas (antes 3/5 y 3/5).
- **Verity está desactivada** (`VER_APAGADA` en `juego/verity.js`): no aparece jugando solo ni en los servers, no se ven
  las de los demás, no escucha el micrófono, no está entre los mods oficiales y sus botones no se ven. El código queda.
  Prueba: `pruebas/verity_apagada.mjs` (5/5).
- **Lo que les faltaba a los addons** (`herramientas` de prueba: `pruebas/api_falta.mjs` sobre el conteo de
  `api_uso.py`, que lee el Lua de los .gma): de 86 addons reales, las funciones de GMod que usan y el motor no tenía.
  Se agregaron las que rompían algo: `RecipientFilter`, `SinglePlayer`, `GetWorldEntity`, `RenderAngles`, `Label`,
  `TauntCamera`, `SetClipboardText`, `table.FullCopy`, `util.StringToType`, `util.IsValidPhysicsObject`,
  `controlpanel.Get`, `constraint.GetTable`, `gui.MousePos`, `engine.IsMounted`, y en entidades y jugadores
  `OnGround`, `DropToFloor`, `WorldSpaceAABB`, `GetMaxSpeed`, `GetCrouchedWalkSpeed`, `GetPData`/`SetPData` (guardado en el
  aparato), `ScreenFade` (fundido de pantalla de verdad), `Flashlight`, `EnterVehicle`/`ExitVehicle`, `GetEnemy`... Y tres
  arreglos de fondo: lo que pregunta (`Is`/`Has`/`Can`...) en una biblioteca sin implementar devolvía 0, que en Lua es
  verdadero; `IsValid` de una tabla común sin `IsValid` daba verdadero (en GMod, falso); y del lado del cliente un campo
  como `ENT.Fire = 0` ya no lo tapa el método `Entity:Fire`, que en GMod sólo existe en el servidor. Tanda de 86 addons
  con todo esto: armas 38/38, NPCs 13/13, modelos de jugador 19/19, vehículos 3/3, entidades 31/36; de las 5 entidades que
  fallaban, andan los Drones (el `ENT.Fire`), el tatetí (`RenderAngles`), el gancho (`IsValid`) y la bengala de HDTF; la
  escoba era la prueba (su SpawnFunction pone otra clase); las rejas de un modo de juego no traen su textura (tampoco en GMod). `gmod_tanda.mjs` acepta `GMA_DIR` (instalar de una carpeta con los .gma ya bajados).
- **Tope de peso para lo que pide un addon** (`gmPesoMB`, `GM_TOPE_DEPS_MB` en `juego/gmod.js`): los "Required items"
  se instalan solos hasta 200 MB en total (60 MB en aparatos con 4 GB de memoria o menos); lo que no entra no se baja
  solo y se avisa con su peso, para instalarlo aparte desde la tienda. Medido: un addon de 87 MB ocupa unos 530 MB de
  memoria al instalarse, y el modo de juego Slashers pedía 150 + 117 MB. `pruebas/gmod_un_addon.mjs URL CARPETA ID`
  instala uno solo mirando la memoria (`DEPS=1` con lo que pide). Ojo con las pruebas: con `WORKER_LOCAL` los archivos
  grandes pasan por la ruta de Playwright y el navegador de prueba se cierra (es la herramienta, no el juego: por la
  tienda publicada el mismo addon se instala bien).
- **Mapas del Workshop** (`juego/gmod_bsp.js`): un addon con `maps/*.bsp` suma sus mapas a la lista (con su foto de
  `maps/thumb`) como `WS_<nombre>`. Al elegirlo se arma en el navegador, con la pantalla de carga: caras y desplazamientos
  (terrenos) en pedazos de 64 m por material, choques (lo invisible que choca también; el agua no), entidades de brushes
  con su lugar, props estáticos y `prop_physics`, apariciones, sol (`light_environment`), niebla, cielo y agua (material
  `GM_agua`). Lumps con LZMA, el pakfile (zip) del mapa, texturas y materiales del contenido base. Los `.vmt` con bloques
  condicionales (`">=DX90"`) y valores como `"[1 0 0]"` se leen bien (antes el bloque se perdía y el valor entre corchetes
  se tomaba como condición). Prueba `pruebas/gmod_mapas.mjs` (13/13: 5 mapas de Prop Hunt y Stranded, 0 texturas faltantes,
  se aparece parado, se camina y no se cae; de 7 a 30 s en armarse).
- **Mapas del Workshop, más fieles** (`gmod_bsp.js`, `portales.js`, `cielo3d.js`):
  - Luz horneada (los lightmaps del BSP en un atlas; las caras con relieve usan el primero): los pasillos de THE
    BACKROOMS tienen su luz y sus sombras, no un color plano. Las caras miran según la vuelta de sus vértices (con el
    plano dado vuelta por `side`, el techo y media pared de muchos mapas quedaban mirando para afuera). `func_brush` como
    en Source: el desactivado al empezar no está, `Solidity` 1 no choca, `rendermode` 10 o `renderamt` 0 no se ve (las
    claves de las entidades quedan en minúsculas: buscando `Solidity` no se encontraba y las puertas del ascensor donde se
    aparece en los Backrooms, que se atraviesan, eran paredes: se quedaba encerrado).
  - Puertas portal (`linked_portal_door`, del addon World Portals): el "pasillo infinito" de los Backrooms. De frente se
    ve el otro lado (la escena desde la puerta compañera, sólo lo de delante de ella —plano cercano oblicuo—, en el
    rectángulo de pantalla de la puerta y con lo que se ve por el hueco) y al cruzar se sale por la compañera con la misma
    dirección y velocidad; de atrás no hay nada, como en GMod. Una caja finita detrás del hueco tapa el corte del plano
    cercano cuando la cámara está por cruzar (sin ella un cuadro se veía el pasillo tapado). Los jugadores remotos que
    saltan lejos van de una (no se los ve volar por el mapa). Prueba `pruebas/gmod_portales.mjs` (3/3 en Patata, Medio y
    Alto: pegado a la puerta se ve igual que del otro lado; cruzar caminando sale a 15-25 cm delante de la compañera,
    mirando y yendo para adelante, y no vuelve; de atrás no se ve).
  - Cielo 3D (`sky_camera`): la sala con el paisaje en miniatura (las hojas del árbol del BSP en la misma "área" que la
    cámara del cielo) se separa del mapa —no choca— y se dibuja de fondo agrandada, mirada desde la cámara del cielo más
    lo que se movió el jugador dividido por la escala, con su niebla, como en GMod (en Aether Aerodromes la maqueta se
    veía debajo de las islas). El cielo 2D de verdad (las seis caras de la `skyname`, pasadas a un cubo) en vez de un
    degradé. Las apariciones miran hacia donde las puso el mapa. `pruebas/gmod_mapas.mjs` con los 8 mapas: 21/22 (la que
    falta, ver abajo).
- **Addons grandes sin llenar la memoria**: el `.gma` queda guardado como Blob en el navegador (IndexedDB, en el disco)
  y de las texturas (`.vtf`) y los mapas (`.bsp`) se lee sólo lo que hace falta: de una textura, hasta el tamaño que se
  va a usar (en el `.vtf` los niveles chicos vienen primero: con texturas de 256 se lee ~1/16); el mapa, al armarlo.
  Hasta que llega, la textura es gris; los íconos esperan sus texturas chicas. Antes, al arrancar, se cargaban enteros
  todos los instalados (un pack de armas son 140-320 MB, casi todo texturas) y en los celulares se cerraba la pestaña.
  Prueba `pruebas/gmod_perezoso.mjs` (6/6: con 3 addons de 506 MB instalados quedan 82 MB en memoria, también después
  de recargar; el arma se ve con sus texturas, su ícono sale y el mapa se arma leyendo su `.bsp` del disco).
- **Si el juego se cerró solo** (el sistema mató la pestaña por memoria o se perdió el WebGL), al volver arranca una
  calidad más abajo (hasta tres), con aviso en 14 idiomas; con partidas largas sin cierres vuelve a subir de a una.
- **Texto de los modos de juego encima de los botones**: lo que el Lua de un modo escribe en la esquina de arriba a la
  izquierda (el tiempo de Prop Hunt) baja hasta quedar debajo de los botones del juego (antes se encimaban).
- **Compatibilidad de addons** (`pruebas/gmod_tanda.mjs`, los mismos 30 de antes): 30/30 andan (armas 49/49, entidades 25/25, modelos de jugador 4/4, NPCs 3/3; antes 29/30). Las armas que se usan en
  tercera persona (la cámara del addon atrás del jugador, como el sable) cuentan como vistas; `id+dep` instala antes una
  dependencia.
- **Aviones y helicópteros WAC, piloteables** (`gmod_api.js`, `vehiculos.js`; prueba `pruebas/gmod_wac.mjs`, 9/9):
  - El error de su cámara era por tener dos bases WAC a la vez: el Workshop pide como "Required item" la vieja
    (104990330), que trae los mismos archivos que la actual. Ahora esa no se baja si está la nueva, y como en GMod los
    archivos de todos los addons comparten las rutas: si dos traen el mismo `lua/autorun/x.lua` o la misma clase, vale el
    del primero y corre una sola vez.
  - Se ven como en GMod: el modelo del A-10 tiene la raíz girada −90° en su secuencia de reposo y se dibujaba de costado,
    con el casco de choque corrido y hundido en el piso. Ahora cada modelo se dibuja en la pose que mejor calza con su casco
    (la de la secuencia o la de enlace), y del `.phy` se leen todas las piezas convexas recorriendo su árbol (antes sólo la
    primera: el A-10 era una caja en la cola; ahora alas, motores, cola y cabina).
  - Subir: apretar E mirando la cabina (o cualquier parte del avión) te sienta en su asiento (`EnterVehicle`,
    `GetVehicle`, `GetPassenger`, `PlayerEnteredVehicle`/`PlayerLeaveVehicle` como en GMod) y el avión o helicóptero pasa a
    manejarse como los del juego, con su cámara de atrás a la distancia que pide su tamaño y los mismos botones en el
    celular (acelerar/subir, frenar/bajar y la palanca para inclinar). F para bajarse.
- **Menos memoria con addons (celulares)**: la geometría de los modelos (`.vvd`/`.vtx`) y los sonidos grandes quedan en el
  disco (el `.gma` guardado en el navegador) y se leen cuando hacen falta; lo que los esperaba (la entidad, la vista del
  arma, el ícono, el personaje) se arma apenas llegan, y el menú pone el objeto cuando están. La biblioteca de contenido
  base suelta a los 15 s los trozos enteros que baja cuando el servidor no sabe de rangos (quedaban para siempre). Medido
  en modo celular, Patata, con un pack de armas (134 MB), dos de NPCs y un mapa de Prop Hunt (`pruebas/memoria.mjs`):
  de 588 a 371 MB con los addons y de 604 a 410 MB con el mapa (la versión anterior contra esta, en las mismas
  condiciones).
- **Piezas pegadas y sólidos como en GMod**: `SetParent` hace que la entidad siga a su padre (antes quedaba donde
  estaba) y no choca ni la ven las trazas; `constraint.Weld`/`Axis` pegan la más liviana a la más pesada (las ruedas, el
  rotor y las armas del avión van con él); una entidad de Lua sin `PhysicsInit` ni `SetSolid` no choca con nada;
  `SetNotSolid`, `SetCollisionGroup` (escombros, armas, mundo...) y el dueño (`SetOwner`) se respetan. El cuerpo se arma
  ya en `Initialize` (al poner el modelo o `PhysicsInit`), así `GetPhysicsObject():SetMass(...)` y las soldaduras de ahí
  funcionan. `GetPos`/`SetPos`/`LocalToWorld` usan el origen del modelo, como GMod (antes, el centro del casco: hasta
  medio metro de diferencia y a los nextbots los tiros les pegaban más abajo).
- **Prop Hunt de verdad** (`pruebas/gmod_prophunt.mjs`, 6/6; `pruebas/gmod_mapas.mjs` con los 8 mapas, 22/22): Fretta busca las clases de jugador con
  `file.Find("prop_hunt/gamemode/player_class/*.lua", "LUA")` y la ruta "LUA" no miraba `gamemodes/`: no había clases (ni
  la utilería de los Props ni las armas de los cazadores). Ahora el jugador de los Props tiene su utilería pegada (sin
  chocarlo: antes lo levantaba), es invisible como pide el modo y con E sobre un objeto toma su forma; `Player:Freeze`
  (la pre-ronda) lo deja quieto y al aparecer queda apoyado en el piso (antes flotaba 70 cm).
- **Armas de TTT** (Trouble in Terrorist Town): bases propias `weapon_tttbase` y `weapon_tttbasegrenade` (mira de
  hierro, retroceso, dispersión, granadas que se tiran y explotan, tipos de arma y roles de TTT) y salen en el menú (en
  TTT se compran; acá, como las demás). Lo que un addon incluye de otro opcional que no está (la base de Wiremod en los
  aviones WAC) queda como en GMod: sin contarlo como falla.
- **Modelos de los addons como NPC**: en la pestaña GMod, cada modelo de jugador tiene su entrada "(NPC)" que pone un NPC
  con ese modelo, parado y caminando (`gmnpcModelo`). Prueba `pruebas/gmod_npc_modelos.mjs` (3/3).
- **Modos de juego de GMod** (`juego/gmod_modos.js`): un addon con `gamemodes/<modo>/<modo>.txt` trae un modo. En "Nueva
  partida" hay un selector **Modo** (Automático = el del mapa, como `ph_` de Prop Hunt; Sandbox; o uno instalado). Al
  empezar, el Lua vuelve a empezar con el modo: se carga la cadena de bases de los dos lados (prop_hunt → fretta → base,
  con `DeriveGamemode`, `init.lua`/`cl_init.lua`, herencia como `gamemode.Register`), sus "settings" son ConVars, y el juego
  llama sus funciones después de los hooks (`GM:Think`, `HUDPaint`, `PlayerSpawn`, `PlayerDeath`, `PlayerDeathThink`...).
  Equipos de verdad (`team.SetUp`, `SetTeam`, `GetAllTeams`, `BestAutoJoinTeam`), clases de jugador (`player_manager`
  con `RegisterClass`/`SetPlayerClass`/`RunClass`), base de GMod (aparecer con el loadout, morir y reaparecer disparando o
  saltando, cambiar de equipo), `module(...)` y `package.seeall` de Lua 5.1, paneles vgui con `BaseClass` como GMod. La
  pantalla de elegir equipo de GMod (vgui) se cambia por una propia (también con F2), y arriba una barrita muestra el modo,
  el equipo y el tiempo de la ronda. Prueba `pruebas/gmod_modos.mjs` (25/25 con Prop Hunt, Hide and Seek, You Touched it
  Last, Cops and Runners, Cinema, Stranded y Slashers: cargan sin errores de Lua; en Prop Hunt se elige equipo y arranca la
  ronda con su reloj). Límite honesto: el Lua de los addons corre en cada aparato, así que los modos por rondas y equipos
  se juegan solo (sin bots todavía); en un server cada uno tiene su propia ronda.
- **Server y cliente con globales separadas** (como GMod, que tiene dos Lua): lo que un archivo asigna como global nueva va
  a la capa del lado que corre (`R.ov` en `gmod_lua.js`); librerías, prelude y lo que pone el juego son de los dos lados.
  Antes, por ejemplo, Hide and Seek ponía `RoundCount` en el server y el cliente lo pisaba con un texto.
- **Lightsaber (Robotboy655) y armas que piden tercera persona**: el paso `CalcView` de los addons (hooks, el modo de juego
  y `SWEP:CalcView`, en `gmod_vista.js`) mueve la cámara y, con `drawviewer`, pasa a tercera persona mientras el arma lo
  pide. El modelo de mundo del arma del addon (`w_*.mdl`) va en la mano como lo pega GMod (su hueso `R_Hand` sobre la mano
  de Source del personaje) y el juego llama `DrawWorldModel`/`DrawWorldModelTranslucent`, así la hoja se dibuja desde el
  Lua. Los huesos del personaje responden con nombres de Valve (`LookupBone`, `GetBonePosition`) y el arma da sus adjuntos.
  Arreglos que salieron de esto: las variables de la Tool Gun de un addon (`TOOL.ClientConVar`) existen como ConVars (el
  color de la hoja salía de ahí: era negra); `Vector("0", "127", "255")` con textos ya no da cero; un tamaño de letra con
  decimales (`ScreenScale` en el celular) se leía como 184375 px de alto y tapaba la pantalla con un recuadro; la postura
  del personaje sigue el "hold type" del arma (`melee2`); `$alphatest` corta en 0,25 (el centro de la hoja salía a tramos);
  `PlayerBindPress` con las teclas (F = `impulse 100` para elegir poder de la Fuerza, 1-9 = `slot`) e
  `input.LookupBinding`. Prueba `pruebas/gmod_sable.mjs` (10/10 en PC y celular: tercera persona, cámara 2,5 m atrás, sin la
  palanca de primera persona, el mango a 9 cm de la muñeca, la hoja nace a 17 cm y se ve celeste, sin errores, y al
  cambiar de arma vuelve a primera persona).
- **"Steam no dio servidores"** (`tienda/steampipe.js`): la lista de servidores de Steam ahora trae también el puerto
  27018; se aceptan todos los puertos (los mismos servidores atienden por 443), se prueba `GetCMListForConnect` y
  `GetCMList`, se guarda la última lista buena y hay servidores de respaldo.
- **Botón GMod** (`juego/gmod_panel.js`): jugando hay un botón redondo "GMod" (con la cantidad de addons) que abre un
  panel propio con un apartado por addon instalado: sus armas, entidades, NPCs, vehículos, personajes y props (tocar uno
  lo da o lo pone), sus herramientas de la Tool Gun (con el nombre de `language.Add`), sus habilidades (las teclas y
  binds que usa su Lua: `PlayerBindPress`, `KEY_*`, `IN_*`; se mantienen apretadas como en el teclado y se pueden
  **fijar como botones en la pantalla**), sus comandos de consola (con argumento) y sus ajustes (ConVars: sí/no, número
  con rango, texto; quedan guardados en el aparato). Sin addons invita a la tienda; desde una partida se puede ir a la
  tienda y volver. Prueba `pruebas/gmod_panel.mjs` (18/18 en PC y celular parado).
- **Celulares de gama baja** (`juego/celulares.js`): una lista de 338 modelos de 19 marcas (Samsung, Xiaomi/Redmi/POCO,
  Motorola, Realme, Tecno, Infinix, Oppo, Vivo, Honor, Nokia, ZTE, itel, Huawei, Lenovo, Alcatel...) con el código que
  manda el navegador (verificado contra la lista de aparatos de Google Play), su chip y la RAM; y 60 chips con un
  puntaje de su GPU (GFXBench Manhattan 3.0, mediana de Notebookcheck). La primera vez el juego lee el modelo (Client
  Hints o el user agent; si no, la GPU que muestra WebGL) y elige la calidad: Patata por debajo de 25 puntos (PowerVR
  GE8320 de los Helio G25/G35/P35, Unisoc T606, Exynos 850), Bajo hasta 47 (Helio G85, Snapdragon 680: Mali-G52 MC2 y
  Adreno 610, sin sombras), Medio hasta 69 (Helio G99, Dimensity 6100+), Alto desde 70; con 2 GB no pasa de Bajo y con
  1 GB es Patata. En Ajustes se ve el aparato detectado. (En la 3.0: 343 modelos de 20 marcas y 64 chips, con los que
  mandaron los jugadores —Tecno Spark Go 2023 y Go 2, POCO X6 Pro, Moto g20 y g13, TCL NXTPAPER 70 Pro y K70, Galaxy S20
  FE, A05 y A15, Honor Magic6 Lite—, y el modelo de los Motorola con paréntesis —«moto g(20)»— que antes se cortaba.)
  Prueba `pruebas/celulares.mjs` (9/9: los 739 códigos dan su equipo, modelos con sufijos y sin marca, el user agent,
  la GPU sola, la memoria, los celulares de los jugadores, un moto g(20) en la app, y abrir el juego en un Tecno Spark
  10C da Patata).
- **Niveles de detalle para los modelos de los addons** (`gmLodGen` en `juego/gmod.js`): de 755 modelos medidos sólo 72
  traen los suyos, y los personajes más pesados (20-31 mil triángulos) ninguno. Al cargar una malla de más de 1200
  triángulos se arman hasta tres niveles (la mitad, un quinto y un catorceavo) juntando vértices por celdas de una
  grilla; cada celda queda en su vértice más cercano al promedio, así que los vértices (con su piel) son los mismos y
  sólo cambian los índices. Se probó separar por islas de la malla (para no cruzar texturas) y encogía la silueta: con la
  misma cantidad de triángulos conservaba 79-95 % del área contra 98-100 % juntando sólo por posición. Trevor (GTA V,
  31.674 triángulos) queda en 12.651 / 5.182 / 1.680; Master Chief en 11.397 / 4.537 / 1.246; SCP-096 en 7.476 / 4.246
  / 1.322; armarlos tarda 7-18 ms por malla en Node (10-56 ms en el navegador de prueba, una vez al cargar el
  modelo). Cada cuadro se dibuja el nivel más simple cuyo error se vea de menos de 0,4 px (Ultra), 0,5 (Alto), 0,9
  (Medio), 2 (Bajo) o 3,5 (Patata): en la PC casi no se nota y el ahorro grande queda para los celulares. También en la
  sombra; la física y los choques siguen usando la malla entera. En aparatos sin huesos en la GPU, la piel por CPU
  calcula sólo los vértices del nivel. Prueba `pruebas/gmod_lod.mjs` (el mismo cuadro con y sin niveles, con el tiempo
  quieto: sin niveles da 0 % de diferencia exacta). Medido con Trevor, Master Chief y SCP-096 a 2,5-40 m: Bajo, peor
  4,7 % de los píxeles del personaje cambiados, −51 % de triángulos; Patata, peor 5,3 %, −66 %; Alto, 0 % salvo el
  Master Chief a 40 m (22 px de alto: 3,3 %), −23 %; Medio, Trevor y SCP ≤ 1 % pero el Master Chief da 5,8-7,7 % (su
  armadura negra con brillos cambia de reflejo), −36 %. Con 12 personajes pesados delante (`pruebas/opt_gente.mjs`):
  318 mil → 201 mil triángulos por cuadro en Alto, 69 mil en Bajo y 59 mil en Patata.
- **Meta: 60 cuadros por segundo.** La resolución dinámica baja la resolución interna si no se llega a 55 cuadros y la
  vuelve a subir cuando sobra (58 o más durante 2 s); si con la resolución mínima no se llega a 50, en automático baja una
  calidad entera. La HUD de los addons (`HUDPaint`, `SWEP:DrawHUD`) se dibuja en todos los cuadros (en Patata y Bajo con
  la densidad de pantalla hasta 1,5) y su lienzo se esconde cuando en el cuadro no se dibujó nada. Las personas a más de
  40 m se animan en todos los cuadros; sólo si el aparato no llega a 58 pasan a cuadro por medio. Lo que se encontró
  midiendo (`pruebas/opt_60.mjs`, `pruebas/opt_armas.mjs`):
  - Las armas de M9K (y todas las hechas con el SWEP Construction Kit) ponen en cada cuadro escala, ángulo y posición
    neutros a cada hueso del arma; `ManipulateBone*` rehacía todas las matrices en cada llamada. Ahora lo que no cambia
    nada no hace nada y lo que cambia rehace sólo ese hueso: la AK-47 de M9K pasó de 11,6 ms a 0,2 ms por cuadro y el
    JavaScript de una escena con 12 personajes de GMod, bombas y la AK-47 en la mano bajó de 16,2 a unos 6 ms por cuadro
    en esta máquina (medido con el dibujo por software compitiendo por el procesador; con el código ya caliente, las 12
    personas cuestan 0,6 ms).
  - `LookupBone` de la vista del arma buscaba cada nombre recorriendo todos los huesos: ahora con un índice.
  - Las pantallas 2D sobre el arma (`cam.Start3D2D`, como el GPhone o los drones) se vuelven a subir a la placa sólo
    cuando lo dibujado cambia (una firma de lo que se dibujó en cada bloque).
  - Las personas que ocupan menos del 15 % del alto de la pantalla no hacen la IK de manos y pies (no se ve) ni el ajuste
    de piernas del modelo de GMod, y el paso de la pose al esqueleto de GMod ya no crea arreglos por hueso.
  - En el Lua, un `__index` que es función (el de Vector, Angle y Entity: casi todas las llamadas a métodos) se llama
    directo, sin armar arreglos de resultados.
  - De 45 armas de 23 addons, 42 cuestan ≤ 0,5 ms por cuadro con el código ya compilado (40 en el primer segundo con
    el arma en la mano), la meta para que en un celular de gama baja, 3-4 veces más lento, no pasen de 2 ms. Las que no:
    la Portal Gun (1,0 ms), el GPhone (0,9 ms; dibuja 24 piezas del SWEP Construction Kit recalculando cada una con su
    Lua en cada cuadro) y el radar de los Drones (0,5 ms). Es el propio Lua del addon; lo que el juego agrega ya es poco.
  - La escena pesada de `opt_60.mjs` da en esta máquina 6,1 ms de JavaScript por cuadro en promedio y 10 ms en el
    percentil 95, pero esta máquina no tiene placa de video y el dibujo por software le quita procesador a todo: medido
    aparte y en caliente, pasar la pose del Hero a los 8 de esos 12 personajes que la usan cuesta 0,24 ms en total.
- **Presupuesto de Lua**: si el Lua de los addons viene costando más de 3 ms por cuadro (Patata y Bajo) o 6 ms (las
  demás), el `Think` de cliente de las entidades a más de 25 m va por turnos (cada 2 o 4 cuadros); las cercanas siempre.
- **Arreglos de addons**: el guante de Thanos (`GetPlaybackRate` de una entidad común daba nil), el misil aire-tierra (un
  hueso que la vista del arma no tiene ya no da nil). WAC Community 5 sigue con 2 texturas del A-10 que son de su addon
  base.
- **Mapas propios** (`herramientas/mapas_rb.py`), además de los del juego, que siguen todos: Llanura (con una placita),
  Colinas (lago y playa), Isla, Ciudad RB (manzanas, calles con líneas, veredas, edificios, plaza y parque), Médanos
  (con oasis) y Luna (cráteres, gravedad baja, cielo negro sin nubes ni brillo de aire). Las texturas base son imágenes
  generadas, vueltas sin costura y llevadas al color de cada mapa; las líneas de la calle, las juntas y las ventanas se
  dibujan encima. Cada triángulo del terreno toma pasto, arena, tierra o roca según altura y pendiente.
- **Pizzería de Freddy (la noche de FNAF 1)**, `RB_Pizzeria`, con server oficial y elegible al crear uno. El mapa es
  "Freddy Fazbears Pizza (Event)" del Workshop (pedido en el Discord; antes era el de Fedy). Sobrevivir de
  las 12 a las 6 (89 s por hora) en la oficina. Solo: menú de noches (nueva, continuar, la 6 y la personalizada con los
  cuatro niveles de 0 a 20; el progreso se guarda); en una sala arranca sola. Como en FNAF 1: los niveles de cada noche
  (y Bonnie, Chica y Foxy suben a las 2, 3 y 4), una oportunidad de moverse cada 3,02 / 4,97 / 4,98 / 5,01 s, cada uno por
  sus salas (las de las cámaras) caminando por caminos calculados sobre el mapa. No persiguen a nadie: afuera de la oficina
  sólo te agarran si te los chocás o te quedás delante de uno. En la esquina, con la puerta cerrada se vuelven (Bonnie al
  comedor, Chica al pasillo este); abierta, entran. Freddy no se mueve si alguien lo mira (con los ojos o por la cámara) y
  entra sólo mientras alguien mira las cámaras (no la 4B). Foxy sale de Pirate Cove por etapas mientras nadie tiene la
  tableta arriba (la cortina se va abriendo) y corre a los 25 s o si alguien mira la 2A; cada golpe en la puerta saca 1,
  6, 11 % de energía. Energía: 0,1 % por segundo por barra de uso más 0,1 % cada 6, 5, 4 o 3 s desde la noche 2; sin
  energía se apaga todo y viene Freddy con la cajita (si dan las 6 antes, se gana). Con alguien adentro los botones no
  andan; mientras corre la noche no se pueden poner props. Cámaras (G) con el plano de FNAF hecho del mapa (cada
  una arriba, en un rincón de su sala, desde donde se ven los lugares de los animatrónicos de esa sala); linterna (L)
  que alumbra en todas las calidades (luces especiales en el shader: la linterna, las de los demás, la lámpara de la
  oficina, las de las puertas y, en las calidades sin luces puntuales, las del techo); llamadas de las noches 1 a 4
  (castellano o inglés según el idioma) con "Silenciar llamada"; sustos en video; Game Over con Reintentar y Menú (todo de
  cero). En una sala la noche la maneja uno solo (el de id más chico; si se va, sigue el próximo desde donde estaba) y cada
  noche lleva un número para que todos se reinicien juntos; al que agarran pasa a espectador (no se ve ni choca): sigue a
  los demás en primera o tercera persona, vuela libre o mira las cámaras, y vuelve a la oficina en la noche siguiente; si
  agarran a todos, Game Over y la misma noche otra vez a los 8 s. En una sala, abajo de la hora, la lista de los que
  juegan: en la oficina, afuera o mirando (los agarrados; en el celular, abajo al centro). Al lado del micrófono, **VOCES** silencia las voces de
  los demás. Freddy, Bonnie, Chica y Foxy también están en **Personajes** para jugar con ellos. `juego/noche.js`. Armado (lo
  extraído queda fuera del repo, `CREDITOS.md` dice de dónde sale cada cosa):
  ```sh
  # el mapa y los animatrónicos (con srctools, pyfqmr y scipy); FN_EXTRA: lo que el mapa pide y no trae (el Model Pack
  # y las Texture Materials #1-3 del Workshop, 1723581405 y 1723583571/85641/86812); FN_LIB: la biblioteca de HL2 del
  # juego; FN_CARGA: la captura para la pantalla de carga
  FN_EXTRA=mp:t1:t2:t3 FN_LIB=web/rb/gm_lib.X.idx FN_CARGA=captura.jpg python -I herramientas/pizzeria.py PAQUETE PAQUETE_NUEVO fnaf_freddypizzaevents.bsp CARPETA_PACK_HW
  # sonidos, llamadas y sustos (de los .ogg/.webm sacados de FNAF In Real Time con UnityPy, y los .wav del pack)
  python3 -I herramientas/pizzeria_medios.py PAQUETE_NUEVO OGG_IRT VIDEO_IRT SONIDOS_HW
  # los cuatro como personajes (la misma malla del mapa con los huesos del juego) y sus retratos para la tienda
  python3 -I herramientas/skin_fnaf.py PAQUETE_NUEVO PAQUETE_FINAL CARPETA_RETRATOS
  ```
  `herramientas/source_mdl.py` lee los modelos de Source (.mdl/.vvd/.vtx: huesos, mallas, secuencias y las animaciones
  comprimidas). El mapa pasa de Source al juego con (x, y, z) → (y, z, x) en metros. De las dos variantes del addon va
  `fnaf_freddypizzaevents` (la 2 es la misma pizzería con otros eventos encima: más sala de control y más entidades, nada
  que el juego use). Lo de los eventos del mapa (la sala de control de arriba, lo que aparece con disparadores, los
  animatrónicos quietos del mapa, que el juego reemplaza por los suyos, los de FNAF 2) no va. Cada cara se dibuja del
  lado donde no hay brocha sólida (en los BSP el plano de la cara no siempre alcanza); vidrios, de los dos lados. Las
  puertas de seguridad son las `func_door` del mapa (bajan y suben como en FNAF y chocan cerradas), los botones son sus
  `func_button` (el de arriba, la puerta; el de abajo, la luz) y la oficina sale de ahí: su caja, hacia dónde mira el
  guardia (al escritorio), la lámpara, las luces de las puertas y el ventilador (`DATA.fn.oficina`). Las salas de FNAF
  (dónde se para cada uno) están marcadas en el mapa; las esquinas, afuera de cada puerta. Los caminos salen de una
  grilla de 20 cm sobre el piso (A* y estirados). Las cámaras del mapa son las de sus eventos y varias no veían su sala:
  cada cámara de FNAF se busca sola en su sala, cerca del techo y con pared atrás, viendo (contra las caras que se
  dibujan y las cajas de los muebles) a todos los que se paran ahí, todos dentro del cuadro y sin nada pegado delante;
  Pirate Cove, de frente a la cortina; la cocina sigue siendo sólo audio. La cortina de Pirate Cove son dos paños (la
  tela del Model Pack, que es un atlas: cada paño toma el suyo) de pared a pared en la boca de la cueva. Las
  calcomanías (los carteles SECURITY, las rejillas) van derechas; los props de un hueso que su secuencia gira (las pizzas
  pegadas en las paredes) giran también sus normales (si no, la luz les daba del otro lado y se veían negras). Los props
  que el mapa pone cerca van juntos en una malla por zona de 8 m y los muy detallados se simplifican. De noche, en el
  celular, el tacho de borrar props no aparece (no hay props y tapaba la energía). (Arreglado en su momento en el motor:
  los materiales "sin luz" salían del color de la niebla en todos los mapas salvo en ultra, porque la niebla y la cámara
  se cargaban sólo en los programas que usan el sol.) Los
  animatrónicos son mallas con piel (a lo sumo 56 huesos con peso) y sus clips en float16. Pruebas: `pruebas/noche.mjs`
  (solo: menú, llamada y silenciar, noches 1, 4 y 6, energía, apagón, Game Over y reintentar, progreso, pausa encima, sin
  props), `pruebas/red_noche.mjs` (dos jugadores: quién maneja, sincronía, puertas, linterna, espectador, Game Over y
  reinicio en sala, traspaso, la lista de la sala), `pruebas/noche_luz.mjs` + `noche_luz.py` (luz medida con y sin linterna en cada calidad),
  `pruebas/pizzeria.mjs` (recorrido por la oficina y cada sala, y las 11 cámaras con los animatrónicos en su lugar; los
  lugares salen del mapa), `pruebas/noche_ia.mjs` (noche 20/20/20/20 defendida hasta las 6: recorren las salas, a
  menos de 5 cm del piso y a 22 cm o más de las paredes, con fotos caminando) y `pruebas/skins_fnaf.mjs`.
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
- Arranque: la pantalla de carga (arriba) mientras se lee el paquete. A prueba de fallas: cada paso queda anotado; si
  algo se rompe se prueba solo con el otro motor (WebGL 1 ↔ 2) y después con la calidad más baja, y si igual no anda
  se ve el error en pantalla. Si el navegador no trae DecompressionStream, el gzip se abre en JS; si una placa no
  acepta un shader, se usa una versión más simple.
- `juego/`: `nucleo` (matemática), `gl` (dibujo), `datos` (paquete), `modelo`, `fisica` (XPBD), `mundo`
  (mapa y choques), `jugador`, `objetos`, `vista` (arma en la mano), `audio`, `efectos`, `armas`,
  `vehiculos`, `herramientas` (Tool Gun), `personas` (skins, emotes, muñeco), `humano` (clips humanoides:
  músculos → huesos), `red` (MQTT: salas, lista de servidores por presencia retenida), `entrada` (incluye el
  giro a horizontal), `ui`, `menu` (dibuja el LobbyCanvas exportado con HTML), `idiomas`, `modapi` (mods con código),
  `voz`, `geo` (formas propias), `entidades`, `pantalla` (pantalla de YouTube), `nativos` (mods oficiales), `ciclope` (mod
  Cíclope), `verity` (mod Verity), `veritycrea` (Verity crea mods, construcciones y animaciones), `animedit` (editor de animaciones), `emotes`, `hud` (controles), `idiomas3` (textos de la versión 8),
  `creador`, `smods` (mods del server), `inicio` (RezoBox), `rbmenus` (Multijugador, Personajes, entrar con la pantalla de carga), `principal`.
- Pruebas: `pruebas/escena.mjs` (guion de pasos), `dbg.mjs` (corre un .js en la página: `fisica_choques.js`,
  `vehiculos.js`, `pies.js`, `camara.js`, `marcas.js` devuelven números), `red2.mjs` (tres jugadores, broker local
  aedes: sala oficial, lista, servidor con clave y sin PvP), `red3.mjs` (anfitrión: hora y reglas por la red,
  spawn bloqueado, echar), `barrido.mjs` (8 mapas × 5 calidades, errores de consola), `celu.mjs` (teléfono táctil,
  `acostado` o `parado` para el giro de 90°), `pasos.mjs` (cuánto patina el pie apoyado, m/s, por velocidad y
  dirección), `saltos.mjs` (cuánto salta cada hueso de un cuadro al otro en todos los cambios de estado), `arranque.mjs`
  (abre el HTML como la gente, con fallas simuladas en `PRE`: sin WebGL 1, sin DecompressionStream, etc.).
  De GMod: `gmod.mjs` (recorrido de los mapas), `gmod_choques.mjs HTML mapa` (caídas, caminatas, costo de dibujo),
  `palanca.mjs`, `red_gmod.mjs` (dos jugadores con la palanca, broker local), `agarre.mjs` (todos los personajes con la
  palanca: cuánto rodea cada dedo, contra GMod, fotos de cerca), `skins_nuevos.mjs`, `armas_gmod.mjs` (Tool Gun,
  Physics Gun agarrando una caja, Gravity Gun levantándola y lanzándola, con sus sonidos), `armas_hl2.mjs` (las ocho de
  HL2: sacar, quieto, tiro con sonido, recarga) y `postura_gmod.mjs` (en todos los personajes y las ocho posturas, adónde
  mira la cara contra GMod y cuánto se mueven la mirada y el arma con la animación de quieto).
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

## JXMod 2.9: WebGL 2 como motor principal y optimizado para las GPU de celu

- **WebGL 2 de entrada y un solo motor** (`juego/principal.js`, `juego/ui.js`, `Inicio.java`, `EleccionMotor.java`): el
  juego arranca en WebGL 2 y en Ajustes → Gráficos → Motor quedan sólo WebGL 2 y WebGL 1 (compatible). Si WebGL 2 no
  arranca en un aparato, el juego vuelve solo a WebGL 1. A los que tenían guardado WebGL 1 (el de entrada viejo) se los
  pasa una vez. Prueba: `pruebas/motores.mjs` 4/4.
- **Motores retirados**: salieron de la app y del repositorio el nativo con V8 (`jxrt/`, `Jxr*.java`, Javet), JXGL (el
  WebGL propio: `juego/jxgl.js`, `JxglVista.java`) y el JX nativo en Java (`apk/src`, LuaJ), con sus pruebas. El código
  está en el historial de git (commit `bb0d264`, APK 2.9-prueba1). La app es `Inicio` (mira que haya una WebView que
  sirva: si no hay, avisa y abre Play Store; si es muy vieja, avisa y abre el juego igual) y `Web`. Lo que el nativo con
  V8 de la 2.8 dejó guardado lo trae el juego una vez (`JXNativo.almacenPendiente`). El APK pasa de 52 MB a 21 MB (sin
  bibliotecas nativas: antes el V8 ocupaba 107 MB instalado). Prueba: `PruebaEleccion` 5/5.
- **Las GPU de celu dibujan por mosaicos** (Mali, Adreno, PowerVR): cada pasada trae de la memoria lo que había en su
  búfer y al terminar guarda todo, y eso es lo que más cuesta. Con WebGL 2 ahora se avisa qué no hace falta
  (`invalidateFramebuffer`, `descartar` en `juego/post.js`): las pasadas de pantalla completa (oclusión, resplandor,
  final) no traen lo que había; la pasada previa de profundidad no guarda el color (y la escena lo vuelve a borrar en vez
  de traerlo); la profundidad de la escena no se guarda si no hay rayos de sol ni una tele 3D que la use; la de la
  pantalla, tampoco.
- **Luz alta en 4 bytes** (`R.F.hdrC`): la escena, el resplandor, los rayos y el reflejo del agua van en R11F_G11F_B10F
  en vez de RGBA16F (8 bytes): mitad de memoria. Si la placa no deja dibujar en ese formato, el de siempre. Con
  `?hdr16=1` se usa el de 8 para comparar: la imagen da lo mismo (diferencia media 0,5 de 255, 99 % de los píxeles a ≤ 6)
  y el degradé del cielo no hace escalones (`pruebas/webgl2_ab.mjs`).
- **Sombras sin copiar el mapa entero** (`juego/sombras.js`): antes, cada cuadro se copiaba el mapa fijo de sombras
  (2048², 16 MB) y se lo volvía a traer para dibujar encima lo que se mueve. Ahora en cada cascada se repone sólo la zona
  donde estuvo o está algo que se mueve (personas, props) y eso se dibuja recortado a su zona: ~100 mil puntos por
  cuadro en vez de 4,2 millones. Prueba (`pruebas/sombras_zonas.mjs`): con 5 personas caminando y cajas cayendo, la
  imagen es idéntica a la de copiar todo (diferencia media 0,00): sin sombras fantasma ni sombras de menos.
- **Menos llamadas a WebGL** (`uniV` en `juego/gl.js`): si el programa ya tiene el mismo valor (el mismo material, la
  misma malla, la misma matriz) no se vuelve a mandar. El mapa son muchos pedazos con la misma malla y matriz.
- **Shaders sin congelar** (`progDe`): con KHR_parallel_shader_compile, ya en la partida, lo que aparece por primera vez
  (un prop, un personaje, un efecto) se compila en paralelo y se ve un par de cuadros después en vez de congelar el
  juego 50–300 ms en los celus; al entrar a un mapa o cambiar la calidad se compila todo de una, como siempre.
- **Medido** (`pruebas/perfil_cuadro.mjs`, ahora espía WebGL 2 y cuenta la memoria que mueve cada pasada con el formato
  de cada búfer, como una GPU por mosaicos; gm_construct en Alto, 1746×786, mismo lugar):

  | | antes | ahora |
  |---|---|---|
  | memoria por cuadro (traer + guardar + copias) | 155 MB | 50–62 MB |
  | mapa de sombras (copia + pasada) | 67 MB | 10–18 MB (más cuando se rehace una cascada) |
  | llamadas a WebGL por dibujo | 9,7 | 7,0 |
  | pasadas que traen lo de antes | 15 de 18 | 7 de 17 (sólo las que lo usan: el resplandor que suma, la profundidad de la pasada previa y las sombras) |

  Son números de un modelo (la compu dibuja con SwiftShader, sin GPU): los FPS de verdad los da el celu.


## JXMod 2.9-prueba3: lo pedido en el Discord

Todo medido en la compu (Chromium con SwiftShader, sin GPU). Nada de esto se probó todavía en un celular de verdad.

- **Cámara libre con el dedo** (bug de GOLDEN: «no se mueve un rato»): con el dedo quieto sobre el joystick la cámara
  libre se frenaba hasta 3 s, porque cada cuadro se borraba lo que marcaba el dedo. Ahora se guarda y se devuelve
  (`clibDevolver`, `juego/camlibre.js`). Prueba `pruebas/camlibre_toque.mjs` 7/7 (antes 4/7).
- **Skins de mods de GMod rotas** (el perro Doge de GOLDEN): faltaba la capa de proporciones que esos modelos traen en
  su animación (secuencias delta que se suman solas); el pecho se estiraba y el perro se hundía al correr. Ahora se
  aplican las capas (`GMF.poseCapas`) y el origen de los modelos con animaciones propias va en el piso, como en GMod.
  Prueba `pruebas/pm_proporciones.mjs` 8/8.
- **Multijugador** (sans9074): tu modelo del Workshop les llega a los demás (se monta sólo para dibujar, sin su Lua) y
  el mapa custom del server se baja al entrar (con progreso en la pantalla de carga), en vez de caer en gm_flatgrass.
  Los mods del host ya les llegaban con «Mods del server». Prueba `pruebas/red_workshop.mjs` 5/5. Para que la lista de
  servers muestre los que tienen mapas del Workshop hay que volver a subir el worker de la tienda (`tienda/worker.js`).
- **Emotes con música** (idea de GOLDEN y tuya): en cada emote, ⋯ → Música → buscás un video de YouTube, recortás la
  parte que te gusta (hasta 60 s) y suena con el emote; los de cerca la escuchan más fuerte. Prueba
  `pruebas/emote_musica.mjs` 8/8.
- **Apuntar** (Noobsaibot0777): con clic derecho, o con el botón de la mira en el celular, el arma de fuego va al centro
  con el caño hacia la mira (≤ 0,6°), la vista se cierra de 70° a 51°, baja la sensibilidad y se abre menos el tiro.
  Entra en 0,2 s; recargar deja de apuntar; el francotirador sigue con su mira. Prueba `pruebas/apuntar.mjs` 5/5.
- **El arma a gusto** (Killerlarp): Pausa → «Arma en la mano» mueve el arma de primera persona adelante/atrás (±12 cm),
  al costado y en altura (±10 cm) y la gira (±25°), guardado por arma. Apuntando no cuenta. Prueba `pruebas/arma_aj.mjs` 5/5.
- **El arma del tamaño del personaje** (las armas flotaban en los modelos chicos del Workshop): ahora va en su mano
  (de 15–26 cm afuera a 2–4 cm, como el Hero) y se escala con el personaje (el Minion la tiene chica). Prueba
  `pruebas/arma_mano_gmp.mjs` 3/3 con 10 modelos.
- **La postura con arma en tercera persona**: con las animaciones de GMod el pecho se echaba atrás hasta 37° y la
  pistola, la SMG o la escopeta apuntaban al cielo (pasaba también con el Hero y con los demás jugadores). Ahora la
  columna se lleva a la postura de GMod cada cuadro: quieto, cada tramo del cuerpo a ≤ 0,7° (antes 15–37°); caminando,
  ≤ 6°. La cara vuelve a mirar como en GMod (`pruebas/postura_gmod.mjs` 5/5; venía 3/5). Prueba nueva
  `pruebas/arma_postura3p.mjs` 3/3.
- **NPCs con armas y NPCs que te defienden** (Miguel): la actitud tiene arma (pistola, .357, SMG, AK, escopeta o
  palanca) y el modo «Te defiende». Los armados te ven (no tiran a través de paredes), reaccionan en medio segundo,
  tiran a la cadencia de su arma (en ráfagas la SMG y el AK) y aciertan menos cuanto más lejos (a 15 m, 4 de cada 10).
  El que te defiende te sigue y le tira (o le pega) a los hostiles que se te acercan y al que te pegó; no tira si estás
  en la línea de tiro y a vos no te lastima. El que recibe un tiro se da vuelta contra el que se lo dio. En la Tool Gun
  → Actitud hay «Armado», «Te defiende» y una fila para elegir el arma, y se entiende escrito («un amigo que me
  defienda con un rifle»). En la red se ven el arma y los tiros. Prueba `pruebas/npc_armas.mjs` 7/7.
- **Tu propio logo** (.alemk): Ajustes → «Tu logo»: elegís una imagen y pasa a ser el logo de la pantalla de carga, el
  menú y la intro (queda guardada en el aparato; «Volver al de JXMod» la saca). En la app, «Crear acceso directo» pone
  en la pantalla de inicio un ícono con tu logo y el nombre que elijas (Android 8 o más nuevo pregunta dónde). Prueba
  `pruebas/logo_propio.mjs` 5/5 (el acceso directo, con el puente de Android simulado).

## JXMod 2.9-prueba4: cuadros por calidad, sombras de Ultra y franjas

- **Cuadros según la calidad** (`cuadroSalta` en `juego/principal.js`): Patata, Bajo y Medio buscan 120 (lo que dé la
  pantalla); Alto y Ultra, 60 parejos. Con la pantalla a 120 o 144 Hz, Alto y Ultra dibujan un cuadro sí y otro no (16,7 ms
  justos) en vez de 70-90 desparejos. La resolución dinámica apunta a esa meta (antes, siempre a 60). En la app se le pide a
  Android la frecuencia de pantalla que corresponde (`JXNativo.frecuencia`): muchos celus dejan las apps en 60 Hz aunque
  la pantalla dé 120. Prueba `pruebas/cuadros_meta.mjs` 5/5 (con pantallas simuladas: la compu no llega a 120 de verdad).
- **Ultra con las sombras medias** (las de Alto: 2048, sin PCSS): las de 4096 con PCSS costaban mucho y no se veían mejor.
- **Franjas en el cielo y los degradados**: la escena volvió a la luz alta de 8 bytes (RGBA16F). En la de 4 bytes
  (R11F_G11F_B10F, de la 2.9) el azul tiene 5 bits de mantisa y el cielo hacía 5 veces más escalones (8,9 % de los cambios
  saltaban 2 niveles o más, contra 1,8 %). El resplandor, los rayos y los reflejos del agua, que son borrosos, siguen en la
  de 4.
- **SSAO sin la línea punteada en los bordes**: el giro de las muestras usa un patrón de 4×4 que se repite (Bayer) y el
  desenfoque, 4 muestras parejas que lo cancelan justo (antes un ruido sin período y 7 muestras, que dejaban la línea; en
  el celu, a un cuarto de la resolución y estirada 4 veces, se veía como rayas). Además es más barato.

## JXMod 2.9-prueba5: sin tope de cuadros

- **Ninguna calidad tiene tope** (`cuadroSalta` en `juego/principal.js`): con la pantalla a 120 o 144 Hz, Alto y Ultra
  también dibujan todo lo que da el aparato (en la 2.9-prueba4 iban a 60 parejos). La resolución dinámica apunta a 120 en
  Patata, Bajo y Medio y a 60 en Alto y Ultra: si pasan de 60 no les baja la nitidez para perseguir 120. En la app se le
  pide siempre a Android la frecuencia más alta. Prueba `pruebas/cuadros_meta.mjs` 5/5.
- **gm_construct sin huecos junto a las veredas** (`herramientas/gmod_terreno.py`, lo usa `gmod.py`): el conversor tiraba
  entero cada triángulo del pasto (los terrenos de Source) cuyo centro quedaba debajo de una vereda, y esos triángulos
  miden hasta 5 m: quedaban franjas de hasta 0,9 m sin piso por las que se veía el cielo. Ahora cada uno se recorta contra
  los sólidos y queda lo de afuera (303 tapados → 462 pedazos; el choque usa la misma malla). Prueba
  `pruebas/huecos_mapa.mjs` (recorre a pie el mapa, 163 lugares × 8 direcciones, fondo magenta y un rayo por píxel):
  antes 2 vistas con 1,7 % de hueco, después ninguna (0,022 % → 0,012 %, lo que queda son bordes de un píxel). 2/2.
- **Mods de GMod en cuadrícula** (`juego/gmod_panel.js`): el botón GMod abre una tarjeta por mod (su imagen del Workshop,
  su nombre y qué es: armas, NPCs, vehículos, personajes, efecto de pantalla, modo de juego...). Tocar una tarjeta entra
  a la página del mod y «‹ Mods» vuelve. Los que sólo traen mapas no están: van a Mapas (abajo avisa cuántos).
- **Efectos de pantalla como interruptor**: un mod que sólo dibuja sobre la imagen (VHS, filtros, visión nocturna) no se
  "pone": se prende y se apaga con el interruptor de su tarjeta, y su página empieza con el interruptor y sus ajustes.
  Queda guardado. Cualquier mod que corre cosas propias también tiene su interruptor en la página (apagado, sus hooks no
  corren). Antes `RenderScreenspaceEffects` no se llamaba y `DrawColorModify`/`DrawMaterialOverlay` estaban vacías: un
  VHS no hacía nada. Ahora el color (contraste, saturación, lo que suma y resta) se aplica a la imagen del juego, debajo
  de la HUD, y el material se dibuja a toda la pantalla. Prueba `pruebas/mods_cuadricula.mjs` 14/14 (con un VHS de prueba
  hecho en la prueba, la Lightsaber, M9K y un mod de mapas; compu y celu); `pruebas/gmod_panel.mjs` 18/18.

## JXMod 2.9-prueba6: funciones de los mods por separado y objetos en orden

- **Cada función de un mod con su interruptor** (`juego/gmod_panel.js`, `gmaHookApagado` en `juego/gmod_api.js`): la
  página de un mod tiene «Funciones»: lo que hace por su cuenta, agrupado (efectos de pantalla, HUD, cámara y mira,
  movimiento y animaciones, teclas, dibujos en el mundo, daño y muertes, chat y voz, al aparecer, cada cuadro, permisos,
  otras), con los hooks de cada una. Si algo no anda (la HUD tapa, la cámara se rompe) se apaga sólo eso y el resto sigue.
  Queda guardado. El interruptor de arriba sigue apagando el mod entero.
- **Los objetos de cada mod, parejos y en orden**: todos en el mismo marco (64 px, el mismo fondo): el ícono propio del
  mod llena el marco, el modelo dibujado va entero encima del fondo y, si no hay imagen, el dibujo de su tipo (arma,
  NPC, vehículo, entidad, prop) en vez de la «G» o un cuadro vacío. En orden alfabético (con los números como números:
  «Alfa 2» antes que «Alfa 10»). Lo que no anda (sin su modelo, o con el modelo roto) va aparte y plegado, «No andan · N»,
  con el motivo. Las secciones van en orden: armas, entidades, NPCs, vehículos, personajes, props; después herramientas,
  habilidades, comandos y ajustes. Los íconos de modelos del contenido base de GMod/HL2 se reintentan cuando llegan (antes
  quedaban con la «G»).
- Prueba `pruebas/mods_cuadricula.mjs` 18/18 (compu y celu; con un pack de NPCs en desorden y uno sin su modelo, y las
  funciones del VHS de prueba por separado); `pruebas/gmod_panel.mjs` 18/18.

## JXMod 2.9-prueba7: optimizado para procesadores y placas de video muy flojos

- **Menos trabajo del procesador en cada cuadro** (`juego/gl.js`, `juego/sombras.js`): los valores que se le pasan a cada
  shader (cámara, sol, niebla, sombras, luces) se guardan y sólo se vuelven a mandar si cambiaron, y cada material
  recuerda su programa en vez de armar la clave y buscarlo en cada dibujo. Medido con `pruebas/banco_cuadro.mjs`
  (gm_construct en Alto, el procesador 12 veces más lento —como un Cortex-A53 a 1,4 GHz: Snapdragon 425, MT6739,
  Unisoc SC9832E—, tres corridas alternadas con la versión anterior): **22,0 → 14,7 ms por cuadro (−33 %)**.
- **Modo «procesador que no da»** (`TIEMPO.lento` en `juego/principal.js`, `npc.js`, `personas.js`, `sonidos.js`): si no
  llega a la meta de cuadros y el JavaScript de cada cuadro tarda más de 9 ms dos segundos seguidos (nivel 1) o más de
  16 ms (nivel 2), lo que no se nota se hace menos seguido: los NPCs a más de 15 m cada 2 cuadros y a más de 30 m cada 4,
  las animaciones de lejos más espaciadas, los pasos cada dos cuadros (la música y los sonidos de fondo, igual que
  siempre) y, sólo en el nivel 2, la física de los objetos a 30 por segundo con el doble de paso. Vuelve solo cuando sobra. Con el nivel 2: 14,7 → 13,3 ms en la misma escena.
  `pruebas/lento_fisica.mjs`: las 8 cajas caen y quedan a la misma altura que sin el modo (0 cm de diferencia), los 6 NPCs
  caminan lo mismo y ninguno se cae ni atraviesa una pared.
- **Ahorro de GPU en Alto y Ultra elegidos a mano** (`gfxAhorroPaso` en `juego/principal.js`): si la resolución dinámica
  ya bajó al 80 % (o a su piso) y unos segundos seguidos igual no llega a la meta, y la que frena es la placa (no el
  procesador), se apaga de a uno lo que más le cuesta a la GPU y menos se nota, con el aviso «Gráficos: ahorro N»:
  1) la oclusión ambiental (SSAO y la pasada de profundidad de todo el mapa), 2) el brillo (bloom) y el reflejo del agua a
  menos resolución, 3) el mapa de sombras a 1024. Sin recompilar nada (no se traba al cambiar). Cuando vuelve a sobrar
  con la resolución entera, vuelve un paso; si al volver no alcanza, se queda. Se reinicia al cambiar la calidad.
  Lo que se le pide a la GPU por cuadro (`pruebas/ahorro_gpu.mjs`, 20 cuadros fijos en gm_construct):

  | Paso | Dibujos | Pasadas | Megapíxeles cubiertos |
  |---|---|---|---|
  | 0 (Alto) | 129 | 18 | 6,2 |
  | 1 | 90 | 14 | 4,5 |
  | 2 | 81 | 5 | 3,9 |
  | 3 | 80 | 5 | 3,1 |

- **Arreglado antes de salir**: con el guardado de programas por material, pasar de Alto a Ultra en los ajustes dejaba
  la pantalla blanca (quedaban programas ya borrados); ahora se invalidan al cambiar la calidad.
  `pruebas/captura_igual.mjs`: las 4 calidades se ven igual que la versión anterior (diferencia 0,2–2,2 % de píxeles,
  lo mismo que entre dos corridas de la misma versión, 0,5–2,6 %).
- Sin probar en un celular de verdad: el procesador lento es una simulación (Chromium frenado 12 veces) y la GPU de las
  pruebas dibuja con el procesador, así que el ahorro de GPU se midió por el trabajo pedido, no en cuadros por segundo.

## JXMod 2.9-prueba8: el VHS de los mods de verdad, efectos siempre activos y descargas que no se traban

| | Antes | Ahora |
|---|---|---|
| First-Person Body | `goto skip (sólo se admite el goto al final del bucle)` | carga y corre sin errores |
| Viewfinder (cámara VHS) | la imagen quedaba igual, sin estética VHS | corre la cadena de shaders del propio mod: señal compuesta, color corrido, fantasmas, el OSD dentro de la cinta |
| Texto del OSD | encimado y corrido de lugar | en su lugar y con la fuente del mod |
| Efecto sin el objeto en la mano | sólo con la cámara en la mano | siempre puesto (se apaga en la página del mod) |
| Descarga trabada | quedaba en 0 % para siempre | se corta y se reintenta sola; a los 3 intentos, botón «Reintentar» |
| Entrar a un server con mods | entrabas sin tenerlos | se bajan en la pantalla de carga y después entrás («Entrar sin esperar» si uno no termina) |

- **`goto` completo en el Lua** (`juego/gmod_lua.js`): hacia adelante, hacia atrás, como `continue`, saliendo de dos
  bucles, desde adentro de un `if`, en `repeat` y en corrutinas, con los errores de Lua 5.2 («no visible label»). Sirve
  para cualquier mod, no sólo para el First-Person Body. `pruebas/lua_goto.cjs` 13/13.
- **Los shaders de DirectX 9 de los mods, en WebGL** (`juego/gmod_dx9.js`, nuevo): los addons que traen sus propios
  shaders compilados (`shaders/fxc/*.vcs`, ps_2_0 a ps_3_0) se traducen a GLSL al vuelo: registros, saltos y bucles,
  modificadores, lectura y escritura en sRGB o lineal como pide el material.
- **Render targets y pasadas de pantalla** (`juego/gmod_rt.js`, nuevo): `GetRenderTarget(Ex)` (también de coma
  flotante), `Push/PopRenderTarget`, `render.Clear` por viewport, `UpdateScreenEffectTexture`, `CopyTexture`,
  `DrawScreenQuad(Ex)`, `CapturePixels`/`ReadPixel`, mezclas, filtros y los shaders de pantalla de GMod
  (`g_colourmodify`, `g_blurx/y`, `g_refract`, `pp/*`).
- **Lo 2D de los mods en orden**: el texto y las cajas que dibuja un mod iban a una capa aparte, encima de todo, y
  nunca entraban en lo que el mod copiaba de la pantalla. Ahora, antes de cada copia o cuadro de pantalla, lo 2D pendiente
  se vuelca a su destino (la pantalla o el render target puesto), como en GMod: el OSD de la cámara pasa por la cinta.
- **Las fuentes de los addons** (`resource/fonts/*.ttf|otf`): se cargan al montar el addon, se buscan por su nombre de
  familia y el tamaño es el de GMod (alto de la celda, no el em de CSS). También `file.Open` (leer y escribir en
  `data/`, con números binarios) y `HUDPaintBackground`.
- **Texto de mods corrido en la compu**: los botones táctiles ocultos contaban como «zona ocupada» arriba a la izquierda
  y el motor bajaba el texto de los mods que caía ahí (un área de ~600×300). Ahora cuentan sólo los botones que se ven,
  y la regla se aplica únicamente al HUD común (`HUDPaint`), no a los efectos de pantalla.
- **Efectos visuales siempre activos** (`gmaFantasma` en `juego/gmod_api.js`): si un mod dibuja sobre la pantalla sólo
  cuando tenés su objeto en la mano (lo detecta leyendo su Lua: una o dos armas propias, hooks de pantalla, un
  posproceso de pantalla completa fuera del arma y de sus entidades, y en el resto de su código pregunta por el arma
  activa con esa clase; de 101 addons bajados sólo entra el Viewfinder, la Lightsaber y la Portal Gun no), dentro de sus hooks de dibujo, cámara y cuadro el jugador
  «tiene» ese objeto aunque tenga otra cosa o nada. El mouse y el disparo no le llegan (no te roba el tiro), el teclado
  sí (sus teclas siguen andando: grabar, la batería). En el panel GMod el mod aparece como efecto, con «Siempre activo»
  prendido; apagado, vuelve a necesitar el objeto en la mano. Sirve para cualquier mod de ese tipo.
- **Nivel DirectX según la calidad** (`gmrtSM3`): en Patata, Bajo y Medio el motor se comporta como GMod en una placa
  floja (DirectX 90, sin shaders ps_3_0) y los mods que traen versión liviana la usan; en Alto y Ultra, la completa.
  Con el Viewfinder, milisegundos por cuadro en el navegador de pruebas (dibuja por software, así que sólo sirve para
  comparar entre sí):

  | Escena | ms por cuadro |
  |---|---|
  | Sin el mod | 500 |
  | VHS alta fidelidad (ps_3_0, Alto/Ultra) | 3983 |
  | VHS compatible (ps_2_0b, Patata/Bajo/Medio) | 850 |
  | VHS con el «modo rendimiento» del propio mod | 750 |

- **Descargas que se trababan en 0 %** (`juego/gmod.js`, `gmod_cola.js`, `gmod_pipe.js`): tiempo máximo para la caché del
  navegador, para la conexión y para cada pedazo que llega; un vigilante en la cola que da por trabada una bajada sin
  avance, la corta y la reintenta; un `.gma` que llega cortado ya no se acepta. `pruebas/descarga_trabada.mjs` 4/4.
- **Servers con mods**: al entrar, la pantalla de carga baja los mods del server que no tenés («Bajando los mods del
  server 1/2 · nombre NN %») y entra cuando están montados; si uno no termina, «Entrar sin esperar».
  `pruebas/server_mods_carga.mjs` 4/4.
- Pruebas nuevas: `pruebas/vhs_viewfinder.mjs` 4/4 (en Alto: la prueba de píxel del propio mod pasa y elige la señal de
  alta fidelidad, la imagen cambia, el OSD entra en la cinta con la fuente del mod, `file.Open` guarda su
  configuración, sin errores) y `pruebas/efecto_siempre.mjs` 5/5 (en Medio, con la Physics Gun en la mano: el VHS
  puesto con la versión liviana, el mod no recibe el disparo, el interruptor del panel lo saca y la imagen vuelve a la
  normal, sin errores).
- Sin probar en un celular de verdad. El costo del VHS en una placa de celular no está medido: sólo la comparación de
  arriba, en un navegador que dibuja con el procesador.

## JXMod 2.9-prueba9: los mods y mapas no se pierden, y si el juego se traba queda el registro

Dos problemas de la prueba8: el juego se quedaba congelado en el último cuadro a los pocos segundos de abrir, y los
mods y mapas bajados no aparecían.

- **Mods y mapas que «desaparecían»** (`juego/gmod.js`): la prueba8 le ponía un tiempo máximo corto a la caché del
  navegador al arrancar; en un celular ocupado la caché tarda y el mod se salteaba (o, peor, se daba la caché por rota
  y no se montaba ninguno). No se borraba nada: la lista de instalados y los `.gma` seguían guardados. Ahora al
  arrancar la caché se espera lo que haga falta (el tiempo máximo queda sólo para revisar antes de bajar y para
  guardar); si la caché falla, se reintenta a los 15 s; si un mod de la lista de verdad no está guardado, se vuelve a
  bajar solo. Nunca se saca un mod de la lista por un error de lectura.
- **Modo seguro**: si el juego se traba 3 veces en 5 minutos, la app lo abre con `?seguro=1`: los mods no se cargan esa
  vez (siguen instalados) y se avisa.
- **Caja negra** (`juego/cajanegra.js`, nuevo): un registro chico que se guarda solo cada 2 s y en el acto antes de
  cada paso riesgoso (montar un mod, correr su Lua, compilar un shader de un mod, las primeras veces que corre cada
  hook de un mod, y siempre si un hook tardó más de 150 ms). Guarda el estado (mapa, calidad, cuadros por segundo,
  memoria, mods montados, cola de bajadas, errores de Lua).
- **La app vigila al juego** (`apk/web/.../Web.java`): el juego le manda un latido por segundo; si pasan 45 s sin
  latido con la app adelante, la app guarda lo que vio (motivo, aparato, consola del juego y `logcat` del proceso) en
  `registro.txt` y rearma el juego. Lo mismo si el sistema mata el proceso de dibujo. Al volver aparece «El juego se
  trabó la última vez», con el último paso («Se quedó en: …») y «Copiar registro». Si se trabó adentro de un mod, ese
  mod se apaga (se vuelve a prender desde su página en el panel GMod). El registro también está en Ajustes →
  «Registro de fallas».
- **Causas probables del cuelgue, corregidas**:
  - en el celular el motor es siempre DirectX 90 (sin shaders ps_3_0), aunque la calidad sea Alto: la versión de alta
    fidelidad del VHS del Viewfinder pesa unas 7 veces la escena y su compilación sola puede congelar una placa de
    celular; los shaders de los mods se compilan recién cuando se usan, y nunca uno ps_3_0 si no corresponde;
  - si el hilo que descomprime los mods no contesta, se rearma el hilo en vez de descomprimir en el hilo del juego
    (eso congelaba la pantalla varios segundos con un mod grande);
  - con la caché paciente ya no se re-bajan mods al arrancar por un tiempo máximo vencido.

| | prueba8 | prueba9 |
|---|---|---|
| Mods montados con la caché lenta (12 s por lectura) | 0 de 2 | 2 de 2 |
| Mod instalado que falta en la caché | no se monta | se vuelve a bajar solo y se monta |
| Si el juego se traba | queda congelado, sin datos | la app lo rearma en ≤ 45 s y muestra el registro |
| Shader ps_3_0 del VHS en un celular en Alto | se compila (pesado) | no se compila (DirectX 90) |
| Descompresión si el hilo no contesta | en el hilo del juego | se rearma el hilo |

- Pruebas nuevas: `pruebas/mods_no_se_pierden.mjs` 4/4 (con la prueba8: 1 y 2 fallan) y `pruebas/caja_negra.mjs` 5/5
  (celular emulado: latidos, pasos de los hooks en la caja, DirectX 90 en Alto; después de un cuelgue simulado aparece
  la ventana con el último paso y el log de la app, el mod se apaga, «Copiar registro» copia todo, Ajustes lo muestra,
  sin errores). Siguen pasando `descarga_trabada` 4/4, `server_mods_carga` 4/4, `efecto_siempre` 5/5,
  `vhs_viewfinder` 4/4, `gmod_panel` 18/18, `mods_cuadricula` 18/18 y `lua_goto` 13/13.
- Sin probar en un celular de verdad: el cuelgue exacto no se pudo reproducir acá. Si vuelve a pasar, el registro dice
  en qué paso quedó.

## JXMod 2.9-prueba10: el juego ya no se congela al montar el Viewfinder

En la prueba9 el juego seguía quedando congelado con el Viewfinder «al 99 %» (captura del usuario: menú principal, la
descarga girando y nada más respondiendo).

- **La causa** (medida con el perfilador en un celular simulado, procesador 4 veces más lento): al cargarse, el
  Viewfinder dibuja la textura de ruido de su visión nocturna borrando 1024 cuadraditos de a uno (`render.Clear` con
  `render.SetViewPort`). Por cada operación de dibujo de un mod, el juego guardaba el estado de WebGL y lo volvía a poner
  (`gmrtGuardar` en `gmod_rt.js`) preguntándoselo a la placa con `getParameter`. Once de esas preguntas (viewport,
  recorte, máscaras, mezcla, color de borrado) no las contesta el navegador de su lado: esperan a que la placa termine
  todo lo pendiente (~150 µs cada una en la compu sin nada encolado). Resultado: 256 s de los 267 s medidos se iban en
  `getParameter`, y el «99 %» era el Lua del mod corriendo con el juego congelado.
- **El arreglo** (`juego/gl.js`, `glSombra`): el juego lleva una copia de ese estado cuando lo pone (viewport, scissor,
  depthMask, colorMask, blendFunc/Separate, blendEquation/Separate, clearColor) y `getParameter` la contesta sin ir a la
  placa. Sirve para cualquier mod que dibuje en render targets, no sólo el Viewfinder. Con `?sombra=0`, como antes.
- **Un mod que traba el juego al cargarse queda sin cargar** (`gmod_api.js`, `gmod_cargar.js`, `cajanegra.js`,
  `gmod_panel.js`): si la caja negra dice que la vez anterior se trabó corriendo el Lua de un mod (o montándolo), al
  abrir ese mod queda montado pero sin correr su Lua (antes sólo se apagaban sus hooks, y al abrir se volvía a trabar;
  ahora se decide antes de montar los mods). El aviso lo explica y su página del panel GMod tiene «Volver a cargarlo».
- **WebGL perdido que no vuelve**: si el navegador no devuelve el contexto en 10 s, el juego se recarga solo y avisa
  (antes quedaba la última imagen congelada para siempre, con el juego vivo por detrás y el latido llegando a la app).
- El paso «montando el mod» se anota sólo mientras se monta, no mientras se espera a la caché (no culpa a un mod por
  una espera).

| Celular simulado (procesador ×4), menú principal, Viewfinder por la cola | prueba9 | prueba10 |
|---|---|---|
| Bajado y montado | no termina: queda en «montando 99 %» | 12,3 s |
| Juego congelado (el peor hueco) | ~250 s (perfil: 256 s en `getParameter`) | 2,2 s |
| Latidos a la app mientras tanto | se cortan | siguen (12 en 12 s) |
| Si se traba en el Lua de un mod | se vuelve a trabar al abrir | queda sin cargar, «Volver a cargarlo» |
| WebGL perdido que no vuelve | imagen congelada para siempre | se recarga a los ~11 s |

- La imagen no cambia: misma escena en Bajo, Medio, Alto y Ultra con y sin la copia del estado, diferencia media
  0,54–1,51 (de 255); dos capturas iguales sin el arreglo ya difieren 0,22–1,45.
- Prueba nueva: `pruebas/montar_sin_trabar.mjs` 4/4 (con `ANTES=1`, la versión sin el arreglo queda en «montando
  99 %» con el hilo del juego trabado más de 25 s). Siguen pasando `caja_negra` 5/5, `mods_no_se_pierden` 4/4,
  `vhs_viewfinder` 4/4, `efecto_siempre` 5/5, `descarga_trabada` 4/4, `server_mods_carga` 4/4, `gmod_panel` 18/18,
  `mods_cuadricula` 18/18 y `lua_goto` 13/13.
- Sin probar en un celular de verdad.

## JXMod 2.9-prueba11: puertas en los mapas, HUD ordenado, app para iPhone y lo del Discord

- **Puertas de los mapas de GMod** (`juego/puertas.js`, `gmod_bsp.js`): `func_door`, `func_door_rotating` y
  `prop_door_rotating` (esta última ni se cargaba: por eso el Liminal Hotel «no tenía puertas»). Se abren con E
  («E: abrir la puerta»), giran para el lado contrario al jugador, se cierran solas si el mapa lo pide, no se cierran
  encima de nadie (vuelven a abrirse) y en una sala se mueven igual para todos. Las dobles (dos hojas con el mismo
  nombre, o `slavename`) se abren juntas. Las puertas invisibles con el modelo pegado (los casilleros de HL2) también,
  con su caja de choque sacada del modelo de bloques. Los botones (`func_button`) y las zonas (`trigger_*`) que abren
  puertas con sus salidas Open/Close/Toggle andan («E: apretar el botón»). La distancia que se corre una puerta es la de
  Source (lo que mide, menos 2 unidades y menos el `lip`; con un lip grande se corre para el otro lado, como los
  ascensores de HL2). Prueba `pruebas/puertas_mapa.mjs` 8/8 en gm_hotel (8 de modelo + 13 de bloques, 19 con caja) y
  ph_motel_blacke_v3 (9 de 9).
- **Agacharse y escaleras** (`jugador.js`): agachado el cuerpo mide la mitad (como en GMod) y pasa por un hueco de
  1,25 m; si soltás agacharse debajo de algo, sigue agachado hasta que hay lugar. Las escaleras de 20 y 40 cm se suben
  caminando casi a la misma velocidad que en llano, con la cámara suave, y se puede saltar en ellas. Prueba
  `pruebas/agacharse_escalones.mjs` 5/5.
- **HUD del celular ordenado** (`juego/hudorden.js`, `hud.js`): arriba a la izquierda, tres filas separadas: sistema
  (pausa primera, chat, celular, micrófono), crear (props, MOD, GMod, spawn, Verity) y las teclas de los mods con su
  placa. Sin huecos (lo que no se ve no deja lugar vacío), con los márgenes de la guía de diseño y respetando el área
  segura del aparato (la isla o el agujero de la cámara, las puntas redondeadas). Prueba `pruebas/hud_orden.mjs` 5/5
  (teléfono 873×393, teléfono chico 640×360 y tablet 1180×820: nada se pisa ni queda afuera).
- **Las teclas de los mods se entienden** (`juego/acciones.js`): de lo que dice el Lua alrededor de cada tecla (los
  comentarios, los nombres, los textos) sale qué hace —zoom, linterna, recargar, grabar, enfocar, poder, guardar,
  menú…— y el botón muestra su ícono y su nombre, con la tecla en una etiqueta. Dos teclas que hacen lo mismo dan un
  solo botón. Con el Viewfinder: Visión (N), Linterna (L), Grabar (P), Enfocar (I), Menú (O), Guardar (G).
- **«Ordenar» y «Ordenar con IA»** en el editor de controles: «Ordenar» deja lo que más usás más cerca del pulgar (el
  juego cuenta los toques); «Ordenar con IA» le pide el orden al Gemini del dueño por la tienda (`/api/ia/hud` en
  `tienda/worker.js`; **hay que volver a desplegar la tienda** para que ande), o a tu clave de Gemini, o a la IA
  pública; lo que contesta se valida (ids conocidos, sin repetir, máximo 6 por fila, la pausa primera) y si no
  contesta, ordena por uso y avisa.
- **Guía de diseño** (`diseno/guia_diseno.json`): 194 fuentes de 128 sitios (Apple, Material, WCAG, Xbox y Game
  Accessibility Guidelines, Nielsen Norman, estudios del pulgar, HUD de PUBG/CoD/Free Fire/Genshin…), 54 reglas con
  números y una sección para este juego; su resumen es lo que se le da a la IA para ordenar.
- **Menú de pausa nuevo** (como el concepto del Discord): tarjeta blanca, «Seguir» azul, tarjetas con ícono
  (Personaje, Arma en la mano, Social, Ajustes, Ver el tutorial, Borrar todo en rojo —pide tocar dos veces—) y abajo
  «Salir al menú» y los cuadros por segundo. Menú principal con detalles dorados y letras sin borde negro.
- **App para iPhone y iPad** (`juego/ios.js`, `herramientas/web_app.py`, carpeta `web/`): se abre en Safari y se
  instala con Compartir → «Agregar a inicio»; queda a pantalla completa en horizontal, con su ícono, y anda sin
  internet con lo que ya se usó una vez. En iPhone arranca en calidad Media y en iPad en Alta.
- **Efectos visuales de los mods más livianos**: el VHS del Viewfinder medía sus textos en cada cuadro y la caja negra
  guardaba el registro en el almacenamiento en cada cuadro mientras corría su hook (`cajanegra.js`, `gmod_api.js`).
  Ahora los anchos de los textos se recuerdan y la caja negra guarda a lo sumo una vez por segundo.
  Medido con el Viewfinder siempre activo en Medio (240 cuadros, dos corridas alternando la versión anterior y ésta):
  su hook de la HUD pasó de 3,73 y 3,59 ms por cuadro a 3,12 y 2,54 ms (−23 %); todo el Lua de hooks, de 4,78 y 4,63
  a 4,25 y 3,65 ms (−16 %). En la compu de prueba el cuadro lo manda la placa simulada (~0,5 s), así que los cuadros
  por segundo de acá no muestran la mejora; en un celular el procesador pesa más.
- Si un mod traba el juego al cargarse, el aviso dice su nombre (antes a veces mostraba sólo el número).
- Los props estáticos de los mapas compilados con la versión 11 del lump (GMod nuevo) usan su escala (antes salían
  todos de tamaño 1: muebles agrandados o achicados que parecían fuera de lugar). Las camas del Liminal Hotel no se
  pudieron revisar: ese mapa no está en el catálogo con ese nombre.
- Sin probar en un celular ni en un iPhone de verdad (el iPhone, simulado en Chromium: no hay Safari acá).

## JXMod 2.9-prueba12: menú principal sin amontonar, ícono de la app a elección y página con código para iPhone

- **Menú principal** (`juego/inicio.js`, `template.html`): la lista va entre el logo y los botones de abajo y se achica
  junta (letras, márgenes y separadores, nunca menos de 14 px) hasta entrar; si aun así no entra, se desliza. El logo
  es más bajo en pantallas bajas y la versión pasó arriba a la derecha. Prueba `pruebas/menu_principal.mjs` 4/4 en
  800×368 (la captura del Discord), 640×360, 873×393, tablet 1180×820 y compu 1366×768: nada se pisa (con 8 px de aire)
  y las letras quedan entre 17 y 18 px en el celular (antes la lista se metía debajo de los botones).
- **Ícono de la app a elección, como en Discord** (Ajustes → Ícono de la app; `juego/iconoapp.js`,
  `herramientas/iconos_app.py`): 8 que vienen (Clásico, Noche, Dorado, Neón, Rojo, Blanco, Azul, VHS) y «Tu imagen».
  - En Android cambia el ícono de verdad (alias de la actividad en el manifiesto; `JXNativo.iconoApp` en `Web.java`).
    «Tu imagen» se recorta cuadrada y queda como acceso directo (Android no deja que una app se ponga cualquier imagen
    como ícono propio).
  - En Safari, el elegido es el de «Agregar a inicio» y hay un botón que baja un instalador (.mobileconfig) con ese
    ícono.
  - Prueba `pruebas/icono_app.mjs` 5/5.
- **iPhone/iPad: página con código en vez de app.** Se probó una app nativa (.ipa para instalar con Sideloadly) y se
  sacó a pedido: en iPhone se juega desde la página, que pide un código.
- **Página con código** (`herramientas/codigo_web.mjs`, la usa `web/index.html`): el link pide un código y sin él no
  hay juego; si alguien se baja el HTML, no le sirve. No es un candado de pantalla:
  - el código del juego va cifrado en `web/juego.bin` (AES-GCM con una clave al azar) y el paquete `web/pk.bin`
    (modelos, texturas, sonidos) también (AES-CTR: se descifra a medida que baja, `juego/datos.js`);
  - la clave se guarda una vez por código, cifrada con lo que sale del código **y de la dirección de la página**
    (PBKDF2-SHA256, 150 000 vueltas): una copia en otro lado (otra página, otra carpeta, el HTML bajado a la compu) no
    abre ni con un código bueno;
  - ya abierto, el código del juego no queda en la página (se saca el `<script>` apenas corre);
  - el código se recuerda en el aparato: la próxima vez entra solo, también sin internet;
  - donde el navegador no trae `crypto.subtle` lo hace el mismo cifrado escrito en JS (comparado contra el de Node:
    iguales; 0,27 s la clave, 15 ms por MB el paquete, en la compu).
  - **Un solo código para todos** (pedido así): está **fuera del repo**, en `/root/.jxmod/codigos.txt` («CÓDIGO  nombre»
    por línea; se pueden poner más). Se pone una vez por aparato. En el iPhone, Safari y la app de la pantalla de
    inicio guardan cada uno lo suyo, así que el pedido avisa que conviene agregarla a inicio primero y poner el código
    ahí. Cambiar el código: cambiar la línea y volver a armar (el viejo deja de andar y lo vuelve a pedir).
    Agregar otro: `--nuevos 1`. Otra dirección: `--lugar https://.../carpeta/`.
  - Armado: `armar.sh` con `PK_BIN=1 APP_WEB=1` → `node herramientas/codigo_web.mjs CARPETA` →
    `herramientas/web_app.py CARPETA`.
  - Prueba `pruebas/codigo_web.mjs` 9/9: sin código no arranca y ni el juego ni el paquete se pueden leer; uno
    equivocado avisa; el bueno (en minúsculas y sin guion también) abre en ~4 s y no lo deja a la vista; al volver a
    abrir y sin internet entra solo; uno dado de baja lo vuelve a pedir; sin `crypto.subtle` abre igual (0,6 s); una
    copia en otra carpeta y la página de verdad servida desde otra dirección no abren con un código bueno.
    `app_ios.mjs` 5/5 con el paquete cifrado (juega gm_construct sin internet).
  - Lo que esto no tapa: quien tiene un código y sabe usar las herramientas del navegador puede sacar el juego mientras
    corre (pasa con cualquier juego web); el APK trae el juego sin cifrar; el código fuente está en este repo público y
    las versiones viejas de `web/` siguen en el historial de GitHub; `web/rb/` y `web/emotes/` (mapas, personajes y
    sonidos que se bajan aparte, muchos de otros juegos) van sin cifrar.
- Sin probar en un celular ni en un iPhone de verdad (el iPhone, simulado en Chromium: no hay Safari acá).

## JXMod 2.9-prueba13: lo del Discord (NPCs que caminan, disparo en 3ª persona, skins en red, ruleta y emote nuevo, VJ Base)

- **Liminal Hotel** (`gmod.js`, `mapaio.js`): las camas usan la pose de su primera secuencia cuando la caja del modelo
  calza con ella (la cama trae la raíz girada 90°). Antes 86 de 133 camas atravesaban la pared, hasta 82 cm; ahora
  ninguna. Los mapas de Source mueven sus cosas: botones de dos posiciones, zonas, `ambient_generic` (los sonidos del
  mapa, como el tocadiscos, en bucle o una vez), `func_rotating`, `logic_relay`/`logic_auto`, con demoras y veces; en
  una sala, para todos. Pruebas `props_pose.mjs` 4/4, `mapa_io.mjs` 6/6, `puertas_mapa.mjs` 8/8.
- **Linterna en los mapas del Workshop** (`gl.js`): con luz horneada el sombreado no usaba el sol, la placa sacaba esa
  variable y las luces quedaban sin cargar: la linterna sumaba 0. Ahora suma +83 a +86 de brillo, como en los mapas
  propios. Prueba `linterna_bsp.mjs` 4/4 (antes 2/4).
- **Los NPCs y los personajes caminan sin patinar** (`humano.js`): el ritmo de los clips de GMod salía de la velocidad
  del jugador de GMod, no del personaje. Ahora cada personaje mide, una vez por clip y recién cuando lo usa (2 ms), a qué
  velocidad va su pie apoyado, y el largo del paso sale de los pasos por segundo de una persona a esa velocidad
  (caminar despacio ya no es correr en cámara lenta). Prueba `npc_caminar.mjs` 5/5 con el Hero. Cuánto patina el pie
  apoyado (0 = clavado, 1 = a la velocidad del cuerpo), antes → ahora:

  | Hero | 1,5 m/s | 2 m/s | 4 m/s | 6 m/s | de costado | agachado |
  |---|---|---|---|---|---|---|
  | promedio | 1,48 → 0,20 | 1,47 → 0,17 | 1,41 → 0,15 | 0,70 → 0,12 | 0,76 → 0,34 | 1,03 → 0,24 |

  A 2 m/s da 2,0 pasos por segundo de 0,91 m (a 6 m/s, 3,6 de 1,65 m). Jake y Freddy mejoran en todo pero no pasan
  todos los criterios (de costado quedan cerca de 0,4; Jake, por ser bajito, da pasos de caminar casi tan largos como
  los de correr).
- **Armas de los addons en 3ª persona** (`gmod_api.js`, `gmod_pm.js`): `GetShootPos`, `EyePos` y `GetEyeTrace` daban la
  cámara, que en 3ª persona va 3 m atrás. Ahora la bala sale de los ojos y va a lo que está en la mira; la trazadora y lo
  que crea el arma salen del arma en la mano (o, si el modelo no tiene mano de Valve, como el perro, adelante del
  hocico). Perro con la Nyan Gun: la bala salía a 3,1 m de los ojos → 0; el arcoíris a 2,87 m → 0,38 m; la bomba de
  gatos a 2,47 m → 0,96 m. Prueba `disparo_tercera.mjs` 6/6 con el perro (antes 3/6) y con el Hero (antes 4/6). En 1ª
  persona, igual que antes.
- **Skins del Workshop en multijugador** (`gmod.js`, `red.js`): el que recibía sólo bajaba el modelo si estaba en el
  catálogo de la tienda; ahora le pide los datos a Steam y lo baja igual (con el tope de peso y la censura), y si la
  bajada se corta reintenta a los 30 s, hasta 4 veces. Un .gma importado de la compu no lo pueden bajar los demás: se
  avisa. Prueba `red_workshop.mjs` 6/6 (antes Beto veía a Ana como el Hero).
- **Ruleta de emotes como la de Fortnite** (`juego/ruleta.js`): mantener el botón de emotes (o la B) abre una ruleta de
  5 lugares; se desliza el dedo (o el mouse) y al soltar el personaje hace ese emote. Un toque corto abre el panel de
  emotes como siempre. Soltar en el medio la deja abierta: «Editar emotes» → tocar un lugar → elegir en el panel (con
  secciones y buscador). Se guarda en el aparato. Prueba `ruleta_emotes.mjs` 7/7 (compu y celular 873×393).
- **Emote nuevo: el baile del nene del bote («aura farming»)** (`herramientas/emote_aura.py`, `web/emotes/cmu/99_01.bin`):
  hecho a mano con el esqueleto de los emotes de captura. Rodillas y cabeza al ritmo (2 golpes por segundo), un brazo y
  después el otro barren del costado hacia adelante con la muñeca girando, y la cadera acompaña; 4 s que se repiten sin
  salto. Está primero en «Baile» y en la ruleta si nunca la editaste. Prueba `emote_aura.mjs` 5/5: las manos a ≥ 39 cm
  del torso, los pies se mueven ≤ 1 cm y ningún hueso salta más de 10,3 cm entre cuadros.
- **VJ Base, DrG Base y Crack-Life** (`gmod_api.js`, `gmod_prelude.js`, `gmod_spawn.js`): `require()` de los módulos de
  Lua de los addons, las constantes `SOUND_*` y `ENT.Model` como lista. Los NPCs de VJ Base (y los que viven de la IA del
  motor de Source, que acá no está) se ponen como NPC del juego con lo que dice su Lua: modelo, vida, daño cuerpo a
  cuerpo y si son amigos o enemigos. Prueba `vj_crack.mjs` 6/6: VJ Base (96 archivos) y DrG Base (87) cargan sin
  errores; los 19 NPCs de Crack-Life aparecen en el menú con su modelo; los 18 enemigos persiguen y pegan y Gus es amigo.
  - Lo que falta: la IA propia de VJ (ataques a distancia, armas, sonidos); los nextbots de DrG sólo se probó que cargan;
    HL Resurgence no se probó (no se encontró su número del Workshop); el Árbol de Crack-Life se ve como un palo rojo
    (no es un modelo con forma de persona).
- APK 2.9-prueba13 y página con código (`web/`) armados de nuevo; `codigo_web.mjs` 9/9.
- Sin probar en un celular ni en un iPhone de verdad (el iPhone, simulado en Chromium: no hay Safari acá).

## JXMod 2.9-prueba14: habilitar y deshabilitar mods, y la franja gris de gm_construct

- **Habilitar / Deshabilitar mods, uno o todos** (Discord: «opciones para desactivar/habilitar, desactivar todos/habilitar
  todos los mods», con el dibujo de los botones abajo del panel). En Mods y mapas, en el pie del panel:
  - en la página de un mod, sólo «Deshabilitar» o «Habilitar» de ese mod (los de «todo» no van ahí, como aclararon);
  - en la lista, «Deshabilitar todo» y «Habilitar todo» (el que no tiene a cuál aplicarse queda gris);
  - **GMod** (`gmod.js`, `gmod_tienda.js`): deshabilitado sigue instalado y guardado, pero no se carga (ni su Lua, ni sus
    armas, entidades, NPCs, modelos o mapas), como en el menú de addons de GMod. Se aplica al toque, también jugando (si
    tenías su arma en la mano, se saca), y al habilitarlo se vuelve a montar desde la caché sin bajar nada (0,4 s con la
    Nyan Gun en la compu de prueba). Si un server donde estás lo pide, sigue cargado hasta que salís; el modelo de otro
    jugador que viene de un addon deshabilitado se sigue viendo (de visita, sin su Lua);
  - **Mods del juego** (`inicio.js`): lo mismo; reemplaza la casilla «Activado» de la ficha. Los que ponen cosas (radio,
    piano, props) no tienen botón: están siempre en el menú de props;
  - los deshabilitados se ven apagados en la lista, con su marca, y la ficha lo avisa; textos en 14 idiomas;
  - el pie entra en un solo renglón también en un celular chico (640×360): el botón «más» oculto ya no ocupa lugar.
  - Prueba `pruebas/mods_habilitar.mjs` 9/9 (lista, ficha, guardado al volver a abrir, desde la caché, jugando con el arma
    en la mano, todo, pestaña Mods, pie en 873×393 y 640×360, sin errores).
- **La franja gris de gm_construct** (captura del Discord: el cordón entre la vereda y el pasto, gris liso, en un celular
  mientras se bajaba un mod grande): el gris es el que pone el juego mientras una textura no está lista. Si decodificar
  una textura fallaba (en el celular pasa con poca memoria libre, por ejemplo mientras se descomprime un mod), quedaba
  gris para siempre. Ahora se vuelve a intentar (1,5 s, 4 s, 10 s, 30 s y después cada minuto), también si no contesta en
  12 s, y queda anotado en la caja negra (`gl.js`). Prueba `pruebas/textura_reintento.mjs` 5/5 (antes 2/5: el cordón
  seguía gris a los 30 s); con 2 fallas seguidas la textura llega y el cordón se ve igual que sin fallas (0 de diferencia).
  - Lo que no se pudo: reproducir la falla de memoria de verdad (se simula haciendo fallar la decodificación); no se sabe
    con certeza que ésa fue la causa en ese celular, pero es la única forma en que el juego deja una sola textura gris.
- APK 2.9-prueba14 y página con código (`web/`) armados de nuevo; `codigo_web.mjs` 9/9.
- Sin probar en un celular ni en un iPhone de verdad.

## JXMod 2.9-prueba15: mouse en la PC, linterna de los mods, Half-Life Resurgence y Crack-Life Resurgence

- **Cámara congelada en la PC** (Discord: «quise jugar con un amigo y la cámara no reconoce el movimiento del mouse»): la
  capa de los controles táctiles cubre toda la pantalla también en la compu, así que el clic le llegaba a ella y el juego
  nunca pedía trabar el mouse; sin el mouse trabado la cámara no se mueve. Pasaba en un jugador y en red, también en las
  versiones anteriores. Ahora el clic se escucha también en esa capa (`entrada.js`). Una compu con pantalla táctil, que
  arranca con los controles táctiles, pasa a los de compu con el primer clic de un mouse de verdad (los clics que el
  navegador inventa después de un toque no cuentan). Prueba `pruebas/mouse_pc.mjs` 6/6 (antes 2/6): un jugador, dos
  jugadores en red (los dos), clic izquierdo y derecho con el mouse trabado, compu con pantalla táctil, y en el celular
  tocar no cambia nada y deslizar el dedo sigue girando la cámara.
- **La linterna de los mods** (Discord: «el mod de la linterna dinámica está súper bug: no ilumina y la cámara se vuelve
  loca»; es [VManip and SWEP] Extended Flashlight):
  - `ProjectedTexture` y `DynamicLight` eran objetos vacíos: ahora son un cono de luz (con las luces especiales del juego,
    las de la linterna: andan en todas las calidades) y una luz puntual que dura hasta su `DieTime` (`gmod_api.js`).
    Sirve para cualquier mod que las use (linternas, lámparas, fogonazos);
  - la cámara: el mod hace `CalcView = ángulos − (vm:GetAngles() − enganche.Ang)`, y `GetAngles()` del arma en primera
    persona daba 0 mientras los enganches venían en el mundo: la cámara se sumaba a sí misma en cada cuadro. Ahora la vista
    del arma dice dónde está y hacia dónde mira (`gmod_vista.js`);
  - el mod prende la luz con `CallOnClient` (en GMod con un jugador corre esa función del arma en el cliente): no hacía
    nada; ahora sí. Y al guardar el arma, `Holster` también corre en el cliente (el mod apaga ahí su luz: si no, quedaba
    una luz flotando);
  - Prueba `pruebas/linterna_mod.mjs` 7/7 (la versión anterior, 2 de 6): suma +29 a +33 de brillo en el centro (la
    linterna del juego, +28 a +30); el botón principal la apaga y la prende; quieta, la vista no se aparta (0°) y prendiéndola el arma la mueve 2° (como en
    GMod; antes estaba corrida 64°); girando 40° con el mouse la vista gira 40° (antes 100°); al cambiar de arma se apaga.
- **Half-Life Resurgence y Crack-Life Resurgence** (Discord: «compatibilidad con Crack-Life y Half-Life Resurgence»;
  2548809283, 705 MB, y 2691157473, 93 MB, con VJ Base):
  - los dos packs registran sus NPCs como «plugins» que VJ Base busca en `lua/vj_base/plugins/` cuando arranca. En GMod
    todos los mods están montados antes de que corra el Lua; acá un pack podía montarse después de que VJ Base ya había
    buscado, y sus NPCs no aparecían (0 en el menú). Ahora el juego anota dónde busca cada mod con `file.Find` mientras
    carga; si después se monta uno con archivos ahí, su Lua no corre suelto: el de todos se vuelve a cargar en orden, una
    sola vez (al arrancar, cuando terminó de montar todos) (`gmod.js`, `gmod_api.js`, `gmod_cargar.js`). Lo que registra un
    archivo de un pack queda anotado en ese pack aunque lo haya corrido VJ Base, así sus NPCs salen en su página;
  - al volver a cargar el Lua se olvidaban los módulos de `require()` del Lua anterior y VJ Base quedaba sin
    `ai_schedule` (pasaba también al deshabilitar un mod con VJ Base instalado): arreglado;
  - los rebeldes y ciudadanos eligen su modelo al aparecer (`PreInit`: hombre, mujer, médico); el juego lo corre para
    saber cuál usar. Esos modelos son de Half-Life 2: en el juego salen del contenido de GMod en Steam (por la tienda);
  - Prueba `pruebas/hl_resurgence.mjs` 5/5 (antes: 0 NPCs de los dos packs en el menú): los tres cargan su Lua sin
    errores (12 s en la compu de prueba); 125 NPCs de HL Resurgence y 46 de Crack-Life Resurgence en el menú; una muestra
    pareja de 36 aparece con su modelo (35 NPCs y la espora de Xen, que es una entidad); los 26 enemigos de la muestra
    persiguen y pegan en 5 s; los otros 10 (científicos, Barney, ciudadanos, cucarachas, la espora) no atacan.
  - Lo que falta: la IA propia de VJ (ataques a distancia, armas, sonidos) sigue sin estar: los NPCs andan como los del
    juego (persiguen y pegan, o pasean). HL Resurgence pesa 705 MB: en un celular de 2 GB puede no entrar; conviene
    instalarlo con wifi y en un aparato con lugar.
- **Texturas naranjas en gm_mallparking** (captura del Discord): no se pudo reproducir. En la compu de prueba los muebles
  de la cocina se ven beige en todas las calidades, con WebGL 1 y 2, en esta versión y en la de antes de la prueba13. Las
  texturas se decodifican igual en la compu y en el celular, así que no es eso. Puede venir de alguno de los mods
  instalados (con «Deshabilitar todo» se prueba en un minuto) o de algo de la placa de video de ese aparato; para seguir
  hacen falta el modelo del celular, la calidad gráfica y si pasa con los mods deshabilitados.
- APK 2.9-prueba15 y página con código (`web/`) armados de nuevo; `codigo_web.mjs` 9/9.
- Pruebas de antes, de nuevo: `mods_habilitar` 9/9, `textura_reintento` 5/5, `vj_crack` 6/6, `disparo_tercera` 6/6,
  `ruleta_emotes` 7/7, `linterna_bsp` 4/4, `mapa_io` 6/6, `props_pose` 4/4, `npc_caminar` 5/5, `gmod_abrir` 7/7,
  `gmod_mira_recarga` 7/7, `celu_mano` 27/27 y `red_workshop` 6/6 (en la tanda con todo junto dio una vez 5/6: con tres
  navegadores a la vez uno no llegó a armar el modelo del otro en 90 s; sola, 6/6).
- Sin probar en un celular ni en un iPhone de verdad, ni con un mouse de verdad (el clic y el mouse trabado se simulan en
  Chromium).

## JXMod 2.9-prueba16: optimizado para celulares de 512 MB y 1,4 GHz (Alto con sombras medias, y las demás calidades)

Pedido del Discord: «seguí optimizando todos los gráficos, ahora 512 de RAM, procesador a 1,4, en Alto y sombras
medianas; y los otros gráficos». Todo medido en la compu con un celular simulado: pantalla de 960×480, el procesador 12
veces más lento (lo que rinde un Cortex-A53 a 1,4 GHz en JavaScript), gm_construct con 6 objetos y 10 personajes
caminando. Las comparaciones son contra la prueba15, en las mismas condiciones.

- **Memoria** (`pruebas/celu512.mjs`: la de JavaScript después de juntar la basura y lo que se sube a la placa):
  - las animaciones guardan sus cuadros en arreglos de números chicos (`Float32Array`) en vez de listas de listas
    (`datos.js`, `vista.js`, `gmod_vista.js`); se ven igual;
  - la librería del multijugador armaba, la primera vez que mandaba algo, una tabla de 65 536 números (~7 MB) que casi no
    usa: ahora arma sólo los que hacen falta (`armar.py`);
  - al cambiar de mapa se sueltan las mallas y texturas del mapa anterior (antes quedaban en la memoria y en la placa:
    gm_construct → pizzería → desierto llegaba a 322 MB);
  - **modo memoria baja**, solo en aparatos de 1 GB o menos (o con `?mem512`): texturas sin transparencia en 16 bits
    (RGB565), las de los mods de GMod hasta 512 px, el mapa de sombras en 16 bits y las texturas que no se usaron en
    30 s se sueltan (se vuelven a subir si hacen falta). `pruebas/memoria_baja.mjs` 4/4: se ve igual (diferencia media
    1,5 a 2,8 de 255 en lo que no se mueve, sombras en el mismo lugar), la placa ocupa 36 MB en vez de 55.

  | Alto + sombras medias | JavaScript | Placa | Total |
  |---|---|---|---|
  | prueba15 | 87,4 MB | 64,6 MB | 152,8 MB |
  | prueba16 | 62,6 MB | 64,6 MB | 127,8 MB |
  | prueba16, memoria baja | 62,7 MB | 45,1 MB | 108,5 MB |

  | Total por mapa (Alto) | gm_construct | pizzería | desierto |
  |---|---|---|---|
  | prueba15 | 152,8 MB | 307,7 MB | 322 MB |
  | prueba16 | 127,8 MB | 248,3 MB | 147,5 MB |
  | prueba16, memoria baja | 108,5 MB | 107,7 MB | 103,4 MB |

  | Total por calidad | Patata | Bajo | Medio |
  |---|---|---|---|
  | prueba15 | 101,8 MB | 109,3 MB | 117,8 MB |
  | prueba16 | 76,1 MB | 84,4 MB | 92,9 MB |
  | prueba16, memoria baja | 75,3 MB | 80,0 MB | 84,8 MB |
- **Procesador** (`pruebas/banco_ab.mjs`, nuevo: las dos versiones abiertas en el mismo navegador, con el mismo azar —los
  personajes aparecen y caminan igual— y turnándose por tandas; antes las dos corridas de la misma versión daban 12,5 y
  14,5 ms y no se podía comparar):
  - cada pedazo de cada personaje mandaba a la placa la paleta entera de huesos (168 vectores, 2,7 kB) en cada pasada
    (sombras, profundidad, imagen): ahora sólo los huesos que usa esa malla y una vez por pasada si sigue el mismo
    personaje: de 59 a 7 subidas por cuadro (`gl.js`, `modelo.js`);
  - los colores y vectores sueltos de cada material (3 o 4 números) iban como listas, que el navegador convierte en cada
    llamada (4 veces más lento): ahora van como números sueltos;
  - los choques del jugador y de los NPCs descartan antes los triángulos que no pueden tocar (lejos de su plano) y ya no
    arman los cuerpos de los triángulos del mapa sólo para saltearlos (`jugador.js`, `mundo.js`);
  - los NPCs miran si el camino está libre (2 a 4 rayos cada uno) cada 0,1 s mientras van para el mismo lado, no en cada
    cuadro (`npc.js`);
  - `pruebas/huesos_igual.mjs` (nuevo) 3/3: el mismo instante con 8 personajes dibujado con el código de antes y el de
    ahora da la misma imagen, píxel por píxel, en Alto, Medio y Bajo.

  | JavaScript por cuadro (procesador de 1,4 GHz simulado) | prueba15 | prueba16 | cambio |
  |---|---|---|---|
  | Alto + sombras medias | 14,96 ms | 12,17 ms | −18,6 % |
  | Alto + sombras medias, con el ahorro de procesador | 12,88 ms | 10,51 ms | −18,4 % |
  | Medio | 15,58 ms | 14,35 ms | −7,9 % |
  | Bajo | 12,03 ms | 10,83 ms | −10 % |
  | Patata | 12,83 ms | 10,71 ms | −16,5 % |
- La placa de video dibuja lo mismo que antes: las mismas 21 pasadas y los mismos dibujos por cuadro en Alto. En el modo
  memoria baja las texturas y el mapa de sombras pesan la mitad, así que también hay la mitad para leer, pero el tiempo
  de la placa de un celular no se puede medir en la compu (la placa de prueba dibuja con el procesador). En un celular
  así la que manda es la resolución automática, que ya baja sola si no llegan los cuadros.
- Se ve igual: `captura_igual.mjs` en las cinco calidades, sin personajes, contra la prueba15: hasta 2,9 % de píxeles
  distintos, lo mismo que la prueba15 contra sí misma en otra corrida (hasta 3 %: nubes y pasto que se mueven).
- Choques y NPCs, de nuevo con los cambios: `colisiones` 5/5, `agacharse_escalones` 5/5, `npc_caminar` 5/5; `npc` 14/15:
  falla «la Physics Gun lo levanta», y falla igual con la prueba15 (no es de esta versión; queda para revisar).
- APK 2.9-prueba16 y página con código (`web/`) armados de nuevo; `codigo_web.mjs` 9/9.
- Pruebas de antes, de nuevo: `mouse_pc` 6/6, `linterna_mod` 7/7, `hl_resurgence` 5/5, `mods_habilitar` 9/9,
  `textura_reintento` 5/5, `vj_crack` 6/6, `disparo_tercera` 6/6, `ruleta_emotes` 7/7, `red_workshop` 6/6,
  `linterna_bsp` 4/4, `mapa_io` 6/6, `props_pose` 4/4, `gmod_abrir` 7/7, `gmod_mira_recarga` 7/7 y `celu_mano` 27/27.
- Sin probar en un celular de 512 MB de verdad: el procesador lento se simula frenando el de la compu, la memoria se mide
  en Chromium y la placa de video de prueba no es la de un celular.

## JXMod 3.0: menú nuevo, la versión a la vista y lo del Discord

Pedido: «la próxima ya es la 3.0; que el juego diga qué versión es, con un menú nuevo y renovado, menos IA», más los
videos y capturas del Discord (ruedas que volaban, mancha blanca, tienda caída, nextbots, emotes, linterna, Minecraft
SWEP, borrar varios mods, el celular en la mano, carteles de «moriste», pestaña de NPCs y DrGBase en pose T).

- **La versión y el menú principal nuevo** (`juego/inicio.js`, `juego/template.html`): «JXMod 3.0» y el día del armado
  en una placa abajo a la derecha; placas rectas, letra Oswald (OFL, va adentro del HTML), un solo color de acento y
  nada de brillos ni degradados. `JX_VERSION` (en `nucleo.js`) es la única fuente: el inicio, la caja negra y el APK
  (`--version-name 3.0`). Prueba `menu_30` 7/7 (compu, celular, celular chico y parado, los 14 idiomas, árabe espejado).
- **Ruedas que volaban alrededor del auto** (video): una rueda ya no toma un nodo que tiene otras ruedas adentro y la
  suspensión va en la escala del nodo (la silla de ruedas las llevaba a 22 m; prueba `ruedas_autos`).
- **Tienda saturada (error 1027)**: menos pedidos, freno cuando no contesta; la app pide directo a Steam y a YouTube.
  La búsqueda de la tele y la radio («música para jugar» daba «No hay resultados») anda de nuevo (`tienda_caida`).
- **Mancha blanca que perseguía la vista** (video): era el brillo del sol en el lago, una bola blanca pegada a la
  cámara; ahora es el reflejo del sol con el Fresnel del agua y, buceando, la luz en la niebla del color del agua
  (`agua_sol`).
- **Nextbots**: los clásicos de sprite se ven (Walter, Obunga, Sanic…) y DrGBase anda (`nextbots_drg` 6/6).
- **Emotes**: un toque abre sólo la ruleta, con «Editar emotes» y «Todos los emotes»; se puede volver al panel en
  Ajustes → Controles (`ruleta_emotes` 8/8).
- **Borrar varios mods a la vez**, con cupo por tamaño: 20 chicos, 10 medianos o 4 grandes por vez
  (`gm_borrar_varios` 13/13).
- **El celular en la mano de los avatares de mods** (modelos de jugador del Workshop): antes flotaba a 22–41 cm de la
  mano; ahora va en la mano del modelo, de su tamaño, sin dedos adentro (`celu_mano_gmp` 6/6).
- **La linterna hace sombra** (`sombras.js`, `gl.js`): lo que tapa la luz deja su sombra detrás. Mapa de 512 en Medio y
  Alto, 1024 con el borde suave en Ultra; en Bajo, Patata y WebGL 1 no hay. `linterna_sombra` 7/7: la sombra cae 100 %
  donde la caja tapa la luz y la llena en un 98 %, sin manchas fuera de ella; cuesta +9,7 % de cuadro en Alto en esta
  compu, que no tiene placa de video (todo lo dibuja el procesador: en un celular con placa cuesta menos).
- **Minecraft SWEP** (Workshop 116592647): en el Pasto plano los bloques quedaban 40 cm en el aire, la mira pasaba por
  debajo y no se podían apilar ni sacar. La grilla del addon va alineada con el cero del mapa y nuestro piso estaba en
  z = 20,87: ahora, en los mapas propios, el piso de la aparición es el cero de Source (como en la mayoría de los mapas
  de GMod); en los de GMod y los del Workshop no cambia nada. Las conversiones del Lua se separaron en posiciones (con
  ese cero) y velocidades, fuerzas y desplazamientos locales (sin él). El arma se llama «Minecraft SWEP» (el nombre del
  lado del cliente, como el selector de GMod). `minecraft_swep` 8/8: el bloque apoyado en el pasto (0 cm; antes 39,6 cm),
  en la grilla, apilado justo, al costado, sacarlo, y las cuentas del Lua (SetPos, LocalToWorld, la caja local, la
  velocidad, una traza) sin corrimiento. Falta: el menú de bloques que abre la R (es un menú Derma, que el juego todavía
  no dibuja); el tipo de bloque se cambia en GMod → Minecraft SWEP → Ajustes (`minecraft_blocktype`).
- **Sin carteles de «moriste»**: fuera «Te moriste», «¡Te caíste!» y «Disparar o saltar para reaparecer», como en GMod
  (`sin_carteles_muerte` 4/4).
- **Pestaña NPCs en el menú de spawn**, como la de GMod: los personajes del juego como NPC y los NPC de los addons por su
  categoría, con el buscador (`npcs_menu` 6/6, compu y celular).
- **DrGBase y NPCs en pose T**: las animaciones de los NPC de HL2 (zombies, hormigas león, headcrabs, combine) y de los
  modelos de jugador de GMod (m_anm) están en archivos `.ani` (bloques de animación) y en otros `.mdl`
  (`$includemodel`), y el juego no leía ninguno de los dos: los modelos quedaban en su pose de referencia. Ahora se leen
  los bloques del `.ani` y se suman las secuencias de los modelos incluidos (pidiéndolos si faltan), los nextbots tienen
  sus parámetros de pose (move_x/move_y eligen la animación de caminar) y, si un modelo no tiene la actividad pedida, se
  usa la equivalente (de NPC ↔ de jugador). `drg_poses` 4/4: la hormiga león, el headcrab, el zombie, el nextbot y el
  humano de prueba se animan (11–34° de giro medio respecto de la pose T, que da 0°).
- **Herramientas de la Tool Gun de los mods** (`gmod_cargar.js`, `gmod_prelude.js`): la tabla `TOOL` que ve cada archivo
  ya tiene los métodos del objeto de herramienta de GMod (`BuildConVarList`, `CreateConVars`…). Desde que las
  herramientas se cargan también del lado del cliente (para DrGBase), la Lightsaber tiraba un error de Lua al cargar.
- **Las teclas que muestran los mods** (`input.LookupBinding`): una definición vieja pisaba a la completa y los addons
  que dicen qué tecla apretar mostraban «<NOT BOUND>» (la Lightsaber: «Press <NOT BOUND> to toggle Force selection»).
  Ahora dicen F para `impulse 100` (la Fuerza, la linterna), 1…9 para las ranuras y E, R, Q… para el resto.
- **Cómo se ponen mods** (pregunta del Discord): Menú principal → Mods y mapas → GMod → buscar el addon → Instalar; un
  `.gma` propio entra con «Importar .gma».
- **El botón de recargar y las teclas de los mods en el celular** (`hud.js`): con el celular en la mano (y con las armas
  de golpe) ya no aparece el botón de recargar, que no servía y quedaba pegado al borde del celular; las armas de los
  mods de GMod lo siguen mostrando (su Lua usa la R). En los celulares apaisados y bajos (800×360 a 915×412), un mod con
  6 teclas ponía 5 en la zona de la palanca de caminar (ya pasaba antes de la 3.0): las tres filas de arriba a la
  izquierda se juntan lo justo, nunca a menos de 6 px. `hud_celu` 7/7 (antes 6/7), `celu_mano` 27/27 cuatro veces
  seguidas (antes fallaba 1 de cada 4 por el botón de recargar).
- Tres pruebas que estaban mal, no el juego: `npc` 15/15 (antes 14/15 desde la prueba15: un NPC agarrado se vuelve muñeco
  de trapo y la prueba miraba el cuerpo viejo; ahora mira el muñeco: lo levanta 1,1 m con los pies a 0,9 m del piso y al
  soltarlo queda en el piso) y `armas_gmod` 8/8 (la Gravity Gun lanzaba la caja mirando al piso y a veces pegaba contra
  el suelo enseguida: 1,1 m/s; mirando al frente sale a 50 m/s siempre) y `gmod_portales` 2/2 (la salida queda a
  menos de medio milímetro delante de la otra puerta, la prueba redondeaba al milímetro y veía 0: fallaba la mitad de
  las veces, también antes de la 3.0).
- Pruebas, todas sobre el armado final: `menu_30` 7/7, `menu_principal` 4/4, `ruleta_emotes` 8/8,
  `sin_carteles_muerte` 4/4, `npcs_menu` 6/6, `minecraft_swep` 8/8, `drg_poses` 4/4, `nextbots_drg` 6/6,
  `gmod_nextbot_muerte` 8/8, `linterna_sombra` 7/7, `celu_mano` 27/27, `celu_mano_gmp` 6/6, `arma_mano_gmp` 3/3,
  `gm_borrar_varios` 13/13, `mods_habilitar` 9/9, `personajes_mods` 8/8, `tienda_caida` 7/7, `ruedas_autos` 5/5,
  `agua_sol` 4/4, `huesos_igual` 3/3, `memoria_baja` 4/4, `social` 42/42, `npc` 15/15, `npc_caminar` 5/5, `vj_crack` 6/6,
  `hl_resurgence` 5/5, `disparo_tercera` 6/6, `textura_reintento` 5/5, `linterna_mod` 7/7, `linterna_bsp` 4/4,
  `mapa_io` 6/6, `props_pose` 4/4, `gmod_abrir` 7/7, `gmod_mira_recarga` 7/7, `armas_gmod` 8/8, `mouse_pc` 6/6,
  `red_workshop` 6/6, `hud_celu` 7/7, `hud_orden` 5/5, `girado` 11/11, `gmod_panel` 18/18, `apuntar` 5/5,
  `gmod_addon` 7/7, `gmod_wac` 9/9, `gmod_munecos` 9/9, `gmod_arma_suelo` 5/5, `efecto_siempre` 5/5, `gmod_nuke` 5/5,
  `gmod_movimiento` 14/14, `npc_armas` 7/7 y `gmod_portales` 2/2.
- Lo que ya fallaba antes (igual con un armado de antes de estos cambios): `gmod_sable` 8/10 (el mango del sable queda a
  24 cm de la muñeca, la prueba pide ≤ 15) y `gmod_lua` (dos fallas con la Nyan Gun y después se cierra el navegador).
- Para armar el juego de prueba hay que usar `armar.sh` (o `MQTT_JS=…/mqtt.min.js` con `armar.py`): sin la librería del
  multijugador el juego arranca igual, pero sin red (`mouse_pc` y `red_workshop` fallan por eso, no por el juego).
- APK 3.0 (versionCode 26110704, firma v1+v2+v3) y página con código (`web/`) armados de nuevo; `codigo_web.mjs` 9/9.
- La tienda (el Worker de Cloudflare) no hace falta volver a subirla. La app de Android pide directo a Steam y a YouTube;
  la página con código (iPhone y navegadores) todavía usa la tienda para buscar en YouTube y para bajar los addons de
  Steam: si la tienda llega a su tope del día, eso no anda hasta el día siguiente (la radio y los links de YouTube
  pegados sí andan).
- Sin probar en celulares ni en un iPhone de verdad: todo se probó en Chromium en la compu (con pantalla y toque de
  celular simulados), y la placa de video de prueba dibuja con el procesador.

## JXMod 3.0 · evento: la grieta en el cielo, el cielo de GMod, fondos nuevos y lo del Discord

Pedido: «esto es 3.0, un tipo de evento: que los mapas principales tengan la grieta y que de vez en cuando lluevan
objetos del cielo, a veces uno o incluso 6; los descargados no, que usen la skybox de GMod, incluido gm_construct;
mejoralo, optimizá y sobre todo nuevas capturas de fondo para los menús», más las capturas del Discord.

- **La grieta y lo que cae** (`juego/evento.js`): en los mapas del juego (no en gm_construct ni gm_flatgrass, ni en los
  del Workshop, ni en la pizzería, que es bajo techo) hay una grieta en el cielo, la del tráiler (efecto propio: la forma
  de la fractura con semilla, las vetas horneadas una vez en la placa al entrar al mapa, 512 en los celulares y 1024 en
  la compu). De vez en cuando caen cosas de ella prendidas fuego, con estela y humo: la primera a los 35–75 s de entrar
  y después cada 100–260 s; casi siempre 1 o 2 (34 % y 24 %) y a veces hasta 6 (16, 11, 8 y 7 % para 3, 4, 5 y 6). Las
  garrafas, los barriles explosivos, los bidones y a veces los autos explotan al pegar; los autos caen derechos y quedan
  sobre las ruedas; no se juntan más de 12. En la sala decide el de ID más chico y les llega a todos la misma caída (las
  cosas de verdad llegan por la red como cualquier objeto). Se apaga en Ajustes (Evento 3.0). Cuesta: de frente, 4,9 ms
  contra 15,2 ms del cielo en Alto en esta compu sin placa de video (32 %); de espaldas no se dibuja.
  `evento_grieta` 8/8.
- **El cielo de GMod** (`mundo.js`, `gmod_bsp.js`, `gl.js`): gm_construct y gm_flatgrass con el cielo «painted» de GMod
  (el celeste de siempre, medido de sus caras) en vez del nublado gris; los mapas del Workshop con su propio cielo y, si
  no se puede traer (sin el contenido base), el de GMod. El cielo de caja ya no sale un 15 % más oscuro y gris que su
  textura. **«Los objetos se ponen naranjas»**: el brillo del sol de Source se pasaba elevado a 2,2 (un sol de 1,6 daba
  2,8 veces: props quemados y naranjas) y la tarde se calculaba con la altura del sol del mapa (los de sol bajo
  quedaban naranjas a las 12); ahora el brillo va lineal y la fase del día sale de la hora. `cielo_gmod` 5/5.
- **«No puedo instalar ningún mod» (Failed to fetch · DrGBase, los nextbots 3D) y «le doy a jugar y no me deja»**: la
  tienda estaba en su tope del día (429, «error code: 1027», sin permiso de otro sitio: el navegador lo ve como «sin
  red») y los addons sin archivo directo no se podían bajar. Ahora la app hace lo de la tienda por su cuenta
  (`SteamPipe.java`: entra anónima al WebSocket de Steam, como un servidor dedicado) y le pide a Steam la clave, los
  detalles y el contenido base; los pedazos prueban 5 servidores del CDN antes que la tienda. En la web, un aviso que
  se entiende en vez de «Failed to fetch»; Jugar entra en menos de 40 s aunque la tienda no conteste.
  `PruebaSteamPipe` 39/39 contra Steam, `mods_sin_tienda` 8/8, `tienda_caida` 7/7.
- **La AK-47 fuera de lugar y «las manos se me elevaron»**: en el celular, soltar la palanca corriendo (el dedo al tope)
  dejaba el correr prendido para siempre; el Lua veía Shift apretado y las armas de M9K quedaban «corriendo», y como
  su Think corre sólo del lado del servidor, la vista se dibujaba con la mira puesta (la AK) o con la guardia arriba
  (los puños). Ahora soltar la palanca deja de correr, la palanca al tope corre sin ser el «correr» de GMod, la vista
  del arma lee lo que dejó su Think y las teclas del arma se miden contra su último Think (soltar algo con un menú
  abierto ya no queda apretado). `armas_correr` 8/8 (M9K Assault Rifles y Specialties).
- **Armas desde la cámara libre** (la bazuca disparaba desde la cámara): disparos, cohetes, flechas, la Physics Gun, la
  Gravity Gun, la palanca y la Tool Gun salen de los ojos o la mano del personaje y van adonde apunta él, también en
  tercera persona y mirando por la cámara de la Tool Gun (antes el cohete salía a 28 m, de la cámara; ahora a 0,3 m de
  la mano y explota a 0,0 m de donde apunta). En primera persona, igual que antes.
- **La linterna que atravesaba las cosas**: en Bajo y Patata (sin mapa de sombra) la luz sale de los ojos, así lo que se
  ve detrás de una columna ya no queda iluminado (0 puntos en gm_construct y gm_hotel); Medio, Alto y Ultra ya la
  tapaban. En Alto y Ultra queda un resplandor del bloom de la mancha casi blanca (no es luz que pasa).
- **Physics Gun**: las partes celestes brillan como en GMod (el `$selfillum` del arma con su color), también en la de
  tercera persona: en lo oscuro, brillo 167–174 y tono 181° (antes, 7–14: negras).
- **Nextbots**: los de DrGBase caminan a la velocidad de su animación (la hormiga león a 355 pulgadas/s, como en GMod);
  Cartman y Kenny (sprites y 3D) salen con su tamaño, parados y en el piso, también como NPC y muñeco de trapo.
- **Pack de armas de Team Fortress 2**: la minigun arranca, dispara en bucle con su sonido y frena; la escopeta recarga
  por partes; la mira del sniper ya no es un cuadro blanco; el agarre en tercera persona (mango en la mano a 6 cm). Los
  guiones de sonido de GMod (`gmod_sonidos.js`, de `herramientas/gmod_guiones.py`).
- **Celulares de los jugadores** (S20 FE, POCO X6 Pro, TCL NXTPAPER 70 Pro, Honor Magic6 Lite, Tecno Spark Go, Moto
  g13/g20, Galaxy A05/A15…): 343 modelos, 20 marcas, 64 chips, con su perfil automático. `celulares` 9/9.
- **Fotos de fondo nuevas** (el pedido principal): las 6 del menú principal y las de la pantalla de carga, sacadas del
  juego mismo en Ultra con `herramientas/fondos/` (ver su LEEME): la grieta y cosas que salen de ella prendidas fuego
  cruzando el cielo, explosiones, cosas ardiendo en el piso, gente que corre y alguien que se queda mirando la grieta;
  en gm_construct y gm_flatgrass, el cielo celeste de GMod y sin grieta. El menú: Pasto plano, la Ciudad, la Isla, el
  Desierto RB, la City de noche y el Desierto. La pantalla de carga pasa de 9 a 13 fotos: ahora cada mapa del juego
  tiene la suya (la Ciudad, la Isla, el Desierto RB, la Llanura, las Colinas y la Luna no tenían), dos en primera
  persona con la Physics Gun (Pasto plano y gm_construct); la de la pizzería queda la de antes. Lo importante va donde no
  lo tapa el menú (los dos tercios de la derecha, y entre el 12 y el 88 % del alto, que en los celulares se recorta) ni
  la pantalla de carga (el consejo arriba a la derecha y la consola abajo): `herramientas/fondos/medir.py` lo mide en
  las 18 (dónde quedó la grieta, cuántas cosas vuelan y cuántas ya pegaron). En el HTML van en WebP: 300 KB las del
  menú y 661 KB las de carga (0,33 MB más que antes, por las 4 de carga nuevas). `fondos_30` 6/6.
- **La foto de la pantalla de carga en el celular**: en una pantalla de 20:9 la foto pierde un quinto de su alto, y
  centrada, con el zoom lento hasta 1,1 y subiendo, la grieta quedaba cortada arriba (con la grieta al 20 % de la foto,
  su centro quedaba al 8–12 % de la pantalla; en la Isla, al 2–7 %: cortada a la mitad). Ahora se encuadra al 35 % del
  alto, con zoom hasta 1,06 y sin subir: 14–16 % (en la Isla, 9–11 %), con los rayos enteros. Lo del piso baja 4 puntos
  (del 82 al 86 % del alto), dentro de la franja que la pantalla de carga ya oscurece para la consola. En la compu
  (16:9) la foto no se recorta y se ve igual.
- **Multijugador a 0 fps en el Galaxy A15**: en la sala, cada cuadro reescribía el texto de la sala y movía los nombres
  de los jugadores dentro de la capa de los controles (pantalla completa, con íconos y sombras): el celular volvía a
  pintar toda esa capa en cada cuadro; y leer el tamaño de la ventana varias veces por cuadro obligaba a rehacer el
  diseño. Ahora el texto sólo se escribe si cambió, los nombres van en su propia capa y el tamaño se guarda.
  `red_a15` (A15 emulado: procesador ×5, 4 jugadores): antes 18–27 fps (p95 52–151 ms), ahora 58–60 fps (p95 19–24 ms).
- **Quién habla por voz**: un panel con la foto (la tuya de Google sólo la ves vos; de los demás, el retrato de su
  personaje), el nombre y un anillo que late; en la compu una columna a la derecha, en el celular una fila arriba al
  medio; se apaga en Ajustes (Controles y audio). `voz_hud` 13/13: tu ficha a los 42–61 ms de hablar, la del otro
  132–191 ms de punta a punta, se va en menos de 1 s al callarse, sin tapar botones en 7 tamaños de pantalla.
- **Partida por LAN / Wi-Fi, sin internet** (`juego/lan.js`, `apk/web/src/com/jxmod/app/Lan.java`): Multijugador →
  LAN / Wi-Fi. En la app, el anfitrión corre un broker MQTT chico en su celular (el mismo protocolo del multijugador de
  siempre: `red.js` sólo cambia la dirección), anuncia la partida por UDP cada segundo y sirve el juego por HTTP en el
  puerto 8765. Los demás la ven sola en la lista o escriben la IP; con la app entran por un puente en 127.0.0.1 (la
  página de la app es https y no puede abrir un ws:// a otra IP de la red); sin la app (compu, iPhone), abriendo
  http://IP:8765/ en el navegador. No pide la cuenta de Google ni la tienda, y no va a la lista pública. Sin internet
  no hay mods ni paquetes que no estén ya guardados, y en http://IP el navegador no da el micrófono. `PruebaLan`
  22/22 (WebSocket, MQTT con comodines, retenidos, testamento, keepalive, 5000 mensajes en orden, puente, anuncio).
  `red_lan` 12/12 con el broker de la app en Java y el juego de verdad, sin internet ni cuenta: Ana es anfitriona,
  Beto (app) la ve sola en la lista y entra por el puente, Caro (sin app) abre http://IP:8765/ y entra; el anfitrión
  cuenta 3, el chat y el daño llegan, Beto vuelve escribiendo la IP, Caro se corta de golpe y desaparece para los
  demás, Ana deja de anunciar al volver al menú, y desde https el ws:// a la red queda bloqueado pero el puente abre.
  De paso: si la página del anfitrión se abría antes de que creara la partida, nunca la encontraba.
- **Barriles explosivos en multijugador que explotaban dos veces**: al explotar un barril, en la pantalla del otro la
  explosión también dañaba su copia de ese barril (y de los de al lado): la copia explotaba otra vez y mandaba su
  explosión de vuelta. Ahora cada objeto lo daña sólo su dueño, cuando le llega la explosión, y la explosión lleva el
  barril que la causó: el que la recibe borra su copia sin explotarla, y si los dos le pegan a la vez cada uno ve una
  sola. `red_barril` 6/6 (antes 3/6: dos barriles en cadena daban 3 explosiones; dos golpes a la vez, 2).
- **Las bombas nucleares como la del tráiler, con el destello blanco** (`juego/nuclear_vol.js`): las 117 bombas usan
  ahora el hongo con volumen del tráiler (bola de fuego que sube, sombrero que rueda con fuego adentro, tallo de hollín y
  falda de polvo, con ruido 3D de coliflor y luz del sol y del cielo). Cada una a su escala: el tráiler es una de R ≈ 260 m
  (≈ 4 Mt) y todo se mide en R / 260, así que de 10 t a 100 Mt cambian el tamaño del hongo (alto final 1,75 R en todas), la
  destrucción (alcance 2,3 R) y el tiempo (las grandes más lentas). En el aire la bola nace arriba y el tallo sube después;
  en el agua y los barcos, blanca; la subterránea y la del espacio siguen con su polvo y su esfera. En Medio, Alto y Ultra
  con WebGL 2; en Bajo, Patata o WebGL 1, los carteles de antes. Se dibuja en un búfer chico (un tercio a la mitad de la
  pantalla, más chico si el hongo la llena) sólo en el rectángulo donde cae, y lo de adelante lo tapa. Costo contra la
  pasada del cielo: de lejos 0,6–1,1; de cerca 1,8 (Medio), 2,2 (Alto) y 3,5 (Ultra). El ruido 3D se arma de a filas
  durante la cuenta regresiva (tramos de ≤ 12 ms). **El destello**: blanco al instante, 0,12 s al máximo y se apaga en un
  par de segundos; se ve de lejos (a 40 radios, 0,4; antes nada más allá de 7 radios) y, de espaldas, el cielo blanco un
  35 %. **Arreglo de paso**: el piso de la explosión se buscaba desde 400 m arriba y tomaba el primer techo o borde del
  mapa que hubiera encima (el hongo podía nacer en el aire). `nuclear_vol` 7/7, `nucleares` 11/11.
- **La pantalla de carga** decía «v1.0» y «JXMod 1.0»: ahora sale la versión del juego (la de `nucleo.js`, la misma del
  menú). Al entrar a un mapa del juego mostraba «map: rb_rb_ciudad»; ahora «map: rb_ciudad», «map: gm_construct» y, en
  los del Workshop, el nombre de su BSP.
- Pruebas, todas sobre el armado final: `red_a15` 7/7, `voz_hud` 13/13, `red2` 13/13, `red3` 6/6, `voz` (la voz llega,
  nivel 124, y se corta al apagar), `evento_grieta` 8/8, `mouse_pc` 6/6, `social` 42/42, `fondos_30` 6/6, `menu_30` 7/7,
  `cielo_gmod` 5/5, `ev5_arreglos` 19/19, `ev6_nextbots` 7/7, `ev7_tf2` 8/8, `armas_correr` 8/8, `celulares` 9/9,
  `mods_sin_tienda` 8/8, `hud_celu` 7/7, `girado` 11/11, `npc` 15/15, `gmod_panel` 18/18, `armas_gmod` 8/8,
  `nucleares` 11/11, `nuclear_vol` 7/7. `girado` se arregló en la prueba: desde el arreglo del bazooka la pistola de física
  apunta desde el personaje con la cámara libre, así que ahora el personaje también mira la caja. Corriendo dos tandas a
  la vez, cuatro pasaron de su tope por la carga de la máquina (`voz_hud` 161 ms contra 150, el tramo del ruido 3D 25 ms
  contra 15, un sprite de nextbot que no llegó a tiempo); solas, todas pasan.
- Pruebas sobre el armado con la partida por LAN y el arreglo de los barriles: `red_lan` 12/12, `PruebaLan` 22/22,
  `red_barril` 6/6, `red2` 13/13, `red3` 6/6, `evento_grieta` 8/8, `red_a15` 7/7, `voz_hud` 13/13, `menu_30` 7/7,
  `social` 42/42 (la prueba leía el aviso de «creó el grupo» antes de que llegara del servidor; ahora lo espera).

## JXMod 3.0 · identidad propia: intro, menús, skins y mapas, cielos por mapa, gráficos automáticos y nucleares en Bajo

Pedido: «cambiar los menús de mapas, de juego y de pausa a algo más original; modificar los mapas base y las skins
porque tienen que tener identidad propia y no la del juego del que vienen; las nukes de lejos salen con imágenes 2D y
eso sólo en Patata; las volumétricas optimizadas para celus de bajos recursos también en Bajo; viento al explotar;
cielos diferentes en cada mapa, más GOTY, con nubes dibujadas que tapen el ambiente y aparezcan y desaparezcan, súper
optimizados; más de 15 técnicas de optimización; el automático siempre activado: al iniciar busca la mejor calidad con
60 fps pegados (si en una más alta da 60 y en una más baja 70, no bajar; si ninguna llega, la que más se acerque por
debajo); y una intro nueva, minimalista, GOTY y rápida, porque JXStudios se ve vieja», más la captura del Discord de los
nextbots («a veces los nextbots 3D son muy tontos, no hacen su animación, y en DrGBase son chicos, no caminan rápido y
no matan»).

- **Intro nueva de JXStudios** (`juego/template.html`, `juego/inicio.js`): 1,7 s y sólo CSS (14 animaciones de
  transform y opacidad, sin video, imágenes ni lienzo): la placa amarilla se abre, sube «JX», STUDIOS sale de atrás y
  funde a negro. Arranca con los primeros ~300 KB del HTML, no se traba aunque el juego esté compilando y se saltea con
  un toque o una tecla; con el juego ya cargado el menú queda a ~2,25 s. `intro_jx` 7/7 (`intro` adaptada).
- **Menús con la identidad de la 3.0** (`juego/ui.js`, `juego/idiomas3.js`, `juego/milogo.js`): Nueva partida (el mapa
  elegido en grande, los grupos como pestañas, la grilla no salta), el menú de spawn, la pausa, Ajustes, los emotes y
  Crear un mapa con placas oscuras rectas, Oswald, el amarillo para lo principal y el filo amarillo en los títulos.
  Pestañas del spawn en 14 idiomas que se achican en el celular, títulos de la pausa que se achican. `menus_jx` 6/6
  (7 pantallas, 14 idiomas).
- **Las skins heredadas con identidad propia** (`juego/identidad.js`): las 12 humanas que venían del paquete original
  pasan a ser el equipo de JXMod, con nombre nuevo y la ropa teñida con colores propios: Nico (amarillo), Brasa
  (terracota), Tomi (petróleo y grafito), Don Ferro (bordó), Vega y Rocco (ártico), Rulo (violeta), Alas (celeste),
  Carnicero (musgo), Sombra (azul noche), Duna (arena) y Chispa (naranja fuego). Cada punto de la ropa toma el color de
  una rampa de tres tonos según su luminancia, así quedan los pliegues, costuras y bolsillos; la piel y las zonas marcadas
  (la cara con el pelo de Nico, los brazos y zapatillas de Rulo) no se tocan. El retrato del menú se tiñe igual, desde
  donde empieza la ropa y cuidando el cuello (sin pérdida: la cara queda idéntica). Por dentro las skins se siguen
  llamando igual (partidas, red, mods). Las de terror (Derik, Corpse) quedan como estaban. `?sinids` deja todo como
  venía, para comparar.
- **Los mapas base heredados, con nombre y un hito propios** (`juego/identidad.js`): Cañadón Ocre, Médanos, Pradera,
  Distrito Norte, Hangar 7, Polo Industrial, Planeta Rojo y Órbita (en los 14 idiomas). En los siete de superficie, a 46 m
  de la aparición y a la vista, aparece la **plaza JX**: plataforma de hormigón claro con rampas suaves en los cuatro
  lados (se sube caminando o en auto), un filo amarillo luminoso, un monolito de 16 m de grafito con el «JX» y una costura
  luminosa, y cuatro postes con farol (luz de noche). Tono del hormigón según el suelo (gris, arena, rojo de Marte).
  Choca como el mapa, son 3 mallas (370 triángulos, 3 llamadas de dibujo, ~0,1 ms). Si delante no hay piso parejo, prueba
  a los costados, atrás o a otra distancia. No aparece sobre un mapa de la comunidad, en el creador ni en Espacio, y no se
  guarda con lo del jugador. `identidad` 12/12: los 12 nombres; cada textura de ropa cambia ≥ 85 % y queda a ≤ 2,3° del
  tono de su rampa; lo protegido 0 puntos; piel suelta < 3 %; 6,9–10,4 ms por textura; retratos con la cara igual y la
  ropa cambiada; la textura que sube a la placa es la teñida; `?sinids` igual que antes; los 8 nombres en 14 idiomas; la
  plaza en los 7 mapas (46 m, a la vista); se sube caminando por la rampa (de 0,95 a 1,40 m: los 0,45 de la plataforma)
  y el monolito frena a 1,25 m de su centro; no en Espacio/comunidad/creador; 0,1 ms más por cuadro.
- **Un cielo propio en cada mapa** (`juego/cielos.js`, nuevo; la pasada del cielo en `gl.js`; `mundo.js` lo aplica al
  entrar): Cañadón Ocre con cúmulos de verano, Médanos con calima y cirros, Pradera con cúmulos chicos de buen tiempo,
  Distrito Norte con una capa partida de estratocúmulos, Hangar 7 con cirros en pinceladas sobre azul profundo, Polo
  Industrial cubierto con claros (el sol del mapa más suave), Planeta Rojo color caramelo con polvo y nubes de hielo,
  Órbita con estrellas y una nebulosa, la Llanura con cúmulos grandes, las Colinas al atardecer dorado (el sol del mapa
  bajo y naranja), la Isla con los cúmulos de los alisios, la Ciudad con bruma y altocúmulos, el Desierto RB con cirros,
  la Luna con la Vía Láctea y la pizzería de noche siempre (15 presets, todos distintos). gm_construct, gm_flatgrass y
  los del Workshop siguen con su cielo de caja de GMod.
- **Nubes pintadas que se forman y se deshacen**: bordes suaves con lóbulos, el lado al sol blanco tibio, la sombra gris
  azulada y el borde plateado mirando al sol; salen de una textura de ruido propia (celdas y gradiente, 256 × 256, que se
  arma una vez en ~40 ms). Tres campos se mezclan con pesos que giran: en 60 s se forma un 28 % de nubes nuevas y se
  deshace un 37 % de las que había, tapando siempre lo mismo (a ±0,10 de lo de cada mapa), y el viento las corre (cambia
  un 35 % del cielo); de un cuadro al siguiente no salta nada (0,0003 de media). En el horizonte, una bruma del color
  exacto de la niebla del mapa (0/255 de diferencia): lo lejano se pierde en el cielo sin línea. Siguen el ciclo del día
  (doradas al atardecer, rosadas con el sol recién puesto, oscuras con la luna de noche, las estrellas detrás) y la
  grieta del evento queda encima y las alumbra de azul.
- **Súper barato**: el color de una nube depende sólo de la dirección, así que se pintan en una textura del cielo (el
  hemisferio en proyección equidistante: 384 en Patata, 512 en Bajo, 768 en Medio, 1024 en Alto y Ultra) que se rehace
  de a franjas entre cuadro y cuadro (entera en medio segundo de juego, a cualquier ritmo de cuadros, sin cortar la
  pasada de la escena, que en los celus obliga a guardar y volver a traer la pantalla). La pasada del cielo la lee una
  sola vez por punto; en Patata y Bajo esa textura trae el cielo entero. Costo contra el cielo de antes (1280 × 720, sin
  placa de video, contando la franja): Alto y Ultra 0,76 × (antes ya tenían nubes: ahora cuestan menos), Medio 1,20 ×,
  Bajo 1,25 ×, Patata 1,24 × (antes sólo el degradé). La franja cuesta ≤ 1,3 ms; un cambio de hora la rehace en 6 u 8
  cuadros de ≤ 5,2 ms. Si un aparato no compila el sombreador queda el degradé: nunca sin cielo. Igual en WebGL 1. Dos
  mapas cambian también su luz para que el mapa y el cielo cuenten lo mismo: las Colinas (sol a 13°, naranja) y Polo
  Industrial (sol al 72 %, más luz de relleno). `cielos` 10/10 (sin costuras: 0 puntos sueltos; pintada de a franjas
  difiere de pintada de una vez 0,93/255), `cielo_gmod` 5/5, `evento_grieta` 8/8.
- **Nucleares con volumen también en Bajo, sin carteles de lejos, y viento al explotar** (`juego/nuclear_vol.js`,
  `juego/nucleares.js`): el hongo con volumen ahora sale en Bajo, Medio, Alto y Ultra (los carteles 2D quedan sólo para
  Patata y WebGL 1). Bajo usa un búfer de un cuarto de pantalla y 18 pasos; en los aparatos sin búferes de punto
  flotante se dibuja por un camino de 8 bits (difiere del de punto flotante 1,8/255 en promedio, tope 8/255). De lejos
  (3 y 6 km) ya no pasa a cartel. Hasta 2 bombas con volumen a la vez en Bajo y Medio, 3 en Alto y Ultra (las más
  cercanas). Costo de Bajo contra Medio: de lejos 3,35 contra 7,9 ms; de cerca 10,4 contra 31,3 ms (en este procesador
  sin placa). **El viento**: un frente que sale del punto cero a la velocidad de la onda; al pasar empuja al jugador (en
  el piso hasta ~4,4 m/s en una de 4 Mt a 2 radios), levanta tierra y polvo alrededor de la cámara, suena un soplido
  grave y empuja las cosas livianas (< 300 kg) que no destruyó; después vuelve un viento de retorno hacia el hongo.
  Lo liviano que alcanza la onda recibe también el viento: antes, justo adentro del daño casi nada y justo afuera 6 m/s;
  ahora el empuje baja siempre con la distancia (18,7 / 14,3 / 8,2 / 5,5 / 4,4 m/s a 0,6 / 1,2 / 1,9 / 2,8 / 3,6 radios) y
  llega de a poco (0,47 / 0,77 / 1,12 / 1,63 / 2,05 s). `nuclear_vol` 12/12 (el costo, contra el cielo de la 3.0 guardado
  en la prueba: el cielo nuevo de Alto cuesta un 23 % menos y la vara no puede achicarse con él; de cerca Alto 2,32 y
  Ultra 3,29 veces), `nucleares` 11/11 (los carteles, en Patata: 0,11 ms).
- **Gráficos automáticos por defecto, buscando 60 cuadros pegados** (`juego/gfxauto.js`): Automático viene prendido (el
  que tenía guardada una calidad fija pasa una vez a Automático; si después elige otra, se respeta). La primera vez que se
  entra a un mapa en la sesión, detrás de la pantalla de carga y con el mapa ya armado, se dibuja la escena de verdad en
  una calidad y se cuentan los cuadros: si da 60 (≥ 57: una pantalla de 60 Hz da 59,x) sube a la siguiente, si no baja
  hasta la que llega. Si en una más alta da 60 y en una más baja 70, se queda en la alta; si ninguna llega a 60, la que más
  se acerca por debajo (si otra más alta queda a menos del 4 %, que es lo que varía una misma medida, la más alta: no se
  baja de calidad por 2 cuadros de ruido). Arranca por la calidad que se estima para el aparato o por la que salió la vez
  anterior en la misma placa, y mide sólo lo necesario. **Cómo mide**: después de cambiar de calidad espera a que se
  compile y no quede ninguna textura subiéndose, y cuenta en ventanas de 0,4 s hasta que dos seguidas coinciden (±15 %):
  al pasar de Medio a Bajo los primeros cuadros tardan 555, 188 y 218 ms y después vienen seis de 72 ms antes de los 17 de
  siempre, y contando ese tramo Bajo daba 25 cuadros cuando anda a 55. Los tirones sueltos (recolector de basura) no
  cuentan: se descartan los cuadros que tardan más del triple de la mediana. Tope de 12 s para toda la búsqueda: no se
  empieza otra calidad si no queda tiempo para medirla, y una medida cortada por el tope no cuenta. Al terminar, las
  texturas que se subieron con el tope de tamaño de otra calidad se rearman con el de la elegida (una Alto elegida desde
  Medio quedaba con texturas de 256). Mientras mide, la pantalla de carga frena su foto animada y el desenfoque, y no
  corre la resolución dinámica. El resultado queda anotado en la consola de la carga («Alto · 52 fps») y guardado.
  `gfx_auto` 10/10 tres veces seguidas (9,7, 10,3 y 10,2 s; medido contra jugado a ±35 %): la elección con cuadros
  inventados (todas pasan → Ultra; Alto a 60 y Medio a 70 → Alto; ninguna → la de más cuadros; empate → la más alta;
  59,4 cuenta como 60; tope de tiempo), el conteo sin tirones (60/40/50/20 exactos), Automático por defecto, una vez por
  sesión y la vez siguiente arranca por la que salió.
- **Técnicas de optimización por calidad** (las nuevas de esta versión, sumadas a las de antes —resolución dinámica,
  escalera de ahorro de la placa, LOD de mallas y de animación, tope de texturas, texturas de 16 bits con poca memoria,
  sombras cacheadas, física a 30 con el procesador justo, presupuesto del Lua, carteles para las explosiones lejanas,
  partículas por calidad, menos sonidos en Patata—):
  1. calidad elegida midiendo en el aparato (arriba);
  2. menú principal y pausa a 30 cuadros (con un reloj que recupera el atraso; en partida sin tope): menos calor y batería
     mientras se elige;
  3. partículas fuera de la vista no se arman ni se mandan a la placa (con un radio que cubre el cartel girado y lo que se
     estira una chispa);
  4. partículas de menos de medio punto en pantalla, tampoco;
  5. en Patata y Bajo, las chicas (< 1,2 m) pasado el 60 % de la distancia de dibujo, tampoco;
  6. tope de sonidos a la vez por calidad (10, 16, 24, 32 y 40): llegado el tope, los lejanos (> 12 m) no suenan, los
     cercanos sí;
  7. sonido 3D fino (HRTF, varias veces más caro) sólo en Alto y Ultra;
  8. tope de marcas de frenada por calidad (200, 400, 700, 900);
  9. tope de trazas de balas por calidad (12, 24, 64);
  10. hongo nuclear con volumen barato para Bajo (un cuarto de pantalla, 18 pasos);
  11. camino de 8 bits para el hongo en placas sin punto flotante;
  12. tope de hongos con volumen a la vez (2 o 3, los más cercanos);
  13. tope de partículas del viento nuclear por calidad (por segundo, según `GFX.part`);
  14. el cielo pintado en una textura por calidad (384, 512, 768 y 1024) que se rehace de a franjas y se lee una vez por
      punto (en Patata y Bajo trae el cielo entero);
  15. retratos y texturas teñidas una sola vez al subirlas (6,9 ms por textura), nunca por cuadro.
  `gfx_auto` mide 3, 7, 8 y 9: de 300 partículas (100 detrás de la cámara, 100 adelante, 100 de 1 cm a 300 m) se
  arman 100; con 50 sonidos lejanos en Patata suenan 10 y uno cercano suena igual; HRTF sólo en Alto; 1200 tramos de
  frenada dejan 200/400/900 y 200 trazas dejan 12/24/64 (siempre las últimas).
- **Fotos de fondo con los cielos nuevos**: las 6 del menú y las 12 de la pantalla de carga se volvieron a sacar del
  juego en Ultra (`herramientas/fondos/`), con el cielo propio de cada mapa y, donde entra entera, la plaza JX (Pasto
  plano y la City de carga, Marte, la City de noche y el Desierto del menú). Si el monolito quedaría cortado por el borde de
  la foto, la plaza se saca de esa foto (pasó en Pasto plano del menú y el Desierto de carga). `medir.py`: en las 18, la
  grieta y lo que cae siguen donde no los tapa el menú ni la pantalla de carga.
- **Nextbots 3D y de DrGBase** (`juego/gmod_nextbot.js`, `gmod_api.js`, `gmod_prelude.js`, `gmod_formatos.js`):
  - salen mirando al jugador, como `InternalSpawnNPC` (los de DrGBase, con 150° de visión, no veían al que los ponía);
  - si la recta está tapada, buscan camino en una grilla de 0,5 m sobre el piso (A*, escalones, caídas, el ancho del
    bot) y resbalan por las paredes; `OnStuck`/`OnUnStuck`, `OnLandOnGround`/`OnLeaveGround` y `OnContact`;
  - la animación que pide su Lua antes de que llegue el modelo ya no se pierde; mezclas; `m_anm.mdl` entero (se cortaba
    en 600/400); la secuencia 0 por defecto, como Source;
  - `SetModelScale` (con tiempo) y el `SetScale` de DrGBase se dibujan y la velocidad sigue la escala; el alcance usa la
    caja de `SetCollisionBounds`; los NPC del juego son entidades del Lua y reciben daño; `IsNextBot`; `SCREENFADE`.
  `nextbots_ia` 9/9 (antes 3/9): Cartoon Cat corre a 15,24 m/s (antes 9,78) y mata en 1,6 s (antes 15,2); Doro mata en
  0,2 s (antes nunca); el zombie rodea la pared; SCP-049 con su animación 16/16; `SetScale` 1,6 → ×1,60. De paso,
  `ev6_nextbots` B1 a veces medía el sprite con el bot ya corriendo hacia el jugador: ahora lo vuelve a dejar quieto
  antes de medir (7/7 en 3 corridas de 3).
- Pruebas, todas sobre el armado final (con las fotos nuevas): `fondos_30` 6/6, `menu_30` 7/7, `menus_jx` 6/6, `intro_jx` 7/7,
  `identidad` 12/12, `gfx_auto` 10/10, `cielos` 10/10, `cielo_gmod` 5/5, `evento_grieta` 8/8, `nucleares` 11/11,
  `nuclear_vol` 12/12, `nextbots_ia` 9/9, `ev6_nextbots` 7/7. Las medidas de tiempo, con la compu sin otras pruebas
  corriendo (en esta compu sin placa de video todas las calidades rondan los 50 cuadros: lo que limita es el procesador).

## JXMod 3.0 · cifrado: iOS con código y APK que no se puede descomprimir (anti-robo de código)

Pedido: «la versión de iOS optimizada con su código; súper cifrada, que nadie sepa cómo usar el HTML; y en el APK que
nadie pueda descomprimir nada. Android entra normal sin código, iOS con código; de todas formas un cifrado fuerte para
que ningún hacker entre (anti-trampa y anti-robo de código)».

Lo honesto primero: nada que corra en el aparato del jugador se puede volver 100 % imposible de abrir —la llave tiene que
estar en la app para que el juego arranque, así que alguien muy experto con las herramientas justas siempre podría, en
teoría, sacarla—. Lo que se hace acá (como cualquier juego comercial) es subir la vara muchísimo: un `unzip` del APK o un
«Ver código fuente» dan **sólo basura cifrada**, y abrirlo de verdad cuesta un trabajo enorme.

- **iOS (y cualquier navegador): la página con código** (`herramientas/codigo_web.mjs`, ya de la 3.0, ahora rearmada sobre
  el juego de hoy). El juego (el gzip del código) viaja cifrado en `juego.bin` (AES-256-GCM) y el paquete (modelos,
  texturas, sonidos) en `pk.bin` (AES-256-CTR, se descifra a medida que baja). En el `index.html` **no queda nada del
  juego en claro** (el bloque del código quedó vacío: sólo está el arranque genérico y la puerta del código). La clave sale
  del código que pone el jugador (PBKDF2-SHA256, 150 000 vueltas) y está **atada a la dirección** de la página: una copia
  de los archivos en otra carpeta o bajada a la compu no abre ni con un código bueno. Sin código no hay juego que leer.
  Verificado en Chromium: un código malo no abre; el bueno abre y el juego arranca (`window.__listo`), sin errores.
  Índice: `index.html` 1,16 MB (antes 3,69), `juego.bin` 1,78 MB, `pk.bin` cifrado 18,9 MB.
- **Android: el APK cifrado de compilación** (`herramientas/cifrar_apk.py` + `juego/…/Cifrado.java` + `Llave.java` generado;
  enganchado en `apk/armar_apk.py`). `index.html` y `pk.bin` **no van en claro adentro del APK**: van con AES-256-CTR, así
  que un `unzip` da sólo basura (empiezan con la marca `JXENC1`, 0 HTML legible). La app los descifra al vuelo en streaming
  (sin cargar 19 MB en memoria). La llave **no es una cadena guardada**: sale de
  `SHA-256( etiqueta || SHA-256(certificado de firma) || secreto )`, donde el secreto son 32 bytes al azar por armado,
  partidos y enmascarados en `Llave.java` (compilado al `.dex`: no salta con `strings`), y la huella del certificado es la
  de la firma del APK. **Anti-repaquetado / anti-trampa**: si alguien modifica el APK y lo vuelve a firmar (otro
  certificado), la huella cambia, la llave cambia y los activos ya no se descifran: el juego no abre. Para sacar el código
  hay que juntar a la vez el secreto del `.dex` y el certificado, y aun así sólo se descifra la copia original intacta. De
  paso, la depuración remota de la WebView (chrome://inspect) queda apagada en la app firmada, así nadie se mete a mirar o
  tocar el juego de afuera. El jugador no pone ningún código: el APK se instala y abre solo. El APK sigue pesando 24,3 MB
  (el cifrado suma 24 bytes por archivo).
- **Red de seguridad del armado**: al final, el armado compara la huella del certificado del APK firmado contra la que usó
  para cifrar; si no coinciden, **falla** y no entrega un APK que no se pueda abrir.
- Pruebas: acuerdo Python↔Java de la llave y del AES-256-CTR (`apk/pruebas/unido/PruebaCifrado.java`: Java descifra lo que
  cifró Python y la llave da igual); de punta a punta sobre el APK armado: `unzip` de `index.html`/`pk.bin` da sólo basura,
  se descifran byte por byte iguales al original y el juego descifrado arranca en Chromium sin errores; el selector de
  motor del APK, 5/5; firma v1+v2+v3 ok.
- Si algún día se publica en Google Play (firma de Play): la llave tendría que salir del certificado de Play, no del de la
  firma propia; hoy el reparto es por APK directo (link), así que la firma en el aparato es la misma con la que se armó.

## JXMod 3.0.1: actualizaciones desde la app y texturas estiradas en los mapas

Pedidos: «que las actualizaciones lleguen en un botón para descargar» y, del Discord (#bugs): «en muchos, PERO
MUCHOS mapas las texturas se ven estiradas».

**Actualizar desde la app** (`web/version.json`, `apk/web/.../Web.java`, `herramientas/codigo_web.mjs`):
- `web/version.json` tiene el número de la versión (`codigo`) y los links; uno solo para la web y el APK.
- APK: a los 6 s de abrir mira `version.json` en silencio y, si su `codigo` es mayor que el de la app
  (`VERSION_PROPIA`), muestra un cartel con **Descargar** que abre el APK nuevo. El link del APK está fijo en la app
  (no se toma del json).
  Desde el juego: `JXNativo.buscarActualizacion()`.
- Web: si `version.json` trae un `codigo` mayor que el de la página (`JX_COD` al armar), aparece **Actualizar** abajo
  a la derecha (limpia la caché del service worker y recarga). La web igual se actualiza sola.
- Para sacar una versión: subir `codigo` en `web/version.json`, `VERSION_PROPIA` en `Web.java` y `JX_VERSION` en
  `juego/nucleo.js`, y armar con `JX_COD=<codigo>` (web) y `VERSION=<x.y.z>` (APK). La 3.0.1 es la primera que llega así
  (3000 → 3001).

**Texturas estiradas: dos causas.**
1. La precisión del celular. El shader del mundo (`FS` en `juego/gl.js`) iba entero en `mediump` en las calidades bajas
   y medias; en la GPU de un celu eso es de 16 bits y la UV de una textura repetida muchas veces pierde precisión
   (escalones de varios téxeles: franjas). En la compu mediump ya es de 32 bits, por eso ahí no se veía. Ahora la UV de
   la textura y la de la luz horneada van en `highp` (el resto sigue en mediump); en un WebGL 1 sin highp (Mali-400)
   bajan solas a mediump (`JX_HP` en `a100`) en vez de no compilar. Además las caras se corren por el entero de su
   centro (`gbspUVcorr`): la UV que se guarda en el vértice es el doble de precisa.
2. Un bug en `gmF2H` (`juego/gmod.js`), que guarda en medio float la UV de todas las mallas de GMod (mapas, props,
   modelos): el acarreo del redondeo se perdía con exponente impar (7,999 quedaba en 4) y ese triángulo salía con la
   textura aplastada o estirada en todos los aparatos, también en la compu.

Medido en 6 BSP reales (gm_flatgrass, gm_construct y su v13, fnaf1customfedy, gm_liminal_hotel, toxic), con las texturas
al tope del celu (512 px):

| | antes | 3.0.1 |
|---|---|---|
| franjas por la precisión del celu (escalón ≥ 2 téxeles, % de superficie) | 5,1–99,8 % | 0 % |
| ídem, tipo Minecraft simulado (16 px agrandadas a 512, bloque de 64 u) | 62–100 % | 0 % |
| UV rotas por `gmF2H` (error > 0,01) | hasta 299 por mapa, en 163 caras | 0 |
| celu emulado, gm_flatgrass (% de píxeles vecinos iguales: bloques) | 17,1 % | 1,52 % |

- Los shaders compilan y enlazan sin errores en WebGL 2 (las 5 calidades) y WebGL 1 (también la rama sin highp forzada).
- En la compu se ve igual que antes en gm_construct (diferencia 0,02/255, lo mismo que el ruido); en gm_flatgrass la
  nueva queda más cerca de la referencia exacta (el pasto ya no queda corrido).
- `gmF2H`: los 61 440 medio float vuelven exactos y 0 de 2 000 348 valores al azar se pasan de medio escalón.
- No había un mapa tipo Minecraft del Workshop para probar: ese caso está simulado sobre la geometría de los 6 mapas.
- Pruebas: `pruebas/uv_mediump.mjs` (compilación + celu emulado), `pruebas/uv_medir.py` (franjas por mapa),
  `pruebas/uv_f2h_bsp.py` (UV rotas por mapa) y `pruebas/uv_f2h.mjs` (gmF2H).

## Si se pierde el paquete del juego (pasó al cambiar de máquina)

El paquete (mallas, texturas, sonidos, videos, fotos de fondo) vive fuera del repo; si la máquina cambia, se pierde. Se
rearma desde lo publicado en `web/` con el código de la página de iPhone:

```
node herramientas/recuperar_web.mjs ../../web R889-Y5UG https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/ PLANO
python3 -I herramientas/recuperar_paquete.py PLANO ../../web PAQUETE
```

El primero descifra `juego.bin` y `pk.bin`; el segundo junta los paquetes de `web/rb`, deshace el filtro de los índices
y saca las fotos de la pantalla de carga y del inicio y la biblioteca de la sala (`PAQUETE/mqtt.min.js`, para
`MQTT_JS`). Probado: armando de nuevo con ese paquete, el `pk.bin` y los 61 paquetes de `web/rb` salen idénticos byte
a byte. Las fotos de fondo vuelven en PNG (salieron de las WebP publicadas). La firma del APK no se puede recuperar así:
tiene que guardarse como secreto del entorno.

## JXMod 3.1: Pill Packs, Mods y mapas nuevo, la pizzería del Workshop, FOV, niebla y la pierna en el piso

Lo último del Discord junto en una versión: el panel de GOLDEN, la idea de Henderson, la pizzería sobre el mapa del
Workshop «Freddy Fazbears Pizza (Event)», «agregar FOV», «¿por qué tanta neblina?» y «la pierna se traba en el piso».
Llega a todos por el botón **Actualizar** (`web/version.json` código 3100: la app dice «Hay una actualización» y baja el
APK; la web muestra el botón y recarga).

- **Mods y mapas** (concepto de GOLDEN, `gmod_tienda.js`, `inicio.js`, `template.html`): panel oscuro con acento
  amarillo, pestañas Mods / Mapas / Emotes / GMod arriba, categorías a la izquierda, tarjetas con Instalar / Activado y
  la ficha de cada uno. Prueba `pruebas/tienda_panel.mjs` 24/24 (compu y celular, 14 idiomas).
- **Pill Packs** (idea de Henderson, `pillpacks.js`, `pill_gmod.js`): pestaña al lado de GMod en el menú de spawn;
  elegir un personaje es ser él (modelo, vida, velocidad, tamaño), con barra de poder, nivel 1-10 que se guarda y 4
  habilidades; anda en red y con los addons del Workshop hechos para pk_pills. Pruebas: compu 72/72, celular 38/38,
  red 13/13, Workshop 31/31 (más abajo, en su sección).
- **La pizzería de FNAF** ahora es el mapa del Workshop (`herramientas/pizzeria.py`, `noche.js`): cámaras ubicadas
  solas en cada sala, apagón, cortina de Pirate Cove, lista de quién está en la oficina en multijugador. Noches 22/22,
  red 15/15, IA 5/5; en el celular en Patata dibuja menos que la vieja (oficina 270 dibujos y 160 mil triángulos
  contra 378 y 290 mil) y usa 24 MB más de memoria (≈ 163 MB). Detalle en la sección de la pizzería.
- **FOV, niebla y la pierna**: ver la sección siguiente. Después de juntar todo se agregó:
  - `pruebas/fov.mjs`: la silueta del arma entre fotos se mece con su animación de reposo (de 1,7 a 6,9 % entre dos
    fotos en 70°), así que ahora la prueba además mira la pasada del arma en la mano, que usa 60° con el FOV en 50,
    70 y 110 (18/18, compu y celular).
  - **El cielo 3D de gm_construct 13** (`gmod_bsp.js`, `gbspCajaCielo`): con la niebla del mapa en su color, en el
    horizonte quedaban a la vista las paredes del borde (el corte vertical es la esquina entre una al sol y otra a la
    sombra) y detrás no había nada: el área del cielo 3D se descartaba por tener más del 40 % de las hojas del BSP
    (61 %: la ciudad es muy detallada). Esa regla ahora sólo vale si el mapa no tiene puntos de aparición (con ellos,
    el área que los contiene ya se descarta). Se ven la ciudad y las lomas, como en GMod; cuesta de 19 a 25 mil
    triángulos más en ese mapa (de 16 a 35-41 mil en Patata-Medio, de 31 a 42-49 mil en Alto-Ultra).
- **Junto**: las pruebas de las cuatro partes pasan juntas sobre la misma versión (panel 24/24, Pill Packs 72/72 y
  38/38, red de Pill Packs 13/13, nucleares 9/9, noches 22/22, red de las noches 15/15, IA 5/5, FOV 18/18, niebla 12/12,
  muñeco en el piso 0/37 en RB_Flatgrass y 1/152 en RB_Construct, que es la medición de una mano bajo un alero).

## Del Discord: campo de visión, la niebla de los mapas de GMod y la pierna del muñeco metida en el piso

**«Agregar FOV»** (`principal.js`, `ui.js`, `idiomas3.js`, `gmod_vista.js`; prueba `pruebas/fov.mjs`, 16/16):
- Ajustes → Renderizado → **Campo de visión (FOV)**, de 50° a 110° (grados de alto de la imagen, como la cámara del
  juego; 70° el de siempre). Se ve al moverlo (la cámara cambia en el acto, detrás del panel), queda en las
  preferencias (`PREFS.fov`, `jx_prefs`) y la partida empieza con él. En la compu y en el celular, en 14 idiomas.
- El arma en la mano se dibuja con su propio campo de 60° (y el celular en la mano con el suyo): no se estira. Medido
  con la cámara mirando el cielo: la silueta del arma cambia lo mismo entre 50°, 70° y 110° que entre dos fotos
  seguidas en 70° (2,6–4,9 % de borde contra 3,8–6,9 % del control), mientras el fondo cambia 14–70 %.
- La mira (zoom fijo de 18°), la apertura al apuntar (proporcional) y el correr rápido con el mod de velocidad salen
  del elegido; el zoom de un addon (`Player:SetFOV`) manda mientras está y la sensibilidad del mouse con él es la
  proporción contra el elegido (antes, contra 70).

**«¿Por qué tanta neblina?»** (`gl.js`, `gmod_bsp.js`, `mundo.js`, `cielo3d.js`, `dia.js`; prueba
`pruebas/niebla_gmod.mjs`, 12/12 con la niebla de un mapa del Workshop):
- Lo que hacía la niebla de los mapas de GMod más espesa y más blanca que en GMod: 1) el color: el ciclo del día la
  pasaba al del horizonte del cielo «painted» (0,96, casi blanco) en vez del de su `env_fog_controller` (en
  gm_construct, 142 164 178, gris azulado); 2) `fogmaxdensity` no se leía: la niebla tapaba siempre el 100 % a partir
  del fin (muchos mapas del Workshop la tienen en 0,3–0,8 y en GMod lo de lejos sigue viéndose). Ahora el color es el
  del mapa de día (al atardecer y de noche va hacia el del cielo) y el shader multiplica la niebla por la densidad
  máxima (`uNieD`: comienzo, fin y densidad; también la del cielo 3D).
- Medido (cámara del jugador en el lugar más abierto, 12° para abajo, 1200 puntos del piso; «lavado» = niebla > 25 %),
  igual en las cinco calidades y en compu y celu: gm_construct (BSP 13) y el del juego no cambian (0 % lavado; a 100 m
  1 % y 9 %, 5 % y 13 % en Ultra por su bruma); con una niebla de mapa del Workshop (de 6,5 a 76 m, densidad 0,6) la
  niebla media del piso baja de 61–62 % a 37–38 % y a 100 m de 100 % a 60 %, con el color del mapa en vez de blanco.
- Lo que no es: la vista corta de las calidades bajas sólo esfuma la última franja (en Patata, de 112 a 160 m: el piso
  hasta 100 m queda sin niebla) y el evento no toca la niebla (no está en los mapas de GMod).
- Límite: gm_construct 13 no da una niebla espesa; el caso de la captura se reprodujo con la misma niebla en un mapa
  con el `env_fog_controller` de un mapa del Workshop.
- **El cielo 3D de gm_construct 13 no aparecía** (`gmod_bsp.js`, gbspCajaCielo). Sin la niebla blanca se veían, del
  otro lado del lago, las paredes del borde del mapa (caras del mundo, no del cielo 3D: `GM_CONSTRUCT/WALL_TOP`, el
  mismo material en las dos, que se resuelve) con cielo liso arriba, y en la esquina un corte vertical: una pared mira
  al sol (normal −X de Source, coseno 0,33) y la otra le da la espalda (−Y) y sólo tiene la luz del cielo. Ese corte
  también está en GMod; lo que faltaba era la ciudad y las lomas del cielo 3D detrás. Su área del BSP tiene el 61 % de
  las hojas (1192 de 1967: es muy detallado) y la regla «el área del cielo no puede pasar del 40 %» lo descartaba;
  ahora esa regla sólo se usa si el mapa no tiene puntos de aparición (con puntos, ya se descarta un área que los
  tenga adentro). Este BSP no trae luz horneada (los lumps 8 y 53 están vacíos): se ilumina con el sol y el ambiente de
  su `light_environment`. Con el cielo 3D, el tercio de arriba de la pantalla cambia un 25–31 % mirando al lago (la
  ciudad detrás de las paredes) y la niebla del mapa sigue igual (0 % de piso lavado); fotos en compu y celu, en las 5
  calidades, mirando al lago y hacia otros dos rumbos.

**«La pierna se traba en el piso»** (`fisica.js`, `personas.js`; prueba `pruebas/rag_piso.mjs`):
- Causa: un triángulo del mapa no tiene grosor y de qué lado está algo se decidía en cada paso por su centro (el del
  cuerpo, o el de cada esfera de la cápsula). Si en un paso ese centro pasaba al otro lado —la rodilla arrastra el pie
  al caer, un golpe fuerte, la física a 30 pasos por segundo de los celus lentos—, desde el paso siguiente el choque lo
  empujaba para abajo y quedaba trabado.
- Arreglo: cada parte del muñeco (`noCruza`) recuerda de qué lado está de cada triángulo que tiene cerca (el de su
  centro cuando lo ve por primera vez, o el de la cara si ya lo está tocando) y sólo cambia si su centro pasó al otro
  lado rodeando el borde, sin atravesar ningún triángulo. Si una parte quedó del otro lado, el choque la saca hacia el
  lado recordado (la cara del triángulo hacia ese lado; en las cajas, con todos sus vértices). Sin costo apreciable.
- Medido: 7 personajes (tamaños 0,44 a 1,53), de 2 cm a 12 m de alto, hasta 20 m/s de lado y 15 m/s para abajo, con
  un empujón al azar, en piso plano y rampas, física a 60 y 30 pasos y 5 y 10 subpasos; «trabada» = una parte más de
  1,5 cm adentro durante todo el último medio segundo (de 5 s). Tiradas trabadas antes → ahora (la peor): RB_Flatgrass
  19/84 (86 cm) → 0/84; gm_flatgrass (BSP) 20/84 (86 cm) → 0/84; RB_Construct 32/168 (78 cm) → 1/168; gm_construct
  (BSP) 35/175 (233 cm) → 0/175; Pasto plano (su piso es una caja, no triángulos) 3/88 (26 cm) → 1/88 (2,6 cm). Lo que
  se mete un momento al caer y vuelve a salir (p95): 34–44 cm → 14–19 cm. La que queda en RB_Construct es una mano
  bajo un alero de un solo lado (la medida la cuenta como metida aunque esté afuera del sólido).
- Fotos de la cámara del jugador, antes y después, en la compu y el celu: la tirada que peor quedaba (la mano y el
  brazo enterrados 86 cm) ahora queda entera sobre el pasto.

## Del Discord: los botones nuevos del celular y Personajes de GOLDEN, y el celular encima de la pausa (Kris)

Dos conceptos más de GOLDEN («Mejores botones»: «hacerlos mejor que la foto pero con ese estilo»; «Mejora en la
interfaz de skins»: «tipo así, pero que la skin se vea más») y el bug de Kris («si tenés equipado el celular y abrís
el menú de pausa», el celular queda dibujado encima).

- **Botones del celular** (`hud.js`: `HUD_V2`, `hudV2Pos`; `controles.js`, `hudorden.js`, `template.html`): la
  disposición del concepto como la nueva de fábrica. Arriba a la izquierda, en columnas: la del sistema (pausa en la
  esquina, chat, celular, micrófono, voces), al lado la de crear (props, MOD, GMod, SM, Verity) y después las teclas
  de los mods con su placa y su nombre; arriba a la derecha el arma en la esquina (con las balas adentro), la cámara y
  los emotes, abajo la linterna, la cámara libre (amarilla con L y R debajo cuando está abierta) y borrar; abajo a la
  derecha el disparo grande con la mira amarilla, el secundario (congelar en celeste), saltar en la esquina, agacharse,
  la patada, recargar y, en arco arriba del disparo, + y − de la pistola de física o las teclas del arma de un mod.
  Estilo: círculos oscuros translúcidos con filo blanco fino, amarillo para lo principal y lo prendido, la G de GMod
  blanca, globitos amarillos; linterna, cámara libre y patada redibujadas (la linterna parecía un parlante).
- **Mejor que la foto**: cada grupo se escala entero (los botones y la distancia entre ellos), así no se pisan con
  ningún tamaño de controles (antes, al 120 % el disparo pisaba al secundario); ningún botón baja de su mínimo para
  el dedo (al 80 %: disparo ≥ 64 px, saltar ≥ 54, agacharse y secundario ≥ 48, recargar y los de arriba a la izquierda
  ≥ 44, el resto ≥ 34) y cada uno se toca en un área de hasta 44 px que nunca se mete en la del vecino (`--hit`); si
  en un celular bajo la columna derecha no entra, se achica lo justo; 3 filas a la izquierda si entran arriba de la
  zona de la palanca (45 % del alto), si no 2; con todo a la vista, si no entran a lo ancho, se achican lo justo. Un
  botón que aparece (el micrófono al entrar a una sala, la primera tecla fijada) ya sale en su lugar, y la HUD mira
  qué se ve cada 3 cuadros (antes 10: lo que aparecía se veía un rato fuera de lugar).
- **Lo guardado no se rompe**: quien había movido o agrandado botones (`PREFS.hudPos` con posiciones y sin `_v: 2`)
  los ve exactamente igual, con los de fábrica de antes alrededor (`hudVer`: 1); en Ajustes → Controles → Pantalla
  táctil puede «Probar la nueva» (la suya queda en `PREFS.hudPosV1`) y «Volver a la mía». La nueva con un botón
  movido sigue siendo la nueva; el editor arranca cada botón de donde está (antes los de arriba a la izquierda saltaban
  al agarrarlos); la tienda de controles publica `v: 2` y lo de antes (`v: 1`) se ve como se publicó. Los botones de
  las armas de mods, las teclas fijadas del panel GMod y los de Pill Packs (que copian el lugar del disparo, el
  secundario, la patada, recargar y el arma) siguen igual.
- **Personajes** (`rbmenus.js`, `gmod_pm.js`, `menu.js`, `principal.js`, `template.html`): pestañas Personajes / Mods /
  Gorros con buscador (por el nombre que se ve), tarjetas con la cara y el tilde amarillo en la elegida, «Equipar» /
  «En uso» / «Instalar» en los de mods (pregunta antes de bajar), «Importar personaje» en el pie y la personalización
  del gorro al costado de la grilla. A la derecha, de arriba a abajo, el escenario: el personaje en 3D, girable
  arrastrando y con el reposo del juego, que respira y mira alrededor (`humano.js`: el de GMod lo dejaba quieto como
  una estatua), y arriba su nombre (Oswald, filo amarillo) y su gorro. El escenario es un hueco del panel
  (`MENU.caja`): `lobbyEncuadre` pone al personaje para llenarlo (del 17 al 92 % del alto, centrado) y el lienzo se
  pinta oscuro. Es el mismo panel en la pausa (Personaje): ahí el cambio de personaje y de gorro es al momento y
  «Volver a la pausa» vuelve; la tecla de pausa lo cierra.
- **El celular encima de la pausa** (`ui.js`: `capasRevisar`; `template.html`): la regla que lo escondía era
  `body:has(.panel:not(.oc)) #celular,#celular.tapado`; un navegador sin `:has()` (WebView viejos de Android, Safari
  antes de 15.4) tira la regla **entera**, también lo de `.tapado`. Ahora un MutationObserver pone `body.menuEncima`
  apenas se abre un menú grande (cualquier `.panel`, el spawn, el inicio, el editor de botones, un diálogo) y eso
  esconde el celular, la ruleta de emotes, el panel GMod, el menú MOD, el chat, Verity, el arma en la mano, el cartel
  de «juntos» y la barra del modo de GMod; el celular además va en la capa 5, debajo de los paneles. Sin `:has()` en
  el CSS.
- **Medido**: en 873×393 al 80 %, disparo 86 px (antes 73), saltar 66 (56), agacharse 51 (49), los de arriba a la
  izquierda 47 (39), los de arriba a la derecha 41 (37); en 640×360 nada baja de su mínimo. El personaje del escenario
  ocupa el 80 % de su alto, centrado (±4 %), y el 72-79 % del alto de la pantalla (antes, al costado, ~50 %).
- **Pruebas** nuevas: `botones_golden.mjs` 13/13 (13 pantallas, también el juego girado; controles al 60, 80, 100 y
  120 %; 10 situaciones: nada se pisa ni a menos de 6 px, el área del dedo tampoco, tamaños, la zona de la palanca,
  las columnas; lo guardado antes queda igual que en el juego de antes en los 91 botones comparados; probar la nueva y
  volver; el editor; Pill Packs), `personajes_golden.mjs` 12/12 (compu, celu, celu chico, girado y tablet; 14 idiomas;
  buscador, gorros, mods, girar, reposo, la pausa) y `capas_menus.mjs` 10/10 (con el juego de antes en un navegador
  sin `:has()` se reproduce la captura de Kris: el celular arriba aunque tenga `.tapado`; ahora no, con y sin
  `:has()`, ni con Ajustes, Controles, Personaje, el spawn, los emotes, el editor ni con la ruleta, el panel GMod, el
  menú MOD o el chat abiertos debajo). Las de antes: `hud_celu` 7/7, `personajes_gorro` 7/7 en compu y en celu,
  `tienda_panel` 24/24, `menus_jx` 6/6, `tutorial` 22/22, `girado` 10/11 y `celu_mano` con fallas de tiempo que
  cambian de corrida a corrida (la máquina con carga 40-65 y 1-4 cuadros por segundo; el juego de antes falla lo mismo:
  `girado` «cámara R» igual, y en `celu_mano` caminar y la tercera persona). Adaptadas a lo nuevo: `hud_orden.mjs`
  (columnas) y `personajes_mods.mjs` (la pausa abre el panel nuevo); las dos piden addons del Workshop que no están
  en esta máquina.

## Tráiler de la 3.0 (40 s, 4:3 en FHD), v2

Pedido: un tráiler con la canción del video de 41 s, con suspenso, sin interfaz, el logo recortado al principio y
renderizado mejor que el juego; en 4:3 FHD («no discord»). Después: «terminó muy en seco, debería haber estrellado
bien la Physics Gun, la bomba nuclear nada que ver y las voces quitalas; mejorá los colores y efectos; un final con
más suspenso y que diga Beta lanzada; caminatas y corridas bien cinemáticas; cambiá el personaje» (el soldado).

- **El video**: `jxmod/JXMod_trailer_3_0.mp4`, 1440×1080 (4:3), 24 cuadros por segundo, 40,0 s (960 cuadros), 46,5 MB.
- **Todo sale del juego**, sin interfaz: cada plano se renderiza dentro de JXMod con las herramientas de
  `herramientas/trailer/` (ver su LEEME), en Ultra, con sombras de 4096 y 4 subcuadros por cuadro (suavizado y
  desenfoque de movimiento).
- **El protagonista** es el soldado de fuerzas especiales (SpecialForcesM).
- **Movimiento real**: todo lo que hace con el cuerpo es captura de movimiento real de la biblioteca de CMU que ya trae
  el juego: la corrida (127_07), la caminata cansada (105_26), quedarse parado (111_28), agacharse cuando le pasa el
  meteoro (77_09), darse vuelta (69_16) y agacharse a agarrar el arma (26_09, en cámara lenta). El cuerpo avanza lo que
  el pie apoyado se va para atrás (los pies no patinan) y los clips se funden entre sí. DeepMotion no se usó: pide
  cuenta y créditos pagos.
- **La nuclear nueva** es un efecto propio: un hongo volumétrico (bola de fuego que nace en el piso, toro que rueda con
  un domo, tallo de polvo, falda que corre por el suelo), con su luz y la onda expansiva que le llega con una ráfaga
  de arena. Reemplaza a la nuclear de partículas del juego.
- **La Physics Gun** baja como un meteoro azul desde el sol, le pasa al lado de la cabeza (se agacha), se estrella en
  la arena (destello, corona de arena, anillo de polvo, chispas, marca quemada, sacudón) y queda clavada de punta.
- **El final**: se da vuelta, se agacha y estira la mano en cámara lenta; cuando la toca, el arma se enciende; corte a
  negro, silencio, y en el golpe de la canción (37,5 s) entra la placa: JXM, «BETA LANZADA», «JXMOD 3.0».
- **Sin voces**. Sonido: la canción hasta su final natural, efectos del juego y sintéticos (onda expansiva, meteoro,
  golpe, zumbido del arma que crece, dron de suspenso, golpe de la placa).
- **Color**: gradación de cine en cada plano (resplandor cálido en las luces fuertes, contraste con luces suaves,
  sombras frías y luces cálidas, vibrancia, un píxel de aberración cromática, viñeta y grano).
- **Revisado con `verificar.py`**: 960 cuadros, 40,000 s, sin negros fuera de lugar ni cuadros repetidos; los
  destellos en su lugar (la grieta en 6,42 s, el golpe en 13,50 s, el barril en 18,75 s, la nuclear en 19,04 s, el
  meteoro en 31,46 s y la placa en 37,50 s) con sus golpes de sonido (la onda expansiva llega en 21,0 s); el pico del
  audio en −0,95 dB, sin recortes.
- **Arreglos en el camino**: la grieta se veía a través del hongo (el volumen dejaba pasar un 2 % de luz y la grieta es
  muy brillante: ahora es opaco cuando casi no deja pasar luz); la cara salía roja en la playa (con el sol del
  atardecer de frente, la textura de la piel se iba a un rojo saturado: un tinte sólo en el material de la cabeza la
  deja marrón cálida); los renders largos se cortaban a la media hora (ahora cada cuadro queda guardado y el render se
  retoma donde quedó).
- **La mano del final giraba** («la mano al final gira»). Eran dos cosas: los dedos se doblaban sobre lo que ya estaban (la
  captura de movimiento no trae dedos, así que nada los volvía a poner) y daban vueltas sin parar, hasta 8,7 cm entre
  subcuadros; y el brazo se estiraba del todo hacia un punto al que no llegaba (el cuerpo se ubicaba con la arena de
  otro lugar, 22 cm más baja, y el punto de agarre quedaba en el aire, 11 cm sobre el arma), con latigazos de hasta 12°
  por subcuadro. Ahora los dedos se doblan desde su pose de base (se mueven 0,6 cm como mucho), el cuerpo se ubica
  donde está parado de verdad, el agarre sale de la forma real del arma clavada y la mano gira 0,9° por subcuadro como
  mucho; los dedos apoyan en la cola del arma (a 0,9 cm en el toque, 36,33 s). Se volvió a renderizar sólo ese plano
  (9b, 70 cuadros).
- **Límites**: los modelos son los del juego (la mano del soldado es como un mitón, con los dedos juntos: apoya y se
  cierra sobre la cola del arma, pero no la rodea dedo por dedo); todo se renderizó con el procesador, sin placa de
  video.

## Del Discord (3.1): el sonido que seguía, «se trabó» sin trabarse, la radio con YouTube, volver al server e iOS

**«Salís del juego y se queda el sonido»** (`AndroidManifest.xml`, `Inicio.java`, `Web.java`, `audio.js`; prueba
`pruebas/fondo_callado.mjs`, 5/5; la 3.1 da 2/5):
- `Inicio` (la puerta sin pantalla, raíz de la tarea) tenía `excludeFromRecents`: sacaba de Recientes la tarea entera,
  con el juego adentro, y no había cómo cerrarla («ni siquiera se me muestra la ventana de la app»). Se quitó (Inicio
  igual no se ve: `noHistory` y se cierra sola); sin WebView cierra la tarea vacía (`finishAndRemoveTask`).
- `WebView.onPause()` no frena el sonido. Ahora, al ocultarse la página (`visibilitychange`, `pagehide`, `freeze`) o
  cuando la app lo pide en `onPause` (`__jxFondo(1)`), se calla todo: el AudioContext (efectos, mods, Verity, voces
  del chat), las emisoras, YouTube (radio, tele, música de emotes), la voz del sistema, los `<audio>`/`<video>`, las
  maquinitas (su puente suspende sus AudioContext) y el micrófono deja de mandar; al volver sigue todo (YouTube, al
  tiempo de la sala). Medido en 4 s oculta: el reloj del sonido, un `<audio>`, YouTube y una maquinita avanzan 0 s
  (antes 4,1 / 4,0 / 4,1 / 4,1 s) y el micrófono queda apagado; al volver avanzan 4,0 s.
- La app guarda en `onPause`/`onResume` cómo quedó (`jx_vida`: adelante, o atrás con el juego andando, cargando o sin
  latido) para la caja negra (`JXNativo.cierreAnterior`).

**«El juego se trabó la última vez»** con el juego cargando (`cajanegra.js`, `principal.js`; prueba
`pruebas/caja_falso.mjs`, 10/10; la 3.1 da 4/10):
- El registro de Juanpepo (`{"juego":"carga","mapa":"","motor":"-","memJS":"38/1020 MB","mods":[]}`) es lo que guarda
  el juego cuando el aparato no da WebGL al arrancar (con WebGL apagado: `{"juego":"carga","mapa":"","fps":60,
  "motor":"-","dx":90,"memJS":"33/4192 MB"}`): no se había leído ni el paquete ni montado ningún mod (los 6
  instalados no tienen que ver); salió el cartel «Este aparato no tiene WebGL». El aviso salía porque quedó «andando»
  (`rb_vivo`), que también queda si el sistema cierra la app en segundo plano antes de guardar.
- Ahora avisa sólo si se trabó de verdad: la app lo vio (`?colgado`, `?caida`, o «adelante» / «sin latido»), o se
  cortó a la vista. No si se ocultó con el juego vivo, si salió con Salir, si el arranque mostró su error, o (registro
  de la 3.1) sin WebGL y cargando. Lo mismo para bajar los gráficos por cierres.
- Sin WebGL al arrancar se reintenta 4 veces con la página a la vista y una recarga antes del cartel (que ahora trae
  «Reintentar»): con el WebGL fallando las primeras veces, arranca igual.

**La radio con YouTube «se crashea»** (`entidades.js`, `emomusica.js`; prueba `pruebas/radio_yt_liviana.mjs`, 5/5):
- Medido como la vista web de Android (todo en un proceso, celular de gama baja: Patata y el procesador 4× más lento):
  el reproductor de YouTube escondido de 200×113 decodifica igual el video en 854×480 a 25 cuadros por segundo (ni el
  tamaño, ni `vq`, ni `setPlaybackQuality`, ni ocultarlo lo bajan) y suma ~40 MB al proceso que dibuja (318 → 358-364
  MB de PSS) y 15-30 MB de memoria de JavaScript. Eso no se puede sacar desde el juego (YouTube no da sólo audio).
- Lo que sí: el reproductor se volvía a armar a cada paso en el borde del alcance o entre dos radios (cada vez ~2,5 MB
  de código de YouTube a leer y guardar en memoria); parado entre dos radios, moviéndose medio metro, 9 armadas en 20 s,
  ahora 0 (yendo y viniendo por el borde, 1 y ahora 0). La que suena sigue cargada hasta 6 m más allá de su alcance y le
  gana a otra hasta 4 m más cerca; y si no se oye hace 8 s (volumen 0 o fuera de alcance) queda en pausa sin bajar ni
  decodificar (a 43 m: el video avanza 0 s en 3 s; antes se desarmaba y al volver se armaba de nuevo), y al volver
  sigue al tiempo de la sala.
- Límite: el cierre en sí no se reprodujo (esta máquina tiene 16 GB); se midió el costo y se sacó lo evitable.

**«Cuando te desconectas del server y vuelves apareces en otro lugar»** (`red.js`; prueba `pruebas/red_volver.mjs`
con dos navegadores y broker local, 8/8 —la 3.1 da 3/8—: corte de red, menú, app que se cae, más de 5 min,
otro jugador o un cajón donde estaba, y otro mapa):
- Antes: al volver del menú o al reabrir la app aparecía en la aparición del mapa (a 28-30 m de donde estaba) y, si se
  le cerró la app, los demás veían un fantasma suyo hasta 10 s que seguía con su última velocidad (se hundía bajo el
  piso, hasta 8 m) junto al nuevo.
- Ahora: si vuelve al mismo server (mismo mapa) antes de 5 minutos, aparece donde estaba y mirando igual; si no (o si
  estaba muerto, o hay un modo de juego de GMod), en la aparición más lejos de los demás. Siempre en un lugar libre (con
  piso, adentro del mapa, sin meterse en pared, prop ni jugador; si no, el lugar libre más cercano), revisado otra vez
  cuando llegan los props y jugadores de los demás (hasta entonces no manda su posición: no empuja al que está ahí). El
  que vuelve con otro número avisa el de antes y los demás borran su fantasma y sus cosas viejas en el acto; uno que
  deja de mandar queda quieto donde se cortó. Recién llegado, durante 3 s no empuja a nadie: el que se corre es él.
- Medido: del menú y al reabrir la app vuelve a 0 m de donde estaba (antes 28-30 m) y el otro ve una sola Ana
  donde está; con Beto parado ahí aparece a 1,3 m sin moverlo; con un cajón ahí, no queda adentro (0 cm metida).

**iOS: «no deja ver la tele, no instalan los mods»** (`entidades.js`, `template.html`, `gmod_pipe.js`, `gmod.js`;
pruebas `pruebas/tele_toque.mjs` y `pruebas/gmod_pipe_memoria.mjs`):
- La tele: Safari no deja que un video con sonido de otro sitio arranque sin un toque adentro de él, y el reproductor
  va detrás del juego sin recibir toques: quedaba la tapa con el play para siempre. Ahora, si el reproductor ya contesta
  y 5 s después no arrancó, pasa adelante (la tele en su lugar; el de la radio, visible arriba con un cartel) hasta que
  arranca, con el aviso «Tocá la tele…». Probado en Chromium con la regla de autoplay que pide gesto e identidad de
  iPhone (`tele_toque.mjs` 4/4; la 3.1 da 2/4): la tele queda en pausa y su reproductor pasa adelante (antes quedaba
  detrás, sin toques); un toque en ella y suena con sonido y avanza, y vuelve detrás; la radio, lo mismo con su cartel
  arriba (antes, además, quedaba con la perspectiva de la tele de antes: 26×15 px fuera de la pantalla). Ojo: en
  Chromium un toque en cualquier lado de la página ya habilita el video (delega el permiso al reproductor); Safari no.
- Los mods: el addon de SteamPipe se armaba entero en memoria (más una copia al guardarlo y otra lectura para su
  SHA-1); en un iPhone, que cierra la página al pasar su tope de memoria, los grandes no llegaban. Ahora va a un Blob a
  medida que llegan los pedazos en orden (cada uno con su SHA-1; en memoria quedan a lo sumo 24). Medido con un addon
  de 39,5 MB por la tienda de verdad (111412589), mientras baja y se guarda, dos veces cada una alternadas: el proceso
  que dibuja subía 152 y 153 MB y ahora 86 y 93 MB (60-67 MB menos: 1,6 veces el addon; en uno de 400 MB, estimado,
  ~600 MB menos), y el pico de memoria de JavaScript con los arreglos baja de 212 a 175-178 MB. El .gma guardado es
  el mismo (mismo SHA-256) y se monta igual (15 props, 171 archivos).
- Otra causa que no se arregla desde el juego: en la web (y un iPhone sólo tiene la web) todo lo de Steam pasa por la
  tienda, que en el plan gratis tiene un tope de pedidos por día; la app de Android lo pide directo y la web no puede
  (Steam no deja leer su CDN desde otra página).
- No se probó en un iPhone ni en un Android de verdad (acá no hay Safari ni APK: la firma se perdió y no se armó); el
  Java compila con `javac` contra `android.jar` 35 (0 errores).
