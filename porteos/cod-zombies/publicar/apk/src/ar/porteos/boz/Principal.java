package ar.porteos.boz;

import android.app.Activity;
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

// Pantalla única: un WebView a pantalla completa con la versión web, servida por Servidor desde 127.0.0.1
// (un origen http local fijo: los Workers y el sync XHR por rangos andan igual que en la web, y las partidas
// quedan en el IndexedDB de ese origen).
public class Principal extends Activity {
    private WebView web;
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
        setContentView(web);
        inmersivo();
        web.loadUrl("http://127.0.0.1:" + puerto + "/web.html?apk=1");
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
