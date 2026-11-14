package com.jxmod.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.ConsoleMessage;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * JXMod: el juego HTML (el mismo de siempre, con el nombre y el logo nuevos) en una WebView propia, servido desde los
 * archivos de la app (assets/www) con un origen https propio: anda sin servidor, en pantalla completa y horizontal.
 * Lo que no está en la app (personajes, mapas grandes, contenido de GMod) lo sigue bajando el juego de internet.
 * Si Android cierra el proceso que dibuja (falta de memoria), la app no se cierra: rearma la vista y vuelve a abrir el
 * juego, que al ver el cierre arranca más liviano.
 */
public class Web extends Activity {
    /** Los íconos que se pueden elegir (AndroidManifest: activity-alias .Icono<Nombre>). */
    static final String[] ICONOS = { "clasico", "noche", "dorado", "neon", "rojo", "blanco", "azul", "vhs" };
    static String iconoAlias(String id) { return "com.jxmod.app.Icono" + Character.toUpperCase(id.charAt(0)) + id.substring(1); }
    static final String HOST = "appassets.androidplatform.net";
    static final String INICIO = "https://" + HOST + "/index.html";
    static final int PEDIR_ARCHIVO = 11, PEDIR_MIC = 12, GUARDAR = 13, PEDIR_CARPETA = 14;

