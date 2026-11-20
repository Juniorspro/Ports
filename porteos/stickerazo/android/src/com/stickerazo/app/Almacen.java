package com.stickerazo.app;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/** Los packs y sus archivos, en la memoria de la app (Java puro: se prueba sin teléfono).
 *  <ul><li>{@code packs.json}: la lista que escribe la página (puente.js).</li>
 *  <li>{@code packs/<id>/<archivo>}: los stickers (WebP) y el ícono (PNG).</li></ul>
 *  Lo usan el puente (la página guarda y lee) y el proveedor de WhatsApp (lee), cada uno desde su hilo: todo pasa por
 *  un cerrojo y cada archivo se escribe aparte y se cambia de nombre al final, así nadie lee uno a medio escribir.
 *  Los nombres se validan (sin «..» ni barras): de la página sólo pueden venir nombres de pack y de archivo simples. */
public final class Almacen {
    private static final Charset UTF8 = Charset.forName("UTF-8");
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Pattern ARCHIVO = Pattern.compile("[A-Za-z0-9_-]{1,60}\\.(webp|png)");
    /** un sticker pesa 100 KB como mucho (animado: 500 KB), el ícono 50 KB y las imágenes del proyecto 480 KB; con margen */
    public static final int MAX_ARCHIVO = 512 * 1024, MAX_LISTA = 4 * 1024 * 1024;
    /** lo que WhatsApp muestra del pack: dónde bajar la app y la política de privacidad (cuando esté publicada) */
    public static final String TIENDA = "https://play.google.com/store/apps/details?id=com.stickerazo.app", POLITICA = "";
    private static final Object CERROJO = new Object();
    private final File carpeta, lista;

    public Almacen(File raiz) {
        carpeta = new File(raiz, "packs");
        lista = new File(raiz, "packs.json");
    }

    public static boolean idValido(String s) { return s != null && ID.matcher(s).matches(); }
    public static boolean archivoValido(String s) { return s != null && ARCHIVO.matcher(s).matches(); }

    /** el archivo de un pack, o null si el nombre no es válido */
    public File archivo(String pack, String nombre) {
        return idValido(pack) && archivoValido(nombre) ? new File(new File(carpeta, pack), nombre) : null;
    }

    public String leerPacks() {
        synchronized (CERROJO) {
            try { return lista.isFile() ? new String(leer(lista), UTF8) : "[]"; } catch (IOException e) { return "[]"; }
        }
    }

    /** guarda la lista entera (tiene que ser una lista JSON) */
    public boolean guardarPacks(String json) {
        if (json == null || json.length() > MAX_LISTA) return false;
        try { if (!(Json.leer(json) instanceof List)) return false; } catch (IllegalArgumentException e) { return false; }
        synchronized (CERROJO) { return escribir(lista, json.getBytes(UTF8)); }
    }

    public boolean guardarArchivo(String pack, String nombre, byte[] datos) {
        File f = archivo(pack, nombre);
        if (f == null || datos == null || datos.length == 0 || datos.length > MAX_ARCHIVO) return false;
        synchronized (CERROJO) {
            File d = f.getParentFile();
            if (!d.isDirectory() && !d.mkdirs()) return false;
            return escribir(f, datos);
        }
    }

    public boolean borrarArchivo(String pack, String nombre) {
        File f = archivo(pack, nombre);
        if (f == null) return false;
        synchronized (CERROJO) { return !f.exists() || f.delete(); }
    }

    public boolean borrarPack(String pack) {
        if (!idValido(pack)) return false;
        synchronized (CERROJO) {
            File d = new File(carpeta, pack);
            File[] fs = d.listFiles();
            if (fs != null) for (File f : fs) f.delete();
            return !d.exists() || d.delete();
        }
    }

    // ---- los packs, leídos de la lista (los mal formados se saltean) ----
    public static final class Pack {
        public String id, nombre, autor, bandeja;
        public long v;
        /** WhatsApp no mezcla: un pack es todo animado o todo quieto */
        public boolean animado;
        public final List<Sticker> stickers = new ArrayList<Sticker>();
    }

    public static final class Sticker {
        public String archivo;
        public final List<String> emojis = new ArrayList<String>();
    }

