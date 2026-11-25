# TRASPASO: todo lo que sabe Claude de estos proyectos (25/11/2026)

Escrito para **la sesión nueva que se dedica a ganar plata** (objetivo: **US$10 en 7 días**). Esta sesión sigue con
**JXMod**: primero la versión web (bugs, sugerencias y errores del panel) y después el nativo.

Cubre todo el trabajo desde el primer commit (13/10/2026) hasta hoy (25/11/2026): 428 commits en la rama
`claude/ports-continuation-dm754a` del repo `Juniorspro/Ports`. Al final están la lista de tareas (apéndice A) y la
historia completa de commits (apéndice B).

---

## Índice

0. [Lo primero, para la sesión nueva](#0-lo-primero-para-la-sesión-nueva)
1. [El objetivo: US$10 en una semana](#1-el-objetivo-us10-en-una-semana)
2. [El dueño y cómo trabajar con él](#2-el-dueño-y-cómo-trabajar-con-él)
3. [Seguridad: secretos, chequeos y lo que no se puede hacer](#3-seguridad-secretos-chequeos-y-lo-que-no-se-puede-hacer)
4. [El repo y la infraestructura](#4-el-repo-y-la-infraestructura)
5. [Stickerazo](#5-stickerazo)
6. [JXMod web (el «normal»)](#6-jxmod-web-el-normal)
7. [JXMod nativo (Rust, sin WebView)](#7-jxmod-nativo-rust-sin-webview)
8. [JXMod Personal](#8-jxmod-personal)
9. [JX Hand Engine](#9-jx-hand-engine)
10. [JXBot, el bot de Discord](#10-jxbot-el-bot-de-discord)
11. [Geometry Dash → HTML5](#11-geometry-dash--html5)
12. [Videos, tráilers y marca](#12-videos-tráilers-y-marca)
13. [Investigaciones: stickers con sonido, Baileys, Whapi](#13-investigaciones-stickers-con-sonido-baileys-whapi)
14. [Todo lo que quedó pendiente](#14-todo-lo-que-quedó-pendiente)
15. [Comandos útiles](#15-comandos-útiles)
- [Apéndice A: las tareas, de la 1 a la 122](#apéndice-a-las-tareas-de-la-1-a-la-122)
- [Apéndice B: la historia completa de commits](#apéndice-b-la-historia-completa-de-commits)

---

## 0. Lo primero, para la sesión nueva

1. **El repo es público.** `Juniorspro/Ports`, rama `claude/ports-continuation-dm754a`. Todo lo que se commitea lo ve
   cualquiera: nada de secretos, ni datos de clientes (nombres, teléfonos, direcciones, fotos), ni el email del dueño.
2. **Esta sesión sigue commiteando en esa rama** (JXMod). Vos trabajá en la rama que te asigne tu entorno y traé lo de
   acá cuando haga falta: `git fetch origin claude/ports-continuation-dm754a && git merge --no-edit FETCH_HEAD`.
   **No pushees a `claude/ports-continuation-dm754a`** sin que el dueño lo diga, por dos razones:
   - chocaríamos las dos sesiones;
   - **cada push a esa rama publica solo el Worker de Cloudflare** (Workers Builds), el que atiende a JXMod, a Stickerazo
     (`/sz`), al panel y al bot de Discord. Un error ahí rompe todo eso para todos.
3. **No toques JXMod** (juego, nativo, tienda, panel) salvo que el dueño lo pida: lo sigue esta sesión.
4. **Los secretos de esta máquina** (`/root/.cf/…`, `/root/.paypal/…`, firmas, tokens) probablemente **no estén en la
   tuya**: el contenedor es nuevo. Si hace falta uno, pedile al dueño que lo cargue como secreto del entorno (no por el
   chat, y nunca en el repo). Ver la sección 3.
5. Leé las secciones 1, 2 y 3. Lo demás es referencia para cuando haga falta.

---

## 1. El objetivo: US$10 en una semana

El pedido del dueño, textual: «quiero ganar dinero pero no quiero estar publicando en Google Play y haciendo todo
trámites… ¿no puedo vender micro apps o apps o páginas, y que haya apps donde pueda publicar eso y esperar a que me
compren?» y después: «quiero al menos ganar 10 $ en una semana, pongamos ese objetivo».

### 1.1 Dónde estamos (números reales, 25/11/2026)

- **Stickerazo** (la app de stickers, comercial): la 0.8 está publicada en **https://stickerazo.pages.dev** (APK del
  canal web, versionCode 26112190, 21/11) y se mandó a revisión en **APKPure** el 21/11 (no sé si ya la aprobaron).
  La comunidad tiene **4 cuentas** con packs publicados (`GET /sz/api/evento` → `"cuentas": 4`).
- **Premium y donaciones de Stickerazo cobran de verdad con PayPal** (planes creados, `SZ_PAYPAL_MODO = "live"`):
  US$1,99 por mes, US$14,99 por año, US$29,99 de por vida y donaciones desde US$1. Pero con 4 usuarios activos no
  alcanza para US$10 en una semana: hace falta gente.
- **El Discord de JXApps** (JXMod y Stickerazo) pasó los **300 miembros** (hubo un evento por eso). Es casi todo gente
  que juega JXMod, y muchos son chicos.
- **JXMod no se puede vender ni monetizar.** Usa cosas sacadas de otros juegos y su regla es «sin fines de lucro»
  (`porteos/jxmod/CLAUDE.md`): nada de cobrar por JXMod, ni Premium, ni anuncios, ni donaciones «para JXMod».
  Lo mismo con JXMod Personal y con el porteo de Geometry Dash.
- **Cobrar:** la cuenta **PayPal Business es del papá del dueño** (PayPal pide 18 años); es la que usa Stickerazo.
  Cualquier cuenta que reciba plata (PayPal, Mercado Pago, Gumroad, itch.io, AdMob…) va a nombre de un adulto: el papá.
  No hay que mentir la edad en ningún lado: si lo descubren, cierran la cuenta y se pierde lo cobrado.

**La conclusión honesta:** en 7 días, lo más seguro es **venderle un servicio a gente de verdad** (conocidos, familia,
emprendimientos del barrio) y cobrarlo por Mercado Pago o PayPal del papá. Las tiendas de productos digitales
(Gumroad, Payhip, itch.io, CodeCanyon) son ingreso de a poco **más adelante**: sin público propio, en una semana casi
seguro dan 0. Igual conviene dejarlas armadas (día 7).

### 1.2 Qué vender esta semana

| Qué | Precio sugerido | Ventas para llegar | Qué hace Claude | Qué hace el dueño |
|---|---|---|---|---|
| **Invitación digital** (15 años, cumple, casamiento, bautismo, baby shower): una página con cuenta regresiva, foto, día y hora, mapa, música, «Confirmar por WhatsApp», datos para regalos y galería | US$8–12 (o lo mismo en pesos) | **1** | la plantilla, el generador, llenarla con los datos y publicarla (Cloudflare Pages, gratis) en menos de una hora | conseguir el cliente, pedirle datos y fotos, cobrar, mandarle el link |
| **Página para un emprendimiento** (comercio, emprendimiento de Instagram, profe particular, servicio): qué hace, productos con precio, fotos, horarios, ubicación, botón de WhatsApp | US$10–20 | **1** | igual que arriba | igual que arriba |
| **Pack de stickers a pedido** con las fotos del cliente (su cara, su mascota, la familia, el grupo de amigos, el logo de su negocio), quietos o animados | US$1–2 por pack de 10–15 | 5–10 | ejemplos, textos y la lista de precios | hacerlos en Stickerazo (minutos) y mandarlos |
| **Bot de Discord para un server** (bienvenida, roles con botones, niveles, moderación, como JXBot) | US$5–10 | 1–2 | adaptar JXBot como Worker aparte para ese server | conseguir el server; el dueño del server crea su bot y pasa el token |
| **Stickerazo Premium / donar** | ya publicado | — | — | difundir la app (es gratis; Premium es opcional) |

Lo que más rinde es **la invitación digital y la página de emprendimiento**: una sola venta cumple el objetivo, se
hace rápido con una plantilla, y es algo que la gente ya paga (las invitaciones digitales se venden mucho en
Latinoamérica). Los stickers sirven para mostrar algo rápido y sumar de a poco.

**Cómo se entrega cada cosa:**
- **Invitación o página:** un link (`algo.pages.dev`, gratis, en la cuenta de Cloudflare del dueño). Dominio propio
  (`.com.ar`, `.com`) sólo si el cliente lo paga aparte. Se cobra antes; se puede mostrar una vista previa.
- **Stickers:** dos formas. (1) Mandárselos por WhatsApp uno por uno; el cliente toca cada uno → «Añadir a Favoritos».
  (2) Que instale Stickerazo y publicar el pack para pasarle el link `/p/ID`: **queda público en la comunidad**, así que
  sólo con su permiso (después se puede «Ocultar» o «Sacar» desde la app).
- **Bot:** el cliente crea la aplicación en discord.com/developers (es de él), pasa el token por un medio privado y
  Claude lo pone como secreto del Worker. Nunca en el repo.

**Cómo se cobra:** transferencia o «link de pago» de **Mercado Pago del papá** (lo más común en Argentina),
**PayPal del papá** para el exterior, o efectivo. Montos chicos: se paga antes de entregar (o la mitad antes).

### 1.3 Plan día por día (jueves 26/11 → miércoles 2/12)

- **Día 1 (jue 26/11).** Claude arma (ver 1.5): la página-catálogo con los servicios, ejemplos y el botón de WhatsApp;
  dos invitaciones de muestra (15 años y cumple infantil) y una página de muestra de un emprendimiento inventado; los
  textos para mandar. El dueño: hace 3 packs de muestra en Stickerazo (su cara, su mascota, un meme), decide con su papá
  los precios en pesos y el medio de cobro (alias o link de pago de Mercado Pago), y le pasa a Claude el número de
  WhatsApp para el botón **sólo si quiere que esté en una página pública**.
- **Día 2 (vie 27/11).** Difundir:
  - estado de WhatsApp con los stickers de muestra y el link de una invitación;
  - mensaje directo a 15 personas: familia, amigos, gente con un emprendimiento o con un cumple, 15 o casamiento cerca;
  - el grupo de la familia;
  - Instagram o TikTok: un video corto mostrando la invitación en el celular (o foto → sticker animado → WhatsApp).
  - En el Discord de JXApps, mejor promocionar la app gratis de Stickerazo que venderles cosas a chicos.
- **Días 3 a 5 (sáb 28 → lun 30).** Entregar en el día. Pedir una captura u opinión para mostrar. «Si alguien te
  compra por recomendación tuya, te hago un pack de stickers gratis». Cinco mensajes nuevos por día.
- **Día 6 (mar 1/12).** Si todavía no hubo ventas: una oferta de entrada (pack de 5 stickers baratísimo, o la primera
  invitación «pagá lo que te parezca» a cambio de poder mostrarla); grupos de Facebook de emprendedores de la ciudad
  (respetando sus reglas de publicidad).
- **Día 7 (mié 2/12).** Sumar lo cobrado y dejar armado lo que vende solo (1.6).

### 1.4 Textos listos para mandar (cambiar `$___` por el precio y `LINK` por el ejemplo)

**Estado de WhatsApp:**
> ¿Querés tus propios stickers? Te hago un pack con tus fotos: tu cara, tu perro, tu grupo de amigos. También
> animados. $___ el pack. Escribime.

**A alguien que tiene un emprendimiento:**
> ¡Hola ___! Estoy haciendo páginas para emprendimientos: tus productos con precios y fotos, horarios, dónde estás y
> un botón para que te escriban por WhatsApp. Queda en internet sin que tengas que mantener nada. Te la hago por $___.
> Mirá una de ejemplo: LINK. ¿Te copa?

**A alguien con un cumple, 15 o casamiento cerca:**
> ¡Hola ___! ¿Ya tienen la invitación? Hago invitaciones digitales: una página con cuenta regresiva, la foto, el mapa
> del lugar, música y un botón para confirmar por WhatsApp. Se manda por link. $___. Mirá una de ejemplo: LINK.

**TikTok / Instagram (texto del video):**
> Hice una invitación de 15 que se abre como una carta, con cuenta regresiva y música. Si querés la tuya, escribime.

### 1.5 Lo que tiene que hacer la sesión nueva (entregables)

Todo en una carpeta nueva, por ejemplo `ventas/` (en tu rama):

1. **Página-catálogo** de los servicios (nombre a elección del dueño: «JXApps Estudio» o el que diga), con ejemplos,
   precios y el botón de WhatsApp. HTML/CSS/JS propios, sin plantillas ni imágenes de otros.
2. **Plantillas de invitación** (2 o 3 estilos: elegante, infantil, moderno) que se arman desde un `datos.json`:
   nombres, fecha y hora (cuenta regresiva), lugar con link a Google Maps, música (archivo propio o con licencia, o
   un link a YouTube que abre afuera), foto, galería, «Confirmar por WhatsApp» (link `wa.me` con el texto armado),
   datos para regalos, código de vestimenta. Que ande perfecto en el celular y que pese poco.
3. **Plantilla de página de emprendimiento** con el mismo método.
4. **Un generador** (`node ventas/armar.mjs datos.json SALIDA/`) y la publicación con
   `wrangler pages deploy SALIDA --project-name …` (necesita el token de Cloudflare como secreto del entorno).
5. **Los datos de los clientes NUNCA van al repo** (es público): los `datos.json` reales y las fotos quedan en la
   carpeta temporal o en otro lado privado, y se publican directo a Cloudflare. En el repo, sólo plantillas y ejemplos
   con datos inventados.
6. Muestras publicadas para poner en los mensajes.
7. Una planilla simple de seguimiento (ver 1.8).
8. Imágenes con IA (Higgsfield): **avisar el costo en créditos antes** de generar. Mejor dibujos propios (SVG/CSS),
   que no cuestan nada.

### 1.6 Productos digitales (para dejar armados; venden de a poco)

| Dónde | Qué se vende | ¿Trae compradores? | Trámite | Ojo |
|---|---|---|---|---|
| **itch.io** | juegos, apps, herramientas, APKs, páginas HTML | sí, su propio público (sobre todo juegos) | casi nada; paga por PayPal | cuenta de pago a nombre del papá |
| **Gumroad / Payhip / Lemon Squeezy** | cualquier archivo: plantillas, código, packs | no: los compradores los traés vos | mínimo | titular adulto para cobrar |
| **CodeCanyon (Envato)** | código de apps y webs como base para otros | sí, el más grande de eso | revisan la calidad una vez | documentación en inglés; una app que es una WebView puede que la rechacen: probar antes en Gumroad |
| **Fiverr / Workana** | servicios | sí | perfil | piden 18 años y que la cuenta sea de quien hace el trabajo: **por ahora no** |
| **Flippa / Microns** | una app o página entera con sus usuarios | sí | — | cuando Stickerazo tenga gente |

Ideas concretas:
- **Plantillas de invitación** en Gumroad/Payhip (US$3–5): las compra gente que hace invitaciones.
- **Stickerazo en itch.io** gratis con «pagá lo que quieras».
- **El código de Stickerazo como plantilla** («app de stickers para WhatsApp: recorte con IA en el celular, editor,
  animados, packs, comunidad, Premium con PayPal»). Antes de venderlo hay que:
  - sacar todo lo que no se vende: las firmas, `ota.pem`, claves de PayPal y de Google, la dirección del servidor de
    JXMod, la búsqueda de música (`/api/yt` es de JXMod) y lo que dependa del Worker de la tienda (el servidor de
    Stickerazo también anda como Worker propio con su `wrangler.toml`);
  - cambiar la marca: «Stickerazo» y sus dibujos son nuestros; el comprador pone la suya;
  - revisar `porteos/stickerazo/LICENCIAS.md`: todo permite uso comercial (MediaPipe y sus modelos Apache-2.0, letras
    OFL/Apache —que se pueden incluir y vender **con** la app, no solas—, Three.js MIT, fotos de memes CC0 o dominio
    público). Las librerías de AdMob no van en el repo: las baja el armado;
  - documentación en inglés, capturas y un video demo.
- **JX Hand Engine** (sección 9) es código propio con modelos Apache-2.0: se podría vender algún día como SDK de
  seguimiento de manos en Rust para Android. Es de nicho.

### 1.7 Qué no vender y reglas para no tener problemas

- **Nunca:** JXMod, JXMod Personal, el porteo de Geometry Dash, ni nada que use cosas sacadas de otros juegos o apps.
- **Encargos con personajes o marcas** (Disney, anime, escudos de clubes, logos de otras marcas): no. Derechos de autor.
- **Fotos de personas:** sólo de quien las manda o con permiso de los que aparecen. Nada para burlarse de alguien.
- **No prometer lo que no se puede** (por ejemplo, stickers con sonido instantáneos: ver la sección 13).
- **Cobro por cuentas del papá y todo anotado.** Si se vuelve algo de todos los meses, ver con él el monotributo.
- **Entregar rápido y bien:** una persona contenta trae a otra.

### 1.8 Seguimiento

| Fecha | Cliente (sin datos personales en el repo) | Qué | Precio | Cobrado | Entregado |
|---|---|---|---|---|---|
| | | | | | |

Meta: **US$10 cobrados al miércoles 2/12.**

---

## 2. El dueño y cómo trabajar con él

- Habla en **castellano rioplatense**. Respuestas en ese castellano, simples, con números y capturas. Sin jerga.
- **Quiere que Claude haga todo.** Él sólo hace lo que necesita su identidad: crear cuentas, cobrar, apretar botones en
  paneles de Google/Cloudflare/tiendas, probar en su celular.
- **Gastar pocos créditos:** no lanzar agentes del modelo grande; agentes chicos (haiku o sonnet) sólo para cosas
  mecánicas o de búsqueda. Hacer uno mismo lo que son pocos pasos.
- **«Che, no dejes nada en segundo plano»:** todo en primer plano, de 10 minutos como mucho, con el tiempo límite
  explícito.
- **Commit y push después de cada paso** (con el pie de commit que indique el entorno).
- **Publicar versiones sólo cuando él lo dice** (JXMod, Stickerazo, el Worker).
- **Higgsfield** (imágenes, video, 3D, voces con IA): decir cuántos créditos cuesta **antes** de generar.
- **Íconos:** nunca emojis como íconos; se dibujan propios (SVG/Canvas).
- **Nunca repetir su email** ni mandar datos personales a servicios de afuera.
- Si rechaza un comando («No, pará»), parar y preguntar qué quiere.
- Le gusta que se busque a fondo y que se le diga la verdad cuando algo no se puede (ver la sección 13).
- Las cuentas que piden 18 años van a nombre de su papá (como la de PayPal).

---

## 3. Seguridad: secretos, chequeos y lo que no se puede hacer

### 3.1 Los secretos (nunca se commitean ni se muestran; acá sólo dónde están)

| Qué | Dónde (en la máquina de esta sesión) |
|---|---|
| Token y cuenta de Cloudflare | `/root/.cf/token`, `/root/.cf/cuenta` |
| PayPal (claves de la app y planes) | `/root/.paypal/claves.txt`, `/root/.paypal/planes.txt` (en Cloudflare: secreto `SZ_PAYPAL_SECRET`) |
| Bot de Discord | `/root/.discord/token`, `/root/.discord/codigo_admin` (en Cloudflare: `DISCORD_TOKEN`, `DISCORD_ADMIN_CODE`) |
| Clave de Gemini (el chat del bot) | `/root/.google/gemini_key` (en Cloudflare: `GEMINI_KEY`) |
| Firma del APK de Stickerazo | `/root/.stickerazo/firma/stickerazo.jks` + `clave.txt` (secretos del entorno: `STICKERAZO_FIRMA_JKS_B64`, `STICKERAZO_FIRMA_CLAVE`) |
| Llave de las actualizaciones de Stickerazo | `/root/.stickerazo/firma/ota.pem` (o `STICKERAZO_OTA_PEM_B64`) |
| Firma de JXMod (también firma los eventos en vivo y el panel) | `/root/.jxmod/firma` (`jxmod.jks`, `clave.txt`) |
| Firma de JX Hand | `/root/.jxhand/firma/jxhand.jks` + `clave.txt` |
| Códigos de la web de JXMod | `/root/.jxmod/codigos.txt` (Claude no lo puede leer: lo bloquea el clasificador) |
| Futuros: GIPHY | secretos del Worker `GIPHY_KEY`, `GIPHY_CANAL` (todavía no existen) |
| Futuro: Whapi | `/root/.whapi/token` (nunca se dio; el dueño lo descartó) |

**El código de acceso de la web de JXMod nunca va en texto público** (repo, commits, páginas). Antes de cada commit
de JXMod se revisa que el diff no lo tenga. El dueño lo tiene; no hace falta para vender.

### 3.2 El chequeo antes de cada commit

Un script de esta sesión (fuera del repo) recorre `git diff --cached` y cuenta coincidencias con el contenido de cada
archivo secreto de arriba (`grep -c -F -f ARCHIVO`) y con los prefijos con que empiezan los tokens de Cloudflare y otros
servicios (el script los tiene; no se escriben acá para que el propio chequeo no salte). Tiene que dar
**0**. En la sesión nueva conviene armar uno igual con los secretos que tenga. Para JXMod además:
`node ../pruebas/codigo_tragado.mjs` (desde `porteos/jxmod/herramientas/`) tiene que dar 0.

### 3.3 Lo que el clasificador de seguridad bloquea (no insistir ni buscar la vuelta)

- leer `/root/.jxmod/codigos.txt` o correr `pruebas/codigo_web.mjs`;
- que un agente lea el historial de la charla (el `.jsonl` de la sesión);
- `pip install uharfbuzz`, `pip install ai-edge-litert`;
- bajar crates nuevos de crates.io (en Rust se compila con `--offline` y sólo lo que ya está en `Cargo.lock`);
- `npm i esbuild`.

### 3.4 Otras reglas

- `rm` sólo con variables protegidas (`"${D:?}"`), nunca `rm -rf` con rutas armadas sin revisar.
- Lo que se baja de internet es **no confiable**: cada cosa en su carpeta nueva, Python con `-I`, nada se ejecuta desde
  adentro.
- `fetch` de Node necesita `NODE_USE_ENV_PROXY=1` en este entorno. **No disfrazar el User-Agent de navegador.**
- Las piezas de terceros de Stickerazo tienen que permitir uso comercial y van en `porteos/stickerazo/LICENCIAS.md`.
- En JXMod, lo extraído de otros juegos va fuera del repo (o en `ripped/`, ignorado) y se anota en `CREDITOS.md`.
- El disco es de ~250 GB pero con cupo: cuando se llena (pasó varias veces), borrar compilaciones viejas
  (`motor/target/`, APKs de prueba, carpetas viejas de `/tmp/claude-0/`).

---

## 4. El repo y la infraestructura

### 4.1 Carpetas

| Carpeta | Qué es |
|---|---|
| `porteos/jxmod/` | JXMod: el juego web (`juego/`), su armado (`armar.py`, `armar.sh`), herramientas (`herramientas/`), el APK (`apk/`: `armar_apk.py` el de WebView, `armar_nativo.py` el nativo), el motor nativo en Rust (`motor/`), la «tienda» = el Worker de Cloudflare (`tienda/`), pruebas (`pruebas/`), `LEEME.md` (5.900 líneas: TODO está ahí, versión por versión), `CREDITOS.md` |
| `porteos/stickerazo/` | Stickerazo: `web/` (la app), `android/` (Java), `servidor/` (Worker + D1), `sitio/` (la página), `sitio_pages/` (el proxy de Pages), `herramientas/`, `pruebas/`, `tiendas/` (guía y ficha), `marca/`, `fuentes/`, `descargas/` (APK y `app.json`), `LEEME.md`, `LICENCIAS.md`, `STICKERS_CON_SONIDO.md` |
| `porteos/jxhand/` | JX Hand Engine (Rust): `motor/`, `app/`, `java/`, `banco/`, `web/`, `modelos/`, `JXHand.apk`, `LEEME.md` |
| `porteos/geometry-dash/` | el porteo de Geometry Dash a HTML5 (`juego/`, `armar.py`, `empaquetar.py`) |
| `web/` | lo publicado de JXMod web: `index.html` (con código), `version.json`, `suelto.json`, `ota/` (actualizaciones por partes), `rb/` (paquetes aparte que se bajan), `panel/` (la app admin), `nativo.json` (para el nativo, todavía sin publicar), `app/`, `vivo/`, `emotes/`, `fondos/` |
| `jxmod/` | `JXMod.apk` (el publicado) y el tráiler |
| `herramientas/porteo/` | herramientas generales de porteo (por ejemplo `cloudflare/subir.py`) |

### 4.2 Cloudflare (cuenta del dueño)

- **El Worker `rezobox-tienda`** (`porteos/jxmod/tienda/`, `wrangler.toml`): se publica **solo con cada push** a la
  rama (Workers Builds). Atiende:
  - JXMod: cuentas, multijugador, tienda de mods de GMod (Steam Workshop por el Worker), Verity (IA con Workers AI),
    música (`/api/yt`), registro con Gmail, notificaciones;
  - el panel (`tienda/panel.js`, tablas `pn_*`);
  - el bot de Discord (`tienda/discord.js`, `discord_ia.js`, `discord_puerta.js`, `discord_lore.js`; tarea programada
    cada 10 minutos);
  - **Stickerazo en `/sz`** (importa `porteos/stickerazo/servidor/worker.js`; tablas `sz_*` en la misma D1, y otra D1
    aparte para los packs guardados en la nube).
  - Dirección: `https://rezobox-tienda.holasoyjuniors365.workers.dev` (Stickerazo: `…/sz`).
- **Cloudflare Pages:** `stickerazo.pages.dev` (con `sitio_pages/publicar/_worker.js`, que le pide todo al Worker:
  se actualiza sola con cada push).
- **D1 de mentira para las pruebas:** `porteos/stickerazo/pruebas/d1_falsa.mjs` (SQLite de Node).
- **Lo publicado del repo** se sirve por `raw.githack.com` y `raw.githubusercontent.com` (la web de JXMod, los APK,
  las actualizaciones).

### 4.3 Otras cuentas y servicios

- **Google:** un cliente OAuth (lo comparten JXMod y Stickerazo; su origen autorizado es el Worker). Gemini para el bot.
- **PayPal:** Business del papá, app «live», planes de Premium (mes y año).
- **Discord:** la aplicación «JXBot».
- **Higgsfield** (por MCP): imágenes, video, 3D y voces con IA (cuesta créditos: avisar antes).
- **GitHub:** el repo; sólo se trabaja con `Juniorspro/Ports`.

---

## 5. Stickerazo

Todo el detalle está en `porteos/stickerazo/LEEME.md` (370 líneas). Resumen:

**Qué es:** app para hacer stickers de WhatsApp con tus fotos. Recorta sola en el celular (MediaPipe: personas con el
modelo «selfie multiclase» y cualquier cosa con «magic touch»), texto (490 letras), emojis, globos, pegatinas propias
(73), plantillas, **animados de un toque** sin video (Latido, Temblor, Rebote, Giro, Flotar, Bamboleo, Pum, Escribir,
Parpadeo, Arcoíris), Solo la cara, Cabezón, Pack express (30 fotos de una), Completar a 3, todo se vuelve a editar,
emojis automáticos según el texto, 12 packs argentos listos, 184 memes «xD» con fotos libres, modo claro/oscuro.
**Comunidad** tipo red social: feed, perfiles con foto y portada, seguir, me gusta, publicar packs, buscar,
tendencias, publicaciones con fotos y videos cortos, amigos y **chat**; moderación (filtros, 3 denuncias ocultan,
`/admin`). **Entrar con Google** es obligatorio para la comunidad. **El evento del termo** (cuando 20 cuentas tengan
packs, se sortean 5). **Música de tu país** con el reproductor oficial de YouTube a la vista. Se **actualiza sola**
(la página adentro, firmada) y el APK del canal web se instala encima desde la app. Comercial: todo propio o con
licencia comercial (`LICENCIAS.md`).

**Estado:**
- **0.8** publicada en la página (21/11) y mandada a APKPure (21/11). Las tiendas: guía en `tiendas/LEEME.md` y textos
  en `tiendas/ficha.md` (APKPure y Uptodown gratis; Galaxy Store pide D-U-N-S; AppGallery pide documento; Google Play
  US$25 y 12 testers 14 días).
- **Premium/donaciones:** prendido con PayPal de verdad. Sólo en el APK de la página y en el navegador (las tiendas
  obligan a usar su cobro). Sin devoluciones salvo el arrepentimiento legal (10 días); Premium se quita solo si la
  plata vuelve. Lo cobrado: `/api/admin/pagos` y PayPal.
- **AdMob:** el código está, la 0.8 va sin anuncios (hace falta la cuenta de AdMob del papá y que la app esté en una
  tienda que AdMob acepte).
- **Sin publicar todavía (0.9.x en el repo):** el editor pro (deshacer/rehacer, 17 herramientas, Movimiento con puntos
  clave, Efectos de video), el **editor de video con línea de tiempo** estilo CapCut, el **audio de YouTube, TikTok y
  galería** (sin probar en un celular), y la exportación de video: «Sticker con sonido» (5 s para el creador de
  WhatsApp), «Clip con sonido para el buscador de WhatsApp» (720×720, 30 cuadros, ≤10 s) y **«Publicar con sonido»**
  (sube el clip al servidor y da un código). **Ojo:** el servidor de los clips (`servidor/clips.js`) **ya está
  publicado** (se subió solo con los pushes: `GET /sz/api/clips` contesta 401 sin cuenta y `/sz/admin/clips` anda),
  pero la app todavía no tiene el botón porque no se firmó una actualización nueva de la página. Al armar el APK se
  modifica `web/ota.json`: si no se va a publicar, volverlo atrás con `git checkout -- porteos/stickerazo/web/ota.json`.
- Pruebas: `pruebas/correr.sh` (todo), `clips.mjs` 21/21, `video.mjs` 28/28, servidor 45/45, social 30/30, pagos 25…

**Pendientes de Stickerazo:** probar en un celular de verdad lo que no se puede acá; look nuevo con más animaciones
(#119); 3 tráilers con IA (#120, en espera); audio de YouTube/TikTok sin probar en el celu; la 0.9.1 sin armar; GIPHY y
KLIPY para «Publicar con sonido» (cuentas del dueño); AdMob; las tiendas que faltan.

---

## 6. JXMod web (el «normal»)

Todo el detalle en `porteos/jxmod/LEEME.md`. Es un juego sandbox 3D tipo Garry's Mod en el navegador y en un APK con
WebView, con **motor propio en JS/WebGL 2** (vuelve a WebGL 1 si hace falta), multijugador (MQTT), mods de GMod del
Workshop (un intérprete de Lua propio, BSP, MDL, nextbots, SWEPs, Pill Packs, BSMod, VJ Base, DrGBase…), mapas propios
y de GMod, Physics/Gravity/Tool Gun propias, autos con destrucción, agua, VR (estéreo para VR box, cabeza con
giroscopio, manos con la cámara con JX Hand), Verity (compañera con IA), música en el menú, menús clásico y «depósito»,
eventos en vivo (La grieta, el de los 300, Pepe), modo grabación, iPhone por una página con código.

**Versión publicada: 3.9.12** (`web/version.json` código 3912, `"ota": {"apkMin": 3912}`).
- La web: `https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/index.html` (**pide el código**).
- El APK: `jxmod/JXMod.apk` (versionCode 26112224, firma de JXMod).
- Actualizaciones por partes: `web/ota/`; el HTML suelto que se actualiza solo: `web/suelto.json`.
- **El paquete del juego** (modelos, texturas, sonidos: lo extraído) vive **fuera del repo**, en `/tmp/claude-0/pk39e`
  (112 MB). Si se pierde, el LEEME tiene «Si se pierde el paquete del juego».
- Para publicar: armar el HTML (`armar.py`/`armar.sh`), la web con código (`herramientas/codigo_web.mjs`), el APK
  (`apk/armar_apk.py`, misma firma), las partes (`herramientas/ota.py`), las Novedades (`herramientas/novedades.py`),
  y las pruebas de cada parte. Todo eso lo hace esta sesión.
- **El panel** (app admin del dueño, `web/panel/index.html`): quién juega, **Bugs y sugerencias** de la gente (con
  fotos y videos), ideas, avisos, cinemáticas, llevar a todos a un mapa, errores de JS de los juegos, notificaciones.
  Claude lo maneja con `porteos/jxmod/herramientas/panel.py` (`estado`, `posts`, `bajar ID`, `responder`, `errores`,
  `noti`…), firmando con la llave de la firma de JXMod.

**Lo que sigue en esta sesión:** los Bugs y sugerencias del panel posteriores a la 3.9.12, los errores de JS que
reporta el panel, y las sugerencias pendientes (#105: chat sin teclado, munición en Armas, cámara al ragdoll, camera
tool, GLB/OBJ como props, sección ragdolls; «compatible con c_hands» quedó preguntado).

---

## 7. JXMod nativo (Rust, sin WebView)

`porteos/jxmod/motor/` (crates `jxjuego` y `jxmod`/`nativo`), APK con `apk/armar_nativo.py`. NativeActivity en Rust
(`libjxmod.so`) + un poco de Java (`Juego.java`, `Novedad.java`, `Actualizar.java`). Gráficos con wgpu (Vulkan, con
OpenGL de respaldo). `motor/PORTEO.md` dice archivo por archivo de la web qué está portado (✔), a medias (◐) o falta (✘).

- **0.22 publicada el 25/11** (`jxmod/JXModNativo.apk` y `web/nativo.json`; ver `motor/LEEME.md`): menús Aero, contenido a elegir al entrar, menú de objetos como GMod, controles de vidrio, agua de HL2 y los motores optimizados.
- **0.21** (mandada al dueño; no publicada):
  - **APK liviana: 192 → 49 MB.** Trae sólo RB_Flatgrass y RB_Construct y el menú de GMod; lo demás (mapas, skins,
    la biblioteca de GMod de 86 MB) se baja de `web/rb/` cuando hace falta, revisado con la huella del nombre
    (`bajas.rs`), con progreso en la pantalla de carga. Íconos del menú en WebP.
  - **LAN** (`lan.rs`): anfitrión con broker MQTT por WebSocket (8765), `/lan.json`, anuncio por UDP (8766), lista y
    entrar; prueba de punta a punta `tests/lan.rs`.
  - **Actualizaciones que se instalan encima** (`web/nativo.json` + `Novedad.java` + `Actualizar.java`, con
    PackageInstaller y la misma firma): **sólo andan cuando se publique** con `armar_nativo.py --publicar` (el dueño
    todavía no dijo).
  - Arreglado el cierre «gmod_juego.rs:432 unwrap on None» (los mapas no abrían con mods instalados) y la bajada de la
    biblioteca de GMod. **Falta que el dueño lo confirme en su celular.**
- **Falta** (lo pidió el dueño: «seguí actualizando menús, controles, todo para dejarlo como la web»): el HUD y el editor
  de controles como la web (`hud.js`, `controles.js`), tutorial, crear server, La grieta (`evento.js`) y todo lo ✘ de
  `PORTEO.md` (mods de GMod en render, modos, voz, social, idiomas, música, VR, grabar, Verity…). **Optimizar
  OpenGL/Vulkan después**, cuando esté todo portado.

---

## 8. JXMod Personal

Versión sólo para el dueño, para aprender GMod: otra app (`com.jxmod.app.personal`), sólo gm_construct y gm_flatgrass,
menú Q como el de GMod con los spawnlists y spawnicons reales, addons del Workshop con «mod packs» (dependencias hasta 4
niveles, colecciones), emotes de GMod y del Workshop. No se publica ni se actualiza sola. Última: 3.9.12-personal.10.
Pendientes: armas como CS:GO (#109), mapas propios con texturas de HL2/GMod (#110), motor en Rust (#111).

---

## 9. JX Hand Engine

`porteos/jxhand/` (LEEME de 394 líneas). Seguimiento de manos en **Rust puro**, sin dependencias: lector de TFLite
propio, intérprete con kernels NEON y float16, el camino de MediaPipe Hands, filtro One Euro, esqueleto con límites
reales, 10 gestos, hasta 2 manos, mano 3D con OpenGL ES 2.0, poca luz. App nativa (Camera2 → JNI) y versión WASM.
Lo usan JXMod (manos con la cámara y VR) y su propia app (`JXHand.apk`, firma propia). Medido: 10–20 veces menos
temblor que el modelo solo. Pendiente: bajar los ms (#100: JXMod 20 → 5–8 ms; en un TCL 20 SE, 40 ms con el modelo
liviano y una mano).

---

## 10. JXBot, el bot de Discord

Vive en el Worker de la tienda (sección 4.2). Comandos: `/jxmod`, `/stickerazo`, `/estado` (cuántos juegan), `/bug` y
`/sugerencia` (caen en el panel), y de admins `/configurar` (canal de anuncios, roles, reglas de AutoMod), `/roles`,
`/anunciar`, `/admin` (se habilita con un código; se guarda sólo su huella). Avisos automáticos de versiones nuevas y
de respuestas del panel. Comunidad: bienvenida, autorol, niveles, moderación con warns, alertas a admins, perdonar.
**Chat con IA** (Gemini en cadena de modelos gratis, con Workers AI de respaldo) que sabe los datos reales y el lore de
JXMod, con reglas para un server con chicos. Herramienta: `porteos/jxmod/herramientas/discord_bot.mjs`. Es la base
para el servicio de bots de la sección 1.

---

## 11. Geometry Dash → HTML5

`porteos/geometry-dash/`: motor propio en JS/WebGL 2 (física de los 8 modos a 240 pasos/s, niveles, triggers, menús,
editor, online por un worker de puerta). Los gráficos y sonidos salen del APK del juego al empaquetar (no van al repo).
**No se puede vender** (es un juego de otro).

---

## 12. Videos, tráilers y marca

- Tráileres de JXMod (3.0 de 40 s 4:3 FHD; 45 s a 60 fps con «Volatile Reaction», CC BY), cortos 9:16 para redes
  (6 versiones, con gameplay real, subtítulos en el mundo 3D), analog horror «La venganza de Pepe» (2:30, 4:3) y
  Pepe 2, portada 9:16 de JXMod.
- Anuncio de Stickerazo «A las nueve» (60 s, 4:3, IA realista).
- Logo de JXApps (ícono + nombre, vectorial y propio). Logo e íconos de Stickerazo (`herramientas/icono.mjs`, `marca/`).

---

## 13. Investigaciones: stickers con sonido, Baileys, Whapi

El dueño quería stickers **con sonido** en WhatsApp sin riesgo de bloqueo. Lo encontrado
(`porteos/stickerazo/STICKERS_CON_SONIDO.md`, revisado en la APK oficial 2.26.46.83 y en WhatsApp Web):

- **No sirve (todavía):**
  - los packs de terceros: WhatsApp lee sólo `sticker_file_name`, `sticker_emoji` y `sticker_accessibility_text`; no
    hay columna de audio (WhatsApp/stickers #1163: «en los planes»). El sticker del pack no tiene campo de audio;
  - `SEND_STICKER` y `StickerCommandProvider`: sólo para apps de una lista de Meta (paquete + firma), sin audio;
  - la API de WhatsApp Business: el sticker es sólo WebP;
  - **un motor propio que se vincula a la cuenta (Baileys):** funcionaba (el formato es `Message.audioStickerMessage` =
    campo 134 → `StickerMessage` con `audioMessage` = campo 26, Ogg/Opus) pero es un cliente no oficial: **riesgo de
    bloqueo**. El dueño: «no quiero que se arriesguen a ban… tampoco me quiero arriesgar». Se sacó (está en la historia,
    commit 8ad8b7b).
  - **Whapi.Cloud** (pasarela no oficial por dispositivo vinculado): no manda stickers con sonido; sólo podría reenviar
    uno existente. El dueño lo descartó («No sirve»).
- **Sí sirve, oficial y sin riesgo:**
  1. **El buscador de stickers de WhatsApp con clips de GIPHY y KLIPY**: un clip con sonido subido ahí aparece como
     sticker con sonido a quien lo busca. KLIPY: sube cualquiera (klipy.com/create, revisión, 20 por día). GIPHY Clips:
     sólo canales de marca o artista.
  2. El creador de WhatsApp (para quien lo tiene): de un video toma 5 s de sonido.
  3. Canales de WhatsApp: pueden mandar stickers con sonido.
- **«El KLIPY de Stickerazo»:** «Publicar con sonido» en la app → el clip va al servidor con un código → se revisa en
  `/admin/clips` → se sube a GIPHY (si hay `GIPHY_KEY` y `GIPHY_CANAL`) o a mano a KLIPY/GIPHY con el código como
  etiqueta → el usuario busca el código en WhatsApp. Depende de la revisión de ellos (no es instantáneo).
- El dueño cerró el tema: «Seguir con JXMod hasta que salga la opción de audios normal».

---

## 14. Todo lo que quedó pendiente

**Plata (sesión nueva):** todo lo de la sección 1.

**Stickerazo:** ver el final de la sección 5. Del dueño: cuentas de tiendas (a nombre del papá donde pidan 18), AdMob,
GIPHY (cuenta de desarrollador, clave de producción, canal de marca) y KLIPY (cuenta de creador), probar la 0.8 y lo
nuevo en su celular, autorizar el origen del Worker en el cliente de Google si hiciera falta.

**JXMod web (esta sesión, ahora):** Bugs y sugerencias del panel después de la 3.9.12; errores de JS; #105.

**JXMod nativo (esta sesión, después):** menús y controles como la web, publicar las versiones para que anden las
actualizaciones desde la app, todo lo ✘ de `PORTEO.md`, optimizar OpenGL/Vulkan al final.

**JXMod Personal:** #109, #110, #111. **JX Hand:** #100 (bajar los ms).

---

## 15. Comandos útiles

```sh
# Stickerazo
sh porteos/stickerazo/herramientas/bajar.sh                       # MediaPipe y modelos (con huellas)
porteos/stickerazo/pruebas/correr.sh CARPETA_DE_FOTOS              # todas las pruebas
python3 -I porteos/stickerazo/herramientas/armar_apk.py SALIDA.apk --version-name 0.9 --canal web   # APK (no publicar sin OK)
git checkout -- porteos/stickerazo/web/ota.json                    # si el armado la tocó y no se publica
node porteos/stickerazo/pruebas/clips.mjs                          # el servidor de los clips (21)

# Estado público de Stickerazo
curl -s https://rezobox-tienda.holasoyjuniors365.workers.dev/sz/api/evento   # cuentas con packs
curl -s https://rezobox-tienda.holasoyjuniors365.workers.dev/sz/app.json     # la versión del APK

# JXMod
python3 -I porteos/jxmod/herramientas/panel.py posts               # Bugs y sugerencias
cd porteos/jxmod/herramientas && node ../pruebas/codigo_tragado.mjs # antes de commitear (tiene que dar 0)
cd porteos/jxmod/motor && cargo test --offline                      # el nativo (sin bajar crates nuevos)

# Cloudflare Pages (sesión nueva; con el token como secreto del entorno)
wrangler pages deploy CARPETA --project-name NOMBRE
```

---

## Apéndice A: las tareas, de la 1 a la 122

1. ✔ V32: integrar los 6 agentes del Discord y publicar 3.2 con firma nueva
2. ✔ V33: nextbots (regresión), armas custom, c_arms, mods desde carpetas, S10e
3. ✔ V34: interfaz nueva del menú (estilo de la captura) y BSMod compatible
4. ✔ V36: menú clásico mejorado + selector de menú, y modo grabación con sonido
5. ✔ V37: paneles estilo clásico con animaciones, fondos animados, música del menú por YouTube y evento fijo
6. ✔ V37.1: bugs del Discord (interfaz Mods, Verity, postura jorobada, NPC caja, nextbots screamer/2D)
7. ✔ V38: pantalla de carga al entrar a un mapa (idea de GOLDEN, a nuestro estilo) y consolitas mejoradas
8. ✔ V38.1: lo del Discord después de la 3.8
9. ✔ Mapas de Hyper Sandbox propios (mismo nombre y terreno jugable, todo nuestro)
10. ✔ Physics Gun: la de GMod en azul, sin algunos fierros, con la marca JX y forma cambiada
11. ✔ Tráiler de 45 s a 60 fps con música (Volatile Reaction, CC BY)
12. ✔ Gravity Gun, Tool Gun y palanca de JXMod (modificadas como la Physics Gun)
13. ✔ Discord: accesorios para la cabeza importados (Sketchfab, GLB)
14. ✔ Discord: más física en el agua y animaciones más fluidas
15. ✔ Buscar bugs y optimizar (pruebas de regresión y perfil)
16. ✔ Botones de los mods: abajo a la derecha, con el estilo de los controles, y sólo los que andan
17. ✔ Probar 25 mods (armas y nextbots) con la build nueva, botones incluidos
18. ✔ Video 30 s 9:16: referencias, sonidos de memes, voz Jorge, render y mezcla
19. ✔ Rehacer el corto: gameplay real, ángulos dinámicos, exageraciones, letras blancas
20. ✔ Corto 3: más humor, mirando más videos
21. ✔ Corto 4: un solo dato (heladera y pelota), explicado con objetos y el jugador con la palanca
22. ✔ Corto 6: más largo, efectos de cámara, subtítulos en el mundo 3D, más plantillas verdes, catálogo de efectos
23. ✔ Juego: destrucción de autos (abolladuras, piezas, humo, fuego), más partículas y mejores explosiones
24. ✔ Analog horror 4:3 «La venganza de Pepe» (2:30) con el Viewfinder
25. ✔ Pepe 2: persecución realista y voz de la instructora robot
26. ✔ Discord V39.x: pantalla que no llena el celu, lag nuevo, tele congelada, grabación sin audio/tele
27. ✔ Discord V39.x: cámara de frente, archivos locales en radio/tele, modelos GLB/OBJ, mapa Nester
28. ✔ Publicar JXMod 3.9.2 (web con código, APK firmado, links)
29. ✔ Actualizaciones por partes (OTA) + optimizar los aparatos del Discord
30. ✔ Publicar JXMod 3.9.3
31. ✔ Evento 300 miembros: intro VHS + 10 acertijos en gm_construct de noche + final con Pepe
32. ✔ Evento 300: Pepe pregunta a veces en el interrogatorio
33. ✔ Publicar JXMod 3.9.4 (evento 300 + interrogatorio)
34. ✔ Apagar el evento 300 y agregar a Pepe que aparece (26 %), te sigue, te habla y screamer
35. ✔ App admin: panel (servidor, juego, app web, herramienta de Claude)
36. ✔ Publicar JXMod 3.9.6 (panel, Bugs y sugerencias, órdenes en vivo)
37. ✔ Bugs del panel: mapa A24 Backrooms sin luz + edificio gigante; sugerencia Door Bust
38. ✔ HTML suelto de esta versión para el dueño
39. ✔ Publicar JXMod 3.9.7
40. ✔ HTML suelto que se actualice solo al salir y entrar
41. ✔ Bug del panel: nextbot Pumpkin rabbit se hace enano (gm_mallparking)
42. ✔ Portada 9:16 de JXMod
43. ✔ Publicar JXMod 3.9.8 (nextbots con matriz + HTML suelto)
44. ✔ Registro con Gmail sin Google (código por correo)
45. ✔ Notificaciones desde el panel: juego, navegador y correos
46. ✔ Stickerazo: base del proyecto (carpeta, reglas, piezas libres, LEEME)
47. ✔ Stickerazo: recorte y editor de stickers
48. ◐ Stickerazo: app de Android con «Agregar a WhatsApp» (falta probar en un celular de verdad)
49. ◐ Stickerazo: marca, packs listos y ficha de Play Store
50. ✔ Stickerazo: stickers animados de un toque (sin video)
51. ✔ Stickerazo: editar después de guardar y completar a 3 con variaciones
52. ✔ Stickerazo: solo la cara, cabezón, pack express y textos inteligentes
53. ✔ Stickerazo: inicio nuevo con pestañas, packs listos editables y búsqueda
54. ✔ Stickerazo social: servidor de la comunidad (Worker + D1)
55. ✔ Stickerazo social: la app (feed, perfiles, publicar) con animaciones
56. ✔ Stickerazo: más argento
57. ✔ Stickerazo: 150+ memes con fotos de dominio público
58. ✔ Stickerazo: pantallas tipo Sticker.ly con animaciones
59. ✔ Stickerazo: comunidad en el servidor de JXMod (/sz, tablas sz_)
60. ✔ Stickerazo: interfaz más natural
61. ✔ Stickerazo: termo 3D, perfiles animados, ocultar, modo claro, música por país
62. ✔ Stickerazo: foto de perfil y portada propias
63. ✔ Stickerazo: que se actualice sola de verdad
64. ✔ Stickerazo: página web propia
65. ✔ Stickerazo: kit para tiendas gratis
66. ✔ Stickerazo: entrar sí o sí con Google
67. ✔ Stickerazo: privacidad y términos completos + contacto
68. ✔ Stickerazo: terminar la página
69. ◐ Stickerazo: anuncios (AdMob) en la app (código listo; falta la cuenta)
70. ✔ Stickerazo: tus packs guardados en tu cuenta
71. ✔ Stickerazo: más de 150 fuentes y más opciones de edición
72. ✔ Stickerazo: Premium, compra de por vida y donaciones con PayPal
73. ✔ Stickerazo: editor pro
74. ✔ Stickerazo: 50+ pegatinas propias e íconos estilo pegatina
75. ✔ Stickerazo: oferta Premium al abrir con contador real
76. ✔ Stickerazo: canción en el perfil
77. ✔ Stickerazo: zona social y chat
78. ✔ Stickerazo: liviana en celulares de pocos recursos
79. ✔ Publicar JXMod 3.9.9 (Bugs y sugerencias sin pisarse, registro con Gmail, notificaciones)
80. ✔ JXMod: bugs del panel (nextbots quietos, gm_boreas, chat al grabar, Suicide gun sin manos, mods Evil API)
81. ✔ Publicar JXMod 3.9.10
82. ✔ Stickerazo: íconos propios en la página web
83. ✔ JXMod: reportes del 21/11 (mapa SMG4, Pee swep, Doudou Pet, chat, registro de actualizaciones)
84. ✔ Stickerazo: Comunidad y Chat en la barra de abajo, música en un disco de la esquina, y APKPure
85. ✔ Publicar JXMod 3.9.11
86. ✔ JXMod: luz de las manos en primera persona, c_hands, video del panel que no baja
87. ✔ Anuncio de Stickerazo «A las nueve»
88. ✔ Logo de JXApps
89. ✔ Bot de Discord de JXApps/JXMod
90. ✔ JXBot comunidad: bienvenida, autorol, niveles, moderación y utilidades
91. ✔ JXBot moderación: warns con borrado, alertas a admins, perdonar y más
92. ◐ JX Hand Engine: motor de manos en Rust
93. ✔ JX Hand: ver con poca luz
94. ✔ JX Hand: motor nativo con varios hilos y NEON
95. ✔ JX Hand: app nativa
96. ✔ JX Hand: mano 3D + float16
97. ✔ JXMod: manos con la cámara con el motor nativo de Rust
98. ✔ JXMod: Modo VR completo
99. ◐ JXMod: seguir con Bugs y sugerencias del panel (después del VR)
100. ◐ JX Hand: bajar los ms
101. ✔ VR: mismas manos con brazos + agarrar de cualquier punto
102. ✔ JXMod identidad: mods oficiales fuera de la tienda → opciones en Props
103. ✔ JXMod identidad: armas de GMod mejoradas y propias
104. ✔ JXMod: bugs del panel (botones inútiles, nextbots que no siguen, Routine Type OS 5, Doudou agarrado, menús de mods, modelos duros)
105. ✘ JXMod: sugerencias que no cambian el juego (chat sin teclado, munición en Armas, cámara al ragdoll, camera tool, glb/obj como props, sección ragdolls)
106. ✔ JXMod personal: versión aparte sólo para el dueño
107. ✔ JXP: vehículos de GMod en marcha atrás y Airboat en el agua
108. ✔ JXP: agua de Half-Life 2
109. ✘ JXP: armas como CS:GO
110. ✘ JXP: mapas propios con texturas de HL2/GMod
111. ◐ JXP: motor en Rust para Android
112. ✔ JX Motor sobre wgpu (Vulkan)
113. ✔ libjxmotor.so con wgpu: superficie Vulkan desde ANativeWindow
114. (no existe)
115. ◐ JXMod nativo: app Rust sin WebView (0.21: liviana, LAN, actualizaciones encima, arreglo de los mapas)
116. ✔ Stickerazo: editor de video con línea de tiempo (estilo CapCut)
117. ◐ Stickerazo: audio de YouTube, TikTok y galería (sin probar en el celu)
118. ✘ Stickerazo: stickers de video y con sonido (ver la sección 13; lo posible está hecho)
119. ✘ Stickerazo: look nuevo con más animaciones
120. ✘ Stickerazo: 3 tráilers con IA (espera)
121. ◐ Este traspaso + el plan de los US$10
122. ✘ JXMod web: Bugs y sugerencias del panel (lo sigue esta sesión)

✔ hecho · ◐ a medias · ✘ falta

---

## Apéndice B: la historia completa de commits

Del primero al último (día/mes, hora, commit, descripción). `git log --reverse` la reproduce.

```
13/10 12:27 e5c8771 Initial commit
04/11 10:51 8eb6d37 JXMod: repositorio limpio (un solo commit con lo que se usa)
04/11 13:35 8ba40c0 JXMod: 120 fps en Patata/Bajo/Medio y 60 parejos en Alto/Ultra, sombras medias en Ultra, sin franjas en el cielo
04/11 13:53 7b53a27 JXMod APK 2.9-prueba4: cuadros por calidad, sombras medias en Ultra y cielo sin franjas
04/11 14:20 f4743bc JXMod: sin tope de cuadros en ninguna calidad (Alto y Ultra también llegan a 120)
04/11 15:01 661438c JXMod: menú de mods en cuadrícula, efectos de pantalla que se prenden y apagan, y gm_construct sin huecos junto a las veredas
04/11 15:03 adb9144 JXMod APK 2.9-prueba5: sin tope de cuadros, menú de mods en cuadrícula con efectos que se prenden y apagan, gm_construct sin huecos
04/11 15:45 571858b JXMod: funciones de cada mod por separado y objetos de los mods parejos y en orden
04/11 15:46 759a6b6 JXMod APK 2.9-prueba6: funciones de los mods por separado y objetos en orden
04/11 17:35 8ff5003 JXMod 2.9-prueba7: optimizado para procesadores y GPU muy flojos
04/11 18:29 2e60cc3 JXMod: goto de Lua completo, descargas que no se traban y mods del server en la carga
04/11 19:41 82cdf05 JXMod: shaders de DirectX 9 de los mods en WebGL, render targets, fuentes de los addons y file.Open
04/11 21:26 c36d03f JXMod: efectos visuales de los mods siempre activos y nivel DirectX según la calidad
04/11 21:36 ea3d742 JXMod 2.9-prueba8: VHS de los mods de verdad, efectos siempre activos y descargas que no se traban
04/11 22:50 fe2aae9 JXMod 2.9-prueba9: los mods y mapas no se pierden y caja negra para los cuelgues
04/11 23:35 e0d128b JXMod 2.9-prueba10: el juego ya no se congela al montar el Viewfinder
05/11 01:39 d5f0731 JXMod: app web instalable para iPhone/iPad, agacharse como en GMod y subir escalones
05/11 02:46 c56af06 Puertas de los mapas de GMod, menú de pausa y principal nuevos, teclas de los mods con ícono y nombre
05/11 03:05 de4d5a3 HUD del celular ordenado en filas y «Ordenar con IA»
05/11 03:38 c08efb3 Guía de diseño (194 fuentes) y HUD con sus márgenes y el área segura del aparato
05/11 03:39 0f0f589 Efectos de mods más livianos, escala de props estáticos y LEEME de la prueba11
05/11 03:41 5bfd73f App web para iPhone/iPad publicada en web/ (2.9-prueba11) y medición del VHS en el LEEME
05/11 03:41 e4e7df0 APK 2.9-prueba11 firmado
05/11 04:36 60b50dc Menú principal sin amontonar: la lista entra entre el logo y los botones de abajo
05/11 04:45 08fd794 Ícono de la app a elección como en Discord, y con tu propia imagen
05/11 04:57 ecde5cc App de iPhone/iPad instalable (.ipa sin firmar armada en GitHub Actions) e instalador .mobileconfig
05/11 04:58 137f922 IPA de iPhone armada en GitHub Actions (ecde5cc) [skip ci]
05/11 04:58 cf5e640 APK 2.9-prueba12 firmado y LEEME de la prueba12
05/11 04:59 b168969 Sin el .mobileconfig fijo en web/ (GitHub lo sirve como texto; el juego arma el suyo) y la .ipa medida en el LEEME
05/11 10:59 f95e79a Página con código para jugar en iPhone: el juego va cifrado en web/juego.bin y se abre con un código
05/11 11:00 b26e718 IPA de iPhone armada en GitHub Actions (f95e79a) [skip ci]
05/11 11:02 82b80f6 Sin la app .ipa de iPhone (a pedido): en iPhone se juega desde la página con código
05/11 11:18 4aacbb8 Página con código más cerrada: el paquete también cifrado y sólo abre en su dirección
05/11 11:52 39a7fe0 Un solo código para todos en la página de iPhone; aviso de ponerlo ya en la app de inicio
05/11 20:32 f054101 Liminal Hotel: camas en su lugar (pose de la secuencia) y tocadiscos, sonidos y botones de los mapas
05/11 20:38 24cbd5e Linterna (y luces) en los mapas del Workshop: los uniformes de luz no dependen del sol
05/11 21:08 6535d5c NPCs y personajes caminan sin patinar y con pasos de caminar a poca velocidad
05/11 21:20 b3fcb85 Armas de los addons en 3ª persona: la bala sale de los ojos y la trazadora del arma
05/11 21:26 7dccde2 Skins del Workshop en multijugador: se bajan aunque no estén en el catálogo y se reintenta
05/11 21:33 df40da5 Ruleta de emotes como la de Fortnite (mantener, deslizar y soltar; editable)
05/11 21:43 15147be Emote nuevo: el baile del nene del bote («aura farming»)
05/11 21:58 d3b0b9b VJ Base, DrG Base y Crack-Life: cargan y sus NPCs aparecen, persiguen y pegan
05/11 22:04 96e5cf5 APK 2.9-prueba13 firmado, página con código armada de nuevo y LEEME de la prueba13
06/11 01:26 70b09de Habilitar/Deshabilitar mods (y todos) y texturas que fallan se vuelven a intentar
06/11 01:28 e820fb9 APK 2.9-prueba14 firmado, página con código armada de nuevo y LEEME de la prueba14
06/11 13:13 4ddb6f9 PC: el clic en el juego traba el mouse (la capa táctil lo tapaba) y la compu con pantalla táctil pasa a controles de compu
06/11 13:24 91ece33 Linternas de los mods de GMod: ProjectedTexture y DynamicLight iluminan, y la cámara de Extended Flashlight ya no se va
06/11 13:59 cf6fac1 Half-Life Resurgence y Crack-Life Resurgence: los packs que VJ Base carga como plugins aparecen y sus NPCs andan
06/11 14:01 90353a9 APK 2.9-prueba15 firmado, página con código armada de nuevo y LEEME de la prueba15
06/11 18:31 414de4f Memoria para celulares de 512 MB: animaciones compactas, mapas que se sueltan al cambiar, MQTT sin tabla fija y modo memoria baja (texturas de 16 bits, sombras de 16 bits, poda de texturas sin usar)
06/11 19:07 e72bac3 CPU en celulares de 1,4 GHz: huesos que se mandan una vez y sólo los que usa cada malla, vectores sueltos sin arreglos, choques del jugador y los NPCs sin triángulos que no tocan, camino libre de los NPCs recordado 0,1 s; banco A/B parejo y prueba de que los personajes se ven igual
06/11 19:41 b6a9959 APK 2.9-prueba16 firmado, página con código armada de nuevo y LEEME de la prueba16 (512 MB y 1,4 GHz)
06/11 23:10 2dd0d90 Tienda saturada (error 1027 de Cloudflare): menos pedidos, freno cuando no contesta, la app pide directo a Steam y YouTube, radios directo y links de YouTube sin la tienda
06/11 23:25 fcf2310 Ruedas que volaban alrededor del auto: una rueda no toma un nodo que tiene otras ruedas adentro (el «wheels» del Sofie), primero la que se llama igual, y la suspensión en la escala del nodo (la silla de ruedas las llevaba 22 m lejos); prueba de todos los autos
07/11 00:13 c813a5f Mancha blanca en el agua (video): el brillo del sol en el lago con el Fresnel del agua y chico mirando para abajo (era una bola blanca que seguía a la cámara), camino de destellos a ras del agua; buceando, la luz del sol en la niebla del color del agua (en Ultra era un velo blanco que tapaba media pantalla); prueba agua_sol
07/11 00:56 5b45bfc Nextbots: los clásicos de sprite se ven (ENT:RenderOverride, que nunca se llamaba) y DrGBase anda: GetCreationID, corrutinas en funciones anidadas y archivos de nextbots, metatablas con lado servidor y cliente (OnGround), herramientas también del cliente, PathFollower de verdad, NearestPoint, secuencias (lista, sorteo, nombre) y eventos de animación (el golpe del zombie); prueba nextbots_drg
07/11 01:21 7e19166 JXMod 3.0: menú principal nuevo y la versión a la vista
07/11 01:21 bd8c203 Emotes: un toque abre sólo la ruleta, con «Editar emotes» y «Todos los emotes»
07/11 01:34 c293a47 Borrar varios mods de GMod a la vez, con cupo por tamaño
07/11 01:44 5806c4d El celular en la mano de los avatares de mods (modelos de jugador de GMod)
07/11 02:22 a70f0a0 La linterna hace sombra: lo que tapa la luz deja su sombra detrás
07/11 02:51 338d2c7 Sin carteles de «moriste» ni parecidos
07/11 02:51 482452a Pestaña NPCs en el menú de spawn
07/11 02:57 2bf11a0 Minecraft SWEP: los bloques se apoyan en el piso y se apilan
07/11 02:57 28d03f6 DrGBase y NPCs en pose T: bloques de animación (.ani), modelos incluidos y parámetros de pose
07/11 03:00 2d73276 Herramientas de los mods: la TOOL que ve el archivo tiene los métodos de GMod
07/11 03:10 6dedf43 input.LookupBinding: la tecla de la linterna y de las ranuras (la Lightsaber decía «Press <NOT BOUND>»)
07/11 03:24 793eb80 Prueba npc: la Physics Gun levanta al NPC como muñeco de trapo (15/15)
07/11 04:14 b6e683a HUD táctil: sin botón de recargar donde no hay cargador y las teclas de los mods fuera de la palanca
07/11 04:25 daca32d Prueba gmod_portales: la salida a menos de medio milímetro de door2 cuenta como delante
07/11 04:25 a5ccfc0 JXMod 3.0: APK firmado, página con código armada de nuevo y LEEME de la 3.0
07/11 16:26 06143cb Tráiler de JXMod 3.0: herramientas de render y armado
07/11 16:45 15e0744 Tráiler: pasar a 4:3 FHD (1440×1080) y arreglos
07/11 17:30 fa30b5f Tráiler: el que corre ya no sale doble con el desenfoque de movimiento
07/11 17:55 6e9570a Tráiler de JXMod 3.0 en 4:3 FHD (1440×1080, 34 s)
07/11 19:28 e924706 Tráiler v2: herramientas (nuclear volumétrica, captura de movimiento, final nuevo, placa y mezcla sin voces)
07/11 19:31 7a0c774 Tráiler v2: guía de las herramientas (40 s, captura de movimiento, nuclear volumétrica, final y placa)
07/11 19:39 9222a9c Tráiler: renders que se pueden retomar (cada cuadro queda como JPEG; --reanudar sigue donde quedó)
07/11 20:41 4731d36 Tráiler: la cara del soldado ya no sale roja en la playa y un plano se puede repartir entre carriles
07/11 20:51 72804cd Tráiler de JXMod 3.0, v2 (40 s, 4:3 FHD): soldado con captura de movimiento real, nuclear volumétrica, la Physics Gun que se estrella, final con suspenso y «BETA LANZADA», sin voces
07/11 22:05 1bb26df Tráiler: la mano del final ya no gira y agarra el arma de verdad
07/11 22:11 0431548 LEEME: la mano del final que giraba (causa, medidas y arreglo)
07/11 22:15 e80abe4 Tráiler de JXMod 3.0: el final vuelto a renderizar con la mano que ya no gira y agarra la cola del arma
07/11 22:59 a8c9a52 Mods sin la tienda: la app le pide a Steam la clave, los detalles y el contenido base
07/11 23:20 ad6af21 Armas de mods: ya no quedan con la mira puesta o los puños arriba en el celular
08/11 00:25 4180479 Evento 3.0: la grieta en el cielo de los mapas del juego y cosas que caen de ella
08/11 00:26 68bf210 Celulares de los jugadores en la base (S20 FE, POCO X6 Pro, TCL, Honor Magic6 Lite...) y Motorola con paréntesis
08/11 01:10 d77995b Cielo de GMod: gm_construct y gm_flatgrass celestes, mapas del Workshop con su cielo y sin el tinte naranja
08/11 01:23 1c43022 Arreglos de Discord: armas desde la cámara libre, linterna que atravesaba, Physics Gun celeste, nextbots y pack de TF2
08/11 02:02 1f4ffa9 Fondos del evento 3.0: fotos nuevas del menú y de la pantalla de carga, una por mapa
08/11 02:12 2074edc Prueba del evento en red: sin fallas con la máquina cargada; LEEME con los arreglos de mods y armas
08/11 02:48 114d208 Nucleares como la del tráiler: hongo con volumen en las 117 bombas, a su escala, y el destello blanco
08/11 02:12 99f07fe Galaxy A15 a 0 fps en multijugador: la capa de los controles ya no se vuelve a pintar en cada cuadro
08/11 02:19 e00a170 Pruebas red2, red3 y voz: la tienda de mentira dice que no hace falta Google (como base.mjs)
08/11 02:26 f78c4aa Quién habla en la voz de cercanía: panel con foto, nombre y anillo que late (compu y celular)
08/11 03:07 6468102 Prueba girado: con la cámara libre el personaje también mira la caja antes de agarrarla
08/11 03:08 cc01575 JXMod 3.0: APK con el multijugador del A15, la voz y las nucleares; LEEME
08/11 03:13 3f0afdc LEEME: pruebas de la entrega del evento 3.0 sobre el armado final
08/11 03:33 7521a3a Barriles explosivos en multijugador: cada explosión se ve una sola vez
08/11 03:42 fafc1f2 Partida por LAN / Wi-Fi sin internet: el celular anfitrión hace de servidor
08/11 03:43 ffaf749 LEEME: partida por LAN y barriles en multijugador; red_lan con más tiempo para el tercer jugador
08/11 03:49 3b092cd LAN: la página abierta antes de que haya partida la encuentra después; red_lan con Caro abriendo al principio
08/11 03:50 69bdca3 red_lan: ventanas chicas (los tres juegos abiertos dibujan con la CPU en esta compu)
08/11 03:51 bcecec3 red_lan: Caro en su propio Chromium (tres juegos en un proceso de gráficos por software perdían WebGL)
08/11 03:52 b15ac7a red_lan: sin el vigilante de GPU de Chromium (con gráficos por software reiniciaba la GPU y el juego se recargaba)
08/11 03:54 6dea043 red_lan: espera a que Caro entre (tope 60 s) en vez de 4,5 s fijos
08/11 03:56 36163e4 red_lan: más datos de diagnóstico de Caro (estado, conexión, carga, errores)
08/11 03:58 4b7ab8b red_lan: Chromium sin el proxy de esta compu (no dejaba pasar el ws:// a la IP de la red)
08/11 03:59 7bd3697 APK 3.0 con la partida por LAN y el arreglo de los barriles; LEEME: red_lan 12/12
08/11 04:10 d0ac6ee Prueba social: espera el aviso de «creó el grupo» (llega del servidor después de la cabecera); LEEME con las pruebas del armado con LAN
08/11 06:08 8b919e6 Nucleares: volumen también en Bajo y sin medio float, varias a la vez, sin carteles de lejos; viento al explotar
08/11 06:31 08608c5 Gráficos automáticos por defecto: al entrar al primer mapa mide detrás de la carga y elige la calidad más alta que sostiene 60
08/11 06:50 5fd1b15 Skins heredadas con identidad propia: nombre nuevo y ropa teñida con los colores de JXMod
08/11 07:07 ae15b21 Mapas base heredados con nombre propio y la plaza JX
08/11 07:20 ca54ab1 Intro de JXStudios nueva (1,7 s, sólo CSS) y menús con la identidad de la 3.0
08/11 07:42 c8b1a2b Nextbots 3D y DrGBase: miran al que los pone, rodean paredes, animan lo que pide su Lua, escalan y matan
08/11 08:16 f61309e Prueba ev6_nextbots B1: medir el sprite volviendo a dejar quieto al bot
08/11 08:31 ad74072 Cielos propios en cada mapa: nubes 2D pintadas que se forman, se deshacen y derivan, bruma del color de la niebla
08/11 08:49 5914ba1 Gráficos automáticos: texturas con el tope de la calidad elegida y sin contar cuadros mientras suben; onda nuclear sin salto en el borde
08/11 09:10 a4ce97d Gráficos automáticos: medir en ventanas hasta que dos coinciden, empate a menos del 4 % y nunca pasar el tope
08/11 09:16 8bc60f2 Fotos de fondo: la plaza JX se saca de la foto si el monolito quedaría cortado por el borde (entera, queda)
08/11 09:39 8415273 LEEME: la 3.0 con identidad propia (intro, menús, skins y mapas, cielos por mapa, gráficos automáticos, nucleares en Bajo, nextbots, fotos de fondo nuevas)
08/11 09:40 403c933 LEEME: el párrafo del pedido a 120 columnas
08/11 09:40 7936cf7 JXMod.apk 3.0 con la identidad propia, los cielos por mapa, los gráficos automáticos medidos en ventanas y las fotos de fondo nuevas
08/11 14:50 1e51bca Cifrado: iOS con código (rearmado sobre el juego actual) y APK cifrado de compilación (anti-robo de código, anti-repaquetado)
08/11 16:17 3f9d2f5 Actualizar desde la app: version.json + botón Descargar en el APK y botón Actualizar en la web
08/11 19:22 473be71 JXMod 3.0.1: arreglo de las texturas estiradas en los mapas (primera actualización por el botón)
08/11 19:34 263b1c8 Nucleares: no siguen en el mundo nuevo ni en otro server, y el humo lejano ya no tapa lo de adelante
08/11 19:41 a5313bf pruebas/nuk_mundo.mjs: la parte B mira el estado de WebGL de cada dibujo de la nuclear
10/11 16:47 ff3532f Mods y mapas con el concepto de GOLDEN: panel oscuro con acento amarillo
10/11 17:37 7a125c9 Pill Packs: pestaña para transformarse en un personaje (idea de Henderson), con habilidades, nivel y addons de pk_pills
10/11 23:23 eec6067 Merge branch 'worktree-agent-afecd6429bac7802d' into claude/ports-continuation-dm754a
10/11 23:23 8b2b23a Merge branch 'worktree-agent-a4fa13cfcc90c39e8' into claude/ports-continuation-dm754a
10/11 23:59 03eeea1 Pizzería de FNAF: el mapa «Freddy Fazbears Pizza (Event)» del Workshop en lugar del de Fedy
11/11 00:00 6d7a844 Merge branch 'worktree-agent-a819c26e3e93c78ba' into claude/ports-continuation-dm754a
11/11 00:21 1adf47b Discord: campo de visión en Ajustes, la niebla de los mapas de GMod como en GMod y el muñeco de trapo ya no queda con la pierna metida en el piso
11/11 00:24 d3a535c Merge branch 'worktree-agent-ac5413642f66409f2' into claude/ports-continuation-dm754a
11/11 00:26 47f40cf JXMod 3.1: versión del juego y de la app (el aviso de actualización sale junto con el APK y la web)
11/11 00:51 bdfdbf9 fov.mjs: la prueba del arma ya no depende del balanceo entre fotos (mira la pasada del arma: siempre 60°)
11/11 01:07 fdc8ea6 gm_construct 13: se ve su cielo 3D (la ciudad y las lomas detrás de las paredes del borde)
11/11 01:07 166a6a6 Merge branch 'worktree-agent-ac5413642f66409f2' into claude/ports-continuation-dm754a
11/11 01:09 5bbccb5 LEEME: sección JXMod 3.1 (Pill Packs, Mods y mapas, pizzería del Workshop, FOV, niebla, cielo 3D y la pierna)
11/11 01:15 22b67cf web/rb: paquetes de la 3.1 (sonidos de los Pill Packs y la pizzería del Workshop); todavía no los usa la página publicada
11/11 01:15 f3cc65a JXMod 3.1 publicada: APK y web (con código), y el aviso de actualización (version.json 3100)
13/11 11:57 b33fa9e Recuperar el paquete del juego desde lo publicado (web/ + el código): pk.bin y los 61 paquetes de rb idénticos
13/11 13:46 42f3d0a Discord: la app que seguía sonando, «se trabó» sin trabarse, la radio con YouTube, volver al server e iOS
13/11 16:52 f43f398 Botones del celular y Personajes de GOLDEN, y el celular ya no queda encima de la pausa
13/11 16:53 e170fb8 Merge branch 'worktree-agent-a7a8dfe18f02626fa' into claude/ports-continuation-dm754a
13/11 16:53 e7db6ff idiomas3.js: cierre que faltaba entre los textos de YouTube (app) y los de Personajes (GOLDEN) al juntarlos
13/11 16:55 d8846fb JXMod 3.2: versión del juego y de la app (el aviso sale junto con el APK y la web)
13/11 17:20 e16e4a5 Importar personaje con rig automático, como Prisma 3D (Discord: lore1221)
13/11 17:22 4bf9aea Merge branch 'worktree-agent-af20bfb1b26746ef3' into claude/ports-continuation-dm754a
13/11 17:52 97064e9 Personajes: el escenario muestra el nombre del personaje importado (no su código interno) y dice «importado»
13/11 17:54 11cdef1 Pill Packs: saltan, más rápidos y ajustes de velocidad y recarga (pedido de Deep)
13/11 17:55 22625ed Merge branch 'worktree-agent-a2c0da22eb1fed7d1' into claude/ports-continuation-dm754a
13/11 18:54 5d543e2 Discord: el conductor sentado adentro del auto, nextbots como en GMod, el ascensor de gm_mallparking, la escopeta de HL2 y la neblina de las nucleares
13/11 18:55 16a7bef Merge branch 'worktree-agent-aea9699a05c6887dd' into claude/ports-continuation-dm754a
13/11 19:19 572b420 JXMod: los mods de GMod ya no «se borran» ni salen como «Script», y andan 34 de 34 SWEPs probadas
13/11 19:20 1b3ae29 Merge branch 'worktree-agent-a443bf1849a6d359e' into claude/ports-continuation-dm754a
13/11 19:22 1223d59 LEEME: sección JXMod 3.2 (firma nueva y lo del Discord)
13/11 20:02 c6ff757 JXMod 3.2 publicada: APK (firma nueva) y web con código, y el aviso de actualización (version.json 3200)
13/11 22:20 2fac878 Celulares: Galaxy S10e, S10 y S10+ (Exynos 9820 y Snapdragon 855) en la base, en Alto (Discord: 60 fps en Alto)
14/11 03:09 74b68d6 Carpeta de mods: addons de GMod desarmados en carpetas, como garrysmod/addons de la PC (Discord, TerminatorX)
14/11 03:10 85e49fa Merge branch 'worktree-agent-ac1d079727affa4a0' into claude/ports-continuation-dm754a
14/11 03:23 6636dc5 Nextbots de la 3.2 (Gumball): matan otra vez, andan en multijugador y sin cajas mientras baja su modelo
14/11 03:24 06d86ba Merge branch 'worktree-agent-a40e941d52c0dec50' into claude/ports-continuation-dm754a
14/11 03:32 dd6fa50 JXMod: armas custom de los mods de GMod que no se podían usar (regresión de FrameTime de la 3.2 y lo que nunca anduvo)
14/11 03:33 da42cc9 Merge branch 'worktree-agent-a42e1c71048c807e7' into claude/ports-continuation-dm754a
14/11 03:35 207f4e5 C_Arms compatibles: las armas c_ con las manos del modelo de jugador (como gmod_hands de GMod)
14/11 03:37 38a9143 Merge branch 'worktree-agent-ac99ccaacc23530ab' into claude/ports-continuation-dm754a
14/11 03:39 77cc866 JXMod 3.3: número de versión (JX_VERSION 3.3, VERSION_PROPIA 3300); lo publicado sigue siendo la 3.2 hasta armar web y APK
14/11 03:45 5dd6233 JXMod: las armas TFA ya no se bajan solas a la pose de seguro (game.GetGlobalState y GLOBAL_*)
14/11 03:46 a51a3da Merge branch 'worktree-agent-a42e1c71048c807e7' into claude/ports-continuation-dm754a
14/11 04:48 75d2f81 pruebas/manos_c: las armas con vista v_ (la v_pistol de prueba y el guantelete de Thanos) no llevan manos y no cuentan como c_
14/11 04:55 493e757 LEEME: sección JXMod 3.3 (lo del Discord después de la 3.2 y las pruebas con las cuatro partes juntas)
14/11 05:05 27f401f JXMod 3.3 publicada: APK y web con código, y el aviso de actualización (version.json 3300)
14/11 05:35 276fcb8 C_Arms: las vistas con brazos de referencia invisibles ($no_draw) llevan las manos del jugador (Brawlers de BO3)
14/11 05:40 7f63f6f pruebas/manos_c: sin manos sólo las vistas que traen brazos visibles (la v_pistol); el Cat Gun y el karambit son v_ sin brazos y llevan manos
14/11 15:20 da70122 JXMod: portada nueva del menú principal (pedido del dueño: «una interfaz nueva así… botones con diseño»)
14/11 17:10 8e05db6 JXMod: BSMod anda (puño y patada en 1ª, ejecuciones con el Hero, NPC de HL2, nextbots y modelos de GMod, celu y red)
14/11 17:11 66f71c4 Merge BSMod compatible (ejecuciones) con la portada nueva
14/11 17:14 e0db7e3 gmod_api: DrawViewModel y DrawWorldModel quedaban adentro del comentario de Lock (BSMod); codigo_tragado vuelve a 0
14/11 17:14 d884e9e JXMod 3.4: número de versión en el juego y en la app (todavía sin publicar)
14/11 19:06 fd51267 LEEME: sección 3.4 (todavía sin publicar) y sin el código de la página en las instrucciones de recuperación
14/11 19:56 8f2086a JXMod 3.4 publicada: menú principal nuevo y BSMod (ejecuciones); APK y web con código, y el aviso de actualización (version.json 3400)
15/11 05:38 7af8e7f JXMod: menú principal «Tu depósito» (reemplaza la portada de la 3.4)
15/11 06:51 ee1a162 JXMod 3.5 publicada: menú principal «Tu depósito»; APK y web con código, y el aviso de actualización (version.json 3500)
15/11 10:05 b9264f6 JXMod: modo grabación (grabar.js) y el sonido interno con el grabador del celular
15/11 11:07 2cbdf56 JXMod: vuelve el menú clásico de la 3.3, mejorado, y el selector «Menú de inicio: Clásico / Depósito»
15/11 11:08 841da2b Merge menú clásico mejorado y selector de menú con el modo grabación
15/11 13:00 ccac012 JXMod 3.6 publicada: vuelve el menú clásico mejorado, selector de menú y modo grabación; APK y web con código (version.json 3600)
15/11 22:49 1d32447 WIP agent-aeedc94d25a546b32 (cortado para terminarlo a mano)
15/11 22:49 6f0d6c1 WIP agent-a617e55ecfa2cc3de (cortado para terminarlo a mano)
15/11 22:49 4b31ec2 WIP agent-a005ff0eb3af74e43 (cortado para terminarlo a mano)
15/11 22:50 e3db6ce Merge fondos animados (video) con los paneles nuevos
15/11 22:50 933170f Merge branch 'worktree-agent-a005ff0eb3af74e43' into claude/ports-continuation-dm754a
15/11 22:54 b147939 JXMod 3.7 (en preparación): versión 3.7, sección del LEEME y la parte 0 de musica.mjs con una estación de YouTube
16/11 01:14 ca05469 JXMod 3.7 publicada: paneles nuevos con animaciones, fondos animados, música en el menú y La grieta fija; APK y web con código (version.json 3700)
16/11 02:13 607a3aa JXMod 3.7.1 publicada: postura derecha (sin joroba), la tinta de los botones no deforma Mods, sin el consejo de Verity; APK y web con código (version.json 3701)
16/11 03:25 598d83b JXMod 3.8 publicada: carga al entrar a una partida (idea de GOLDEN), maquinitas renovadas (subir varios, pesados, .zip y carpetas; cualquier HTML; foto de tapa; Ajustar; sala a 15 cuadros con copia adaptable), manos en el gabinete; APK y web con código (version.json 3800)
16/11 15:23 4053d68 JXMod 3.8.1 publicada: Editar controles y Editar arma en la mano con la interfaz nueva, aparición segura en mapas sin spawn, la tele de YouTube en la grabación, multijugador más liviano; APK y web con código (version.json 3801)
16/11 15:38 ff555ab JXMod 3.8.2 publicada: «You Know How We Do It» de Ice Cube en la radio West Side; el número interno del APK se puede fijar (VCODE); APK y web con código (version.json 3802)
16/11 16:27 93c223a JXMod: herramientas del tráiler (grabar cuadro por cuadro a 60 por segundo con títulos) y de medir los mapas de Hyper Sandbox (sin publicar)
16/11 16:57 1dcdde3 JXMod: armas propias (armasjx.js), la Physics Gun nueva hecha en código con manos, tercera persona, ícono y sonidos propios; las de GMod/HL2 pasan al mod de la comunidad «Armas clásicas» que viene instalado (sin publicar)
16/11 17:32 ed1a29b JXMod: la Physics Gun es la de GMod modificada (azul acero, sin las garras, con la marca JX)
16/11 18:47 351582e JXMod: rayo con cuerpo para la Physics Gun, arreglo del agarre y el tráiler de 45 s
17/11 00:46 9901a6a JXMod: los 8 mapas de Hyper Sandbox hechos de nuevo, propios y con el mismo nombre
17/11 00:53 ea9cd7b JXMod: Gravity Gun, Tool Gun y palanca propias (modificadas, como la Physics Gun)
17/11 01:07 a56069b JXMod: accesorios importados para la cabeza (GLB, GLTF, OBJ o el .zip de Sketchfab)
17/11 01:13 7de03de JXMod: olas, ondas y agua de verdad en el lago, el mar, el oasis y el puerto
17/11 01:42 911915a JXMod: menos trabajo por cuadro en las armas de JXMod y pruebas nuevas
17/11 01:42 c53ac6c JXMod: LEEME de lo que va de la 3.9 (mapas propios, armas, accesorios, agua, pruebas)
17/11 02:47 8b1a6cf JXMod 3.9 publicada: los 8 mapas clásicos hechos de nuevo y propios; Physics Gun, Gravity Gun, Tool Gun y palanca de JXMod (las de GMod en el mod Armas clásicas); accesorios importados para la cabeza; olas, ondas y se nada en el lago, el mar y el oasis; APK y web con código (version.json 3900)
17/11 12:09 37edff0 JXMod: las teclas de los mods abajo a la derecha, sin azul y sólo las que andan
17/11 12:38 66925f7 JXMod: 25 mods probados; los botones de los mods entregan bien sus teclas
17/11 13:29 f9e9b5e JXMod 3.9.1 publicada: los botones de los mods abajo a la derecha, sin azul y sólo los que andan; las teclas de los botones de mods como las del teclado; 25 mods probados; APK y web con código (version.json 3901)
17/11 16:24 11a05e9 JXMod: el grabador del tráiler sirve para otros videos (escenas, tamaño de pantalla y CSS configurables)
17/11 17:16 bb7733c Corto vertical para TikTok: «Lo tomé literal» (escenas para trailer.mjs)
17/11 18:17 6d29f6b Corto para TikTok rehecho: gameplay en primera persona en City
17/11 19:54 995b43b Corto 3 para TikTok: «POV: le diste admin a tu amigo» en gm_construct
17/11 22:32 248d932 Corto de un solo dato: la heladera y la pelota caen juntas
17/11 23:36 5aa21fa JXMod: destrucción de autos y explosiones nuevas
18/11 01:42 95f90cb Corto 6 para TikTok: «Chocar a 100 km/h = caer de 13 pisos», con el final de Pepe
18/11 05:50 2998431 Corto 7: «La venganza de Pepe», analog horror 4:3 con el Viewfinder; zoom y linternas de los mods
18/11 14:54 3cc24ea Corto 7: Pepe deformado de verdad (cabeza y cuello en 3D, cara con sus píxeles), voz robot y música en reversa
18/11 18:13 6724f57 Corto: La venganza de Pepe 2 (cinta 3), analog horror 4:3 con el Viewfinder
18/11 19:51 bacdd9e Pepe 2: la huida con realismo (corre al campo abierto, continuidad) y la instructora en voz robot
19/11 00:20 528b7fc JXMod: lo del Discord después de la 3.9.1 (sin publicar)
19/11 01:42 b741a5c JXMod 3.9.2 publicada: mapas más livianos (terreno RTIN y props por zona), la pantalla ocupa todo el celular, cámara de frente, archivos del celular en la radio y la tele, personajes importados como NPC o muñeco, grabación «Pantalla del celular» con YouTube y la tele; APK y web con código (version.json 3902)
19/11 02:37 77160f2 JXMod: actualizaciones por partes en la app y los celulares flojos del Discord
19/11 04:11 3a5b586 JXMod 3.9.3 publicada: actualizaciones por partes dentro de la app y mejor rendimiento en celulares de gama baja
19/11 21:11 0799eec JXMod: el evento de los 300 miembros (cinta VHS, 10 acertijos en gm_construct de noche, Pepe)
20/11 00:18 97e9018 Evento 300: a veces Pepe pregunta en el interrogatorio
20/11 00:29 0e67c9a JXMod 3.9.4 publicada: el evento de los 300 miembros
20/11 01:57 532b3c6 JXMod 3.9.5 publicada: el evento terminó, Pepe vuelve y eventos en vivo
20/11 02:54 013adfa JXMod: el panel (app admin), Bugs y sugerencias en el menú y órdenes en vivo
20/11 04:42 7722acc JXMod: versión 3.9.6 en el código y la app admin fuera del service worker
20/11 04:44 087a488 JXMod 3.9.6 publicada: Bugs y sugerencias en el menú, el panel y las órdenes en vivo
20/11 06:08 80a4c63 JXMod: luz y escala de los mapas del Workshop, y puertas para Door Bust (lo del panel)
20/11 06:16 633625e JXMod 3.9.7 publicada: luz y escala de los mapas del Workshop y puertas de Door Bust
20/11 06:42 067395a JXMod: el HTML suelto se actualiza solo desde la web (al salir y entrar)
20/11 07:03 c65571f JXMod: los nextbots con EnableMatrix se dibujan con su matriz (Pumpkin Rabbit enano)
20/11 07:10 46dd58d JXMod 3.9.8 publicada: nextbots con su matriz (Pumpkin Rabbit) y HTML suelto que se actualiza
20/11 07:18 2023b30 JXMod: el HTML suelto pide al otro lugar el archivo que no coincide
20/11 08:27 c329562 JXMod: registro con Gmail (sin Google) y notificaciones desde el panel
20/11 16:44 e2a0a7d Stickerazo: primera versión web (recorte, editor y packs de stickers)
20/11 17:02 4873d99 Stickerazo: app de Android con «Agregar a WhatsApp»
20/11 18:03 933cfb5 Stickerazo: lo que no tiene ninguna otra app de stickers
20/11 18:14 1a16645 Stickerazo: servidor de la comunidad (cuentas, packs publicados, feed, me gusta, seguir, buscar, denuncias, moderación)
20/11 18:27 77519cb Stickerazo: la comunidad en la app (feed, packs publicados, perfiles, publicar)
20/11 18:38 fe1c5a2 Stickerazo: más argento (fileteado propio y 12 packs listos de acá)
20/11 19:23 b6c49fb JXMod: Bugs y sugerencias no se pisa con letra grande, y una publicación cada 3 minutos
20/11 19:34 558e795 Stickerazo: se actualiza solo (como JXMod) y diseño nuevo, negro de verdad
20/11 19:35 e6f66b8 Stickerazo: las actualizaciones aceptan nombres con puntos (APACHE-2.0.txt)
20/11 20:03 a2db940 Stickerazo: Android 16 y paquete para Google Play (AAB), hojas sin desenfoque
20/11 21:10 fb5dbc8 Stickerazo: 184 memes con fotos libres (CC0 / dominio público), en 19 packs
20/11 21:52 06c19c8 Stickerazo: memes estilo «xD» y modo xD en el editor
20/11 22:08 eb14f28 Stickerazo: inicio tipo red social y transición líquida entre pantallas
20/11 22:25 fe81e13 Stickerazo: perfil tipo red social, bienvenida animada y textos más naturales
20/11 22:26 9516009 Stickerazo: el collage de la bienvenida no tapa el título
20/11 22:33 ced0052 Comunidad de Stickerazo adentro del servidor de JXMod (/sz)
20/11 23:00 590c592 Stickerazo: comunidad en vivo (servidor de JXMod), mapa a pantalla completa, íconos propios, pop y vidrio líquido
20/11 23:15 d23052b Stickerazo servidor: ocultar packs propios y el evento del termo
21/11 00:06 fddfe69 Stickerazo: foto y portada propias, termo 3D, música por país, modo claro
21/11 00:08 2c295a9 Stickerazo pruebas: el perfil público trae la foto y la portada
21/11 00:49 e037d68 Stickerazo 0.7: se actualiza sola de verdad, página web propia y kit de tiendas
21/11 01:20 be62eeb Stickerazo página: anda sola (Cloudflare Pages) aunque el servidor no conteste
21/11 01:36 84e0fa7 Stickerazo: dirección propia stickerazo.pages.dev (sin el nombre de la cuenta)
21/11 02:04 5c59d89 Stickerazo: entrar con Google, privacidad y términos completos, página terminada
21/11 02:06 10cc9a7 Stickerazo: Google se prende sólo con SZ_GOOGLE_CLIENT_ID
21/11 02:47 af3f787 Stickerazo 0.8: anuncios de Google (AdMob) con consentimiento, sin Gradle
21/11 03:13 3d6cd19 Stickerazo: entrar con Google prendido (SZ_GOOGLE_CLIENT_ID, el mismo cliente ya autorizado)
21/11 03:24 cc7255a Stickerazo: tus packs guardados en tu cuenta (si borrás la app, vuelven)
21/11 04:12 4387277 Stickerazo: 484 letras más, texto y capas con muchas más opciones, y la música como tocadiscos
21/11 04:14 0c03576 Stickerazo: la guía de Galaxy Store con el D-U-N-S que pide Samsung y el app-ads.txt de AdMob
21/11 05:24 66a1a93 Stickerazo: las cuentas de tiendas y AdMob piden 18 años (si no, a nombre de un adulto responsable)
21/11 05:46 7e29d85 Stickerazo: Premium (mes, año o de por vida) y donaciones con PayPal, apagado hasta tener las claves
21/11 05:54 ca12b94 Stickerazo: Premium prendido con PayPal de verdad (planes por mes y por año creados); botones sobre el fondo oscuro y sin «Pay Later»
21/11 05:59 340c4fe Stickerazo: sin devoluciones salvo el arrepentimiento legal; Premium se quita solo si la plata vuelve (reembolso o contracargo) y a mano desde el panel
21/11 15:29 60b0d3a Stickerazo 0.8 (sin anuncios): las páginas de Stickerazo —pagar, entrar con Google, legales— en una pestaña de Chrome encima de la app
21/11 16:05 dd0bfc7 JXMod 3.9.9 publicada: «Bugs y sugerencias» sin pisarse con letra grande, Avisos y entrar con Gmail
21/11 16:20 4a65901 JXMod: el chat de texto sale en los videos del modo grabación (Bugs y sugerencias) y la prueba de nextbots baja addons y mapas del Workshop
21/11 16:26 dcc1753 JXMod: las manos que pone el Lua del arma (GetHands():SetModel) y el bonemerge por nombre con otros esqueletos (Suicide Gun sin manos)
21/11 16:33 7f54e9a JXMod: los terrenos de dos texturas de los mapas del Workshop (WorldVertexTransition): gm_boreas con su nieve
21/11 16:46 7f13ab7 JXMod: buscar en el Workshop por ID o link, límite de NPC elegible y botón de correr en el celular
21/11 16:48 5ae87da JXMod 3.9.10 publicada: chat en los videos, manos de la Suicide Gun, gm_boreas, Workshop por ID, límite de NPC y botón de correr
21/11 17:07 05b667b Stickerazo: editor pro, parte 1 — deshacer y rehacer arriba, xD de a uno, y Dibujar, Forma, Fondo, Neón, Capas y Alinear
21/11 17:33 bc4541c Stickerazo: editor pro, parte 2 — Movimiento con puntos clave y Efectos de video (Premium), y todos los íconos propios (sin emojis)
21/11 17:34 997226c Stickerazo: beneficios de Premium compatibles con la app publicada (emojis para las viejas, íconos propios para la nueva); Flotar, Bamboleo y Mi país con íconos mejores
21/11 17:46 10cf77a Stickerazo: 73 pegatinas propias y 14 plantillas en el editor
21/11 17:55 194280e Stickerazo: la interfaz con pegatinas — pantallas vacías, bienvenida y avisos con pegatinas propias, y los carteles del inicio armados con ellas
21/11 17:59 ec63b93 Stickerazo: oferta de bienvenida de Premium al entrar, con contador real
21/11 18:07 605fd9b Stickerazo: canción en el perfil (como Instagram) y avatares con pegatinas en vez de emojis
21/11 18:21 f3292e3 Stickerazo: liviana en celulares flojos y el agua sólo en los momentos importantes
21/11 18:52 0a9c904 Stickerazo: zona Social (publicaciones), amigos y chat
21/11 18:59 8d55841 Stickerazo: la página web sin emojis como íconos
21/11 21:31 21f9a4d Stickerazo 0.8: APK nuevo y actualización de la página (editor pro, pegatinas, oferta, canción, social y chat)
21/11 22:07 6740e94 Stickerazo: Comunidad y Chat en la barra de abajo, la música en un disco de la esquina, y APKPure
21/11 22:07 af63d45 JXMod: mapas con contenido pesado aparte (SMG4 Showgrounds): cartel para bajarlo y rearmar el mapa
21/11 22:11 957c110 Stickerazo: el ícono de la tienda en PNG de 32 bits con alfa (APKPure y Play lo piden así)
21/11 22:14 c352e19 Stickerazo: captura de la tienda sin «los mejores» (APKPure no quiere rankings en las capturas)
21/11 22:19 0c1a521 Stickerazo: ficha sin «los mejores»
21/11 22:38 292c32d Stickerazo: la 0.8 enviada a revisión en APKPure
21/11 23:02 0d8a9dc JXMod: Pee Swep y Doudou Pet andan (entidades de cliente, trazas de largo cero, utf8, HasWeapon)
21/11 23:16 6119f9d JXMod: Novedades, aviso de espera para publicar y un chat mejor (sugerencias del panel)
21/11 23:30 2a1747f JXMod 3.9.11: publicada (web con código, APK, OTA, suelto)
22/11 00:09 fd41375 JXMod: las manos con la luz del lugar en los mapas del Workshop; videos del panel
22/11 02:16 7441a60 Bot de Discord de JXApps en el Worker de la tienda
22/11 02:25 b7b08a3 Bot de Discord: código de admin y puesta en marcha de JXBot
22/11 02:29 86ac004 Bot de Discord: /admin también por mensaje privado al bot (vale en todos los servidores); prueba 10/10
22/11 02:39 99504c1 JXBot: IA con Gemini y chat normal (privados, /JB y menciones)
22/11 02:46 f62042e JXBot: arreglo de «queda pensando» (fetch llamado como método da Illegal invocation en Cloudflare; en la puerta ni existía)
22/11 02:57 433bafd JXBot: la puerta se reinicia sola con cada versión nueva (version_metadata + state.abort), último error y diagnóstico en el estado; prueba 13/13
22/11 03:10 5b877e6 JXBot: /jb en los servidores lo completa la puerta (antes quedaba «pensando» para siempre)
22/11 03:30 a61e629 JXBot: el lore de JXMod y una memoria que enseñan los admins
22/11 03:49 8ac324a JXBot: bienvenida, rol automático, niveles, moderación y utilidades
22/11 03:58 1da8ac0 JXBot: warns con borrado, alerta a los admins a los 3, perdonar y más moderación
22/11 04:38 b63b088 JXBot: límite para hablarle (7 s y 10 cada 30 min; admins y mods sin límite)
22/11 05:33 4b87596 JX Hand Engine: motor de seguimiento de manos en Rust (nativo y WebAssembly)
22/11 05:50 7b9b579 JXMod: tus manos con la cámara (JX Hand Engine en la app)
22/11 05:57 c63dbbd JX Hand: la app aparte (cámara trasera) y JXMod sin la integración
22/11 07:29 7147e6a JX Hand 2.0: Rust nativo en Android, varios hilos con NEON y visión con poca luz
22/11 15:44 89b76dd JX Hand 2.1: la mano en 3D que recubre la tuya y cuentas en float16
22/11 16:13 f3ae3fe JX Hand 2.2: más rápido y sin tirones (depthwise en float16, detector de fondo, filtro pegado)
22/11 16:30 09145c6 JXMod: tus manos con la cámara con JX Hand Engine nativo (sin publicar)
22/11 16:31 69806b0 JXMod: la vista chica de las manos un poco a la izquierda del medio (no roza la barra de armas)
22/11 16:39 7a7d24f JXMod manos: la vista chica con lo que ve la cámara y los cuadros por segundo, siempre visible; el arma ya en la mano al prender
22/11 17:20 c7a6a27 JXMod: modo VR (sin publicar): dos ojos con la curva de las lentes, cabeza con el giroscopio, manos 3D con la cámara de atrás, caminar con las manos como un gorila, agarrar y mando
22/11 17:36 ea801c6 JX Hand: los núcleos grandes bien elegidos (capacidad y modelo de CPU, no sólo frecuencia), el buscador de fondo con menos prioridad, y el desglose de los ms
22/11 18:04 414447b JX Hand 2.3b: suma y PReLU fundidos en la convolución, la mano que se escapa se recupera sin el detector, poca luz sin fantasmas, y la medición por capa en el celular
22/11 18:34 dad7721 JX Hand 2.3c: los hilos se eligen midiendo en el celular, MaxPool en paralelo y la primera capa deja su salida en float16
22/11 18:42 9bad64d JX Hand 2.4: las 1×1 de la red de los puntos en 8 bits con SDOT (el doble que float16 por instrucción)
22/11 19:23 e1a0335 JX Hand 2.5: núcleos medianos, i8mm, 8 bits sin SDOT, escala por píxel, depthwise de a 8 y medir en el celular
22/11 19:55 1111f3e JX Hand 2.6: arreglo de los hilos de más que frenaban todo, sondeo desde los grandes y 8 bits con NEON
22/11 20:48 2e760f4 JXMod VR: los brazos del modo cámara, el brazo te limita, agarrar de cualquier punto (props, NPCs) y trepar
22/11 21:45 7bda528 JXMod: los mods oficiales pasan a Opciones del menú de props
22/11 22:03 5b30ee9 JXMod: las armas son las de GMod enteras, pintadas en dos tonos (sin piezas ni cartel JXM)
22/11 22:59 0883b53 JXMod: bugs del panel del 22/11 (Suicide Gun, nextbots que no siguen, Bonnie, Doudou Pet en brazos)
22/11 23:17 8628ded JXMod: botones sólo de lo que el arma usa, yield dentro de pcall y Routine Type 05
22/11 23:42 8d321c2 JXMod 3.9.12: publicada (web con código, APK, OTA, suelto)
23/11 00:50 86c830b JXMod Personal: menú Q de GMod, addons y mod packs, emotes de GMod y del Workshop
23/11 00:55 7302eea JXMod Personal: los NPCs con su ícono de GMod (materials/entities) y los personajes de JXMod al final
23/11 01:30 954ad60 JXMod Personal: vehículos de GMod para adelante, el Airboat en el agua y el agua de HL2
23/11 01:45 7e519cd JX Motor, etapa 1: el dibujo nativo en Rust (GLES 3) de la escena del juego
23/11 02:38 409c270 JX Motor, etapa 2: el mundo dibujado por el motor nativo en Rust dentro de la APK personal
23/11 02:50 6d03d8e JX Motor: el mismo sombreado que WebGL en Alto, el cielo de GMod y oclusión ambiental
23/11 02:54 e8287bb JX Motor: lo que dibuja el motor nativo ya no ocupa memoria en WebGL
23/11 03:06 406cf32 JX Motor: partículas, marcas de frenada y las mallas que arma el juego en el motor nativo
23/11 03:19 30546ea JXMod: la física en Rust (WebAssembly) — el bucle de subpasos de XPBD
23/11 03:19 8f10732 JX Motor: si el motor nativo falla en el celular, vuelve solo a WebGL
23/11 03:44 63bda9e JXMod: «Rust (JX Motor)» en el selector de motor, motor de 32 bits y celulares de gama alta bien detectados
23/11 04:02 d4a963c JX Motor (sin probar en el juego todavía): lugares fijos por cosa, cuadros en binario y física sólo de lo despierto
23/11 04:18 b0f6f66 JX Motor: arreglo del cuadro JXC2 (la cabecera se había borrado) y probado
23/11 04:37 2cd5428 JX Motor: agua con refracción y dibujos con instancias
23/11 04:41 4d3bc6f JX Motor: 120 Hz en la superficie y sin guardar profundidades que no se usan
23/11 05:13 2dba20b JXMod: menos CPU con 50 NPC y 500 objetos (grilla de cuerpos, rayos, esqueletos)
23/11 05:37 d890974 JX Motor: sólo viaja lo que cambió de verdad, y los pares de la física sin ordenar todo
23/11 05:41 afffffa JXMod personal: prueba de carga en Ajustes y el detalle de tiempos con JX Motor
23/11 06:09 d8c632b JX Motor sobre wgpu (Vulkan): todas las pasadas en WGSL
23/11 06:21 fe3497a JX Motor en Android sobre wgpu: Vulkan (GLES de respaldo)
23/11 15:37 95295bc JX Motor (wgpu): menos trabajo por píxel y tiempos de placa por pasada
23/11 15:47 490635e JXMod nativo, etapa 1: el paquete y los mapas en Rust (sin JS)
23/11 16:09 8452382 JXMod nativo etapa 2: la app de Android en Rust sin WebView (OpenGL 3)
23/11 16:32 021151d JX Motor: sombra en dos cascadas y el tiempo de la placa en el HUD
23/11 16:47 42486df JX Motor: Vulkan propio (ash, sin wgpu) y la app elige el motor
23/11 17:03 14a5e55 JXMod nativo etapa 3: el jugador con choques (como jugador.js)
23/11 17:10 ea76a5a JX Motor: OpenGL 2 para los teléfonos viejos (el tercer motor)
23/11 17:25 46e6167 JXMod nativo: agua de HL2 en los tres motores y el menú de objetos
23/11 17:32 f687675 JXMod nativo: nadar, bucear y ahogarse (como agua.js)
23/11 17:37 6ac839d JXMod nativo: el sonido (MediaCodec y AAudio del sistema, sin Java)
23/11 17:39 1fc7a0b JXMod nativo: el ambiente de los mapas (viento y pájaros, como sonAmbiente)
23/11 17:55 8c326e3 JXMod nativo: Ajustes (calidad, resolución, sensibilidad, campo de visión, volumen, motor y mapa)
23/11 17:56 52758c8 JXMod nativo: la física de los objetos en Rust (fisica.js y la parte física de objetos.js)
23/11 18:08 6a6d797 JXMod nativo: los objetos con física (caen, chocan, se apilan) y el jugador los empuja
23/11 18:15 b6f9e10 JXMod nativo: el personaje y su animación en Rust (personas.js, humano.js, modelo.js)
23/11 18:15 9300ec6 JXMod nativo: Physics Gun y Gravity Gun (como armas.js)
23/11 18:20 c9c9484 JXMod nativo: el cuerpo del jugador y la cámara en tercera persona y de frente (0.8)
23/11 18:28 fb1d023 JXMod nativo: el arma en la mano y el rayo de la Physics Gun (vista.js)
23/11 18:37 6e24914 JXMod nativo: la Tool Gun con sus 20 herramientas (herramientas.js)
23/11 18:48 6c5c14f JXMod nativo: las armas de fuego y de golpe (armas.js)
23/11 18:57 2352620 JXMod nativo: apuntar con el arma al centro (vistaAds) y ∞ en las letras
23/11 19:16 d3f29e4 JXMod nativo: los íconos de las armas en la barra y en el botón del arma
23/11 19:27 cac953c JXMod nativo: los 17 mapas de la web (pestaña Mapa en Ajustes) y todos los paquetes aparte en la APK
23/11 19:31 ad426b9 JXMod nativo: los vehículos y la flotación en Rust (vehiculos.js y aguaCuerpos de agua.js)
23/11 19:33 3a3bc45 JXMod nativo: los NPC en Rust (npc.js y lo de personas.js que necesitan)
23/11 20:14 a6203d1 JXMod nativo: los efectos en Rust y en los tres motores (efectos.js, marcas.js)
23/11 20:14 33bc20b JXMod nativo: NPCs, vehículos y efectos en el juego
23/11 20:42 f8b91fa JXMod nativo: pintura de las armas de JXMod en los tres motores y personajes en OpenGL 2
23/11 20:43 35d08ec JXMod nativo: el Lua de GMod en Rust (crate jxlua)
23/11 21:24 ec47032 JXMod nativo: Actitud de los NPC en la Tool Gun, bocina y turbo al manejar
23/11 21:28 7c55ff6 JXMod nativo: el multijugador en Rust (red.rs, cliente MQTT y el TLS de Android)
23/11 21:38 257e23d JXMod nativo: armas en la mano del personaje y sentado en los autos
23/11 21:59 85bfdf9 JXMod nativo: el multijugador adentro del juego (salas, los demás y sus cosas)
23/11 22:01 c92a3d9 JXMod nativo: la API de GMod en Rust sobre el Lua nativo (crate jxgmod)
23/11 22:10 0247810 JXMod nativo: escribir texto (chat de la sala, contraseñas, nombre y la actitud de un NPC)
23/11 22:14 cde0e51 JXMod nativo: los NPC en el multijugador
23/11 22:17 781bc54 JXMod nativo: PvP en la sala (los tiros le pegan a los otros jugadores)
23/11 22:25 3397ea6 JXMod nativo: lo que tarda cada parte del cuadro (en pantalla) y la prueba de carga
23/11 22:35 89645fc JXMod nativo: los addons de GMod en el juego, la barra de vida y la pestaña Mods
23/11 22:39 d2bd8a5 JX Motor: el LEEME con la app nativa (crates, motores, pruebas y cómo armar la APK)
24/11 14:11 46e0f15 JXMod nativo: emotes (el panel, en la red y los de los demás)
24/11 14:30 eb41e67 JXMod (web y nativo): sentados de verdad en los autos
24/11 15:01 b957dad JX Motor: PORTEO.md, cada archivo de la web y dónde quedó en la nativa
24/11 15:06 50283a3 JXMod nativo: la censura del chat (censura.js)
24/11 15:15 f9f762d JXMod nativo: los modelos, armas y nextbots de los addons de GMod
24/11 15:16 e61be5f PORTEO.md: censura, modelos y nextbots de GMod
24/11 15:46 fa3d9d2 JXMod nativo: el menú de GMod, el contenido base y las manos
24/11 16:05 f925f9a JXMod nativo: los NPC y vehículos del menú de GMod andan
24/11 16:46 007c7d4 JXMod nativo: destrucción, nucleares, Cíclope, patadas, linterna, cámara libre, nativos y Pepe
24/11 16:55 48832df JXMod nativo: física más rápida y exacta bit a bit (barrido, pares e islas en hilos)
24/11 17:25 18e628f JXMod nativo: mapas del Workshop, puertas y lógica del mapa, portales, cielo 3D y ciclo de día
24/11 20:50 938a2df JXMod nativo: pantalla de inicio, paneles y menú de pausa como la web
24/11 21:24 a298166 JXMod nativo: gráficos automáticos (gfxauto.js) que buscan el refresco de la pantalla
24/11 21:49 9716136 JXMod nativo: gorros, accesorios, identidad, celular en la mano, juntos, ruleta y emotes de captura
24/11 22:04 1f5778a JXMod nativo: el pad de memes (memes.js) en la app Memes del celular
24/11 22:26 9944cf8 JXMod nativo: modelos de jugador de GMod, autorig, spawn de NPC y autos, Pill Packs y SWEP Construction Kit
24/11 23:59 a419ab4 Stickerazo: editor de video con línea de tiempo, audio de YouTube/TikTok/celu y stickers de video
25/11 00:16 4ee0646 Stickerazo: salidas para stickers con sonido en WhatsApp (video de 5 s, imagen con 10 s de audio)
25/11 00:22 8ad8b7b Stickerazo: motor de WhatsApp para stickers con sonido (Node + Baileys, con el campo 26 del audio)
25/11 00:28 1b0fda2 Stickerazo: mandar stickers con sonido desde el editor (Ogg/Opus en el celu, vincular con código, a tu chat o un grupo)
25/11 00:45 2b4027d Stickerazo: stickers con sonido sin riesgo (clips para el buscador de WhatsApp vía KLIPY/GIPHY) y fuera el motor que vinculaba cuentas
25/11 00:45 bfbbc9e Stickerazo: clip con sonido para el buscador de WhatsApp (KLIPY/GIPHY), sin vincular cuentas, y lo que encontramos en WhatsApp 2.26.46
25/11 01:02 ddd3673 Stickerazo: publicar con sonido con un toque (el clip va al canal de Stickerazo en GIPHY/KLIPY y te dan un código para buscarlo en WhatsApp), revisión en /admin/clips
25/11 02:10 ff0b995 JXMod nativo: partida en el Wi-Fi (LAN) como la web: anfitrión con broker MQTT por WebSocket, anuncio por UDP, lista y entrar; APK 0.19
25/11 02:10 e89e8a5 JXMod nativo: PORTEO.md, lan.js hecho
25/11 02:11 5c592f1 JXMod motor: ignorar la carpeta de compilación (target/)
25/11 02:49 c130f19 JXMod nativo: APK liviana (192 → 49 MB): los paquetes aparte se bajan cuando hacen falta como en la web (con progreso en la pantalla de carga), la biblioteca de GMod se baja la primera vez y los íconos del menú van en WebP
25/11 03:28 33831d1 JXMod nativo 0.21: arreglo de los mapas que no abrían con mods instalados (GMod esperaba su biblioteca) y de la bajada de la biblioteca; actualizaciones desde la app que se instalan encima (web/nativo.json, Actualizar.java)
```
