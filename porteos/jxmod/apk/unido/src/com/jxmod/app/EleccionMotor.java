package com.jxmod.app;

/**
 * ¿Se puede abrir el juego? (sin Android: se prueba en la compu). La app trae un solo motor: el juego web en una WebView,
 * con WebGL 2 (o WebGL 1 si el aparato no tiene 2; eso lo elige el juego). Hace falta una WebView que sirva.
 * (Los otros motores —el nativo con V8, JXGL y el JX nativo en Java— salieron de la app en la 2.9.)
 */
public final class EleccionMotor {
    public static final String WEB = "web", SIN_WEBVIEW = "sin_webview", WEBVIEW_VIEJA = "webview_vieja";
    /** WebView más vieja que esto no corre bien el juego (WebGL, módulos, audio): se avisa que conviene actualizarla. */
    public static final int WEBVIEW_MIN = 70;

    private EleccionMotor() { }

    /** @param webview versión mayor de la WebView del sistema (0 si no se supo, -1 si no hay) */
    public static String elegir(int webview) {
        if (webview < 0) return SIN_WEBVIEW;
        if (webview > 0 && webview < WEBVIEW_MIN) return WEBVIEW_VIEJA;
        return WEB;
    }
}
