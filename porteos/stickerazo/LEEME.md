# Stickerazo

App para hacer stickers de WhatsApp con tus fotos: elegís una foto, la recorta sola (en el celular, la foto no sale a
ningún lado), le ponés texto y emojis, y armás packs de 3 a 30 stickers que se agregan a WhatsApp con un botón.

Es un proyecto **comercial** (anuncios y Premium más adelante): todo es propio o con licencia que permite venderlo.
Lo de terceros está en [LICENCIAS.md](LICENCIAS.md).

## Lo que tiene (y las otras apps no)

Miramos Sticker.ly y las demás (feed de packs, recorte con IA, texto, animados sólo a partir de un video; las quejas:
casi todo pago, mucha publicidad, cobros de suscripciones). Lo nuestro:

- **Animar cualquier sticker de un toque**, sin video: Latido, Temblor, Rebote, Giro, Flotar, Bamboleo, Pum, Escribir
  (letra por letra), Parpadeo y Arcoíris, cada capa por su lado. Sale un WebP animado de 512×512 y ≤ 500 KB (el
  navegador no sabe hacerlos: `webpAnimado` arma el formato con cada cuadro recortado a lo que tiene dibujado).
- **Solo la cara** (pelo, cara y lo que tenga puesto en la cabeza) y **Cabezón**: la cabeza aparte, 1,5 veces más
  grande y apoyada en el cuello, lista para «Bamboleo».
- **Pack express**: hasta 30 fotos de una; las recorta todas y arma el pack.
- **Completar a 3**: WhatsApp pide 3 stickers; si tenés 1 o 2, hace variaciones (espejado, otro color, otra animación).
- **Todo se vuelve a editar**: cada sticker guarda su proyecto (capas e imágenes); al cambiarlo, el pack sube de versión
  y WhatsApp lo vuelve a leer.
- **Emojis automáticos** según lo que dice («jaja» → 😂, «mate» → 🧉, «milanesa» → 🍕), para que WhatsApp lo sugiera.
- **Frases listas** de acá y **globo de diálogo**.
- **490 letras**: las 6 de la app y 484 más de Google Fonts (`herramientas/fuentes_extra.py`): 161 divertidas,
  116 a mano, 48 gruesas, 59 retro, 42 elegantes y 58 modernas, con buscador. No van en la app: viven en
  `fuentes/` (27,9 MB en total), se bajan del servidor (`/sz/fuentes/`) recién al elegir una y quedan guardadas en el
  celu. El selector las muestra con su forma usando una imagen de muestras por tipo (`herramientas/muestras_fuentes.mjs`,
  744 KB las 6, usadas de máscara: sirven en los dos temas), que se baja recién cuando aparece una de ese tipo.
  Licencias: las que tienen «nombre reservado» en la OFL (125) van tal cual, el .ttf original sin tocar; las demás,
  recortadas a caracteres latinos en WOFF2 (unos 30 KB cada una). Las variables con nombre reservado quedaron afuera.
- **El texto, a fondo**: vista de cómo queda mientras escribís; color propio y degradés (atardecer, neón, oro, fuego…);
  contorno de 8 colores y 3 grosores; sombra suave o 3D; en arco (∩) o en sonrisa (∪); letras juntas o separadas.
- **«Ajustes»** de lo que tocaste: al frente o al fondo, duplicar, espejo, opacidad y, en las fotos, 8 filtros (B y N,
  sepia, vintage, frío, cálido, vívido…) más brillo, contraste y color. Todo queda en el proyecto y se vuelve a editar.
- **Packs listos editables** (`web/listos.js`, contenido nuestro: 5 packs, 36 stickers, uno animado) y **búsqueda**
  por palabra o por emoji en los listos y en los tuyos.
- Sin cuenta, sin marca de agua, y las fotos no salen del celular.

## La comunidad (como una red social)

- **Inicio** es el feed: «Para vos» (lo que más gusta y se baja, pesado por lo nuevo), «Recién salidos» y «Seguidos».
  Tarjetas que entran animadas, **doble toque = me gusta** (con un corazón que explota), tirar para abajo actualiza y
  baja más al llegar al final.
