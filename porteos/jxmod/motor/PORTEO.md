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
| noche.js (la noche de FNAF en RB_Pizzeria: un modo de juego, no la luz de la noche) | ✘ | |
| vhs.js, vivo.js | — | (el VHS del evento de los 300 y los eventos en vivo, que son JavaScript firmado) |
| linterna.js | ◐ | nativo/jugabilidad.rs (sin el Lua de GMod ni la de los demás de la sala; en OpenGL 2, una luz donde pega) |
| puertas.js, mapaio.js | ✔ (sin avisarle a la sala) | juego/puertas.rs, nativo/mapas_juego.rs |
| portales.js | ◐ (se cruza; falta ver a través de la puerta) | juego/portales.rs |
| entidades.js (piano, radio, mega rampa… de los mapas de la comunidad y los mods) | ✘ | |
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
| nuclear_vol.js | ✘ | (el hongo con volumen necesita su sombreador en jxmotor: va con los carteles de nucleares.js) |
| celumano.js, celular.js, celulares.js | ✔ (los memes del celular sin sonido; la app de cámara espera la Camera nativa) | juego/celu_ik.rs, celu_pj.rs, celu_vista.rs, celulares.rs, nativo/celu_juego.rs |

## Multijugador
| web | estado | nativa |
|---|---|---|
| red.js, anfitrion.js | ✔ | juego/red.rs, mqtt.rs, nativo/red_juego.rs |
| censura.js | ✔ (la parte local; la IA no) | juego/censura.rs (58 de 58 mensajes iguales) |
| lan.js | ✔ (anfitrión: broker MQTT 3.1.1 por WebSocket en el 8765 y /lan.json; anuncio «JXMODLAN1» por UDP en el 8766; la lista de Buscar partida, entrar por ws://IP:8765/mqtt; el candado de multicast de Android. Compatible con las partidas de la web. No sirve la página del juego por HTTP como la web) | nativo/lan.rs, lan_juego.rs, tests/lan.rs |
| voz.js | ✘ | |
| social.js, cuenta.js, tiendared.js | ✘ | |

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
| smods.js, acciones.js | ✘ | |
| modapi.js (mods con código JS) | — | no hay JavaScript en la nativa |

## Menús e interfaz
| web | estado | nativa |
|---|---|---|
| hud.js, hudorden.js, ui.js | ◐ (el botón de pausa, el menú de pausa y la pantalla de carga; MOD al lado de la pausa) | comun.rs, nativo/pausa_juego.rs |
| inicio.js, clasico.js, paneles.js | ✔ (sin la mancha de tinta ni el deslizamiento de la marca amarilla de las pestañas) | nativo/inicio_juego.rs, paneles_juego.rs, pincel.rs |
| rbmenus.js, panel_juego.js | ◐ (salas y Personajes; el formulario de Crear server y el latido al panel, no) | nativo/paneles_juego.rs |
| deposito.js (el menú 3D alternativo), menu.js (la web lo arma pero no lo muestra) | ✘ | |
| controles.js, tutorial.js | ✘ | |
| idiomas.js, idiomas3.js | ✘ | (la nativa está en castellano) |
| iconos.js, novedades.js | ✔ | nativo/iconos.rs, paneles_juego.rs |
| musica.js, fondovideo.js, milogo.js, iconoapp.js | ✘ | (el fondo del inicio usa las fotos de las escenas, no el video) |
| camlibre.js | ✔ | nativo/jugabilidad.rs |
| banco.js, cajanegra.js | ✘ | |

## Lo demás
| web | estado | nativa |
|---|---|---|
| sonidos.js, audio.js | ◐ | nativo/sonido.rs |
| memes.js | ✔ (los míos, desde la carpeta memes/ de la app; sin el interruptor de silenciar los de los demás) | nativo/memes_juego.rs, celu_juego.rs (app Memes) |
| maquinitas.js, pantalla.js | ✘ | (juegos HTML y videos de YouTube) |
| animedit.js, creador.js, verity.js, veritycrea.js | ✘ | |
| grabar.js | ✘ | |
| vr.js, manos_jx.js | ✘ | |
| pepe_vuelve.js | ◐ | nativo/pepe_juego.rs (la cinta VHS, aproximada con el HUD: vhs.js no está) |
| evento.js | ✘ | |
| ev300*.js (evento terminado) | — | |
| ios.js, suelto.js, inflar.js | — | sólo de la web |
