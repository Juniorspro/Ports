# JX Motor (porteos/jxmod/motor)

El motor nativo de JXMod en Rust, para que la versión personal ande con gráficos altos —sombras y reflejos— en un
celular de 1 GB. Pedido del dueño: «el porteo a un motor de Android en Rust… gráficos altos, sombras incluso reflejos en
un dispositivo de 1 GB de RAM».

## Ahora: la app 100 % nativa (`nativo/`, com.jxmod.nativo)

El juego entero en Rust, sin WebView ni JavaScript (NativeActivity): lo mismo que la web en contenido y en cómo se
juega, con otro código y otro motor. Pedido del dueño: «que rust sea el motor definitivo… en "motores" habrán 3
opciones, vulkan, opengl 3 y Opengl 2 para dispositivos antiguos» y «la web y la nativa deben ser iguales en contenido y
jugabilidad». Cada parte se porta de la web y se compara con ella corriendo la web de verdad en Node (las cuentas
iguales hasta el último bit cuando se puede, o a menos de un milímetro).

Los crates:
- `jxmotor`: los tres motores —Vulkan (ash, WGSL → SPIR-V con naga), OpenGL ES 3 y OpenGL ES 2 (lo que tiene huesos se
  deforma en la CPU: ES 2 no tiene uniformes para 56 huesos)—, con la pintura de dos tonos de las armas de JXMod.
- `juego` (jxjuego): el mapa, el jugador, la física (`fisica.rs` con el solver de `fisica/`, el mismo de la web),
  objetos, personajes (animación, nado, armas en la mano, sentados en los autos: `personaje.rs`, `arma_mano.rs`), NPC con
  su IA y actitudes, vehículos y botes, agua, efectos, la vista del arma y el multijugador (`red.rs`, el protocolo de
  red.js, y `mqtt.rs`).
- `lua` (jxlua): el Lua de GMod (el de `gmod_lua.js`), una máquina de registros; `gmod` (jxgmod): la API de GMod
  (`gmod_api.js`, el preludio, la carga de addons) sobre jxlua, hablando con el juego por el trait `Anfitrion`.
- `nativo`: la app. `comun.rs` es el juego (tacto, botones, menús, HUD) y sus hijos: `herramientas.rs` (Tool Gun),
  `combate.rs` (armas), `red_juego.rs` (salas, los demás jugadores y sus cosas, chat), `gmod_juego.rs` (los addons, su HUD,
  el panel Mods y la tienda); `ajustes.rs`, `armas.rs`, `sonido.rs` (AAudio y MediaCodec), `red_android.rs` (TLS, HTTPS y
  el cuadro para escribir de `Juego.java`, por JNI) y `app.rs` (Android).

Probar sin celular (Mesa, llvmpipe): `CARGO_TARGET_DIR=/tmp/claude-0/jxm_target cargo build --release --offline -p
jxmod-nativo --example foto` y `JXM_WWW=<www> JXM_LETRAS=<letras> …/examples/foto <carpeta> 1280 590` recorre todo con
fotos (`JXM_MOTOR=vk|gl2` para los otros motores). Modos: `JXM_RED=1` (el multijugador contra un broker MQTT local, con
otro jugador que camina, habla, pone cosas y tiene un NPC), `JXM_CARGA=1` (500 objetos y 50 NPC: lo que tarda cada
parte), `JXM_MAPAS_FOTO=1`, `JXM_SOLO_AUTO=1`; los addons con `--example gmod_foto` (`JXM_ADDONS=<carpeta>`).
La APK: `motor/armar_nativo.sh` y `python3 -I apk/armar_nativo.py <salida.apk> --www <www> --version-name X --version-code N`.

## Por qué empieza por el dibujo (medido)

Con el procesador frenado ×6 (`Emulation.setCPUThrottlingRate`, como un celular flojo), en gm_construct con 12 props, 4
NPCs y el Jeep, Alto:

- la lógica del juego (física, NPCs, Lua, vehículos) usa **menos del 5 %** del cuadro;
- el hilo del juego pasa el **72 %** esperando a que se termine de dibujar;
- el juego ocupa **402 MB** de memoria de JavaScript.

O sea: lo que traba en un celular flojo es dibujar (y la memoria), no el JavaScript. Pasar la lógica a Rust casi no
cambia nada; el dibujo nativo sí.

## Etapas

1. **Hecha: el dibujo.** `jxmotor` dibuja con GLES 3.0 lo que el juego tiene listo para la placa: las mallas tal como
   están en el paquete (posición en 16 bits, normal en 8, UV en media precisión, la UV de la luz horneada y los huesos),
   materiales, texturas, luz horneada de Source, el sol, la niebla y el agua de HL2. Tiene:
   - la luz del juego: sol con sombra (corrida por la normal, sin acné ni sombras despegadas), cielo y suelo, luz
     horneada, luces puntuales y especiales (linternas), niebla y ACES;
   - los personajes con huesos (la piel en la placa, 56 huesos, como WebGL);
   - las texturas mezcladas por vértice de los displacements de Source y el terreno con control y tres capas;
   - el agua de HL2: su mapa de normales en dos capas, Fresnel, reflejo de la escena y lo turbio por lo hondo;
   - recorte por la esfera de cada cosa para la cámara, la sombra y el reflejo;
   - resolución dinámica: la escena a una fracción de la pantalla y estirada al final, y la sombra y el reflejo rehechos
     cada tantos cuadros (perfil `celular_flojo`).
