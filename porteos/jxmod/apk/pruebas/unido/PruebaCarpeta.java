import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

// La carpeta de mods sin teléfono (Carpeta.java, lo mismo que usa Web.java): la lista de una carpeta de addons de verdad,
// los rangos, el paquete (los archivos uno atrás del otro, byte por byte igual), un archivo que cambia o se borra entre la
// lista y el paquete, el tope de archivos y el JSON. Con --servir, además, contesta /carpeta/lista y /carpeta/paquete como
// la app (con la misma clase), para que el juego en el navegador lea la carpeta por el mismo camino que en el celular
// (pruebas/gmod_carpeta.mjs).
// uso: javac -d X apk/web/src/com/jxmod/app/Carpeta.java PruebaCarpeta.java && java -cp X PruebaCarpeta CARPETA_C [CARPETA_A]
//      java -cp X PruebaCarpeta --servir PUERTO CARPETA_C CARPETA_A
public class PruebaCarpeta {
    static int ok = 0, mal = 0;
    static void ver(String n, boolean c, String d) { if (c) ok++; else mal++; System.out.println((c ? "OK    " : "FALLA ") + n + (d != null ? " · " + d : "")); }
    static Class<?> C, NODO, RAIZ, ARCH, LISTADO, ARCHIVO;
    static Object archivo(File f) throws Exception { Constructor<?> k = ARCHIVO.getDeclaredConstructor(File.class); k.setAccessible(true); return k.newInstance(f); }
    static Object raiz(String k, String nom, Object nodo) throws Exception { Constructor<?> c = RAIZ.getDeclaredConstructor(String.class, String.class, String.class, NODO); c.setAccessible(true); return c.newInstance(k, nom, "", nodo); }
    static Object listar(int gen, List<Object> R) throws Exception { Method m = C.getDeclaredMethod("listar", int.class, List.class); m.setAccessible(true); return m.invoke(null, gen, R); }
    static String json(Object L) throws Exception { Method m = C.getDeclaredMethod("json", LISTADO); m.setAccessible(true); return (String) m.invoke(null, L); }
    @SuppressWarnings("unchecked") static List<Object> lista(Object L) throws Exception { Field f = LISTADO.getDeclaredField("a"); f.setAccessible(true); return (List<Object>) f.get(L); }
    @SuppressWarnings("unchecked") static List<Object> elegir(Object L, String r) throws Exception { Method m = C.getDeclaredMethod("elegir", LISTADO, String.class); m.setAccessible(true); return (List<Object>) m.invoke(null, L, r); }
    static InputStream paquete(List<Object> l) throws Exception { Method m = C.getDeclaredMethod("paquete", List.class); m.setAccessible(true); return (InputStream) m.invoke(null, l); }
    static long largo(List<Object> l) throws Exception { Method m = C.getDeclaredMethod("largo", List.class); m.setAccessible(true); return (long) m.invoke(null, l); }
    static Object campo(Object o, String n) throws Exception { Field f = o.getClass().getDeclaredField(n); f.setAccessible(true); return f.get(o); }
    static byte[] leer(InputStream in) throws IOException { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[7919]; for (int n; (n = in.read(b)) > 0; ) o.write(b, 0, n); in.close(); return o.toByteArray(); }
    static void cargar() throws Exception {
        C = Class.forName("com.jxmod.app.Carpeta"); NODO = Class.forName("com.jxmod.app.Carpeta$Nodo"); RAIZ = Class.forName("com.jxmod.app.Carpeta$Raiz");
        ARCH = Class.forName("com.jxmod.app.Carpeta$Arch"); LISTADO = Class.forName("com.jxmod.app.Carpeta$Listado"); ARCHIVO = Class.forName("com.jxmod.app.Carpeta$Archivo");
    }
    static int contar(File d) { int n = 0; File[] fs = d.listFiles(); if (fs == null) return 0; for (File f : fs) { if (f.getName().startsWith(".")) continue; n += f.isDirectory() ? contar(f) : 1; } return n; }

