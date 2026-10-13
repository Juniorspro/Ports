# Stone Story RPG (APK 4.33.0, Unity 2022.3 IL2CPP)

Sin IL: la lógica se reescribe en JS (`juego/`) a partir del ARM decompilado, con los datos originales.

- `extraer/textos.py`, `texturas.py`, `prefabs.py`: dibujos ASCII, tablas de letras, prefabs (UnityPy; versión de reserva 2022.3.62f3, DLLs de Cpp2IL con `attributeanalyzer` para los typetrees).
- `extraer/aopus.sh`: sonidos WAV → Opus.
- `extraer/cabecera.py`, `decompilar.py`: Ghidra sin análisis + `script.json`/`il2cpp.h` de Il2CppDumper 6.7.46 (anda con metadata v31); `literales.py` pone los textos literales en el `.c`.
