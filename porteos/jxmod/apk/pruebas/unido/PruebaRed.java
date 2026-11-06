import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;

// Lo que la app pide por su cuenta (Red.java): adónde deja ir cada pedido y que los sitios contesten de verdad
// (la búsqueda de YouTube con su página de resultados y un manifiesto de Steam por la misma ruta que usa el juego).
// uso: javac -d X apk/web/src/com/jxmod/app/Red.java PruebaRed.java && java -cp X PruebaRed [--red]
public class PruebaRed {
    static int ok = 0, mal = 0;
    static void ver(String n, boolean c, String d) { if (c) ok++; else mal++; System.out.println((c ? "OK    " : "FALLA ") + n + (d != null ? " · " + d : "")); }
    public static void main(String[] a) throws Exception {
        Class<?> R = Class.forName("com.jxmod.app.Red");
        Method m = R.getDeclaredMethod("destino", String.class, String.class); m.setAccessible(true);
        String[][] si = {
            { "/red/cache1-lax1.steamcontent.com/depot/4000/chunk/0123456789abcdef0123456789abcdef01234567", null, "https://cache1-lax1.steamcontent.com/depot/4000/chunk/0123456789abcdef0123456789abcdef01234567" },
            { "/red/www.youtube.com/results", "sp=EgIQAQ%253D%253D&search_query=m%C3%BAsica", "https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=m%C3%BAsica" },
            { "/red/de1.api.radio-browser.info/json/url/96062a7b-0601-11e8-ae97-52543be04c81", null, "https://de1.api.radio-browser.info/json/url/96062a7b-0601-11e8-ae97-52543be04c81" },
        };
        for (String[] x : si) { String d = (String) m.invoke(null, x[0], x[1]); ver("deja " + x[0].substring(0, Math.min(60, x[0].length())), x[2].equals(d), d); }
        String[][] no = {
            { "/red/evil.com/x", null }, { "/red/www.youtube.com/watch", "v=1" }, { "/red/steamcontent.com.evil.com/a", null },
            { "/red/cache1.steamcontent.com/../../x", null }, { "/red/cache1.steamcontent.com/%2e%2e/x", null }, { "/red/user@cache1.steamcontent.com/x", null },
            { "/red/a.steamcontent.com:8080/x", null }, { "/red/", null }, { "/redx/a", null }, { "/red/www.youtube.com/results/../watch", null },
            { "/red/cache1.steamcontent.com%2Fevil.com/x", null }, { "/red/www.google.com/search", "q=1" },
        };
        for (String[] x : no) ver("no deja " + x[0], m.invoke(null, x[0], x[1]) == null, null);
        if (a.length > 0 && a[0].equals("--red")) {
            // YouTube como la pide la app
            String d = (String) m.invoke(null, "/red/www.youtube.com/results", "sp=EgIQAQ%253D%253D&search_query=musica%20para%20jugar");
            HttpURLConnection c = (HttpURLConnection) new URL(d).openConnection();
            java.lang.reflect.Field fu = R.getDeclaredField("UA_PC"); fu.setAccessible(true); c.setRequestProperty("User-Agent", (String) fu.get(null)); c.setRequestProperty("Accept-Language", "es-419,es;q=0.9,en;q=0.8"); c.setRequestProperty("Cookie", "CONSENT=YES+1; SOCS=CAI");
            int st = c.getResponseCode(); String h = new String(leer(c.getInputStream()), "UTF-8");
            int n = 0; for (int i = h.indexOf("\"videoRenderer\""); i >= 0; i = h.indexOf("\"videoRenderer\"", i + 1)) n++;
            ver("YouTube contesta la búsqueda con resultados (ytInitialData y videos)", st == 200 && h.contains("ytInitialData = ") && n >= 5, "HTTP " + st + ", " + n + " videos, " + h.length() / 1024 + " kB");
            // Radio Browser
            HttpURLConnection r = (HttpURLConnection) new URL((String) m.invoke(null, "/red/de1.api.radio-browser.info/json/stations/search", "name=rock&limit=3")).openConnection();
            r.setRequestProperty("User-Agent", "JXMod/3.0 (Android)");
            String j = new String(leer(r.getInputStream()), "UTF-8");
            ver("Radio Browser contesta", r.getResponseCode() == 200 && j.contains("stationuuid"), j.length() + " bytes");
        }
        System.out.println("RESUMEN " + ok + "/" + (ok + mal));
        System.exit(mal == 0 ? 0 : 1);
    }
    static byte[] leer(InputStream in) throws Exception { ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] b = new byte[65536]; int k; while ((k = in.read(b)) > 0) o.write(b, 0, k); return o.toByteArray(); }
}