- **Pack publicado**: seguir al autor, me gusta, **Agregar a WhatsApp** (se baja a Mis packs y se agrega), compartir
  (manda el enlace `/p/ID`, una página con la vista previa y un botón que abre la app: `stickerazo://pack/ID`),
  denunciar y bloquear.
- **Perfil**: tu @ (sin email: el celular guarda una llave), **tu foto** o un emoji con color, **tu portada** (una imagen
  tuya o las nuestras), bio, packs, seguidores,
  descargas y me gusta; editar; **borrar la cuenta** (como pide Google Play).
- **Publicar** desde cualquier pack tuyo (con etiquetas sugeridas), y **actualizarlo** si lo cambiás. Sólo se suben
  los stickers terminados: las fotos quedan en el celular.
- **Buscar**: «Lo más picante» (etiquetas en tendencia), gente por @ y packs por lo que dicen, etiqueta o emoji.
- Moderación: nombres y textos filtrados (odio, sexual; sin falsos positivos como «controlo»), límites por persona,
  **3 denuncias ocultan un pack** hasta revisarlo, y `/admin` para revisar (con la clave `ADMIN_CLAVE`).
- Sin conexión la app anda igual (muestra los packs listos mientras tanto).

### El servidor (`servidor/`, Cloudflare Worker + D1)

**Dónde corre ahora:** adentro del Worker de JXMod (`porteos/jxmod/tienda`), en
`https://rezobox-tienda.holasoyjuniors365.workers.dev/sz`, y se publica solo con cada push (Workers Builds), como JXMod.
Usa sus propias tablas con `sz_` adelante en la misma base, así no toca las de JXMod. El mismo `servidor/worker.js`
también anda como Worker propio (su `wrangler.toml`), por si un día se quiere separar: se cambia la dirección en
`web/comunidad.js` (API) y en `Almacen.POLITICA`.

`worker.js` hace todo: cuentas, packs (revisa cada WebP y el ícono como WhatsApp), feed, me gusta, seguir, buscar,
tendencias, denuncias, moderación y las páginas `/privacidad`, `/terminos`, `/borrar-cuenta`, `/admin` y `/p/ID`.
Los archivos van en la misma base (o en R2 si se agrega el balde `MEDIA`).

**Ponerlo en marcha (una sola vez):** en Cloudflare → Workers & Pages → Crear → Importar un repositorio → este repo,
rama `claude/ports-continuation-dm754a`, carpeta `porteos/stickerazo/servidor`. La base D1 se crea sola al desplegar
y el servidor arma sus tablas. Después, cada push lo actualiza. Opcional: el secreto `ADMIN_CLAVE` (para `/admin`).
La app lo busca en `https://stickerazo.<tu subdominio>.workers.dev` (`web/comunidad.js`, `API`).

## Memes «xD», el inicio y la bienvenida

- **184 memes en 19 packs** (Argentina y México, Chile, Perú, Colombia, Venezuela, Uruguay), con fotos libres (CC0 o
  dominio público, cada una anotada en `web/memes/FUENTES.txt`) arruinadas a propósito: ojo de pez, aplastadas,
  quemadas, calidad trucha, espejo, lentes pixelados. El texto lo dibuja la app (Comic xD, IMPACT o la franja blanca), así
  que se puede cambiar. Se arman con `herramientas/memes_libres.py` a partir de `herramientas/memes_lista.py`.
- **Modo xD en el editor**: los mismos efectos para las fotos de cada uno, lentes que se mueven y «Sin efectos».
- **Inicio tipo red social**: buscador, «¿De dónde sos?» (los packs de tu país primero), historias con anillo de colores y
  banners que pasan solos (hechos con IA, sin texto: las letras las pone la app).
- **Transición líquida**: bolas de color que salen del dedo, tapan la pantalla y se escurren (respeta «menos movimiento»).
- **Bienvenida** la primera vez: tres pantallas animadas y el país.
- **Perfil**: portada (degradés o los banners), avatar encima, editar, compartir, «Publicados» y «Bajados», y el país en
  los ajustes.

