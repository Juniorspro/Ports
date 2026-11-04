package com.jxmod.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;

import java.util.Locale;

/**
 * La puerta de la app (sin pantalla propia): abre el juego (Web). Si el aparato no tiene WebView, avisa y abre Play Store
 * para instalarla; si la tiene muy vieja, avisa que conviene actualizarla y abre el juego igual.
 */
public final class Inicio extends Activity {
    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        String m = EleccionMotor.WEB;
        try { m = EleccionMotor.elegir(versionWebView()); } catch (Throwable ignorado) { }
        boolean es = "es".equals(Locale.getDefault().getLanguage());
        if (EleccionMotor.SIN_WEBVIEW.equals(m)) {
            Toast.makeText(this, es ? "Para jugar hace falta «Android System WebView»: instalala o activala desde Play Store"
                : "JXMod needs \"Android System WebView\": install or enable it from the Play Store", Toast.LENGTH_LONG).show();
            abrirTienda();
            finish(); return;
        }
        if (EleccionMotor.WEBVIEW_VIEJA.equals(m)) Toast.makeText(this, es ? "Actualizá «Android System WebView» desde Play Store para que el juego ande bien"
            : "Update \"Android System WebView\" from the Play Store so the game runs well", Toast.LENGTH_LONG).show();
        startActivity(new Intent(this, Web.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION));
        finish();
        overridePendingTransition(0, 0);
    }

    private void abrirTienda() {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.webview")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
        catch (Throwable e) { try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.webview")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Throwable ignorado) { } }
    }

    /** Versión mayor de la WebView del sistema (0 si no se sabe; -1 si no hay WebView). */
    static int versionWebView() {
        if (Build.VERSION.SDK_INT < 26) return 0;
        try {
            PackageInfo p = WebView.getCurrentWebViewPackage();
            if (p == null) return -1;
            String v = p.versionName == null ? "" : p.versionName;
            int punto = v.indexOf('.');
            return Integer.parseInt(punto > 0 ? v.substring(0, punto) : v);
        } catch (Throwable e) { return 0; }
    }
}
