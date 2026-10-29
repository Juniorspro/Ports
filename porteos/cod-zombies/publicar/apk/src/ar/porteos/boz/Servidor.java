package ar.porteos.boz;

import android.content.Context;
import android.content.res.AssetManager;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// HTTP mínimo en 127.0.0.1 con rangos: el sitio sale de assets/sitio y el paquete de texturas (342 MB) del CDN
// oficial, por trozos de 256 KB que quedan guardados en el teléfono (la segunda vez no se baja de nuevo).
final class Servidor {
    private static final String CDN = "http://cdn-boz-android.callofduty.com/PROD/CODBOZ/1_0_8/blackops_dxt.dz";
    private static final String PAQUETE = "/blackops_dxt.dz";
    private static final long TAM_PAQUETE = 341884481L;
    private static final int TROZO = 256 * 1024;
    // puerto fijo: el origen (y con él las partidas guardadas) no cambia entre aperturas
    private static final int PUERTO = 47811;

    private static int puerto = -1;
    private static AssetManager assets;
    private static File dirTrozos;
    private static final Map<Integer, Object> cerrojos = new HashMap<>();
    private static final ExecutorService hilos = Executors.newCachedThreadPool();

    static synchronized int iniciar(Context ctx) {
        if (puerto > 0) return puerto;
        assets = ctx.getAssets();
        dirTrozos = new File(ctx.getFilesDir(), "paquete");
        dirTrozos.mkdirs();
        ServerSocket ss = null;
        for (int p = PUERTO; p < PUERTO + 20 && ss == null; p++) {
            try { ss = new ServerSocket(p, 50, InetAddress.getByName("127.0.0.1")); } catch (IOException e) { ss = null; }
        }
        if (ss == null) throw new RuntimeException("sin puerto local");
        puerto = ss.getLocalPort();
        final ServerSocket srv = ss;
        Thread t = new Thread(() -> {
            while (true) {
                try { final Socket s = srv.accept(); hilos.execute(() -> atender(s)); } catch (IOException e) { /* sigue */ }
            }
        }, "servidor");
        t.setDaemon(true);
        t.start();
        return puerto;
    }

    private static String linea(InputStream in) throws IOException {
        StringBuilder b = new StringBuilder();
        int c;
        while ((c = in.read()) >= 0 && c != '\n') if (c != '\r') b.append((char) c);
        return c < 0 && b.length() == 0 ? null : b.toString();
    }

    private static void atender(Socket s) {
        try {
            s.setTcpNoDelay(true);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();
            String pedido = linea(in);
            if (pedido == null) { s.close(); return; }
            String rango = null, h;
            while ((h = linea(in)) != null && !h.isEmpty()) {
                int i = h.indexOf(':');
                if (i > 0 && h.substring(0, i).trim().equalsIgnoreCase("range")) rango = h.substring(i + 1).trim();
            }
            String[] p = pedido.split(" ");
            String ruta = p.length > 1 ? p[1] : "/";
            int q = ruta.indexOf('?');
            if (q >= 0) ruta = ruta.substring(0, q);
            ruta = URLDecoder.decode(ruta, "UTF-8");
            if (ruta.equals("/")) ruta = "/web.html";
            if (ruta.contains("..")) { responder(out, 404, "text/plain", new byte[0], 0, -1, 0); s.close(); return; }
            if (ruta.equals(PAQUETE)) servirPaquete(out, rango);
            else servirAsset(out, ruta.substring(1), rango);
            out.flush();
        } catch (Exception e) {
            // conexión cortada o trozo que no bajó: el juego reintenta o muestra el error
        }
        try { s.close(); } catch (IOException e) { /* nada */ }
    }

    private static long[] parsearRango(String r, long tam) {
        if (r == null || !r.startsWith("bytes=")) return null;
        String[] x = r.substring(6).split("-", -1);
        long a, b;
        if (x[0].isEmpty()) { a = Math.max(0, tam - Long.parseLong(x[1])); b = tam - 1; }
        else { a = Long.parseLong(x[0]); b = x.length > 1 && !x[1].isEmpty() ? Math.min(Long.parseLong(x[1]), tam - 1) : tam - 1; }
        return a <= b ? new long[]{a, b} : null;
    }

