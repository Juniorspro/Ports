package com.jxmod.nativo;

import android.app.Activity;
import android.app.AlertDialog;
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
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Las actualizaciones de la app nativa (como Stickerazo): al abrir se fija en web/nativo.json del repo (Novedad.java); si hay
 * una versión más nueva ofrece bajarla, la baja con su barra, la revisa y la instala ENCIMA con el instalador de Android
 * (PackageInstaller): misma app, misma llave, no se borra nada. Android pide confirmar con un toque (y la primera vez,
 * permitir «instalar apps de esta fuente»). La versión que se dejó para después no se vuelve a ofrecer sola hasta otra más
 * nueva (sí desde Ajustes, con «Buscar actualización»).
 */
final class Actualizar {
    private static final String ACCION = "com.jxmod.nativo.INSTALADO";
    private static BroadcastReceiver receptor;
    private static Novedad pendiente;   // (la que se quiso instalar pero faltaba el permiso: se sigue al volver)
    private static boolean trabajando;
    // (lo que ve el juego: la versión nueva que hay, cuánto se bajó y si falló —estado()—)
    private static volatile Novedad nueva;
    private static volatile long hecho, total;
    private static volatile String fallo;
    private static volatile boolean bajando;

    private Actualizar() {}

    private static boolean en() { return "en".equals(Locale.getDefault().getLanguage()); }
    private static String mb(long b) { return String.format(Locale.ROOT, "%.1f MB", b / 1048576.0).replace('.', ','); }
    static long propio(Context c) {
        try { android.content.pm.PackageInfo p = c.getPackageManager().getPackageInfo(c.getPackageName(), 0); return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : versionVieja(p); }
        catch (Exception e) { return Long.MAX_VALUE; }
    }
    @SuppressWarnings("deprecation") private static long versionVieja(android.content.pm.PackageInfo p) { return p.versionCode; }

    /** (al abrir) se fija en silencio si hay una versión nueva: la muestra la tarjeta del inicio del juego */
    static void revisar(final Activity a) {
        new Thread(new Runnable() { @Override public void run() {
            try { Novedad n = Novedad.leer(Novedad.pedir(Novedad.BASE + Novedad.MANIFIESTO), Locale.getDefault().getLanguage()); if (n != null && n.masNuevaQue(propio(a))) nueva = n; } catch (Exception e) { /* sin internet: nada */ }
        } }, "jxm-version").start();
    }
    /** para el juego: «nueva\tversión\tbytes», «bajando\thecho\ttotal», «error\tmensaje» o "" */
    static String estado() {
        if (bajando) return "bajando\t" + hecho + "\t" + total;
        String f = fallo; if (f != null) return "error\t" + f.replace('\t', ' ').replace('\n', ' ');
        Novedad n = nueva; return n == null ? "" : "nueva\t" + n.version + "\t" + n.tam;
    }
    /** (la tarjeta del inicio) bajar la nueva e instalarla, con el progreso en el juego */
    static void desdeJuego(Activity a) { Novedad n = nueva; if (n == null || bajando) return; fallo = null; empezar(a, n); }

    /** se fija si hay una versión nueva (en otro hilo); `aviso`: decir también «ya tenés la última» */
    static void buscar(final Activity a, final boolean aviso) {
        if (trabajando) return;
        new Thread(new Runnable() { @Override public void run() {
            Novedad n = null;
            try { n = Novedad.leer(Novedad.pedir(Novedad.BASE + Novedad.MANIFIESTO), Locale.getDefault().getLanguage()); } catch (Exception e) { /* sin internet: nada */ }
            final Novedad fn = n; final long yo = propio(a);
            final long dejada = a.getSharedPreferences("jxm", 0).getLong("dejada", 0);
            a.runOnUiThread(new Runnable() { @Override public void run() {
                if (a.isFinishing()) return;
                if (fn != null && fn.masNuevaQue(yo) && (aviso || fn.codigo > dejada)) ofrecer(a, fn);
                else if (aviso) Toast.makeText(a, fn == null ? (en() ? "Couldn't check (no connection?)" : "No se pudo revisar (¿sin internet?)") : (en() ? "You have the latest version" : "Ya tenés la última versión"), Toast.LENGTH_SHORT).show();
            } });
        } }, "jxm-version").start();
    }

    private static void ofrecer(final Activity a, final Novedad n) {
        boolean e = en();
        String msg = (e ? "Version " : "Versión ") + n.version + " · " + mb(n.tam) + (n.notas.isEmpty() ? "" : "\n\n" + n.notas)
            + (e ? "\n\nIt installs over this one: you keep everything." : "\n\nSe instala encima de esta: no se pierde nada.");
        new AlertDialog.Builder(a, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle(e ? "Update available" : "Hay una actualización").setMessage(msg)
            .setPositiveButton(e ? "Update" : "Actualizar", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { empezar(a, n); } })
            .setNegativeButton(e ? "Later" : "Después", new android.content.DialogInterface.OnClickListener() { @Override public void onClick(android.content.DialogInterface d, int w) { a.getSharedPreferences("jxm", 0).edit().putLong("dejada", n.codigo).apply(); } })
            .show();
    }

    /** (al volver a la app) si se fue a dar el permiso de instalar, sigue */
    static void alVolver(Activity a) { if (pendiente != null && puede(a)) { Novedad n = pendiente; pendiente = null; empezar(a, n); } }

    private static boolean puede(Activity a) { return Build.VERSION.SDK_INT < 26 || a.getPackageManager().canRequestPackageInstalls(); }

