# Stickers con sonido en WhatsApp: qué se puede y qué no (25/11/2026)

Revisado en la APK oficial de WhatsApp para Android **2.26.46.83** (bajada de whatsapp.com) y en WhatsApp Web.
Regla de Stickerazo: **nada que ponga en riesgo de bloqueo la cuenta del usuario ni la nuestra** (nada de clientes no
oficiales, bots que vinculan cuentas ni «WhatsApp modificados»).

## Lo que NO sirve (todavía)
- **Packs de terceros** (`ENABLE_STICKER_PACK` + nuestro ContentProvider): el lector de WhatsApp
  (`ThirdPartyStickerFetcher`) pide sólo `sticker_file_name`, `sticker_emoji` y `sticker_accessibility_text`. No lee
  audio. WhatsApp dijo que está «en sus planes» (WhatsApp/stickers #1163). Cuando agreguen una columna de audio, la app
  ya puede guardar el audio de cada sticker (web/ogg.js arma Ogg/Opus, lo que usan las notas de voz).
- **`com.whatsapp.intent.action.SEND_STICKER`** (`SendStickerCommandActivity`, nuevo): manda un WebP 512×512 de hasta
  500 KB, pero sólo a apps de una lista (paquete + huella de la firma, `StickerCommandTrustedPackageVerifier`). Sin audio.
- **`com.whatsapp.provider.sticker_command`** (`StickerCommandProvider`: generar con IA, instalar/quitar packs): también
  sólo para apps de confianza de Meta.
- **API de WhatsApp Business (Cloud API)**: el mensaje `sticker` es sólo un WebP; no tiene audio.
- **Motor propio que se vincula a la cuenta** (lo probamos con Baileys): funciona (el formato es
  `Message.audioStickerMessage` = campo 134 → `StickerMessage` con `audioMessage` = campo 26, Ogg/Opus), pero es un
  cliente no oficial: **riesgo de bloqueo**. Lo sacamos.

## Lo que SÍ sirve, oficial y sin riesgo
1. **El buscador de stickers de WhatsApp con clips de GIPHY y KLIPY.** En 2.26.46 (`ClipsSearch`, `ClipSoundProbe`)
   WhatsApp busca en `https://api.giphy.com/v1/videos/search` (rating `pg-13`) y en
   `https://api.klipy.com/api/v1/…/clips/search`, usa la vista WebP del clip y lee los últimos 64 KB del MP4 para ver
   que tenga pista de sonido (`moov/trak/mdia/hdlr` = `soun`). En WhatsApp Web están las banderas
   `sound_stickers_giphy_clips_enabled`, `sound_stickers_consumption_enabled`, `sound_stickers_creation_enabled`,
   `sound_stickers_channels_send_enabled` y `sound_stickers_audio_loop_count = 3` (las prende WhatsApp de a poco).
   O sea: **un clip con sonido subido a KLIPY o GIPHY le aparece como sticker con sonido a cualquiera que lo busque**,
   sin crear nada ni vincular cuentas.
   - KLIPY: sube cualquiera (klipy.com/create → «Create Clip»; MP4/MOV/WebM, hasta 70 MB; revisión antes de ser
     público; 20 por día; programa de socios con más límite y tilde verificada).
   - GIPHY Clips: sólo canales de marca o artista aprobados (giphy.com/upload; 24 o 30 cuadros, con sonido, ≤ 30 s).
   - En la app: Exportar → «Clip con sonido para el buscador de WhatsApp» (720×720, 30 cuadros, hasta 10 s, con
     audio) y la guía para subirlo.
2. **El creador de WhatsApp** (para quien ya lo tiene): de un video se queda con 5 s de su sonido; a una imagen se le
   ponen hasta 10 s de audio. La app deja listos el video («Sticker con sonido») o la imagen + el audio.
3. **Canales de WhatsApp** (`sound_stickers_channels_send_enabled`): un canal de Stickerazo puede publicar stickers con
   sonido hechos con el creador oficial; los seguidores los guardan en favoritos.

## «El KLIPY de Stickerazo»: publicar con un toque (servidor/clips.js)
Un proveedor propio no sirve: WhatsApp tiene fijas en su código las direcciones de GIPHY y KLIPY. Lo que sí hacemos es
publicar nosotros, en el canal de Stickerazo, lo que manda la gente:
1. En la app: Exportar → «Publicar con sonido en WhatsApp» (título, palabras, «es mío» y «va a ser público»). El clip
   (720×720, 30 cuadros, ≤ 10 s, con sonido) sube en pedazos de 1 MB al servidor de la comunidad y le dan un **código**
   (`sz` + 5 letras). «Mis clips» muestra el estado.
2. Se revisa en `/admin/clips` (con la clave de admin): Aprobar / Bajar / Ya lo subí a mano / Rechazar.
3. Al aprobar, si el Worker tiene los secretos `GIPHY_KEY` (clave de producción de GIPHY con subida) y `GIPHY_CANAL`
   (el usuario del canal de Stickerazo), lo sube solo a `upload.giphy.com/v1/gifs` con las etiquetas, el código y
   «stickerazo». Sin ellos queda «aprobado» para subirlo a mano a KLIPY o GIPHY con el código como etiqueta.
4. El usuario escribe el código en el buscador de stickers de WhatsApp y le sale su sticker con sonido.
Límites: 12 MB por clip, 6 por día por cuenta. Al borrar un clip o la cuenta se borra el video; si ya estaba en GIPHY,
queda en «sacar de GIPHY» para hacerlo a mano (GIPHY no lo deja por API).
Pendiente del dueño: cuenta de desarrollador de GIPHY + pedir producción con subida a canal; canal de marca (Clips con
sonido); y cuenta de creador en KLIPY (programa de socios para más de 20 por día).

