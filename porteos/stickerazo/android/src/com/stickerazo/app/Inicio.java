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

import android.os.Handler;
import android.os.Looper;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.PublicKey;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
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
    private boolean varias;
    private String respWa;
    private int nFoto;
    /** un enlace stickerazo://pack/ID que abrió la app y la página todavía no tomó */
    private String enlace;
    private boolean paginaLista;
    // ---- las actualizaciones solas (OtaNucleo): de dónde se bajan, la llave y lo que trae el APK ----
    private static final String[] FUENTES_OTA = {
        "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/porteos/stickerazo/web/",
        "https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/porteos/stickerazo/web/",
    };
    private File otaRaiz, otaEnUso;
    private PublicKey otaPub;
    private Map<String, String> otaBase = new HashMap<String, String>();
    private long otaVApk;
    private final Handler reloj = new Handler(Looper.getMainLooper());
    private volatile boolean buscandoOta;

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
        escucharAtras();
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
        enlace = rutaDe(getIntent());
        prepararOta();
        web.loadUrl(ORIGEN + "/index.html");
        reloj.postDelayed(new Runnable() { @Override public void run() { buscarOta(); } }, 4000);
    }

    // ---- las actualizaciones solas ----
    private byte[] leerAsset(String n) throws IOException {
        InputStream in = getAssets().open(n);
        try { ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] t = new byte[16384]; for (int k; (k = in.read(t)) > 0; ) b.write(t, 0, k); return b.toByteArray(); } finally { in.close(); }
    }
    private void prepararOta() {
        otaRaiz = new File(getFilesDir(), "ota"); otaRaiz.mkdirs();
        try {
            otaPub = OtaNucleo.llavePublica(new String(leerAsset("ota_pub.txt"), "UTF-8").trim());
            byte[] b = leerAsset("ota_base.json"); otaBase = OtaNucleo.base(b); otaVApk = OtaNucleo.versionBase(b);
        } catch (Exception e) { otaPub = null; return; }
        OtaNucleo.limpiar(otaRaiz);
        File a = OtaNucleo.actual(otaRaiz);
        // (si el APK es más nuevo que la última actualización bajada, ésa ya no sirve)
        if (a != null && OtaNucleo.versionDe(a, otaPub) <= otaVApk) { OtaNucleo.borrar(otaRaiz); otaRaiz.mkdirs(); a = null; }
        otaEnUso = a;
    }
    long versionWeb() { return otaEnUso != null ? OtaNucleo.versionDe(otaEnUso, otaPub) : otaVApk; }
    private long codigoApk() {
        try { android.content.pm.PackageInfo i = getPackageManager().getPackageInfo(getPackageName(), 0); return Build.VERSION.SDK_INT >= 28 ? i.getLongVersionCode() : i.versionCode; } catch (Exception e) { return 0; }
    }
    private static byte[] bajarDe(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000); c.setReadTimeout(30000); c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) return null;
            InputStream in = c.getInputStream();
            try { ByteArrayOutputStream b = new ByteArrayOutputStream(); byte[] t = new byte[16384]; for (int k; (k = in.read(t)) > 0; ) { b.write(t, 0, k); if (b.size() > OtaNucleo.MAX_ARCHIVO) return null; } return b.toByteArray(); } finally { in.close(); }
        } catch (IOException e) { return null; }
    }
    private static byte[] bajarOta(String ruta) { for (String f : FUENTES_OTA) { byte[] d = bajarDe(f + ruta); if (d != null) return d; } return null; }
    /** busca una versión nueva (al abrir y cada 6 horas; si falló la bajada, de nuevo a los 10 minutos) */
    private void buscarOta() {
        if (otaPub == null || buscandoOta) return;
        buscandoOta = true;
        new Thread(new Runnable() {
            @Override public void run() {
                int r = -2;
                try {
                    byte[] ota = bajarOta("ota.json?t=" + System.currentTimeMillis());
                    if (ota != null) r = OtaNucleo.aplicar(otaRaiz, ota, otaPub, otaBase, otaVApk, codigoApk(), new OtaNucleo.Bajador() {
                        @Override public byte[] bajar(String ruta) { return bajarOta(ruta); }
                    });
                    if (r >= 0) { final long v = OtaNucleo.version(OtaNucleo.leer(ota, otaPub)); Log.i(TAG, "versión nueva lista: " + v + " (" + r + " archivos)"); runOnUiThread(new Runnable() { @Override public void run() { js("window.__szOta && window.__szOta(" + v + ")"); } }); }
                } catch (Exception e) { Log.w(TAG, "actualización", e); }
                buscandoOta = false;
                final long espera = r == -2 ? 10 * 60000L : 6 * 3600000L;
                reloj.postDelayed(new Runnable() { @Override public void run() { if (!isFinishing()) buscarOta(); } }, espera);
            }
        }, "ota").start();
    }
    /** la página pidió usar la versión nueva ya */
    void reiniciarPagina() {
        File a = OtaNucleo.actual(otaRaiz);
        if (a != null && OtaNucleo.versionDe(a, otaPub) > otaVApk) otaEnUso = a;
        paginaLista = false; web.reload();
    }

    // ---- los enlaces stickerazo://pack/ID ----
    private static String rutaDe(Intent i) {
        Uri u = i != null ? i.getData() : null;
        if (u == null || !"stickerazo".equals(u.getScheme()) || u.getHost() == null) return null;
        String r = u.getHost() + (u.getPath() == null ? "" : u.getPath());
        return r.matches("pack/[a-z0-9]{10}") ? r : null;
    }
    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        String r = rutaDe(i);
        if (r == null) return;
        if (paginaLista) js("window.__szAbrir && window.__szAbrir(" + JSONObject.quote(r) + ")");
        else enlace = r;
    }
    /** la página lo pide al arrancar (una sola vez) */
    String tomarEnlace() { String r = enlace; enlace = null; return r; }

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
            // (la versión nueva de la página, si se bajó una; si no, la del APK)
            File ota = otaEnUso != null ? OtaNucleo.archivo(otaEnUso, p.substring(1)) : null;
            if (ota != null) { try { return respuesta(tipo(p), new FileInputStream(ota), false); } catch (IOException e) { /* la del APK */ } }
            if (p.startsWith("/archivos/")) {
                List<String> s = u.getPathSegments();
                File f = s.size() == 3 ? almacen.archivo(s.get(1), s.get(2)) : null;
                if (f == null || !f.isFile()) return noHay();
                try { return respuesta(tipo(f.getName()), new FileInputStream(f), true); } catch (IOException e) { return noHay(); }
            }
            try { return respuesta(tipo(p), getAssets().open("www" + p), false); } catch (IOException e) { return noHay(); }
        }

        @Override public void onPageFinished(WebView v, String url) { paginaLista = true; }

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
            varias = p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE;
            if ((!varias && p.isCaptureEnabled() && abrirCamara()) || abrirGaleria()) return true;
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
            if (varias) i.putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, Math.min(30, MediaStore.getPickImagesMaxLimit()));
            try { startActivityForResult(i, PEDIR_FOTO); return true; } catch (ActivityNotFoundException e) { /* el otro */ }
        }
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("image/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        if (varias) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
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
        final List<Uri> origenes = new ArrayList<Uri>();
        if (resultado == RESULT_OK) {
            if (pedido == PEDIR_CAMARA) origenes.add(Fotos.uri("camara.jpg"));
            else if (datos != null && datos.getClipData() != null) for (int k = 0; k < datos.getClipData().getItemCount() && origenes.size() < 30; k++) origenes.add(datos.getClipData().getItemAt(k).getUri());
            else if (datos != null && datos.getData() != null) origenes.add(datos.getData());
        }
        if (origenes.isEmpty()) { cb.onReceiveValue(null); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                final List<Uri> listas = new ArrayList<Uri>();
                for (Uri o : origenes) {
                    try { listas.add(Fotos.uri(Imagen.preparar(getContentResolver(), o, Fotos.carpeta(Inicio.this), "foto_" + (++nFoto)))); }
                    catch (Exception | OutOfMemoryError e) { Log.w(TAG, "no se pudo preparar la foto", e); }
                }
                final Uri[] r = listas.isEmpty() ? null : listas.toArray(new Uri[0]);
                final int mal = origenes.size() - listas.size();
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        cb.onReceiveValue(r);
                        if (mal > 0) js("window.__sz && window.__sz.aviso(" + JSONObject.quote(mal == 1 ? "No pude abrir una imagen" : "No pude abrir " + mal + " imágenes") + ")");
                    }
                });
            }
        }, "fotos").start();
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
    //  (Android 13+: el gesto de atrás llega por OnBackInvokedCallback —en Android 16, con targetSdk 36, onBackPressed ya
    //  no se llama—; antes, por onBackPressed. Si la página no lo usa, la app pasa al fondo, como hace Android 12+)
    @Override public void onBackPressed() { atras(); }

    private void atras() {
        if (web == null) { salir(); return; }
        web.evaluateJavascript("window.__szAtras ? window.__szAtras() : false", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"true".equals(v)) salir(); }
        });
    }

    private void salir() {
        if (Build.VERSION.SDK_INT >= 33) moveTaskToBack(true); else super.onBackPressed();
    }

    private void escucharAtras() {
        if (Build.VERSION.SDK_INT < 33) return;
        getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
            new android.window.OnBackInvokedCallback() { @Override public void onBackInvoked() { atras(); } });
    }

    @Override protected void onPause() { super.onPause(); if (web != null) web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }

    @Override protected void onDestroy() {
        reloj.removeCallbacksAndMessages(null);
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
