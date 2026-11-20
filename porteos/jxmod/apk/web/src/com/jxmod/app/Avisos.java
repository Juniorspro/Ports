package com.jxmod.app;

// Los avisos del panel con la app cerrada (tienda/panel.js: GET /api/panel/notis). El sistema corre esto cada hora, con
// internet, y sigue después de reiniciar el celular (JobScheduler); cada aviso nuevo sale como notificación de Android y
// al tocarla se abre el juego. Se prende desde el juego («Avisarme en este aparato»: Web.java, avisosActivar), que también
// dice cuál fue el último que vio (avisosVisto), así no se repite lo que ya salió adentro. Con el juego abierto no avisa
// acá (los avisos salen en el juego).

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

import org.json.JSONArray;
import org.json.JSONObject;

public class Avisos extends JobService {
    static final int TRABAJO = 7301;
    static final String CANAL = "avisos", PREF = "avisos";
    static final String URL_NOTIS = "https://rezobox-tienda.holasoyjuniors365.workers.dev/api/panel/notis?desde=";
    static volatile boolean juegoAbierto = false;

    static void programar(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo.Builder b = new JobInfo.Builder(TRABAJO, new ComponentName(c, Avisos.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(60 * 60 * 1000L).setPersisted(true);
        try { js.schedule(b.build()); }
        catch (Exception e) { try { js.schedule(b.setPersisted(false).build()); } catch (Exception x) { /* sin JobScheduler: nada */ } }
    }
    static boolean programado(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        return js != null && js.getPendingJob(TRABAJO) != null;
    }
    static boolean puedeAvisar(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
    }
    // (lo último que vio el juego: la fecha del aviso más nuevo)
    static void visto(Context c, long nd) {
        SharedPreferences p = c.getSharedPreferences(PREF, 0);
        if (nd > p.getLong("nd", 0)) p.edit().putLong("nd", nd).apply();
    }

    @Override public boolean onStartJob(final JobParameters par) {
        new Thread(() -> {
            try { revisar(); } catch (Throwable e) { /* sin internet o respuesta rara: la próxima */ }
            finally { jobFinished(par, false); }
        }).start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters par) { return true; }

    private void revisar() throws Exception {
        if (juegoAbierto || !puedeAvisar(this)) return;
        SharedPreferences p = getSharedPreferences(PREF, 0);
        long nd = p.getLong("nd", 0);
        if (nd <= 0) nd = System.currentTimeMillis() - 86400000L;   // (sin nada visto: sólo los del último día)
        HttpURLConnection c = (HttpURLConnection) new URL(URL_NOTIS + nd).openConnection();
        JSONArray L;
        try {
            c.setConnectTimeout(15000); c.setReadTimeout(20000);
            c.setRequestProperty("User-Agent", "JXMod (Android; avisos)");
            if (c.getResponseCode() != 200) return;
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            InputStream in = c.getInputStream(); byte[] bf = new byte[8192]; int n, tot = 0;
            while ((n = in.read(bf)) > 0 && tot < 262144) { bo.write(bf, 0, n); tot += n; }
            L = new JSONObject(new String(bo.toByteArray(), java.nio.charset.StandardCharsets.UTF_8)).optJSONArray("notis");
        } finally { try { c.disconnect(); } catch (Exception x) { /* nada */ } }
        if (L == null || L.length() == 0) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CANAL, "Avisos de JXMod", NotificationManager.IMPORTANCE_DEFAULT));
        Intent abrir = new Intent(this, Inicio.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent pi = PendingIntent.getActivity(this, 2, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        long max = nd;
        // (vienen del más nuevo al más viejo: salen en orden, a lo sumo 5)
        for (int i = Math.min(L.length(), 5) - 1; i >= 0; i--) {
            JSONObject x = L.getJSONObject(i); long cr = x.optLong("creado", 0);
            if (cr <= nd) continue;
            max = Math.max(max, cr);
            String titulo = x.optString("titulo", "JXMod"), texto = x.optString("texto", "");
            Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
            b.setContentTitle(titulo).setContentText(texto).setStyle(new Notification.BigTextStyle().bigText(texto))
                .setSmallIcon(android.R.drawable.ic_popup_reminder).setAutoCancel(true).setContentIntent(pi).setWhen(cr).setShowWhen(true);
            nm.notify(("jx" + x.optString("id")).hashCode(), b.build());
        }
        p.edit().putLong("nd", max).apply();
    }
}
