package com.jxmod.app;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
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
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Las actualizaciones por partes (pedido del dueño: «que las actualizaciones sean megas, no todo el juego, y se instalen
 * solas: tocás descargar y el juego se pone en modo actualizando, sin instalar nada encima»). herramientas/ota.py publica en
 * web/ota los archivos del juego (index.html, pk.bin, los fondos), cifrados y con su HMAC, y ota.json con la huella de cada
 * uno. Acá se baja sólo lo que no coincide con lo que ya hay —lo del APK (assets/www/ota_base.json) o lo de una
 * actualización anterior—, se comprueba el HMAC de cada archivo (nadie sin el secreto puede publicar una actualización) y
 * se instala en files/ota/actual: Web.java sirve esos archivos antes que los del APK. Lo que está en Java no se actualiza
 * así: ota.json dice el APK mínimo («apkMin») y si el que está instalado es más viejo, hace falta el APK.
 * Seguro ante un corte: se baja todo a files/ota/nuevo y recién después se pasa; mientras se pasa, el estado dice que no está
 * listo y la app sirve los archivos del APK (viejos pero enteros); al terminar, el estado nuevo. Al instalar un APK más nuevo
 * que la actualización, se borra (limpiarSiViejo).
 */
final class Ota {
    static final String URL_BASE = "https://raw.githubusercontent.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/";
    static final String URL_MAN = URL_BASE + "ota/ota.json";
    private static final byte[] ET_OTA = "JXMOD-ANDROID-OTA-v1".getBytes(StandardCharsets.US_ASCII);
    private static final byte[] ET_MAC = "JXMOD-ANDROID-OTA-MAC-v1".getBytes(StandardCharsets.US_ASCII);
    private static JSONObject estadoCache;
    private static boolean estadoLeido;
    private static byte[] llave, llaveMac;

    private Ota() {}

    static final class Item { String n, h, u, mac; long t; }
    static final class Plan { int codigo; String version = ""; final List<Item> bajar = new ArrayList<>(); final List<String> quitar = new ArrayList<>(); long bytes; }
    interface Progreso { void va(long hecho, long total); }

    static File dir(Context c) { return new File(c.getFilesDir(), "ota"); }
    static File actual(Context c) { return new File(dir(c), "actual"); }
    private static String plano(String ruta) { return ruta.replace('/', '_'); }

    static synchronized JSONObject estado(Context c) {
        if (estadoLeido) return estadoCache;
        estadoLeido = true; estadoCache = null;
        File f = new File(actual(c), "estado.json");
        if (!f.isFile()) return null;
        try { estadoCache = new JSONObject(new String(leer(new FileInputStream(f), 1 << 20), StandardCharsets.UTF_8)); } catch (Exception e) { estadoCache = null; }
        return estadoCache;
    }
    private static synchronized void estadoOlvidar() { estadoLeido = false; estadoCache = null; }
    /** El código de la actualización instalada (0: ninguna lista). */
    static int codigoInstalado(Context c) { JSONObject e = estado(c); return e != null && e.optBoolean("listo") ? e.optInt("codigo", 0) : 0; }
    static String versionInstalada(Context c) { JSONObject e = estado(c); return e != null && e.optBoolean("listo") ? e.optString("version", "") : ""; }

    /** Con un APK igual o más nuevo que la actualización instalada, ésta sobra (el APK ya trae lo suyo). */
    static synchronized void limpiarSiViejo(Context c, int propia) {
        JSONObject e = estado(c);
        if (e != null && e.optInt("codigo", 0) > propia) return;
        borrar(dir(c)); estadoOlvidar();
    }

    /** El archivo que dejó una actualización para esa ruta del juego (sin la barra del principio), o null: va el del APK. */
    static File archivo(Context c, String ruta) {
        JSONObject e = estado(c);
        if (e == null || !e.optBoolean("listo")) return null;
        JSONObject h = e.optJSONObject("h");
        if (h == null || !h.has(ruta)) return null;
        File f = new File(actual(c), plano(ruta));
        return f.isFile() ? f : null;
    }

