# Porteo de la web (juego/*.js) a la app nativa en Rust

Pedido del dueño: «hasta que tengas todo calcado de la versión de Javascript en nuestro propio motor sin Javascript».
Cada archivo de la web y dónde quedó en la nativa. ✔ hecho (comparado con la web), ◐ en parte, ✘ falta, — no aplica.

## Motor y mundo
| web | estado | nativa |
|---|---|---|
| nucleo.js, gl.js, post.js, sombras.js, cielos.js, geo.js, modelo.js | ✔ | jxmotor (Vulkan, GL3, GL2) |
| mundo.js, datos.js | ✔ | juego/mundo.rs, paquete.rs, mapa.rs |
| fisica.js, fisica_wasm.js | ✔ (optimizándose) | juego/fisica.rs, fisica/ |
| agua.js | ✔ | juego/flotar.rs + motores |
| efectos.js, marcas.js | ✔ | juego/efectos.rs |
| dia.js, noche.js, cielo3d.js, vhs.js, vivo.js | ✘ | |
| linterna.js | ✘ | |
| puertas.js, mapaio.js, portales.js, entidades.js | ✘ | |
| gmod_bsp.js (mapas del Workshop) | ✘ | |

## Jugador, personajes, NPC, vehículos
| web | estado | nativa |
|---|---|---|
| jugador.js, entrada.js | ✔ | juego/jugador.rs, comun.rs |
| personas.js, humano.js | ✔ | juego/personaje.rs, persona.rs, arma_mano.rs |
| npc.js | ✔ | juego/npc.rs, comun.rs (Actitud) |
| vehiculos.js, gfxauto.js | ◐ | juego/vehiculo.rs, personaje.rs (sentados; sin la calidad automática) |
| destruccion.js | ✘ | (abolladuras, piezas, humo, fuego de los autos) |
| emotes.js | ◐ | comun.rs (los del juego, en la red; faltan los de captura, los tuyos y los rb:) |
| juntos.js, ruleta.js, emomusica.js, patadas.js | ✘ | |
| accesorios.js, gorros.js, identidad.js | ✘ | |
| pjimportar.js, gmod_autorig.js, gmod_pm.js | ✘ | |

## Armas y herramientas
| web | estado | nativa |
|---|---|---|
| armas.js, armasjx.js, vista.js | ✔ | nativo/armas.rs, combate.rs, juego/vista.rs |
| herramientas.js | ✔ | nativo/herramientas.rs |
| armaaj.js | ✘ | |
| nucleares.js, nuclear_vol.js, artefactos.js, ciclope.js | ✘ | |
| celumano.js, celular.js, celulares.js | ✘ | |

## Multijugador
| web | estado | nativa |
|---|---|---|
| red.js, anfitrion.js | ✔ | juego/red.rs, mqtt.rs, nativo/red_juego.rs |
| censura.js | ✔ (la parte local; la IA no) | juego/censura.rs (58 de 58 mensajes iguales) |
| lan.js | ✘ | |
| voz.js | ✘ | |
| social.js, cuenta.js, tiendared.js | ✘ | |

## Addons de GMod
| web | estado | nativa |
|---|---|---|
| gmod_lua.js | ✔ | lua/ (jxlua) |
| gmod_api.js, gmod_prelude.js, gmod.js, gmod_cargar.js | ✔ | gmod/ (jxgmod) |
| gmod_carpeta.js, gmod_tienda.js, gmod_panel.js | ◐ | nativo/gmod_juego.rs |
| gmod_formatos.js, gmod_vista.js, gmod_anim.js, gmod_nextbot.js, gmod_sonidos.js | ◐ (con las manos c_arms; faltan elementos del SWEP Construction Kit, bodygroups, bucles de sonido, .pcf) | gmod/formatos.rs, modelos.rs, sonidos.rs, nativo/gmod_modelos.rs |
| gmod_render.js, gmod_rt.js, gmod_dx9.js | ✘ | |
| gmod_lib.js | ✔ (la biblioteca va en la APK: se lee por rangos, sin bajar) | nativo/gmod_base.rs |
| gmod_spawn.js | ◐ (los NPC y vehículos de list.Set se ponen con su clase y su modelo; falta hacerlos NPC del juego y autos manejables) | nativo/gmod_menu.rs |
| gmod_modos.js, gmod_server.js, gmod_pipe.js, gmod_steam.js, gmod_cola.js | ✘ | |
| gmod_personal.js (el menú de GMod de la personal) | ◐ (pestañas, spawnlists, íconos, listas del Lua de GMod; faltan emotes, packs del Workshop, búsqueda) | nativo/gmod_menu.rs, gmod_base.rs |
| pillpacks.js, pill_gmod.js | ✘ | |
| nativos.js, smods.js, modmenu.js, acciones.js | ✘ | |
| modapi.js (mods con código JS) | — | no hay JavaScript en la nativa |

## Menús e interfaz
| web | estado | nativa |
|---|---|---|
| hud.js, hudorden.js, ui.js | ◐ | comun.rs (botones, vida, armas, menús) |
| inicio.js, paneles.js, clasico.js, deposito.js, rbmenus.js, menu.js, panel_juego.js | ✘ | |
| controles.js, tutorial.js | ✘ | |
| idiomas.js, idiomas3.js | ✘ | (la nativa está en castellano) |
| musica.js, fondovideo.js, milogo.js, iconoapp.js, iconos.js, novedades.js | ✘ | |
| camlibre.js | ✘ | |
| banco.js, cajanegra.js | ✘ | |

## Lo demás
| web | estado | nativa |
|---|---|---|
| sonidos.js, audio.js | ◐ | nativo/sonido.rs |
| memes.js, maquinitas.js, pantalla.js | ✘ | |
| animedit.js, creador.js, verity.js, veritycrea.js | ✘ | |
| grabar.js | ✘ | |
| vr.js, manos_jx.js | ✘ | |
| pepe_vuelve.js, evento.js | ✘ | |
| ev300*.js (evento terminado) | — | |
| ios.js, suelto.js, inflar.js | — | sólo de la web |
