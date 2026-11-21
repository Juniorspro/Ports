# Subir Stickerazo a las tiendas (las gratis primero)

Las cuentas tienen que estar **a tu nombre**: piden tu documento o datos tuyos, y yo no puedo crear cuentas. Todo lo
demás ya está listo: los textos en [`ficha.md`](ficha.md), las imágenes en `marca/play/` y un APK para cada tienda.

## Cuál conviene

| Tienda | Cuánto cuesta | Qué te piden | Qué subís |
|---|---|---|---|
| **Nuestra página** | Gratis | Nada | Ya está: **stickerazo.pages.dev** (el APK de `descargas/`) |
| **Uptodown** | Gratis | Una cuenta en su portal para desarrolladores | `Stickerazo-0.7-uptodown.apk` |
| **Galaxy Store** (Samsung) | Gratis | Cuenta Samsung y pasar a «vendedor comercial» en el Seller Portal (lo piden aunque la app sea gratis) | `Stickerazo-0.7-galaxy.apk` |
| **AppGallery** (Huawei) | Gratis | Cuenta Huawei y verificar tu identidad (foto del documento de los dos lados) | `Stickerazo-0.7-huawei.apk` |
| **Google Play** | US$25, una sola vez | Cuenta de desarrollador, documento y, si la cuenta es personal, 12 personas que la prueben 14 días antes de publicar | `Stickerazo-0.7.aab` |

Dejé afuera **Aptoide**, porque subir una app a mano cuesta una suscripción por año: gratis sólo copia las que ya están
en Play. También dejé afuera **F-Droid**, que es sólo para apps de código libre sin cuentas en servidores.

### Lo que tenés que saber de Google (importante)

Desde el **30 de septiembre de 2026**, en Brasil, Indonesia, Singapur y Tailandia, Android pide que las apps instaladas
por fuera de Play sean de un desarrollador verificado por Google. Google dice que se extiende al resto del mundo en
2027. Si no está verificada, se puede instalar igual, pero con más pasos y avisos.

La verificación completa se hace en la Android Developer Console y cuesta lo mismo que Play (US$25). O sea: cuando
puedas juntar esos US$25, te sirven para las dos cosas.

## Cada APK actualiza desde su tienda

Cada tienda tiene su APK. Todos tienen la misma app y la misma firma; cambia sólo **de dónde se actualiza**:

- **El de la página** (`descargas/Stickerazo.apk`): cuando hace falta un APK nuevo, la app lo baja y lo instala sola.
  La primera vez Android te pide permiso. Desde Android 12, las siguientes pueden entrar sin preguntar.
- **Los de las tiendas**: no tienen ese permiso, porque las tiendas no lo aceptan. El APK nuevo lo actualiza la tienda
  sola, cuando lo aprueba. La app no avisa, para no anunciar una versión que la tienda todavía no aprobó.
- **En todos**, la página de adentro (pantallas, textos, memes, arreglos) se actualiza sola al abrir la app, sin
  pasar por ninguna tienda. El APK nuevo hace falta sólo cuando cambia la parte de Android, y eso es raro.

Para armarlos (las llaves quedan fuera del repo):

```
python3 -I herramientas/armar_apk.py SALIDA.apk --version-name 0.7 --canal web --publicar   # el de la página
python3 -I herramientas/armar_apk.py SALIDA.apk --version-name 0.7 --canal galaxy           # galaxy, huawei o uptodown
python3 -I herramientas/armar_apk.py SALIDA.apk --version-name 0.7 --aab SALIDA.aab          # Google Play
```

## Paso a paso

### Uptodown (el más fácil)
1. Entrá al portal para desarrolladores de Uptodown y creá la cuenta.
2. «Subir app» → el APK de Uptodown.
3. Pegá el nombre, la descripción corta y la larga de `ficha.md`. Subí el ícono y las capturas.
4. Lo revisan y lo publican. Las versiones nuevas se suben igual.