    public static void main(String[] a) throws Exception {
        cargar();
        if (a.length > 0 && a[0].equals("--servir")) { servir(Integer.parseInt(a[1]), a[2], a.length > 3 ? a[3] : null); return; }
        File dc = new File(a[0]), da = a.length > 1 ? new File(a[1]) : null;
        List<Object> R = new ArrayList<>(); R.add(raiz("a", "Android/data", da == null ? null : archivo(da))); R.add(raiz("c", dc.getName(), archivo(dc)));
        long t0 = System.nanoTime(); Object L = listar(7, R); long ms = (System.nanoTime() - t0) / 1000000;
        List<Object> A = lista(L);
        int esperados = contar(dc) + (da == null ? 0 : contar(da));
        ver("la lista tiene todos los archivos (sin los ocultos)", A.size() == esperados, A.size() + " de " + esperados + " en " + ms + " ms");
        // (en orden: carpeta por carpeta, por nombre sin importar mayúsculas)
        // (una carpeta que se dejó atrás no vuelve a aparecer: los archivos de un addon van seguidos)
        boolean orden = true; java.util.Set<String> cerradas = new java.util.HashSet<>(); String dirAnt = null;
        for (Object x : A) {
            String ruta = campo(x, "raiz") + ":" + campo(x, "ruta"), dir = ruta.substring(0, ruta.lastIndexOf('/') + 1);
            if (dirAnt != null && !dir.equals(dirAnt)) for (String d = dirAnt; d.contains("/"); d = d.substring(0, d.lastIndexOf('/', d.length() - 2) + 1)) { if (dir.startsWith(d)) break; cerradas.add(d); }
            for (String d : cerradas) if (dir.startsWith(d)) orden = false;
            dirAnt = dir;
        }
        ver("cada carpeta junta: los archivos de un addon van seguidos", orden, cerradas.size() + " carpetas recorridas");
        String j = json(L);
        int n = 0; for (int i = j.indexOf("],["); i >= 0; i = j.indexOf("],[", i + 1)) n++;
        ver("el JSON tiene gen, las dos carpetas y un renglón por archivo", j.startsWith("{\"gen\":7,") && j.contains("\"k\":\"a\"") && j.contains("\"k\":\"c\"") && n + 1 == A.size(), (j.length() / 1024) + " KB");
        // los rangos
        ver("rangos: 0-3,7 da 5 archivos", elegir(L, "0-3,7").size() == 5, null);
        for (String r : new String[] { "5-2", "x", "-1", "0-" + A.size(), "", "3,,4", "0-999999999" }) ver("rangos: «" + r + "» no se deja", elegir(L, r) == null, null);
        // el paquete de todos: igual byte por byte a los archivos uno atrás del otro
        List<Object> todos = elegir(L, "0-" + (A.size() - 1));
        ByteArrayOutputStream esp = new ByteArrayOutputStream();
        for (Object x : todos) { int r = (int) campo(x, "raiz"); esp.write(Files.readAllBytes(new File(r == 0 ? da : dc, (String) campo(x, "ruta")).toPath())); }
        t0 = System.nanoTime(); byte[] p = leer(paquete(todos)); ms = (System.nanoTime() - t0) / 1000000;
        ver("el paquete de todos es igual, byte por byte, a los archivos seguidos", Arrays.equals(p, esp.toByteArray()) && p.length == largo(todos), p.length / 1024 + " KB en " + ms + " ms");
        // un archivo que cambia entre la lista y el paquete: el paquete tiene igual el largo de la lista
        File tmp = Files.createTempDirectory("carpeta").toFile(); File f1 = new File(tmp, "a.bin"), f2 = new File(tmp, "b.bin"), f3 = new File(tmp, "c.bin");
        escribir(f1, 1000, 1); escribir(f2, 1000, 2); escribir(f3, 1000, 3);
        List<Object> R2 = new ArrayList<>(); R2.add(raiz("c", "tmp", archivo(tmp))); Object L2 = listar(1, R2);
        escribir(f1, 600, 9); escribir(f2, 1500, 8); f3.delete();
        byte[] q = leer(paquete(elegir(L2, "0-2")));
        boolean bien = q.length == 3000 && q[0] == 9 && q[599] == 9 && q[600] == 0 && q[999] == 0 && q[1000] == 8 && q[1999] == 8 && q[2000] == 0 && q[2999] == 0;
        ver("si un archivo se achica, se agranda o se borra después de listar, el paquete mantiene los largos (ceros o cortado)", bien, q.length + " bytes");
        f1.delete(); f2.delete(); tmp.delete();
        // el tope de archivos
        Object grande = java.lang.reflect.Proxy.newProxyInstance(NODO.getClassLoader(), new Class<?>[] { NODO }, (o, m, args) -> {
            switch (m.getName()) { case "nombre": return "grande"; case "dir": return true; case "tam": return 0L; case "t": return 0L;
                case "hijos": { List<Object> h = new ArrayList<>(); for (int i = 0; i < 30500; i++) { final int k = i; h.add(java.lang.reflect.Proxy.newProxyInstance(NODO.getClassLoader(), new Class<?>[] { NODO }, (o2, m2, a2) -> {
                    switch (m2.getName()) { case "nombre": return String.format("f%05d.lua", k); case "dir": return false; case "tam": return 1L; case "t": return 0L; default: return null; } })); } return h; }
                default: return null; } });
        List<Object> R3 = new ArrayList<>(); R3.add(raiz("c", "grande", grande)); Object L3 = listar(1, R3);
        ver("con más de 30 000 archivos se corta en 30 000 y lo dice (corto)", lista(L3).size() == 30000 && (boolean) campo(L3, "corto"), lista(L3).size() + "");
        // textos en el JSON
        Method tx = C.getDeclaredMethod("texto", String.class); tx.setAccessible(true);
        String t = (String) tx.invoke(null, "a\"b\\c\n\u0001ñ😀");
        ver("JSON: comillas, barras, saltos y control escapados; ñ y emoji tal cual", t.equals("\"a\\\"b\\\\c\\u000a\\u0001ñ😀\""), t);
        // una carpeta que no se puede leer no rompe la otra
        List<Object> R4 = new ArrayList<>(); R4.add(raiz("a", "no", archivo(new File("/no/existe")))); R4.add(raiz("c", dc.getName(), archivo(dc)));
        Object L4 = listar(2, R4); List<Object> rs = (List<Object>) campo(L4, "raices");
        ver("si una carpeta no se puede leer, queda marcada y la otra se lee igual", !(boolean) campo(rs.get(0), "ok") && (boolean) campo(rs.get(1), "ok") && lista(L4).size() == contar(dc), null);
        System.out.println(ok + " bien, " + mal + " mal");
        System.exit(mal == 0 ? 0 : 1);
    }
    static void escribir(File f, int n, int v) throws IOException { byte[] b = new byte[n]; Arrays.fill(b, (byte) v); try (FileOutputStream o = new FileOutputStream(f)) { o.write(b); } }

