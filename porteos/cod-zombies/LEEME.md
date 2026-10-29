# Call of Duty: Black Ops Zombies (Android, Marmalade, ARMv7)

El `boz.s3e` original corre en el navegador: traductor ARM/Thumb-2/VFP → JS (`juego/cpu.js`, `decode.js`, `vfp.js`),
el "sistema" de Marmalade reescrito (`s3e.js`), GLES2 → WebGL (`gl.js`) y un Worker con OffscreenCanvas (`mundo.js`).

## Armar y publicar
1. `publicar/armar.sh APK SITIO`: enlaza la imagen (`extraer/xe3u.py`), copia cargador y música del APK, el motor,
   y baja `blackops_dxt.dz` (342 MB) del CDN de Activision.
2. `publicar/publicar.py SITIO abrir.html` (con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`): R2 + Worker con clave
   (`publicar/worker.js`, archivos grandes partidos en 64 MB) y el lanzador. El lanzador lleva la clave: sólo al dueño.

3. APK: `publicar/apk/armar-apk.sh SITIO icono.png salida.apk` (SDK de dl.google.com en `$SDK`). Con `COMPLETO=1`
   lleva el paquete adentro comprimido por bloques de 32 MB (`bloques.py`, LZMA2: 342 → 93 MB) y la música en Opus;
   la app extrae los bloques al teléfono a medida que hacen falta. Sin eso, baja el paquete del CDN por trozos.

4. Parches (sin reinstalar): `publicar/apk/parche.sh salida.zip` (motor: `.js` y `web.html`); en el juego, panel →
   "Aplicar parche". Subir `VERSION_MOTOR` en `web.html` con cada parche. Un APK nuevo descarta los parches viejos.

## Probar
`node pruebas/servidor.js 8080 SITIO` y abrir `web.html?fps=1`. Parámetros: `preset=bajo|medio|alto|goty`,
`ajuste=completa|estirar|bordes`, `sins3tc=1` (DXT por software), `trazar=sonido,archivos`, `filtro=<regex de s3e*>`,
`ver=ao|bloom`. Los menús tardan; en SwiftShader GOTY va a ~20 fps (en GPU real, 60).

## Estado (29/10/2026)
Anda: arranque, menús, tutorial y Kino con zombies (atacan, matan, se dispara) a 60 fps con ~5 ms de CPU por cuadro,
multitáctil (stick + mirar), sonido (ADPCM con el callback del juego), música, partidas guardadas, pantalla ancha
nativa y giro en vertical, DXT por software, apartado gráfico, APK con parches del motor.
Trampas pagadas: `s3eTimerGetUST` es en milisegundos (en µs la partida corría ×1000 y la física agotaba su balde);
`s3ePointerGetInt(4)` = multitáctil; eventos de toque {id, apretado, x, y}; botón 0 = SELECT.
Selector de mapas: se desliza (no se toca). Pruebas: `/tmp/web_test.mjs` con ACCIONES (click, drag, stick, preset).
Falta: jugar rondas largas en un teléfono, idiomas, publicar en Cloudflare.
