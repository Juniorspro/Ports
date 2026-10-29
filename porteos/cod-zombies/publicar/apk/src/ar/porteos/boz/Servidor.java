package ar.porteos.boz;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;

import org.tukaani.xz.LZMA2InputStream;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.channels.FileChannel;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// HTTP mínimo en 127.0.0.1 con rangos. Cada archivo se busca en: parche/ (motor actualizado sin reinstalar) →
// assets/sitio → datos/ (copia de los datos del APK completo, para que un APK liviano posterior siga andando).
// El paquete de texturas (342 MB) viene en el APK completo comprimido por bloques (bloques.py, LZMA2): se extrae al
// teléfono en trozos de 256 KB (a pedido y en segundo plano); lo que falte, se baja del CDN.
final class Servidor {
    private static final String CDN = "http://cdn-boz-android.callofduty.com/PROD/CODBOZ/1_0_8/blackops_dxt.dz";
    private static final String PAQUETE = "/blackops_dxt.dz";
    private static final long TAM_PAQUETE = 341884481L;
    private static final int TROZO = 256 * 1024;
    private static final int TOTAL_TROZOS = (int) ((TAM_PAQUETE + TROZO - 1) / TROZO);
    // puerto fijo: el origen (y con él las partidas guardadas) no cambia entre aperturas
    private static final int PUERTO = 47811;

    private static int puerto = -1;
    private static AssetManager assets;
    private static File dirTrozos, dirDatos, dirParche;
    private static final Map<Integer, Object> cerrojos = new HashMap<>();
    private static final ExecutorService hilos = Executors.newCachedThreadPool();
    private static final AtomicInteger extraidos = new AtomicInteger();
    private static volatile String ultimoError = "";

    // paquete por bloques dentro del APK. El AssetFileDescriptor y el stream quedan referenciados: si el recolector
    // los junta, Android cierra el descriptor y las lecturas del canal fallan.
    private static AssetFileDescriptor afdBloques;
    private static FileInputStream fisBloques;
    private static FileChannel canal;
    private static long baseDatos, tamBloque;
    private static long[] desp;
    private static final Object extrayendo = new Object();   // de a un bloque por vez: acota la memoria