## El evento del termo, la música y el modo claro

- **El termo de los elegidos** (primer evento): cuando 20 cuentas tienen packs publicados, el servidor sortea 5 al azar,
  una sola vez (`/api/evento`). Sus stickers giran pegados a un termo 3D (hecho con IA, mostrado con Three.js; si no hay
  WebGL, uno de CSS) y a los que recién bajan la app se los recomendamos primero en «Para vos». Tienen la insignia del termo.
- **Ocultar** un pack propio de la comunidad sin borrarlo, **sacarlo** del servidor, y **«No me interesa»** para los ajenos.
- **Música de tu país**: géneros de cada país y un buscador; suena en el reproductor oficial de YouTube, flotando y movible,
  como un tocadiscos: el video es la tapa y el vinilo, con la portada, sale por arriba y gira mientras suena. Con ▾ se
  achica a un disquito abajo que no molesta; achicado queda **en pausa** y al tocarlo sigue, porque YouTube no permite
  que suene con el reproductor escondido o de menos de 200×200 (si lo hiciéramos, cortan el acceso y las tiendas
  rechazan la app). Música sonando de fondo con el disco chico sólo se puede con canciones propias o con licencia.
- **Modo claro, oscuro o como el celular**, con un círculo que se abre desde el dedo al cambiarlo.
- **Perfil animado**: sus stickers flotando en la portada, un anillo de colores que gira y los números que suben.
- **Foto y portada propias**: se eligen de la galería, se recortan al centro en el celu (foto 400×400, portada
  1200×560, WebP) y se suben a `PUT /api/yo/foto` y `/api/yo/portada` (máx. 20 por día). Se ven en `/u/ID/foto` y
  `/u/ID/portada`. «Denunciar el perfil»: con 3 denuncias la foto y la portada se sacan solas y vuelve el emoji.

## Bien argento

- **Fileteado**: un estilo de letra propio (dorado con contorno oscuro, volutas a los costados con su flor y su hoja,
  una flor arriba y una guarda abajo), al estilo del filete porteño.
- **12 packs listos** (78 stickers, todos editables): Respuestas al toque, Mate y facturas, Animados que hablan, Laburo
  y lunes, Fútbol con amigos, Asado del domingo, El grupo de la familia, Amor y chamuyo, Calor frío y humedad, Bondi
  y llegadas tarde, Vamos Argentina (sin escudos ni marcas) y Fileteado porteño.
- La app habla como hablamos («Para vos», «Recién salidos», «Está todo muy tranqui», «¡Joya!»), y «Hecho en
  Argentina 🇦🇷».

## Cómo está hecho

La interfaz es una página web (`web/`) que en el celular corre dentro de la app de Android (`android/`).
Lo que necesita el celular (guardar los packs donde WhatsApp los lee, el botón «Agregar a WhatsApp») lo pide por un
puente (`window.SZN`); en el navegador, para probar, usa IndexedDB.

| Archivo | Qué hace |
|---|---|
| `web/index.html`, `web/estilo.css` | las 4 pantallas: Inicio, Recortá, Decorá y el pack (tema oscuro, amarillo y rosa) |
| `web/app.js` | lo que hace cada botón: recorte con el dedo (tocar, borrar, recuperar, con lupa), editor con gestos (arrastrar, pinza de dos dedos, manija), guardar en packs |
| `web/recorte.js` | separa lo importante del fondo con MediaPipe: personas solas (modelo «selfie multiclase», que además da la cabeza: pelo + cara + accesorios) y cualquier cosa tocándola («magic touch») |
| `web/editor.js` | el sticker: capas (foto, textos, emojis, globo) en 512×512, las animaciones, el borde con sombra, «que entre todo», el proyecto para volver a editar, WebP ≤ 100 KB, WebP animado ≤ 500 KB y el ícono 96×96 |
| `web/listos.js` | los packs listos (frases nuestras), que se arman en el celular con el mismo editor |
| `web/puente.js` | guardar/leer packs y archivos, y hablar con WhatsApp (app de Android o navegador) |
| `web/fuentes/` | las 5 letras para los textos (Apache-2.0 y OFL) |
| `web/terceros/` | MediaPipe y los modelos: **no van en el repo**, los baja `herramientas/bajar.sh` |

