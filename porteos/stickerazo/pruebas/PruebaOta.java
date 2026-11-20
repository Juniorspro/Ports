import com.stickerazo.app.OtaNucleo;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.security.PublicKey;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/** Las actualizaciones solas, sin teléfono: firmadas con herramientas/ota.py (Python) y revisadas acá (Java), como en el
 *  celular. Baja sólo lo que cambió; una firma o un archivo cambiados no hacen nada; nada de «..»; APK viejo, nada.
 *  uso: java -cp CLASES PruebaOta CARPETA_TEMPORAL RUTA_OTA_PY */
public class PruebaOta {
    static int bien = 0, fallas = 0;
    static final Charset U8 = Charset.forName("UTF-8");
    static void ok(boolean c, String t) { if (c) bien++; else fallas++; System.out.println((c ? "OK    " : "FALLA ") + t); }
    static void escribir(File f, String t) throws Exception { f.getParentFile().mkdirs(); FileOutputStream o = new FileOutputStream(f); o.write(t.getBytes(U8)); o.close(); }
    static String py(File dir, String otaPy, String... args) throws Exception {
        String[] cmd = new String[4 + args.length]; cmd[0] = "python3"; cmd[1] = "-I"; cmd[2] = otaPy; cmd[3] = "--web"; System.arraycopy(args, 0, cmd, 4, args.length);
        ProcessBuilder pb = new ProcessBuilder(cmd); pb.environment().put("STICKERAZO_FIRMA_DIR", new File(dir, "llave").getPath()); pb.redirectErrorStream(true);
        Process p = pb.start(); InputStream in = p.getInputStream(); String s = new String(readAll(in), U8); p.waitFor(); return s.trim();
    }
    static byte[] readAll(InputStream in) throws Exception { java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream(); byte[] t = new byte[8192]; for (int n; (n = in.read(t)) > 0; ) b.write(t, 0, n); return b.toByteArray(); }
    static Map<String, String> huellas(File web) throws Exception {
        Map<String, String> m = new HashMap<String, String>();
        for (String r : new String[] { "app.js", "estilo.css", "fuentes/Letra.ttf", "fuentes/APACHE-2.0.txt", "nuevo.js" }) { File f = new File(web, r); if (f.isFile()) m.put(r, OtaNucleo.sha(Files.readAllBytes(f.toPath()))); }
        return m;
    }

