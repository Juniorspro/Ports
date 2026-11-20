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

    @JavascriptInterface public boolean estaEnWhatsApp(String id) { return Almacen.idValido(id) && WhatsApp.agregado(app, id); }
    @JavascriptInterface public boolean hayWhatsApp() { return !WhatsApp.instalados(app.getPackageManager()).isEmpty(); }

    @JavascriptInterface public boolean compartir(final String texto) {
        app.runOnUiThread(new Runnable() { @Override public void run() { app.compartir(texto); } });
        return true;
    }

    @JavascriptInterface public String version() { return app.version(); }
    @JavascriptInterface public String enlaceInicial() {
        final String[] r = new String[1];
        final java.util.concurrent.CountDownLatch l = new java.util.concurrent.CountDownLatch(1);
        app.runOnUiThread(new Runnable() { @Override public void run() { r[0] = app.tomarEnlace(); l.countDown(); } });
        try { l.await(2, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException e) { /* nada */ }
        return r[0];
    }
}
