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
2. **La app de Android sin WebView (hecha con OpenGL 3; faltan Vulkan propio y OpenGL 2)**: `motor/nativo/` es
   `libjxmod.so` (NativeActivity, `android-activity`): la ventana con EGL y OpenGL ES 3 (`jxmotor::gpu`), los archivos de
   la APK, la palanca a la izquierda y mirar arrastrando a la derecha, el HUD (atlas DejaVu Sans Bold de
   `herramientas/atlas_letras.py`: letras, discos, aros y cajas redondeadas en la pasada de interfaz del motor), el cartel
   de «Cargando…», los botones de los tres motores (el elegido se guarda en `motor.txt`) y el de cambiar de mapa, la
   pantalla a 120 Hz (`ANativeWindow_setFrameRate`) y los errores en la pantalla (si se cierra, la vez siguiente lo
   muestra). La única clase Java es `apk/nativo/src/.../Juego.java` (la pantalla completa sin barras, que Android pide
   desde su hilo de la interfaz). Todo el juego está en `comun.rs`, igual en el teléfono y en la compu.
   - Compilar: `motor/armar_nativo.sh` (arm64 y armv7, páginas de 16 KB) y
     `python3 -I apk/armar_nativo.py SALIDA.apk --www <carpeta con pk.bin sin cifrar, pk.idx.json y rb/>`.
   - Probar en la compu: `cargo build --release -p jxmod-nativo --example foto` y `foto CARPETA [ANCHO ALTO]` (el mismo
     juego fuera de pantalla con Mesa, toques de mentira y una foto de cada momento).
3. El jugador y los choques con el mapa; la física completa.
4. Objetos de GMod, Physics Gun, Gravity Gun, Tool Gun.
5. NPC y animación.
6. Menús y HUD.
7. Armas, vehículos, agua, efectos, sonido.
8. El Lua de GMod y su API (mods), la red.
