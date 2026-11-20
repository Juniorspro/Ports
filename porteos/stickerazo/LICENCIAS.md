# Lo de terceros que va en Stickerazo

Todo lo de esta lista permite uso comercial. Lo que no está acá es propio.

| Qué | Para qué | Licencia | De dónde |
|---|---|---|---|
| MediaPipe Tasks Vision 0.10.35 (`vision_bundle.mjs`, `vision_wasm_internal.*`) | correr los modelos de recorte en el celular | Apache-2.0 | npm `@mediapipe/tasks-vision` (Google) |
| Modelo «selfie multiclass 256×256» | recorte automático de personas | Apache-2.0 | storage.googleapis.com/mediapipe-models (Google) |
| Modelo «magic touch» | recortar tocando (cosas, mascotas, comida) | Apache-2.0 | storage.googleapis.com/mediapipe-models (Google) |
| Luckiest Guy (Brian J. Bonislawsky / Astigmatic) | texto de los stickers y el logo | Apache-2.0 (`web/fuentes/APACHE-2.0.txt`) | Google Fonts |
| Permanent Marker (Font Diner) | texto de los stickers | Apache-2.0 | Google Fonts |
| Bangers (The Bangers Project Authors) | texto de los stickers | SIL OFL 1.1 (`web/fuentes/OFL.txt`) | Google Fonts |
| Anton (The Anton Project Authors) | texto de los stickers | SIL OFL 1.1 | Google Fonts |
| Pacifico (The Pacifico Project Authors) | texto de los stickers | SIL OFL 1.1 | Google Fonts |

MediaPipe y los modelos no se guardan en el repo: los baja `herramientas/bajar.sh` (comprueba sus huellas con
`herramientas/huellas.txt`). Las fuentes OFL se pueden usar, incluir y vender con la app; no se pueden vender solas.