    private static byte[] derivar(byte[] et, Context c) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(et); md.update(Cifrado.firma(c)); md.update(Llave.secretoOta());
            return md.digest();
        } catch (Exception e) { return new byte[32]; }
    }
    static synchronized byte[] clave(Context c) { if (llave == null) llave = derivar(ET_OTA, c); return llave; }
    static synchronized byte[] claveMac(Context c) { if (llaveMac == null) llaveMac = derivar(ET_MAC, c); return llaveMac; }

    /** Qué bajar: lo que no coincide con lo que hay ahora (lo de una actualización anterior o lo del APK). */
    static Plan planear(Context c, JSONObject man) throws Exception {
        JSONObject base = new JSONObject(new String(leer(c.getAssets().open("www/ota_base.json"), 1 << 20), StandardCharsets.UTF_8));
        JSONObject e = estado(c), inst = e != null && e.optBoolean("listo") && e.optJSONObject("h") != null ? e.optJSONObject("h") : new JSONObject();
        Plan p = new Plan();
        p.codigo = man.getInt("codigo"); p.version = man.optString("version", "");
        JSONArray A = man.getJSONArray("archivos");
        List<String> enMan = new ArrayList<>();
        for (int i = 0; i < A.length(); i++) {
            JSONObject a = A.getJSONObject(i);
            Item it = new Item(); it.n = a.getString("n"); it.h = a.getString("h"); it.u = a.getString("u"); it.mac = a.getString("mac"); it.t = a.getLong("t");
            if (!it.n.matches("[A-Za-z0-9._/-]+") || it.n.contains("..") || !it.u.matches("ota/[A-Za-z0-9._-]+") || it.t <= 0 || it.t > 400L * 1024 * 1024) throw new IOException("ota.json raro: " + it.n);
            enMan.add(it.n);
            String hay = inst.has(it.n) ? inst.optString(it.n) : base.optString(it.n, "");
            if (it.h.equalsIgnoreCase(hay)) continue;
            if (it.h.equalsIgnoreCase(base.optString(it.n, ""))) { p.quitar.add(it.n); continue; }   // (vuelve a ser el del APK)
            p.bajar.add(it); p.bytes += it.t;
        }
        for (Iterator<String> k = inst.keys(); k.hasNext(); ) { String n = k.next(); if (!enMan.contains(n)) p.quitar.add(n); }
        return p;
    }

    /** Baja lo del plan (comprobando el tamaño y el HMAC de cada archivo) y lo instala; si algo falla, no toca lo que había. */
    static void instalar(Context c, Plan p, Progreso pr) throws Exception {
        File nuevo = new File(dir(c), "nuevo"); borrar(nuevo);
        if (!nuevo.mkdirs()) throw new IOException("sin lugar en el teléfono");
        byte[] km = claveMac(c); long hecho = 0;
        byte[] bf = new byte[64 * 1024];
        for (Item it : p.bajar) {
            File f = new File(nuevo, plano(it.n));
            Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(km, "HmacSHA256"));
            HttpURLConnection con = null; long n = 0;
            try (OutputStream out = new FileOutputStream(f)) {
                con = (HttpURLConnection) new URL(URL_BASE + it.u).openConnection();
                con.setConnectTimeout(15000); con.setReadTimeout(30000); con.setRequestProperty("User-Agent", "JXMod-ota (Android)");
                if (con.getResponseCode() != 200) throw new IOException("no se pudo bajar " + it.n + " (" + con.getResponseCode() + ")");
                try (InputStream in = con.getInputStream()) {
                    int r;
                    while ((r = in.read(bf)) > 0) {
                        if (n + r > it.t) throw new IOException("más grande de lo que debía: " + it.n);
                        out.write(bf, 0, r); mac.update(bf, 0, r); n += r;
                        if (pr != null) pr.va(hecho + n, p.bytes);
                    }
                }
            } finally { if (con != null) try { con.disconnect(); } catch (Exception x) { /* nada */ } }
            if (n != it.t) throw new IOException("se cortó la descarga de " + it.n);
            if (!MessageDigest.isEqual(mac.doFinal(), hex(it.mac))) throw new IOException("no es una actualización oficial (" + it.n + ")");
            hecho += it.t;
        }
        // pasarlo: primero el estado dice «no listo» (mientras tanto se sirve lo del APK), después los archivos, al final el estado nuevo
        File act = actual(c); if (!act.isDirectory() && !act.mkdirs()) throw new IOException("sin lugar en el teléfono");
        JSONObject e = estado(c), h = new JSONObject();
        if (e != null && e.optBoolean("listo") && e.optJSONObject("h") != null) { JSONObject v = e.optJSONObject("h"); for (Iterator<String> k = v.keys(); k.hasNext(); ) { String x = k.next(); h.put(x, v.optString(x)); } }
        escribirEstado(act, new JSONObject().put("listo", false).put("codigo", e != null ? e.optInt("codigo", 0) : 0).put("h", h));
        for (Item it : p.bajar) {
            File de = new File(nuevo, plano(it.n)), a = new File(act, plano(it.n));
            if (a.exists() && !a.delete()) throw new IOException("no se pudo reemplazar " + it.n);
            if (!de.renameTo(a)) throw new IOException("no se pudo instalar " + it.n);
            h.put(it.n, it.h);
        }
        for (String q : p.quitar) { new File(act, plano(q)).delete(); h.remove(q); }
        escribirEstado(act, new JSONObject().put("listo", true).put("codigo", p.codigo).put("version", p.version).put("h", h));
        borrar(nuevo);
    }

    private static void escribirEstado(File act, JSONObject e) throws IOException {
        File t = new File(act, "estado.json.tmp"), f = new File(act, "estado.json");
        try (FileOutputStream o = new FileOutputStream(t)) { o.write(e.toString().getBytes(StandardCharsets.UTF_8)); o.getFD().sync(); }
        if (!t.renameTo(f)) throw new IOException("no se pudo guardar el estado");
        estadoOlvidar();
    }

    /** ota.json de la dirección fija (no de la que diga un json: así sólo se baja del repo oficial). */
    static JSONObject manifiesto() throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(URL_MAN).openConnection();
        try {
            c.setConnectTimeout(12000); c.setReadTimeout(20000); c.setRequestProperty("User-Agent", "JXMod-ota (Android)");
            if (c.getResponseCode() != 200) throw new IOException("ota.json " + c.getResponseCode());
            return new JSONObject(new String(leer(c.getInputStream(), 1 << 20), StandardCharsets.UTF_8));
        } finally { c.disconnect(); }
    }

    static byte[] leer(InputStream in, int tope) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream(); byte[] b = new byte[8192]; int n, tot = 0;
            while ((n = i.read(b)) > 0) { tot += n; if (tot > tope) throw new IOException("demasiado grande"); bo.write(b, 0, n); }
            return bo.toByteArray();
        }
    }
    static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(2 * i, 2 * i + 2), 16);
        return b;
    }
    static void borrar(File f) {
        if (f == null || !f.exists()) return;
        File[] L = f.listFiles(); if (L != null) for (File x : L) borrar(x);
        f.delete();
    }
}