    private static void empezar(final Activity a, final Novedad n) {
        if (!puede(a)) {
            pendiente = n;
            Toast.makeText(a, en() ? "Allow installing from JXMod and come back" : "Permití «instalar apps» para JXMod y volvé", Toast.LENGTH_LONG).show();
            try { a.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + a.getPackageName()))); } catch (ActivityNotFoundException x) { pendiente = null; bajarEnJuego(a, n); }
            return;
        }
        bajarEnJuego(a, n);
    }

    /** baja sin ventana de Android: el juego muestra cómo va (estado()); al terminar, el instalador de Android */
    private static void bajarEnJuego(final Activity a, final Novedad n) {
        if (bajando) return;
        bajando = true; hecho = 0; total = n.tam; fallo = null;
        final File apk = new File(a.getCacheDir(), "JXModNativo.apk");
        new Thread(new Runnable() { @Override public void run() {
            try {
                n.bajar(n.url(), apk, new Novedad.Progreso() { @Override public void va(long h, long t) { hecho = h; if (t > 0) total = t; } });
                instalar(a, apk);
            } catch (Exception e) { fallo = e.getMessage() == null ? e.toString() : e.getMessage(); }
            bajando = false;
        } }, "jxm-bajar").start();
    }

    @SuppressWarnings("unused") private static void bajar(final Activity a, final Novedad n) {
        trabajando = true;
        final ProgressBar barra = new ProgressBar(a, null, android.R.attr.progressBarStyleHorizontal); barra.setMax(1000);
        final TextView txt = new TextView(a); txt.setPadding(0, 18, 0, 0);
        LinearLayout l = new LinearLayout(a); l.setOrientation(LinearLayout.VERTICAL); l.setPadding(56, 32, 56, 8); l.addView(barra); l.addView(txt);
        final AlertDialog d = new AlertDialog.Builder(a, android.R.style.Theme_DeviceDefault_Dialog_Alert).setTitle((en() ? "Downloading " : "Bajando ") + n.version).setView(l).setCancelable(false).show();
        final File apk = new File(a.getCacheDir(), "JXModNativo.apk");
        new Thread(new Runnable() { @Override public void run() {
            String error = null;
            try {
                final long[] ult = { 0 };
                n.bajar(n.url(), apk, new Novedad.Progreso() { @Override public void va(final long h, final long t) {
                    long ahora = System.currentTimeMillis(); if (ahora - ult[0] < 150 && h < t) return; ult[0] = ahora;
                    a.runOnUiThread(new Runnable() { @Override public void run() { barra.setProgress((int) (1000 * h / Math.max(1, t))); txt.setText(mb(h) + " / " + mb(t)); } });
                } });
                instalar(a, apk);
            } catch (Exception e) { error = e.getMessage(); }
            final String fe = error;
            a.runOnUiThread(new Runnable() { @Override public void run() {
                try { d.dismiss(); } catch (Exception x) { /* ya no está */ }
                trabajando = false;
                if (fe != null) Toast.makeText(a, (en() ? "Update failed: " : "No se pudo actualizar: ") + fe, Toast.LENGTH_LONG).show();
            } });
        } }, "jxm-bajar").start();
    }

    /** le pasa el APK al instalador de Android; la respuesta llega a escuchar() */
    private static void instalar(Activity a, File apk) throws IOException {
        escuchar(a);
        PackageInstaller pi = a.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams sp = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        sp.setAppPackageName(a.getPackageName()); sp.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= 31) sp.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
        int id = pi.createSession(sp);
        PackageInstaller.Session s = pi.openSession(id);
        try {
            try (OutputStream out = s.openWrite("jxmod.apk", 0, apk.length()); InputStream in = new FileInputStream(apk)) {
                byte[] t = new byte[65536]; for (int k; (k = in.read(t)) > 0; ) out.write(t, 0, k); s.fsync(out);
            }
            Intent i = new Intent(ACCION).setPackage(a.getPackageName());
            int banderas = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
            s.commit(PendingIntent.getBroadcast(a, id, i, banderas).getIntentSender());
        } catch (IOException | RuntimeException e) { s.abandon(); throw e instanceof IOException ? (IOException) e : new IOException(e); }
        finally { s.close(); }
    }

    private static synchronized void escuchar(final Activity a) {
        if (receptor != null) return;
        receptor = new BroadcastReceiver() {
            @Override public void onReceive(Context c, Intent i) {
                int st = i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
                if (st == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                    Intent confirmar = Build.VERSION.SDK_INT >= 33 ? i.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class) : viejo(i);
                    if (confirmar != null) try { a.startActivity(confirmar.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (ActivityNotFoundException e) { /* nada */ }
                } else if (st != PackageInstaller.STATUS_SUCCESS && st != PackageInstaller.STATUS_FAILURE_ABORTED) {
                    Toast.makeText(a, (en() ? "Couldn't install: " : "No se pudo instalar: ") + i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE), Toast.LENGTH_LONG).show();
                }
            }
        };
        IntentFilter f = new IntentFilter(ACCION);
        if (Build.VERSION.SDK_INT >= 33) a.registerReceiver(receptor, f, Context.RECEIVER_NOT_EXPORTED); else a.registerReceiver(receptor, f);
    }
    @SuppressWarnings("deprecation") private static Intent viejo(Intent i) { return i.getParcelableExtra(Intent.EXTRA_INTENT); }

    static synchronized void soltar(Activity a) { if (receptor != null) { try { a.unregisterReceiver(receptor); } catch (Exception e) { /* nada */ } receptor = null; } }
}
