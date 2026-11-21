package com.stickerazo.app;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/** Baja el APK nuevo (sólo Java, así se prueba en la compu: pruebas/PruebaApkBajada.java). Prueba las fuentes en orden y
 *  acepta el archivo sólo si mide y tiene la huella (sha256) que dice ota.json, que viene firmado: si alguien lo cambia
 *  en el camino, no se instala. Android además revisa que esté firmado con la misma llave que la app instalada. */
public final class ApkBajada {
    private ApkBajada() {}

    public interface Avance { void en(int porciento); }

    public static boolean bajar(String[] fuentes, File destino, long n, String huella, Avance avance) {
        if (n <= 0 || n > 300L * 1024 * 1024 || huella == null || !huella.matches("[0-9a-f]{64}")) return false;
        for (String f : fuentes) {
            if (deUna(f, destino, n, huella, avance)) return true;
        }
        destino.delete();
        return false;
    }

    private static boolean deUna(String fuente, File destino, long n, String huella, Avance avance) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(fuente).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(true);
            if (c.getResponseCode() != 200) return false;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            long total = 0; int ultimo = -1;
            InputStream in = c.getInputStream();
            OutputStream out = new FileOutputStream(destino);
            try {
                byte[] t = new byte[65536];
                for (int k; (k = in.read(t)) > 0; ) {
                    total += k;
                    if (total > n) return false;
                    md.update(t, 0, k); out.write(t, 0, k);
                    int p = (int) (total * 100 / n);
                    if (p != ultimo && avance != null) { ultimo = p; avance.en(p); }
                }
            } finally { out.close(); in.close(); }
            return total == n && hex(md.digest()).equals(huella);
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    public static String hex(byte[] b) {
        StringBuilder s = new StringBuilder(b.length * 2);
        for (byte x : b) s.append(Character.forDigit((x >> 4) & 15, 16)).append(Character.forDigit(x & 15, 16));
        return s.toString();
    }
}
