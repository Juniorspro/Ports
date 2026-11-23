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

1. **Hecha: el dibujo.** `jxmotor` dibuja con GLES 3.0 lo que el juego tiene listo para la placa en un cuadro, exportado
   con `jxmCapturar()` (juego/gmod_personal.js, formato JXE1: mallas tal como están en el paquete, materiales, texturas,
   luz horneada de Source, cámara, sol, niebla y el agua de HL2). Tiene:
   - la luz del juego: sol con sombra, cielo y suelo, luz horneada, niebla y ACES;
   - las texturas mezcladas por vértice de los displacements de Source y el terreno con control y tres capas;
   - el agua de HL2: su mapa de normales en dos capas, Fresnel, reflejo de la escena y lo turbio por lo hondo;
   - resolución dinámica: la escena a una fracción de la pantalla y estirada al final, y la sombra y el reflejo rehechos
     cada tantos cuadros (perfil `celular_flojo`).
2. **Siguiente: adentro de la APK.** Una biblioteca para Android (JNI) que dibuja en un `SurfaceView` detrás del WebView:
   el juego le manda las mallas y texturas nuevas cuando aparecen y, cada cuadro, la cámara y las matrices (y los huesos
   de los personajes); el WebView queda transparente con la interfaz encima.
3. Después: los efectos (partículas, rayos, lo que dibuja el Lua de los addons) y la memoria (texturas comprimidas ETC2).

## Banco de pruebas (sin ventana, con Mesa)

```
CARGO_TARGET_DIR=/tmp/claude-0/jxm_target cargo build --release -p jxm-banco
jxm-banco ESCENA.jxe SALIDA.png 1280 720 40 alto,celular,sin
```

Exportar un cuadro del juego: en la versión personal, `await jxmCapturar(256)` devuelve el JXE1 (las texturas hasta
256 px).

### Medido (la misma máquina, la misma escena: gm_construct mirando el lago con el Airboat y 8 props)

| | resolución | sombras | reflejo | cuadros/s |
|---|---|---|---|---|
| Juego actual (WebGL, Alto) | 768×432 | sí | 1/3 | **4,0** |
| JX Motor, perfil Alto | 1280×720 | 2048, cada cuadro | 1/2, cada cuadro | **29** |
| JX Motor, perfil celular flojo | 1280×720 (escena a 2/3) | 1024, cada 2 | 1/4, cada 2 | **62** |

Las dos placas son por software (SwiftShader en Chromium y llvmpipe de Mesa), así que no es lo que va a dar un celular,
pero es la misma escena en la misma máquina. Por ahora el sombreador nativo hace menos cosas que el de WebGL (sin
oclusión ambiental ni brillo).
