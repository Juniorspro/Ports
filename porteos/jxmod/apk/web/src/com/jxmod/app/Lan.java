package com.jxmod.app;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * La partida en la red local (LAN / Wifi), sin internet. El aparato que hace de anfitrión corre:
 *  - un broker MQTT 3.1.1 mínimo sobre WebSocket, en /mqtt: lo que usa mqtt.js en el juego (CONNECT con testamento,
 *    SUBSCRIBE con los comodines + y #, PUBLISH QoS 0 —y 1 y 2 por las dudas—, mensajes retenidos —el mundo de cada
 *    jugador, la lista de mods del server—, UNSUBSCRIBE, PING y DISCONNECT). Así red.js no cambia: sólo la dirección;
 *  - en el mismo puerto, el juego por HTTP (lo que den los Archivos: en la app, assets/www) y /lan.json con los datos de la
 *    partida: un celular, una compu o un iPhone sin la app entra abriendo http://IP:8765/ en el navegador, sin internet;
 *  - el anuncio de la partida por UDP: un broadcast a la red cada segundo (puerto 8766) que la app de los demás escucha.
 * Y en la app de los que se unen, un puente en 127.0.0.1: la página del juego en la app es https y el navegador no la deja
 * abrir un ws:// a otra IP (contenido mixto); a 127.0.0.1 sí, y el puente lo pasa al anfitrión (sólo a IPs de la red local).
 * Sin nada de Android: se prueba en la compu (apk/pruebas/unido/PruebaLan.java, ServidorLan.java y pruebas/red_lan.mjs).
 */
final class Lan {
    static final int PUERTO = 8765, PUERTO_ANUNCIO = 8766, PUERTO_PUENTE = 8767;
    static final String MAGIA = "JXMODLAN1 ";
    /** Tope de un paquete (1 MB: el mundo de un jugador con 300 cosas son ~30 KB; una animación hecha por la gente, hasta 200 KB). */
    static final int MAX_PAQUETE = 1 << 20;
    private Lan() {}

    /** Un archivo del juego para servir por HTTP: su contenido y su largo (-1 si no se sabe). */
    static final class Archivo {
        final InputStream in; final long largo;
        Archivo(InputStream in, long largo) { this.in = in; this.largo = largo; }
    }
    /** De dónde salen los archivos del juego (en la app: assets/www; en la compu: una carpeta). null: no está (404). */
    interface Archivos { Archivo abrir(String ruta) throws IOException; }

    // ---------------------------------------------------------------- el broker ----------------------------------------------------------------
    static final class Broker {
        final int puerto;
        final Archivos archivos;
        /** Lo que devuelve /lan.json (JSON ya armado, sin "j": la cantidad de jugadores se agrega acá). */
        volatile String info = "{}";
        final ConcurrentHashMap<String, byte[]> retenidos = new ConcurrentHashMap<>();
        final Set<Sesion> sesiones = Collections.newSetFromMap(new ConcurrentHashMap<Sesion, Boolean>());
        private final Set<Socket> sockets = Collections.newSetFromMap(new ConcurrentHashMap<Socket, Boolean>());
        private final AtomicLong retBytes = new AtomicLong();
        private ServerSocket ss;
        private volatile boolean vivo;
        final AtomicLong publicados = new AtomicLong(), descartados = new AtomicLong();

        Broker(int puerto, Archivos archivos) { this.puerto = puerto; this.archivos = archivos; }

        synchronized void iniciar() throws IOException {
            if (vivo) return;
            ServerSocket s = new ServerSocket();
            s.setReuseAddress(true);
            s.bind(new InetSocketAddress(puerto), 64);
            ss = s; vivo = true;
            hilo(this::aceptar, "lan-broker");
        }
        boolean vivo() { return vivo; }
        synchronized void parar() {
            vivo = false;
            try { if (ss != null) ss.close(); } catch (IOException e) { /* nada */ }
            for (Sesion s : sesiones) s.cerrar(false);
            for (Socket s : sockets) cerrarSilencio(s);
            sesiones.clear(); sockets.clear(); retenidos.clear(); retBytes.set(0);
        }
        /** Jugadores en la sala: las conexiones suscriptas a una sala entera (ROOM/#). La de la lista de servers no cuenta. */
        int jugadores() {
            int n = 0;
            for (Sesion s : sesiones) for (String f : s.filtros) if (f.endsWith("/#") && f.startsWith("jxmod_")) { n++; break; }
            return n;
        }
        private void aceptar() {
            while (vivo) {
                try {
                    final Socket s = ss.accept();
                    s.setTcpNoDelay(true);
                    sockets.add(s);
                    hilo(() -> { try { atender(s); } finally { sockets.remove(s); } }, "lan-cliente");
                } catch (IOException e) { if (!vivo) return; }
            }
        }
        private void atender(Socket s) {
            try {
                s.setSoTimeout(15000);
                InputStream in = new BufferedInputStream(s.getInputStream(), 16384);
                OutputStream out = s.getOutputStream();
                Pedido p = Pedido.leer(in);
                if (p == null) { cerrarSilencio(s); return; }
                if (p.esWebSocket() && p.ruta.startsWith("/mqtt")) { websocket(s, in, out, p); return; }
                servir(out, p);
            } catch (Exception e) { /* conexión cortada */ }
            cerrarSilencio(s);
        }

