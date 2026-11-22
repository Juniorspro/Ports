# JX Hand Engine

Seguimiento de manos para JXMod, en Rust puro. El pedido del dueño: «el mejor handtracking vía MediaPipe nunca antes
visto… lograr algo mejor o igual a Meta Quest… en la APK, no web, y que se actualice dentro de la app como JXMod».

## Cómo corre

- **En la app JX Hand: Rust nativo de Android** (`lib/arm64-v8a/libjxhand.so`), sin vista web ni JavaScript.
  - Camera2 entrega cada cuadro YUV y pasa directo al motor por JNI (`motor/src/android.rs`), sin copiarlo.
  - Rust lo endereza (gira según el sensor y espeja la cámara de frente), lo pasa a RGBA, corre los modelos y devuelve
    los datos de cada mano y la imagen para mostrar.
  - **Varios hilos** (`motor/src/hilos.rs`): cada capa se reparte por filas entre los núcleos grandes del celular (los
    chicos, de bajo consumo, harían esperar a los demás). Entre capa y capa los hilos no se duermen: despertar uno
    tarda de 20 a 100 µs y una red tiene más de 100 capas. Entre cuadros sí se duermen (batería).
  - **NEON** (los registros SIMD de ARM): producto de matrices en bloques de 4 píxeles × 16 canales con FMA, tomando
    el valor de cada píxel de un carril del registro. Usa 24 de los 32 registros.
  - **float16** en los procesadores que lo tienen (ARMv8.2, casi todos los celulares desde 2018): las convoluciones
    1×1 (el 80 % de las cuentas) se hacen con 8 números por instrucción en vez de 4. Ver abajo.
  - **La mano en 3D** la dibuja el mismo motor con OpenGL ES 2.0, en el mismo hilo y en el mismo cuadro (ver abajo).
- **En WebAssembly** (`web/`, para la web o para JXMod algún día): el mismo motor, en un solo hilo, con SIMD de
  WebAssembly.
- **Sin dependencias:** ni `wasm-bindgen` ni `jni` ni nada; la tabla de funciones de JNI se usa a mano.
- **Los modelos:** los de MediaPipe Hands (Google, Apache 2.0), en `modelos/`, corridos por un intérprete propio.
  - Detector de palmas, 192×192 (`hand_detector.tflite`).
  - 21 puntos, 224×224, completo (`hand_landmarks_detector.tflite`) o liviano (`hand_landmark_lite.tflite`).

## Las partes

| Archivo | Qué hace |
|---|---|
| `motor/src/tflite.rs` | Lector de TFLite (FlatBuffers) hecho a mano. Pasa los pesos en float16 a f32 al cargar. |
| `motor/src/red.rs` | El intérprete. Ordena los pesos para los kernels y reserva toda la memoria una vez. Kernels propios: convolución 1×1 como multiplicación de matrices en bloques de 4×8 en registros, depthwise sin revisar bordes en el interior, y SIMD explícito de WebAssembly con FMA (relaxed SIMD) si la vista web lo tiene. |
| `motor/src/mano.rs` | El camino de MediaPipe Hands: 2016 anclas SSD, supresión ponderada, el cuadrado rotado de la mano, la proyección de los puntos y el cuadrado del cuadro siguiente sacado de los puntos. |
| `motor/src/filtro.rs` | One Euro con la velocidad relativa al tamaño de la mano. La predicción usa su propia velocidad y se apaga con la mano quieta. |
| `motor/src/esqueleto.rs` | El esqueleto (ver abajo). |
| `motor/src/gestos.rs` | Abierta, puño, señalar, pinza, paz, pulgar arriba y abajo, OK, cuernos y «llamame», con intensidad, histéresis y 3 cuadros para cambiar. |
| `motor/src/motor.rs` | Sigue hasta 2 manos. Sin manos, el detector corre en el cuadro mismo, con todos los núcleos. Si ya hay una y falta otra, busca cada 300 ms en otro hilo (en los núcleos chicos), así no frena el cuadro. Saca la posición en metros frente a la cámara. |
| `motor/src/luz.rs` | Poca luz: el realce del recorte de la mano y la curva de «ver de noche» (abajo). |
| `motor/src/hilos.rs` | Los hilos del motor nativo. |
| `motor/src/malla.rs` | La mano en 3D: una malla liviana armada en cada cuadro con los 21 puntos. |
| `motor/src/escena.rs` | El dibujo con OpenGL ES 2.0: la imagen de fondo y la mano en 3D, en 4 estilos. |
| `motor/src/android.rs` | La puerta de Android (JNI): YUV → RGBA derecho, motor, salida y dibujo. |
| `motor/src/wasm.rs` | La puerta de WebAssembly. |
| `web/jxhand.js` | Carga y uso desde JavaScript. Elige sola la versión con FMA o sin. |
| `banco/` | Herramienta nativa: `ver`, `foto`, `medir`, `perfil`, `video`, `noche`, `noche_foto`, `f16` y `escena` (abajo). |

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

