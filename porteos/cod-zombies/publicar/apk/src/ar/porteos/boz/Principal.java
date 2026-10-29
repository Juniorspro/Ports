package ar.porteos.boz;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;

// Pantalla única: un WebView a pantalla completa con la versión web, servida por Servidor desde 127.0.0.1
// (un origen http local fijo: los Workers y el sync XHR por rangos andan igual que en la web, y las partidas
// quedan en el IndexedDB de ese origen). Los parches (zip con el motor) se aplican desde el panel o abriendo el zip.
public class Principal extends Activity {
    private static final int PEDIR_PARCHE = 7;
    private WebView web;
    private String url;
    private long ultimoAtras;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        Window v = getWindow();
        v.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = v.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            v.setAttributes(lp);
        }
        versionNueva();
        int puerto = Servidor.iniciar(this);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setBackgroundColor(0xff000000);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Puente(this), "App");
        setContentView(web);
        inmersivo();
        url = "http://127.0.0.1:" + puerto + "/web.html?apk=1";
        web.loadUrl(url);
        abrirIntent(getIntent());
    }

    // un APK nuevo trae su motor: se descartan los parches del anterior
    private void versionNueva() {
        int ver = 0;
        try { ver = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; } catch (Exception e) { /* 0 */ }
        SharedPreferences p = getSharedPreferences("boz", MODE_PRIVATE);
        if (p.getInt("version", -1) != ver) {
            Servidor.borrarParche(this);
            p.edit().putInt("version", ver).apply();
        }
    }

    void elegirParche() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/zip", "application/x-zip-compressed", "application/octet-stream"});
        try { startActivityForResult(i, PEDIR_PARCHE); } catch (Exception e) { Toast.makeText(this, "No hay selector de archivos", Toast.LENGTH_LONG).show(); }
    }

    @Override
    protected void onActivityResult(int pedido, int resultado, Intent datos) {
        super.onActivityResult(pedido, resultado, datos);
        if (pedido == PEDIR_PARCHE && resultado == RESULT_OK && datos != null && datos.getData() != null) aplicar(datos.getData());
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        abrirIntent(i);
    }

    private void abrirIntent(Intent i) {
        if (i != null && Intent.ACTION_VIEW.equals(i.getAction()) && i.getData() != null) aplicar(i.getData());
    }

    private void aplicar(final Uri u) {
        new Thread(() -> {
            String msj;
            try (InputStream in = getContentResolver().openInputStream(u)) {
                int n = Servidor.aplicarParche(in);
                msj = n > 0 ? "Parche aplicado (" + n + " archivos)" : "Ese archivo no es un parche";
            } catch (Exception e) {
                msj = "No se pudo aplicar el parche: " + e.getMessage();
            }
            final String m = msj;
            runOnUiThread(() -> {
                Toast.makeText(this, m, Toast.LENGTH_LONG).show();
                if (m.startsWith("Parche aplicado")) web.loadUrl(url);
            });
        }).start();
    }

    private void inmersivo() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean foco) {
        super.onWindowFocusChanged(foco);
        if (foco) inmersivo();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    // atrás dos veces para salir: una sola cerraría la partida sin querer
    @Override
    public void onBackPressed() {
        long t = System.currentTimeMillis();
        if (t - ultimoAtras < 2000) { super.onBackPressed(); return; }
        ultimoAtras = t;
        Toast.makeText(this, "Tocá atrás de nuevo para salir", Toast.LENGTH_SHORT).show();
    }
}
