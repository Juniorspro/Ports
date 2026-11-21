package com.stickerazo.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/** El APK nuevo, para cuando cambia algo del lado de Java (la página se actualiza sola con OtaNucleo).
 *  Depende de dónde se bajó la app (assets/canal.txt, lo escribe herramientas/armar_apk.py):
 *  <ul><li>«web» (nuestra página): la app baja el APK (ApkBajada: huella firmada) y lo instala con PackageInstaller.
 *  La primera vez Android pide permiso para «instalar apps desconocidas» y confirmar; desde Android 12, las siguientes
 *  pueden entrar sin preguntar porque la app ya es la que se instaló a sí misma.</li>
 *  <li>una tienda (play, galaxy, huawei, uptodown): se abre la app en esa tienda, que es la que la actualiza (las tiendas
 *  no dejan que una app se actualice por su cuenta).</li></ul> */
final class Actualizador {
    private Actualizador() {}

    static final String SITIO = "https://rezobox-tienda.holasoyjuniors365.workers.dev/sz/";
    static final String[] FUENTES_APK = {
        SITIO + "descargar",
        "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/porteos/stickerazo/descargas/Stickerazo.apk",
    };
    private static final String ACCION = "com.stickerazo.app.INSTALACION";

    static String canal(Context c) {
        try {
            InputStream in = c.getAssets().open("canal.txt");
            try { byte[] b = new byte[32]; int n = in.read(b); return n > 0 ? new String(b, 0, n, "UTF-8").trim() : "web"; } finally { in.close(); }
        } catch (IOException e) { return "web"; }
    }
    static boolean desdeLaWeb(Context c) { return "web".equals(canal(c)); }

    /** abre Stickerazo en su tienda (o nuestra página si esa tienda no tiene dirección fija) */
    static void abrirTienda(Activity a) {
        String p = a.getPackageName(), canal = canal(a), app = null, web = SITIO + "#bajar";
        if ("play".equals(canal)) { app = "market://details?id=" + p; web = "https://play.google.com/store/apps/details?id=" + p; }
        else if ("galaxy".equals(canal)) { app = "samsungapps://ProductDetail/" + p; web = "https://galaxystore.samsung.com/detail/" + p; }
        else if ("huawei".equals(canal)) { app = "appmarket://details?id=" + p; }
        else if ("uptodown".equals(canal)) { app = "market://details?id=" + p; }
        if (app != null) {
            try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(app)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); return; } catch (ActivityNotFoundException e) { /* la web */ }
        }
        try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(web))); } catch (ActivityNotFoundException e) { /* nada */ }
    }

    /** ¿se puede instalar ya? Si no, abre el ajuste de «instalar apps desconocidas» para Stickerazo y devuelve false */
    static boolean permisoParaInstalar(Activity a) {
        if (Build.VERSION.SDK_INT < 26 || a.getPackageManager().canRequestPackageInstalls()) return true;
        try { a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()))); }
        catch (ActivityNotFoundException e) { /* no hay ese ajuste: lo va a pedir el instalador */ return true; }
        return false;
    }

    interface Resultado { void en(String estado, String detalle); }

    /** escucha cómo terminó la instalación (lo manda el sistema a través del PendingIntent de instalar) */
    static BroadcastReceiver escuchar(final Activity a, final Resultado r) {
        BroadcastReceiver b = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirmar = Build.VERSION.SDK_INT >= 33 ? i.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class) : viejo(i);
                    if (confirmar != null) {
                        try { a.startActivity(confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); r.en("confirmar", ""); return; } catch (ActivityNotFoundException e) { /* abajo */ }
                    }
                    r.en("error", "No se pudo abrir el instalador");
                } else if (st == PackageInstaller.STATUS_SUCCESS) r.en("listo", "");
                else if (st == PackageInstaller.STATUS_FAILURE_ABORTED) r.en("cancelado", "");
                else r.en("error", String.valueOf(i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)));
            }
        };
        IntentFilter f = new IntentFilter(ACCION);
        if (Build.VERSION.SDK_INT >= 33) a.registerReceiver(b, f, Context.RECEIVER_NOT_EXPORTED); else a.registerReceiver(b, f);
        return b;
    }
    @SuppressWarnings("deprecation") private static Intent viejo(Intent i) { return i.getParcelableExtra(Intent.EXTRA_INTENT); }

    /** le pasa el APK al instalador de Android (la respuesta llega a escuchar()) */
    static void instalar(Activity a, File apk) throws IOException {
        PackageInstaller pi = a.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(a.getPackageName());
        sp.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(sp);
        PackageInstaller.Session s = pi.openSession(id);
        try {
            OutputStream out = s.openWrite("stickerazo.apk", 0, apk.length());
            InputStream in = new FileInputStream(apk);
            try { byte[] t = new byte[65536]; for (int k; (k = in.read(t)) > 0; ) out.write(t, 0, k); s.fsync(out); } finally { in.close(); out.close(); }
            Intent i = new Intent(ACCION).setPackage(a.getPackageName());
            int banderas = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(a, id, i, banderas).getIntentSender());
        } catch (IOException | RuntimeException e) {
            s.abandon();
            throw e instanceof IOException ? (IOException) e : new IOException(e);
        } finally { s.close(); }
    }
}