## Poca luz

**Cómo se mide** (`banco noche`):
- Las fotos se oscurecen como las saca un celular con poca luz.
  - Un píxel blanco junta ~4000 electrones con buena luz.
  - Con menos luz pesan el ruido de fotones (la raíz de la señal) y el de lectura (2,5 e⁻).
  - La cámara sube la ganancia hasta ×16; más oscuro que eso, la foto sale además más oscura.
- 4 fotos y sus espejos, 3 ruidos distintos por nivel.
- **Detecta:** el detector encuentra la palma.
- **Sigue:** desde el cuadrado del cuadro anterior, la presencia pasa 0,5 durante 4 cuadros.
- **Error:** distancia de los 21 puntos a los de la foto buena (con las mismas pasadas), en % del largo de la palma.

**Lo que hace el motor** (cada cosa se dejó sólo si las medidas la daban por buena):
- **Detector: promedia el ruido.** Cada píxel de su entrada de 192×192 junta los n×n de la imagen que le tocan (sumas
  enteras, ~1 ms), en vez de tomar un solo punto bilineal.
- **Detector: suma los cuadros seguidos** mientras busca la mano con poca luz (el último pesa 1/2).
- **Puntos: realce del recorte.** Se baja el negro, se sube el blanco (hasta ×8), y una gamma lleva los medios a 0,40.
  Desde 1,5× de ganancia, además, se suaviza el ruido (3×3). Con buena luz no se toca nada.
- **Descartado por las medidas:**
  - El realce en el detector: le baja el puntaje (de 0,92 a 0,69 con 1/128 de la luz).
  - El promedio en el recorte de los puntos: más error que el bilineal.

**Resultados:**

| Luz | Detecta: antes → ahora | Error: antes → ahora | Presencia: antes → ahora |
|---|---|---|---|
| 1/4 | 100 % → 100 % | 1,0 % → 1,0 % | 0,99 → 0,99 |
| 1/32 | 96 % → 100 % | 2,6 % → 2,2 % | 0,99 → 0,99 |
| 1/64 | 54 % → 100 % | 4,1 % → 2,5 % | 0,99 → 0,99 |
| 1/128 | 12 % → 100 % | 6,1 % → 3,6 % | 0,97 → 0,99 |
| 1/256 | 0 % → 100 % | 6,7 % → 5,2 % | 0,90 → 0,98 |

**Además, en la app:**
- La linterna de la cámara trasera.
- **«Ver de noche»:** muestra la imagen aclarada con una curva medida en cada cuadro, y deja que la cámara exponga más
  (puede bajar a 15 cps).

## La mano en 3D

Una mano 3D liviana que recubre la tuya en cada cuadro (`motor/src/malla.rs`, unos 2800 vértices y 5400 triángulos por
mano).
- **Se arma en el espacio de la imagen:** x e y en píxeles, z con la profundidad relativa del modelo en las mismas
  unidades. Por eso cae exactamente sobre la mano de la imagen.
