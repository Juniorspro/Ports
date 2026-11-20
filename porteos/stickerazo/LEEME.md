# Stickerazo

App para hacer stickers de WhatsApp con tus fotos: elegís una foto, la recorta sola (en el celular, la foto no sale a
ningún lado), le ponés texto y emojis, y armás packs de 3 a 30 stickers que se agregan a WhatsApp con un botón.

Es un proyecto **comercial** (anuncios y Premium más adelante): todo es propio o con licencia que permite venderlo.
Lo de terceros está en [LICENCIAS.md](LICENCIAS.md).

## Cómo está hecho

La interfaz es una página web (`web/`) que en el celular corre dentro de la app de Android (`android/`, por hacer).
Lo que necesita el celular (guardar los packs donde WhatsApp los lee, el botón «Agregar a WhatsApp») lo pide por un
puente (`window.SZN`); en el navegador, para probar, usa IndexedDB.

| Archivo | Qué hace |
|---|---|
| `web/index.html`, `web/estilo.css` | las 4 pantallas: Inicio, Recortá, Decorá y el pack (tema oscuro, amarillo y rosa) |
| `web/app.js` | lo que hace cada botón: recorte con el dedo (tocar, borrar, recuperar, con lupa), editor con gestos (arrastrar, pinza de dos dedos, manija), guardar en packs |
| `web/recorte.js` | separa lo importante del fondo con MediaPipe: personas solas (modelo «selfie multiclase») y cualquier cosa tocándola («magic touch») |
| `web/editor.js` | el sticker: capas (foto, textos, emojis) en 512×512, el borde blanco con sombra, «que entre todo», exportar a WebP ≤ 100 KB y el ícono 96×96 |
| `web/puente.js` | guardar/leer packs y archivos, y hablar con WhatsApp (app de Android o navegador) |
| `web/fuentes/` | las 5 letras para los textos (Apache-2.0 y OFL) |
| `web/terceros/` | MediaPipe y los modelos: **no van en el repo**, los baja `herramientas/bajar.sh` |

### El recorte automático

Primero corre el modelo de personas. Si encuentra una **cara** (≥ 1,2 % de la foto) se queda con ese recorte (pelo y
varias personas juntas le salen mejor); si no (mascotas, comida, cosas) recorta lo que está en el medio con «magic
touch». Medido: el modelo de personas toma por persona también a un perro (28 % de «ropa») o una hamburguesa (19 %),
pero ninguno tiene cara (≤ 0,6 %); un retrato tiene entre 3,5 y 11 %.

Después se corrige con el dedo: **Tocar** algo lo suma (o lo saca, si ya estaba adentro), **Borrar** y **Recuperar**
son un pincel (con lupa, porque el dedo tapa lo que pinta), **Entera** usa la foto sin recortar, y **Deshacer** (12 pasos).

### Lo que pide WhatsApp (y se comprueba en la prueba)

- Sticker: 512×512, WebP, **100 KB como mucho**, fondo transparente, con margen (16 px) para que no se corte.
  Si algo toca el borde, al guardar aparece «Que entre todo».
- Ícono del pack (bandeja): 96×96, PNG, 50 KB como mucho.
- Pack: de **3 a 30** stickers; cada sticker con **1 a 3 emojis** (WhatsApp los usa para sugerirlo).
- Cada vez que cambia un pack sube su versión (`v`): WhatsApp lo vuelve a leer.

### Cómo se guarda un pack

```json
{ "id": "pmwp7ilhe", "nombre": "Mis stickers", "autor": "Stickerazo", "bandeja": "bandeja.png", "v": 4, "n": 4,
  "stickers": [ { "archivo": "s1.webp", "emojis": ["😎"] } ], "creado": 0, "mod": 0 }
```

La lista de packs es un JSON; cada archivo va en `<id del pack>/<archivo>`. La app de Android los guarda en su
memoria y un `ContentProvider` se los da a WhatsApp.

## Probarlo

```sh
sh herramientas/bajar.sh                          # MediaPipe y los modelos (comprueba las huellas)
cd pruebas
node recorte.mjs CARPETA_DE_FOTOS                 # el recorte con fotos de verdad → hojas en /tmp/claude-0/sz_recorte
node app.mjs CARPETA_DE_FOTOS                     # la app entera en un celular simulado → capturas en /tmp/claude-0/sz_app
```

`app.mjs` usa toques de verdad (no clicks): recorta una persona y un perro, borra con el dedo, deshace, toca para
sumar y sacar, arrastra un texto, agranda y gira con dos dedos, hace un sticker de sólo texto, guarda 4 stickers en un
pack y revisa cada archivo (tamaño, peso, transparencia, margen, emojis). Necesita en la carpeta de fotos
`grace_hopper.jpg`, `YellowLabradorLooking_new.jpg` y `burger.jpg` (fotos de muestra de TensorFlow/MediaPipe; no van
en el repo ni en la app).

Última corrida: 27 de 27 bien, 0 errores en la página. Recorte de una persona en 1,3 s (con la carga de los modelos),
el perro en 0,8 s. Los stickers pesan entre 26 y 60 KB.

## Falta

1. **App de Android**: WebView con el puente `SZN`, elegir foto y cámara, `ContentProvider` con el contrato de
   WhatsApp, el botón «Agregar a WhatsApp» (intent `ENABLE_STICKER_PACK`) y saber si ya está agregado. Firma propia,
   guardada **fuera del repo**.
2. Marca (ícono), packs listos con frases nuestras, ficha de Play Store y política de privacidad.
