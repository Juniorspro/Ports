package com.jxmod.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * La carpeta de mods (los addons de Garry's Mod desarmados, como en garrysmod/addons de la compu): lo que la app le da al
 * juego en /carpeta/lista (todos los archivos de las carpetas, con su tamaño y su fecha) y en /carpeta/paquete (los
 * archivos de un addon, uno atrás del otro, en un solo pedido; el juego arma el .gma con eso: gmod_carpeta.js). Sin nada
 * de Android: las carpetas son Nodos (en el celular, las del selector del sistema —Web.Doc— y las de java.io.File); así se
 * prueba en la compu (apk/pruebas/unido/PruebaCarpeta.java), con los mismos archivos que tendría el jugador.
 */
final class Carpeta {
    private Carpeta() {}
    /** Tope de archivos y de carpetas adentro de carpetas (alguien que elige una carpeta enorme no traba el juego). */
    static final int MAX_ARCH = 30000, MAX_PROF = 12;

    /** Un archivo o una carpeta. */
    interface Nodo {
        String nombre();
        boolean dir();
        long tam();
        long t();
        List<Nodo> hijos() throws IOException;
        InputStream abrir() throws IOException;
    }

    /** Una carpeta que se lee: «a» (Android/data/…/files/addons) o «c» (la elegida). */
    static final class Raiz {
        final String k, nombre, id; final Nodo nodo; boolean ok = true, sin; String error = "";
        /** nodo null: no se puede leer (sin: no hay ninguna elegida; si no, error dice por qué) */
        Raiz(String k, String nombre, String id, Nodo nodo) { this.k = k; this.nombre = nombre == null ? "" : nombre; this.id = id == null ? "" : id; this.nodo = nodo; }
    }
    static final class Arch {
        final int raiz; final String ruta; final long tam, t; final Nodo nodo;
        Arch(int raiz, String ruta, long tam, long t, Nodo nodo) { this.raiz = raiz; this.ruta = ruta; this.tam = tam; this.t = t; this.nodo = nodo; }
    }
    static final class Listado {
        final int gen; final List<Raiz> raices; final List<Arch> a = new ArrayList<>(); boolean corto;
        Listado(int gen, List<Raiz> raices) { this.gen = gen; this.raices = raices; }
    }

    /** Todos los archivos de las carpetas, en orden (por nombre, sin importar mayúsculas: el mismo orden en todos lados). */
    static Listado listar(int gen, List<Raiz> raices) {
        Listado L = new Listado(gen, raices);
        for (int i = 0; i < raices.size(); i++) {
            Raiz r = raices.get(i);
            if (r.nodo == null) { r.ok = false; continue; }
            try { recorrer(L, i, r.nodo, "", 0); }
            catch (Exception e) { r.ok = false; r.error = String.valueOf(e.getMessage()); }
        }
        return L;
    }
    private static void recorrer(Listado L, int raiz, Nodo d, String pre, int prof) throws IOException {
        if (prof > MAX_PROF) { L.corto = true; return; }
        List<Nodo> h = new ArrayList<>(d.hijos());
        Collections.sort(h, (x, y) -> { int c = x.nombre().compareToIgnoreCase(y.nombre()); return c != 0 ? c : x.nombre().compareTo(y.nombre()); });
        for (Nodo n : h) {
            String nom = n.nombre();
            // (sin los ocultos —.nomedia, .thumbnails, .git— ni nombres raros)
            if (nom == null || nom.isEmpty() || nom.startsWith(".") || nom.contains("/") || nom.contains("\\")) continue;
            String ruta = pre.isEmpty() ? nom : pre + "/" + nom;
            if (n.dir()) recorrer(L, raiz, n, ruta, prof + 1);
            else {
                if (L.a.size() >= MAX_ARCH) { L.corto = true; return; }
                L.a.add(new Arch(raiz, ruta, Math.max(0, n.tam()), n.t(), n));
            }
        }
    }

    /** {"gen":1,"corto":false,"raices":[{"k":"a","nombre":"…","id":"…","ok":true}],"a":[[raiz,"ruta",tam,fecha],…]} */
    static String json(Listado L) {
        StringBuilder b = new StringBuilder(64 + L.a.size() * 64);
        b.append("{\"gen\":").append(L.gen).append(",\"corto\":").append(L.corto).append(",\"raices\":[");
        for (int i = 0; i < L.raices.size(); i++) {
            Raiz r = L.raices.get(i); if (i > 0) b.append(',');
            b.append("{\"k\":").append(texto(r.k)).append(",\"nombre\":").append(texto(r.nombre)).append(",\"id\":").append(texto(r.id))
             .append(",\"ok\":").append(r.ok).append(",\"sin\":").append(r.sin);
            if (!r.error.isEmpty()) b.append(",\"error\":").append(texto(r.error));
            b.append('}');
        }
        b.append("],\"a\":[");
        for (int i = 0; i < L.a.size(); i++) {
            Arch x = L.a.get(i); if (i > 0) b.append(',');
            b.append('[').append(x.raiz).append(',').append(texto(x.ruta)).append(',').append(x.tam).append(',').append(x.t).append(']');
        }
        return b.append("]}").toString();
    }
    static String texto(String s) {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20 || c == 0x2028 || c == 0x2029) b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    /** Los archivos de «0-15,17,20-30» (los números de la lista), en ese orden; null si algo no está o son demasiados. */
    static List<Arch> elegir(Listado L, String rangos) {
        if (L == null || rangos == null || rangos.isEmpty() || rangos.length() > 400000) return null;
        List<Arch> out = new ArrayList<>();
        for (String p : rangos.split(",")) {
            try {
                int g = p.indexOf('-'), a, z;
                if (g > 0) { a = Integer.parseInt(p.substring(0, g)); z = Integer.parseInt(p.substring(g + 1)); } else a = z = Integer.parseInt(p);
                if (a < 0 || z < a || z >= L.a.size() || out.size() + (z - a + 1) > MAX_ARCH) return null;
                for (int i = a; i <= z; i++) out.add(L.a.get(i));
            } catch (NumberFormatException e) { return null; }
        }
        return out;
    }
    static long largo(List<Arch> l) { long n = 0; for (Arch x : l) n += x.tam; return n; }

    /** Los archivos uno atrás del otro, cada uno con el largo de la lista exacto: si cambió desde que se listó, cortado o
     *  completado con ceros (el juego ve que no coincide y lo vuelve a leer). Si uno no se puede abrir, ceros. */
    static InputStream paquete(final List<Arch> l) {
        return new InputStream() {
            int i = -1; InputStream in; long falta;
            private boolean siguiente() throws IOException {
                while (falta <= 0) {
                    cerrar();
                    if (++i >= l.size()) return false;
                    falta = l.get(i).tam;
                    try { in = l.get(i).nodo.abrir(); } catch (Exception e) { in = null; }
                }
                return true;
            }
            private void cerrar() { if (in != null) try { in.close(); } catch (IOException e) { /* nada */ } in = null; }
            @Override public int read() throws IOException { byte[] b = new byte[1]; int n = read(b, 0, 1); return n <= 0 ? -1 : b[0] & 0xff; }
            @Override public int read(byte[] b, int o, int n) throws IOException {
                if (n == 0) return 0;
                if (!siguiente()) return -1;
                int k = (int) Math.min(n, falta), r = -1;
                if (in != null) { try { r = in.read(b, o, k); } catch (IOException e) { r = -1; } }
                if (r <= 0) { cerrar(); java.util.Arrays.fill(b, o, o + k, (byte) 0); r = k; }   // (se acabó antes: ceros hasta su largo)
                falta -= r;
                return r;
            }
            @Override public void close() { cerrar(); i = l.size(); }
        };
    }

    /** Una carpeta o un archivo de java.io.File (Android/data/…/files/addons; y las pruebas en la compu). */
    static final class Archivo implements Nodo {
        final File f;
        Archivo(File f) { this.f = f; }
        public String nombre() { return f.getName(); }
        public boolean dir() { return f.isDirectory(); }
        public long tam() { return f.length(); }
        public long t() { return f.lastModified(); }
        public List<Nodo> hijos() throws IOException {
            File[] fs = f.listFiles(); if (fs == null) throw new IOException("no se puede leer " + f.getName());
            List<Nodo> out = new ArrayList<>(fs.length); for (File x : fs) out.add(new Archivo(x)); return out;
        }
        public InputStream abrir() throws IOException { return new FileInputStream(f); }
    }
}
