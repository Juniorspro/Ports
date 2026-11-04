# Geometry Dash 2.2 → HTML5

Motor propio en JS/WebGL 2 (nada del binario del juego, que el APK ni trae): física de los 8 modos a
240 pasos/s, niveles en su formato, triggers, menús, editor completo y niveles online.

```sh
python3 -I empaquetar.py RUTA/assets SALIDA/sitio      # del APK extraído: hojas, íconos, sonidos, niveles
python3 -I armar.py SALIDA/sitio                       # index.html + paquetes b/*.bin
python3 herramientas/porteo/cloudflare/subir.py SALIDA/sitio --proyecto porteo-gd --clave ARCHIVO_FUERA_DEL_REPO --wrangler …
```

- `juego/`: `nucleo.js` (dibujo, nodos, acciones, toques, sonido, guardado), `nivel.js` (formato),
  `mundo.js` (objetos y colores), `jugador.js` (física), `juego.js` (la partida), `triggers.js`,
  `menus.js`, `ui.js`, `editor.js` + `editor2.js`, `online.js`, `principal.js`.
- La tabla de objetos se arma al empaquetar con datos públicos de OpenGD y gdclone (se bajan, no van
  al repo).
- Lo online pasa por el worker de la puerta (`/__gd/`): el servidor del juego y las canciones.
- Pruebas rápidas: `?nivel=N&noclip=1&x=X`, `?editor=nuevo`, `?pantalla=menu|seleccion|garaje|creador`.
