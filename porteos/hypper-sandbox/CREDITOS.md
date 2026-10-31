# Créditos de assets

RezoBox es `uso: sin fines de lucro` (ver `CLAUDE.md`). Lo extraído de otros juegos y addons no está en el repo: los
scripts de `herramientas/` lo leen de afuera y va sólo dentro del HTML armado.

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
| Mapas gm_construct y gm_flatgrass (geometría, texturas, props, cielos) | Garry's Mod 10 (Facepunch Studios) con contenido de Half-Life 2 (Valve) | https://archive.org/download/garrys-mod-10/Garrys_Mod_10.rar | rip: Garry's Mod 10 / Half-Life 2 |
| La palanca: v_crowbar y w_crowbar (mallas, huesos, animaciones, texturas) y sus sonidos (silbido, golpes, carne) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |
| Posturas del jugador (male_anims.mdl: quieto, golpe y recarga de cada tipo de arma, con los dedos) y el punto de los ojos de male_02.mdl (adónde mira la cabeza) | Garry's Mod 10 / Half-Life 2 Deathmatch | ídem | rip: Garry's Mod 10 |
| La Tool Gun (v_toolgun y w_toolgun: mallas, huesos, animaciones, texturas) | Garry's Mod 10 (Facepunch Studios) | ídem | rip: Garry's Mod 10 |
| La Physics Gun (v_superphyscannon) y la Gravity Gun (v_physcannon), el modelo del mundo w_physics y sus sonidos (physcannon, physgun_off; el de la Tool Gun es airboat_gun_lastshot) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 / Garry's Mod 10 |
| Armas de Half-Life 2: pistola, .357, SMG, AR2, escopeta, ballesta, RPG y francotirador (v_ y w_: mallas, huesos, animaciones, texturas) y sus sonidos de disparo, recarga y vacío | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |
| Recipientes de agua: la cubeta y la tina (props_junk/MetalBucket01a y 02a) y las bañeras (props_interiors/BathTub01a, props_c17/FurnitureBathtub001a), con sus texturas; los sonidos del agua (water_splash, drip, lake_water, underwater, water_flow_loop1, los pasos en el agua wade1-8 y el ahogo pl_drown1-3) | Half-Life 2 (Valve), en Garry's Mod 10 | ídem | rip: Half-Life 2 |

Hecho acá (nuestro): el conversor (`gmod.py`), el horneado de las posturas a músculos (`gmod_posturas.mjs`), el agarre
(la mano que se cierra sobre el mango), los pesos de los dedos de los skins generados (`dedos_meshy.py`), los íconos y
fondos de carga de los mapas (capturas del juego).

## Emotes de captura de movimiento

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| 2175 movimientos (hypper/emotes/cmu/*.bin, convertidos con `herramientas/emote_bvh.py`) | CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), conversión BVH "Poser-friendly" de Bruce Hahne | https://archive.org/details/cmu-ecstasy-motion-bvh-poser-friendly-2012 | CMU: libre para cualquier uso; la conversión: dominio público (Public Domain Mark) |

## Personajes de series (Personajes)

| Asset | Autor / origen | Dónde | Licencia |
|---|---|---|---|
| Rick y Rick Prime (personajes, diseño) | Rick and Morty (Justin Roiland y Dan Harmon, Adult Swim) | imágenes de referencia de https://rickandmorty.fandom.com (sólo para generar el modelo; no van en el juego) | fan art: Rick and Morty |
| Finn y Jake (personajes, diseño) | Adventure Time (Pendleton Ward, Cartoon Network) | imágenes de referencia de https://adventuretime.fandom.com (ídem) | fan art: Adventure Time |
| Jeppy Jothers, Uncle Jeppy, Sunman, Filbus y The Boiled One (personajes, diseño) | Doctor Nowhere (Silas Orion, canal de YouTube Doctor Nowhere) | imágenes de referencia de https://doctor-nowhere-creatures.fandom.com (ídem) | fan art: Doctor Nowhere |

Los modelos 3D de esos (y los de Dragon Ball y los demás generados) se hicieron acá: imagen en pose T desde la
referencia → modelo 3D texturado y riggeado (Higgsfield, Meshy) → `skin_meshy.py` y `dedos_meshy.py`. The Boiled One
se generó con Tripo H3.1 (Meshy lo rechazaba) sin riggear y lo riggea `rig_flotante.py`; a Uncle Jeppy se le repintó la
cara desde su imagen con `cara_glb.py`.

Herramientas usadas al empaquetar (no van en el juego): pyfqmr (Fast Quadric Mesh Reduction, MIT) para los LOD de los personajes.
