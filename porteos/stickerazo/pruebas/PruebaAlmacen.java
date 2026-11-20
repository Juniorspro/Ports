import com.stickerazo.app.Almacen;

import java.io.File;
import java.lang.reflect.Method;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** El almacén de packs y el lector de JSON, sin teléfono: nombres peligrosos, límites, packs mal formados, las filas que
 *  recibe WhatsApp y escribir mientras otro lee (nadie tiene que ver un archivo a medias).
 *  uso: java -cp CLASES PruebaAlmacen CARPETA_TEMPORAL */
public class PruebaAlmacen {
    static int fallas = 0, bien = 0;

    static void ok(boolean c, String que) {
        if (c) bien++; else fallas++;
        System.out.println((c ? "OK    " : "FALLA ") + que);
    }

    static Object json(String s) throws Exception {
        Class<?> c = Class.forName("com.stickerazo.app.Json");
        Method m = c.getDeclaredMethod("leer", String.class);
        m.setAccessible(true);
        try { return m.invoke(null, s); } catch (java.lang.reflect.InvocationTargetException e) { throw (Exception) e.getCause(); }
    }

    static boolean jsonFalla(String s) { try { json(s); return false; } catch (Exception e) { return e instanceof IllegalArgumentException; } }

    public static void main(String[] a) throws Exception {
        File dir = new File(a[0]);
        dir.mkdirs();
        Charset u8 = Charset.forName("UTF-8");

        // ---- JSON ----
        Object o = json("[{\"id\":\"p1\",\"nombre\":\"Mate \\u00e9 \\\"y\\\" \\ud83e\\uddc9\",\"v\":3,\"x\":[true,false,null,-1.5e2],\"e\":{}}]");
        Map<?, ?> m0 = (Map<?, ?>) ((List<?>) o).get(0);
        ok("Mate é \"y\" 🧉".equals(m0.get("nombre")), "JSON: escapes y emoji por \\u (pares sustitutos)");
        ok(Double.valueOf(3).equals(m0.get("v")) && Arrays.asList(true, false, null, -150.0).equals(m0.get("x")), "JSON: números, true/false/null");
        ok("🧉 😂".equals(((Map<?, ?>) ((List<?>) json("[{\"e\":\"🧉 😂\"}]")).get(0)).get("e")), "JSON: emojis sin escapar");
        String hondo = ""; for (int i = 0; i < 100; i++) hondo += "["; for (int i = 0; i < 100; i++) hondo += "]";
        ok(jsonFalla("[1,]") && jsonFalla("{\"a\" 1}") && jsonFalla("[\"sin cerrar]") && jsonFalla("[1] x") && jsonFalla("") && jsonFalla(hondo) && jsonFalla("[\"\\q\"]"),
           "JSON: lo mal formado (coma de más, sin dos puntos, sin cerrar, sobra algo, vacío, 100 niveles, escape raro) falla");

        // ---- nombres ----
        Almacen al = new Almacen(dir);
        String[] packsMal = { "", "..", "../x", "a/b", "a b", "p\u00f1", null, "x".concat(new String(new char[64]).replace('\0', 'x')) };
        String[] archMal = { "", "..", "../s1.webp", "a/s1.webp", "s1.exe", "s1.webp.exe", ".webp", "s 1.webp", null, "s1.WEBP" };
        boolean todosMal = true;
        for (String p : packsMal) todosMal &= !Almacen.idValido(p) && al.archivo(p, "s1.webp") == null && !al.guardarArchivo(p, "s1.webp", new byte[] { 1 });
        for (String n : archMal) todosMal &= !Almacen.archivoValido(n) && al.archivo("p1", n) == null && !al.guardarArchivo("p1", n, new byte[] { 1 });
        ok(todosMal, "nombres peligrosos rechazados (" + (packsMal.length + archMal.length) + "): «..», barras, espacios, extensiones raras, vacíos");
        ok(Almacen.idValido("pmwp7ilhe") && Almacen.archivoValido("s12.webp") && Almacen.archivoValido("bandeja.png"), "nombres de la app aceptados");

        // ---- guardar y leer ----
        ok("[]".equals(al.leerPacks()), "sin nada guardado: lista vacía");
        ok(!al.guardarPacks("{}") && !al.guardarPacks("no") && !al.guardarPacks(null), "la lista tiene que ser una lista JSON");
        byte[] grande = new byte[Almacen.MAX_ARCHIVO + 1];
        ok(!al.guardarArchivo("p1", "s1.webp", grande) && !al.guardarArchivo("p1", "s1.webp", new byte[0]), "archivos vacíos o de más de 512 KB rechazados");
        byte[] w = "RIFF....WEBP".getBytes(u8);
        ok(al.guardarArchivo("p1", "s1.webp", w) && Arrays.equals(w, Files.readAllBytes(al.archivo("p1", "s1.webp").toPath())), "guarda un sticker y se lee igual");
        String lista = "[{\"id\":\"p1\",\"nombre\":\"Mis stickers 🧉\",\"autor\":\"Stickerazo\",\"bandeja\":\"bandeja.png\",\"v\":4,\"stickers\":["
            + "{\"archivo\":\"s1.webp\",\"emojis\":[\"😎\"]},{\"archivo\":\"s2.webp\",\"emojis\":[\"😂\",\"🐶\",\"🔥\",\"💀\"]},{\"archivo\":\"../mal.webp\",\"emojis\":[\"x\"]},{\"archivo\":\"s3.webp\"}]},"
            + "{\"id\":\"../malo\",\"nombre\":\"x\",\"stickers\":[]},{\"id\":\"p2\",\"nombre\":\"  \",\"stickers\":[]},\"no es un pack\"]";
        ok(al.guardarPacks(lista) && lista.equals(al.leerPacks()), "guarda la lista y se lee igual (con emojis)");
        List<Almacen.Pack> ps = al.packs();
        Almacen.Pack p = ps.isEmpty() ? null : ps.get(0);
        ok(ps.size() == 1 && p.id.equals("p1") && p.v == 4 && "bandeja.png".equals(p.bandeja), "packs(): sólo el bien formado (se saltean id con «..», sin nombre y lo que no es pack)");
        ok(p != null && p.stickers.size() == 3 && p.stickers.get(1).emojis.size() == 3 && p.stickers.get(2).emojis.isEmpty(),
           "stickers: se saltea el de nombre peligroso; emojis hasta 3");

        // ---- lo que recibe WhatsApp ----
        Object[] f = Almacen.filaPack(p, "https://play.google.com/store/apps/details?id=com.stickerazo.app", "");
        ok(f.length == Almacen.COLUMNAS_PACK.length && f.length == 13, "fila del pack: 13 columnas como el ejemplo de WhatsApp");
        ok("p1".equals(f[0]) && "Mis stickers 🧉".equals(f[1]) && "Stickerazo".equals(f[2]) && "bandeja.png".equals(f[3]) && "4".equals(f[10])
           && Integer.valueOf(0).equals(f[11]) && Integer.valueOf(0).equals(f[12]), "fila del pack: id, nombre, autor, ícono, versión «4», sin animación");
        Object[] fs = Almacen.filaSticker(p.stickers.get(1));
        ok(fs.length == 3 && "s2.webp".equals(fs[0]) && "😂,🐶,🔥".equals(fs[1]), "fila del sticker: archivo y emojis separados por coma");
        Almacen.Pack largo = new Almacen.Pack();
        largo.id = "p3"; largo.nombre = new String(new char[127]).replace('\0', 'a') + "😂😂";
        String n128 = (String) Almacen.filaPack(largo, "", "")[1];
        ok(n128.length() == 127 && !Character.isHighSurrogate(n128.charAt(n128.length() - 1)), "nombre de más de 128: se corta sin partir un emoji");

        // ---- borrar ----
        ok(al.borrarArchivo("p1", "s1.webp") && !al.archivo("p1", "s1.webp").exists() && al.borrarArchivo("p1", "s9.webp"), "borrar un sticker (y uno que no está: no falla)");
        al.guardarArchivo("p1", "s2.webp", w);
        ok(al.borrarPack("p1") && !new File(dir, "packs/p1").exists() && !al.borrarPack(".."), "borrar un pack entero (y «..» no)");

        // ---- escribir mientras otro lee: siempre una lista entera ----
        final String l1 = lista, l2 = "[{\"id\":\"p9\",\"nombre\":\"" + new String(new char[20000]).replace('\0', 'z') + "\",\"stickers\":[]}]";
        final AtomicInteger malas = new AtomicInteger(), lecturas = new AtomicInteger();
        final Almacen al2 = new Almacen(dir);
        Thread escritor = new Thread(new Runnable() { public void run() { for (int i = 0; i < 400; i++) al2.guardarPacks(i % 2 == 0 ? l1 : l2); } });
        Thread lector = new Thread(new Runnable() {
            public void run() {
                while (lecturas.get() < 4000) {
                    String s = al2.leerPacks();
                    lecturas.incrementAndGet();
                    if (!s.equals(l1) && !s.equals(l2) && !s.equals("[]")) malas.incrementAndGet();
                }
            }
        });
        escritor.start(); lector.start(); escritor.join(); lector.join();
        ok(malas.get() == 0, "400 escrituras con 4000 lecturas a la vez: " + malas.get() + " lecturas a medias");
        File[] sobras = new File(dir, "packs").listFiles();
        ok(!new File(dir, "packs.json.tmp").exists(), "no quedan temporales");

        System.out.println("RESUMEN: " + bien + " bien, " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
