# Créditos de assets

RezoBox es `uso: sin fines de lucro` (ver `CLAUDE.md`). Lo extraído de otros juegos y addons no está en el repo: los
scripts de `herramientas/` lo leen de afuera y va sólo dentro del HTML armado.

## Letra del menú principal (3.0)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Oswald (recortada a latín y cirílico, `juego/fuentes/oswald_jx.woff2`; va adentro del HTML) | The Oswald Project Authors (https://github.com/googlefonts/OswaldFont), bajada de github.com/google/fonts | menú principal (`juego/template.html`) | SIL Open Font License 1.1 (`juego/fuentes/OFL_Oswald.txt`; también dentro de la letra) |

## Pizzería de Freddy (`RB_Pizzeria`, `juego/noche.js`)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Mapa de la pizzería (geometría, texturas y props de la oficina, el comedor, el escenario, Pirate Cove y el resto) | "FNaF 1 Custom map by Fedy!" (Garry's Mod, workshop 2795755942); modelos de robgamings, rynfox, chuizaproductions, Keithy, Team VR | https://archive.org/details/gmod_addons_2795755942_1652108797 | rip: Five Nights at Freddy's (addon de la comunidad) |
| Texturas de props de Keithy: el escritorio de la oficina, monitores, parlantes, la silla, la cámara de seguridad, cupcakes, gorritos de fiesta, el sol y las nubes del escenario | "FNaF 2 Map Props" (Keithy, Garry's Mod, workshop 2290047639), bajadas sólo esas por rangos | https://archive.org/details/gmod_addons_2290047639_1605614845 | rip: Five Nights at Freddy's 2 (addon de la comunidad) |
| Texturas de las mesas del comedor, la computadora vieja, el cartel de salida y las piletas de los baños (modelo y textura) | "[urf.im] FNAF Map Winter" (Garry's Mod, workshop 2322584409), con contenido de Half-Life 2 y Black Mesa | https://archive.org/details/gmod_addons_2322584409_1608274540 | rip: Five Nights at Freddy's / Half-Life 2 (addon de la comunidad) |
| Freddy, Bonnie, Chica y Foxy (mallas, huesos, texturas y animaciones: quieto, caminar, correr, susto, mirar); también como personajes jugables | "FNAF Help Wanted NEXTBOT Pack [DrGBase]" (cl3nr / linux55), modelos de FNaF VR: Help Wanted | https://archive.org/details/gmod_addons_2718492387_1642128380 | rip: FNaF VR: Help Wanted |
| Risa de Freddy, ollas de Chica, respiración, cajita de música, grito, pasos de carrera | el mismo pack (sound/cl3nr/fnaf1) | ídem | rip: FNaF VR: Help Wanted |
| Ventilador, zumbido de las luces, puertas, golpes y carrera de Foxy, apagón, campanas de las 6, estática, cámaras, pasos, ambiente, risas de chicos, respiración en la ventana, el error de los botones, la pantalla de Game Over y las llamadas de las noches 1 a 4 (castellano e inglés) | "FNAF In Real Time" (Real Time Studio) | https://kingdragonsyt.itch.io/fnaf-in-real-time | rip: FNAF In Real Time |
| Sustos en video (Freddy, Bonnie, Chica, Foxy y el del apagón) | "FNAF In Real Time" (Real Time Studio) | ídem | rip: FNAF In Real Time |
| Personajes y nombres de Five Nights at Freddy's | Scott Cawthon | — | rip: Five Nights at Freddy's |

Hecho acá (nuestro): el conversor de Source (`source_mdl.py`, `pizzeria.py`), la lógica de la noche, la interfaz, las
texturas de reemplazo (acero, revoque y colores lisos para lo que el mapa no traía), los muebles de Half-Life 2 que faltaban
(mesadas, cocinas, heladera, estante, inodoros, escritorio y silla, reflectores del escenario y apliques, hechos con
cajas), los carteles y las pantallas de los arcades, la cortina de Pirate Cove (dos paños
con la tela del mapa), el plano de las cámaras (dibujado del mapa), el armado de los animatrónicos como personajes
(`skin_fnaf.py`) y sus retratos, el ícono y el fondo de carga (capturas del juego).

## Garry's Mod y Half-Life 2 (`RB_Construct`, `RB_Flatgrass`, la palanca, las armas, las posturas)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Mapas gm_construct y gm_flatgrass (geometría, texturas, props, cielos) (paquete nativo: web/rb/gm_mapas.*) | Garry's Mod 10 (Facepunch Studios) con contenido de Half-Life 2 (Valve) | https://archive.org/download/garrys-mod-10/Garrys_Mod_10.rar | rip: Garry's Mod 10 / Half-Life 2 |
| Sonidos del jugador: caída (pl_fallpain), golpe del cuerpo (body_medium_impact_soft), traje al correr (suit_sprint), cambio de arma y negar (common/wpn_*), linterna (items/flashlight1), munición, botones | Half-Life 2 (Valve), en Garry's Mod 10 | https://archive.org/download/garrys-mod-10/Garrys_Mod_10.rar | rip: Half-Life 2 |
| La palanca: v_crowbar y w_crowbar (mallas, huesos, animaciones, texturas) y sus sonidos (silbido, golpes, carne) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |
| Posturas del jugador (male_anims.mdl: quieto, golpe y recarga de cada tipo de arma, con los dedos) y el punto de los ojos de male_02.mdl (adónde mira la cabeza) | Garry's Mod 10 / Half-Life 2 Deathmatch | ídem | rip: Garry's Mod 10 |
| La Tool Gun (v_toolgun y w_toolgun: mallas, huesos, animaciones, texturas) | Garry's Mod 10 (Facepunch Studios) | ídem | rip: Garry's Mod 10 |
| La Physics Gun (v_superphyscannon) y la Gravity Gun (v_physcannon), el modelo del mundo w_physics y sus sonidos (physcannon, physgun_off; el de la Tool Gun es airboat_gun_lastshot) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 / Garry's Mod 10 |
| Armas de Half-Life 2: pistola, .357, SMG, AR2, escopeta, ballesta, RPG y francotirador (v_ y w_: mallas, huesos, animaciones, texturas) y sus sonidos de disparo, recarga y vacío | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |
| Props de Half-Life 2: watermelon01, oildrum001 y oildrum001_explosive, wood_crate001a, cardboard_box001a, trafficcone001a, carparts_tire01a, cinderblock01a, pushcart01a, gascan001a, propane_tank001a, sawblade001a, radiator01a, furniturewashingmachine001a y trashdumpster01a (mallas y texturas) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem (archivo por archivo) | rip: Half-Life 2 |
| Sonidos de los personajes y del ambiente: pasos (player/footsteps: concrete, grass, dirt, sand, metal, wood, tile, gravel), voces de los ciudadanos (vo/npc/male01 y female01: pain, ow, hi, yeah, no, help, fantastic, ok), zombi (npc/zombie), robot (npc/scanner, npc/turret_floor) y ambientes (ambient/wind, ambient/atmosphere, ambient/levels/coast y canals, ambient/machines) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem (archivo por archivo) | rip: Half-Life 2 |
| Recipientes de agua: la cubeta y la tina (props_junk/MetalBucket01a y 02a) y las bañeras (props_interiors/BathTub01a, props_c17/FurnitureBathtub001a), con sus texturas; los sonidos del agua (water_splash, drip, lake_water, underwater, water_flow_loop1, los pasos en el agua wade1-8 y el ahogo pl_drown1-3) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |
| Contenido base para los addons de GMod (`web/rb/gm_lib.*`, se baja sólo lo que pide cada addon): brazos c_arms, armas c_/v_/w_ de HL2 y las versiones c_ de CS:S que trae GMod, las manos de CS:S (v_hands), munición y objetos (items), props de HL2 y PHX que piden los addons, sprites, efectos, partículas, estelas, íconos de la interfaz y sonidos (armas, objetos, botones, explosiones y los que piden los addons); texturas achicadas a 256/512 px, sin mapas de relieve | Garry's Mod 13 (Facepunch Studios) con contenido de Half-Life 2 (Valve): garrysmod_*.vpk, hl2_misc, hl2_textures, hl2_sound_misc | https://archive.org/download/garrys-mod_202605/Garrys-Mod.rar (archivo por archivo, sin ejecutar nada; herramientas/gmod_base.py) | rip: Garry's Mod / Half-Life 2 |
| El Lua de GMod (lua/includes, gamemodes/base y sandbox) estudiado para que la API sea igual: GetTracerShootPos de los efectos, weapon_base, base_anim | Garry's Mod 13 (Facepunch Studios) | ídem | rip: Garry's Mod (estudio; lo copiado está en gmod_prelude.js) |

Hecho acá (nuestro): el conversor (`gmod.py`), el horneado de las posturas a músculos (`gmod_posturas.mjs`), el agarre
(la mano que se cierra sobre el mango), los pesos de los dedos de los skins generados (`dedos_meshy.py`), los íconos y
fondos de carga de los mapas (capturas del juego).

## Emotes de captura de movimiento

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| 2175 movimientos (web/emotes/cmu/*.bin, convertidos con `herramientas/emote_bvh.py`) | CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), conversión BVH "Poser-friendly" de Bruce Hahne | https://archive.org/details/cmu-ecstasy-motion-bvh-poser-friendly-2012 | CMU: libre para cualquier uso; la conversión: dominio público (Public Domain Mark) |

## Personajes de series (Personajes)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Rick y Rick Prime (personajes, diseño) | Rick and Morty (Justin Roiland y Dan Harmon, Adult Swim) | imágenes de referencia de https://rickandmorty.fandom.com (sólo para generar el modelo; no van en el juego) | fan art: Rick and Morty |
| Finn y Jake (personajes, diseño) | Adventure Time (Pendleton Ward, Cartoon Network) | imágenes de referencia de https://adventuretime.fandom.com (ídem) | fan art: Adventure Time |
| Jeppy Jothers, Uncle Jeppy, Sunman, Filbus y The Boiled One (personajes, diseño) | Doctor Nowhere (Silas Orion, canal de YouTube Doctor Nowhere) | imágenes de referencia de https://doctor-nowhere-creatures.fandom.com (ídem) | fan art: Doctor Nowhere |
| V1 y V2 (personajes, diseño) | ULTRAKILL (Arsi "Hakita" Patala, New Blood Interactive) | imágenes de referencia de https://ultrakill.fandom.com (sólo para generar el modelo; no van en el juego) | fan art: ULTRAKILL |
| Bon y Sha (personajes, diseño) | The Walten Files (Martin Walls) | imágenes de referencia de https://the-walten-files-new.fandom.com (ídem) | fan art: The Walten Files |
| Alternate (personaje, diseño) | The Mandela Catalogue (Alex Kister) | generado desde la descripción (ídem) | fan art: The Mandela Catalogue |
| Partygoer y Bacteria (entidades, diseño) | The Backrooms (Kane Pixels y la wiki de la comunidad) | generados desde la descripción (ídem) | fan art: The Backrooms |

Los modelos 3D de esos (y los de Dragon Ball y los demás generados) se hicieron acá: imagen en pose T desde la
referencia → modelo 3D texturado y riggeado (Higgsfield, Meshy) → `skin_meshy.py` y `dedos_meshy.py`. The Boiled One
se generó con Tripo H3.1 (Meshy lo rechazaba) sin riggear y lo riggea `rig_flotante.py`; a Uncle Jeppy se le repintó la
cara desde su imagen con `cara_glb.py`.

Contenido base de Half-Life 2, sus episodios y Counter-Strike: Source que los addons de GMod dan por hecho (modelos,
materiales, texturas): no está en el repo ni en el HTML; el juego lo baja en el aparato de cada jugador, archivo por
archivo, del depósito 4021 del servidor dedicado de Garry's Mod (app 4020, que Steam da gratis y sin cuenta) y lo guarda
ahí (`juego/gmod_steam.js`). rip: Half-Life 2 / Counter-Strike: Source (Valve), vía el servidor dedicado de Garry's Mod.

Código de otros que va en el juego: fzstd (descompresor de Zstandard en JS, de Arjun Barrett, licencia MIT,
https://github.com/101arrowz/fzstd) dentro de `juego/gmod_pipe.js`, para los pedazos de los addons del Workshop.

Herramientas usadas al empaquetar (no van en el juego): pyfqmr (Fast Quadric Mesh Reduction, MIT) para los LOD de los personajes.

## Pad de memes (`juego/memes.js`)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Los 36 sonidos de memes (Vine boom, Bruh, Oof, tubo de metal, MLG, Emotional damage, Sus, Taco Bell, Huh, Wow, Bonk, Ba dum tss, trombón triste, error de XP, FBI open up, AUGH, momentos después, continuará, Yeet, gnomo, aldeano, Discord, grito Wilhelm, oh no no no, Rizz, Ete sech, Chupapi, Eso Tilín, pedo, correcto, incorrecto, aplausos, risas, grillos, dun dun dun, Nani), recortados a 7 s como mucho, nivelados y pasados a mono 48 kbps | subidos por la comunidad a myinstants.com (cada meme es de su autor original) | https://www.myinstants.com | rip: myinstants (memes de internet) |

## Celular, catapulta, bomba de Rick Prime y cámara (`juego/celular.js`, `juego/artefactos.js`)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Catapulta (base y brazo), trípode con cámara, la bomba y la bici con cohete (modelos 3D) | generados acá (imagen con gpt-image → 3D con Higgsfield), `prop_glb.py` | — | propios |
| La bomba de Rick Prime (diseño del aparato Omega) | Rick and Morty (Justin Roiland y Dan Harmon, Adult Swim) | referencia de https://rickandmorty.fandom.com (sólo para generar el modelo) | fan art: Rick and Morty |
| Idea del celular que pone cosas y de la catapulta | Simple Sandbox 2 y Simple Sandbox 3 (Tiny Lab Productions) | sólo la idea; nada copiado | — |
| Íconos de las apps del celular | hechos a mano (SVG) | `juego/celular.js` | propios |

## NPC con actitud y censura del chat (`juego/npc.js`, `juego/censura.js`)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| IA que arma la actitud de los NPC y revisa el chat | OVHcloud AI Endpoints (Llama 3.3 70B, Mistral Small, gpt-oss), LLM7 y Pollinations, sin clave, desde la conexión de cada jugador; o las claves propias de cada uno | https://endpoints.ai.cloud.ovh.net · https://llm7.io · https://pollinations.ai | servicios gratis (sus condiciones de uso) |
| Lista de palabras del filtro local | hecha acá | `juego/censura.js` | propia |

## Bombas nucleares (`juego/nucleares.js`, `herramientas/nucleares.json`, `herramientas/gmod.py`)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Modelos de las bombas (Little Boy, Fat Man, Gadget, Tsar Bomba, Ivy Mike, Castle Bravo, Mk-6, B61, Davy Crockett, proyectil atómico, Megatón, nuke espacial, ICBM, Taepodong, Scud, Tomahawk, V-2, EMP) | rip: HBOMBS Base Pack (Steam Workshop 668552230), con modelos de TheDoctor, Chappi, Failure y otros autores que el pack junta | Props → Nucleares | de cada autor; uso personal sin fines de lucro, como la guía de assets |
| Texturas de esos modelos | rip: HBOMBS Materials Pack (Steam Workshop 668558959) | Props → Nucleares | de cada autor; uso personal sin fines de lucro |
| Sonidos de las explosiones nucleares y las sirenas | rip: HBOMBS Base Pack (los de GBombs 5) | `NK_*` | de cada autor; uso personal sin fines de lucro |
| Catálogo (117 bombas y ensayos: nombre, país, año, potencia y tipo) | hecho acá con datos históricos públicos | `herramientas/nucleares.json` | propio |
| Bola de fuego, onda, hongo, radiación | hechos acá | `juego/nucleares.js` | propio |

(Lo extraído de los addons queda fuera del repo: se desarman con un script propio que sólo copia archivos —no corre
nada del addon— y `gmod.py` los lee de esa carpeta con `GM_EXTRA`.)

## Addons de Garry's Mod (Workshop)

Los addons no vienen en el juego: cada jugador los baja de Steam Workshop (o importa su .gma) cuando quiere usarlos, y
son de sus autores. Para analizar los formatos y probar se bajaron addons públicos que quedaron fuera del repo (no se
redistribuyen).

| Qué | De dónde | Dónde | Licencia |
|---|---|---|---|
| Lector de .gma, .mdl/.vvd/.vtx/.phy, .vtf/.vmt, .wav | hecho acá a partir de la documentación pública de los formatos de Source | `juego/gmod_formatos.js` | propio |
| Lua 5.1 (con lo que agrega GMod) | hecho acá | `juego/gmod_lua.js` | propio |
| API de Garry's Mod (nombres, constantes, weapon_base, bases de entidades, hooks del gamemode) | escrita de nuevo según la wiki pública de GMod (wiki.facepunch.com/gmod); sin copiar código | `juego/gmod_prelude.js`, `juego/gmod_api.js` | propio |
| Tienda GMod y puente del Workshop | hecho acá; datos de Steam (GetPublishedFileDetails y la página de búsqueda del Workshop) | `juego/gmod_tienda.js`, `tienda/worker.js` | propio |
| Catálogo del Workshop (nombres, fotos, tamaños, direcciones de archivo) | Steam Workshop, armado con `herramientas/gmod_catalogo.mjs` | `web/rb/gm_cat.*.bin` | datos públicos de Steam; cada addon es de su autor |
| Lectura de la página del Workshop sin puente propio | servicio público r.jina.ai (Jina AI Reader) | se usa en vivo, no se copia | servicio de terceros |
| Lista de celulares (modelo → código, chip, RAM) y puntaje de GPU por chip | armada a partir de datos públicos: lista de aparatos compatibles de Google Play (`supported_devices.csv`), fichas de GSMArena y sitios de las marcas; puntajes GFXBench Manhattan 3.0 de Notebookcheck | `juego/celulares.js` | datos públicos (sólo nombres, códigos y números) |

## Bibliotecas del navegador propio (`jxrt/`) — retiradas en la 2.9

El motor nativo con V8 (linkedom 0.18.15 de Andrea Giammarchi, licencia ISC, y Javet 6.0.3 de Sam Cao con el V8 de
Google, Apache-2.0 y BSD-3) salió de la app y del repositorio en la 2.9: el APK ya no las lleva.
