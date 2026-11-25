// Las versiones nuevas de la app nativa (Novedad.java), sin Android: el json de web/nativo.json (lo que acepta y lo que no),
// la comparación con la versión instalada y la bajada desde un servidor local (com.sun.net.httpserver): entera y con la
// huella bien se queda; cortada o cambiada (un byte) se borra.
// uso: javac -d /tmp/x ../../nativo/src/com/jxmod/nativo/Novedad.java PruebaNovedad.java && java -cp /tmp/x PruebaNovedad
import com.jxmod.nativo.Novedad;
import com.sun.net.httpserver.HttpServer;
import java.io.File;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.security.MessageDigest;

public class PruebaNovedad {
    static int fallas = 0;
    static void ok(boolean c, String t) { System.out.println((c ? "OK    " : "FALLA ") + t); if (!c) fallas++; }
    static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x & 255)); return s.toString(); }
    public static void main(String[] a) throws Exception {
        byte[] apk = new byte[300_000]; new java.util.Random(7).nextBytes(apk);
        String sha = hex(MessageDigest.getInstance("SHA-256").digest(apk));
        String json = "{\"codigo\": 26112600, \"version\": \"0.21\", \"apk\": \"jxmod/JXModNativo.apk\", \"tam\": " + apk.length + ", \"sha256\": \"" + sha.toUpperCase() + "\", \"notas_es\": \"Partida en el Wi-Fi\\ny más\", \"notas_en\": \"LAN games\"}";
        Novedad n = Novedad.leer(json, "es");
        ok(n != null && n.codigo == 26112600 && n.version.equals("0.21") && n.tam == apk.length && n.sha256.equals(sha) && n.notas.equals("Partida en el Wi-Fi\ny más"), "lee el json (con la huella en mayúsculas y las notas con salto de línea)");
        ok(Novedad.leer(json, "en").notas.equals("LAN games") && Novedad.leer(json, "pt").notas.startsWith("Partida"), "las notas en el idioma del celular (o en castellano)");
        ok(n.url().equals(Novedad.BASE + "jxmod/JXModNativo.apk"), "baja sólo de la carpeta del repo");
        ok(n.masNuevaQue(26112502) && !n.masNuevaQue(26112600) && !n.masNuevaQue(26200000), "se ofrece sólo si es más nueva que la instalada");
        ok(Novedad.leer(json.replace("jxmod/JXModNativo.apk", "https://otro.com/x.apk"), "es") == null, "un APK de otro lado: no");
        ok(Novedad.leer(json.replace("jxmod/JXModNativo.apk", "jxmod/../x.apk"), "es") == null, "una ruta con «..»: no");
        ok(Novedad.leer(json.replace(sha.toUpperCase(), "abc"), "es") == null, "sin una huella SHA-256: no");
        ok(Novedad.leer(json.replace("\"codigo\": 26112600", "\"codigo\": 0"), "es") == null && Novedad.leer("{}", "es") == null, "sin número o vacío: no");
        // la bajada
        byte[] tocado = apk.clone(); tocado[1234] ^= 1;
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/bien.apk", x -> { x.sendResponseHeaders(200, apk.length); x.getResponseBody().write(apk); x.close(); });
        srv.createContext("/tocado.apk", x -> { x.sendResponseHeaders(200, tocado.length); x.getResponseBody().write(tocado); x.close(); });
        srv.createContext("/cortado.apk", x -> { x.sendResponseHeaders(200, 0); x.getResponseBody().write(apk, 0, 1000); x.close(); });
        srv.createContext("/nada.apk", x -> { x.sendResponseHeaders(404, -1); x.close(); });
        srv.createContext("/web/nativo.json", x -> { byte[] b = json.getBytes("UTF-8"); x.sendResponseHeaders(200, b.length); x.getResponseBody().write(b); x.close(); });
        srv.start(); String base = "http://127.0.0.1:" + srv.getAddress().getPort();
        ok(Novedad.leer(Novedad.pedir(base + "/web/nativo.json"), "es").codigo == 26112600, "pide el json por HTTP");
        File f = File.createTempFile("jxm", ".apk"); long[] ult = { 0 };
        n.bajar(base + "/bien.apk", f, (h, t) -> ult[0] = h);
        ok(f.length() == apk.length && Novedad.sha256(f).equals(sha) && ult[0] == apk.length, "baja entero, con el progreso hasta el final, y la huella coincide");
        for (String r : new String[] { "tocado", "cortado", "nada" }) {
            File g = File.createTempFile("jxm", ".apk"); String err = null;
            try { n.bajar(base + "/" + r + ".apk", g, null); } catch (Exception e) { err = e.getMessage(); }
            ok(err != null && !g.exists(), r + ": no se instala y se borra (" + err + ")");
        }
        srv.stop(0); f.delete();
        System.out.println(fallas == 0 ? "TODO BIEN" : fallas + " FALLAS"); System.exit(fallas == 0 ? 0 : 1);
    }
}
