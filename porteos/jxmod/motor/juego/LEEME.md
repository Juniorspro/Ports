# JXMod nativo (jxjuego)

El juego en Rust para la APK, sin WebView ni JS ni WebGL. La versión web sigue con su propio código (JS + WebGL) y el
mismo contenido y jugabilidad. Lee **el mismo paquete** que arma `armar.py` para la web (`pk.bin` y su índice
`pk.idx.json`, más los paquetes aparte `rb/*.rbp` de los mapas y personajes).

## Etapas

1. **Paquete y mapas (hecho)**: `paquete.rs` abre el paquete (datos y mallas en gzip, índices en zigzag por planos como
   `desfiltrarIndices`, texturas WebP dadas vuelta y achicadas como las mandaba el JS, paquetes `RBP1`); `mapa.rs` arma un
   mapa como `cargarMapa`/`Modelo`/`matGL`: mallas, materiales, texturas, el cielo «painted» de GMod, el sol, la luz del
   cielo y del suelo, la niebla de Source y las luces del mapa (las 6 más cercanas por cuadro, como `lucesPreparar`).
   - Verificado contra lo que mandaba el JS al motor, con la misma cámara: `RB_Flatgrass` y `RB_Construct` dan **la misma
     imagen píxel por píxel**, y la luz, la niebla y las luces iguales al último decimal
     (`JXM_WGPU=1 JXM_PAQ=<www> JXM_MAPA=RB_Construct jxm-banco ref.jxg salida.png`).
2. La app de Android sin WebView: ventana, controles táctiles, cámara, motores **Vulkan**, **OpenGL 3** y **OpenGL 2**.
3. El jugador y los choques con el mapa; la física completa.
4. Objetos de GMod, Physics Gun, Gravity Gun, Tool Gun.
5. NPC y animación.
6. Menús y HUD.
7. Armas, vehículos, agua, efectos, sonido.
8. El Lua de GMod y su API (mods), la red.