- **Dedos:** un tubo por dedo que pasa por sus articulaciones con una curva suave (Catmull-Rom), sin retorcerse.
  - El grosor es el de una mano de verdad, proporcional al ancho de la palma: el índice, por ejemplo, 0,15 de ese
    ancho en la base y 0,105 en la punta.
  - La punta termina redondeada justo en el punto de la punta del dedo.
- **Palma:** una «almohada» (parche de Coons) entre la muñeca, la eminencia del pulgar y los nudillos, más gruesa en el
  medio y con el borde redondeado.
- **Muñeca:** un tramo de antebrazo que se desvanece.
- **La unión de los dedos con la palma:**
  - La palma se corre un poco hacia atrás sólo en profundidad. Como no hay perspectiva, no se mueve en la imagen.
  - Donde se cruzan, gana el dedo. Si no, la unión se veía como un serrucho.
- **Cómo se dibuja (`motor/src/escena.rs`, OpenGL ES 2.0):**
  - La imagen que miró el motor va de fondo, y la mano encima en el mismo cuadro.
  - Suavizado de bordes ×4.
  - En el cristal, primero se dibuja sólo la profundidad y después el color de la cara de adelante, así no se ven las
    caras de atrás a través.
- **Estilos:**
  - **Cristal:** translúcido, con el degradé de JXApps y el borde que brilla.
  - **Piel:** del color de tu mano, medido en cada cuadro sobre la palma.
  - **Robot:** metal con reflejo.
  - **Esqueleto:** huesos y articulaciones en 3D, cada dedo de su color.
- **Probado en la PC** con Mesa (OpenGL ES por software): `EGL_PLATFORM=surfaceless jxhand-banco escena …`, compilado
  con `--features gl`. Es el mismo código que corre en el celular.

## float16

- **Qué va en float16:** las convoluciones 1×1 y las depthwise (en las de 3×3 a 5×5, de a 32 canales con las sumas en
  registros).
- **Los tensores grandes se quedan en float16:** los expandidos, de 64 a 672 canales, que sólo leen capas en
  float16.
  - Los pasa a float16 la capa que los produce, mientras siguen en la caché.
  - La siguiente los lee así, sin otra pasada para convertir.
  - En el modelo liviano: 46 capas en float16 y 30 tensores que pasan entre capas ya en float16.
- **Comparado en el emulador de ARM** (qemu con un procesador con FEAT_FP16), con `jxhand-banco f16` y 4 fotos:
  - Los puntos se mueven, en promedio, el 0,32 % del largo de la palma contra float32. En la peor foto es el 0,55 %.
  - La presencia cambia ±0,0004.
- **Las sumas** de las 1×1 se hacen en float16 de a bloques de 128 canales, y cada bloque se pasa a float32.
  - Con bloques de 32 el error casi no baja: viene de redondear a float16, no de las sumas.
- **En la app:** «Cálculo rápido (float16)», prendido de entrada. Arriba dice «float16» cuando se usa.

## Velocidad

**En esta PC** (4 núcleos Xeon a 2,1 GHz, x86 sin AVX), modelo completo de los puntos:

| Hilos | Puntos | Detector |
|---|---|---|
| 1 | 43,6 ms | 51,0 ms |
| 2 | 25,9 ms | 36,0 ms |
| 4 | 19,3 ms | 21,6 ms |

- Con 1 hilo y con 4 da exactamente lo mismo.
- **ARM:** el código de ARM (NEON) se probó con un emulador de ARM de 64 bits (qemu). Da los mismos puntos que el de
  x86, con 1 hilo y con 4.
- **En un celular no se pudo medir desde acá.** La app muestra arriba a la izquierda los milisegundos de cada cuadro.
- **Modelo «Auto»:** usa el completo y pasa al liviano (291 M operaciones contra 660 M) si en ese celular el completo
  tarda más de 5 ms.
