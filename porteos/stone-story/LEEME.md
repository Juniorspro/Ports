# Stone Story RPG (APK 4.33.0, Unity 2022.3 IL2CPP)

Sin IL: el juego se rehace en JS (`juego/`) con los datos originales y la lógica leída del ARM decompilado.

## Armar
1. XAPK (MediaFire del dueño) → `unzip` el APK base y `config.arm64_v8a.apk`.
2. `Il2CppDumper 6.7.46` (anda con metadata v31, `DOTNET_ROLL_FORWARD=Major`) → `script.json`, `il2cpp.h`.
   **Ojo:** Il2CppDumper corre algunas direcciones 0x4000; las buenas son las de Cpp2IL
   (`--use-processor attributeinjector --output-as diffable-cs`). `decompilar.py`/`refallos.py` usan esas.
3. DLLs de Cpp2IL con `--use-processor attributeanalyzer --output-as dll_empty` (typetrees; `ttfix.py` arregla List<string>).
4. `empaquetar.py APK DLLS tablas.json SAL` → `datos.json.gz`; `sonidos.py SAL WAVS SAL` → `sonidos.bin`
   (WAVs sacados con UnityPy, `AudioClip.samples`); `armar.py SAL tex_ascii_table_22x40_AA.png SAL` → `StoneStory.html`.
5. `tablas.json`: letras y espejos sacados ejecutando las funciones del juego con unicorn (`emular.py`), herencia de clases.

## Pruebas
`pruebas/recorrido.mjs` (título→intro→Rocky Plateau→menú), `pruebas/progreso.mjs` (lugares y tareas en orden), `pruebas/foto.mjs`.

## Estado (14/10/2026)
Anda: motor ASCII, sonido, idiomas latinos, título, intro, menú (Lugares/Taller/Objetos), ajustes, pausa, todos los lugares
(secciones, enemigos, recolección, cofres, XP), armas/escudo/ballesta/varita/hacha/pala.
Falta: diálogos de NPC (`tid_ranting_*`, etc.), lógica propia de jefes (Xyloalgus, Bolesh, Yeti...), equilibrio,
pociones/yunque/encantamientos, Stonescript, alfabetos no latinos. Clases de personajes sin decompilar: ver `herencia` en tablas.json.