        // ---- HTTP: el juego y /lan.json ----
        private void servir(OutputStream out, Pedido p) throws IOException {
            String ruta = p.ruta; int q = ruta.indexOf('?'); if (q >= 0) ruta = ruta.substring(0, q);
            ruta = decodificar(ruta);
            boolean head = "HEAD".equals(p.metodo);
            if (!"GET".equals(p.metodo) && !head) { responder(out, 405, "text/plain", "no".getBytes(StandardCharsets.UTF_8), head); return; }
            if (ruta == null || ruta.contains("..") || ruta.contains("\\") || !ruta.startsWith("/")) { responder(out, 400, "text/plain", "no".getBytes(StandardCharsets.UTF_8), head); return; }
            if (ruta.equals("/lan.json")) { responder(out, 200, "application/json; charset=utf-8", infoJson().getBytes(StandardCharsets.UTF_8), head); return; }
            if (ruta.equals("/")) ruta = "/index.html";
            Archivo a = archivos == null ? null : archivos.abrir(ruta.substring(1));
            if (a == null) { responder(out, 404, "text/plain", "no".getBytes(StandardCharsets.UTF_8), head); return; }
            try (InputStream in = a.in) {
                StringBuilder h = new StringBuilder("HTTP/1.1 200 OK\r\nContent-Type: ").append(tipo(ruta)).append("\r\n");
                if (a.largo >= 0) h.append("Content-Length: ").append(a.largo).append("\r\n");
                h.append("Cache-Control: no-cache\r\nConnection: close\r\n\r\n");
                out.write(h.toString().getBytes(StandardCharsets.ISO_8859_1));
                if (!head) { byte[] b = new byte[65536]; for (int n; (n = in.read(b)) > 0; ) out.write(b, 0, n); }
                out.flush();
            }
        }
        String infoJson() {
            String i = info == null ? "{}" : info.trim();
            String j = "\"j\":" + jugadores();
            return i.length() <= 2 ? "{" + j + "}" : i.substring(0, i.length() - 1) + "," + j + "}";
        }