- **2.2, para bajar de 8 ms (lo que dio el celular del dueño) a ~6:**
  - **De dónde sale la cuenta:** en el modelo liviano (esta PC, 1 hilo), las 1×1 son el 67 % del tiempo, las depthwise
    el 23 % y la primera convolución el 8 %. Con las 1×1 en float16, las otras pasaban a ser la mitad del tiempo.
  - **Depthwise en float16,** con los tensores grandes que quedan en float16 entre capa y capa.
  - **La primera convolución con NEON,** con las sumas en registros.
  - **El recorte de la mano,** repartido entre los núcleos.
  - En un celular todavía no se midió: lo dice la app.
- **Sin tirones:**
  - Antes, con una mano a la vista y «2 manos», el detector corría cada 300 ms en el cuadro mismo: ese cuadro tardaba
    el doble.
  - Ahora corre en otro hilo, en los núcleos chicos. En el video de prueba, el detector pasó de correr en 20 de los
    180 cuadros a sólo en el primero.
- **Pegada en movimientos rápidos:**
  - El filtro de los puntos se ajustó para dibujar el mismo cuadro que se mira, sin adelantar.
  - Con el video moviéndose 8 veces más rápido, el error pasó de 1,20 % a 0,88 % de la mano (el modelo solo da 0,83 %).
  - Quieta, la mano tiembla 0,087 %, 3 veces menos que el modelo solo.
- **El dibujo:** a 720 de ancho como mucho (la imagen es de 480 × 640). Android lo agranda solo y la placa de video
  trabaja la mitad.

**El retraso que se ve:**
- **El esqueleto va pegado a la mano.** Se dibuja la misma imagen que miró el motor, con su esqueleto, apenas
  termina. Antes, en la vista web, el video iba adelante y el esqueleto llegaba 40 a 60 ms tarde.
- **La imagen en sí** llega con el retraso propio de la cámara del celular, como en cualquier app de cámara.
- **Adelantar:** de 0 a 100 ms, para usar las manos como control. Viene en 0: con más, el esqueleto se adelanta a la
  imagen.

## Cómo se arma y se prueba

```sh
./armar.sh                                   # banco nativo + web/jxhand_simd.wasm + web/jxhand_relaxed.wasm
B=/tmp/claude-0/jxhand_target/release/jxhand-banco
$B foto modelos FOTO.png SALIDA.png          # dibuja los cuadrados, el esqueleto, ángulos y presencias
$B video modelos FOTO.png                    # temblor, retraso, huesos y gestos (variables JXH_PRED, JXH_BETA, JXH_DC, JXH_MINC)
$B perfil modelos                            # cuánto tarda cada tipo de capa y cuántas operaciones hace
$B noche modelos FOTO...                      # poca luz: detecta, sigue y error, con y sin lo de la noche
$B noche_foto modelos FOTO 1/128 SALIDA.png   # la foto oscura, lo de antes y lo de ahora, lado a lado
JXH_VEL=8 JXH_PRED=0 $B video modelos FOTO    # el video 8 veces más rápido: cuánto se queda atrás el filtro, y los ms por cuadro
$A f16 modelos FOTO...                        # en ARM (qemu -cpu max): float16 contra float32
JXH_HILOS=1 $B medir modelos FOTO            # cuántos hilos usa (por defecto, todos los núcleos)
```

La puerta de Android se prueba en la PC, con Java de verdad:
- Se compila con `cargo build --release -p jxhand --features jni`.
- Un programa en Java le pasa un cuadro YUV como los de Camera2: girado, con filas rellenas y U/V intercalados.
- Da los mismos puntos y los mismos colores (diferencia media de 0,6 a 0,9 de 255).

## La app JX Hand (`app/`, `JXHand.apk`)

El dueño la pidió aparte, no adentro de JXMod: «es una app aparte, usa cámara trasera». Desde la versión 2.0 es
nativa: «no web, Rust».