### La app de Android (`android/`, paquete `com.stickerazo.app`, Android 7 en adelante)

| Archivo | Qué hace |
|---|---|
| `Inicio.java` | la WebView con la página (servida en `https://appassets.androidplatform.net`, el dominio que Android reserva para esto), de borde a borde, el botón atrás, elegir foto (selector de fotos de Android, sin permisos) o sacarla (la app de cámara del teléfono) |
| `Imagen.java` | la foto elegida, derecha, achicada a 1600 px y en JPEG (o PNG si tiene transparencia): así abre también HEIC |
| `Puente.java` | `window.SZN`: leer y guardar packs y archivos, agregar a WhatsApp, saber si ya está, compartir |
| `Almacen.java`, `Json.java` | **Java puro** (se prueba sin teléfono): `packs.json` y `packs/<id>/<archivo>` en la memoria de la app, nombres validados (sin «..»), escritura que nunca deja un archivo a medias, y las filas que se le dan a WhatsApp |
| `Stickers.java` | el proveedor que lee WhatsApp (`metadata`, `stickers/<id>`, `stickers_asset/<id>/<archivo>`), sólo para WhatsApp (permiso `com.whatsapp.sticker.READ`) |
| `WhatsApp.java` | el pedido `ENABLE_STICKER_PACK` (WhatsApp normal y Business) y la pregunta «¿ya lo tenés?» |
| `Fotos.java` | las fotos de paso (la de la cámara y las convertidas), privadas |

Sin permisos de fotos ni de cámara; sólo `INTERNET` (para los anuncios de más adelante: la página y las fotos no usan
la red). El ícono lo dibuja `herramientas/icono.mjs` (adaptativo, redondo, monocromo y el de 512 para Play Store en
`marca/`).

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
- Animado: 512×512, WebP, **500 KB como mucho**, 10 s como mucho, cada cuadro de 8 ms o más; el primer cuadro es el
  sticker quieto (todas las animaciones arrancan en reposo). Un pack es **todo animado o todo quieto**
  (`animated_sticker_pack`).
- Ícono del pack (bandeja): 96×96, PNG, 50 KB como mucho (también en los animados).
- Pack: de **3 a 30** stickers; cada sticker con **1 a 3 emojis** (WhatsApp los usa para sugerirlo).
- Cada vez que cambia un pack sube su versión (`v`): WhatsApp lo vuelve a leer.

### Cómo se guarda un pack

```json
{ "id": "pmwp7ilhe", "nombre": "Mis stickers", "autor": "Stickerazo", "bandeja": "bandeja.png", "v": 4, "n": 4,
  "stickers": [ { "archivo": "s1.webp", "emojis": ["😎"] } ], "creado": 0, "mod": 0 }
```

La lista de packs es un JSON; cada archivo va en `<id del pack>/<archivo>`. La app de Android los guarda en su
memoria y un `ContentProvider` se los da a WhatsApp.

## Probarlo y armarlo

```sh
sh herramientas/bajar.sh                          # MediaPipe y los modelos (comprueba las huellas)
pruebas/correr.sh CARPETA_DE_FOTOS                # todo: Java puro, navegador, «como la app» y el APK
python3 -I herramientas/armar_apk.py [SALIDA.apk] [--version-name 0.1]   # sólo el APK
node pruebas/recorte.mjs CARPETA_DE_FOTOS         # el recorte con fotos de verdad → hojas en /tmp/claude-0/sz_recorte
```

- `PruebaAlmacen.java` (21): JSON con emojis y mal formado, 18 nombres peligrosos rechazados, límites, packs mal
  formados que se saltean, las filas de WhatsApp, y 400 escrituras con 4000 lecturas a la vez sin ver nunca un archivo
  a medias.
