# Porteo de la web (juego/*.js) a la app nativa en Rust

Pedido del dueño: «hasta que tengas todo calcado de la versión de Javascript en nuestro propio motor sin Javascript».
Cada archivo de la web y dónde quedó en la nativa (lo de jugabilidad.rs, una vez aplicado nativo/integrar_jugabilidad.py). ✔ hecho (comparado con la web), ◐ en parte, ✘ falta, — no aplica.

## Motor y mundo
| web | estado | nativa |
|---|---|---|
| nucleo.js, gl.js, post.js, sombras.js, cielos.js, geo.js, modelo.js | ✔ | jxmotor (Vulkan, GL3, GL2) |
| mundo.js, datos.js | ✔ (con los paquetes aparte que se bajan cuando hacen falta —rbBajar/rbAsegurar—: de web/rb de la rama, revisados con la huella del nombre, guardados en la app; la pantalla de carga espera el mapa y dice cuánto va; la biblioteca de GMod se baja la primera vez. La APK liviana: `--mapas base --gmod menu`, íconos en WebP) | juego/mundo.rs, paquete.rs, mapa.rs, nativo/bajas.rs |
| fisica.js, fisica_wasm.js | ✔ (detección 2–4× más rápida y solver por islas en hilos, exacta bit a bit) | juego/fisica.rs, fisica/ |
| agua.js | ✔ | juego/flotar.rs + motores |
| efectos.js, marcas.js | ✔ | juego/efectos.rs |
| dia.js | ✔ | juego/dia.rs, nativo/mapas_juego.rs (Ajustes → Día: la hora y el ciclo) |
| cielo3d.js | ✔ (la maqueta va con la niebla del mapa, no con la de su cámara) | nativo/mapas_juego.rs, jxmotor (FL_CIELO en los tres motores) |
| noche.js (la noche de FNAF en RB_Pizzeria: un modo de juego, no la luz de la noche) | — (el dueño lo sacó: la pizzería no está en la nativa; FNAF se juega con lo del Workshop) | |
| vhs.js, vivo.js | — | (el VHS del evento de los 300 y los eventos en vivo, que son JavaScript firmado) |
| linterna.js | ◐ | nativo/jugabilidad.rs (sin el Lua de GMod ni la de los demás de la sala; en OpenGL 2, una luz donde pega) |
| puertas.js, mapaio.js | ✔ (sin avisarle a la sala) | juego/puertas.rs, nativo/mapas_juego.rs |
| portales.js | ◐ (se cruza; falta ver a través de la puerta) | juego/portales.rs |
| entidades.js (piano, radio, mega rampa… de los mapas de la comunidad y los mods) | ◐ | radio (Props → Opciones → Radio: emisoras de Radio Browser por la tienda, volumen por oído según el lugar y las paredes); falta piano, mega rampa |
| gmod_bsp.js (mapas del Workshop) | ✔ (sin el contenido de HL2 que la web trae de Steam —gmod_steam.js— ni la luz por lugar de las manos) | juego/bsp.rs, nativo/mapas_juego.rs; prueba: examples/mapas_foto.rs |

## Jugador, personajes, NPC, vehículos
| web | estado | nativa |
|---|---|---|
| jugador.js, entrada.js | ✔ | juego/jugador.rs, comun.rs |
| personas.js, humano.js | ✔ | juego/personaje.rs, persona.rs, arma_mano.rs |
| npc.js | ✔ | juego/npc.rs, comun.rs (Actitud) |
| vehiculos.js | ✔ | juego/vehiculo.rs, personaje.rs (sentados) |
| gfxauto.js (calidad automática) | ✔ (la búsqueda, igual a la web en 400 de 400 casos; pide el refresco de la pantalla: 114 en una de 120 Hz) | juego/gfxauto.rs, nativo/gfx_juego.rs, ajustes.rs (Automático) |
| destruccion.js | ✔ | juego/destruccion.rs (comparado con la web en node), nativo/des_juego.rs |
| emotes.js | ◐ (los del juego, los de captura c: y rb:, en la red; falta la tienda y el editor de emotes) | comun.rs, juego/captura.rs, nativo/emotes_juego.rs |
| juntos.js, ruleta.js | ✔ | nativo/emotes_juego.rs |
| emomusica.js | ✘ | (usa YouTube) |
| patadas.js | ✔ | nativo/jugabilidad.rs |
| accesorios.js | ✔ (GLB, GLTF, OBJ y ZIP desde datos/importar; sin texturas JPEG) | nativo/accesorio.rs |
| gorros.js, identidad.js | ✔ (los 23 gorros y los tintes de las 12 skins iguales a la web) | juego/gorros.rs, geo.rs, identidad.rs, nativo/personajes.rs |
| gmod_pm.js | ✔ (el .mdl del addon en la pose del Hero: alineación, cadera escalada, IK de manos y pies, el arma en su mano, muñeco apoyado; los que no tienen esqueleto de Valve, con sus secuencias. Los números de gmpPreparar iguales a la web y los huesos a menos de 5 mm; sin la red: los demás te ven con el Hero) | nativo/gmod_pm.rs (comun.rs con integrar_gmod2.py), gmod/jugadores.rs (player_manager y las manos de cada modelo) |
| gmod_autorig.js | ✔ (las mismas cuentas que la web: los 23 huesos de una persona de prueba a menos de 0,002 pulgadas y los mismos pesos —tests/autorig.rs, con los números de la web en node—) | gmod/autorig.rs |
| pjimportar.js | ✘ | (importar GLB/OBJ/VRM con rig automático: necesita elegir un archivo) |