        // ---- WebSocket y MQTT ----
        private void websocket(Socket s, InputStream in, OutputStream out, Pedido p) throws Exception {
            String acepta = base64(MessageDigest.getInstance("SHA-1").digest((p.cab.get("sec-websocket-key").trim() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").getBytes(StandardCharsets.ISO_8859_1)));
            String pedidos = p.cab.containsKey("sec-websocket-protocol") ? p.cab.get("sec-websocket-protocol") : "", proto = null;
            for (String x : pedidos.split(",")) { x = x.trim(); if (x.equals("mqtt") || x.equals("mqttv3.1")) { proto = x; break; } }
            out.write(("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + acepta + "\r\n"
                + (proto != null ? "Sec-WebSocket-Protocol: " + proto + "\r\n" : "") + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
            out.flush();
            new Sesion(this, s, in, out).correr();
        }
        void registrar(Sesion n) {
            // (el mismo clientId que ya estaba: se corta el viejo, como pide MQTT)
            for (Sesion s : sesiones) if (s != n && s.id.equals(n.id)) s.cerrar(true);
            sesiones.add(n);
        }
        /** Un mensaje que llega (de un jugador, o el testamento de uno que se cortó): se guarda si es retenido y va a cada suscripto. */
        void publicar(String tema, byte[] carga, boolean retener) {
            publicados.incrementAndGet();
            if (retener) {
                byte[] viejo = carga.length == 0 ? retenidos.remove(tema) : null;
                if (viejo != null) retBytes.addAndGet(-viejo.length);
                // (con tope: 20 000 temas o 64 MB; un retenido vacío lo borra)
                if (carga.length > 0 && (retenidos.containsKey(tema) || retenidos.size() < 20000) && retBytes.get() + carga.length < (64L << 20)) {
                    byte[] ant = retenidos.put(tema, carga); retBytes.addAndGet(carga.length - (ant == null ? 0 : ant.length));
                }
            }
            byte[] pk = null;
            for (Sesion s : sesiones) {
                if (!s.conectada || s.cerrada || !s.leInteresa(tema)) continue;
                if (pk == null) pk = paquetePublish(tema, carga, false);
                s.enviar(pk);
            }
        }
    }

    // ---- una conexión de un jugador ----
    static final class Sesion {
        final Broker B; final Socket s; final InputStream in; final OutputStream out;
        String id = "";
        final List<String> filtros = new CopyOnWriteArrayList<>();
        volatile boolean conectada, cerrada;
        private String willTema; private byte[] willCarga; private boolean willRet;
        // lo que sale: una cola con tope (si un jugador no da abasto se pierden mensajes, como en QoS 0) y un hilo que escribe
        private final LinkedBlockingQueue<byte[]> cola = new LinkedBlockingQueue<>();
        private final AtomicLong enCola = new AtomicLong();
        private static final long TOPE_COLA = 4L << 20;
        private static final byte[] DESPERTAR = new byte[0];
        // lo que entra: los bytes de los marcos WebSocket, hasta completar cada paquete MQTT
        private byte[] bb = new byte[8192]; private int bn;

        Sesion(Broker b, Socket s, InputStream in, OutputStream out) { this.B = b; this.s = s; this.in = in; this.out = out; }

        void correr() {
            hilo(this::escribir, "lan-salida");
            boolean limpio = false;
            try { limpio = leer(); } catch (Exception e) { limpio = false; }
            cerrar(!limpio);
        }
        boolean leInteresa(String tema) { for (String f : filtros) if (coincide(f, tema)) return true; return false; }
        void enviar(byte[] pk) {
            if (cerrada) return;
            if (enCola.get() + pk.length > TOPE_COLA) { B.descartados.incrementAndGet(); return; }
            enCola.addAndGet(pk.length); cola.offer(pk);
        }
        void cerrar(boolean conTestamento) {
            synchronized (this) { if (cerrada) return; cerrada = true; }
            B.sesiones.remove(this);
            cerrarSilencio(s);
            cola.clear(); cola.offer(DESPERTAR);
            if (conTestamento && conectada && willTema != null) B.publicar(willTema, willCarga, willRet);
        }
        // ---- lo que sale: los paquetes de la cola, juntos en un marco binario (de a 64 KB) ----
        private void escribir() {
            ByteArrayOutputStream m = new ByteArrayOutputStream();
            try {
                while (!cerrada) {
                    byte[] pk = cola.poll(5, TimeUnit.SECONDS);
                    if (pk == null || pk == DESPERTAR || cerrada) continue;
                    m.reset(); m.write(pk); enCola.addAndGet(-pk.length);
                    for (byte[] x; m.size() < 65536 && (x = cola.poll()) != null; ) { if (x == DESPERTAR) continue; m.write(x); enCola.addAndGet(-x.length); }
                    marco(0x82, m.toByteArray());
                }
            } catch (Exception e) { cerrar(true); }
        }
        private void marco(int op, byte[] d) throws IOException {
            byte[] h;
            if (d.length < 126) h = new byte[] { (byte) op, (byte) d.length };
            else if (d.length < 65536) h = new byte[] { (byte) op, 126, (byte) (d.length >> 8), (byte) d.length };
            else { h = new byte[10]; h[0] = (byte) op; h[1] = 127; long n = d.length; for (int i = 9; i >= 2; i--) { h[i] = (byte) n; n >>>= 8; } }
            synchronized (out) { out.write(h); out.write(d); out.flush(); }
        }
        // ---- lo que entra: marcos WebSocket (el cliente siempre enmascara) → paquetes MQTT ----
        private boolean leer() throws IOException {
            byte[] mascara = new byte[4];
            while (!cerrada) {
                int b0 = in.read(); if (b0 < 0) return false;
                int b1 = uno(); int op = b0 & 0x0F; long largo = b1 & 0x7F;
                if (largo == 126) largo = (uno() << 8) | uno();
                else if (largo == 127) { largo = 0; for (int i = 0; i < 8; i++) largo = (largo << 8) | uno(); }
                if ((b1 & 0x80) == 0) throw new IOException("marco sin máscara");
                if (largo > MAX_PAQUETE) throw new IOException("marco grande");
                todo(mascara, 4); byte[] d = new byte[(int) largo]; todo(d, d.length);
                for (int i = 0; i < d.length; i++) d[i] ^= mascara[i & 3];
                if (op == 8) { try { marco(0x88, new byte[0]); } catch (IOException e) { /* nada */ } return false; }
                if (op == 9) { marco(0x8A, d); continue; }
                if (op == 10) continue;
                if (op > 2) throw new IOException("marco " + op);
                agregar(d);
                if (procesar()) return true;
            }
            return false;
        }
        private int uno() throws IOException { int c = in.read(); if (c < 0) throw new IOException("fin"); return c; }
        private void todo(byte[] b, int n) throws IOException { for (int o = 0; o < n; ) { int k = in.read(b, o, n - o); if (k < 0) throw new IOException("fin"); o += k; } }
        private void agregar(byte[] d) {
            if (bn + d.length > bb.length) bb = Arrays.copyOf(bb, Math.max(bb.length * 2, bn + d.length));
            System.arraycopy(d, 0, bb, bn, d.length); bn += d.length;
        }
        /** Los paquetes MQTT completos que haya; true si llegó DISCONNECT. */
        private boolean procesar() throws IOException {
            while (bn >= 2) {
                int largo = 0, mult = 1, i = 1, c;
                do { if (i >= bn) return false; c = bb[i++] & 0xFF; largo += (c & 127) * mult; mult *= 128; if (i > 5) throw new IOException("largo mal"); } while ((c & 128) != 0);
                if (largo > MAX_PAQUETE) throw new IOException("paquete grande");
                if (bn < i + largo) {
                    if (bb.length < i + largo) bb = Arrays.copyOf(bb, i + largo);
                    return false;
                }
                int tipo = (bb[0] & 0xFF) >> 4, banderas = bb[0] & 0x0F;
                byte[] p = Arrays.copyOfRange(bb, i, i + largo);
                System.arraycopy(bb, i + largo, bb, 0, bn - i - largo); bn -= i + largo;
                if (paquete(tipo, banderas, p)) return true;
            }
            return false;
        }
        private boolean paquete(int tipo, int banderas, byte[] p) throws IOException {
            if (!conectada && tipo != 1) throw new IOException("sin CONNECT");
            switch (tipo) {
                case 1: conectar(p); return false;
                case 3: {   // PUBLISH
                    int qos = (banderas >> 1) & 3, tl = u16(p, 0), o = 2 + tl;
                    String tema = new String(p, 2, tl, StandardCharsets.UTF_8);
                    int pid = 0; if (qos > 0) { pid = u16(p, o); o += 2; }
                    if (tema.isEmpty() || tema.indexOf('+') >= 0 || tema.indexOf('#') >= 0) throw new IOException("tema inválido");
                    B.publicar(tema, Arrays.copyOfRange(p, o, p.length), (banderas & 1) != 0);
                    if (qos == 1) enviar(new byte[] { 0x40, 2, (byte) (pid >> 8), (byte) pid });
                    else if (qos == 2) enviar(new byte[] { 0x50, 2, (byte) (pid >> 8), (byte) pid });
                    return false;
                }
                case 6: enviar(new byte[] { 0x70, 2, p[0], p[1] }); return false;   // PUBREL → PUBCOMP
                case 8: suscribir(p); return false;
                case 10: desuscribir(p); return false;
                case 12: enviar(new byte[] { (byte) 0xD0, 0 }); return false;   // PINGREQ → PINGRESP
                case 14: return true;   // DISCONNECT: se va bien, sin testamento
                default: return false;   // (PUBACK, PUBREC, PUBCOMP del cliente)
            }
        }
        private void conectar(byte[] p) throws IOException {
            if (conectada) throw new IOException("CONNECT dos veces");
            int nl = u16(p, 0), o = 2 + nl; String nom = new String(p, 2, nl, StandardCharsets.UTF_8);
            int nivel = p[o++] & 0xFF, fl = p[o++] & 0xFF, ka = u16(p, o); o += 2;
            if (!(("MQTT".equals(nom) && nivel == 4) || ("MQIsdp".equals(nom) && nivel == 3))) { enviar(new byte[] { 0x20, 2, 0, 1 }); throw new IOException("protocolo " + nom + " " + nivel); }
            int il = u16(p, o); id = new String(p, o + 2, il, StandardCharsets.UTF_8); o += 2 + il;
            if ((fl & 4) != 0) {
                int tl = u16(p, o); willTema = new String(p, o + 2, tl, StandardCharsets.UTF_8); o += 2 + tl;
                int ml = u16(p, o); willCarga = Arrays.copyOfRange(p, o + 2, o + 2 + ml); willRet = (fl & 32) != 0;
            }
            if (id.isEmpty()) id = "anon" + Long.toHexString(System.nanoTime());
            // (si no llega nada en 1,5 veces el keepalive, se cortó: sale su testamento)
            s.setSoTimeout(ka > 0 ? ka * 1500 : 0);
            conectada = true;
            B.registrar(this);
            enviar(new byte[] { 0x20, 2, 0, 0 });
        }
        private void suscribir(byte[] p) throws IOException {
            int pid = u16(p, 0), o = 2;
            ByteArrayOutputStream rc = new ByteArrayOutputStream(); List<String> nuevos = new ArrayList<>();
            while (o + 2 <= p.length) {
                int tl = u16(p, o); String f = new String(p, o + 2, tl, StandardCharsets.UTF_8); o += 3 + tl;
                if (filtroValido(f)) { if (!filtros.contains(f)) filtros.add(f); nuevos.add(f); rc.write(0); } else rc.write(0x80);
            }
            byte[] r = rc.toByteArray(); ByteArrayOutputStream a = new ByteArrayOutputStream();
            a.write(0x90); largoMqtt(a, 2 + r.length); a.write(pid >> 8); a.write(pid); a.write(r);
            enviar(a.toByteArray());
            // (los retenidos de cada filtro nuevo, con la marca de retenido; volver a suscribirse los manda otra vez)
            for (String f : nuevos) for (Map.Entry<String, byte[]> e : B.retenidos.entrySet()) if (coincide(f, e.getKey())) enviar(paquetePublish(e.getKey(), e.getValue(), true));
        }
        private void desuscribir(byte[] p) throws IOException {
            int pid = u16(p, 0), o = 2;
            while (o + 2 <= p.length) { int tl = u16(p, o); filtros.remove(new String(p, o + 2, tl, StandardCharsets.UTF_8)); o += 2 + tl; }
            enviar(new byte[] { (byte) 0xB0, 2, (byte) (pid >> 8), (byte) pid });
        }
    }

    // ---- MQTT: temas y paquetes ----
    /** ¿El filtro (con + y #) abarca el tema? ("a/#" abarca "a"; los temas que empiezan con $ no entran por comodines) */
    static boolean coincide(String filtro, String tema) {
        if (filtro.equals(tema)) return true;
        if (tema.startsWith("$") && (filtro.startsWith("+") || filtro.startsWith("#"))) return false;
        String[] f = filtro.split("/", -1), t = tema.split("/", -1);
        for (int i = 0; i < f.length; i++) {
            if (f[i].equals("#")) return true;
            if (i >= t.length) return false;
            if (!f[i].equals("+") && !f[i].equals(t[i])) return false;
        }
        return f.length == t.length;
    }
    static boolean filtroValido(String f) {
        if (f.isEmpty() || f.length() > 400) return false;
        String[] p = f.split("/", -1);
        for (int i = 0; i < p.length; i++) {
            if (p[i].contains("#") && (!p[i].equals("#") || i != p.length - 1)) return false;
            if (p[i].contains("+") && !p[i].equals("+")) return false;
        }
        return true;
    }
    static byte[] paquetePublish(String tema, byte[] carga, boolean retenido) {
        byte[] t = tema.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream o = new ByteArrayOutputStream(t.length + carga.length + 8);
        o.write(0x30 | (retenido ? 1 : 0)); largoMqtt(o, 2 + t.length + carga.length);
        o.write(t.length >> 8); o.write(t.length); o.write(t, 0, t.length); o.write(carga, 0, carga.length);
        return o.toByteArray();
    }
    static void largoMqtt(ByteArrayOutputStream o, int n) { do { int d = n % 128; n /= 128; if (n > 0) d |= 128; o.write(d); } while (n > 0); }
    static int u16(byte[] p, int o) throws IOException { if (o + 1 >= p.length) throw new IOException("corto"); return ((p[o] & 0xFF) << 8) | (p[o + 1] & 0xFF); }

    // ---- HTTP ----
    static final class Pedido {
        String metodo, ruta;
        final Map<String, String> cab = new HashMap<>();
        boolean esWebSocket() { String u = cab.get("upgrade"); return u != null && u.equalsIgnoreCase("websocket") && cab.containsKey("sec-websocket-key"); }
        static Pedido leer(InputStream in) throws IOException {
            String l = linea(in); if (l == null) return null;
            String[] x = l.split(" "); if (x.length < 3) return null;
            Pedido p = new Pedido(); p.metodo = x[0]; p.ruta = x[1];
            int n = 0;
            for (String h; (h = linea(in)) != null && !h.isEmpty(); ) {
                if (++n > 100) return null;
                int i = h.indexOf(':'); if (i > 0) p.cab.put(h.substring(0, i).trim().toLowerCase(Locale.ROOT), h.substring(i + 1).trim());
            }
            return p;
        }
        static String linea(InputStream in) throws IOException {
            StringBuilder b = new StringBuilder(); int c;
            while ((c = in.read()) >= 0) { if (c == '\n') break; if (c != '\r') b.append((char) c); if (b.length() > 8192) throw new IOException("línea larga"); }
            return c < 0 && b.length() == 0 ? null : b.toString();
        }
    }
    static void responder(OutputStream out, int st, String tipo, byte[] b, boolean head) throws IOException {
        String r = st == 200 ? "OK" : st == 404 ? "Not Found" : st == 405 ? "Method Not Allowed" : "Bad Request";
        // (/lan.json se pide también desde otra página: la app por su puente, o el juego abierto desde otra dirección)
        out.write(("HTTP/1.1 " + st + " " + r + "\r\nContent-Type: " + tipo + "\r\nContent-Length: " + b.length + "\r\nCache-Control: no-store\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
        if (!head) out.write(b);
        out.flush();
    }
    static String tipo(String p) {
        String q = p.toLowerCase(Locale.ROOT);
        if (q.endsWith(".html")) return "text/html; charset=utf-8";
        if (q.endsWith(".js") || q.endsWith(".mjs")) return "application/javascript; charset=utf-8";
        if (q.endsWith(".json") || q.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (q.endsWith(".css")) return "text/css; charset=utf-8";
        if (q.endsWith(".webp")) return "image/webp";
        if (q.endsWith(".png")) return "image/png";
        if (q.endsWith(".jpg") || q.endsWith(".jpeg")) return "image/jpeg";
        if (q.endsWith(".svg")) return "image/svg+xml";
        if (q.endsWith(".ogg")) return "audio/ogg";
        if (q.endsWith(".mp3")) return "audio/mpeg";
        if (q.endsWith(".wav")) return "audio/wav";
        if (q.endsWith(".mp4")) return "video/mp4";
        if (q.endsWith(".wasm")) return "application/wasm";
        return "application/octet-stream";
    }
    static String decodificar(String r) {
        try {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            for (int i = 0; i < r.length(); i++) {
                char c = r.charAt(i);
                if (c == '%' && i + 2 < r.length()) { o.write(Integer.parseInt(r.substring(i + 1, i + 3), 16)); i += 2; }
                else if (c < 128) o.write(c); else return null;
            }
            return new String(o.toByteArray(), StandardCharsets.UTF_8);
        } catch (Exception e) { return null; }
    }
    static String base64(byte[] b) {
        final String A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < b.length; i += 3) {
            int n = (b[i] & 0xFF) << 16 | (i + 1 < b.length ? (b[i + 1] & 0xFF) << 8 : 0) | (i + 2 < b.length ? b[i + 2] & 0xFF : 0);
            s.append(A.charAt(n >> 18 & 63)).append(A.charAt(n >> 12 & 63)).append(i + 1 < b.length ? A.charAt(n >> 6 & 63) : '=').append(i + 2 < b.length ? A.charAt(n & 63) : '=');
        }
        return s.toString();
    }
    static String jsonTexto(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20 || c == 0x2028 || c == 0x2029 || c == '<' || c == '>') b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    // ---------------------------------------------------------------- la red: IPs y anuncios ----------------------------------------------------------------
    /** Las IPv4 propias en la red local (wifi, punto de acceso, cable), sin la de loopback; primero las de redes privadas. */
    static List<String> ips() {
        List<String> L = new ArrayList<>(), otras = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address)) continue;
                    String ip = a.getHostAddress(); List<String> d = redPrivada(ip) ? L : otras; if (!d.contains(ip)) d.add(ip);
                }
            }
        } catch (Exception e) { /* sin red */ }
        L.addAll(otras); return L;
    }
    /** ¿La IP es de la red local? Una de rango privado o de la misma subred que alguna de las redes de este aparato. */
    static boolean enMiRed(String ip) {
        if (redPrivada(ip)) return true;
        try {
            if (ip == null || !ip.matches("^\\d{1,3}(\\.\\d{1,3}){3}$")) return false;   // (sólo números: sin buscar nombres en el DNS)
            byte[] b = InetAddress.getByName(ip).getAddress(); if (b.length != 4) return false;
            int x = (b[0] & 0xFF) << 24 | (b[1] & 0xFF) << 16 | (b[2] & 0xFF) << 8 | (b[3] & 0xFF);
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) {
                    byte[] c = ia.getAddress().getAddress(); int pre = ia.getNetworkPrefixLength(); if (c.length != 4 || pre < 8 || pre > 30) continue;
                    int y = (c[0] & 0xFF) << 24 | (c[1] & 0xFF) << 16 | (c[2] & 0xFF) << 8 | (c[3] & 0xFF), m = -1 << (32 - pre);
                    if ((x & m) == (y & m)) return true;
                }
            }
        } catch (Exception e) { /* nada */ }
        return false;
    }
    /** Adónde mandar el anuncio: el broadcast de cada red (192.168.1.255…) y el general. */
    static List<InetAddress> broadcasts() {
        List<InetAddress> L = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InterfaceAddress ia : ni.getInterfaceAddresses()) { InetAddress b = ia.getBroadcast(); if (b != null && !L.contains(b)) L.add(b); }
            }
        } catch (Exception e) { /* sin red */ }
        try { InetAddress g = InetAddress.getByName("255.255.255.255"); if (!L.contains(g)) L.add(g); } catch (Exception e) { /* nada */ }
        return L;
    }
    /** IPs de una red local (las únicas a las que deja ir el puente): 10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10 y loopback. */
    static boolean redPrivada(String ip) {
        Matcher m = Pattern.compile("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$").matcher(ip == null ? "" : ip);
        if (!m.matches()) return false;
        int a = Integer.parseInt(m.group(1)), b = Integer.parseInt(m.group(2));
        for (int i = 1; i <= 4; i++) if (Integer.parseInt(m.group(i)) > 255) return false;
        return a == 10 || a == 127 || (a == 172 && b >= 16 && b <= 31) || (a == 192 && b == 168) || (a == 169 && b == 254) || (a == 100 && b >= 64 && b <= 127);
    }

    /** El anuncio de la partida: cada segundo, "JXMODLAN1 {json}" por broadcast al puerto 8766 de cada red. */
    static final class Anuncio {
        /** Lo que se anuncia; con un broker, sus datos y la cantidad de jugadores de ahora (infoJson). */
        volatile String datos = "{}";
        volatile Broker broker;
        private volatile boolean vivo; private DatagramSocket ds; final int puerto;
        Anuncio(int puerto) { this.puerto = puerto; }
        synchronized void iniciar() throws SocketException {
            if (vivo) return;
            ds = new DatagramSocket(); ds.setBroadcast(true); vivo = true;
            final DatagramSocket d = ds;
            hilo(() -> {
                while (vivo) {
                    Broker br = broker;
                    byte[] b = (MAGIA + (br != null ? br.infoJson() : datos)).getBytes(StandardCharsets.UTF_8);
                    for (InetAddress a : broadcasts()) { try { d.send(new DatagramPacket(b, b.length, a, puerto)); } catch (IOException e) { /* esa red no deja */ } }
                    try { Thread.sleep(1000); } catch (InterruptedException e) { return; }
                }
            }, "lan-anuncio");
        }
        synchronized void parar() { vivo = false; if (ds != null) ds.close(); }
    }

    /** Escucha los anuncios: los anfitriones de la red (por IP), con lo último que dijeron y cuándo. */
    static final class Escucha {
        static final class Host { final String datos; final long t; Host(String d, long t) { this.datos = d; this.t = t; } }
        final ConcurrentHashMap<String, Host> hosts = new ConcurrentHashMap<>();
        private volatile boolean vivo; private DatagramSocket ds; final int puerto;
        Escucha(int puerto) { this.puerto = puerto; }
        synchronized void iniciar() throws SocketException {
            if (vivo) return;
            DatagramSocket d = new DatagramSocket(null); d.setReuseAddress(true); d.setBroadcast(true); d.bind(new InetSocketAddress(puerto));
            ds = d; vivo = true;
            hilo(() -> {
                byte[] b = new byte[2048];
                while (vivo) {
                    try {
                        DatagramPacket p = new DatagramPacket(b, b.length); d.receive(p);
                        String s = new String(p.getData(), 0, p.getLength(), StandardCharsets.UTF_8);
                        String ip = p.getAddress().getHostAddress();
                        if (s.startsWith(MAGIA) && s.length() < 1600 && enMiRed(ip)) hosts.put(ip, new Host(s.substring(MAGIA.length()), System.currentTimeMillis()));
                    } catch (IOException e) { if (!vivo) return; }
                }
            }, "lan-escucha");
        }
        synchronized void parar() { vivo = false; if (ds != null) ds.close(); hosts.clear(); }
        /** [{"ip":"…","edad":ms,"d":"{…lo que anunció…}"}] de los que se oyeron en los últimos 5 s (el juego valida "d"). */
        String lista() {
            long ahora = System.currentTimeMillis(); StringBuilder b = new StringBuilder("[");
            for (Map.Entry<String, Host> e : hosts.entrySet()) {
                long edad = ahora - e.getValue().t; if (edad > 5000) continue;
                if (b.length() > 1) b.append(',');
                b.append("{\"ip\":").append(jsonTexto(e.getKey())).append(",\"edad\":").append(edad).append(",\"d\":").append(jsonTexto(e.getValue().datos)).append('}');
            }
            return b.append(']').toString();
        }
    }

    /**
     * El puente de la app de los que se unen: escucha en 127.0.0.1 y pasa "GET /lan/IP:PUERTO/mqtt" a IP:PUERTO (sólo IPs de
     * la red local: de rango privado o de la subred de este aparato), byte a byte en los dos sentidos. La página del juego en la app es https y el navegador no la deja abrir
     * un ws:// a otra IP de la red (contenido mixto); a 127.0.0.1 sí.
     */
    static final class Puente {
        private static final Pattern RUTA = Pattern.compile("^/lan/(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}):(\\d{2,5})(/.*)$");
        private ServerSocket ss; private volatile boolean vivo; final int puerto;
        Puente(int puerto) { this.puerto = puerto; }
        synchronized void iniciar() throws IOException {
            if (vivo) return;
            ServerSocket s = new ServerSocket(); s.setReuseAddress(true); s.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), puerto), 16);
            ss = s; vivo = true;
            hilo(() -> {
                while (vivo) {
                    try { final Socket c = ss.accept(); hilo(() -> manejar(c), "lan-puente"); } catch (IOException e) { if (!vivo) return; }
                }
            }, "lan-puente-acepta");
        }
        boolean vivo() { return vivo; }
        synchronized void parar() { vivo = false; try { if (ss != null) ss.close(); } catch (IOException e) { /* nada */ } }
        private void manejar(Socket c) {
            Socket t = null;
            try {
                c.setSoTimeout(15000);
                InputStream ci = new BufferedInputStream(c.getInputStream(), 16384);
                Pedido p = Pedido.leer(ci);
                Matcher m = p == null ? null : RUTA.matcher(p.ruta);
                if (m == null || !m.matches() || !enMiRed(m.group(1)) || Integer.parseInt(m.group(2)) > 65535) { responder(c.getOutputStream(), 400, "text/plain", "no".getBytes(StandardCharsets.UTF_8), false); cerrarSilencio(c); return; }
                t = new Socket(); t.setTcpNoDelay(true); t.connect(new InetSocketAddress(m.group(1), Integer.parseInt(m.group(2))), 5000);
                StringBuilder h = new StringBuilder(p.metodo + " " + m.group(3) + " HTTP/1.1\r\nhost: " + m.group(1) + ":" + m.group(2) + "\r\n");
                for (Map.Entry<String, String> e : p.cab.entrySet()) if (!e.getKey().equals("host")) h.append(e.getKey()).append(": ").append(e.getValue()).append("\r\n");
                OutputStream to = t.getOutputStream(); to.write(h.append("\r\n").toString().getBytes(StandardCharsets.ISO_8859_1)); to.flush();
                c.setSoTimeout(0);
                final Socket tt = t; final InputStream ti = t.getInputStream(); final OutputStream co = c.getOutputStream();
                hilo(() -> { copiar(ti, co); cerrarSilencio(c); cerrarSilencio(tt); }, "lan-puente-vuelta");
                copiar(ci, to);
            } catch (Exception e) { /* se cortó */ }
            cerrarSilencio(c); if (t != null) cerrarSilencio(t);
        }
        private static void copiar(InputStream in, OutputStream out) {
            byte[] b = new byte[16384];
            try { for (int n; (n = in.read(b)) > 0; ) { out.write(b, 0, n); out.flush(); } } catch (IOException e) { /* se cortó */ }
        }
    }

    static void hilo(Runnable r, String nombre) { Thread t = new Thread(r, nombre); t.setDaemon(true); t.start(); }
    static void cerrarSilencio(Socket s) { try { s.close(); } catch (Exception e) { /* nada */ } }
}
