# Hypper Sandbox → HTML

Motor propio en JS/WebGL 2 (nada del código del juego). Los modelos, texturas, sonidos, íconos y la
lista del menú salen del APK al empaquetar y van **sólo** al HTML privado, nunca al repo.

```sh
# 1) datos del APK (carpeta no confiable, sin ejecutar nada de adentro): assets/bin/Data con los .split unidos
python -I herramientas/exportar.py DATOS SALIDA          # escenas, prefabs, mallas, materiales, texturas
python -I herramientas/anims.py DATOS SALIDA/anims.json   # animaciones genéricas (brazos y armas)
python -I herramientas/audio.py DATOS SALIDA/audio_orig   # FSB5 → ogg
python -I herramientas/sprites.py DATOS SALIDA/sprites    # íconos
python -I herramientas/humanoide.py DATOS SALIDA/humano.json  # animaciones humanoides (músculos) + avatares
python -I herramientas/menuexp.py DATOS level1 SALIDA/menu_ui.json  # el menú real (LobbyCanvas)
python -I herramientas/idiomas.py DATOS SALIDA/loc.json      # tabla de idiomas del juego
python -I herramientas/decodmb.py DATOS 1c5bd90faf82ca84b994ebfa0604f479 1 > CRUDOS/menu_raw.txt   # menú de spawn
#    (también tools_raw/chars_raw/hats_raw/emotes_raw con varios.py y decodmb.py)
python -I herramientas/empaquetar.py SALIDA CRUDOS PAQUETE
# 2) el HTML
MQTT_JS=ruta/mqtt.min.js python3 -I armar.py PAQUETE Hypper.html
```

- Lector de Unity: UnityPy 1.25 compilado desde fuente (`pip --no-binary :all:`), fsb5 para el audio.
- Gráficos por calidad (Ajustes → Gráficos, o `?gfx=` en la dirección): **patata** y **bajo** (luz difusa como el
  juego), **medio** (luz física GGX, sombras del sol en 1 cascada), **alto** (2 cascadas con PCF, HDR, oclusión
  ambiental, resplandor, nubes, FXAA) y **ultra** (3 cascadas con sombras suaves PCSS, relieve desde la textura,
  niebla con el sol, rayos de sol). En automático baja la resolución y, si no alcanza, la calidad.
- `gl` junta todo lo que se dibuja en una lista y la usa varias veces; `sombras` (cascadas en un atlas, con copia del
  mapa fijo que sólo se rehace cuando cambia el casillero o el sol), `post` (HDR, SSAO, bloom, rayos, ACES, FXAA),
  `dia` (hora del día: sol, atardecer, noche con luna, estrellas y faros), `anfitrion` (pestaña Host: hora, ciclo,
  PvP, Nextbots, topes, desactivar spawn, echar, limpiar; llega a toda la sala), `marcas` (marcas de frenada).
- Choques: una forma por cada collider del juego (cajas, esferas, cápsulas, mallas convexas) en cuerpos compuestos:
  puertas con hueco, contenedores abiertos, mesas con patas. Autos que no vuelcan al doblar.
- Animación: armas del juego en la mano en tercera persona, disparo/recarga/golpe en el torso, salto, aterrizaje,
  agacharse, pies apoyados en el piso; cámara con balanceo, golpe al caer y agacharse suave.
- `juego/`: `nucleo` (matemática), `gl` (dibujo), `datos` (paquete), `modelo`, `fisica` (XPBD), `mundo`
  (mapa y choques), `jugador`, `objetos`, `vista` (arma en la mano), `audio`, `efectos`, `armas`,
  `vehiculos`, `herramientas` (Tool Gun), `personas` (skins, emotes, muñeco), `humano` (clips humanoides:
  músculos → huesos), `red` (MQTT: salas, lista de servidores por presencia retenida), `entrada` (incluye el
  giro a horizontal), `ui`, `menu` (dibuja el LobbyCanvas exportado con HTML), `principal`.
- Pruebas: `pruebas/escena.mjs` (guion de pasos), `dbg.mjs` (corre un .js en la página: `fisica_choques.js`,
  `vehiculos.js`, `pies.js`, `camara.js`, `marcas.js` devuelven números), `red2.mjs` (tres jugadores, broker local
  aedes: sala oficial, lista, servidor con clave y sin PvP), `red3.mjs` (anfitrión: hora y reglas por la red,
  spawn bloqueado, echar), `barrido.mjs` (8 mapas × 5 calidades, errores de consola), `celu.mjs` (teléfono táctil,
  `acostado` o `parado` para el giro de 90°).