- `MODO=app node app.mjs` (32): la misma prueba de abajo pero como en el celular: la página llama a `window.SZN`
  sincrónico (como la WebView) y del otro lado está el `Almacen` de verdad (`ServidorPrueba.java`, que también contesta
  lo que contestaría `Stickers.java`); al final revisa las columnas, el ícono y los 4 WebP tal como los leería WhatsApp.

`app.mjs` usa toques de verdad (no clicks): recorta una persona y un perro, borra con el dedo, deshace, toca para
sumar y sacar, arrastra un texto, agranda y gira con dos dedos, hace un sticker de sólo texto, guarda 4 stickers en un
pack y revisa cada archivo (tamaño, peso, transparencia, margen, emojis). Necesita en la carpeta de fotos
`grace_hopper.jpg`, `YellowLabradorLooking_new.jpg` y `burger.jpg` (fotos de muestra de TensorFlow/MediaPipe; no van
en el repo ni en la app).

Última corrida: navegador y «como la app» completas, Java 23 de 23, servidor 45 de 45, comunidad (dos personas)
30 de 30, 0 errores en las páginas; APK de 25,5 MB.

- `servidor_api.mjs` (45): el servidor de verdad sobre SQLite (`d1_falsa.mjs`): nombres rechazados, publicar y lo que
  no se puede publicar, feed, me gusta, seguir, descargas, buscar, tendencias, actualizar, bloquear, 3 denuncias,
  moderación, borrar la cuenta, CORS y las páginas.
- `social.mjs` (30): dos personas en dos celulares (toques de verdad): entrar, publicar con confeti, verlo en el feed,
  doble toque, seguir, bajar, buscar, el enlace que abre la app, denunciar, bloquear, editar el perfil, borrar la cuenta
  y sin conexión.
Además de lo de antes, la prueba edita un sticker guardado, anima uno, completa un pack animado, hace Solo cara y un
Cabezón con bamboleo y globo, un Pack express de 5 fotos, busca por palabra y por emoji, y agrega un pack listo.
Un animado tarda de 1,5 a 7 s en armarse (los de 2,4 s bajan a 10 u 8 cuadros por segundo para no bajar de calidad 0,6). Recorte de una persona en 1,3 s (con la carga de los modelos),
el perro en 0,8 s. Los stickers pesan entre 26 y 60 KB.

## Se actualiza sola (como JXMod)

La app trae la página adentro, pero al abrirla (y cada 6 horas) se fija si hay una versión nueva (`web/ota.json`).
Primero le pregunta a nuestro servidor (`/sz/web/…`, que lo trae del repo: si la rama cambia de nombre se cambia
`SZ_RAMA` en Cloudflare y listo, sin APK nuevo) y, si no contesta, a GitHub directo. Baja **sólo los archivos que cambiaron**, revisa cada uno con su huella (sha256) y la
lista entera con una **firma** (ECDSA P-256) cuya llave no está en el repo: si alguien tocara el repo, la app no le hace
caso. Arma la versión nueva en su carpeta, avisa «¡Stickerazo nuevo!» (abrirla ahora o la próxima vez) y la página
abierta sigue con la suya hasta entonces (nada se mezcla). MediaPipe y los modelos vienen en el APK y no se bajan.

- **Publicar una versión nueva de la página:** `python3 -I herramientas/ota.py` (o armar el APK, que lo hace solo) y
  subir `web/` (commit y push). Si la página empieza a usar algo nuevo del puente con Java, subir `OTA_APK_MIN` en
  `armar_apk.py` (los celulares con un APK más viejo no la toman y siguen con la suya).
- Prueba: `PruebaOta.java` (11): firma de Python revisada en Java, baja sólo lo que cambió, un archivo o una firma
  tocados no hacen nada, nada de «..», APK viejo no.
- La llave de las actualizaciones: `/root/.stickerazo/firma/ota.pem` (o el secreto `STICKERAZO_OTA_PEM_B64`). Sin ella
  no se pueden firmar versiones nuevas: los celulares seguirían con la última.

### El APK nuevo (cuando cambia algo de Java)

La página se actualiza sola; el APK sólo hace falta cuando cambia la parte de Android, que es raro. Para eso:

