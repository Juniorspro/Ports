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
  Hints o el user agent; si no, la GPU que muestra WebGL) y elige la calidad: Patata por debajo de 19 puntos (PowerVR
  GE8320 de los Helio G25/G35/P35), Bajo hasta 29 (Unisoc T606, Exynos 850), Medio hasta 59 (Helio G85, Snapdragon 680),
  Alto desde 60 (Helio G99); con 2 GB no pasa de Bajo y con 1 GB es Patata. En Ajustes se ve el aparato detectado.
  Prueba `pruebas/celulares.mjs` (7/7: los 717 códigos dan su equipo, modelos con sufijos y sin marca, el user agent,
  la GPU sola, la memoria, y abrir el juego en un Tecno Spark 10C da Bajo).
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
- **Pizzería de Freddy (la noche de FNAF 1)**, `RB_Pizzeria`, con server oficial y elegible al crear uno. Sobrevivir de
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
  andan; mientras corre la noche no se pueden poner props. Cámaras (G) con el plano de FNAF hecho del mapa; linterna (L)
  que alumbra en todas las calidades (luces especiales en el shader: la linterna, las de los demás, la lámpara de la
  oficina, las de las puertas y, en las calidades sin luces puntuales, las del techo); llamadas de las noches 1 a 4
  (castellano o inglés según el idioma) con "Silenciar llamada"; sustos en video; Game Over con Reintentar y Menú (todo de
  cero). En una sala la noche la maneja uno solo (el de id más chico; si se va, sigue el próximo desde donde estaba) y cada
  noche lleva un número para que todos se reinicien juntos; al que agarran pasa a espectador (no se ve ni choca): sigue a
  los demás en primera o tercera persona, vuela libre o mira las cámaras, y vuelve a la oficina en la noche siguiente; si
  agarran a todos, Game Over y la misma noche otra vez a los 8 s. Al lado del micrófono, **VOCES** silencia las voces de
  los demás. Freddy, Bonnie, Chica y Foxy también están en **Personajes** para jugar con ellos. `juego/noche.js`. Armado (lo
  extraído queda fuera del repo, `CREDITOS.md` dice de dónde sale cada cosa):
  ```sh
  # el mapa y los animatrónicos (con srctools, pyfqmr y scipy); FN_EXTRA: texturas y modelos de props de otros addons
  FN_EXTRA=keithy:winter python -I herramientas/pizzeria.py PAQUETE PAQUETE_NUEVO fnaf1customfedy.bsp CARPETA_PACK_HW
  # sonidos, llamadas y sustos (de los .ogg/.webm sacados de FNAF In Real Time con UnityPy, y los .wav del pack)
  python3 -I herramientas/pizzeria_medios.py PAQUETE_NUEVO OGG_IRT VIDEO_IRT SONIDOS_HW
  # los cuatro como personajes (la misma malla del mapa con los huesos del juego) y sus retratos para la tienda
  python3 -I herramientas/skin_fnaf.py PAQUETE_NUEVO PAQUETE_FINAL CARPETA_RETRATOS
  ```
  `herramientas/source_mdl.py` lee los modelos de Source (.mdl/.vvd/.vtx: huesos, mallas, secuencias y las animaciones
  comprimidas). El mapa pasa de Source al juego con (x, y, z) → (y, z, x) en metros. Cada cara se dibuja del lado donde no
  hay brocha sólida (en este BSP el plano de la cara no alcanza: medido con rayos desde adentro de las salas, el 48 % de lo
  que se miraba eran caras de espaldas, techos y paredes que no se dibujaban; ahora 0,1 %); vidrios y cortinas, de los dos
  lados y transparentes. Los muebles de Half-Life 2 que el mapa usa y no trae (mesadas, cocinas, heladera, estante,
  inodoros, el escritorio y la silla del cuarto de atrás) están hechos con cajas a la medida de lo que va encima (antes la
  compu y el microondas flotaban), igual que los reflectores del escenario y los apliques; las manijas giran con sus
  puertas, los arcades apoyan en el piso (con carteles y pantallas dibujados acá) y Pirate Cove tiene su cortina de dos
  paños. Si un material no está en la carpeta que pide el modelo, se busca cerca en el mapa (la textura suelta, con
  `color` al final, en una carpeta hermana o en la de arriba: así salen las cabezas del cuarto de atrás). Los props muy
  detallados se simplifican y las texturas que no vinieron de ningún lado son un color parecido. (Arreglado de paso en el
  motor: los materiales "sin luz" salían del color de la niebla en todos los mapas salvo en ultra, porque la niebla y la
  cámara se cargaban sólo en los programas que usan el sol.) Los
  animatrónicos son mallas con piel (a lo sumo 56 huesos con peso) y sus clips en float16. Pruebas: `pruebas/noche.mjs`
  (solo: menú, llamada y silenciar, noches 1, 4 y 6, energía, apagón, Game Over y reintentar, progreso, pausa encima, sin
  props), `pruebas/red_noche.mjs` (dos jugadores: quién maneja, sincronía, puertas, linterna, espectador, Game Over y
  reinicio en sala, traspaso), `pruebas/noche_luz.mjs` + `noche_luz.py` (luz medida con y sin linterna en cada calidad),
  `pruebas/pizzeria.mjs` (recorrido y las 11 cámaras) y `pruebas/skins_fnaf.mjs`.
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
