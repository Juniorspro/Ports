import com.sun.net.httpserver.HttpServer;
import java.io.File;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import com.stickerazo.app.ApkBajada;

/** La bajada del APK nuevo (ApkBajada) contra un servidor de mentira: sólo acepta el archivo con el tamaño y la huella
 *  firmados; si una fuente falla, prueba la siguiente. uso: java PruebaApkBajada CARPETA */
public class PruebaApkBajada {
    static int bien, fallas;
    static void ok(boolean c, String t) { System.out.println((c ? "OK    " : "FALLA ") + t); if (c) bien++; else fallas++; }

    public static void main(String[] a) throws Exception {
        File dir = new File(a[0]); dir.mkdirs();
        final byte[] apk = new byte[3 * 1024 * 1024 + 123]; new Random(7).nextBytes(apk);
        final byte[] otro = apk.clone(); otro[1000] ^= 1;
        String huella = ApkBajada.hex(MessageDigest.getInstance("SHA-256").digest(apk));
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s.createContext("/bueno", x -> { x.sendResponseHeaders(200, apk.length); OutputStream o = x.getResponseBody(); o.write(apk); o.close(); });
        s.createContext("/cambiado", x -> { x.sendResponseHeaders(200, otro.length); OutputStream o = x.getResponseBody(); o.write(otro); o.close(); });
        s.createContext("/cortado", x -> { x.sendResponseHeaders(200, 0); OutputStream o = x.getResponseBody(); o.write(apk, 0, apk.length / 2); o.close(); });
        s.createContext("/de_mas", x -> { x.sendResponseHeaders(200, 0); OutputStream o = x.getResponseBody(); o.write(apk); o.write(apk, 0, 50); o.close(); });
        s.createContext("/no", x -> { x.sendResponseHeaders(404, -1); x.close(); });
        s.start();
        String b = "http://127.0.0.1:" + s.getAddress().getPort();
        File f = new File(dir, "actualizacion.apk");
        final List<Integer> avance = new ArrayList<>();
        boolean r = ApkBajada.bajar(new String[] { b + "/bueno" }, f, apk.length, huella, avance::add);
        ok(r && f.length() == apk.length && java.util.Arrays.equals(Files.readAllBytes(f.toPath()), apk), "el APK bueno se baja entero (" + apk.length + " bytes)");
        ok(!avance.isEmpty() && avance.get(avance.size() - 1) == 100 && avance.size() <= 101, "avisa el avance de 0 a 100 (" + avance.size() + " avisos)");
        ok(!ApkBajada.bajar(new String[] { b + "/cambiado" }, f, apk.length, huella, null) && !f.exists(), "uno cambiado en el camino (un bit): no se acepta y se borra");
        ok(!ApkBajada.bajar(new String[] { b + "/cortado" }, f, apk.length, huella, null), "uno cortado a la mitad: no");
        ok(!ApkBajada.bajar(new String[] { b + "/de_mas" }, f, apk.length, huella, null), "uno más largo de lo que dice: no");
        ok(ApkBajada.bajar(new String[] { b + "/no", "http://127.0.0.1:1/nada", b + "/bueno" }, f, apk.length, huella, null), "si la primera fuente no está, prueba la siguiente");
        ok(!ApkBajada.bajar(new String[] { b + "/bueno" }, f, apk.length, "zz", null) && !ApkBajada.bajar(new String[] { b + "/bueno" }, f, 0, huella, null),
           "sin huella válida o sin tamaño: no baja nada");
        s.stop(0);
        System.out.println("RESUMEN: " + bien + " bien, " + fallas + " fallas");
        if (fallas > 0) System.exit(1);
    }
}
