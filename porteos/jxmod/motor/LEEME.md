# JX Motor (porteos/jxmod/motor)

El motor nativo de JXMod en Rust, para que la versión personal ande con gráficos altos —sombras y reflejos— en un
celular de 1 GB. Pedido del dueño: «el porteo a un motor de Android en Rust… gráficos altos, sombras incluso reflejos en
un dispositivo de 1 GB de RAM».

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
2. **Hecha: adentro de la APK personal** (Ajustes → «Motor nativo (JX Motor, Rust)», celulares de 64 bits con GLES 3).
   - `android/` arma `libjxmotor.so` (va en `assets/jxmotor/arm64-v8a/`, se carga con `System.load` como JX Hand): un
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
3. Después: oclusión ambiental y el cielo de GMod en el motor, los efectos (partículas, rayos, el Lua de los addons), lo
   que se arma en el momento (autos abollados, agua de los recipientes), mallas que no se suban a WebGL, texturas
   comprimidas (ETC2) y, más adelante, la física y la lógica.

### Protocolo (lo mismo por JNI y en las grabaciones del banco)

- Recursos `JXE1`: `'JXE1'`, u32 con el largo del JSON, el JSON (`mallas`, `mats`, `texs`, `lms`, `agua`, cada uno con
  su `id` del juego) y los bloques de datos alineados a 4.
- Cuadro `JXC1` (floats): `'JXC1'`, cuántas cosas, vp(16), posición, sol, color del sol, cielo, suelo, niebla (color,
  desde, hasta), exposición, altura del agua (NaN: sin agua), tiempo, luces puntuales, luces especiales, 12 floats por
  luz, y por cosa: malla, desde, cuántos, material, matriz(16), esfera(4), banderas (1: no hace sombra), cuántos floats
  de huesos (negativo: los de la cosa número −n−1) y los huesos.
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
