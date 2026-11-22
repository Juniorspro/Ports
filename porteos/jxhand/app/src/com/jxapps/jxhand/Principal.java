package com.jxapps.jxhand;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * JX Hand: la vista web a pantalla completa con la página del motor (assets/web, servida en
 * https://appassets.androidplatform.net/ para que la cámara ande: getUserMedia sólo existe en un contexto seguro) y el
 * permiso de la cámara (el de Android y el de la vista web).
 */
public class Principal extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final int PEDIR_CAMARA = 1;
    private WebView web;
    private PermissionRequest pendiente;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) { return servir(r.getUrl()); }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) { return !HOST.equals(r.getUrl().getHost()); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(final PermissionRequest r) {
                runOnUiThread(new Runnable() { @Override public void run() { pedido(r); } });
            }
        });
        setContentView(web);
        inmersivo();
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PEDIR_CAMARA);
        web.loadUrl("https://" + HOST + "/index.html");
    }

    /** la vista web pide la cámara: se da si Android ya la dio; si no, se pide y se contesta después */
    private void pedido(PermissionRequest r) {
        boolean cam = false;
        for (String x : r.getResources()) if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(x)) cam = true;
        if (!cam) { r.deny(); return; }
        if (Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            r.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            if (pendiente != null) pendiente.deny();
            pendiente = r;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, PEDIR_CAMARA);
        }
    }

    @Override public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        if (req != PEDIR_CAMARA) return;
        boolean ok = res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED;
        if (pendiente != null) { if (ok) pendiente.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE}); else pendiente.deny(); pendiente = null; }
        else if (ok && web != null) web.evaluateJavascript("window.jxCamaraLista && window.jxCamaraLista()", null);
    }

    /** los archivos de la página, desde assets/web */
    private WebResourceResponse servir(Uri u) {
        if (!HOST.equals(u.getHost())) return null;
        String p = u.getPath(); if (p == null || p.equals("/")) p = "/index.html";
        if (p.contains("..")) return null;
        try {
            InputStream in = getAssets().open("web" + p);
            Map<String, String> cab = new HashMap<String, String>();
            cab.put("Cache-Control", "no-cache");
            return new WebResourceResponse(tipo(p), tipo(p).startsWith("text") ? "utf-8" : null, 200, "OK", cab, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "No existe", new HashMap<String, String>(), null);
        }
    }
    static String tipo(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private void inmersivo() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }
    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) inmersivo(); }
    @Override protected void onPause() { super.onPause(); if (web != null) { web.onPause(); web.evaluateJavascript("window.jxPausa && window.jxPausa(true)", null); } }
    @Override protected void onResume() { super.onResume(); if (web != null) { web.onResume(); web.evaluateJavascript("window.jxPausa && window.jxPausa(false)", null); } }
    @Override public void onBackPressed() { if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