    private static String tipo(String n) {
        if (n.endsWith(".html")) return "text/html; charset=utf-8";
        if (n.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (n.endsWith(".json")) return "application/json";
        if (n.endsWith(".txt")) return "text/plain; charset=utf-8";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }

    private static void cabecera(OutputStream out, int estado, String tipo, long largo, long a, long b, long total) throws IOException {
        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(estado).append(estado == 206 ? " Partial Content" : estado == 200 ? " OK" : " Error").append("\r\n");
        h.append("Content-Type: ").append(tipo).append("\r\nContent-Length: ").append(largo).append("\r\n");
        if (estado == 206) h.append("Content-Range: bytes ").append(a).append('-').append(b).append('/').append(total).append("\r\n");
        h.append("Accept-Ranges: bytes\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n");
        out.write(h.toString().getBytes("ISO-8859-1"));
    }

    private static void responder(OutputStream out, int estado, String tipo, byte[] d, long a, long b, long total) throws IOException {
        int n = estado == 206 ? (int) (b - a + 1) : d.length;
        cabecera(out, estado, tipo, n, a, b, total);
        out.write(d, estado == 206 ? (int) a : 0, n);
    }

    private static void servirAsset(OutputStream out, String nombre, String rango) throws IOException {
        byte[] d;
        try (InputStream in = assets.open("sitio/" + nombre)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int k;
            while ((k = in.read(buf)) > 0) b.write(buf, 0, k);
            d = b.toByteArray();
        } catch (IOException e) {
            byte[] m = "no existe".getBytes("UTF-8");
            cabecera(out, 404, "text/plain", m.length, 0, 0, 0);
            out.write(m);
            return;
        }
        long[] r = parsearRango(rango, d.length);
        if (r != null) responder(out, 206, tipo(nombre), d, r[0], r[1], d.length);
        else responder(out, 200, tipo(nombre), d, 0, d.length - 1, d.length);
    }

    private static void servirPaquete(OutputStream out, String rango) throws IOException {
        long[] r = parsearRango(rango, TAM_PAQUETE);
        if (r == null) r = new long[]{0, Math.min(TAM_PAQUETE, TROZO) - 1}; // sin rango sólo se da el principio
        cabecera(out, 206, "application/octet-stream", r[1] - r[0] + 1, r[0], r[1], TAM_PAQUETE);
        for (int i = (int) (r[0] / TROZO); (long) i * TROZO <= r[1]; i++) {
            byte[] t = trozo(i);
            long ini = Math.max(r[0], (long) i * TROZO), fin = Math.min(r[1], (long) (i + 1) * TROZO - 1);
            out.write(t, (int) (ini - (long) i * TROZO), (int) (fin - ini + 1));
        }
    }

    private static Object cerrojo(int i) {
        synchronized (cerrojos) {
            Object o = cerrojos.get(i);
            if (o == null) { o = new Object(); cerrojos.put(i, o); }
            return o;
        }
    }

    private static byte[] trozo(int i) throws IOException {
        long ini = (long) i * TROZO;
        int largo = (int) Math.min(TROZO, TAM_PAQUETE - ini);
        File f = new File(dirTrozos, i + ".t");
        synchronized (cerrojo(i)) {
            if (f.length() == largo) {
                byte[] d = new byte[largo];
                try (FileInputStream in = new FileInputStream(f)) {
                    int k = 0;
                    while (k < largo) { int n = in.read(d, k, largo - k); if (n < 0) break; k += n; }
                    if (k == largo) return d;
                }
            }
            IOException ultimo = null;
            for (int intento = 0; intento < 4; intento++) {
                try {
                    byte[] d = bajar(ini, largo);
                    File tmp = new File(dirTrozos, i + ".tmp");
                    try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(d); }
                    tmp.renameTo(f);
                    return d;
                } catch (IOException e) {
                    ultimo = e;
                    try { Thread.sleep(500L << intento); } catch (InterruptedException x) { break; }
                }
            }
            throw ultimo != null ? ultimo : new IOException("trozo " + i);
        }
    }

    private static byte[] bajar(long ini, int largo) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(CDN).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("Range", "bytes=" + ini + "-" + (ini + largo - 1));
        try {
            if (c.getResponseCode() != 206) throw new IOException("CDN " + c.getResponseCode());
            byte[] d = new byte[largo];
            try (InputStream in = c.getInputStream()) {
                int k = 0;
                while (k < largo) { int n = in.read(d, k, largo - k); if (n < 0) break; k += n; }
                if (k != largo) throw new IOException("corto " + k);
            }
            return d;
        } finally {
            c.disconnect();
        }
    }
}
