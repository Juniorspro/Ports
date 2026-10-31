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

- **Definitive RezoBox** (nuestra versión, antes HypperX RezoBox): el logo es la R de Rezona + "definitive rezobox"
  (`juego/logo_dr.webp`, Nunito Black como el logo anterior). `inicio.js` es el inicio con el aspecto del menú de
  Garry's Mod (menú de texto, escenas de fondo en `PAQUETE/fondos/*.jpg`, fuera del repo, botoncitos abajo y paneles
  claros); el menú de Hypper sigue armado abajo pero nunca se muestra. `rbmenus.js`: Multijugador (lista con buscador,
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
- **Patadas** (`juego/patadas.js`; prueba `pruebas/patadas.mjs`, 11/11): F a pie (en un vehículo F sigue siendo bajar) o el
  botón del pie en el celular. Es la patada del juego (el clip "Kick", su tramo del golpe al doble de velocidad: 0,64 s,
  casi quieto mientras dura). A los 0,2 s, con la pierna estirada: empuja los props que tenés adelante (la caja sale a
  9 m/s), le saca 20 de vida a la gente (con el golpe, su voz y un empujón), tira lejos a los muñecos; no se repite antes de
  0,75 s. En primera persona se ve la pierna (el cuerpo a la vista con la cabeza y los brazos achicados a nada, que
  tapaban la cámara) y vuelve todo al terminar. Los demás la ven por el estado del jugador.
- **HTML liviano: paquetes aparte** (`herramientas/remotos.py`, `datos.js` `rbAsegurar`; prueba `pruebas/paquetes.mjs`,
  8/8): los personajes que no son el Hero y los mapas grandes (mallas y texturas; la pizzería con sus animatrónicos y sus
  sonidos) y los sonidos de los memes salen del HTML a archivos sueltos en `hypper/rb/` (56, 27 MB en total). El juego
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
    planos, ~13 KB) en `hypper/emotes/cmu/` (29 MB los 2175), al lado del HTML; en el HTML va sólo el catálogo (nombre,
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
  de la compu con las teclas). Tamaño elegible en Ajustes (60 a 120 %, de entrada 80 %: los del Hypper quedaban
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
- **Controles como el Hypper original** (`hud.js`): cada botón en el lugar del PlayerCanvas del juego (referencia
  1280×720, escalado como su CanvasScaler) con íconos propios en vector: pausa y chat arriba a la izquierda, props a la
  izquierda al medio, disparo grande, saltar y borrar abajo, arma, cámara y emotes arriba a la derecha; con la pistola de
  física girar, congelar, acercar y alejar; en un auto pedales, doblar, freno de mano y bajarse.
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