**Java (`app/src/com/jxapps/jxhand/`) sólo abre la cámara, le pasa los cuadros al motor y dibuja:**
- **`Camara.java`:** Camera2 a ~640×480 en YUV, sin vista previa aparte.
  - Pide 60 cps si la cámara los da («Cámara rápida») y apaga la estabilización por software, que guarda cuadros.
  - Linterna.
  - Siempre se procesa el cuadro más nuevo, en un hilo con la prioridad de la pantalla.
- **`Pantalla.java`:** la superficie de OpenGL.
  - El contexto (EGL) vive en el hilo del motor.
  - Cada cuadro se procesa y se dibuja en el mismo hilo, apenas el motor devuelve el cuadro a la cámara.
  - Pide suavizado de bordes ×4.
- **`Capa.java`:** lo que va encima.
  - Arriba: milisegundos, cps, núcleos, modelo, float16, estilo y lo que tarda el dibujo.
  - Una tarjeta por mano: derecha o izquierda, distancia en cm, gesto con su fuerza, y cuánto se estira cada dedo.
  - Los mensajes.
- **`Principal.java`:** los botones (linterna, ver de noche, girar la cámara, estilo de la mano, ajustes) y el panel
  de ajustes.
  - La mano en 3D: Cristal, Piel, Robot o Esqueleto.
  - Modelo Auto, Completo o Liviano.
  - 1 o 2 manos.
  - Adelantar.
  - Ver de noche.
  - Realce para poca luz.
  - Cálculo rápido (float16).
  - Cámara rápida.
- **`Icono.java`:** íconos propios dibujados a mano. El ícono de la app es la mano en el degradé de JXApps
  (`app/icono.svg`).
- **`java/com/jxapps/jxhand/Motor.java`:** la puerta al motor de Rust (aparte de la app: la usa también JXMod).

**Probado sin celular:**
- El motor de Android por JNI desde Java en la PC (arriba).
- El dibujo:
  - La escena 3D con Mesa (arriba).
  - `Capa.java` e `Icono.java` tal cual, sobre un reemplazo de `android.graphics` hecho con Java2D, con la salida del
    motor de verdad.
- La cámara y la pantalla del celular no se pueden probar desde acá.

**El APK (`app/armar_apk.py`):** sin Gradle, como el de JXMod.
- Compila el motor con el enlazador del NDK r27 (sólo su clang y el sysroot de ARM de 64 bits).
  - Páginas de 16 KB, como piden Android 15 y los celulares nuevos.
- Después: javac, d8, aapt2 (los modelos sin comprimir), la librería sin comprimir y alineada a 16 KB, zipalign y
  apksigner.
- Firma propia en `/root/.jxhand/firma`, fuera del repo, con la clave al azar en `clave.txt` (chmod 600).
- Revisa las firmas (v1, v2 y v3) y `aapt2 dump badging` (paquete, nombre, permiso de cámara, actividad y
  `arm64-v8a`).
- 10,5 MB. Android 7 o más nuevo, ARM de 64 bits: todos los celulares de los últimos años; no anda en los de 32 bits.

**JXMod:** desde el 22/11 también va adentro de JXMod, con este mismo motor nativo (no el WebAssembly). Ver el LEEME
de JXMod, «Tus manos con la cámara (JX Hand Engine nativo)».
- La clase `com.jxapps.jxhand.Motor` está aparte, en `java/`, y la compilan los dos armados.
- Ya no carga la biblioteca sola: la app JX Hand llama `Motor.cargar(null)` (la de `lib/`), y JXMod la de sus archivos,
  sólo en los celulares de 64 bits.

## Lo que sigue

- **Medir en celulares de verdad:** los milisegundos que muestra la app.
- **Si hace falta bajar más:**
  - Fundir cada bloque (1×1, depthwise y 1×1) por franjas, para que no salga de la caché.
  - Fundir la convolución, la suma y el PReLU.
  - Pasar a RGBA sólo los recortes, y que la placa de video convierta la imagen de fondo.
- **Que se actualice sola,** con firma, como JXMod.
