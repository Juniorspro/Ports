import com.jxmod.app.EleccionMotor;

/** ¿Se abre el juego? (sin Android). Uso: apk/pruebas/unido/correr.sh */
public final class PruebaEleccion {
    static int ok, mal;
    static void ver(String desc, String esperado, int wv) {
        String r = EleccionMotor.elegir(wv);
        boolean b = r.equals(esperado); if (b) ok++; else mal++;
        System.out.println((b ? "  bien  " : "  MAL   ") + desc + " → " + r + (b ? "" : " (se esperaba " + esperado + ")"));
    }
    public static void main(String[] a) {
        ver("WebView 130 → el juego", "web", 130);
        ver("WebView 70 (la mínima) → el juego", "web", 70);
        ver("no se supo la versión (Android 7) → el juego", "web", 0);
        ver("WebView 60 → avisa que conviene actualizarla", "webview_vieja", 60);
        ver("sin WebView → avisa y abre Play Store", "sin_webview", -1);
        System.out.println("elección del motor: " + ok + " bien, " + mal + " mal");
        System.exit(mal == 0 ? 0 : 1);
    }
}
