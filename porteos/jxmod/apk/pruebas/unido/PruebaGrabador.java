import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

// El puente de guardado del modo grabación sin teléfono (Grabador.java, el mismo que usa Web.java): la página manda el
// video por pedazos en base64 mientras graba y un hilo los escribe en orden, sin tener nunca el video entero en memoria.
//  1. 50 MB por pedazos de 1 MB (como un video de ~1 min en 1080p60), con la memoria de Java limitada (correr con -Xmx24m):
//     el archivo queda en <CARPETA>/Movies/JXMod igual byte por byte (SHA-256), con lo que espera en la cola acotado como
//     lo acota la página (espera si pasa de 8 MB) y el pico de memoria medido;
//  2. un minuto de video de 720p30 (5,3 Mbps, ~40 MB) llegando a su ritmo (acelerado ×20): cuánto tarda en quedar guardado
//     después del último pedazo;
//  3. el parche (la duración en la cabecera) va en su lugar, después de lo anterior;
//  4. el base64 de la página (con y sin «=», los de las direcciones) se decodifica igual que java.util.Base64;
//  5. un error del disco: lo que sigue se rechaza (-1) y al terminar avisa que salió mal; cancelar tira lo que quedaba.
// Con --servir, además, contesta /grab/* como JXNativo.grab* (con la misma clase), para que el juego en el navegador grabe
// por el mismo camino que en el celular (pruebas/grabar.mjs).
// uso: javac -d X apk/web/src/com/jxmod/app/Grabador.java PruebaGrabador.java && java -Xmx24m -cp X PruebaGrabador CARPETA
//      java -cp X PruebaGrabador --servir PUERTO CARPETA
public class PruebaGrabador {
    static int ok = 0, mal = 0;
    static void ver(String n, boolean c, String d) { if (c) ok++; else mal++; System.out.println((c ? "OK    " : "FALLA ") + n + (d != null ? " · " + d : "")); }
    static Class<?> G, SAL, LISTO;
    static Object grabador(Object salida) throws Exception { Constructor<?> k = G.getDeclaredConstructor(SAL); k.setAccessible(true); return k.newInstance(salida); }
    static Object canal(RandomAccessFile f) throws Exception { Method m = G.getDeclaredMethod("canal", java.nio.channels.FileChannel.class, java.io.Closeable[].class); m.setAccessible(true); return m.invoke(null, f.getChannel(), new java.io.Closeable[]{ f }); }
    static long escribir(Object g, String b) throws Exception { Method m = G.getDeclaredMethod("escribir", String.class); m.setAccessible(true); return (long) m.invoke(g, b); }
    static long pendiente(Object g) throws Exception { Method m = G.getDeclaredMethod("pendiente"); m.setAccessible(true); return (long) m.invoke(g); }
    static boolean parche(Object g, long pos, String b) throws Exception { Method m = G.getDeclaredMethod("parche", long.class, String.class); m.setAccessible(true); return (boolean) m.invoke(g, pos, b); }
    static int decodificar(String s, byte[] b) throws Exception { Method m = G.getDeclaredMethod("decodificar", String.class, byte[].class); m.setAccessible(true); return (int) m.invoke(null, s, b); }
    /** terminar o cancelar, y esperar el aviso: [ok, bytes, error] */
    static Object[] fin(Object g, boolean cancelar) throws Exception {
        final Object[] r = new Object[3]; final CountDownLatch c = new CountDownLatch(1);
        Object l = java.lang.reflect.Proxy.newProxyInstance(LISTO.getClassLoader(), new Class<?>[]{ LISTO }, (p, m, a) -> {
            if (m.getName().equals("listo")) { r[0] = a[0]; r[1] = a[1]; r[2] = a[2]; c.countDown(); } return null; });
        Method m = G.getDeclaredMethod(cancelar ? "cancelar" : "terminar", LISTO); m.setAccessible(true); m.invoke(g, l);
        if (!c.await(60, TimeUnit.SECONDS)) throw new IOException("no terminó");
        return r;
    }
    static void cargar() throws Exception {
        G = Class.forName("com.jxmod.app.Grabador"); SAL = Class.forName("com.jxmod.app.Grabador$Salida"); LISTO = Class.forName("com.jxmod.app.Grabador$Listo");
    }
    static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x)); return s.toString(); }
    static File carpeta(File base) { File d = new File(base, "Movies/JXMod"); d.mkdirs(); return d; }

    public static void main(String[] a) throws Exception {
        cargar();
        if (a.length > 0 && a[0].equals("--servir")) { servir(Integer.parseInt(a[1]), new File(a[2])); return; }
        File base = new File(a.length > 0 ? a[0] : "/tmp/jx_grabador"), dir = carpeta(base);
        MemoryMXBean mx = ManagementFactory.getMemoryMXBean();
        System.out.println("memoria de Java: tope " + Runtime.getRuntime().maxMemory() / 1048576 + " MB");

        // ---- 1: 50 MB por pedazos de 1 MB ----
        {
            File f = new File(dir, "JXMod_prueba_50MB.mp4"); f.delete();
            System.gc(); Thread.sleep(200);
            final long base0 = mx.getHeapMemoryUsage().getUsed();
            // (dos medidas: lo usado en cualquier momento —con la basura que el recolector todavía no juntó— y lo que queda vivo
            // después de cada recolección, que es lo que de verdad ocupa la grabación)
            final AtomicLong pico = new AtomicLong(), vivo = new AtomicLong(); final boolean[] seguir = { true };
            final java.util.List<java.lang.management.MemoryPoolMXBean> pools = ManagementFactory.getMemoryPoolMXBeans();
            Thread mira = new Thread(() -> { while (seguir[0]) {
                pico.accumulateAndGet(mx.getHeapMemoryUsage().getUsed(), Math::max);
                long v = 0; for (java.lang.management.MemoryPoolMXBean mp : pools) { java.lang.management.MemoryUsage u = mp.getType() == java.lang.management.MemoryType.HEAP ? mp.getCollectionUsage() : null; if (u != null) v += u.getUsed(); }
                vivo.accumulateAndGet(v, Math::max);
                try { Thread.sleep(2); } catch (InterruptedException e) { return; } } });
            mira.setDaemon(true); mira.start();
            Object g = grabador(canal(new RandomAccessFile(f, "rw")));
            MessageDigest sha = MessageDigest.getInstance("SHA-256"); Random rnd = new Random(7);
            final int PED = 1 << 20, N = 50; long colaMax = 0, esperas = 0; long t0 = System.nanoTime();
            byte[] b = new byte[PED];
            for (int i = 0; i < N; i++) {
                rnd.nextBytes(b); sha.update(b);
                long p = escribir(g, Base64.getEncoder().encodeToString(b));   // (lo que hace la página: FileReader → base64)
                colaMax = Math.max(colaMax, p);
                while (pendiente(g) > 8_000_000) { esperas++; Thread.sleep(2); }   // (la página espera: grabDestApp)
            }
            long tMandado = System.nanoTime();
            Object[] r = fin(g, false);
            long t1 = System.nanoTime(); seguir[0] = false; mira.join();
            byte[] esperado = sha.digest(); MessageDigest s2 = MessageDigest.getInstance("SHA-256");
            try (InputStream in = Files.newInputStream(f.toPath())) { byte[] x = new byte[1 << 16]; for (int n; (n = in.read(x)) > 0; ) s2.update(x, 0, n); }
            boolean igual = MessageDigest.isEqual(esperado, s2.digest());
            double ms = (t1 - t0) / 1e6, mb = (pico.get() - base0) / 1048576.0;
            ver("1. 50 MB por pedazos de 1 MB: el archivo queda en Movies/JXMod, igual byte por byte", (boolean) r[0] && igual && f.length() == (long) PED * N && (long) r[1] == (long) PED * N,
                f.getPath().replace(base.getPath() + "/", "") + " · " + f.length() / 1048576 + " MB · sha256 " + (igual ? "igual" : "DISTINTO") + " · " + Math.round(ms) + " ms (" + Math.round(PED * N / 1048576.0 / (ms / 1000)) + " MB/s, contando armar el base64 de la prueba)");
            double vivoMB = vivo.get() / 1048576.0, tope = Runtime.getRuntime().maxMemory() / 1048576.0;
            ver("1b. memoria acotada: la cola no pasa de 8 MB + un pedazo y lo vivo en Java es mucho menos que el video (que tampoco entra en el tope)", colaMax <= 8_000_000 + PED && vivoMB < 16 && tope < PED * N / 1048576.0,
                "vivo después de cada recolección: hasta " + String.format("%.1f", vivoMB) + " MB · usado con basura: hasta " + String.format("%.1f", pico.get() / 1048576.0) + " MB (" + String.format("%.1f", mb) + " sobre lo de antes) · tope de Java " + Math.round(tope) + " MB para un video de " + PED * N / 1048576 + " MB · cola máxima " + String.format("%.1f", colaMax / 1048576.0) + " MB · la página esperó " + esperas + " veces · después del último pedazo: " + Math.round((t1 - tMandado) / 1e6) + " ms");
        }
        // ---- 2: un minuto de 720p30 a su ritmo (acelerado ×20: un pedazo de 0,5 s cada 25 ms) ----
        {
            File f = new File(dir, "JXMod_prueba_1min.mp4"); f.delete();
            Object g = grabador(canal(new RandomAccessFile(f, "rw")));
            int porSeg = (5_300_000 + 128_000) / 8, ped = porSeg / 2; byte[] b = new byte[ped]; Random rnd = new Random(3); long maxEscr = 0;
            for (int i = 0; i < 120; i++) {
                rnd.nextBytes(b); String s = Base64.getEncoder().encodeToString(b);
                long t = System.nanoTime(); escribir(g, s); maxEscr = Math.max(maxEscr, System.nanoTime() - t);
                Thread.sleep(25);
            }
            long t0 = System.nanoTime(); Object[] r = fin(g, false); long t1 = System.nanoTime();
            ver("2. un minuto de 720p30 (" + f.length() / 1048576 + " MB): guardado al rato de terminar", (boolean) r[0] && f.length() == 120L * ped && (t1 - t0) / 1e6 < 2000,
                Math.round((t1 - t0) / 1e6) + " ms después del último pedazo · cada llamada de la página tarda hasta " + String.format("%.2f", maxEscr / 1e6) + " ms (sólo encola: el disco va en otro hilo)");
        }
        // ---- 3: el parche ----
        {
            File f = new File(dir, "JXMod_prueba_parche.webm"); f.delete();
            Object g = grabador(canal(new RandomAccessFile(f, "rw")));
            byte[] cab = new byte[100]; for (int i = 0; i < 100; i++) cab[i] = (byte) i;
            escribir(g, Base64.getEncoder().encodeToString(cab)); escribir(g, Base64.getEncoder().encodeToString(new byte[5000]));
            byte[] dur = { 0x40, (byte) 0xC3, 0x1A, 0, 0, 0, 0, 0 };
            boolean p = parche(g, 81, Base64.getEncoder().encodeToString(dur));
            Object[] r = fin(g, false); byte[] x = Files.readAllBytes(f.toPath());
            boolean bien = p && (boolean) r[0] && x.length == 5100 && x[80] == 80 && x[81] == 0x40 && x[82] == (byte) 0xC3 && x[88] == 0 && x[89] == 89 && x[5099] == 0;
            ver("3. el parche (la duración) va en su lugar y lo demás queda igual", bien, "largo " + x.length);
        }
        // ---- 4: el base64 ----
        {
            Random rnd = new Random(11); boolean bien = true; int casos = 0;
            for (int n = 0; n < 300; n++) {
                byte[] b = new byte[rnd.nextInt(3000)]; rnd.nextBytes(b);
                for (String s : new String[]{ Base64.getEncoder().encodeToString(b), Base64.getEncoder().withoutPadding().encodeToString(b), Base64.getUrlEncoder().encodeToString(b), Base64.getMimeEncoder().encodeToString(b) }) {
                    byte[] o = new byte[b.length + 4]; int k = decodificar(s, o); casos++;
                    if (k != b.length || !java.util.Arrays.equals(java.util.Arrays.copyOf(o, k), b)) { bien = false; break; }
                }
            }
            boolean malo = false; try { decodificar("ab$d", new byte[8]); } catch (Exception e) { malo = true; }
            ver("4. base64: igual que java.util.Base64 (con y sin «=», de direcciones y con saltos) y rechaza lo que no es", bien && malo, casos + " casos");
        }
        // ---- 5: un error del disco y cancelar ----
        {
            Object salida = java.lang.reflect.Proxy.newProxyInstance(SAL.getClassLoader(), new Class<?>[]{ SAL }, (p, m, x) -> {
                if (m.getName().equals("escribir")) throw new IOException("disco lleno"); return null; });
            Object g = grabador(salida);
            escribir(g, "AAAA"); Thread.sleep(200); long r2 = escribir(g, "AAAA");
            Object[] r = fin(g, false);
            File f = new File(dir, "JXMod_prueba_cancelada.webm"); f.delete();
            Object g2 = grabador(canal(new RandomAccessFile(f, "rw"))); escribir(g2, "AAAA"); Object[] r3 = fin(g2, true);
            ver("5. disco lleno: lo que sigue se rechaza y termina mal; cancelar avisa que no", r2 == -1 && !(boolean) r[0] && String.valueOf(r[2]).contains("disco lleno") && !(boolean) r3[0],
                "después del error: " + r2 + " · " + r[2]);
        }
        System.out.println("RESUMEN " + ok + "/" + (ok + mal));
        System.exit(mal == 0 ? 0 : 1);
    }

    // ---- --servir: lo que la página le pide a JXNativo.grab*, por HTTP (la prueba lo llama con XMLHttpRequest sincrónico,
    // que es como se comporta el puente de la vista web: la página espera la respuesta) ----
    static final Map<Integer, Object> GS = new HashMap<>(); static final Map<Integer, File> FS = new HashMap<>(); static int n = 0;
    static Map<String, String> q(HttpExchange h) throws IOException {
        Map<String, String> m = new HashMap<>(); String s = h.getRequestURI().getRawQuery(); if (s == null) return m;
        for (String p : s.split("&")) { int i = p.indexOf('='); if (i > 0) m.put(p.substring(0, i), URLDecoder.decode(p.substring(i + 1), "UTF-8")); }
        return m;
    }
    static String cuerpo(HttpExchange h) throws IOException { ByteArrayOutputStream o = new ByteArrayOutputStream(); InputStream in = h.getRequestBody(); byte[] b = new byte[1 << 16]; for (int k; (k = in.read(b)) > 0; ) o.write(b, 0, k); return new String(o.toByteArray(), StandardCharsets.US_ASCII); }
    static void responder(HttpExchange h, String s) throws IOException {
        byte[] b = s.getBytes(StandardCharsets.UTF_8); h.getResponseHeaders().set("Access-Control-Allow-Origin", "*"); h.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
        h.sendResponseHeaders(200, b.length); try (OutputStream o = h.getResponseBody()) { o.write(b); }
    }
    static void servir(int puerto, File base) throws Exception {
        File dir = carpeta(base);
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", puerto), 0);
        s.createContext("/grab/", (h) -> {
            try {
                String r = h.getRequestURI().getPath().substring(6); Map<String, String> p = q(h); String out;
                synchronized (GS) {
                    if (r.equals("empezar")) {
                        String nom = p.getOrDefault("nombre", "JXMod.webm").replaceAll("[^A-Za-z0-9_.-]", "_"); File f = new File(dir, nom);
                        RandomAccessFile raf = new RandomAccessFile(f, "rw"); raf.setLength(0);
                        int id = ++n; GS.put(id, grabador(canal(raf))); FS.put(id, f);
                        out = "{\"ok\":true,\"id\":" + id + ",\"ruta\":\"Movies/JXMod/" + nom + "\",\"galeria\":true}";
                    } else {
                        int id = Integer.parseInt(p.getOrDefault("id", "0")); Object g = GS.get(id);
                        if (g == null) out = "-1";
                        else if (r.equals("escribir")) out = String.valueOf(escribir(g, cuerpo(h)));
                        else if (r.equals("pendiente")) out = String.valueOf(pendiente(g));
                        else if (r.equals("parche")) out = String.valueOf(parche(g, Long.parseLong(p.get("pos")), cuerpo(h)));
                        else if (r.equals("fin") || r.equals("cancelar")) {
                            Object[] x = fin(g, r.equals("cancelar")); File f = FS.get(id); GS.remove(id);
                            out = "{\"ok\":" + x[0] + ",\"bytes\":" + x[1] + ",\"nombre\":\"" + f.getName() + "\",\"ruta\":\"Movies/JXMod/" + f.getName() + "\",\"archivo\":\"" + f.getAbsolutePath() + "\",\"uri\":\"\",\"galeria\":true}";
                        } else out = "-1";
                    }
                }
                responder(h, out);
            } catch (Exception e) { e.printStackTrace(); responder(h, "-1"); }
        });
        s.start();
        System.out.println("sirviendo " + puerto + " → " + dir);
    }
}
