package com.stickerazo.app;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.Charset;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Las actualizaciones solas (Java puro: se prueba sin teléfono), como en JXMod: la página (web/) se baja de GitHub sin
 *  pasar por la tienda.
 *  <ul><li>ota.json = {"datos": "&lt;JSON&gt;", "firma": "&lt;base64&gt;"}: la firma (ECDSA P-256) es de los bytes de «datos»,
 *  con una llave que no está en el repo (herramientas/ota.py); la pública viene adentro del APK. Si no coincide, nada.</li>
 *  <li>datos = {"v": versión, "apkMin": versionCode mínimo, "archivos": {"ruta": {"h": sha256, "n": bytes}}}.</li>
 *  <li>Se baja sólo lo que cambió respecto de lo que trae el APK y de la última actualización; cada archivo se revisa con su
 *  sha256, todo se arma en una carpeta aparte (ota/&lt;v&gt;) y recién al final se apunta a ella (ota/actual.txt). Si algo
 *  falla, queda la de antes. La página abierta sigue con su carpeta hasta que se vuelve a abrir (nada se mezcla), y al
 *  arrancar se borran las viejas.</li></ul> */
public final class OtaNucleo {
    private static final Charset UTF8 = Charset.forName("UTF-8");
    private static final Pattern RUTA = Pattern.compile("[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*\\.[a-z0-9]{1,5}");
    public static final long MAX_ARCHIVO = 8L * 1024 * 1024;

    public interface Bajador { byte[] bajar(String ruta) throws IOException; }

    private OtaNucleo() {}