    private FrameLayout raiz;
    private WebView web;
    private ValueCallback<Uri[]> elegirCb;
    private PermissionRequest permPend;
    private byte[] guardarDatos;
    private String guardarNombre;
    private int caidas;
    private long atrasT;
    private int atrasN;
    private final Handler h = new Handler(Looper.getMainLooper());
    // (el vigilante: el juego manda un latido por segundo; si deja de llegar 45 s con la app adelante (más que cualquier carga larga), el juego quedó
    // congelado: se guarda lo que vio el sistema y la consola y se rearma la vista. Tres cuelgues en 5 minutos: modo seguro,
    // sin cargar los mods)
    private volatile long latidoT, latidoUlt;
    private long adelanteT;
    private boolean adelante, webRearmada;
    // cómo terminó la vez anterior (para la caja negra del juego: cajanegra.js, CN_NATIVO): se lee al crear la actividad,
    // de lo que quedó guardado en onResume/onPause. «adelante»: el proceso se murió con la app a la
    // vista (un cierre de verdad); «atras:…»: la app ya estaba en segundo plano —con el juego andando, cargando o sin
    // latido— cuando el sistema (o la persona, desde Recientes) la cerró
    private static String cierreAnt = null;
    private static final String VIDA = "jx_vida";
    private int colgadas;
    // (la partida en la red local: Lan.java)
    private Lan.Broker lanBroker;
    private Lan.Anuncio lanAnuncio;
    private Lan.Escucha lanEscucha;
    private Lan.Puente lanPuente;
    private android.net.wifi.WifiManager.MulticastLock lanCandado;
    private long colgadaT;
    private final String[] consola = new String[200];
    private int consolaN;
    private final Runnable vigilar = new Runnable() {
        @Override public void run() {
            long t = SystemClock.uptimeMillis();
            if (adelante && web != null && latidoT > 0 && t - latidoT > 45000) recuperar("colgado (sin latido " + (t - latidoT) / 1000 + " s)");
            h.postDelayed(this, 3000);
        }
    };

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        // (todavía no pasó por onResume: lo guardado es cómo terminó la vez anterior)
        synchronized (Web.class) {
            try {
                android.content.SharedPreferences sp = getSharedPreferences(VIDA, MODE_PRIVATE);
                cierreAnt = !sp.contains("adelante") ? "" : sp.getBoolean("adelante", false) ? "adelante" : "atras:" + sp.getString("pausa", "ok");
            } catch (Throwable e) { cierreAnt = ""; }
        }
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        frecuenciaPoner(1000);   // (de entrada la más alta; el juego después pide la de su calidad)
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        raiz = new FrameLayout(this);
        raiz.setBackgroundColor(0xFF000000);
        if (Build.VERSION.SDK_INT >= 28) {
            // (los botones del juego no quedan debajo del recorte de la cámara)
            raiz.setOnApplyWindowInsetsListener((v, ins) -> {
                DisplayCutout dc = ins.getDisplayCutout();
                if (dc != null) v.setPadding(dc.getSafeInsetLeft(), dc.getSafeInsetTop(), dc.getSafeInsetRight(), dc.getSafeInsetBottom());
                else v.setPadding(0, 0, 0, 0);
                return ins;
            });
        }
        setContentView(raiz);
        pantallaCompleta();
        crearWeb(INICIO);
    }

    private void pantallaCompleta() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) pantallaCompleta(); }

    private String version() {
        try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1"; }
    }

    // ---- actualizaciones: un botón "Descargar" cuando hay una versión nueva ----
    // El APK no se actualiza solo (no está en Play): la app pregunta por una versión nueva en version.json (en el repo) y, si
    // la hay, ofrece bajar el APK nuevo desde el navegador. La URL del APK es FIJA acá (no se toma del json): aunque alguien
    // cambie el json, la app sólo abre el APK oficial. Subir VERSION_PROPIA y el "codigo" de version.json en cada release.
    private static final int VERSION_PROPIA = 3200;
    private static final String URL_VERSION = "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/version.json";
    private static final String URL_APK = "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/jxmod/JXMod.apk";

    private void buscarActualizacion(final boolean avisarSiNoHay) {
        new Thread(() -> {
            int nueva = 0; String ver = "", notas = "";
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(URL_VERSION).openConnection();
                c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent", "JXMod/" + version() + " (Android)");
                if (c.getResponseCode() == 200) {
                    java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream();
                    InputStream in = c.getInputStream(); byte[] bf = new byte[8192]; int n, tot = 0;
                    while ((n = in.read(bf)) > 0 && tot < 65536) { bo.write(bf, 0, n); tot += n; }
                    org.json.JSONObject j = new org.json.JSONObject(new String(bo.toByteArray(), java.nio.charset.StandardCharsets.UTF_8));
                    nueva = j.optInt("codigo", 0);
                    ver = j.optString("version", "");
                    String L = java.util.Locale.getDefault().getLanguage();
                    notas = j.optString("notas_" + L, j.optString("notas_es", ""));
                }
            } catch (Exception e) { /* sin internet o json raro: no molestar */ }
            finally { if (c != null) try { c.disconnect(); } catch (Exception x) { /* nada */ } }
            final boolean hay = nueva > VERSION_PROPIA; final String fv = ver, fn = notas;
            runOnUiThread(() -> {
                if (isFinishing()) return;
                if (hay) dialogoActualizar(fv, fn);
                else if (avisarSiNoHay) Toast.makeText(this, "Ya tenés la última versión", Toast.LENGTH_SHORT).show();
            });
        }).start();
    }

    private void dialogoActualizar(String ver, String notas) {
        boolean en = "en".equals(java.util.Locale.getDefault().getLanguage());
        String msg = (ver != null && !ver.isEmpty() ? (en ? "Version " : "Versión ") + ver : "")
                   + (notas != null && !notas.isEmpty() ? "\n\n" + notas : "");
        new android.app.AlertDialog.Builder(this)
            .setTitle(en ? "Update available" : "Hay una actualización")
            .setMessage(msg.trim().isEmpty() ? (en ? "A new version is available." : "Hay una versión nueva.") : msg.trim())
            .setPositiveButton(en ? "Download" : "Descargar", (d, w) -> {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(URL_APK))); } catch (Exception e) { aviso("No se pudo abrir"); }
            })
            .setNegativeButton(en ? "Later" : "Después", null)
            .show();
    }

    private void crearWeb(String url) {
        // depuración remota de la WebView (chrome://inspect) sólo en una compilación depurable: en la app firmada queda
        // apagada, así nadie se mete a mirar o tocar el juego desde afuera (anti-trampa básico)
        try { WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0); } catch (Exception e) { /* nada */ }
        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);                 // (la letra grande del sistema no desarma los menús)
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setUserAgentString(s.getUserAgentString() + " JXMod/" + version());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new Cromo());
        web.addJavascriptInterface(new Puente(), "JXNativo");
        raiz.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        web.loadUrl(url);
        // (rearmada con la app en segundo plano —el proceso que dibuja se cerró mientras tanto—: arranca pausada y callada;
        // la primera, la de onCreate, no: enseguida viene onResume)
        if (webRearmada && !adelante) { web.onPause(); web.evaluateJavascript(CALLAR, null); }
        webRearmada = true;
        // a los 6 s, en silencio, mirar si hay una versión nueva (si la hay, un diálogo con "Descargar"; si no, nada)
        web.postDelayed(() -> buscarActualizacion(false), 6000);
    }

    // ---- lo que la app pide por su cuenta (/red/<sitio>/<ruta>) ----
    // El servidor de la tienda del juego (plan gratis de Cloudflare) tiene un tope de pedidos por día; al pasarlo, todo se
    // corta hasta el día siguiente. Los pedazos de los addons de Steam (cientos por addon) y la búsqueda de YouTube no
    // necesitan la tienda: la página no los puede pedir directo (el navegador no deja leer otros sitios sin su permiso),
    // pero la app sí. Sólo estos sitios y sólo GET: no es un paso abierto a cualquier lado.
    private WebResourceResponse red(Uri u, String metodo) {
        Map<String, String> cab = new HashMap<>();
        cab.put("Cache-Control", "no-store");
        if (!"GET".equalsIgnoreCase(metodo)) return new WebResourceResponse("text/plain", "utf-8", 405, "Method Not Allowed", cab, new ByteArrayInputStream(new byte[0]));
        // (Steam sin la tienda —SteamPipe.java—: la clave y el código de un addon, los detalles de varios, el contenido base y
        // los «Required items». El mismo JSON que da la tienda: si la tienda llegó a su tope del día, los mods bajan igual)
        SteamPipe.Resp r = SteamPipe.ruta(u.getPath());
        if (r != null) {
            return new WebResourceResponse("application/json", "utf-8", r.estado, r.estado == 200 ? "OK" : r.estado == 404 ? "Not Found" : r.estado == 409 ? "Conflict" : r.estado == 400 ? "Bad Request" : "Bad Gateway",
                    cab, new ByteArrayInputStream(r.cuerpo.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        String destino = Red.destino(u.getEncodedPath(), u.getEncodedQuery());
        if (destino == null) return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", cab, new ByteArrayInputStream(new byte[0]));
        boolean yt = destino.startsWith("https://www.youtube.com/");
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(destino).openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setInstanceFollowRedirects(true);
            if (yt) {
                // (como la tienda: la página de resultados de una compu, en español, sin el cartel de cookies)
                c.setRequestProperty("User-Agent", Red.UA_PC);
                c.setRequestProperty("Accept-Language", "es-419,es;q=0.9,en;q=0.8");
                c.setRequestProperty("Cookie", "CONSENT=YES+1; SOCS=CAI");
            } else c.setRequestProperty("User-Agent", "JXMod/" + version() + " (Android)");
            int st = c.getResponseCode();
            InputStream in = st >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            String ct = c.getContentType(), mime = "application/octet-stream", cs = null;
            if (ct != null) {
                String[] partes = ct.split(";");
                mime = partes[0].trim();
                for (String x : partes) { x = x.trim(); if (x.toLowerCase(Locale.ROOT).startsWith("charset=")) cs = x.substring(8).replace("\"", ""); }
            }
            String razon = c.getResponseMessage();
            if (razon == null || razon.trim().isEmpty()) razon = st < 400 ? "OK" : "Error";
            if (st < 100 || st > 599) st = 502;
            return new WebResourceResponse(mime, cs, st, razon, cab, in);
        } catch (Exception e) {
            if (c != null) try { c.disconnect(); } catch (Exception x) { /* nada */ }
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", cab, new ByteArrayInputStream(new byte[0]));
        }
    }

    // ---- los archivos del juego, servidos desde la app ----
    private WebResourceResponse servir(Uri u, String metodo) {
        if (u == null || !HOST.equals(u.getHost())) return null;
        String p = u.getPath();
        if (p != null && p.startsWith("/red/")) return red(u, metodo);
        if (p != null && p.startsWith("/carpeta/")) return carpetaServir(u, metodo);
        if (p == null || p.isEmpty() || p.equals("/")) p = "/index.html";
        Map<String, String> cab = new HashMap<>();
        cab.put("Access-Control-Allow-Origin", "*");
        cab.put("Cache-Control", "no-cache");
        if (!p.contains("..")) {
            try {
                // los activos cifrados (index.html, pk.bin) se descifran al vuelo; los demás pasan igual (Cifrado.abrir)
                InputStream in = Cifrado.abrir(getAssets().open("www" + p), Cifrado.clave(this));
                String m = tipo(p);
                return new WebResourceResponse(m, m.startsWith("text/") || m.endsWith("javascript") || m.endsWith("json") ? "utf-8" : null, 200, "OK", cab, in);
            } catch (IOException e) { /* no está en la app: 404 y el juego lo busca en internet */ }
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", cab, new ByteArrayInputStream(new byte[0]));
    }

    private static String tipo(String p) {
        String q = p.toLowerCase(Locale.ROOT);
        if (q.endsWith(".html")) return "text/html";
        if (q.endsWith(".js") || q.endsWith(".mjs")) return "application/javascript";
        if (q.endsWith(".json")) return "application/json";
        if (q.endsWith(".css")) return "text/css";
        if (q.endsWith(".webp")) return "image/webp";
        if (q.endsWith(".png")) return "image/png";
        if (q.endsWith(".jpg") || q.endsWith(".jpeg")) return "image/jpeg";
        if (q.endsWith(".svg")) return "image/svg+xml";
        if (q.endsWith(".mp3")) return "audio/mpeg";
        if (q.endsWith(".ogg")) return "audio/ogg";
        if (q.endsWith(".wav")) return "audio/wav";
        if (q.endsWith(".mp4")) return "video/mp4";
        if (q.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }

    // (el juego guarda archivos y fotos con <a download> de un blob, que la vista web no sabe bajar: se pasan a la app)
    private static final String DESCARGAS =
        "(function(){if(window.__jxDl)return;window.__jxDl=1;var c=HTMLAnchorElement.prototype.click;" +
        "HTMLAnchorElement.prototype.click=function(){var a=this;if(a.download&&a.href&&/^(blob|data):/.test(a.href)&&window.JXNativo){" +
        "fetch(a.href).then(function(r){return r.blob()}).then(function(b){var f=new FileReader();f.onload=function(){" +
        "var s=String(f.result);JXNativo.guardar(a.download,s.slice(s.indexOf(',')+1),b.type||'application/octet-stream')};" +
        "f.readAsDataURL(b)});return;}return c.apply(this,arguments)};})();";

    private class Cliente extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return servir(r.getUrl(), r.getMethod()); }
        @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            if (HOST.equals(u.getHost()) || !r.isForMainFrame()) return false;
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* sin navegador */ }
            return true;
        }
        @Override public void onPageStarted(WebView v, String url, Bitmap fav) { v.evaluateJavascript(DESCARGAS, null); }
        @Override public void onPageFinished(WebView v, String url) { v.evaluateJavascript(DESCARGAS, null); }
        @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
            if (v != web) return true;
            registrar("el proceso que dibuja se cerró: " + (d != null && d.didCrash() ? "falló (crash)" : "el sistema lo cerró (memoria)"));
            caidas++;
            raiz.removeView(v);
            v.destroy();
            web = null;
            final int espera = caidas > 3 ? 3000 : 300;
            h.postDelayed(() -> { if (web == null && !isFinishing()) crearWeb(INICIO + "?caida=" + caidas); }, espera);
            return true;
        }
    }

    private boolean tieneMic() {
        return Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    private class Cromo extends WebChromeClient {
        @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (elegirCb != null) elegirCb.onReceiveValue(null);
            elegirCb = cb;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            if (p != null && p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try { startActivityForResult(Intent.createChooser(i, null), PEDIR_ARCHIVO); }
            catch (Exception e) { elegirCb = null; cb.onReceiveValue(null); return false; }
            return true;
        }
        @Override public void onPermissionRequest(final PermissionRequest r) {
            runOnUiThread(() -> {
                boolean mic = false;
                for (String x : r.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(x)) mic = true;
                if (!mic) { r.deny(); return; }
                if (tieneMic()) r.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                else {
                    if (permPend != null) permPend.deny();
                    permPend = r;
                    if (Build.VERSION.SDK_INT >= 23) requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PEDIR_MIC);
                }
            });
        }
        // (sin el ícono gris de "play" que la vista web pone en los videos)
        // (lo que el juego escribe en la consola, para el registro aunque el juego se congele)
        @Override public boolean onConsoleMessage(ConsoleMessage m) {
            try {
                String x = m.messageLevel() + " " + m.message() + " @" + m.sourceId().replaceAll(".*/", "") + ":" + m.lineNumber();
                synchronized (consola) { consola[consolaN++ % consola.length] = x.length() > 400 ? x.substring(0, 400) : x; }
            } catch (Exception e) { /* nada */ }
            return false;
        }
        @Override public Bitmap getDefaultVideoPoster() { return Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888); }
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (req == PEDIR_MIC && permPend != null) {
            if (ok) permPend.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE}); else permPend.deny();
            permPend = null;
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == PEDIR_ARCHIVO) {
            if (elegirCb == null) return;
            Uri[] r = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount(); r = new Uri[n];
                    for (int i = 0; i < n; i++) r[i] = data.getClipData().getItemAt(i).getUri();
                } else if (data.getData() != null) r = new Uri[]{data.getData()};
            }
            elegirCb.onReceiveValue(r);
            elegirCb = null;
        } else if (req == PEDIR_CARPETA) {
            carpetaElegida(res == RESULT_OK && data != null ? data.getData() : null);
        } else if (req == GUARDAR) {
            boolean ok = res == RESULT_OK && data != null && data.getData() != null && guardarDatos != null && escribir(data.getData(), guardarDatos);
            aviso(ok ? "Guardado: " + guardarNombre : "No se pudo guardar");
            guardarDatos = null;
        }
    }

    private boolean escribir(Uri u, byte[] b) {
        try (OutputStream o = getContentResolver().openOutputStream(u)) { if (o == null) return false; o.write(b); return true; }
        catch (Exception e) { return false; }
    }

    private void aviso(String t) { Toast.makeText(this, t, Toast.LENGTH_SHORT).show(); }

    /** Guarda un archivo del juego (mapa, mod, foto) en Descargas/JXMod o Imágenes/JXMod. */
    private void guardar(String nombre, byte[] b, String mime) {
        String n = nombre == null || nombre.isEmpty() ? "jxmod" : nombre.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (mime == null || mime.isEmpty()) mime = "application/octet-stream";
        if (Build.VERSION.SDK_INT >= 29) {
            boolean img = mime.startsWith("image/");
            String dir = (img ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/JXMod";
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, n);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, dir);
            Uri u = null;
            try { u = getContentResolver().insert(img ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv); }
            catch (Exception e) { u = null; }
            aviso(u != null && escribir(u, b) ? "Guardado en " + dir + "/" + n : "No se pudo guardar");
        } else {
            guardarDatos = b; guardarNombre = n;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(mime);
            i.putExtra(Intent.EXTRA_TITLE, n);
            try { startActivityForResult(i, GUARDAR); } catch (Exception e) { guardarDatos = null; aviso("No se pudo guardar"); }
        }
    }

    /** Muchos celus dejan las apps en 60 Hz aunque la pantalla dé 90, 120 o 144: se pide el modo de la misma resolución con la
     *  frecuencia más alta (hz ≥ 90) o el más cercano a hz (60). */
    private void frecuenciaPoner(int hz) {
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            android.view.Display d = getWindowManager().getDefaultDisplay(); if (d == null) return;
            android.view.Display.Mode act = d.getMode(), mejor = null;
            for (android.view.Display.Mode m : d.getSupportedModes()) {
                if (m.getPhysicalWidth() != act.getPhysicalWidth() || m.getPhysicalHeight() != act.getPhysicalHeight()) continue;
                if (mejor == null) { mejor = m; continue; }
                float r = m.getRefreshRate(), rb = mejor.getRefreshRate();
                if (hz >= 90 ? r > rb : Math.abs(r - hz) < Math.abs(rb - hz)) mejor = m;
            }
            if (mejor == null) return;
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            if (lp.preferredDisplayModeId == mejor.getModeId()) return;
            lp.preferredDisplayModeId = mejor.getModeId();
            lp.preferredRefreshRate = mejor.getRefreshRate();
            getWindow().setAttributes(lp);
        } catch (Throwable e) { }
    }

    /** Lo que la página puede pedirle a la app. */
    private class Puente {
        @JavascriptInterface public void guardar(final String nombre, String b64, final String mime) {
            final byte[] b;
            try { b = Base64.decode(b64, Base64.DEFAULT); } catch (Exception e) { return; }
            runOnUiThread(() -> Web.this.guardar(nombre, b, mime));
        }
        /** La frecuencia de pantalla para la calidad elegida: 90 o más, la más alta que tenga el celu; si no, la más cercana a 60
         *  (Alto y Ultra van a 60 parejos y así gastan menos batería). */
        @JavascriptInterface public void frecuencia(final int hz) { runOnUiThread(() -> frecuenciaPoner(hz)); }
        @JavascriptInterface public void salir() { runOnUiThread(Web.this::finishAndRemoveTask); }
        @JavascriptInterface public void latido() { latidoT = latidoUlt = SystemClock.uptimeMillis(); }
        /** Cómo terminó la vez anterior ("adelante", "atras:ok", "atras:cargando", "atras:sin latido N s" o ""): se da una
         *  sola vez por proceso (si el juego se recarga solo, la segunda vez es ""). */
        @JavascriptInterface public String cierreAnterior() { synchronized (Web.class) { String r = cierreAnt == null ? "" : cierreAnt; cierreAnt = ""; return r; } }
        /** La app sabe pedir por su cuenta /red/… (la búsqueda de YouTube y los pedazos de Steam sin la tienda); 2: también
         *  /red/_steam… (la clave, los detalles, el contenido base y lo requerido de los addons, sin la tienda). */
        @JavascriptInterface public int red() { return 2; }
        /** Lo que guardó la app del último cuelgue o cierre (el log del sistema y la consola), para el registro del juego. */
        @JavascriptInterface public String registroNativo() { return leerRegistro(); }
        @JavascriptInterface public void registroVisto() { /* (queda guardado hasta el próximo: se puede volver a ver en Ajustes) */ }
        /** Un acceso directo en la pantalla de inicio con tu logo (el juego lo arma: PNG de 192×192) y el nombre que elegiste.
         *  Android 8 o más nuevo pregunta dónde ponerlo; Android 7 lo pone el lanzador. "ok", "no" (el lanzador no deja) o "mal". */
        @JavascriptInterface public String accesoDirecto(final String nombre, String b64) {
            try {
                final byte[] b = Base64.decode(b64, Base64.DEFAULT);
                if (b.length > 4_000_000) return "mal";
                final Bitmap bm = android.graphics.BitmapFactory.decodeByteArray(b, 0, b.length);
                if (bm == null || bm.getWidth() > 1024 || bm.getHeight() > 1024) return "mal";
                String n = nombre == null ? "" : nombre.replaceAll("[\\p{Cntrl}]", "").trim();
                if (n.isEmpty()) n = "JXMod"; if (n.length() > 24) n = n.substring(0, 24);
                Intent abre = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (abre == null) return "mal";
                abre.setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (Build.VERSION.SDK_INT >= 26) {
                    android.content.pm.ShortcutManager sm = getSystemService(android.content.pm.ShortcutManager.class);
                    if (sm == null || !sm.isRequestPinShortcutSupported()) return "no";
                    android.content.pm.ShortcutInfo si = new android.content.pm.ShortcutInfo.Builder(Web.this, "logo" + System.currentTimeMillis())
                        .setShortLabel(n).setIcon(android.graphics.drawable.Icon.createWithBitmap(bm)).setIntent(abre).build();
                    return sm.requestPinShortcut(si, null) ? "ok" : "no";
                }
                Intent i = new Intent("com.android.launcher.action.INSTALL_SHORTCUT");
                i.putExtra(Intent.EXTRA_SHORTCUT_INTENT, abre).putExtra(Intent.EXTRA_SHORTCUT_NAME, n).putExtra(Intent.EXTRA_SHORTCUT_ICON, bm).putExtra("duplicate", false);
                sendBroadcast(i);
                return "ok";
            } catch (Throwable e) { return "mal"; }
        }
        /** El ícono de la app (como en Discord): prende la entrada del lanzador con ese ícono y apaga las otras (primero
         *  prende la nueva, así nunca queda la app sin ícono). El lanzador lo cambia en unos segundos. "ok" o "mal". */
        @JavascriptInterface public String iconoApp(final String id) {
            if (id == null || java.util.Arrays.asList(ICONOS).indexOf(id) < 0) return "mal";
            try {
                PackageManager pm = getPackageManager();
                pm.setComponentEnabledSetting(new android.content.ComponentName(getPackageName(), iconoAlias(id)), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
                for (String i : ICONOS) if (!i.equals(id))
                    pm.setComponentEnabledSetting(new android.content.ComponentName(getPackageName(), iconoAlias(i)), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                return "ok";
            } catch (Throwable e) { return "mal"; }
        }
        /** El ícono que tiene ahora ("clasico" si nunca se cambió). */
        @JavascriptInterface public String iconoActual() {
            try {
                PackageManager pm = getPackageManager();
                for (String i : ICONOS) if (pm.getComponentEnabledSetting(new android.content.ComponentName(getPackageName(), iconoAlias(i))) == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return i;
            } catch (Throwable e) { }
            return "clasico";
        }
        @JavascriptInterface public String version() { return Web.this.version(); }
        /** Buscar una versión nueva del APK: si la hay, un diálogo con "Descargar"; si no, un aviso. Lo llama el menú del juego. */
        @JavascriptInterface public void buscarActualizacion() { Web.this.buscarActualizacion(true); }
        /** La versión propia (número) para que el juego sepa si mostrar su botón "Actualizar". */
        @JavascriptInterface public int versionCodigo() { return VERSION_PROPIA; }
        /** Abre un enlace (redes de JXStudios) en su app o en el navegador. */
        @JavascriptInterface public void abrir(final String url) {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) return;
            runOnUiThread(() -> { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { aviso("No se pudo abrir"); } });
        }
        /** Memoria que usa la app (PSS en MB, con la de gráficos; el JS de la página va aparte) para la comparación de FPS. */
        @JavascriptInterface public int memoriaMB() {
            try { android.os.Debug.MemoryInfo mi = new android.os.Debug.MemoryInfo(); android.os.Debug.getMemoryInfo(mi); return mi.getTotalPss() / 1024; } catch (Throwable e) { return 0; }
        }
        /** Lo que quedó guardado por el motor nativo con V8 de la 2.8 (ya no está en la app): el juego lo trae una vez. */
        @JavascriptInterface public String almacenPendiente() {
            java.io.File f = new java.io.File(getFilesDir(), "almacen.json"), p = new java.io.File(getFilesDir(), "almacen.pendiente");
            if (!p.exists() || !f.exists()) return "";
            try (java.io.InputStream in = new java.io.FileInputStream(f)) { java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); byte[] b = new byte[65536]; for (int n; (n = in.read(b)) > 0; ) o.write(b, 0, n); p.delete(); return new String(o.toByteArray(), java.nio.charset.StandardCharsets.UTF_8); } catch (Exception e) { return ""; }
        }
        // ---- la partida en la red local (LAN / Wifi, sin internet): Lan.java ----
        /** 1: la app sabe ser anfitrión (broker + juego por HTTP + anuncio), buscar partidas y hacer de puente. */
        @JavascriptInterface public int lan() { return 1; }
        /** Ser anfitrión: {"ok":true,"puerto":8765,"ips":[…]} o {"ok":false,"error":"…"}. */
        @JavascriptInterface public String lanHostear(String nombre, String sala, String mapa, String du) { return Web.this.lanHostear(nombre, sala, mapa, du); }
        @JavascriptInterface public void lanParar() { Web.this.lanParar(); }
        /** Buscar partidas en la red (escuchar los anuncios): "ok" o "mal". */
        @JavascriptInterface public String lanBuscar(boolean si) { return Web.this.lanBuscar(si); }
        /** Las partidas que se oyeron en los últimos 5 s: [{"ip","edad","d"}] (el juego valida "d"). */
        @JavascriptInterface public String lanHosts() { Lan.Escucha e = lanEscucha; return e == null ? "[]" : e.lista(); }
        /** El puente de 127.0.0.1 hacia el anfitrión (la página es https: no puede abrir un ws:// a otra IP). El puerto, o 0. */
        @JavascriptInterface public int lanPuente() { return Web.this.lanPuenteIniciar(); }
        /** Mis IPs en la red local (para mostrar http://IP:8765 a los que entran sin la app). */
        @JavascriptInterface public String lanIps() { return ipsJson(); }
        /** RAM total del aparato en MB (para elegir la calidad). */
        // ---- la carpeta de mods (addons de GMod desarmados, como garrysmod/addons de la compu): ver carpetaServir ----
        /** 1: la app sabe leer la carpeta de mods (/carpeta/lista y /carpeta/paquete). */
        @JavascriptInterface public int carpeta() { return 1; }
        /** Abre el selector de carpetas del sistema; lo elegido llega al juego por window.__jxCarpeta(json). */
        @JavascriptInterface public void carpetaElegir() { runOnUiThread(Web.this::carpetaSelector); }
        /** {"arbol":"primary:JXMOD","nombre":"JXMOD","permiso":true,"app":"Android/data/…/files/addons","sdk":34} */
        @JavascriptInterface public String carpetaEstado() { return Web.this.carpetaEstadoJson(); }
        /** Deja de usar la carpeta elegida (suelta el permiso); lo que hay en ella queda como estaba. */
        @JavascriptInterface public void carpetaOlvidar() { Web.this.carpetaSoltar(); }
        /** Crea la carpeta «nombre» adentro de la elegida (si no está), con un LEEME: "ok", "ya" o "mal". */
        @JavascriptInterface public String carpetaCrear(String nombre, String leeme) { return Web.this.carpetaCrearDir(nombre, leeme); }
        @JavascriptInterface public int ramMB() {
            try { android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(ACTIVITY_SERVICE); android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi); return (int) (mi.totalMem >> 20); } catch (Throwable e) { return 0; }
        }
    }

    // ---- la carpeta de mods (Carpeta.java; el juego: gmod_carpeta.js) ----
    // Dos carpetas: la que el jugador elige con el selector del sistema (ACTION_OPEN_DOCUMENT_TREE: el permiso queda
    // guardado, anda de Android 7 a 15, también en la tarjeta SD, y la abre cualquier gestor de archivos) y
    // Android/data/com.jxmod.app/files/addons (sin permisos; desde Android 11 casi ningún gestor la abre). El juego pide la
    // lista de todos los archivos (/carpeta/lista) y después los de cada addon en un solo pedido (/carpeta/paquete), y
    // arma el .gma él mismo. Sólo GET y sólo lo de esas dos carpetas.
    private static final String CARPETA = "jx_carpeta";
    private volatile Carpeta.Listado carpetaUlt;
    private int carpetaGen;
    private Uri carpetaArbol() {
        String s = getSharedPreferences(CARPETA, MODE_PRIVATE).getString("arbol", null);
        return s == null || s.isEmpty() ? null : Uri.parse(s);
    }
    private boolean carpetaPermiso(Uri u) {
        if (u == null) return false;
        try { for (android.content.UriPermission p : getContentResolver().getPersistedUriPermissions()) if (p.getUri().equals(u) && p.isReadPermission()) return true; }
        catch (Exception e) { /* nada */ }
        return false;
    }
    private File carpetaApp() {
        File ext; try { ext = getExternalFilesDir(null); } catch (Exception e) { ext = null; }
        if (ext == null) return null;
        File f = new File(ext, "addons"); if (!f.isDirectory()) f.mkdirs();
        return f.isDirectory() ? f : null;
    }
    private String carpetaAppNombre() { return "Android/data/" + getPackageName() + "/files/addons"; }
    private void carpetaSelector() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        i.putExtra("android.content.extra.SHOW_ADVANCED", true);   // (en Android 7 y 8 el almacenamiento interno está escondido si no)
        if (Build.VERSION.SDK_INT >= 26) {
            // (empieza en la elegida antes o, la primera vez, en el almacenamiento interno, donde se crea JXMOD)
            Uri a = carpetaArbol(), ini;
            try { ini = a != null ? DocumentsContract.buildDocumentUriUsingTree(a, DocumentsContract.getTreeDocumentId(a)) : DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:"); }
            catch (Exception e) { ini = null; }
            if (ini != null) i.putExtra(DocumentsContract.EXTRA_INITIAL_URI, ini);
        }
        try { startActivityForResult(i, PEDIR_CARPETA); }
        catch (Exception e) { aviso("No se pudo abrir el selector de carpetas"); carpetaAvisar("{\"ok\":false}"); }
    }
    private void carpetaElegida(Uri u) {
        if (u == null) { carpetaAvisar("{\"ok\":false}"); return; }
        ContentResolver cr = getContentResolver();
        try { cr.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); }
        catch (Exception e) { try { cr.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e2) { /* sólo esta vez */ } }
        Uri ant = carpetaArbol();
        if (ant != null && !ant.equals(u)) { try { cr.releasePersistableUriPermission(ant, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { /* nada */ } }
        getSharedPreferences(CARPETA, MODE_PRIVATE).edit().putString("arbol", u.toString()).apply();
        String nom = "", id = "";
        try { id = DocumentsContract.getTreeDocumentId(u); nom = Doc.raiz(cr, u).nom; } catch (Exception e) { /* nada */ }
        carpetaAvisar("{\"ok\":true,\"nombre\":" + Carpeta.texto(nom) + ",\"arbol\":" + Carpeta.texto(id) + "}");
    }
    private void carpetaAvisar(String json) {
        if (web != null) web.evaluateJavascript("window.__jxCarpeta&&window.__jxCarpeta(" + Carpeta.texto(json) + ")", null);
    }
    private String carpetaEstadoJson() {
        Uri a = carpetaArbol(); String id = "";
        try { if (a != null) id = DocumentsContract.getTreeDocumentId(a); } catch (Exception e) { id = ""; }
        String nom = id.contains(":") ? id.substring(id.indexOf(':') + 1) : id;
        if (nom.contains("/")) nom = nom.substring(nom.lastIndexOf('/') + 1);
        return "{\"arbol\":" + Carpeta.texto(id) + ",\"nombre\":" + Carpeta.texto(nom) + ",\"permiso\":" + carpetaPermiso(a) + ",\"app\":" + Carpeta.texto(carpetaAppNombre()) + ",\"sdk\":" + Build.VERSION.SDK_INT + "}";
    }
    private void carpetaSoltar() {
        Uri a = carpetaArbol();
        if (a != null) { try { getContentResolver().releasePersistableUriPermission(a, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { try { getContentResolver().releasePersistableUriPermission(a, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e2) { /* nada */ } } }
        getSharedPreferences(CARPETA, MODE_PRIVATE).edit().remove("arbol").apply();
        carpetaUlt = null;
    }
    private String carpetaCrearDir(String nombre, String leeme) {
        Uri a = carpetaArbol(); if (a == null || nombre == null || !nombre.matches("[A-Za-z0-9 _.-]{1,40}") || nombre.startsWith(".")) return "mal";
        ContentResolver cr = getContentResolver();
        try {
            Doc r = Doc.raiz(cr, a);
            for (Carpeta.Nodo n : r.hijos()) if (n.dir() && n.nombre().equalsIgnoreCase(nombre)) return "ya";
            Uri d = DocumentsContract.createDocument(cr, DocumentsContract.buildDocumentUriUsingTree(a, r.id), DocumentsContract.Document.MIME_TYPE_DIR, nombre);
            if (d == null) return "mal";
            if (leeme != null && !leeme.isEmpty()) {
                try {
                    Uri t = DocumentsContract.createDocument(cr, d, "text/plain", "JXMod - LEEME.txt");
                    if (t != null) try (OutputStream o = cr.openOutputStream(t)) { if (o != null) o.write(leeme.getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
                } catch (Exception e) { /* sin el LEEME */ }
            }
            return "ok";
        } catch (Exception e) { return "mal"; }
    }
    private WebResourceResponse carpetaServir(Uri u, String metodo) {
        Map<String, String> cab = new HashMap<>();
        cab.put("Cache-Control", "no-store");
        String p = u.getPath();
        if (!"GET".equalsIgnoreCase(metodo)) return new WebResourceResponse("text/plain", "utf-8", 405, "Method Not Allowed", cab, new ByteArrayInputStream(new byte[0]));
        if ("/carpeta/lista".equals(p)) {
            List<Carpeta.Raiz> R = new ArrayList<>();
            File app = carpetaApp();
            Carpeta.Raiz ra = new Carpeta.Raiz("a", carpetaAppNombre(), "", app == null ? null : new Carpeta.Archivo(app));
            if (app == null) ra.error = "sin almacenamiento";
            R.add(ra);
            Uri a = carpetaArbol(); Carpeta.Nodo n = null; String nom = "", id = "", err = "";
            if (a != null) {
                try { id = DocumentsContract.getTreeDocumentId(a); Doc d = Doc.raiz(getContentResolver(), a); n = d; nom = d.nom; }
                catch (Exception e) { err = carpetaPermiso(a) ? String.valueOf(e.getMessage()) : "sin permiso"; }
            }
            Carpeta.Raiz rc = new Carpeta.Raiz("c", nom, id, n); rc.sin = a == null; rc.error = err;
            R.add(rc);
            int gen; synchronized (this) { gen = ++carpetaGen; }
            Carpeta.Listado L = Carpeta.listar(gen, R);
            carpetaUlt = L;
            return new WebResourceResponse("application/json", "utf-8", 200, "OK", cab, new ByteArrayInputStream(Carpeta.json(L).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        if ("/carpeta/paquete".equals(p)) {
            Carpeta.Listado L = carpetaUlt;
            if (L == null || !String.valueOf(L.gen).equals(u.getQueryParameter("gen"))) return new WebResourceResponse("text/plain", "utf-8", 409, "Conflict", cab, new ByteArrayInputStream(new byte[0]));
            List<Carpeta.Arch> l = Carpeta.elegir(L, u.getQueryParameter("i"));
            if (l == null) return new WebResourceResponse("text/plain", "utf-8", 400, "Bad Request", cab, new ByteArrayInputStream(new byte[0]));
            cab.put("Content-Length", String.valueOf(Carpeta.largo(l)));
            return new WebResourceResponse("application/octet-stream", null, 200, "OK", cab, Carpeta.paquete(l));
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", cab, new ByteArrayInputStream(new byte[0]));
    }
    /** Un archivo o una carpeta de la carpeta elegida (DocumentsContract: el permiso es sobre todo lo que tiene adentro). */
    static final class Doc implements Carpeta.Nodo {
        static final String[] COLS = { DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED };
        final ContentResolver cr; final Uri arbol; final String id, nom, mime; final long tam, t;
        Doc(ContentResolver cr, Uri arbol, String id, String nom, String mime, long tam, long t) { this.cr = cr; this.arbol = arbol; this.id = id; this.nom = nom == null ? "" : nom; this.mime = mime; this.tam = tam; this.t = t; }
        private static Doc de(ContentResolver cr, Uri arbol, Cursor c) {
            return new Doc(cr, arbol, c.getString(0), c.getString(1), c.getString(2), c.isNull(3) ? 0 : c.getLong(3), c.isNull(4) ? 0 : c.getLong(4));
        }
        static Doc raiz(ContentResolver cr, Uri arbol) throws IOException {
            String id = DocumentsContract.getTreeDocumentId(arbol);
            Cursor c = null;
            try {
                c = cr.query(DocumentsContract.buildDocumentUriUsingTree(arbol, id), COLS, null, null, null);
                if (c == null || !c.moveToFirst()) throw new IOException("la carpeta ya no está");
                return de(cr, arbol, c);
            } catch (SecurityException e) { throw new IOException("sin permiso"); }
            finally { if (c != null) c.close(); }
        }
        public String nombre() { return nom; }
        public boolean dir() { return DocumentsContract.Document.MIME_TYPE_DIR.equals(mime); }
        public long tam() { return tam; }
        public long t() { return t; }
        public List<Carpeta.Nodo> hijos() throws IOException {
            List<Carpeta.Nodo> out = new ArrayList<>();
            Cursor c = null;
            try {
                c = cr.query(DocumentsContract.buildChildDocumentsUriUsingTree(arbol, id), COLS, null, null, null);
                if (c == null) throw new IOException("no se puede leer " + nom);
                while (c.moveToNext()) out.add(de(cr, arbol, c));
            } catch (SecurityException e) { throw new IOException("sin permiso"); }
            finally { if (c != null) c.close(); }
            return out;
        }
        public InputStream abrir() throws IOException {
            try { InputStream in = cr.openInputStream(DocumentsContract.buildDocumentUriUsingTree(arbol, id)); if (in == null) throw new IOException("no se pudo abrir " + nom); return in; }
            catch (SecurityException e) { throw new IOException("sin permiso"); }
        }
    }

    // Atrás = la tecla Escape del juego (cierra el panel abierto o pone la pausa); tres veces seguidas, sale
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() {
        long t = System.currentTimeMillis();
        atrasN = t - atrasT < 1500 ? atrasN + 1 : 1;
        atrasT = t;
        if (atrasN >= 3 || web == null) { finishAndRemoveTask(); return; }
        if (atrasN == 2) aviso("Tocá Atrás otra vez para salir");
        web.evaluateJavascript("(function(){var o={key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true};"
            + "window.dispatchEvent(new KeyboardEvent('keydown',o));window.dispatchEvent(new KeyboardEvent('keyup',o));})()", null);
    }

    // ---- la partida en la red local (Lan.java) ----
    // Los archivos del juego que sirve el anfitrión a los que entran sin la app (http://IP:8765/): los de assets/www
    private final Lan.Archivos lanArchivos = (ruta) -> {
        if (ruta == null || ruta.isEmpty() || ruta.contains("..") || ruta.startsWith("/") || ruta.contains("\\")) return null;
        String p = "www/" + ruta; long largo = -1;
        // index.html y pk.bin van cifrados en el APK: al servirlos por LAN se descifran, así que el largo del archivo ya no
        // vale (el descifrado cambia el tamaño); para el resto, el largo del asset sirve de Content-Length
        boolean cif = "www/index.html".equals(p) || "www/pk.bin".equals(p);
        if (!cif) try (android.content.res.AssetFileDescriptor fd = getAssets().openFd(p)) { largo = fd.getLength(); } catch (IOException e) { /* comprimido en el APK: sin largo */ }
        try { return new Lan.Archivo(Cifrado.abrir(getAssets().open(p), Cifrado.clave(getApplicationContext())), largo); } catch (IOException e) { return null; }
    };
    private static String ipsJson() {
        StringBuilder b = new StringBuilder("[");
        for (String ip : Lan.ips()) { if (b.length() > 1) b.append(','); b.append(Lan.jsonTexto(ip)); }
        return b.append(']').toString();
    }
    private synchronized String lanHostear(String nombre, String sala, String mapa, String du) {
        String info = "{\"n\":" + Lan.jsonTexto(corto(nombre, 16)) + ",\"s\":" + Lan.jsonTexto(corto(sala, 24)) + ",\"m\":" + Lan.jsonTexto(corto(mapa, 40))
            + ",\"du\":" + Lan.jsonTexto(corto(du, 20)) + ",\"v\":" + Lan.jsonTexto(corto(version(), 12));
        String error = "";
        if (lanBroker == null || !lanBroker.vivo()) {
            lanBroker = null;
            // (si el puerto está ocupado por otra app, el siguiente)
            for (int p : new int[] { Lan.PUERTO, Lan.PUERTO + 10, Lan.PUERTO + 20 }) {
                Lan.Broker b = new Lan.Broker(p, lanArchivos);
                try { b.iniciar(); lanBroker = b; break; } catch (IOException e) { error = String.valueOf(e.getMessage()); }
            }
            if (lanBroker == null) return "{\"ok\":false,\"error\":" + Lan.jsonTexto(error) + "}";
        }
        lanBroker.info = info + ",\"p\":" + lanBroker.puerto + "}";
        if (lanAnuncio == null) {
            Lan.Anuncio a = new Lan.Anuncio(Lan.PUERTO_ANUNCIO); a.broker = lanBroker;
            try { a.iniciar(); lanAnuncio = a; } catch (IOException e) { /* sin anuncio: igual se puede entrar escribiendo la IP */ }
        } else lanAnuncio.broker = lanBroker;
        return "{\"ok\":true,\"puerto\":" + lanBroker.puerto + ",\"ips\":" + ipsJson() + ",\"anuncio\":" + (lanAnuncio != null) + "}";
    }
    private synchronized void lanParar() {
        if (lanAnuncio != null) { lanAnuncio.parar(); lanAnuncio = null; }
        if (lanBroker != null) { lanBroker.parar(); lanBroker = null; }
    }
    private synchronized String lanBuscar(boolean si) {
        if (!si) {
            if (lanEscucha != null) { lanEscucha.parar(); lanEscucha = null; }
            if (lanCandado != null) { try { lanCandado.release(); } catch (Exception e) { /* nada */ } lanCandado = null; }
            return "ok";
        }
        // (muchos celulares tiran los broadcast del wifi para ahorrar batería si nadie tiene este candado)
        try {
            android.net.wifi.WifiManager wm = (android.net.wifi.WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wm != null && lanCandado == null) { lanCandado = wm.createMulticastLock("jxmod-lan"); lanCandado.setReferenceCounted(false); lanCandado.acquire(); }
        } catch (Exception e) { lanCandado = null; }
        if (lanEscucha == null) {
            Lan.Escucha e = new Lan.Escucha(Lan.PUERTO_ANUNCIO);
            try { e.iniciar(); lanEscucha = e; } catch (IOException x) { return "mal"; }
        }
        return "ok";
    }
    private synchronized int lanPuenteIniciar() {
        if (lanPuente != null && lanPuente.vivo()) return lanPuente.puerto;
        Lan.Puente p = new Lan.Puente(Lan.PUERTO_PUENTE);
        try { p.iniciar(); lanPuente = p; return p.puerto; } catch (IOException e) { return 0; }
    }
    private static String corto(String s, int n) { s = s == null ? "" : s.replaceAll("\\p{Cntrl}", "").trim(); return s.length() > n ? s.substring(0, n) : s; }

    // ---- el registro de un cuelgue o un cierre: la consola del juego y el log de la app (el sistema deja leer el propio) ----
    private File archivoRegistro() { return new File(getFilesDir(), "registro.txt"); }
    private String leerRegistro() {
        try { File f = archivoRegistro(); if (!f.exists()) return ""; byte[] b = new byte[(int) Math.min(f.length(), 120000)]; try (InputStream in = new java.io.FileInputStream(f)) { int n = 0, r; while (n < b.length && (r = in.read(b, n, b.length - n)) > 0) n += r; } return new String(b, "UTF-8"); }
        catch (Exception e) { return ""; }
    }
    private void registrar(final String motivo) {
        final StringBuilder sb = new StringBuilder();
        sb.append("motivo: ").append(motivo).append("\nhora: ").append(new java.util.Date().toString()).append("\napp: ").append(version())
          .append("\nandroid: ").append(Build.VERSION.RELEASE).append(" (").append(Build.VERSION.SDK_INT).append(") · ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
          .append(" · ").append(Build.HARDWARE).append("\n--- consola del juego ---\n");
        synchronized (consola) { int n = Math.min(consolaN, consola.length); for (int i = consolaN - n; i < consolaN; i++) sb.append(consola[i % consola.length]).append('\n'); }
        sb.append("--- log de la app ---\n");
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"logcat", "-d", "-v", "time", "-t", "600", "--pid", String.valueOf(android.os.Process.myPid())});
            try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) { String l; int tot = 0; while ((l = r.readLine()) != null && tot < 90000) { sb.append(l).append('\n'); tot += l.length() + 1; } }
        } catch (Exception e) { sb.append("(sin log: ").append(e).append(")\n"); }
        try (FileOutputStream o = new FileOutputStream(archivoRegistro())) { o.write(sb.toString().getBytes("UTF-8")); } catch (Exception e) { /* nada */ }
    }
    private void recuperar(String motivo) {
        registrar(motivo);
        long t = SystemClock.uptimeMillis();
        colgadas = t - colgadaT < 5 * 60000 ? colgadas + 1 : 1; colgadaT = t;
        latidoT = 0;
        if (web != null) { try { raiz.removeView(web); web.destroy(); } catch (Exception e) { /* nada */ } web = null; }
        crearWeb(INICIO + "?colgado=" + colgadas + (colgadas >= 3 ? "&seguro=1" : ""));
    }

    // Al irse a segundo plano (botón de inicio, otra app, pantalla apagada) el juego se calla entero: web.onPause() no
    // frena el sonido (el AudioContext, la radio, YouTube y el micrófono seguían: Discord, «salís del juego y se queda el
    // sonido en el celular»). Se le pide a la página antes de pausarla (audio.js: __jxFondo); la página además se entera
    // sola porque deja de verse. Y se guarda cómo quedó, para saber la próxima vez si se cortó con la app adelante.
    private static final String CALLAR = "window.__jxFondo&&window.__jxFondo(1)", SEGUIR = "window.__jxFondo&&window.__jxFondo(0)";
    private void vidaGuardar(boolean adelanteAhora) {
        try {
            long t = SystemClock.uptimeMillis(), ult = Math.max(latidoUlt, adelanteT);
            String pausa = latidoUlt == 0 ? "cargando" : t - ult < 8000 ? "ok" : "sin latido " + (t - ult) / 1000 + " s";
            android.content.SharedPreferences.Editor e = getSharedPreferences(VIDA, MODE_PRIVATE).edit().putBoolean("adelante", adelanteAhora);
            if (!adelanteAhora) e.putString("pausa", pausa);
            if (adelanteAhora) e.apply(); else e.commit();
        } catch (Throwable e) { /* nada */ }
    }

    @Override protected void onPause() {
        adelante = false; h.removeCallbacks(vigilar);
        vidaGuardar(false);
        super.onPause();
        if (web != null) { try { web.evaluateJavascript(CALLAR, null); } catch (Throwable e) { /* nada */ } web.onPause(); web.pauseTimers(); }
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); try { web.evaluateJavascript(SEGUIR, null); } catch (Throwable e) { /* nada */ } }
        pantallaCompleta();
        // (al volver adelante, se espera el primer latido de nuevo antes de vigilar)
        latidoT = 0; adelanteT = SystemClock.uptimeMillis(); adelante = true; h.removeCallbacks(vigilar); h.postDelayed(vigilar, 3000);
        vidaGuardar(true);
    }

    @Override protected void onDestroy() {
        lanParar(); lanBuscar(false); synchronized (this) { if (lanPuente != null) { lanPuente.parar(); lanPuente = null; } }
        if (web != null) { raiz.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
