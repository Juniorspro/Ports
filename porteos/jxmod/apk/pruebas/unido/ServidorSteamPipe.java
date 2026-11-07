import com.sun.net.httpserver.HttpServer;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

// Para las pruebas del juego en Chromium (pruebas/mods_sin_tienda.mjs): contesta /red/_steam… con SteamPipe.ruta, lo
// mismo que Web.java en la app. Sólo en 127.0.0.1.
// uso: javac -d X apk/web/src/com/jxmod/app/SteamPipe.java ServidorSteamPipe.java && java -cp X ServidorSteamPipe 8981
public class ServidorSteamPipe {
    public static void main(String[] a) throws Exception {
        Class<?> S = Class.forName("com.jxmod.app.SteamPipe"), R = Class.forName("com.jxmod.app.SteamPipe$Resp");
        Method ruta = S.getDeclaredMethod("ruta", String.class); ruta.setAccessible(true);
        Field fe = R.getDeclaredField("estado"), fc = R.getDeclaredField("cuerpo"); fe.setAccessible(true); fc.setAccessible(true);
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", a.length > 0 ? Integer.parseInt(a[0]) : 8981), 0);
        s.setExecutor(Executors.newFixedThreadPool(8));
        s.createContext("/", ex -> {
            int st = 500; byte[] b = new byte[0];
            try {
                Object r = ruta.invoke(null, ex.getRequestURI().getPath());
                if (r == null) { st = 404; b = "{}".getBytes(StandardCharsets.UTF_8); }
                else { st = fe.getInt(r); b = ((String) fc.get(r)).getBytes(StandardCharsets.UTF_8); }
            } catch (Exception e) { b = ("{\"error\":\"" + e + "\"}").getBytes(StandardCharsets.UTF_8); }
            System.out.println(st + " " + ex.getRequestURI().getPath());
            ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            ex.sendResponseHeaders(st, b.length); ex.getResponseBody().write(b); ex.close();
        });
        s.start();
        System.out.println("listo");
    }
}
