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
| Comic Neue (The Comic Neue Project Authors, Craig Rozynski) | la letra «Comic xD» de los memes | SIL OFL 1.1 | Google Fonts (github.com/google/fonts) |
| 484 familias más (Lobster, Bungee, Fredoka, Caveat, Press Start 2P, Rubik Bubbles, Poppins…; la lista con la licencia de cada una en `web/fuentes_extra.json`, y autores y textos completos en `fuentes/LICENCIAS.txt`) | las «más letras» del editor (se bajan del servidor al elegirlas, no van en el APK) | SIL OFL 1.1 o Apache-2.0, cada una. Las 125 con «nombre reservado» van sin modificar (el .ttf original); las demás, recortadas a caracteres latinos y en WOFF2 (versión modificada, que las dos licencias permiten). Ninguna se vende sola | Google Fonts (github.com/google/fonts), con `herramientas/fuentes_extra.py` |
| Imágenes de muestras de las letras (`fuentes/muestras-*.webp`) | el selector de letras | propias (el nombre de cada familia escrito con su letra) | `herramientas/muestras_fuentes.mjs` |
| Three.js 0.170 (`web/lib/three.module.min.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`, `RoomEnvironment.js`) | mostrar el termo 3D del evento | MIT (`web/lib/THREE-LICENSE.txt`) | npm `three` |
| El termo 3D (`web/termo/termo.glb`) | el evento del termo | propio: hecho con IA para Stickerazo (imagen con GPT Image 2.6 y modelo 3D con Tripo H3.1, en Higgsfield), sin marcas; texturas achicadas con `herramientas/achicar_glb.py` | hecho para esta app |
| Natural Earth 1:110m (tierra y países) → `web/mapa.js` | el mapa de puntos de «¿De dónde sos?» | dominio público | naturalearthdata.com (vía github.com/nvkelso/natural-earth-vector), procesado con `herramientas/mapa.py` |
| 3 banners del inicio (`web/banners/*.webp`) | los carteles que pasan solos en el inicio (y portadas de perfil y la bienvenida) | propios: armados con las pegatinas de la app sobre un degradé, con `herramientas/banners_pegatinas.mjs` | hechos para esta app |
| 184 fotos de animales y comida (`web/memes/*.webp`), deformadas a propósito (estilo «xD») | los packs de memes | CC0 o dominio público (cada una, con autor y enlace, en `web/memes/FUENTES.txt`) | Openverse (Flickr, Wikimedia, rawpixel, StockSnap…), elegidas a mano: sin personas, sin texto, sin personajes ni marcas |
| Los íconos de la app (`web/iconos.js` y los de `app.js`) y las 73 pegatinas (`web/pegatinas.js`) | botones, herramientas y dibujos para sumar a los stickers | propios: dibujados para Stickerazo con formas (SVG / Canvas) y las letras de arriba; sin emojis ni dibujos de otras apps | hechos para esta app |
| 23 dibujitos de la página web (`sitio/a/pg/*.webp`) e íconos de línea en `sitio/*.html` | la cinta, los pasos, las fichitas y las tarjetas de la página, y los puntos de privacidad y términos | propios: las pegatinas y los íconos de la app con su borde blanco, armados con `herramientas/pegatinas_sitio.mjs` (que también mete los SVG en el HTML) | hechos para esta app |
| La página web (`sitio/`) | presentar la app | propia; la letra del logo es Luckiest Guy (Apache-2.0, copia en `sitio/a/fuentes/` con su licencia) y las capturas y stickers son de la app | hecha para Stickerazo |
| Google Mobile Ads SDK (play-services-ads 25.5) y User Messaging Platform 4.0, con play-services-* | los anuncios (AdMob) y el aviso de consentimiento | términos de Google para el SDK de anuncios y los Google Play services (permiten usarlo en apps comerciales; es lo que usa AdMob) | Google Maven (`herramientas/libs_anuncios.json`, con su huella) |
| AndroidX, Kotlin, kotlinx.coroutines, Guava, anotaciones de JetBrains | lo que necesita el SDK de anuncios | Apache-2.0 | Google Maven y Maven Central (`herramientas/libs_anuncios.json`) |

MediaPipe y los modelos no se guardan en el repo: los baja `herramientas/bajar.sh` (comprueba sus huellas con
`herramientas/huellas.txt`). Las fuentes OFL se pueden usar, incluir y vender con la app; no se pueden vender solas.

Las fotos de los memes se recortaron y retocaron con `herramientas/memes_libres.py`; el recorte usa rembg (MIT) con
el modelo IS-Net (Apache-2.0) sólo en la compu, no va en la app. El texto de cada meme es nuestro y lo dibuja la app.
Si alguna foto resultara no ser libre, se saca de `herramientas/memes_lista.py` y se vuelve a armar.

La música no viene en la app: es el reproductor oficial de YouTube (a la vista, 200×200), con lo que cada persona elige. La búsqueda la hace el servidor de JXMod (`/api/yt`).
