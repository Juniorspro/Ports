package ar.porteos.boz;

import android.webkit.JavascriptInterface;

// lo que la página puede pedirle a la app (window.App)
final class Puente {
    private final Principal act;

    Puente(Principal act) { this.act = act; }

    @JavascriptInterface
    public void parche() { act.runOnUiThread(act::elegirParche); }
}