- `descargas/Stickerazo.apk` y `descargas/app.json` (versión, tamaño, huella) son el APK de la página. Se publican con
  `armar_apk.py … --canal web --publicar`, que además vuelve a firmar `ota.json` con la huella del APK.
- La app (canal «web») ve en `/sz/app.json` que hay uno nuevo, avisa «Llegó Stickerazo 0.x» y, con «Actualizar», lo baja
  (`ApkBajada`: sólo acepta el archivo con el tamaño y la huella firmados en `ota.json`) y lo instala con el instalador de
  Android (`Actualizador`, PackageInstaller). La primera vez Android pide el permiso de «instalar apps desconocidas» y
  confirmar; desde Android 12 las siguientes pueden entrar sin preguntar.
- Los 0.6 (sin «Actualizar» en el puente) también ven el aviso, porque llega con la página: el botón los manda a bajarlo de
  la página.
- Los de las tiendas (`--canal galaxy|huawei|uptodown|play`) no tienen el permiso de instalar y no avisan: los actualiza
  su tienda. Todos los APK de una versión se arman con el mismo `--version-code`.
- Pruebas: `PruebaApkBajada.java` (7: el bueno entra; cambiado, cortado o de más, no; si una fuente falla, prueba la
  siguiente) y el aviso en el navegador con un puente de mentira (web bajando y con error, 0.6, al día, Galaxy).

## La página web

`sitio/index.html` y `sitio/a/` (capturas de la app de verdad, los stickers del gráfico, el ícono y la letra del logo).
Está en **https://stickerazo.pages.dev** (Cloudflare Pages, sin el nombre de la cuenta): `sitio_pages/publicar/_worker.js`
le pide todo al servidor por un enlace directo (`[[services]]`, porque entre proyectos de una cuenta no se puede por
`workers.dev`) y el servidor lo trae del repo, así que **se actualiza sola** con cada push. También se ve en `/sz/` del
servidor. Ahí van también los packs compartidos (`/p/ID`), las reglas y la privacidad: la app los abre por esa dirección
(`SITIO` en `comunidad.js`) y el servidor arma los enlaces de esas páginas con la dirección que le pasa el proxy
(`X-Sitio`, sólo si es `stickerazo.pages.dev`). Si la página anda suelta en otro lado, la versión y la descarga salen
del servidor o, si no contesta, de GitHub. Desplegar el proxy (sólo si cambia): `wrangler pages deploy` en `sitio_pages/`. Las capturas salen de `herramientas/capturas_play.mjs`, el mismo que
arma las de las tiendas. Rutas: `/sz/` (la página), `/sz/a/…`, `/sz/descargar` (el APK), `/sz/app.json`, `/sz/web/…`.

## Entrar con Google (obligatorio para la comunidad)

`servidor/google.js`, como en JXMod: la app arma un verificador `v`, abre en el navegador `<servidor>/entrar?e=SHA256(v)`
(Google no deja entrar adentro de una WebView), la página muestra el botón de Google y manda el ID token a
`POST /api/google` (se revisan la firma con las claves de Google, el emisor, la audiencia, el vencimiento y el nonce);
la app pregunta en `POST /api/google/listo` con `v` y se lleva la sesión una sola vez. Cuenta nueva: un ticket para
elegir el @ (`POST /api/registro {nombre, ticket}`). Cuenta vieja (sólo @): al entrar con Google se le vincula, y hasta
entonces no puede escribir nada (403 `{google: true}`: la app muestra la hoja «Conectá tu cuenta de Google»). De Google se
guarda sólo una huella del id (`usuarios.google`). Borrar la cuenta desde la web: `<servidor>/borrar` (con Google).
El cliente de Google es `SZ_GOOGLE_CLIENT_ID` (una variable del Worker; puede ser el mismo cliente de JXMod). Antes de
prenderlo, en Google Cloud ese cliente tiene que tener autorizado el origen del servidor
(`https://rezobox-tienda.holasoyjuniors365.workers.dev`): si no, Google rechaza el botón («origin is not allowed») y nadie
podría entrar. Sin la variable, Google queda apagado y vale el @ solo, como antes. Pruebas: `google.mjs` (25: tokens falsos, nonce, ticket, vincular, exigir, borrar, contacto) y `google_app.mjs`
(8, en la app: botón, esperar, elegir @, cuenta vieja).

