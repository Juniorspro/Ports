package com.jxmod.nativo;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.BitmapFactory;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Un video (o una foto) del celular para Bugs y sugerencias: se elige con el selector de Android, se copia a la app y se sube
 * a la tienda de a partes de 1,5 MB (panel/media, como la web). Rust pregunta cómo va con estado():
 * «eligiendo», «listo|nombre|tamaño|mime», «grande», «subiendo|%», «subido|id|ancho|alto|segundos», «error|por qué» o "".
 */
public class Archivo {
    private static final int PEDIDO = 4242, PARTE = 1572864, MAX = 24 * 1048576;
    private static String estado = "", mime = "", nombre = "";
    private static File copia;
    private static int ancho, alto; private static double dur;

    public static synchronized String estado() { return estado; }
    private static synchronized void poner(String s) { estado = s; }
    public static synchronized void olvidar() { estado = ""; if (copia != null) copia.delete(); copia = null; }

    /** abre el selector de Android (videos y fotos) */
    public static void elegir(final Activity a) {
        poner("eligiendo");
        a.runOnUiThread(new Runnable() { @Override public void run() {
            try {
                Intent i = new Intent(Intent.ACTION_GET_CONTENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "video/*", "image/*" });
                a.startActivityForResult(Intent.createChooser(i, "Elegí un video"), PEDIDO);
            } catch (Throwable t) { poner("error|no se pudo abrir el selector"); }
        } });
    }

    /** lo que eligió (Juego.onActivityResult): se copia en otro hilo */
    public static void llego(final Activity a, int pedido, int res, Intent data) {
        if (pedido != PEDIDO) return;
        final Uri u = (res == Activity.RESULT_OK && data != null) ? data.getData() : null;
        if (u == null) { poner(""); return; }
        new Thread(new Runnable() { @Override public void run() {
            try {
                String n = "archivo"; long tam = -1;
                Cursor c = a.getContentResolver().query(u, null, null, null, null);
                if (c != null) { try { if (c.moveToFirst()) { int k = c.getColumnIndex(OpenableColumns.DISPLAY_NAME); if (k >= 0) n = c.getString(k); int s = c.getColumnIndex(OpenableColumns.SIZE); if (s >= 0 && !c.isNull(s)) tam = c.getLong(s); } } finally { c.close(); } }
                String m = a.getContentResolver().getType(u); if (m == null) m = n.toLowerCase().endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
                if (m.equals("video/3gpp") || m.equals("video/x-matroska")) m = "video/mp4";
                if (!m.matches("image/(jpeg|png|webp|gif)|video/(mp4|webm|quicktime)")) { poner("error|ese archivo no va (video MP4/WEBM o foto)"); return; }
                if (tam > MAX) { poner("grande"); return; }
                File f = new File(a.getCacheDir(), "bug_media"); long total = 0;
                InputStream in = a.getContentResolver().openInputStream(u); OutputStream out = new FileOutputStream(f);
                try { byte[] b = new byte[65536]; int r; while ((r = in.read(b)) > 0) { total += r; if (total > MAX) break; out.write(b, 0, r); } } finally { in.close(); out.close(); }
                if (total > MAX) { f.delete(); poner("grande"); return; }
                int w = 0, h = 0; double d = 0;
                if (m.startsWith("video/")) {
                    MediaMetadataRetriever r = new MediaMetadataRetriever();
                    try { r.setDataSource(f.getAbsolutePath()); w = num(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)); h = num(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)); d = num(r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)) / 1000.0; } catch (Throwable t) { } finally { try { r.release(); } catch (Throwable t) { } }
                } else { BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true; BitmapFactory.decodeFile(f.getAbsolutePath(), o); w = o.outWidth; h = o.outHeight; }
                synchronized (Archivo.class) { copia = f; mime = m; nombre = n.replace('|', ' '); ancho = w; alto = h; dur = d; estado = "listo|" + nombre + "|" + total + "|" + m; }
            } catch (Throwable t) { poner("error|no se pudo leer el archivo"); }
        } }).start();
    }
    private static int num(String s) { try { return Integer.parseInt(s.trim()); } catch (Throwable t) { return 0; } }

    /** lo sube a `base` (…/panel/): de a partes, como la web */
    public static void subir(final String base) {
        final File f; final String m;
        synchronized (Archivo.class) { f = copia; m = mime; }
        if (f == null || !f.exists()) { poner("error|elegí el video de nuevo"); return; }
        poner("subiendo|0");
        new Thread(new Runnable() { @Override public void run() {
            try {
                long tam = f.length(); int partes = (int) Math.max(1, (tam + PARTE - 1) / PARTE); String id = "";
                FileInputStream in = new FileInputStream(f);
                try {
                    byte[] b = new byte[PARTE];
                    for (int i = 0; i < partes; i++) {
                        int n = 0, r; while (n < PARTE && (r = in.read(b, n, PARTE - n)) > 0) n += r;
                        String u = base + "media?parte=" + i + "&partes=" + partes + "&mime=" + URLEncoder.encode(m, "UTF-8") + "&tam=" + tam + (id.isEmpty() ? "" : "&id=" + id);
                        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(60000);
                        c.setRequestMethod("POST"); c.setDoOutput(true); c.setRequestProperty("Content-Type", "application/octet-stream"); c.setFixedLengthStreamingMode(n);
                        OutputStream o = c.getOutputStream(); o.write(b, 0, n); o.close();
                        int cod = c.getResponseCode(); InputStream ri = cod >= 400 ? c.getErrorStream() : c.getInputStream();
                        StringBuilder sb = new StringBuilder(); if (ri != null) { byte[] x = new byte[4096]; int k; while ((k = ri.read(x)) > 0) sb.append(new String(x, 0, k, "UTF-8")); ri.close(); }
                        Matcher mi = Pattern.compile("\"id\"\\s*:\\s*\"([a-z0-9]{12})\"").matcher(sb);
                        if (cod != 200 || !mi.find()) { Matcher me = Pattern.compile("\"error\"\\s*:\\s*\"([^\"]*)\"").matcher(sb); poner("error|" + (me.find() ? me.group(1) : "no se pudo subir (" + cod + ")")); return; }
                        id = mi.group(1); poner("subiendo|" + Math.round(100.0 * (i + 1) / partes));
                    }
                } finally { in.close(); }
                synchronized (Archivo.class) { estado = "subido|" + id + "|" + ancho + "|" + alto + "|" + dur; }
            } catch (Throwable t) { poner("error|se cortó la conexión"); }
        } }).start();
    }
}
