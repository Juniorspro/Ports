package com.stickerazo.app;

import android.util.Base64;
import android.webkit.JavascriptInterface;

/** window.SZN en la página (web/puente.js). Corre en el hilo del puente, no en el de la pantalla: lo que toca la
 *  pantalla o abre otra app se pasa a la actividad. */
final class Puente {
    private final Inicio app;
    private final Almacen almacen;

    Puente(Inicio app, Almacen almacen) { this.app = app; this.almacen = almacen; }

    @JavascriptInterface public String leerPacks() { return almacen.leerPacks(); }
    @JavascriptInterface public boolean guardarPacks(String json) { return almacen.guardarPacks(json); }

    @JavascriptInterface public boolean guardarArchivo(String pack, String nombre, String b64) {
        byte[] d;
        try { d = Base64.decode(b64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return false; }
        return almacen.guardarArchivo(pack, nombre, d);
    }

    @JavascriptInterface public boolean borrarArchivo(String pack, String nombre) { return almacen.borrarArchivo(pack, nombre); }
    @JavascriptInterface public boolean borrarPack(String pack) { return almacen.borrarPack(pack); }

    /** contesta después, con window.__szResponder(resp, 'ok' | 'cancelado' | 'sin_whatsapp' | 'error: …') */
    @JavascriptInterface public void agregarAWhatsApp(final String id, final String nombre, final String resp) {
        app.runOnUiThread(new Runnable() { @Override public void run() { app.agregarAWhatsApp(id, nombre, resp); } });
    }

    // ---- el editor de video (web/video.js): el audio de YouTube y TikTok (en un hilo: contesta con window.__szAudio) y
    // guardar el video que salió (de a pedazos en base64; al último, a la galería y a compartir) ----
    @JavascriptInterface public void pedirAudio(final String id, final String tipo, final String arg) {
        new Thread(new Runnable() { @Override public void run() {
            final String r = Audios.atender(app, tipo, arg);
            app.jsDesdeHilo("window.__szAudio && window.__szAudio(" + org.json.JSONObject.quote(id) + "," + org.json.JSONObject.quote(r) + ")");
        } }, "audio").start();
    }
    @JavascriptInterface public boolean videoParte(String nombre, String b64, boolean primero, boolean ultimo) { return app.videoParte(nombre, b64, primero, ultimo); }
    @JavascriptInterface public boolean estaEnWhatsApp(String id) { return Almacen.idValido(id) && WhatsApp.agregado(app, id); }
    @JavascriptInterface public boolean hayWhatsApp() { return !WhatsApp.instalados(app.getPackageManager()).isEmpty(); }

    @JavascriptInterface public boolean compartir(final String texto) {
        app.runOnUiThread(new Runnable() { @Override public void run() { app.compartir(texto); } });
        return true;
    }

    @JavascriptInterface public String version() { return app.version(); }
    // (el APK nuevo: el número de este, de dónde se bajó —web o una tienda— y «Actualizar»)
    @JavascriptInterface public String codigoApk() { return String.valueOf(app.codigoApk()); }
    @JavascriptInterface public String canal() { return Actualizador.canal(app); }
    // (los anuncios: el banner sí o no, una pausa natural, y el botón de privacidad de los anuncios donde la ley lo pide)
    @JavascriptInterface public boolean hayAnuncios() { return app.publicidad != null; }
    @JavascriptInterface public void anuncioBanner(final boolean si) { if (app.publicidad != null) app.runOnUiThread(new Runnable() { @Override public void run() { app.publicidad.banner(si); } }); }
    @JavascriptInterface public void anuncioPausa() { if (app.publicidad != null) app.runOnUiThread(new Runnable() { @Override public void run() { app.publicidad.intersticial(); } }); }
    @JavascriptInterface public boolean anunciosOpciones() { return app.publicidad != null && app.publicidad.pideOpciones(); }
    @JavascriptInterface public void anunciosPrivacidad() { if (app.publicidad != null) app.runOnUiThread(new Runnable() { @Override public void run() { app.publicidad.opciones(); } }); }
    @JavascriptInterface public void actualizarApp() { app.runOnUiThread(new Runnable() { @Override public void run() { app.actualizarApp(); } }); }
    /** la versión de la página (la del APK o la última actualización que se está usando) */
    @JavascriptInterface public String versionWeb() { return String.valueOf(app.versionWeb()); }
    /** usar ya la versión nueva (vuelve a abrir la página) */
    @JavascriptInterface public void reiniciar() { app.runOnUiThread(new Runnable() { @Override public void run() { app.reiniciarPagina(); } }); }
    @JavascriptInterface public String enlaceInicial() {
        final String[] r = new String[1];
        final java.util.concurrent.CountDownLatch l = new java.util.concurrent.CountDownLatch(1);
        app.runOnUiThread(new Runnable() { @Override public void run() { r[0] = app.tomarEnlace(); l.countDown(); } });
        try { l.await(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException e) { /* nada */ }
        return r[0];
    }
}