## Los anuncios (AdMob, desde la 0.8)

`android/src/.../Anuncios.java` (con la interfaz `Publicidad`; `Inicio` lo crea si el APK lo trae):
- **Consentimiento**: primero el aviso de Google (UMP), sólo donde la ley lo pide. Sin consentimiento no se piden
  anuncios. En Ajustes aparece «Privacidad de los anuncios» cuando hace falta.
- **Banner**: adaptable, abajo de todo, en su propio lugar debajo de la WebView (no tapa la página). Se esconde mientras
  recortás o editás (`SZN.anuncioBanner`, desde `ir()` en `app.js`).
- **Intersticial**: sólo en pausas naturales (`SZN.anuncioPausa`, hoy después de «Agregar a WhatsApp»). Nunca en el
  primer minuto y medio, y como mucho uno cada 4 minutos.
- **Los ID**: `android/anuncios.json` (hoy los de **prueba** de Google; `armar_apk.py --publicar` no deja publicar así).
- **El armado sin Gradle**: `herramientas/libs_anuncios.json` (57 librerías de AdMob 25.5 y UMP 4.0, con su huella).
  `herramientas/libs_android.py` las baja a `/tmp/claude-0/sz_libs`, las desarma y fusiona sus manifiestos (respeta
  `tools:node`; queda afuera RECEIVE_BOOT_COMPLETED). `aapt2` compila sus recursos (gana la app) y genera las `R` de las
  11 librerías que las usan. `javac` las tiene en el classpath, `d8` hace 2 dex, y van los `META-INF/services` de las
  corrutinas.
- **Lo que revisa el armado**: que cada actividad, servicio, receptor y proveedor del manifiesto tenga su clase en el
  dex, el ID de AdMob y los `META-INF/services`. `--sin-anuncios` arma como antes, sin AdMob.
- El APK pasa de 32,3 a 37,8 MB.

## Privacidad, términos y contacto

`sitio/privacidad.html`, `terminos.html`, `borrar-cuenta.html` y `contacto.html` (con `sitio/a/legal.css`): completas,
con lo que hace el código de verdad (qué se guarda, cuánto, con quién, permisos, derechos y la leyenda de la Ley 25.326).
El servidor las sirve en `/privacidad`, `/terminos`, `/borrar-cuenta` y `/contacto` (y quedan las cortitas de respaldo).
El formulario de contacto manda a `POST /api/contacto` (5 por día por conexión; se borran al año) y los mensajes se ven
en `/admin` («Ver mensajes de contacto»).

## Las tiendas

Todo en [`tiendas/LEEME.md`](tiendas/LEEME.md) (cuál conviene, cuánto cuesta, paso a paso) y
[`tiendas/ficha.md`](tiendas/ficha.md) (los textos y las respuestas de los formularios).

## La firma

El APK se firma con `/root/.stickerazo/firma/stickerazo.jks` (alias `stickerazo`, clave en `clave.txt` al lado), **fuera
del repo**. Si no está, el armado crea una nueva. Las versiones nuevas sólo se instalan encima si tienen la misma firma:
para que dure entre sesiones hay que guardarla como secretos del entorno (`STICKERAZO_FIRMA_JKS_B64` y
`STICKERAZO_FIRMA_CLAVE`). En Google Play esta firma es la «de subida» (Play firma la app con la suya): si se perdiera,
se cambia desde la consola de Play.

## Falta

1. Probarlo en un celular de verdad (lo que no se puede acá: la WebView, el selector de fotos, la cámara y el pedido a
   WhatsApp).
2. Abrir las cuentas de las tiendas (a nombre del dueño): ver `tiendas/LEEME.md`.
3. Probar en un celular de verdad la instalación del APK nuevo desde adentro de la app (el permiso, la ventanita de
   Android y que se instale encima sin perder nada).
