package com.jxmod.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
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

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
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
    static final String HOST = "appassets.androidplatform.net";
    static final String INICIO = "https://" + HOST + "/index.html";
    static final int PEDIR_ARCHIVO = 11, PEDIR_MIC = 12, GUARDAR = 13;

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

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
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

    private void crearWeb(String url) {
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
    }

    // ---- los archivos del juego, servidos desde la app ----
    private WebResourceResponse servir(Uri u) {
        if (u == null || !HOST.equals(u.getHost())) return null;
        String p = u.getPath();
        if (p == null || p.isEmpty() || p.equals("/")) p = "/index.html";
        Map<String, String> cab = new HashMap<>();
        cab.put("Access-Control-Allow-Origin", "*");
        cab.put("Cache-Control", "no-cache");
        if (!p.contains("..")) {
            try {
                InputStream in = getAssets().open("www" + p);
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
        @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return servir(r.getUrl()); }
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

    /** Lo que la página puede pedirle a la app. */
    private class Puente {
        @JavascriptInterface public void guardar(final String nombre, String b64, final String mime) {
            final byte[] b;
            try { b = Base64.decode(b64, Base64.DEFAULT); } catch (Exception e) { return; }
            runOnUiThread(() -> Web.this.guardar(nombre, b, mime));
        }
        @JavascriptInterface public void salir() { runOnUiThread(Web.this::finishAndRemoveTask); }
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
        @JavascriptInterface public String version() { return Web.this.version(); }
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
        /** RAM total del aparato en MB (para elegir la calidad). */
        @JavascriptInterface public int ramMB() {
            try { android.app.ActivityManager am = (android.app.ActivityManager) getSystemService(ACTIVITY_SERVICE); android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo(); am.getMemoryInfo(mi); return (int) (mi.totalMem >> 20); } catch (Throwable e) { return 0; }
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

    @Override protected void onPause() {
        super.onPause();
        if (web != null) { web.onPause(); web.pauseTimers(); }
    }

    @Override protected void onResume() {
        super.onResume();
        if (web != null) { web.onResume(); web.resumeTimers(); }
        pantallaCompleta();
    }

    @Override protected void onDestroy() {
        if (web != null) { raiz.removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
