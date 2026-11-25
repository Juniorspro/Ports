package com.jxmod.nativo;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Las versiones nuevas de JXMod nativo, sin nada de Android (se prueba en la compu: apk/pruebas/nativo/PruebaNovedad.java).
 * armar_nativo.py --publicar deja el APK en jxmod/JXModNativo.apk y web/nativo.json con su número (versionCode), su versión,
 * su tamaño, su SHA-256 y las notas. La app lee ese json de la dirección fija del repo, y si el número es mayor que el suyo
 * ofrece bajar el APK (sólo de esa misma carpeta del repo), lo revisa con el tamaño y el SHA-256 y se lo pasa al instalador
 * de Android (Actualizar.java). Como va firmado con la misma llave de JXMod, se instala encima: no se pierde nada de lo
 * guardado (mapas bajados, ajustes, partidas).
 */
public final class Novedad {
    /** de dónde: la rama del repo (como el json de versiones de la web) */
    public static final String BASE = "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/";
    public static final String MANIFIESTO = "web/nativo.json";

    public int codigo; public String version = "", apk = "", sha256 = "", notas = ""; public long tam;

    private static String texto(String j, String k) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(k) + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(j);
        if (!m.find()) return "";
        return m.group(1).replace("\\n", "\n").replace("\\\"", "\"").replace("\\/", "/").replace("\\\\", "\\");
    }
    private static long numero(String j, String k) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(k) + "\"\\s*:\\s*(\\d+)").matcher(j);
        return m.find() ? Long.parseLong(m.group(1)) : 0;
    }

    /** el json de web/nativo.json; null si está raro (sin número, sin APK de la carpeta del repo, sin huella o tamaño) */
    public static Novedad leer(String json, String idioma) {
        Novedad n = new Novedad();
        n.codigo = (int) Math.min(Integer.MAX_VALUE, numero(json, "codigo")); n.version = texto(json, "version"); n.apk = texto(json, "apk");
        n.sha256 = texto(json, "sha256").toLowerCase(java.util.Locale.ROOT); n.tam = numero(json, "tam");
        String nt = texto(json, "notas_" + idioma); n.notas = nt.isEmpty() ? texto(json, "notas_es") : nt;
        // (sólo un APK de jxmod/ del repo: nadie puede hacer que la app baje otra cosa cambiando el json)
        if (n.codigo <= 0 || !n.apk.matches("jxmod/[A-Za-z0-9._-]+\\.apk") || !n.sha256.matches("[0-9a-f]{64}") || n.tam <= 0 || n.tam > 400L << 20) return null;
        return n;
    }
    /** ¿hay que ofrecerla? (más nueva que la instalada) */
    public boolean masNuevaQue(long propio) { return codigo > propio; }
    public String url() { return BASE + apk; }

    public interface Progreso { void va(long hecho, long total); }

    /** baja el APK a `destino` y lo revisa (tamaño y SHA-256); si algo no coincide, lo borra y avisa */
    public void bajar(String url, File destino, Progreso pr) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        long n = 0; MessageDigest md;
        try { md = MessageDigest.getInstance("SHA-256"); } catch (Exception e) { throw new IOException(e); }
        try {
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setRequestProperty("User-Agent", "JXMod-nativo (Android)");
            if (c.getResponseCode() != 200) throw new IOException("no se pudo bajar (" + c.getResponseCode() + ")");
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(destino)) {
                byte[] b = new byte[65536]; int r;
                while ((r = in.read(b)) > 0) {
                    if (n + r > tam) throw new IOException("más grande de lo que debía");
                    out.write(b, 0, r); md.update(b, 0, r); n += r;
                    if (pr != null) pr.va(n, tam);
                }
            }
        } catch (IOException e) { destino.delete(); throw e; }
        finally { c.disconnect(); }
        if (n != tam) { destino.delete(); throw new IOException("se cortó la descarga"); }
        if (!hex(md.digest()).equals(sha256)) { destino.delete(); throw new IOException("el archivo no coincide con la versión publicada"); }
    }

    /** el json de la dirección fija */
    public static String pedir(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setRequestProperty("User-Agent", "JXMod-nativo (Android)"); c.setUseCaches(false);
            if (c.getResponseCode() != 200) throw new IOException("nativo.json " + c.getResponseCode());
            try (InputStream in = c.getInputStream()) {
                java.io.ByteArrayOutputStream bo = new java.io.ByteArrayOutputStream(); byte[] b = new byte[8192]; int r, tot = 0;
                while ((r = in.read(b)) > 0) { tot += r; if (tot > 65536) throw new IOException("demasiado grande"); bo.write(b, 0, r); }
                return new String(bo.toByteArray(), StandardCharsets.UTF_8);
            }
        } finally { c.disconnect(); }
    }
    static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 255)); return s.toString(); }
    /** el SHA-256 de un archivo (para la prueba y para armar_nativo.py, que hace la misma cuenta) */
    public static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) { byte[] b = new byte[65536]; int r; while ((r = in.read(b)) > 0) md.update(b, 0, r); }
        return hex(md.digest());
    }
}