    public static void main(String[] a) throws Exception {
        File dir = new File(a[0]); OtaNucleo.limpiar(dir); dir.mkdirs(); String otaPy = a[1];
        File apk = new File(dir, "apk"), srv = new File(dir, "servidor"), raiz = new File(dir, "ota");
        // lo que trae el APK (versión 1)
        escribir(new File(apk, "app.js"), "console.log('v1')"); escribir(new File(apk, "estilo.css"), "body{}"); escribir(new File(apk, "fuentes/Letra.ttf"), "LETRA"); escribir(new File(apk, "fuentes/APACHE-2.0.txt"), "licencia");
        Map<String, String> base = huellas(apk);
        String[] lin = py(dir, otaPy, apk.getPath(), "--publica").split("\n"); PublicKey pub = OtaNucleo.llavePublica(lin[lin.length - 1]);
        // en GitHub: cambió app.js y hay uno nuevo
        escribir(new File(srv, "app.js"), "console.log('v2')"); escribir(new File(srv, "estilo.css"), "body{}"); escribir(new File(srv, "fuentes/Letra.ttf"), "LETRA"); escribir(new File(srv, "nuevo.js"), "nuevo"); escribir(new File(srv, "fuentes/APACHE-2.0.txt"), "licencia");
        escribir(new File(srv, "terceros/modelo.tflite"), "PESADO"); escribir(new File(srv, "_prueba.html"), "x");
        py(dir, otaPy, srv.getPath());
        byte[] ota2 = Files.readAllBytes(new File(srv, "ota.json").toPath());
        final AtomicInteger bajadas = new AtomicInteger();
        final File[] desde = { srv };
        OtaNucleo.Bajador b = new OtaNucleo.Bajador() { public byte[] bajar(String r) throws java.io.IOException { bajadas.incrementAndGet(); return Files.readAllBytes(new File(desde[0], r).toPath()); } };
        java.util.Map<?, ?> d2 = OtaNucleo.leer(ota2, pub);
        ok(d2 != null && ((Map<?, ?>) d2.get("archivos")).size() == 5 && ((Map<?, ?>) d2.get("archivos")).containsKey("fuentes/APACHE-2.0.txt") && !((Map<?, ?>) d2.get("archivos")).containsKey("terceros/modelo.tflite"), "la firma de ota.py (Python) se verifica en Java; 5 archivos (con «APACHE-2.0.txt»; sin terceros/ ni los de prueba)");
        int n = OtaNucleo.aplicar(raiz, ota2, pub, base, 0, 100, b);
        File act = OtaNucleo.actual(raiz);
        ok(n == 2 && bajadas.get() == 2, "baja sólo lo que cambió: " + n + " de 5 (app.js y nuevo.js)");
        ok(act != null && new String(Files.readAllBytes(OtaNucleo.archivo(act, "app.js").toPath()), U8).equals("console.log('v2')") && OtaNucleo.archivo(act, "estilo.css") == null && OtaNucleo.archivo(act, "nuevo.js") != null,
           "se usa app.js nuevo; estilo.css (igual) sale del APK");
        ok(OtaNucleo.aplicar(raiz, ota2, pub, base, 0, 100, b) == -1, "la misma versión otra vez: nada");
        // versión 3: cambia la letra; app.js queda (no se vuelve a bajar)
        Thread.sleep(1100); escribir(new File(srv, "fuentes/Letra.ttf"), "LETRA 2"); py(dir, otaPy, srv.getPath());
        byte[] ota3 = Files.readAllBytes(new File(srv, "ota.json").toPath()); bajadas.set(0);
        // (pero en el servidor alguien cambió nuevo.js después de firmar: no coincide su huella → no se aplica nada)
        escribir(new File(srv, "nuevo.js"), "nuevo"); File trucho = new File(dir, "trucho"); escribir(new File(trucho, "fuentes/Letra.ttf"), "LETRA MALA"); desde[0] = trucho;
        ok(OtaNucleo.aplicar(raiz, ota3, pub, base, 0, 100, b) == -2 && OtaNucleo.actual(raiz).equals(act), "un archivo que no coincide con su huella: no se aplica nada y queda la versión anterior");
        desde[0] = srv; bajadas.set(0);
        int n3 = OtaNucleo.aplicar(raiz, ota3, pub, base, 0, 100, b); File act3 = OtaNucleo.actual(raiz);
        ok(n3 == 1 && bajadas.get() == 1 && OtaNucleo.archivo(act3, "app.js") != null && new String(Files.readAllBytes(OtaNucleo.archivo(act3, "fuentes/Letra.ttf").toPath()), U8).equals("LETRA 2"),
           "versión 3: baja sólo la letra (" + n3 + "); app.js se copia de la anterior");
        ok(act.isDirectory(), "la versión anterior sigue ahí hasta volver a abrir (la página abierta no mezcla archivos)");
        OtaNucleo.limpiar(raiz); ok(!act.exists() && act3.isDirectory(), "al arrancar se borran las viejas");
        // firma tocada, «..», APK viejo
        String t = new String(ota3, U8).replace("LETRA", "LETRA");
        String tocado = new String(ota3, U8).replaceFirst("\\\\\"apkMin\\\\\":0", "\\\\\"apkMin\\\\\":1");
        ok(OtaNucleo.leer(tocado.getBytes(U8), pub) == null, "los datos tocados después de firmar: firma inválida");
        Thread.sleep(1100); escribir(new File(srv, "app.js"), "console.log('v4')"); py(dir, otaPy, srv.getPath(), "--apk-min", "500");
        ok(OtaNucleo.aplicar(raiz, Files.readAllBytes(new File(srv, "ota.json").toPath()), pub, base, 0, 100, b) == -1 && OtaNucleo.actual(raiz).equals(act3), "una versión que pide un APK más nuevo: no se aplica (hay que actualizar la app)");
        ok(!OtaNucleo.rutaValida("../x.js") && !OtaNucleo.rutaValida("a/../../x.js") && !OtaNucleo.rutaValida("/x.js") && !OtaNucleo.rutaValida(".oculto.js") && !OtaNucleo.rutaValida("a/./x.js") && OtaNucleo.rutaValida("fuentes/Letra.ttf") && OtaNucleo.rutaValida("fuentes/APACHE-2.0.txt"), "rutas con «..», «.», ocultas o desde la raíz: no; con puntos adentro del nombre: sí");
        System.out.println("RESUMEN: " + bien + " bien, " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