    // ---- como Web.carpetaServir, en la compu: /carpeta/lista y /carpeta/paquete?gen=&i= ----
    static volatile Object ult; static int gen = 0;
    static void servir(int puerto, String dc, String da) throws Exception {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", puerto), 0);
        s.createContext("/carpeta/", (x) -> {
            try {
                String p = x.getRequestURI().getPath(); byte[] b; int st = 200; String tipo = "application/json"; InputStream in = null; long largo = -1;
                if (p.equals("/carpeta/lista")) {
                    List<Object> R = new ArrayList<>();
                    R.add(raiz("a", "Android/data/com.jxmod.app/files/addons", da == null ? null : archivo(new File(da))));
                    File c = new File(dc); Object rc = raiz("c", c.getName(), c.isDirectory() ? archivo(c) : null);
                    Field fs = RAIZ.getDeclaredField("sin"); fs.setAccessible(true); fs.set(rc, !c.isDirectory());
                    R.add(rc);
                    Object L; synchronized (PruebaCarpeta.class) { L = listar(++gen, R); ult = L; }
                    b = json(L).getBytes("UTF-8");
                } else if (p.equals("/carpeta/paquete")) {
                    String q = x.getRequestURI().getRawQuery(), g = null, r = null;
                    for (String kv : (q == null ? "" : q).split("&")) { int i = kv.indexOf('='); if (i < 0) continue; String k = kv.substring(0, i), v = URLDecoder.decode(kv.substring(i + 1), "UTF-8"); if (k.equals("gen")) g = v; else if (k.equals("i")) r = v; }
                    Object L = ult; List<Object> l = null;
                    if (L == null || !String.valueOf(campo(L, "gen")).equals(g)) { st = 409; b = new byte[0]; }
                    else if ((l = elegir(L, r)) == null) { st = 400; b = new byte[0]; }
                    else { b = null; in = paquete(l); largo = largo(l); tipo = "application/octet-stream"; }
                } else { st = 404; b = new byte[0]; }
                x.getResponseHeaders().set("Content-Type", tipo); x.getResponseHeaders().set("Access-Control-Allow-Origin", "*"); x.getResponseHeaders().set("Cache-Control", "no-store");
                if (in != null) { x.sendResponseHeaders(200, largo); try (OutputStream o = x.getResponseBody()) { byte[] buf = new byte[65536]; for (int n; (n = in.read(buf)) > 0; ) o.write(buf, 0, n); } }
                else { x.sendResponseHeaders(st, b.length == 0 ? -1 : b.length); try (OutputStream o = x.getResponseBody()) { o.write(b); } }
            } catch (Exception e) { e.printStackTrace(); x.sendResponseHeaders(500, -1); x.close(); }
        });
        s.start();
        System.out.println("carpeta en http://127.0.0.1:" + puerto + "/carpeta/ · c=" + dc + " · a=" + da);
    }
}