## Armas y herramientas
| web | estado | nativa |
|---|---|---|
| armas.js, armasjx.js, vista.js | ✔ | nativo/armas.rs, combate.rs, juego/vista.rs |
| herramientas.js | ✔ | nativo/herramientas.rs |
| armaaj.js | ✔ | nativo/personajes.rs |
| nucleares.js, artefactos.js, ciclope.js | ◐ | juego/nucleares.rs, nativo/nuk_juego.rs, cic_juego.rs (sin lo de la red) |
| nuclear_vol.js | ✔ | jxmotor/hongo.rs (el mismo sombreador y el mismo ruido 3D; OpenGL 3 y OpenGL 2 —el ruido en un mosaico 2D—; Vulkan y Patata, con los carteles), juego/nucleares.rs (nv_estado, probado contra la web) |
| celumano.js, celular.js, celulares.js | ✔ (los memes del celular sin sonido; la app de cámara espera la Camera nativa) | juego/celu_ik.rs, celu_pj.rs, celu_vista.rs, celulares.rs, nativo/celu_juego.rs |

## Multijugador
| web | estado | nativa |
|---|---|---|
| red.js, anfitrion.js | ✔ | juego/red.rs, mqtt.rs, nativo/red_juego.rs |
| censura.js | ✔ (la parte local; la IA no) | juego/censura.rs (58 de 58 mensajes iguales) |
| lan.js | ✔ (anfitrión: broker MQTT 3.1.1 por WebSocket en el 8765 y /lan.json; anuncio «JXMODLAN1» por UDP en el 8766; la lista de Buscar partida, entrar por ws://IP:8765/mqtt; el candado de multicast de Android. Compatible con las partidas de la web. No sirve la página del juego por HTTP como la web) | nativo/lan.rs, lan_juego.rs, tests/lan.rs |
| voz.js | ◐ | nativo/vozcerca.rs + Voz.java: voz por cercanía entre nativas por la red del juego (ADPCM 16 kHz, sólo mientras hablás y con alguien a menos de 70 m), sale desde la boca del que habla con el sonido espacial; botón al lado del chat, ficha de quién habla, Ajustes → Escuchar la voz de los demás. Con la web todavía no (la web usa WebRTC) |
| social.js, cuenta.js, tiendared.js | ◐ (la cuenta con Google en el navegador o con Gmail y el código; Chats con grupos, tildes, «escribiendo…» e invitaciones con Unirse; Amigos, solicitudes y bloqueados; Buscar por ID con recientes; Perfil; el latido y el aviso de mensaje nuevo; el freno de la tienda saturada. Falta copiar el progreso a la cuenta) | nativo/src/social_juego.rs |

## Addons de GMod
| web | estado | nativa |
|---|---|---|
| gmod_lua.js | ✔ | lua/ (jxlua) |
| gmod_api.js, gmod_prelude.js, gmod.js, gmod_cargar.js | ✔ | gmod/ (jxgmod) |
| gmod_carpeta.js, gmod_tienda.js, gmod_panel.js | ◐ | nativo/gmod_juego.rs |
| gmod_formatos.js, gmod_vista.js, gmod_anim.js, gmod_nextbot.js, gmod_sonidos.js | ◐ (las manos del modelo de jugador con su piel y sus cuerpos, sus huesos procedurales y sin las de las vistas que traen brazos; las piezas del SWEP Construction Kit en primera persona —VMatrix, EnableMatrix, GetBoneMatrix y ManipulateBone* de la vista, ViewModelDrawn—, con el campo visual de la vista como en GMod: la web las dibuja sin él y le salen 1/kf más chicas, 0,65 con la granada santa—; los bucles de sonido —.wav con «cue»/«smpl», CSoundPatch con volumen, tono y FadeOut, StopSound y canales—. Faltan las piezas en tercera persona —WElements: los huesos del jugador para el Lua—, .pcf) | gmod/formatos.rs, modelos.rs, sonidos.rs, nativo/gmod_modelos.rs |
| gmod_render.js, gmod_rt.js, gmod_dx9.js | ✘ | |
| gmod_lib.js | ✔ (la biblioteca va en la APK: se lee por rangos, sin bajar) | nativo/gmod_base.rs |
| gmod_spawn.js | ✔ (NPC del juego con el modelo de Source —también los SNPC y los de VJ Base—, un modelo como NPC o muñeco y los vehículos partidos en carrocería y ruedas, manejables: el árbol igual al de la web nodo por nodo; sin la cabina medida para sentarse) | nativo/gmod_spawn.rs, gmod_menu.rs |
| gmod_modos.js, gmod_server.js, gmod_pipe.js, gmod_steam.js, gmod_cola.js | ✘ | |
| gmod_personal.js (el menú de GMod de la personal) | ◐ (pestañas, spawnlists, íconos, listas del Lua de GMod; faltan emotes, packs del Workshop, búsqueda) | nativo/gmod_menu.rs, gmod_base.rs |
| pillpacks.js, pill_gmod.js | ◐ (los propios y los de los Pill Packs del Workshop —pk_pills—: el cuerpo, la vida, la velocidad, el salto, la cámara y las habilidades con la barra de poder; sin niveles, red ni ajustes) | nativo/gmod_pill.rs, gmod/pills.rs |
| nativos.js | ◐ | nativo/nat_juego.rs (sin lo de la red: que otro jugador te agarre) |
| modmenu.js | ◐ | nativo/jugabilidad.rs (el menú MOD y las Opciones de los mods nativos) |
| acciones.js (y las teclas de las armas de controles.js) | ✔ | nativo/teclas_mod.rs: con un arma de un addon en la mano se lee su Lua y el de sus bases (Gmod::fuentes_arma) y sus teclas (IN_*, KEY_*) pasan a hasta 4 botones en arco arriba del disparo, con el ícono de lo que hacen (la tabla de acciones.js sacada con herramientas/acciones_nativo.mjs → acciones_web.json); examples/teclas_mods.rs las lista para una carpeta de .gma |
| smods.js | ✘ | |
| modapi.js (mods con código JS) | — | no hay JavaScript en la nativa |

## Menús e interfaz
| web | estado | nativa |
|---|---|---|
| hud.js, hudorden.js, ui.js | ◐ (el HUD como la web: la disposición nueva de hudV2Pos —arriba a la izquierda los grupos del sistema y de crear sin huecos, arriba a la derecha el arma con sus balas, la cámara, los emotes, borrar, la cámara libre y la linterna, abajo a la derecha saltar, disparar y los demás—, los íconos de HUD_SVG pintados en Rust, los colores, apretado y prendido, la barra de armas en fila, la palanca quieta, la mira, el aviso y la vida; el botón de pausa, el menú de pausa y la pantalla de carga; el menú de objetos como el #spawn de la web —el panel negro, las pestañas con su ícono de color, el buscador, las categorías con su viñeta (verdes las de JXMod), las tarjetas de 84 px, las Opciones con su luz, Congelado y el inspector de Herramientas—. Falta: el panel de Ajustes de adentro del juego y el de los NPC con el estilo nuevo) | comun.rs, nativo/hud_web.rs, nativo/menu_objetos.rs, nativo/pausa_juego.rs |
| inicio.js, clasico.js, paneles.js | ✔ (sin la mancha de tinta ni el deslizamiento de la marca amarilla de las pestañas) | nativo/inicio_juego.rs, paneles_juego.rs, pincel.rs |
| rbmenus.js, panel_juego.js | ◐ (salas, Personajes y el formulario de Crear server —nombre, clave, modo Libre/PvP, PvP, RPG y nextbots, topes de props y autos, mapa base—, que crea el server y entra; el latido al panel, no) | nativo/paneles_juego.rs |
| deposito.js (el menú 3D alternativo), menu.js (la web lo arma pero no lo muestra) | ✘ | |
| controles.js | ◐ (Ajustes → Controles: el tamaño de los botones y el de la palanca, y el editor de los botones de la pantalla —arrastrar para moverlos, dos dedos o «−» y «+» para agrandarlos, a pie y en vehículo, de fábrica, cancelar y guardar en ajustes.txt—; lo que se movió no ocupa lugar en las columnas, como la web. Falta: la tienda de controles; las teclas no hacen falta en el celular) | nativo/hud_web.rs, nativo/ajustes.rs |
| tutorial.js | ✔ (los pasos de los botones que se ven: el velo con el hueco, el borde azul titilando y la tarjeta con Anterior, Siguiente y Saltear; sale solo la primera vez y se vuelve a ver desde la pausa; en castellano, como toda la nativa) | nativo/tutorial_juego.rs |
| idiomas.js, idiomas3.js | ✔ | `juego/src/idiomas.rs`: los mismos 14 idiomas (los textos de la web —idiomas.js, idiomas3.js, tutorial.js, social.js— con `herramientas/idiomas_nativo.mjs`, más 190 propios de la nativa en `idiomas_nativo.tsv`); las letras de dibujo traducen solas cada texto; japonés, tailandés, árabe (unido y de derecha a izquierda) y cirílico con letras de respaldo en los atlas (`herramientas/letras_extra.py`); se elige en Inicio → Idioma y si no, el del celular |
| iconos.js, novedades.js | ✔ | nativo/iconos.rs, paneles_juego.rs |
| musica.js | ◐ | nativo/musica_juego.rs: la estación Casual (los 35 de Kevin MacLeod del paquete a_musica, que se baja una vez y suena sin internet), mezclada y en bucle en el menú, con fundido al jugar, sigue donde iba y la placa de lo que suena con su crédito; se apaga en Opciones → Sonido → Música del menú (las otras estaciones son de YouTube y Mi música pide elegir archivos: no están) |
| fondovideo.js, milogo.js, iconoapp.js | ✘ | (el fondo del inicio usa las fotos de las escenas, no el video) |
| camlibre.js | ✔ | nativo/jugabilidad.rs |
| cajanegra.js | ✔ | nativo/caja_negra.rs: el latido de cada cuadro y los pasos riesgosos (abrir un motor, armar un mapa, montar un addon); si pasan 10 s sin cuadros con la app a la vista queda escrito trabado.txt y la próxima vez que abre se muestra, como los errores (que ahora también llevan lo último que hacía) |
| banco.js | ✔ | nativo/banco_juego.rs (Opciones → Motor → Comparar los motores): cada motor —Vulkan, OpenGL 3, OpenGL 2— se abre en la misma ventana, 3 s para asentarse y 12 s midiendo con la cámara dando una vuelta, con la calidad elegida (Alto si es Automático) y sin la resolución dinámica; vuelve al de antes y muestra la tabla con «Usar» el más rápido |

## Lo demás
| web | estado | nativa |
|---|---|---|
| sonidos.js, audio.js | ◐ | nativo/sonido.rs + acustica.rs: sonido espacial (24 ambientes medidos con rayos, eco, reverberación, paredes que tapan, bajo el agua) |
| memes.js | ✔ (los míos, desde la carpeta memes/ de la app; sin el interruptor de silenciar los de los demás) | nativo/memes_juego.rs, celu_juego.rs (app Memes) |
| maquinitas.js, pantalla.js | ◐ | tele: el objeto «TV» se usa y pasa YouTube (reproductor oficial encima de la pantalla, sigue a la cámara y se esconde tapado/lejos); maquinitas después |
| animedit.js, creador.js, verity.js, veritycrea.js | ✘ | |
| grabar.js | ✘ | |
| vr.js, manos_jx.js | ✘ | |
| pepe_vuelve.js | ◐ | nativo/pepe_juego.rs (la cinta VHS, aproximada con el HUD: vhs.js no está) |
| evento.js | ◐ (la grieta en el cielo de los mapas del juego —la misma forma, las vetas y el resplandor horneados igual que la web, píxel a píxel, con el tono de la web sobre el cielo del juego— en el pase del cielo del motor, y las caídas: de 1 a 6 cada 100 a 260 s, con estela de fuego y humo, luz, silbido, golpe con polvo y temblor, la cosa de verdad o la explosión, las 12 últimas. Falta: el pulso que corre por las vetas y el parpadeo de las líneas —quedan quietos—, y en una sala no caen: el reparto por la red no está) | nativo/grieta_juego.rs |
| ev300*.js (evento terminado) | — | |
| ios.js, suelto.js, inflar.js | — | sólo de la web |

## Mapas propios con las texturas de GMod (nativa)

`nativo/src/mapas_jx.rs`: mapas armados en código con los materiales de HL2/GMod de la biblioteca (`gm_material`), UV en metros como Hammer, todo choca, cielo pintado y luz como los del Workshop. JX_Plaza: dos calles en cruz con veredas, plaza de baldosas con tarima de cuadros y bancos, cinco edificios (fachadas de HL2, puerta, interior de revoque y baldosas), un galpón de chapa con cajas, rampas de madera, un caño de concreto y paredes de roca alrededor. Necesita la biblioteca de GMod (se baja antes, como los mapas del Workshop).
