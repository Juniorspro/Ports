package com.stickerazo.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.ext.SdkExtensions;
import android.provider.MediaStore;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** La app: una WebView con la página (assets/www, servida en https://appassets.androidplatform.net, el dominio que
 *  Android reserva para esto) y lo que la página le pide al celular: fotos de la galería o la cámara, guardar los packs
 *  y agregarlos a WhatsApp. Ninguna foto sale del celular. */
public final class Inicio extends Activity {
    static final String HOST = "appassets.androidplatform.net", ORIGEN = "https://" + HOST;
    private static final String TAG = "Stickerazo";
    private static final int FONDO = 0xff14121c;
    private static final int PEDIR_FOTO = 1, PEDIR_CAMARA = 2, PEDIR_WA = 3;
    private WebView web;
    private Almacen almacen;
    private ValueCallback<Uri[]> pendiente;
    private String respWa;
    private int nFoto;

    @Override protected void onCreate(Bundle guardado) {
        super.onCreate(guardado);
        almacen = new Almacen(getFilesDir());
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(FONDO);
        web = new WebView(this);
        web.setBackgroundColor(FONDO);
        raiz.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(raiz);
        bordes(getWindow(), raiz);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.addJavascriptInterface(new Puente(this, almacen), "SZN");
        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new Cromo());
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        limpiarFotos();
        web.loadUrl(ORIGEN + "/index.html");
    }

    /** de borde a borde (obligatorio desde Android 15): la página va entre las barras del sistema y arriba del teclado */
    private static void bordes(Window w, View raiz) {
        w.setStatusBarColor(FONDO);
        w.setNavigationBarColor(FONDO);
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            raiz.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets ins) {
                    Insets b = ins.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                    Insets t = ins.getInsets(WindowInsets.Type.ime());
                    v.setPadding(b.left, b.top, b.right, Math.max(b.bottom, t.bottom));
                    return WindowInsets.CONSUMED;
                }
            });
        } else w.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    // ---- la página y sus archivos ----
    static String tipo(String n) {
        String e = n.substring(n.lastIndexOf('.') + 1).toLowerCase();
        if (e.equals("html")) return "text/html";
        if (e.equals("js") || e.equals("mjs")) return "text/javascript";
        if (e.equals("css")) return "text/css";
        if (e.equals("json")) return "application/json";
        if (e.equals("wasm")) return "application/wasm";
        if (e.equals("ttf")) return "font/ttf";
        if (e.equals("png")) return "image/png";
        if (e.equals("webp")) return "image/webp";
        if (e.equals("jpg") || e.equals("jpeg")) return "image/jpeg";
        if (e.equals("txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static WebResourceResponse respuesta(String tipo, InputStream in, boolean sinCache) {
        boolean texto = tipo.startsWith("text/") || tipo.endsWith("json");
        WebResourceResponse r = new WebResourceResponse(tipo, texto ? "utf-8" : null, in);
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", sinCache ? "no-store" : "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        r.setResponseHeaders(h);
        return r;
    }

    private static WebResourceResponse noHay() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "No está", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    private final class Cliente extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest q) {
            Uri u = q.getUrl();
            if (!HOST.equals(u.getHost())) return null;
            String p = u.getPath();
            if (p == null || p.isEmpty() || p.equals("/")) p = "/index.html";
            if (p.contains("..")) return noHay();
            if (p.startsWith("/archivos/")) {
                List<String> s = u.getPathSegments();
                File f = s.size() == 3 ? almacen.archivo(s.get(1), s.get(2)) : null;
                if (f == null || !f.isFile()) return noHay();
                try { return respuesta(tipo(f.getName()), new FileInputStream(f), true); } catch (IOException e) { return noHay(); }
            }
            try { return respuesta(tipo(p), getAssets().open("www" + p), false); } catch (IOException e) { return noHay(); }
        }

        // los enlaces de afuera se abren en el navegador
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest q) {
            Uri u = q.getUrl();
            if (HOST.equals(u.getHost())) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException e) { /* nada */ }
            return true;
        }

        // si al motor de la página se le acaba la memoria, la app vuelve a empezar en vez de cerrarse
        @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
            Log.w(TAG, "la página se cayó; vuelve a empezar");
            recreate();
            return true;
        }
    }

    // ---- elegir una foto (la página usa <input type=file>) ----
    private final class Cromo extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (pendiente != null) pendiente.onReceiveValue(null);
            pendiente = cb;
            if ((p.isCaptureEnabled() && abrirCamara()) || abrirGaleria()) return true;
            pendiente = null;
            cb.onReceiveValue(null);
            return true;
        }
    }

    private boolean abrirCamara() {
        new File(Fotos.carpeta(this), "camara.jpg").delete();
        Uri u = Fotos.uri("camara.jpg");
        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        i.putExtra(MediaStore.EXTRA_OUTPUT, u);
        i.setClipData(ClipData.newRawUri("", u));
        i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try { startActivityForResult(i, PEDIR_CAMARA); return true; } catch (ActivityNotFoundException | SecurityException e) { return false; }
    }

    private boolean abrirGaleria() {
        // el selector de fotos de Android (sin pedir permisos); si no está, el de archivos
        boolean selector = Build.VERSION.SDK_INT >= 33 || (Build.VERSION.SDK_INT >= 30 && SdkExtensions.getExtensionVersion(Build.VERSION_CODES.R) >= 2);
        if (selector) {
            Intent i = new Intent(MediaStore.ACTION_PICK_IMAGES);
            i.setType("image/*");
            try { startActivityForResult(i, PEDIR_FOTO); return true; } catch (ActivityNotFoundException e) { /* el otro */ }
        }
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("image/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        try { startActivityForResult(i, PEDIR_FOTO); return true; } catch (ActivityNotFoundException e) { return false; }
    }

    private void limpiarFotos() {
        File[] fs = Fotos.carpeta(this).listFiles();
        if (fs != null) for (File f : fs) f.delete();
    }

    @Override protected void onActivityResult(int pedido, int resultado, Intent datos) {
        if (pedido == PEDIR_WA) {
            String r;
            if (resultado == RESULT_OK) r = "ok";
            else {
                String error = datos != null ? datos.getStringExtra("validation_error") : null;
                r = error != null ? "error: " + error : "cancelado";
                if (error != null) Log.w(TAG, "WhatsApp no aceptó el pack: " + error);
            }
            if (respWa != null) responder(respWa, r);
            respWa = null;
            return;
        }
        if (pedido != PEDIR_FOTO && pedido != PEDIR_CAMARA) { super.onActivityResult(pedido, resultado, datos); return; }
        final ValueCallback<Uri[]> cb = pendiente;
        pendiente = null;
        if (cb == null) return;
        Uri origen = null;
        if (resultado == RESULT_OK) origen = pedido == PEDIR_CAMARA ? Fotos.uri("camara.jpg") : datos != null ? datos.getData() : null;
        if (origen == null) { cb.onReceiveValue(null); return; }
        final Uri o = origen;
        final String base = "foto_" + (++nFoto);
        new Thread(new Runnable() {
            @Override public void run() {
                Uri listo = null;
                try { listo = Fotos.uri(Imagen.preparar(getContentResolver(), o, Fotos.carpeta(Inicio.this), base)); }
                catch (Exception | OutOfMemoryError e) { Log.w(TAG, "no se pudo preparar la foto", e); }
                final Uri[] r = listo != null ? new Uri[] { listo } : null;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        cb.onReceiveValue(r);
                        if (r == null) js("window.__sz && window.__sz.aviso('No pude abrir esa imagen')");
                    }
                });
            }
        }, "foto").start();
    }

    // ---- WhatsApp y compartir (los pide el puente, en el hilo de la pantalla) ----
    void agregarAWhatsApp(String id, String nombre, String resp) {
        List<String> ps = WhatsApp.instalados(getPackageManager());
        if (ps.isEmpty() || !Almacen.idValido(id)) { responder(resp, ps.isEmpty() ? "sin_whatsapp" : "error: pack inválido"); return; }
        Intent i = WhatsApp.agregar(id, nombre);
        try {
            respWa = resp;
            if (ps.size() == 1) { i.setPackage(ps.get(0)); startActivityForResult(i, PEDIR_WA); }
            else startActivityForResult(Intent.createChooser(i, "Agregar a…"), PEDIR_WA);
        } catch (ActivityNotFoundException e) {
            respWa = null;
            responder(resp, "sin_whatsapp");
        }
    }

    void compartir(String texto) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, texto);
        try { startActivity(Intent.createChooser(i, "Compartir")); } catch (ActivityNotFoundException e) { /* nada */ }
    }

    String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    private void responder(String id, String r) {
        js("window.__szResponder && window.__szResponder(" + JSONObject.quote(id) + "," + JSONObject.quote(r) + ")");
    }

    private void js(String codigo) { if (web != null) web.evaluateJavascript(codigo, null); }

    // ---- atrás: primero la página (cierra la hoja, vuelve de pantalla); en el inicio, sale ----
    @Override public void onBackPressed() {
        web.evaluateJavascript("window.__szAtras ? window.__szAtras() : false", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) Inicio.super.onBackPressed(); }
        });
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
