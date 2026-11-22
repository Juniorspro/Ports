# JX Hand Engine

Seguimiento de manos para JXMod, en Rust puro. El pedido del dueño: «el mejor handtracking vía MediaPipe nunca antes
visto… lograr algo mejor o igual a Meta Quest… en la APK, no web, y que se actualice dentro de la app como JXMod».

## Cómo corre

- **Dónde:** compilado a WebAssembly, adentro de la vista web de la APK.
  - Así viaja con las actualizaciones por partes de JXMod, como cualquier otro archivo del juego, sin APK nueva.
  - Sólo hace falta una APK nueva una vez: la que da el permiso de la cámara a la vista web.
- **Sin dependencias:** ni `wasm-bindgen` ni nada. El motor exporta funciones `extern "C"` (`motor/src/wasm.rs`) y
  `web/jxhand.js` sólo copia memoria y lee la salida.
- **Los modelos:** los de MediaPipe Hands (Google, Apache 2.0), en `modelos/`.
  - Detector de palmas, 192×192 (`hand_detector.tflite`).
  - 21 puntos, 224×224, completo (`hand_landmarks_detector.tflite`) o liviano (`hand_landmark_lite.tflite`).
  - Los corre un intérprete propio, no el de TensorFlow.

## Las partes

| Archivo | Qué hace |
|---|---|
| `motor/src/tflite.rs` | Lector de TFLite (FlatBuffers) hecho a mano. Pasa los pesos en float16 a f32 al cargar. |
| `motor/src/red.rs` | El intérprete. Ordena los pesos para los kernels y reserva toda la memoria una vez. Kernels propios: convolución 1×1 como multiplicación de matrices en bloques de 4×8 en registros, depthwise sin revisar bordes en el interior, y SIMD explícito de WebAssembly con FMA (relaxed SIMD) si la vista web lo tiene. |
| `motor/src/mano.rs` | El camino de MediaPipe Hands: 2016 anclas SSD, supresión ponderada, el cuadrado rotado de la mano, la proyección de los puntos y el cuadrado del cuadro siguiente sacado de los puntos. |
| `motor/src/filtro.rs` | One Euro con la velocidad relativa al tamaño de la mano. La predicción usa su propia velocidad y se apaga con la mano quieta. |
| `motor/src/esqueleto.rs` | El esqueleto (ver abajo). |
| `motor/src/gestos.rs` | Abierta, puño, señalar, pinza, paz, pulgar arriba y abajo, OK, cuernos y «llamame», con intensidad, histéresis y 3 cuadros para cambiar. |
| `motor/src/motor.rs` | Sigue hasta 2 manos. El detector corre sólo sin manos, o cada 300 ms si falta una. Saca la posición en metros frente a la cámara. |
| `motor/src/wasm.rs` | La puerta de WebAssembly. |
| `web/jxhand.js` | Carga y uso desde JavaScript. Elige sola la versión con FMA o sin. |
| `banco/` | Herramienta nativa: `ver`, `foto`, `medir`, `perfil` y `video` (abajo). |

**El esqueleto:**
- **Marco de la palma:** rígido y de mano derecha (para el cuaternión). Con un signo para la palma, así los ángulos
  significan lo mismo en las dos manos.
- **Ángulos con límites de una mano de verdad:** base con flexión y apertura; media y punta sólo se doblan.
- **Se vuelve a armar con el largo de tus huesos:** la mediana de los últimos 90 cuadros buenos.
- **Cierre de cada dedo:** la curva total menos la natural de una mano estirada (medida en fotos: 50° a 70°).

## Mediciones

Con fotos de dominio público (Wikimedia Commons, fuera del repo) y «videos» hechos moviendo esas fotos (180 cuadros,
30 por segundo, quieta 2 s y después girando, corriéndose y escalando, con ruido de sensor).

- **Puntos:** caen sobre los dedos en todas las fotos donde hay una mano clara.
  - Presencia entre 0,99 y 0,996.
  - En 3D, muñeca a nudillo 10 cm y dedo medio 8 a 10 cm.
  - Distancia a la cámara con sentido: de 13 cm en la foto de cerca a 54 cm.
- **Lo que no detecta:** manos pintadas con banderas, una silueta a contraluz y manos chiquitas en una grilla.
  - El mejor puntaje fue de 0,03 a 0,44: es el límite del modelo, no del motor.
- **Seguimiento:** una sola pista en los 180 cuadros, sin perder la mano nunca.
- **Temblor con la mano quieta (por cuadro):**
  - Modelo solo: 0,083 % y 0,239 % del tamaño de la mano.
  - JX: 0,004 % y 0,023 %, de 10 a 20 veces menos.
- **En movimiento, con 50 ms de retraso** (lo que tarda un celular entre la cámara y la pantalla), contra dónde está la
  mano en ese momento:
  - Modelo solo: 2,21 %. JX filtrado y adelantado: 0,88 %.
  - Sin retraso, el modelo solo da 0,53 %: JX queda cerca del ideal.
- **Largo de los huesos (variación):** modelo solo 2,3 a 2,6 %; esqueleto 0,75 a 0,82 %.
- **Gestos:** «abierta» en 174 de 180 cuadros y en 178 de 180 en la otra foto (los primeros son el arranque).
- **Velocidad en esta PC** (un núcleo, Chromium headless; en el celular va a ser más lento):

  | | Puntos (completo) | Puntos (liviano) | Detector |
  |---|---|---|---|
  | Antes de optimizar | 64 ms | — | 54 ms |
  | Con los kernels SIMD y FMA | 42 a 44 ms | ~20 ms (nativo) | 45 ms |
  | Operaciones por corrida | 660 M | 291 M | 675 M |

  Con la mano seguida, cada cuadro corre sólo el modelo de los puntos.
- **Referencia:** no hay una de Google contra la que comparar número a número. tract no lee pesos float16 y la
  instalación del intérprete oficial (ai-edge-litert) la bloqueó el sistema de permisos. La validación es la de arriba
  (puntos sobre las fotos, puntajes y medidas físicas).

## Cómo se arma y se prueba

```sh
./armar.sh                                   # banco nativo + web/jxhand_simd.wasm + web/jxhand_relaxed.wasm
B=/tmp/claude-0/jxhand_target/release/jxhand-banco
$B foto modelos FOTO.png SALIDA.png          # dibuja los cuadrados, el esqueleto, ángulos y presencias
$B video modelos FOTO.png                    # temblor, retraso, huesos y gestos (variables JXH_PRED, JXH_BETA, JXH_DC, JXH_MINC)
$B perfil modelos                            # cuánto tarda cada tipo de capa y cuántas operaciones hace
```

## Lo que sigue

- **Integración con JXMod (sólo en la APK):**
  - La cámara de frente con `getUserMedia` y el motor en un Worker.
  - Las manos del juego que copian las tuyas: posición, rotación y ángulos de cada dedo a los huesos de la mano.
  - Los gestos como acciones.
  - Bajada por las actualizaciones por partes.
  - En la APK: el permiso de cámara para la vista web.
- **Velocidad en celulares:**
  - Elegir sola el modelo completo o el liviano según lo que tarda.
  - Varios hilos: un Worker por mano y el detector aparte, o cuadros alternados.
  - Fundir convolución, suma y PReLU.