    static synchronized int iniciar(Context ctx) {
        if (puerto > 0) return puerto;
        assets = ctx.getAssets();
        dirTrozos = new File(ctx.getFilesDir(), "paquete");
        dirDatos = new File(ctx.getFilesDir(), "datos");
        dirParche = new File(ctx.getFilesDir(), "parche");
        dirTrozos.mkdirs();
        dirDatos.mkdirs();
        dirParche.mkdirs();
        String[] ya = dirTrozos.list();
        int n = 0;
        if (ya != null) for (String s : ya) if (s.endsWith(".t")) n++;
        extraidos.set(n);
        abrirBloques();
        Thread fondo = new Thread(() -> {
            try { Thread.sleep(15000); } catch (InterruptedException e) { return; }
            copiarDatos("sitio", dirDatos);
            if (canal == null) return;
            for (int b = 0; b < desp.length - 1; b++) {
                try { extraer(b, -1); } catch (Throwable e) { ultimoError = "fondo: " + e; }
            }
        }, "extraer");
        fondo.setPriority(Thread.MIN_PRIORITY);
        fondo.setDaemon(true);
        fondo.start();
        ServerSocket ss = null;
        for (int p = PUERTO; p < PUERTO + 20 && ss == null; p++) {
            try {
                ss = new ServerSocket();
                ss.setReuseAddress(true); // al reabrir enseguida el puerto puede seguir "ocupado" un rato
                ss.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), p), 50);
            } catch (IOException e) { ss = null; }
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

    // ---------- parches: zip con archivos del motor (.js/.html/.json/.txt) que pisan a los del APK ----------
    static int aplicarParche(InputStream zip) throws IOException {
        int n = 0;
        try (ZipInputStream z = new ZipInputStream(new BufferedInputStream(zip))) {
            ZipEntry e;
            byte[] buf = new byte[65536];
            while ((e = z.getNextEntry()) != null) {
                String nom = e.getName();
                nom = nom.substring(nom.lastIndexOf('/') + 1);
                if (e.isDirectory() || !nom.matches("[A-Za-z0-9_.-]+\\.(js|html|json|txt)")) continue;
                File tmp = new File(dirParche, nom + ".tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) { int k; while ((k = z.read(buf)) > 0) o.write(buf, 0, k); }
                if (!tmp.renameTo(new File(dirParche, nom))) throw new IOException("no se pudo guardar " + nom);
                n++;
            }
        }
        return n;
    }

    // un APK nuevo trae su propio motor: los parches anteriores se descartan
    static void borrarParche(Context ctx) {
        File[] l = new File(ctx.getFilesDir(), "parche").listFiles();
        if (l != null) for (File f : l) f.delete();
    }

    private static void copiarDatos(String dir, File destino) {
        try {
            String[] l = assets.list(dir);
            if (l == null) return;
            for (String n : l) {
                String a = dir + "/" + n;
                String[] sub = assets.list(a);
                if (sub != null && sub.length > 0) { File d = new File(destino, n); d.mkdirs(); copiarDatos(a, d); continue; }
                if (n.endsWith(".bloques") || n.endsWith(".js") || n.endsWith(".html")) continue;
                File f = new File(destino, n);
                if (f.exists()) continue;
                File tmp = new File(destino, n + ".tmp");
                try (InputStream in = assets.open(a); FileOutputStream o = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[65536];
                    int k;
                    while ((k = in.read(buf)) > 0) o.write(buf, 0, k);
                }
                tmp.renameTo(f);
            }
        } catch (IOException e) {
            ultimoError = "datos: " + e;
        }
    }

    // ---------- paquete ----------
    private static synchronized void abrirBloques() {
        try {
            AssetFileDescriptor afd = assets.openFd("sitio/blackops_dxt.dz.bloques");
            FileInputStream fis = new FileInputStream(afd.getFileDescriptor());
            FileChannel c = fis.getChannel();
            long ini = afd.getStartOffset();
            ByteBuffer h = ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN);
            leerEn(c, h, ini);
            h.flip();
            if (h.getInt() != 0x425a4f42) return; // "BOZB"
            h.getInt();
            long tam = h.getLong();
            long bloque = h.getInt() & 0xffffffffL;
            int n = h.getInt();
            ByteBuffer t = ByteBuffer.allocate(8 * (n + 1)).order(ByteOrder.LITTLE_ENDIAN);
            leerEn(c, t, ini + 24);
            t.flip();
            long[] d = new long[n + 1];
            for (int i = 0; i <= n; i++) d[i] = t.getLong();
            if (tam != TAM_PAQUETE) return;
            afdBloques = afd;
            fisBloques = fis;
            tamBloque = bloque;
            desp = d;
            baseDatos = ini + 24 + 8L * (n + 1);
            canal = c;
        } catch (IOException e) {
            canal = null; // APK liviano: sin paquete adentro
        }
    }

    private static void leerEn(FileChannel c, ByteBuffer b, long pos) throws IOException {
        while (b.hasRemaining()) { int k = c.read(b, pos + b.position()); if (k < 0) throw new IOException("fin del archivo de bloques"); }
    }

    private static boolean hayTrozo(int i) {
        long largo = Math.min(TROZO, TAM_PAQUETE - (long) i * TROZO);
        return new File(dirTrozos, i + ".t").length() == largo;
    }

    private static void guardarTrozo(int i, byte[] d, int off, int n) throws IOException {
        if (hayTrozo(i)) return;
        File tmp = new File(dirTrozos, i + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(d, off, n); }
        if (tmp.renameTo(new File(dirTrozos, i + ".t"))) extraidos.incrementAndGet();
    }

    // descomprime el bloque b y guarda sus trozos; devuelve el trozo pedido (o null si pedido < 0)
    private static byte[] extraer(int b, int pedido) throws IOException {
        synchronized (extrayendo) {
            int porBloque = (int) (tamBloque / TROZO), primero = b * porBloque;
            int ultimo = Math.min(primero + porBloque, TOTAL_TROZOS) - 1;
            boolean todo = true;
            for (int i = primero; i <= ultimo && todo; i++) todo = hayTrozo(i);
            if (todo) return pedido < 0 ? null : leerTrozo(pedido);
            ByteBuffer cb = ByteBuffer.allocate((int) (desp[b + 1] - desp[b]));
            try {
                leerEn(canal, cb, baseDatos + desp[b]);
            } catch (IOException e) { // descriptor cerrado: se reabre una vez
                abrirBloques();
                if (canal == null) throw e;
                cb.clear();
                leerEn(canal, cb, baseDatos + desp[b]);
            }
            int largo = (int) Math.min(tamBloque, TAM_PAQUETE - (long) b * tamBloque);
            byte[] res = null, t = new byte[TROZO];
            // se descomprime de a un trozo (no hace falta tener los 32 MB en memoria)
            try (InputStream in = new LZMA2InputStream(new ByteArrayInputStream(cb.array()), (int) Math.max(tamBloque, 65536))) {
                for (int i = primero; i <= ultimo; i++) {
                    int n = Math.min(TROZO, largo - (i - primero) * TROZO), k = 0;
                    while (k < n) { int r = in.read(t, k, n - k); if (r < 0) throw new IOException("bloque " + b + " incompleto"); k += r; }
                    if (i == pedido) { res = new byte[n]; System.arraycopy(t, 0, res, 0, n); }
                    guardarTrozo(i, t, 0, n);
                }
            }
            return res;
        }
    }

    private static byte[] leerTrozo(int i) throws IOException {
        int largo = (int) Math.min(TROZO, TAM_PAQUETE - (long) i * TROZO);
        byte[] d = new byte[largo];
        try (FileInputStream in = new FileInputStream(new File(dirTrozos, i + ".t"))) {
            int k = 0;
            while (k < largo) { int n = in.read(d, k, largo - k); if (n < 0) break; k += n; }
            if (k != largo) throw new IOException("trozo corto " + i);
        }
        return d;
    }

    private static Object cerrojo(int i) {
        synchronized (cerrojos) {
            Object o = cerrojos.get(i);
            if (o == null) { o = new Object(); cerrojos.put(i, o); }
            return o;
        }
    }

    private static byte[] trozo(int i) throws IOException {
        if (hayTrozo(i)) {
            try { return leerTrozo(i); } catch (IOException e) { ultimoError = "leer: " + e; }
        }
        if (canal != null) {
            try { return extraer((int) ((long) i * TROZO / tamBloque), i); } catch (Throwable e) { ultimoError = "bloques: " + e; }
        }
        synchronized (cerrojo(i)) {
            if (hayTrozo(i)) return leerTrozo(i);
            long ini = (long) i * TROZO;
            int largo = (int) Math.min(TROZO, TAM_PAQUETE - ini);
            IOException ultimo = null;
            for (int intento = 0; intento < 4; intento++) {
                try {
                    byte[] d = bajar(ini, largo);
                    guardarTrozo(i, d, 0, d.length);
                    return d;
                } catch (IOException e) {
                    ultimo = e;
                    try { Thread.sleep(500L << intento); } catch (InterruptedException x) { break; }
                }
            }
            throw new IOException("trozo " + i + " (" + ultimoError + ") CDN: " + ultimo);
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

    // ---------- HTTP ----------
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
            byte[] resp;
            try {
                // la respuesta entera se arma antes de escribir: si algo falla, sale un 500 con el motivo (no un corte)
                if (ruta.contains("..")) resp = respuesta(404, "text/plain", "no".getBytes("UTF-8"), null);
                else if (ruta.equals(PAQUETE)) resp = paquete(rango);
                else if (ruta.equals("/estado")) resp = respuesta(200, "application/json", ("{\"trozos\":" + extraidos.get() + ",\"total\":" + TOTAL_TROZOS
                        + ",\"bloques\":" + (canal != null) + ",\"error\":\"" + ultimoError.replace("\\", "/").replace("\"", "'") + "\"}").getBytes("UTF-8"), null);
                else resp = archivo(ruta.substring(1), rango);
            } catch (Throwable e) {
                resp = respuesta(500, "text/plain", ("ERROR " + e).getBytes("UTF-8"), null);
            }
            out.write(resp);
            out.flush();
        } catch (Throwable e) {
            // conexión cortada
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
        if (n.endsWith(".ogg")) return "audio/ogg";
        return "application/octet-stream";
    }

    // cuerpo: completo (rango null) o el rango {a, b, total} ya recortado
    private static byte[] respuesta(int estado, String tipo, byte[] cuerpo, long[] rango) throws IOException {
        StringBuilder h = new StringBuilder();
        h.append("HTTP/1.1 ").append(estado).append(estado == 206 ? " Partial Content" : estado == 200 ? " OK" : " Error").append("\r\n");
        h.append("Content-Type: ").append(tipo).append("\r\nContent-Length: ").append(cuerpo.length).append("\r\n");
        if (rango != null) h.append("Content-Range: bytes ").append(rango[0]).append('-').append(rango[1]).append('/').append(rango[2]).append("\r\n");
        h.append("Accept-Ranges: bytes\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n");
        byte[] cab = h.toString().getBytes("ISO-8859-1");
        byte[] r = new byte[cab.length + cuerpo.length];
        System.arraycopy(cab, 0, r, 0, cab.length);
        System.arraycopy(cuerpo, 0, r, cab.length, cuerpo.length);
        return r;
    }

    private static byte[] leerTodo(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[65536];
            int k;
            while ((k = i.read(buf)) > 0) b.write(buf, 0, k);
            return b.toByteArray();
        }
    }

    private static byte[] buscar(String nombre) {
        File p = new File(dirParche, nombre);
        if (nombre.indexOf('/') < 0 && p.isFile()) { try { return leerTodo(new FileInputStream(p)); } catch (IOException e) { /* sigue */ } }
        try { return leerTodo(assets.open("sitio/" + nombre)); } catch (IOException e) { /* sigue */ }
        File d = new File(dirDatos, nombre);
        if (d.isFile()) { try { return leerTodo(new FileInputStream(d)); } catch (IOException e) { /* sigue */ } }
        return null;
    }

    private static byte[] archivo(String nombre, String rango) throws IOException {
        byte[] d = buscar(nombre);
        if (d == null && nombre.endsWith(".mp3")) { nombre = nombre.substring(0, nombre.length() - 4) + ".ogg"; d = buscar(nombre); }
        if (d == null) return respuesta(404, "text/plain", "no existe".getBytes("UTF-8"), null);
        long[] r = parsearRango(rango, d.length);
        if (r == null) return respuesta(200, tipo(nombre), d, null);
        byte[] c = new byte[(int) (r[1] - r[0] + 1)];
        System.arraycopy(d, (int) r[0], c, 0, c.length);
        return respuesta(206, tipo(nombre), c, new long[]{r[0], r[1], d.length});
    }

    private static byte[] paquete(String rango) throws IOException {
        long[] r = parsearRango(rango, TAM_PAQUETE);
        if (r == null) r = new long[]{0, Math.min(TAM_PAQUETE, TROZO) - 1}; // sin rango sólo se da el principio
        byte[] c = new byte[(int) (r[1] - r[0] + 1)];
        for (int i = (int) (r[0] / TROZO); (long) i * TROZO <= r[1]; i++) {
            byte[] t = trozo(i);
            long ini = Math.max(r[0], (long) i * TROZO), fin = Math.min(r[1], (long) (i + 1) * TROZO - 1);
            System.arraycopy(t, (int) (ini - (long) i * TROZO), c, (int) (ini - r[0]), (int) (fin - ini + 1));
        }
        return respuesta(206, "application/octet-stream", c, new long[]{r[0], r[1], TAM_PAQUETE});
    }
}