    public static PublicKey llavePublica(String b64) throws Exception {
        return KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(Base64Simple.decode(b64)));
    }

    /** los «datos» si la firma es buena; si no, null */
    public static Map<?, ?> leer(byte[] otaJson, PublicKey pub) {
        try {
            Object o = Json.leer(new String(otaJson, UTF8));
            if (!(o instanceof Map)) return null;
            Object d = ((Map<?, ?>) o).get("datos"), f = ((Map<?, ?>) o).get("firma");
            if (!(d instanceof String) || !(f instanceof String)) return null;
            Signature s = Signature.getInstance("SHA256withECDSA");
            s.initVerify(pub);
            s.update(((String) d).getBytes(UTF8));
            if (!s.verify(Base64Simple.decode((String) f))) return null;
            Object datos = Json.leer((String) d);
            if (!(datos instanceof Map) || !(((Map<?, ?>) datos).get("archivos") instanceof Map) || !(((Map<?, ?>) datos).get("v") instanceof Double)) return null;
            for (Object k : ((Map<?, ?>) ((Map<?, ?>) datos).get("archivos")).keySet()) if (!rutaValida(String.valueOf(k))) return null;
            return (Map<?, ?>) datos;
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean rutaValida(String r) { return r != null && r.length() < 200 && RUTA.matcher(r).matches() && !r.contains(".."); }
    public static long version(Map<?, ?> datos) { return datos == null ? 0 : ((Double) datos.get("v")).longValue(); }
    public static long apkMin(Map<?, ?> datos) { return datos != null && datos.get("apkMin") instanceof Double ? ((Double) datos.get("apkMin")).longValue() : 0; }

    /** la actualización vigente (su carpeta), o null */
    public static File actual(File raiz) {
        try {
            String v = new String(Almacen.leer(new File(raiz, "actual.txt")), UTF8).trim();
            if (!v.matches("[0-9]{1,15}")) return null;
            File a = new File(raiz, v); return new File(a, "ota.json").isFile() ? a : null;
        } catch (IOException e) { return null; }
    }
    /** un archivo de la página en una carpeta de actualización (la que usa la página abierta); null: el del APK */
    public static File archivo(File carpeta, String ruta) {
        if (carpeta == null || !rutaValida(ruta)) return null;
        File f = new File(new File(carpeta, "www"), ruta);
        return f.isFile() ? f : null;
    }
    /** al arrancar: se borra todo lo que no sea la versión vigente (las viejas y lo que quedó a medias) */
    public static void limpiar(File raiz) {
        File a = actual(raiz); File[] fs = raiz.listFiles(); if (fs == null) return;
        for (File f : fs) if (!f.getName().equals("actual.txt") && (a == null || !f.equals(a))) borrar(f);
    }

    /** la versión de una carpeta de actualización (0 si no se puede leer) */
    public static long versionDe(File carpeta, PublicKey pub) { try { return carpeta == null ? 0 : version(leer(Almacen.leer(new File(carpeta, "ota.json")), pub)); } catch (IOException e) { return 0; } }
    /** la versión que se está usando: la de la actualización o, si no hay, la del APK */
    public static long versionActual(File raiz, long delApk, PublicKey pub) {
        File a = actual(raiz);
        if (a == null) return delApk;
        try { return Math.max(delApk, version(leer(Almacen.leer(new File(a, "ota.json")), pub))); } catch (IOException e) { return delApk; }
    }

    /** baja y deja lista la versión nueva. base: las huellas de lo que trae el APK (ruta → sha256). Devuelve cuántos
     *  archivos bajó; -1 si no hay nada para hacer (no hay nada nuevo o el APK es viejo); -2 si algo falló (probar más tarde) */
    public static int aplicar(File raiz, byte[] otaJson, PublicKey pub, Map<String, String> base, long delApk, long codigoApk, Bajador b) {
        Map<?, ?> datos = leer(otaJson, pub);
        if (datos == null) return -2;
        if (version(datos) <= versionActual(raiz, delApk, pub) || apkMin(datos) > codigoApk) return -1;
        File nueva = new File(raiz, version(datos) + ".tmp"), act = actual(raiz);
        borrar(nueva);
        int bajados = 0;
        try {
            for (Map.Entry<?, ?> e : ((Map<?, ?>) datos.get("archivos")).entrySet()) {
                String ruta = String.valueOf(e.getKey());
                Object h0 = e.getValue() instanceof Map ? ((Map<?, ?>) e.getValue()).get("h") : null;
                if (!(h0 instanceof String)) return fallar(nueva);
                String h = (String) h0;
                if (h.equals(base.get(ruta))) continue;                       // (igual que en el APK)
                File dest = new File(new File(nueva, "www"), ruta);
                byte[] datosArch = null;
                File ya = act != null ? new File(new File(act, "www"), ruta) : null;
                if (ya != null && ya.isFile() && ya.length() <= MAX_ARCHIVO) { byte[] x = Almacen.leer(ya); if (h.equals(sha(x))) datosArch = x; }
                if (datosArch == null) {
                    datosArch = b.bajar(ruta); bajados++;
                    if (datosArch == null || datosArch.length > MAX_ARCHIVO || !h.equals(sha(datosArch))) return fallar(nueva);   // (no coincide: nada)
                }
                escribir(dest, datosArch);
            }
            escribir(new File(nueva, "ota.json"), otaJson);
            // el cambio: la carpeta queda con su número y el puntero pasa a ella (escrito aparte y renombrado)
            File fin = new File(raiz, String.valueOf(version(datos)));
            borrar(fin);
            if (!nueva.renameTo(fin)) return fallar(nueva);
            File t = new File(raiz, "actual.txt.tmp"), p = new File(raiz, "actual.txt");
            escribir(t, String.valueOf(version(datos)).getBytes(UTF8));
            if (!t.renameTo(p)) { p.delete(); if (!t.renameTo(p)) return fallar(fin); }
            return bajados;
        } catch (IOException e) {
            return fallar(nueva);
        }
    }

    private static int fallar(File nueva) { borrar(nueva); return -2; }

    public static String sha(byte[] d) {
        try {
            byte[] x = MessageDigest.getInstance("SHA-256").digest(d);
            StringBuilder s = new StringBuilder();
            for (byte y : x) s.append(String.format("%02x", y & 0xff));
            return s.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    /** las huellas del APK: base = {"ruta": "sha256"} */
    public static Map<String, String> base(byte[] json) {
        Map<String, String> r = new LinkedHashMap<String, String>();
        try {
            Object o = Json.leer(new String(json, UTF8));
            if (o instanceof Map) { Object a = ((Map<?, ?>) o).get("archivos"); if (a instanceof Map) for (Map.Entry<?, ?> e : ((Map<?, ?>) a).entrySet()) if (e.getValue() instanceof Map) { Object h = ((Map<?, ?>) e.getValue()).get("h"); if (h instanceof String) r.put(String.valueOf(e.getKey()), (String) h); } }
        } catch (IllegalArgumentException e) { /* vacío */ }
        return r;
    }
    public static long versionBase(byte[] json) {
        try { Object o = Json.leer(new String(json, UTF8)); Object v = o instanceof Map ? ((Map<?, ?>) o).get("v") : null; return v instanceof Double ? ((Double) v).longValue() : 0; } catch (IllegalArgumentException e) { return 0; }
    }

    private static void escribir(File f, byte[] d) throws IOException {
        File p = f.getParentFile(); if (!p.isDirectory() && !p.mkdirs()) throw new IOException("no se pudo crear " + p);
        FileOutputStream o = new FileOutputStream(f);
        try { o.write(d); o.getFD().sync(); } finally { o.close(); }
    }
    static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] h = f.listFiles(); if (h != null) for (File x : h) borrar(x);
        f.delete();
    }

    /** base64 (estándar) sin depender de Android ni de Java 8 */
    static final class Base64Simple {
        private static final String A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        static byte[] decode(String s) {
            s = s.replaceAll("[^A-Za-z0-9+/]", "");
            java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream();
            int buf = 0, bits = 0;
            for (int i = 0; i < s.length(); i++) { buf = (buf << 6) | A.indexOf(s.charAt(i)); bits += 6; if (bits >= 8) { bits -= 8; o.write((buf >> bits) & 0xff); } }
            return o.toByteArray();
        }
    }
}