2. **Hecha: adentro de la APK personal** (Ajustes → Motor gráfico → «Rust (JX Motor)»; si no se puede, dice por qué).
   Celulares ARM de 64 bits (`arm64-v8a`) y de 32 (`armeabi-v7a`: muchos de 1 GB traen Android Go de 32 bits), con GLES 3.
   - `android/` arma `libjxmotor.so` (va en `assets/jxmotor/arm64-v8a/` y `assets/jxmotor/armeabi-v7a/` —la del proceso,
     `Process.is64Bit`—, se carga con `System.load` como JX Hand): un
     hilo propio con EGL que dibuja en una `SurfaceView` atrás del WebView, que queda transparente
     (`apk/web/src/com/jxmod/app/MotorJX.java` y `MotorNativo.java`; JNI mínima por número, sin dependencias).
   - El juego (`juego/gmod_personal.js`, `jxmCuadroNativo`) manda por la puerta `JXMotor` sólo lo nuevo —mallas,
     texturas (leídas de WebGL hasta 256 px, 512 en Alto y Ultra, y borradas de WebGL después: no ocupan memoria dos
     veces), materiales (con un número nuevo si cambian), luces horneadas y el agua— y cada cuadro la cámara, la luz y
     todo lo que hay que dibujar con su matriz, su esfera y sus huesos (una vez por personaje). El motor recorta solo
     para la cámara, la sombra y el reflejo. Lo que llega mientras dibuja se saltea: siempre el cuadro más nuevo.
   - WebGL ya no dibuja el mundo (ni sombras, ni reflejo, ni lo opaco, ni lo transparente, ni el posprocesado): sólo el
     arma en la mano, los efectos, lo que dibuja el Lua y las líneas, sobre fondo transparente (`jxmAlfa`: alfa 1 donde
     quedó algo dibujado). Las estadísticas del motor salen en el contador de cuadros.
3. **Hecha: lo mismo que WebGL en Alto.** El sombreado de `gl.js` portado (luz en lineal, BRDF con la rugosidad y el metal
   de cada material, reflejo del cielo, follaje, niebla con el sol), el cielo del mapa (degradé y la caja de GMod),
   oclusión ambiental a media resolución, el retoque final de `post.js` (color, contraste, viñeta), las partículas (con
   instancias: 16 números por partícula) y las marcas de frenada, y las mallas que arma el juego (`mallaPropia`: el rayo
   de la Physics Gun, accesorios, entidades). Lo que dibuja el motor ya no ocupa memoria en WebGL: las mallas se suben
   a WebGL recién si WebGL las dibuja y las texturas se borran de WebGL al pasarlas.
4. Después: los rayos y líneas, las nucleares y lo que dibuja el Lua de los addons (siguen en WebGL, encima), autos
   abollados y el agua de los recipientes, portales, el cielo 3D de los mapas del Workshop, la sombra de la linterna,
   el resplandor (bloom), texturas comprimidas (ETC2) y, más adelante, la física y la lógica.

#### La física en Rust (`fisica/`, WebAssembly)

El bucle de subpasos de `physStep` (`juego/fisica.js`: integrar, uniones con cono, torsión y bisagra, contactos con
fricción, velocidades y rebote, 12 subpasos por paso) corre en Rust con las mismas cuentas y en el mismo orden; la
detección de choques sigue en JavaScript. Los cuerpos, contactos y uniones viajan en arreglos de números (28, 24 y 36
por cada uno). `./armar_fisica.sh` deja el módulo (45 KB) en `juego/fisica_wasm.js`, que `armar.py` mete antes de
`fisica.js`. En la versión personal va de entrada; en la pública sólo con `PREFS.fisicaRust` (`?fisjs=1` lo apaga).

Medido con la misma escena (16 cajas cayendo, una pila de 6 y 6 tambores; 240 pasos con el juego quieto): las
posiciones finales iguales a las de JS (mediana 0,000 m, media 1,2 cm; la pila idéntica, los mismos 16 dormidos); el
solver de ~0,4 a 0,17 ms por paso y el paso entero de 1,18 a 1,04 ms. Lo que queda en JS es la detección (~0,85 ms):
es lo siguiente para pasar.

Si el motor nativo falla en un celular (dice «error» o no dibuja en 6 s), el juego lo apaga solo, vuelve a WebGL y
avisa el motivo.

## Protocolo (lo mismo por JNI y en las grabaciones del banco)