    public List<Pack> packs() {
        List<Pack> r = new ArrayList<Pack>();
        Object o;
        try { o = Json.leer(leerPacks()); } catch (IllegalArgumentException e) { return r; }
        if (!(o instanceof List)) return r;
        for (Object x : (List<?>) o) {
            if (!(x instanceof Map)) continue;
            Map<?, ?> m = (Map<?, ?>) x;
            Pack p = new Pack();
            p.id = texto(m.get("id"));
            p.nombre = texto(m.get("nombre"));
            p.autor = texto(m.get("autor"));
            p.bandeja = texto(m.get("bandeja"));
            p.v = m.get("v") instanceof Double ? ((Double) m.get("v")).longValue() : 0;
            p.animado = Boolean.TRUE.equals(m.get("animado"));
            if (!idValido(p.id) || p.nombre == null || p.nombre.trim().isEmpty()) continue;
            if (!archivoValido(p.bandeja)) p.bandeja = null;
            if (m.get("stickers") instanceof List) for (Object y : (List<?>) m.get("stickers")) {
                if (!(y instanceof Map)) continue;
                Sticker s = new Sticker();
                s.archivo = texto(((Map<?, ?>) y).get("archivo"));
                if (!archivoValido(s.archivo)) continue;
                Object em = ((Map<?, ?>) y).get("emojis");
                if (em instanceof List) for (Object e : (List<?>) em) if (e instanceof String && !((String) e).isEmpty() && s.emojis.size() < 3) s.emojis.add((String) e);
                p.stickers.add(s);
            }
            r.add(p);
        }
        return r;
    }

    public Pack pack(String id) {
        for (Pack p : packs()) if (p.id.equals(id)) return p;
        return null;
    }

    // ---- lo que le contesta a WhatsApp: el contrato de su proveedor de stickers (el del ejemplo oficial) ----
    public static final String[] COLUMNAS_PACK = {
        "sticker_pack_identifier", "sticker_pack_name", "sticker_pack_publisher", "sticker_pack_icon",
        "android_play_store_link", "ios_app_download_link", "sticker_pack_publisher_email", "sticker_pack_publisher_website",
        "sticker_pack_privacy_policy_website", "sticker_pack_license_agreement_website", "image_data_version",
        "whatsapp_will_not_cache_stickers", "animated_sticker_pack",
    };
    public static final String[] COLUMNAS_STICKER = { "sticker_file_name", "sticker_emoji", "sticker_accessibility_text" };

    /** una fila de «metadata»: (WhatsApp pide nombre y autor de 128 caracteres como mucho) */
    public static Object[] filaPack(Pack p, String enlaceTienda, String politica) {
        return new Object[] {
            p.id, corto(p.nombre, 128), corto(p.autor == null || p.autor.trim().isEmpty() ? "Stickerazo" : p.autor, 128), p.bandeja == null ? "" : p.bandeja,
            enlaceTienda, "", "", "", politica, "", String.valueOf(p.v), 0, p.animado ? 1 : 0,
        };
    }

    /** una fila de «stickers»: los emojis van separados por comas */
    public static Object[] filaSticker(Sticker s) {
        StringBuilder e = new StringBuilder();
        for (String x : s.emojis) { if (e.length() > 0) e.append(','); e.append(x); }
        return new Object[] { s.archivo, e.toString(), "" };
    }

    // ---- archivos ----
    private static String texto(Object o) { return o instanceof String ? (String) o : null; }

    private static String corto(String s, int max) {
        if (s.length() <= max) return s;
        int k = max;
        if (Character.isHighSurrogate(s.charAt(k - 1))) k--;   // (sin partir un emoji al medio)
        return s.substring(0, k);
    }

    static byte[] leer(File f) throws IOException {
        InputStream in = new FileInputStream(f);
        try {
            ByteArrayOutputStream b = new ByteArrayOutputStream((int) Math.max(16, f.length()));
            byte[] t = new byte[16384];
            for (int n; (n = in.read(t)) > 0; ) b.write(t, 0, n);
            return b.toByteArray();
        } finally { in.close(); }
    }

    /** escribe aparte y después cambia el nombre: el que lee ve el archivo viejo o el nuevo, nunca uno a medias */
    private static boolean escribir(File f, byte[] datos) {
        File t = new File(f.getPath() + ".tmp");
        try {
            FileOutputStream o = new FileOutputStream(t);
            try { o.write(datos); o.getFD().sync(); } finally { o.close(); }
            if (t.renameTo(f)) return true;
            // (por si el sistema no reemplaza al cambiar el nombre)
            return f.delete() && t.renameTo(f);
        } catch (IOException e) {
            t.delete();
            return false;
        }
    }
}