### Galaxy Store
1. Creá una cuenta Samsung y entrá a **Samsung Seller Portal** (seller.samsungapps.com).
2. Fijate bien el **país** de la cuenta: después no se puede cambiar.
3. Pedí el estado de **vendedor comercial** (Commercial Seller). Samsung lo pide aunque la app sea gratis.
4. «Add New Application» → Android → idioma Español.
5. En **Binary** subí el APK de Galaxy. Ya cumple lo que piden: Android 16 como destino y sin código nativo.
6. Completá la ficha con `ficha.md`, las capturas y el ícono. En el formulario de contenido, usá las respuestas de
   `ficha.md`.
7. Mandalo a revisión. Tarda unos días.

### AppGallery
1. Creá una cuenta Huawei y registrate como **desarrollador individual** en developer.huawei.com.
2. Verificá tu identidad con el documento. Tarda unos días.
3. En **AppGallery Connect** → «Mis apps» → nueva app → Android.
4. Subí el APK de Huawei, el ícono de 216×216 (`tiendas/icono_216.png`) y las capturas.
5. Completá la ficha y la privacidad con `ficha.md`. Mandalo a revisión.

### Google Play (cuando puedas pagar los US$25)
1. Creá la cuenta en Play Console. La de **persona** alcanza.
2. Si la cuenta es personal y nueva, Play pide una **prueba cerrada**: 12 personas que la tengan instalada 14 días.
   Sirven los del Discord.
3. Subí `Stickerazo-0.7.aab`. Play guarda la firma de la app; nosotros firmamos con la «de subida».
4. Ficha, capturas, gráfico de funciones, «Seguridad de los datos» y cuestionario de contenido: todo está en
   `ficha.md`.

## Los anuncios (AdMob): lo que tenés que hacer vos

La app ya trae los anuncios de Google (versión 0.8). Hoy tiene puestos los **anuncios de prueba** de Google, porque los de
verdad salen de **tu** cuenta de AdMob: ahí te pagan. Mientras sean de prueba, el armado no deja publicar el APK.

1. **AdMob sólo paga bien si la app está en una tienda que acepta.** Sirven Google Play, Galaxy Store, Amazon Appstore,
   Xiaomi GetApps, OPPO y vivo. **No** sirven nuestra página, Uptodown ni AppGallery: ahí los anuncios salen muy
   limitados. Lo más rápido y gratis es **Galaxy Store** (ver arriba).
2. Entrá a **admob.google.com** con tu cuenta de Google y creá la cuenta (pide país, zona horaria y moneda). Los datos
   para cobrar los pide cuando llegás a un mínimo.
3. **Apps → Agregar app → Android**. Cuando esté en Galaxy Store, vinculala a esa ficha (paquete `com.stickerazo.app`).
4. Creá 2 **bloques de anuncios**: uno **«Banner»** y otro **«Intersticial»**.
5. En **Privacidad y mensajes → GDPR**, creá el mensaje de consentimiento (para Europa). La app ya lo muestra donde hace
   falta.
6. Pasame el **ID de la app** (`ca-app-pub-…~…`) y los **2 ID de bloque** (`ca-app-pub-…/…`). No son secretos, me los
   podés pegar en el chat. Los pongo en `android/anuncios.json`, armo la versión y la publico.

AdMob revisa la app («preparación de la app») en unos días. Hasta que la apruebe, muestra pocos anuncios.

## Entrar con Google: lo que tenés que hacer vos (1 minuto)

1. Entrá a **console.cloud.google.com/apis/credentials** con la cuenta de Google del proyecto de JXMod.
2. Abrí el cliente OAuth de tipo **«Aplicación web»**.
3. En **Orígenes autorizados de JavaScript**, agregá `https://rezobox-tienda.holasoyjuniors365.workers.dev` y guardá.
4. En **Pantalla de consentimiento de OAuth**, si dice «Prueba», tocá **Publicar app**.
5. Avisame y lo prendo: con eso también vuelve a andar el inicio con Google de JXMod.

## Qué no hacer

- **No subas el APK de la página a una tienda.** Tiene el permiso para instalarse solo, y Play y las otras lo rechazan.
- **No cambies la llave de firma.** Si una versión viene firmada con otra llave, no se instala encima: hay que
  desinstalar y se pierden los stickers del celular. La llave está fuera del repo; guardá una copia.