- Recursos `JXE1`: `'JXE1'`, u32 con el largo del JSON, el JSON (`mallas`, `mats`, `texs`, `lms`, `agua`, cada uno con
  su `id` del juego) y los bloques de datos alineados a 4.
- Cuadro `JXC1` (floats): `'JXC1'`, cuántas cosas, vp(16), posición, sol, color del sol, cielo, suelo, niebla (color,
  desde, hasta), exposición, altura del agua (NaN: sin agua), tiempo, luces puntuales, luces especiales, cuánto tapa la
  niebla como máximo, el sol en la niebla (3) —la luz en lineal, la de WebGL en Alto—, 12 floats por luz, y por cosa: malla, desde, cuántos, material, matriz(16), esfera(4), banderas (1: no hace sombra), cuántos floats
  de huesos (negativo: los de la cosa número −n−1) y los huesos; después, bloques de efectos (tipo, cuántos floats y los
  floats): 1 partículas con alfa y 2 que suman (la derecha y el arriba de la cámara y 16 floats por partícula), 3 las
  marcas de frenada (7 floats por vértice, sólo cuando cambian).
- Grabación `JXG1` (`jxmGrabar()` en el navegador): `'JXG1'` y los pedazos (`R` recursos, `C` cuadro, `V` vaciar, `Q`
  quitar), cada uno con su tipo, u32 con el largo y los bytes.

## Banco de pruebas (sin ventana, con Mesa)

```
CARGO_TARGET_DIR=/tmp/claude-0/jxm_target cargo build --release -p jxm-banco
jxm-banco ESCENA.jxe SALIDA.png 1280 720 40 alto,celular,sin
```

Exportar un cuadro del juego: en la versión personal, `await jxmCapturar(256)` devuelve un JXE1 con cámara; o
`jxmGrabar(); jxmPoner(true)` graba lo que el juego le manda al motor (`JXM.grab.juntar()` da la grabación JXG1).

### Medido (la misma máquina; las placas son por software: SwiftShader en Chromium y llvmpipe de Mesa)

Una foto del juego (gm_construct mirando el lago con el Airboat y 8 props):

| | resolución | sombras | reflejo | cuadros/s |
|---|---|---|---|---|
| Juego actual (WebGL, Alto) | 768×432 | sí | 1/3 | **4,0** |
| JX Motor, perfil Alto | 1280×720 | 2048, cada cuadro | 1/2, cada cuadro | **27** |
| JX Motor, perfil celular flojo | 1280×720 (escena a 2/3) | 1024, cada 2 | 1/4, cada 2 | **58** |

En vivo (modo nativo, el juego en el navegador grabando lo que manda), gm_construct en Alto:

| escena | WebGL dibujando todo | el juego con JX Motor (WebGL sólo lo de encima) | JX Motor dibujando lo grabado (Alto / celular) | cada cuadro |
|---|---|---|---|---|
| el lago, Airboat y 6 props | 4,3 cuadros/s | **46 cuadros/s** | 25 / 56 cuadros/s | 11 KB |
| 4 NPCs (con huesos) y un barril | 2,7–3,3 cuadros/s | **41–49 cuadros/s** | 20–24 / 32 cuadros/s | 24 KB |

Al entrar al mapa se mandan una vez 9–11 MB de recursos (texturas a 256 px; 35 MB a 512 px en Alto). La misma imagen
en los dos (el juego quieto): la geometría, los personajes y sus poses coinciden; falta la oclusión ambiental (WebGL
oscurece lo pegado a las paredes) y el cielo de GMod (el motor usa un degradé).

## wgpu (Vulkan)

`jxmotor/src/wg.rs` es el mismo motor sobre **wgpu**: Vulkan en Android (GLES de respaldo en los celulares sin Vulkan) y,
en la compu, el Vulkan de Mesa (lavapipe) para el banco. Los sombreadores están en WGSL (`wgsl.rs`), portados de los de
GLES uno por uno; la entrada (recursos JXE1, cuadros JXC2, grabaciones JXG1) es la misma (`proto::Dibujante`).

- Cada cuadro arma primero todo lo que va a la placa: la cabecera de cada pasada (cámara, reflejo, sombra), un registro por
  malla y material, las matrices de las copias (instancias para todo) y los huesos de cada personaje una sola vez; lo sube
  en pocas escrituras y después dibuja.
- Los vértices se reacomodan al cargarlos (14 → 16 bytes: la placa los quiere de a 4); los niveles de las texturas se
  arman en la CPU (como glGenerateMipmap).
- El agua lee la profundidad de la escena en la misma pasada (sólo para leer), sin copiarla.

Banco: `JXM_WGPU=1 jxm-banco GRABACION.jxg SALIDA.png 1280 720 10 alto` (con `JXM_GL=1`, wgpu sobre GLES). Comparado con
el motor de GLES en las mismas grabaciones (500 objetos y 50 NPC, NPC de cerca, explosiones, el lago): diferencia media
1,0–2,7 sobre 255 (bordes de un píxel y el granulado del tramado).

